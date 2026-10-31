/* ============================================================
   Descanso de tela — tela cheia preta com barras animadas (estilo
   Winamp), capa, nome do que toca e relógio. O bloco de informações
   muda de lugar de tempos em tempos pra não marcar a tela.

   Visualizador sincronizado (experimental, só faixas da biblioteca):
   em vez de ligar o <audio> ao Web Audio — o que deixaria mudas as
   rádios sem CORS e pode atrapalhar tocar com a tela desligada —, o
   arquivo da faixa é decodificado à parte (OfflineAudioContext) e o
   espectro é calculado aqui, no ponto em que o player está
   (currentTime). O áudio que toca nunca passa por aqui.

   Rádios (ou visualizador desligado): animação que não segue a música.

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
    let modeEl = null;
    let hintEl = null;

    let provider = null;
    let onClosed = null;
    let rafId = 0;
    let driftTimer = 0;
    let clockTimer = 0;
    let enteredFullscreen = false;
    let visualizerOn = false;

    const levels = new Float32Array(BARS);
    const peaks = new Float32Array(BARS);
    const peakHold = new Float32Array(BARS);
    let lastFrame = 0;

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
        text.append(titleEl, subEl, clockEl);
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
        updateInfo();
    }

    // Leva o bloco de informações pra outro ponto da tela (anti-marcação).
    function drift() {
        if (!infoEl) return;
        const x = 6 + Math.random() * 40; // % da largura livre
        const y = 6 + Math.random() * 18; // % da altura: fica no alto; onda e barras ficam da metade pra baixo
        infoEl.style.left = x + "%";
        infoEl.style.top = y + "%";
    }

    // ---------- Visualizador sincronizado ----------
    async function ensurePcm() {
        if (!visualizerOn || !provider) return;
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

    // ---------- Desenho ----------
    function frame(now) {
        rafId = requestAnimationFrame(frame);
        if (!provider || !ctx2d) return;
        const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
        lastFrame = now;

        const i = provider.info() || {};
        const playing = !!i.playing;
        let target = null;
        let wave = null;

        if (visualizerOn && i.isTrack) {
            ensurePcm();
            if (pcm && pcm.key === provider.trackKey() && playing) {
                const r = syncedLevels(provider.currentTime());
                if (r) {
                    target = r.levels;
                    wave = r.start;
                }
            }
        }
        const synced = !!target;
        if (!target) target = syntheticLevels(now / 1000, playing);
        modeEl.textContent =
            visualizerOn && i.isTrack
                ? synced
                    ? "🎚️ sincronizado com a música"
                    : pcmLoadingKey
                      ? "🎚️ analisando a faixa…"
                      : pcmFailedKey && pcmFailedKey === provider.trackKey()
                        ? "🎚️ análise indisponível — animação"
                        : "🎚️ animação"
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

        const w = canvas.width;
        const h = canvas.height;
        ctx2d.clearRect(0, 0, w, h);
        const accent = getComputedStyle(root).getPropertyValue("--ss-accent").trim() || "#38bdf8";
        const area = h * 0.45; // as barras ocupam a parte de baixo
        const gap = Math.max(2, w * 0.006);
        const bw = (w - gap * (BARS + 1)) / BARS;
        const grad = ctx2d.createLinearGradient(0, h, 0, h - area);
        grad.addColorStop(0, accent);
        grad.addColorStop(1, "#f472b6");
        for (let b = 0; b < BARS; b++) {
            const x = gap + b * (bw + gap);
            const bh = Math.max(2, levels[b] * area);
            ctx2d.fillStyle = grad;
            ctx2d.globalAlpha = 0.85;
            ctx2d.fillRect(x, h - bh, bw, bh);
            ctx2d.globalAlpha = 1;
            ctx2d.fillStyle = "#e2e8f0";
            ctx2d.fillRect(x, h - Math.max(4, peaks[b] * area) - 4, bw, 3);
        }

        // Osciloscópio (só no modo sincronizado: é a onda de verdade).
        if (synced && wave != null) {
            const mid = h - area - h * 0.07;
            const amp = h * 0.03;
            ctx2d.beginPath();
            ctx2d.strokeStyle = accent;
            ctx2d.globalAlpha = 0.6;
            ctx2d.lineWidth = Math.max(1, w * 0.002);
            const n = 512;
            for (let k = 0; k < n; k++) {
                const s = pcm.data[wave + Math.floor((k * FFT_SIZE) / n)] || 0;
                const x = (k / (n - 1)) * w;
                const y = mid - s * amp * 2;
                if (k === 0) ctx2d.moveTo(x, y);
                else ctx2d.lineTo(x, y);
            }
            ctx2d.stroke();
            ctx2d.globalAlpha = 1;
        }
    }

    // ---------- Abrir / fechar ----------
    function open(p, opts = {}) {
        if (root) return;
        provider = p;
        onClosed = opts.onClose || null;
        visualizerOn = !!opts.visualizer;
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
        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduce) rafId = requestAnimationFrame(frame);
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
        root = canvas = ctx2d = infoEl = artEl = titleEl = subEl = clockEl = modeEl = hintEl = null;
        // Libera a análise (dezenas de MB) — refaz se abrir de novo.
        pcm = null;
        pcmLoadingKey = "";
        pcmFailedKey = "";
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
        get isOpen() {
            return !!root;
        }
    };
})();
