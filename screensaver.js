/* ============================================================
   Descanso de tela — tela cheia preta com barras animadas (estilo
   Winamp), capa, nome do que toca e relógio. O bloco de informações
   muda de lugar de tempos em tempos pra não marcar a tela.

   Escolhe sozinho pelo que está tocando:
   - faixa da biblioteca: sincronizado com a música. Em vez de ligar o
     <audio> ao Web Audio — o que deixaria mudas as rádios sem CORS e pode
     atrapalhar tocar com a tela desligada —, o arquivo da faixa é
     decodificado à parte (OfflineAudioContext) e o espectro e a onda são
     calculados aqui, no ponto em que o player está (currentTime). O áudio
     que toca nunca passa por aqui.
   - rádio (a página não pode ler o áudio dela): animação que não segue a
     música, com o mesmo visual.

   Exceção: o estilo "Suave" não segue a música — só relógio, capa, o que
   toca e um fundo calmo nas cores da capa (bom pra deixar ligado no
   trabalho).

   Estilos: cada um em STYLES, recebendo os níveis já suavizados — pra
   criar outro, é só acrescentar uma entrada (aparece nas Configurações).

   Expõe `window.RadioScreensaver`.
   ============================================================ */
(function () {
    "use strict";

    const BARS = 32;
    const FFT_SIZE = 2048;
    const MAX_DECODE_SECONDS = 15 * 60; // faixa maior que isso: só animação (memória)
    const DRIFT_MS = 20000;

    let root = null;
    let canvas = null;
    let ctx2d = null;
    let infoEl = null;
    let artEl = null;
    let titleEl = null;
    let subEl = null;
    let clockEl = null;
    let dateEl = null;
    let modeEl = null;
    let hintEl = null;

    let provider = null;
    let onClosed = null;
    let rafId = 0;
    let driftTimer = 0;
    let clockTimer = 0;
    let enteredFullscreen = false;
    let style = null;

    const levels = new Float32Array(BARS);
    const peaks = new Float32Array(BARS);
    const peakHold = new Float32Array(BARS);
    let lastFrame = 0;
    let lastDraw = 0;
    // Cores do fundo do "Suave": as da capa (palTarget) e as que estão na
    // tela (palCurrent), que andam devagar até elas.
    let palKey = "";
    let palTarget = null;
    let palCurrent = null;
    let reduceMotion = false;

    // Análise da faixa atual (modo sincronizado).
    let pcm = null; // { key, data: Float32Array mono, rate }
    let pcmLoadingKey = "";
    let pcmFailedKey = "";

    // ---------- FFT (radix-2, in-place) ----------
    const fft = (function () {
        const n = FFT_SIZE;
        const rev = new Uint32Array(n);
        const bits = Math.log2(n);
        for (let i = 0; i < n; i++) {
            let r = 0;
            for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
            rev[i] = r;
        }
        const cos = new Float32Array(n / 2);
        const sin = new Float32Array(n / 2);
        for (let i = 0; i < n / 2; i++) {
            cos[i] = Math.cos((2 * Math.PI * i) / n);
            sin[i] = -Math.sin((2 * Math.PI * i) / n);
        }
        const hann = new Float32Array(n);
        for (let i = 0; i < n; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
        const re = new Float32Array(n);
        const im = new Float32Array(n);
        const mag = new Float32Array(n / 2);

        // Magnitudes (n/2) da janela que começa em `start`.
        return function (data, start) {
            for (let i = 0; i < n; i++) {
                const v = data[start + i] || 0;
                re[rev[i]] = v * hann[i];
                im[rev[i]] = 0;
            }
            for (let size = 2; size <= n; size <<= 1) {
                const half = size >> 1;
                const step = n / size;
                for (let i = 0; i < n; i += size) {
                    for (let j = 0; j < half; j++) {
                        const k = j * step;
                        const a = i + j;
                        const b = a + half;
                        const tr = re[b] * cos[k] - im[b] * sin[k];
                        const ti = re[b] * sin[k] + im[b] * cos[k];
                        re[b] = re[a] - tr;
                        im[b] = im[a] - ti;
                        re[a] += tr;
                        im[a] += ti;
                    }
                }
            }
            for (let i = 0; i < n / 2; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
            return mag;
        };
    })();

    // Faixas de frequência em escala logarítmica (40 Hz a 16 kHz).
    function bandEdges(rate) {
        const edges = [];
        const lo = Math.log(40);
        const hi = Math.log(Math.min(16000, rate / 2));
        for (let b = 0; b <= BARS; b++) {
            const f = Math.exp(lo + ((hi - lo) * b) / BARS);
            edges.push(Math.max(1, Math.round((f * FFT_SIZE) / rate)));
        }
        return edges;
    }

    // ---------- Montagem da tela ----------
    function build() {
        root = document.createElement("div");
        root.className = "screensaver";
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-label", "Descanso de tela. Toque para sair.");
        if (style.layout) root.classList.add("screensaver--" + style.layout);

        canvas = document.createElement("canvas");
        canvas.className = "screensaver__canvas";
        ctx2d = canvas.getContext("2d");

        infoEl = document.createElement("div");
        infoEl.className = "screensaver__info";
        artEl = document.createElement("img");
        artEl.className = "screensaver__art";
        artEl.alt = "";
        artEl.addEventListener("error", () => (artEl.hidden = true));
        const text = document.createElement("div");
        text.className = "screensaver__text";
        titleEl = document.createElement("div");
        titleEl.className = "screensaver__title";
        subEl = document.createElement("div");
        subEl.className = "screensaver__sub";
        clockEl = document.createElement("div");
        clockEl.className = "screensaver__clock";
        dateEl = document.createElement("div");
        dateEl.className = "screensaver__date";
        text.append(titleEl, subEl, clockEl, dateEl);
        infoEl.append(artEl, text);

        modeEl = document.createElement("div");
        modeEl.className = "screensaver__mode";
        hintEl = document.createElement("div");
        hintEl.className = "screensaver__hint";
        hintEl.textContent = "Toque para sair";

        root.append(canvas, infoEl, modeEl, hintEl);
        root.addEventListener("click", () => close());
        document.body.appendChild(root);
    }

    function resize() {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
    }

    function updateInfo() {
        if (!provider) return;
        const i = provider.info() || {};
        titleEl.textContent = i.title || "Nada tocando";
        subEl.textContent = i.subtitle || "";
        if (i.art) {
            if (artEl.getAttribute("src") !== i.art) artEl.src = i.art;
            artEl.hidden = false;
        } else {
            artEl.removeAttribute("src");
            artEl.hidden = true;
        }
    }

    function tickClock() {
        const d = new Date();
        clockEl.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        dateEl.textContent = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
        updateInfo();
    }

    // Leva o bloco de informações pra outro ponto da tela (anti-marcação).
    function drift() {
        if (!infoEl) return;
        const [[x0, x1], [y0, y1]] = style.drift || DEFAULT_DRIFT;
        const x = x0 + Math.random() * (x1 - x0);
        const y = y0 + Math.random() * (y1 - y0);
        infoEl.style.left = x + "%";
        infoEl.style.top = y + "%";
    }

    // ---------- Visualizador sincronizado ----------
    async function ensurePcm() {
        if (!provider) return;
        const i = provider.info() || {};
        const key = i.isTrack ? provider.trackKey() : "";
        if (!key || (pcm && pcm.key === key) || pcmLoadingKey === key || pcmFailedKey === key) return;
        pcm = null;
        pcmLoadingKey = key;
        try {
            const buf = await provider.audioData();
            if (!buf || pcmLoadingKey !== key) throw new Error("sem dados");
            const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (!Offline) throw new Error("navegador sem OfflineAudioContext");
            const audio = await new Offline(1, 1, 44100).decodeAudioData(buf);
            if (pcmLoadingKey !== key) return;
            if (audio.duration > MAX_DECODE_SECONDS) throw new Error("faixa longa demais");
            const len = audio.length;
            const mono = new Float32Array(len);
            const chans = audio.numberOfChannels;
            for (let c = 0; c < chans; c++) {
                const d = audio.getChannelData(c);
                for (let s = 0; s < len; s++) mono[s] += d[s] / chans;
            }
            pcm = { key, data: mono, rate: audio.sampleRate, edges: bandEdges(audio.sampleRate) };
        } catch (err) {
            console.warn("Visualizador: análise indisponível —", err && err.message);
            pcmFailedKey = key;
        } finally {
            if (pcmLoadingKey === key) pcmLoadingKey = "";
        }
    }

    function syncedLevels(t) {
        const start = Math.floor(t * pcm.rate) - FFT_SIZE / 2;
        if (start < 0 || start + FFT_SIZE > pcm.data.length) return null;
        const mag = fft(pcm.data, start);
        const out = new Float32Array(BARS);
        for (let b = 0; b < BARS; b++) {
            const from = pcm.edges[b];
            const to = Math.max(from + 1, pcm.edges[b + 1]);
            let sum = 0;
            for (let k = from; k < to; k++) sum += mag[k];
            const avg = sum / (to - from);
            // dB normalizado: ~-60 dB -> 0, 0 dB -> 1
            const db = 20 * Math.log10(avg / (FFT_SIZE / 4) + 1e-9);
            out[b] = Math.max(0, Math.min(1, (db + 60) / 60));
        }
        return { levels: out, start };
    }

    function syntheticLevels(time, playing) {
        const out = new Float32Array(BARS);
        if (!playing) return out;
        for (let b = 0; b < BARS; b++) {
            const x = b / BARS;
            const base = 0.55 - x * 0.3; // graves mais altos, como numa música
            const wobble =
                0.25 * Math.sin(time * 2.1 + b * 0.55) +
                0.18 * Math.sin(time * 3.7 + b * 1.3) +
                0.12 * Math.sin(time * 7.3 + b * 2.9);
            out[b] = Math.max(0.03, Math.min(1, base + wobble));
        }
        return out;
    }

    // Cor CSS qualquer (a de destaque vem do tema) com outra opacidade —
    // o canvas devolve a cor normalizada em #rrggbb.
    const rgbaCache = {};
    function toRgb(c, color) {
        if (!rgbaCache[color]) {
            c.fillStyle = "#000";
            c.fillStyle = color;
            const hex = String(c.fillStyle);
            const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
            // Cor com transparência o canvas devolve como rgba(r, g, b, a).
            const n = !m && /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(hex);
            if (m) rgbaCache[color] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
            else if (n) rgbaCache[color] = [+n[1], +n[2], +n[3]];
            else throw new Error("Descanso de tela: cor inválida — " + color);
        }
        return rgbaCache[color];
    }

    function rgba([r, g, b], a) {
        return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
    }

    function mixRgb(a, b, k) {
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }

    function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        if (max === min) return [0, 0, l];
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return [h / 6, s, l];
    }

    function hslToRgb(h, s, l) {
        if (!s) return [l * 255, l * 255, l * 255];
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const f = (t) => {
            t = (t + 1) % 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
    }

    // As 3 cores que mais marcam a capa: agrupa os pixels por matiz (os
    // cinzentos num grupo à parte), dá mais peso aos saturados e deixa as
    // cores com brilho bom pra luz de fundo. Capa de uma cor só: as outras
    // saem dela, girando um pouco a matiz.
    function extractPalette(img) {
        const S = 32;
        const cv = document.createElement("canvas");
        cv.width = cv.height = S;
        const c = cv.getContext("2d", { willReadFrequently: true });
        c.drawImage(img, 0, 0, S, S);
        const d = c.getImageData(0, 0, S, S).data; // capa sem CORS: SecurityError
        const groups = new Map();
        for (let k = 0; k < d.length; k += 4) {
            if (d[k + 3] < 128) continue;
            const [h, sat, l] = rgbToHsl(d[k], d[k + 1], d[k + 2]);
            if (l < 0.07 || l > 0.96) continue;
            const key = sat < 0.18 ? "gray" : Math.floor(h * 12);
            const gr = groups.get(key) || { n: 0, r: 0, g: 0, b: 0, score: 0 };
            gr.n++;
            gr.r += d[k];
            gr.g += d[k + 1];
            gr.b += d[k + 2];
            gr.score += 0.3 + sat;
            groups.set(key, gr);
        }
        const picked = [...groups.values()]
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((gr) => {
                const [h, sat, l] = rgbToHsl(gr.r / gr.n, gr.g / gr.n, gr.b / gr.n);
                const vivid = sat < 0.18 ? sat : Math.max(sat, 0.5);
                return hslToRgb(h, vivid, Math.min(0.62, Math.max(0.45, l)));
            });
        if (!picked.length) return null; // capa toda preta/branca: fica com as cores do tema
        while (picked.length < 3) {
            const [h, sat, l] = rgbToHsl(...picked[0]);
            picked.push(hslToRgb(h + (picked.length === 1 ? 0.08 : -0.08), sat, l));
        }
        return picked;
    }

    function defaultPalette(c, accent) {
        return [toRgb(c, accent), [167, 139, 250], [45, 212, 191]];
    }

    // Lê as cores da capa (uma vez por capa). A capa que aparece na tela é
    // outra <img>, sem crossOrigin — se esta falhar, só o fundo fica com as
    // cores do tema.
    function ensurePalette(url) {
        if (url === palKey) return;
        palKey = url;
        palTarget = null;
        if (!url) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            if (palKey !== url) return;
            try {
                palTarget = extractPalette(img);
            } catch (err) {
                console.warn("Descanso de tela: não deu pra ler as cores da capa —", err && err.message);
            }
            if (reduceMotion && palTarget) {
                palCurrent = palTarget.map((x) => x.slice());
                requestAnimationFrame(frame);
            }
        };
        img.onerror = () => {
            if (palKey === url) console.warn("Descanso de tela: capa não carregou pra ler as cores (CORS?) —", url);
        };
        // URL própria: a cópia que a tela já carregou (sem CORS) pode estar no
        // cache sem o cabeçalho Access-Control-Allow-Origin e travar a leitura.
        img.src = /^https?:/.test(url) ? url + (url.includes("?") ? "&" : "?") + "ss-cores=1" : url;
    }

    // ---------- Estilos ----------
    // draw(c, w, h, f): c = contexto 2D já limpo; f = { levels, peaks (0..1
    // por barra), wave (amostras da onda ou null — só no sincronizado),
    // accent (cor de destaque), playing, synced, time (segundos) }.
    // Opcionais: layout (classe screensaver--<layout> pro bloco de texto),
    // analyze: false (não baixa/analisa a faixa), fps (limita os quadros),
    // drift ([[x mín, x máx], [y mín, y máx]] em %, pra onde o texto passeia).
    const DEFAULT_DRIFT = [
        [6, 46], // % da largura livre
        [6, 24] // % da altura: fica no alto; onda e barras ficam da metade pra baixo
    ];
    const STYLES = {
        bars: {
            label: "Barras (Winamp)",
            draw(c, w, h, f) {
                const n = f.levels.length;
                const area = h * 0.45; // as barras ocupam a parte de baixo
                const gap = Math.max(2, w * 0.006);
                const bw = (w - gap * (n + 1)) / n;
                const grad = c.createLinearGradient(0, h, 0, h - area);
                grad.addColorStop(0, f.accent);
                grad.addColorStop(1, "#f472b6");
                for (let b = 0; b < n; b++) {
                    const x = gap + b * (bw + gap);
                    const bh = Math.max(2, f.levels[b] * area);
                    c.fillStyle = grad;
                    c.globalAlpha = 0.85;
                    c.fillRect(x, h - bh, bw, bh);
                    c.globalAlpha = 1;
                    c.fillStyle = "#e2e8f0";
                    c.fillRect(x, h - Math.max(4, f.peaks[b] * area) - 4, bw, 3);
                }
                // Osciloscópio (só no sincronizado: é a onda de verdade).
                if (f.wave) {
                    const mid = h - area - h * 0.07;
                    const amp = h * 0.03;
                    c.beginPath();
                    c.strokeStyle = f.accent;
                    c.globalAlpha = 0.6;
                    c.lineWidth = Math.max(1, w * 0.002);
                    const m = f.wave.length;
                    for (let k = 0; k < m; k++) {
                        const x = (k / (m - 1)) * w;
                        const y = mid - f.wave[k] * amp * 2;
                        if (k === 0) c.moveTo(x, y);
                        else c.lineTo(x, y);
                    }
                    c.stroke();
                    c.globalAlpha = 1;
                }
            }
        },

        // Pra deixar ligado no trabalho: relógio grande, o que toca embaixo e
        // um fundo de luzes bem fracas que se movem devagar. Não segue a
        // música (não baixa nem analisa nada) e desenha poucos quadros.
        calm: {
            label: "Suave (relógio)",
            layout: "calm",
            analyze: false,
            fps: 15,
            drift: [
                [38, 62],
                [36, 58]
            ],
            // f.palette: 3 cores [r, g, b] (as da capa, ou as do tema).
            draw(c, w, h, f) {
                const t = f.time;
                const pal = f.palette;
                // Fundo: quase preto, puxado de leve pra cor principal.
                c.fillStyle = rgba(mixRgb([4, 6, 11], pal[0], 0.07), 1);
                c.fillRect(0, 0, w, h);
                // Cada luz passeia devagar entre duas cores da paleta (~2,5 min).
                const blobs = [
                    [0, 0.11, 0.07, 0],
                    [1, 0.08, 0.1, 2.1],
                    [2, 0.06, 0.09, 4.3]
                ].map(([k, sx, sy, ph]) => [
                    mixRgb(pal[k], pal[(k + 1) % 3], 0.5 + 0.5 * Math.sin(t * 0.04 + k * 2.1)),
                    sx,
                    sy,
                    ph
                ]);
                const base = Math.max(w, h) * 0.5;
                const alpha = f.playing ? 0.2 : 0.1;
                c.globalCompositeOperation = "lighter";
                for (const [color, sx, sy, ph] of blobs) {
                    const x = w * (0.5 + 0.38 * Math.sin(t * sx + ph));
                    const y = h * (0.5 + 0.34 * Math.cos(t * sy + ph * 1.7));
                    const r = base * (1 + 0.08 * Math.sin(t * 0.35 + ph)); // "respira" devagar
                    const g = c.createRadialGradient(x, y, 0, x, y, r);
                    g.addColorStop(0, rgba(color, alpha));
                    g.addColorStop(1, rgba(color, 0));
                    c.fillStyle = g;
                    c.fillRect(0, 0, w, h);
                }
                c.globalCompositeOperation = "source-over";
            }
        }
    };
    const DEFAULT_STYLE = "bars";

    // ---------- Desenho ----------
    function waveSlice(start) {
        const n = 512;
        const out = new Float32Array(n);
        for (let k = 0; k < n; k++) out[k] = pcm.data[start + Math.floor((k * FFT_SIZE) / n)] || 0;
        return out;
    }

    function frame(now) {
        if (!reduceMotion) rafId = requestAnimationFrame(frame);
        if (!provider || !ctx2d) return;
        if (style.fps && lastDraw && now - lastDraw < 1000 / style.fps - 2) return;
        lastDraw = now;
        const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
        lastFrame = now;

        const i = provider.info() || {};
        const playing = !!i.playing;
        const w = canvas.width;
        const h = canvas.height;
        const accent = getComputedStyle(root).getPropertyValue("--ss-accent").trim() || "#38bdf8";

        if (style.analyze === false) {
            modeEl.textContent = "";
            ensurePalette(i.art || "");
            const target = palTarget || defaultPalette(ctx2d, accent);
            if (!palCurrent) palCurrent = defaultPalette(ctx2d, accent);
            // Troca de capa: as cores chegam nas novas em uns 5 segundos.
            const k = Math.min(1, dt * 0.6);
            palCurrent = palCurrent.map((col, n) => mixRgb(col, target[n], k));
            ctx2d.clearRect(0, 0, w, h);
            style.draw(ctx2d, w, h, {
                levels,
                peaks,
                wave: null,
                accent,
                playing,
                synced: false,
                time: now / 1000,
                palette: palCurrent
            });
            return;
        }
        let target = null;
        let wave = null;

        // Faixa da biblioteca: sincronizado; rádio: animação.
        if (i.isTrack) {
            ensurePcm();
            if (pcm && pcm.key === provider.trackKey() && playing) {
                const r = syncedLevels(provider.currentTime());
                if (r) {
                    target = r.levels;
                    wave = waveSlice(r.start);
                }
            }
        }
        const synced = !!target;
        if (!target) target = syntheticLevels(now / 1000, playing);
        modeEl.textContent = !i.isTrack
            ? ""
            : synced
              ? "🎚️ sincronizado com a música"
              : pcmLoadingKey
                ? "🎚️ analisando a faixa…"
                : pcmFailedKey && pcmFailedKey === provider.trackKey()
                  ? "🎚️ análise indisponível — animação"
                  : "";

        // Sobe rápido, desce devagar; o "pico" segura um pouco e cai (Winamp).
        for (let b = 0; b < BARS; b++) {
            const v = target[b];
            levels[b] = v > levels[b] ? v : Math.max(v, levels[b] - dt * 1.6);
            if (levels[b] >= peaks[b]) {
                peaks[b] = levels[b];
                peakHold[b] = 0.4;
            } else if (peakHold[b] > 0) {
                peakHold[b] -= dt;
            } else {
                peaks[b] = Math.max(levels[b], peaks[b] - dt * 0.5);
            }
        }

        ctx2d.clearRect(0, 0, w, h);
        style.draw(ctx2d, w, h, { levels, peaks, wave, accent, playing, synced, time: now / 1000 });
    }

    // ---------- Abrir / fechar ----------
    function open(p, opts = {}) {
        if (root) return;
        provider = p;
        onClosed = opts.onClose || null;
        style = STYLES[opts.style] || STYLES[DEFAULT_STYLE];
        build();
        resize();
        window.addEventListener("resize", resize);
        tickClock();
        drift();
        clockTimer = setInterval(tickClock, 5000);
        driftTimer = setInterval(drift, DRIFT_MS);
        levels.fill(0);
        peaks.fill(0);
        lastFrame = 0;
        lastDraw = 0;
        palKey = "";
        palTarget = palCurrent = null;
        // Movimento reduzido: um quadro só (o fundo fica parado).
        reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        rafId = requestAnimationFrame(frame);
        setTimeout(() => hintEl && hintEl.classList.add("is-hidden"), 3000);

        enteredFullscreen = false;
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) {
            el.requestFullscreen({ navigationUI: "hide" })
                .then(() => (enteredFullscreen = true))
                .catch(() => {});
        }
    }

    function close(fromHistory) {
        if (!root) return;
        cancelAnimationFrame(rafId);
        clearInterval(clockTimer);
        clearInterval(driftTimer);
        window.removeEventListener("resize", resize);
        root.remove();
        root = canvas = ctx2d = infoEl = artEl = titleEl = subEl = clockEl = dateEl = modeEl = hintEl = null;
        // Libera a análise (dezenas de MB) — refaz se abrir de novo.
        pcm = null;
        pcmLoadingKey = "";
        pcmFailedKey = "";
        palKey = "";
        palTarget = palCurrent = null;
        if (enteredFullscreen && document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        enteredFullscreen = false;
        provider = null;
        const cb = onClosed;
        onClosed = null;
        if (cb) cb(!!fromHistory);
    }

    window.RadioScreensaver = {
        open,
        close,
        // [{ id, label }] — pras Configurações.
        styles: Object.keys(STYLES).map((id) => ({ id, label: STYLES[id].label })),
        defaultStyle: DEFAULT_STYLE,
        get isOpen() {
            return !!root;
        }
    };
})();
