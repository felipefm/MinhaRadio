/* ============================================================
   Minha biblioteca — cliente do Jellyfin
   Isolado do app: só fala com o servidor (login, listagens, URLs de
   áudio e de capa). Fila, player e telas ficam no app.js.
   Expõe `window.Jellyfin`.

   O servidor precisa estar em HTTPS (página HTTPS não carrega HTTP) —
   no homelab isso é o Tailscale Serve. Ver README.
   ============================================================ */
(function () {
    "use strict";

    const LS_KEY = "radioJellyfin";
    const CLIENT = "Radio Player";
    const VERSION = "3.5";

    // Formatos que o Chrome toca direto, no formato que o Jellyfin entende
    // (contêiner|codec). O resto o servidor converte pra MP3.
    const DIRECT_CONTAINERS = "opus,webm|opus,mp3,aac,m4a|aac,m4b|aac,flac,webma,webm|webma,wav,ogg";
    const QUALITY_BITRATE = { original: 140000000, data: 192000 };

    let cfg = load();
    // Endereço em uso nesta sessão (o de casa, se respondeu; senão o principal).
    let activeServer = "";

    function load() {
        try {
            const c = JSON.parse(localStorage.getItem(LS_KEY));
            if (c && typeof c === "object") return c;
        } catch (_) {}
        return {};
    }

    function save() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(cfg));
        } catch (_) {}
    }

    function deviceId() {
        if (!cfg.deviceId) {
            cfg.deviceId = "radio-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
            save();
        }
        return cfg.deviceId;
    }

    function deviceName() {
        return /Android/i.test(navigator.userAgent) ? "Android" : "Navegador";
    }

    // Aceita "101.tailnet.ts.net", "https://.../" etc. — devolve sem barra no fim.
    function normalizeServer(input) {
        let s = String(input || "").trim();
        if (!s) return "";
        if (!/^https?:\/\//i.test(s)) s = "https://" + s;
        return s.replace(/\/+$/, "");
    }

    function authHeader(token) {
        // Só ASCII: header HTTP não aceita acento.
        let h = `MediaBrowser Client="${CLIENT}", Device="${deviceName()}", DeviceId="${deviceId()}", Version="${VERSION}"`;
        if (token) h += `, Token="${token}"`;
        return h;
    }

    function timeoutSignal(ms) {
        if (window.AbortSignal && AbortSignal.timeout) return AbortSignal.timeout(ms);
        const c = new AbortController();
        setTimeout(() => c.abort(), ms);
        return c.signal;
    }

    class JellyfinError extends Error {
        constructor(kind, message) {
            super(message);
            this.kind = kind; // "network" | "auth" | "http"
        }
    }

    const NETWORK_MSG = "Não consegui falar com o servidor. O Tailscale está ligado?";

    async function ping(server, ms) {
        try {
            const res = await fetch(server + "/System/Info/Public", { signal: timeoutSignal(ms) });
            return res.ok;
        } catch (_) {
            return false;
        }
    }

    // Escolhe o endereço: o "de casa" (opcional) se responder rápido, senão o
    // principal. Fica guardado até um erro de rede forçar nova escolha.
    async function ensureServer() {
        if (activeServer) return activeServer;
        if (cfg.homeServer && (await ping(cfg.homeServer, 2500))) activeServer = cfg.homeServer;
        else activeServer = cfg.server;
        return activeServer;
    }

    async function request(path, { method = "GET", params, body, token = cfg.token, server } = {}) {
        const base = server || (await ensureServer());
        const qs = params ? "?" + new URLSearchParams(clean(params)).toString() : "";
        let res;
        try {
            res = await fetch(base + path + qs, {
                method,
                headers: Object.assign(
                    { Authorization: authHeader(token), Accept: "application/json" },
                    body ? { "Content-Type": "application/json" } : {}
                ),
                body: body ? JSON.stringify(body) : undefined,
                signal: timeoutSignal(15000)
            });
        } catch (_) {
            activeServer = "";
            throw new JellyfinError("network", NETWORK_MSG);
        }
        if (res.status === 401) {
            throw new JellyfinError("auth", "Sessão do Jellyfin expirada. Conecte de novo nas Configurações.");
        }
        if (!res.ok) throw new JellyfinError("http", "O servidor respondeu com erro " + res.status + ".");
        if (res.status === 204) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    }

    function clean(params) {
        const out = {};
        Object.keys(params).forEach((k) => {
            const v = params[k];
            if (v !== undefined && v !== null && v !== "") out[k] = String(v);
        });
        return out;
    }

    // ---------- Sessão ----------
    function isConfigured() {
        return !!(cfg.server && cfg.token && cfg.userId);
    }

    async function login({ server, homeServer, username, password }) {
        const main = normalizeServer(server);
        const home = normalizeServer(homeServer);
        if (!main) throw new JellyfinError("http", "Informe o endereço do servidor.");
        if (/^http:/i.test(main) && location.protocol === "https:") {
            throw new JellyfinError(
                "http",
                "O endereço precisa ser https:// — o navegador bloqueia http:// aqui. Use o endereço do Tailscale Serve."
            );
        }
        let data;
        try {
            data = await request("/Users/AuthenticateByName", {
                method: "POST",
                server: main,
                token: "",
                body: { Username: username, Pw: password }
            });
        } catch (err) {
            if (err.kind === "auth") throw new JellyfinError("auth", "Usuário ou senha incorretos.");
            throw err;
        }
        if (!data || !data.AccessToken || !data.User) throw new JellyfinError("http", "Resposta inesperada do servidor.");
        cfg = {
            deviceId: cfg.deviceId,
            quality: cfg.quality || "original",
            server: main,
            homeServer: home && !/^http:/i.test(home) ? home : "",
            token: data.AccessToken,
            userId: data.User.Id,
            userName: data.User.Name || username
        };
        activeServer = "";
        save();
        return { userName: cfg.userName };
    }

    async function logout() {
        try {
            if (isConfigured()) await request("/Sessions/Logout", { method: "POST" });
        } catch (_) {
            // sem rede tudo bem: o token some daqui de qualquer jeito
        }
        // Endereços e usuário ficam, pra reconectar só com a senha.
        cfg = {
            deviceId: cfg.deviceId,
            quality: cfg.quality,
            server: cfg.server,
            homeServer: cfg.homeServer,
            userName: cfg.userName
        };
        activeServer = "";
        save();
    }

    function setQuality(q) {
        if (!QUALITY_BITRATE[q]) return;
        cfg.quality = q;
        save();
    }

    // ---------- Listagens ----------
    const TRACK_FIELDS = "AlbumArtist,Artists,Album,AlbumId,AlbumPrimaryImageTag,RunTimeTicks";

    function items(params) {
        return request("/Items", {
            params: Object.assign({ userId: cfg.userId, Recursive: true, EnableImageTypes: "Primary" }, params)
        });
    }

    const api = {
        playlists: ({ start = 0, limit = 100 } = {}) =>
            items({ IncludeItemTypes: "Playlist", MediaTypes: "Audio", SortBy: "SortName", StartIndex: start, Limit: limit }),
        albums: ({ start = 0, limit = 100 } = {}) =>
            items({ IncludeItemTypes: "MusicAlbum", SortBy: "SortName", StartIndex: start, Limit: limit, Fields: "AlbumArtist" }),
        artists: ({ start = 0, limit = 100 } = {}) =>
            request("/Artists/AlbumArtists", {
                params: { userId: cfg.userId, SortBy: "SortName", StartIndex: start, Limit: limit, EnableImageTypes: "Primary" }
            }),
        artistAlbums: (artistId) =>
            items({
                IncludeItemTypes: "MusicAlbum",
                AlbumArtistIds: artistId,
                SortBy: "ProductionYear,SortName",
                SortOrder: "Descending",
                Fields: "AlbumArtist,ProductionYear"
            }),
        albumTracks: (albumId) =>
            items({ ParentId: albumId, IncludeItemTypes: "Audio", SortBy: "ParentIndexNumber,IndexNumber,SortName", Fields: TRACK_FIELDS }),
        playlistTracks: (playlistId) =>
            request("/Playlists/" + encodeURIComponent(playlistId) + "/Items", {
                params: { userId: cfg.userId, Fields: TRACK_FIELDS, EnableImageTypes: "Primary" }
            }),
        randomTracks: (limit = 150) =>
            items({ IncludeItemTypes: "Audio", SortBy: "Random", Limit: limit, Fields: TRACK_FIELDS }),
        instantMix: (itemId, limit = 100) =>
            request("/Items/" + encodeURIComponent(itemId) + "/InstantMix", {
                params: { userId: cfg.userId, Limit: limit, Fields: TRACK_FIELDS, EnableImageTypes: "Primary" }
            }),
        search: (term) =>
            items({
                searchTerm: term,
                IncludeItemTypes: "MusicArtist,MusicAlbum,Playlist,Audio",
                Limit: 60,
                Fields: TRACK_FIELDS
            })
    };

    // ---------- URLs ----------
    // Áudio: o <audio> não manda header, então o token vai na URL. Com
    // "original" o arquivo sai como está (FLAC/MP3…); com "data" o servidor
    // converte pra MP3 192 kbps. Progressivo (sem HLS), pra tocar no <audio>.
    function streamUrl(item) {
        const base = activeServer || cfg.server;
        const params = new URLSearchParams({
            UserId: cfg.userId,
            DeviceId: deviceId(),
            ApiKey: cfg.token,
            Container: DIRECT_CONTAINERS,
            TranscodingContainer: "mp3",
            TranscodingProtocol: "http",
            AudioCodec: "mp3",
            MaxStreamingBitrate: String(QUALITY_BITRATE[cfg.quality] || QUALITY_BITRATE.original)
        });
        return `${base}/Audio/${encodeURIComponent(item.Id)}/universal?${params.toString()}`;
    }

    // Capa: a do próprio item, ou a do álbum (faixas normalmente não têm).
    function imageUrl(item, size = 300) {
        if (!item) return "";
        let id = "";
        let tag = "";
        if (item.ImageTags && item.ImageTags.Primary) {
            id = item.Id;
            tag = item.ImageTags.Primary;
        } else if (item.AlbumId && item.AlbumPrimaryImageTag) {
            id = item.AlbumId;
            tag = item.AlbumPrimaryImageTag;
        }
        if (!id) return "";
        const base = activeServer || cfg.server;
        return `${base}/Items/${encodeURIComponent(id)}/Images/Primary?fillWidth=${size}&fillHeight=${size}&quality=85&tag=${encodeURIComponent(tag)}`;
    }

    window.Jellyfin = {
        isConfigured,
        login,
        logout,
        setQuality,
        ensureServer,
        streamUrl,
        imageUrl,
        get quality() {
            return cfg.quality || "original";
        },
        get userName() {
            return cfg.userName || "";
        },
        get server() {
            return cfg.server || "";
        },
        get homeServer() {
            return cfg.homeServer || "";
        },
        ...api
    };
})();
