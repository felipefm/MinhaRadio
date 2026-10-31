/* ============================================================
   Ouvintes — contador anônimo de quem está usando o player.

   Enquanto algo toca, o app manda a cada 2 minutos um "sinal" pro
   Worker (cloudflare-worker/presence): um código aleatório deste
   aparelho (gerado aqui, sem ligação com a pessoa), o nome da rádio
   ("Minha biblioteca" pra faixas — o nome da música não sai), o tipo
   de aparelho e se é um aparelho do dono. A Cloudflare acrescenta país
   e cidade aproximados. Ao parar, avisa que saiu.

   Só quem tem a chave do painel (o dono) consegue ver a lista; ter a
   chave neste aparelho também o marca como "seu". Dá pra desligar o
   envio nas Configurações.

   Expõe `window.RadioPresence`.
   ============================================================ */
(function () {
    "use strict";

    const LS_ID = "radioPresenceId";
    const LS_OFF = "radioPresenceOff";
    const LS_TOKEN = "radioPresenceToken";
    const HEARTBEAT_MS = 2 * 60 * 1000;

    let base = "";
    let getState = () => null;
    let timer = 0;
    let debounce = 0;
    let lastSent = null; // { label } do último sinal "tocando"

    function ls(key, value) {
        try {
            if (value === undefined) return localStorage.getItem(key);
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch (_) {}
        return null;
    }

    function deviceId() {
        let id = ls(LS_ID);
        if (!id) {
            id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
            ls(LS_ID, id);
        }
        return id;
    }

    function deviceKind() {
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) return "Android";
        if (/iPhone|iPad/i.test(ua)) return "iPhone";
        return "Computador";
    }

    const isEnabled = () => !!base && ls(LS_OFF) !== "1";
    const token = () => ls(LS_TOKEN) || "";

    function send(op, payload) {
        const body = JSON.stringify(Object.assign({ id: deviceId() }, payload || {}));
        const url = base + "/" + op;
        // Texto puro: evita o preflight do CORS. sendBeacon sobrevive ao fechar o app.
        if (op === "bye" && navigator.sendBeacon) {
            try {
                if (navigator.sendBeacon(url, body)) return;
            } catch (_) {}
        }
        fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
    }

    function beat() {
        if (!isEnabled()) return;
        const st = getState();
        if (st && st.playing) {
            send("ping", { label: st.label, kind: st.kind, device: deviceKind(), mine: !!token() });
            lastSent = { label: st.label };
        } else if (lastSent) {
            send("bye");
            lastSent = null;
        }
    }

    // Chamado pelo app quando algo muda (tocou, parou, trocou de rádio).
    function notify() {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            const st = getState();
            const playing = !!(st && st.playing);
            const changed = playing !== !!lastSent || (playing && lastSent && st.label !== lastSent.label);
            if (changed) beat();
        }, 3000);
    }

    function init(opts) {
        base = String((opts && opts.url) || "").replace(/\/+$/, "");
        getState = (opts && opts.getState) || getState;
        if (!base) return;
        clearInterval(timer);
        timer = setInterval(beat, HEARTBEAT_MS);
        window.addEventListener("pagehide", () => {
            if (lastSent && isEnabled()) send("bye");
            lastSent = null;
        });
    }

    function setEnabled(on) {
        if (!on && lastSent) send("bye");
        if (!on) lastSent = null;
        ls(LS_OFF, on ? null : "1");
        if (on) notify();
    }

    function setToken(t) {
        ls(LS_TOKEN, t ? String(t).trim() : null);
        lastSent = null; // reenvia já marcando (ou desmarcando) como aparelho do dono
        notify();
    }

    // Painel do dono: quem está ouvindo agora + aparelhos por dia.
    async function status() {
        const res = await fetch(base + "/status", {
            headers: { Authorization: "Bearer " + token() },
            cache: "no-store"
        });
        if (res.status === 401) throw new Error("Chave do painel incorreta.");
        if (!res.ok) throw new Error("O contador respondeu com erro " + res.status + ".");
        return res.json();
    }

    window.RadioPresence = {
        init,
        notify,
        setEnabled,
        setToken,
        status,
        get configured() {
            return !!base;
        },
        get enabled() {
            return isEnabled();
        },
        get hasToken() {
            return !!token();
        },
        get deviceId() {
            return deviceId();
        }
    };
})();
