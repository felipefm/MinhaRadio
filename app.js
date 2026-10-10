/* ============================================================
   Rádio Player Online v3.0 — app
   ============================================================ */
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    // ---------- Refs DOM ----------
    const themeToggleButton = $("themeToggleButton");
    const themeToggleButton2 = $("themeToggleButton2");
    const settingsButton = $("settingsButton");
    const settingsSheet = $("settingsSheet");
    const titleColorChips = $("titleColorChips");

    const searchOpenButton = $("searchOpenButton");
    const searchCloseButton = $("searchCloseButton");
    const searchScreen = $("searchScreen");
    const searchInput = $("searchInput");
    const searchButton = $("searchButton");
    const toggleFiltersButton = $("toggleFiltersButton");
    const searchFilters = $("searchFilters");
    const filterCountry = $("filterCountry");
    const filterTag = $("filterTag");
    const filterLanguage = $("filterLanguage");
    const clearFiltersButton = $("clearFiltersButton");
    const searchResults = $("searchResults");

    const manualName = $("manualName");
    const manualUrl = $("manualUrl");
    const manualAddButton = $("manualAddButton");

    const manageCategoriesButton = $("manageCategoriesButton");
    const favoritesList = $("favoritesList");
    const exportFavoritesButton = $("exportFavoritesButton");
    const importFavoritesButton = $("importFavoritesButton");
    const importFile = $("importFile");

    const recentsList = $("recentsList");
    const clearRecentsButton = $("clearRecentsButton");

    const topRadiosButtons = $("topRadiosButtons");
    const clicksTab = $("clicksTab");
    const timeTab = $("timeTab");
    const analyticsResults = $("analyticsResults");
    const exportAnalyticsButton = $("exportAnalyticsButton");
    const clearAnalyticsButton = $("clearAnalyticsButton");

    const installInstructions = $("installInstructions");
    const installAppButton = $("installAppButton");

    const playerBar = $("playerBar");
    const playerPanel = $("playerPanel");
    const playerExpandButton = $("playerExpandButton");
    const nowPlaying = $("nowPlaying");
    const nowPlayingSub = $("nowPlayingSub");
    const nowPlayingArt = $("nowPlayingArt");
    const playButton = $("playButton");
    const stopButton = $("stopButton");
    const audioPlayer = $("audioPlayer");
    const muteButton = $("muteButton");
    const volumeControl = $("volumeControl");
    const volumeUp = $("volumeUp");
    const volumeDown = $("volumeDown");
    const volumeDisplay = $("volumeDisplay");
    const sleepChips = $("sleepChips");
    const sleepStatus = $("sleepStatus");

    const toastNotification = $("toastNotification");
    const toastMessage = $("toastMessage");
    const modalRoot = $("modalRoot");

    const carModeButton = $("carModeButton");
    const carModeScreen = $("carModeScreen");
    const carExitButton = $("carExitButton");
    const carClock = $("carClock");
    const carStatusLabel = $("carStatusLabel");
    const carStationName = $("carStationName");
    const carStationSub = $("carStationSub");
    const carPlayButton = $("carPlayButton");
    const carPrevButton = $("carPrevButton");
    const carNextButton = $("carNextButton");
    const carPresetGrid = $("carPresetGrid");
    const carArt = $("carArt");
    const carTrackInfo = $("carTrackInfo");

    const libraryOpenButton = $("libraryOpenButton");
    const libraryScreen = $("libraryScreen");
    const libraryBackButton = $("libraryBackButton");
    const libraryTitle = $("libraryTitle");
    const libraryBody = libraryScreen.querySelector(".search-screen__body");
    const libraryHome = $("libraryHome");
    const librarySearchInput = $("librarySearchInput");
    const librarySearchButton = $("librarySearchButton");
    const libraryShuffleAllButton = $("libraryShuffleAllButton");
    const libraryTabs = $("libraryTabs");
    const libraryActions = $("libraryActions");
    const libraryList = $("libraryList");
    const libraryMoreButton = $("libraryMoreButton");
    const jellyfinSetting = $("jellyfinSetting");
    const queueRow = $("queueRow");
    const queuePrevButton = $("queuePrevButton");
    const queueStopButton = $("queueStopButton");
    const queueStatus = $("queueStatus");
    const trackSeek = $("trackSeek");
    const trackElapsed = $("trackElapsed");
    const trackDuration = $("trackDuration");
    const trackFavButton = $("trackFavButton");
    const carSeek = $("carSeek");
    const carElapsed = $("carElapsed");
    const carDuration = $("carDuration");
    const carFavButton = $("carFavButton");

    // ---------- Estado ----------
    const LS = {
        fav: "radioFavorites",
        order: "categoryOrder",
        theme: "radioTheme",
        color: "radioTitleColor",
        recents: "radioRecents",
        filters: "radioSearchFilters",
        volume: "radioVolume",
        played: "radioJellyfinPlayed"
    };

    const API_URLS = [
        "https://de1.api.radio-browser.info/json/stations/search",
        "https://fi1.api.radio-browser.info/json/stations/search",
        "https://nl1.api.radio-browser.info/json/stations/search",
        "https://all.api.radio-browser.info/json/stations/search"
    ];

    // URL do Worker de "tocando agora" (cloudflare-worker/nowplaying.js).
    // Deixe em branco para desativar a exibição de capa/faixa no Modo Carro.
    const NOWPLAYING_WORKER_URL = "https://radio-nowplaying.felipefm-suporte.workers.dev/";

    let favorites = {};
    let categoryOrder = [];
    let recents = [];
    const openCategories = new Set();

    let currentStation = null;
    // Última rádio tocada — o "play" vindo do volante/notificação retoma ela
    // mesmo depois de um stop (que zera currentStation).
    let lastStation = null;
    let currentHls = null;
    let playToken = 0;
    let streamSettling = false;
    let lastVolume = 1;
    let isMuted = false;
    let deferredPrompt = null;
    let searchAbort = null;
    let currentAnalyticsTab = "clicks";
    let dragData = null;

    let sleepState = { deadline: 0, tickId: 0, fadeId: 0, minutes: 0 };

    let carPresets = [];
    let carClockTimer = 0;
    let nowPlayingPollTimer = 0;
    let nowPlayingToken = 0;

    // Minha biblioteca (Jellyfin). Uma faixa toca pelo mesmo caminho de uma
    // rádio: vira um objeto "estação" com kind: "track" (ver trackToStation).
    let queue = { items: [], index: -1 };
    let libStack = [];
    let libToken = 0;
    const libHomeCache = {};
    let positionStateSet = false;
    // ❤ do Jellyfin por id de faixa — compartilhado entre listas, player e
    // Modo Carro, pra que marcar num lugar apareça em todos.
    const favState = new Map();
    // Enquanto o dedo arrasta a barra de tempo, o timeupdate não mexe nela.
    let seekDragging = false;

    // ============================================================
    // Utilidades
    // ============================================================
    let toastTimer;
    function showToast(message, ms = 3000) {
        if (!toastNotification || !toastMessage) return;
        toastMessage.textContent = message;
        toastNotification.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastNotification.classList.remove("show"), ms);
    }

    function emptyState(container, message) {
        if (!container) return;
        container.innerHTML = "";
        const p = document.createElement("p");
        p.className = "empty-state";
        p.textContent = message;
        container.appendChild(p);
    }

    function downloadJson(obj, filename) {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Em página HTTPS, converte http:// -> https:// (evita bloqueio de conteúdo misto)
    function preferHttps(url) {
        return url && location.protocol === "https:" && url.startsWith("http://")
            ? "https://" + url.slice(7)
            : url;
    }

    function isTrack(st) {
        return !!st && st.kind === "track";
    }

    // Segunda linha do player/Modo Carro: detalhes da rádio, ou artista — álbum.
    function playerSubtitle(st) {
        if (!st) return "";
        return isTrack(st) ? [st.artist, st.album].filter(Boolean).join(" — ") : stationDetails(st);
    }

    function isValidHttpUrl(str) {
        try {
            const u = new URL(str);
            return u.protocol === "http:" || u.protocol === "https:";
        } catch (_) {
            return false;
        }
    }

    // ============================================================
    // Modais in-app (substituem alert / confirm / prompt)
    // ============================================================
    function buildModal({ title, body, actions, onClose }) {
        const overlay = document.createElement("div");
        overlay.className = "modal";
        overlay.innerHTML = '<div class="modal__backdrop"></div><div class="modal__panel" role="dialog" aria-modal="true"></div>';
        const panel = overlay.querySelector(".modal__panel");

        if (title) {
            const h = document.createElement("h2");
            h.className = "modal__title";
            h.textContent = title;
            panel.appendChild(h);
        }
        if (body != null) {
            const b = document.createElement("div");
            b.className = "modal__body";
            if (typeof body === "string") b.textContent = body;
            else b.appendChild(body);
            panel.appendChild(b);
        }
        const actionsEl = document.createElement("div");
        actionsEl.className = "modal__actions";
        panel.appendChild(actionsEl);

        function close(result) {
            overlay.remove();
            document.removeEventListener("keydown", onKey);
            if (typeof onClose === "function") onClose(result);
        }
        function onKey(e) {
            if (e.key === "Escape" && overlay === modalRoot.lastElementChild) close(undefined);
        }

        (actions || []).forEach((a) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn--sm btn--" + (a.variant || "secondary");
            btn.textContent = a.label;
            btn.addEventListener("click", () => (a.onClick ? a.onClick(close) : close(a.value)));
            actionsEl.appendChild(btn);
        });

        overlay.querySelector(".modal__backdrop").addEventListener("click", () => close(undefined));
        document.addEventListener("keydown", onKey);
        modalRoot.appendChild(overlay);
        return { overlay, panel, actionsEl, close };
    }

    function confirmDialog(message, opts = {}) {
        const { title = "Confirmar", okLabel = "Confirmar", danger = false } = opts;
        return new Promise((resolve) => {
            buildModal({
                title,
                body: message,
                actions: [
                    { label: "Cancelar", variant: "ghost", value: false },
                    { label: okLabel, variant: danger ? "danger" : "primary", value: true }
                ],
                onClose: (r) => resolve(r === true)
            });
        });
    }

    function promptDialog(message, opts = {}) {
        const { title = "", defaultValue = "", placeholder = "", okLabel = "OK" } = opts;
        return new Promise((resolve) => {
            const wrap = document.createElement("div");
            const p = document.createElement("p");
            p.style.margin = "0";
            p.textContent = message;
            const input = document.createElement("input");
            input.className = "input";
            input.type = "text";
            input.value = defaultValue;
            input.placeholder = placeholder;
            wrap.append(p, input);

            const modal = buildModal({
                title,
                body: wrap,
                actions: [
                    { label: "Cancelar", variant: "ghost", onClick: (close) => close(null) },
                    { label: okLabel, variant: "primary", onClick: (close) => close(input.value) }
                ],
                onClose: (r) => resolve(r === undefined || r === null ? null : r)
            });
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    modal.close(input.value);
                }
            });
            setTimeout(() => {
                input.focus();
                input.select();
            }, 40);
        });
    }

    // Seletor de categoria (com opção de criar nova)
    function pickCategory(opts = {}) {
        const { exclude = [], title = "Escolher categoria", message = "" } = opts;
        const cats = getSortedCategoryNames().filter((c) => !exclude.includes(c));
        return new Promise((resolve) => {
            const wrap = document.createElement("div");
            if (message) {
                const p = document.createElement("p");
                p.style.margin = "0 0 4px";
                p.textContent = message;
                wrap.appendChild(p);
            }
            const list = document.createElement("div");
            list.className = "modal__choices";
            let settled = false;
            const finish = (v) => {
                settled = true;
                modal.close("__done__");
                resolve(v);
            };
            cats.forEach((c) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "modal__choice";
                b.textContent = c;
                b.addEventListener("click", () => finish(c));
                list.appendChild(b);
            });
            const nb = document.createElement("button");
            nb.type = "button";
            nb.className = "modal__choice";
            nb.textContent = "➕ Nova categoria…";
            nb.addEventListener("click", async () => {
                const name = await promptDialog("Nome da nova categoria:", {
                    title: "Nova categoria",
                    okLabel: "Criar",
                    placeholder: "Ex.: Rock, Notícias, Podcasts…"
                });
                if (name && name.trim()) finish(name.trim());
            });
            list.appendChild(nb);
            wrap.appendChild(list);

            const modal = buildModal({
                title,
                body: wrap,
                actions: [{ label: "Cancelar", variant: "ghost", value: null }],
                onClose: () => {
                    if (!settled) resolve(null);
                }
            });
        });
    }

    // ============================================================
    // Favoritos / categorias
    // ============================================================
    function loadFavorites() {
        let raw = null;
        try {
            raw = JSON.parse(localStorage.getItem(LS.fav));
        } catch (_) {}

        if (Array.isArray(raw)) {
            favorites = raw.length ? { Geral: raw } : {};
            persistFavorites();
        } else if (raw && typeof raw === "object") {
            favorites = raw;
        } else {
            favorites = {};
        }

        try {
            categoryOrder = JSON.parse(localStorage.getItem(LS.order)) || [];
        } catch (_) {
            categoryOrder = [];
        }
        if (!Array.isArray(categoryOrder)) categoryOrder = [];
    }

    function syncCategoryOrder() {
        const cats = Object.keys(favorites);
        categoryOrder = categoryOrder.filter((c) => cats.includes(c));
        cats.forEach((c) => {
            if (!categoryOrder.includes(c)) categoryOrder.push(c);
        });
        try {
            localStorage.setItem(LS.order, JSON.stringify(categoryOrder));
        } catch (_) {}
    }

    function getSortedCategoryNames() {
        syncCategoryOrder();
        return [...categoryOrder];
    }

    function persistFavorites() {
        try {
            localStorage.setItem(LS.fav, JSON.stringify(favorites));
        } catch (_) {
            showToast("Não foi possível salvar os favoritos.");
        }
        syncCategoryOrder();
    }

    function isFavorited(uuid) {
        return Object.values(favorites).some(
            (list) => Array.isArray(list) && list.some((s) => s.stationuuid === uuid)
        );
    }

    async function addToFavorites(station) {
        if (isFavorited(station.stationuuid)) {
            showToast(`"${station.name}" já está nos favoritos.`);
            return;
        }
        let category;
        const cats = getSortedCategoryNames();
        if (!cats.length) {
            category = "Geral";
        } else {
            category = await pickCategory({
                title: "Adicionar aos favoritos",
                message: `Em qual categoria colocar "${station.name}"?`
            });
            if (!category) return;
        }
        if (!favorites[category]) favorites[category] = [];
        favorites[category].push(station);
        openCategories.add(category);
        persistFavorites();
        renderFavorites();
        showToast(`"${station.name}" adicionada em "${category}". ⭐`);
    }

    function removeFromFavorites(uuid, category) {
        const list = favorites[category];
        if (!Array.isArray(list)) return;
        const i = list.findIndex((s) => s.stationuuid === uuid);
        if (i < 0) return;
        const [removed] = list.splice(i, 1);
        persistFavorites();
        renderFavorites();
        showToast(`"${removed.name}" removida de "${category}".`);
    }

    async function moveViaDialog(station, fromCategory) {
        const target = await pickCategory({
            exclude: [fromCategory],
            title: "Mover rádio",
            message: `Mover "${station.name}" para:`
        });
        if (!target) return;
        moveStation(station.stationuuid, fromCategory, target);
    }

    function moveStation(uuid, fromCategory, toCategory, insertIndex) {
        const from = favorites[fromCategory];
        if (!Array.isArray(from)) return;
        const i = from.findIndex((s) => s.stationuuid === uuid);
        if (i < 0) return;
        const [st] = from.splice(i, 1);
        if (!favorites[toCategory]) favorites[toCategory] = [];
        const dest = favorites[toCategory];
        if (insertIndex == null || insertIndex < 0 || insertIndex > dest.length) dest.push(st);
        else dest.splice(insertIndex, 0, st);
        openCategories.add(toCategory);
        persistFavorites();
        renderFavorites();
        showToast(
            fromCategory === toCategory
                ? `"${st.name}" reordenada.`
                : `"${st.name}" movida para "${toCategory}".`
        );
    }

    // ----- gerência de categorias -----
    function categoryMenu(category) {
        const order = getSortedCategoryNames();
        const idx = order.indexOf(category);
        const wrap = document.createElement("div");
        const list = document.createElement("div");
        list.className = "modal__choices";
        const add = (label, fn) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "modal__choice";
            b.textContent = label;
            b.addEventListener("click", () => {
                modal.close("__done__");
                fn();
            });
            list.appendChild(b);
        };
        add("✏️ Renomear", () => renameCategory(category));
        if (idx > 0) add("⬆️ Mover para cima", () => reorderCategory(category, -1));
        if (idx < order.length - 1) add("⬇️ Mover para baixo", () => reorderCategory(category, 1));
        add("🗑️ Excluir categoria", () => deleteCategory(category));
        wrap.appendChild(list);
        const modal = buildModal({
            title: `Categoria "${category}"`,
            body: wrap,
            actions: [{ label: "Fechar", variant: "ghost", value: null }]
        });
    }

    async function renameCategory(category) {
        const name = await promptDialog("Novo nome da categoria:", {
            title: "Renomear categoria",
            defaultValue: category,
            okLabel: "Salvar"
        });
        if (name === null) return;
        const trimmed = name.trim();
        if (!trimmed || trimmed === category) return;
        if (favorites[trimmed]) {
            showToast("Já existe uma categoria com esse nome.");
            return;
        }
        const rebuilt = {};
        getSortedCategoryNames().forEach((c) => {
            rebuilt[c === category ? trimmed : c] = favorites[c];
        });
        favorites = rebuilt;
        categoryOrder = categoryOrder.map((c) => (c === category ? trimmed : c));
        if (openCategories.delete(category)) openCategories.add(trimmed);
        persistFavorites();
        renderFavorites();
        showToast(`Categoria renomeada para "${trimmed}".`);
    }

    function reorderCategory(category, dir) {
        const order = getSortedCategoryNames();
        const i = order.indexOf(category);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= order.length) return;
        order.splice(j, 0, order.splice(i, 1)[0]);
        categoryOrder = order;
        try {
            localStorage.setItem(LS.order, JSON.stringify(categoryOrder));
        } catch (_) {}
        renderFavorites();
    }

    async function deleteCategory(category) {
        const count = (favorites[category] || []).length;
        const ok = await confirmDialog(
            count
                ? `Excluir "${category}" e as ${count} rádio(s) dentro dela?`
                : `Excluir a categoria vazia "${category}"?`,
            { title: "Excluir categoria", okLabel: "Excluir", danger: true }
        );
        if (!ok) return;
        delete favorites[category];
        openCategories.delete(category);
        persistFavorites();
        renderFavorites();
        showToast(`Categoria "${category}" excluída.`);
    }

    async function createCategory() {
        const name = await promptDialog("Nome da nova categoria:", {
            title: "Nova categoria",
            okLabel: "Criar",
            placeholder: "Ex.: Rock, Notícias, Podcasts…"
        });
        if (name === null) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        if (favorites[trimmed]) {
            showToast("Essa categoria já existe.");
            return;
        }
        favorites[trimmed] = [];
        openCategories.add(trimmed);
        persistFavorites();
        renderFavorites();
        showToast(`Categoria "${trimmed}" criada.`);
    }

    function openCategoryManager() {
        const cats = getSortedCategoryNames();
        const wrap = document.createElement("div");
        const list = document.createElement("div");
        list.className = "modal__choices";
        if (!cats.length) {
            const p = document.createElement("p");
            p.style.margin = "0";
            p.textContent = "Nenhuma categoria ainda. Crie a primeira:";
            wrap.appendChild(p);
        }
        cats.forEach((c) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "modal__choice";
            b.textContent = `${c}  ·  ${(favorites[c] || []).length} rádio(s)`;
            b.addEventListener("click", () => {
                modal.close("__done__");
                categoryMenu(c);
            });
            list.appendChild(b);
        });
        const nb = document.createElement("button");
        nb.type = "button";
        nb.className = "modal__choice";
        nb.textContent = "➕ Nova categoria";
        nb.addEventListener("click", () => {
            modal.close("__done__");
            createCategory();
        });
        list.appendChild(nb);
        wrap.appendChild(list);
        const modal = buildModal({
            title: "Gerenciar categorias",
            body: wrap,
            actions: [{ label: "Fechar", variant: "ghost", value: null }]
        });
    }

    // ============================================================
    // Renderização de estações
    // ============================================================
    function stationDetails(s) {
        const parts = [];
        if (s.country && String(s.country).trim() && s.country !== "N/A") parts.push(String(s.country).trim());
        const codec = s.codec && String(s.codec).trim() && s.codec !== "N/A" ? String(s.codec).trim() : "";
        const bitrate =
            s.bitrate && String(s.bitrate).trim() && String(s.bitrate) !== "0" && s.bitrate !== "N/A"
                ? String(s.bitrate).trim()
                : "";
        if (codec) parts.push(bitrate ? `${codec} · ${bitrate}kbps` : codec);
        return parts.join("  •  ");
    }

    function iconButton(glyph, title, extraClass, onClick) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "icon-btn " + (extraClass || "");
        b.title = title;
        b.setAttribute("aria-label", title);
        b.textContent = glyph;
        b.addEventListener("click", (e) => {
            e.stopPropagation();
            onClick();
        });
        return b;
    }

    function buildStationItem(station, type, category) {
        const item = document.createElement("div");
        item.className = "station-item";
        item.dataset.stationuuid = station.stationuuid;
        if (category) item.dataset.category = category;

        const main = document.createElement("button");
        main.type = "button";
        main.className = "station-main";

        let favEl;
        if (station.favicon) {
            favEl = document.createElement("img");
            favEl.className = "station-favicon";
            favEl.alt = "";
            favEl.loading = "lazy";
            favEl.referrerPolicy = "no-referrer";
            favEl.src = preferHttps(station.favicon);
            favEl.addEventListener("error", () => {
                const ph = document.createElement("span");
                ph.className = "station-favicon-ph";
                ph.textContent = "🎵";
                favEl.replaceWith(ph);
            });
        } else {
            favEl = document.createElement("span");
            favEl.className = "station-favicon-ph";
            favEl.textContent = "🎵";
        }

        const text = document.createElement("div");
        text.className = "station-text";
        const nm = document.createElement("span");
        nm.className = "station-name";
        nm.textContent = station.name || "Sem nome";
        const dt = document.createElement("span");
        dt.className = "station-details";
        dt.textContent = stationDetails(station);
        text.append(nm, dt);

        main.append(favEl, text);
        main.addEventListener("click", () => playStream(station));
        item.appendChild(main);

        const actions = document.createElement("div");
        actions.className = "station-actions";

        if (type === "favorites") {
            actions.appendChild(
                iconButton("↔", "Mover para outra categoria", "act-move", () => moveViaDialog(station, category))
            );
            actions.appendChild(
                iconButton("🗑", "Remover dos favoritos", "act-remove", () =>
                    removeFromFavorites(station.stationuuid, category)
                )
            );
            item.draggable = true;
            setupStationDrag(item, station, category);
        } else {
            const fav = isFavorited(station.stationuuid);
            const b = iconButton(
                fav ? "★" : "☆",
                fav ? "Já nos favoritos" : "Adicionar aos favoritos",
                "act-fav",
                () => addToFavorites(station)
            );
            if (fav) b.classList.add("is-fav");
            actions.appendChild(b);
        }
        item.appendChild(actions);
        return item;
    }

    function renderSearchResults(stations) {
        const valid = (stations || []).filter((s) => s && s.stationuuid && s.name && s.url_resolved);
        if (!valid.length) {
            emptyState(searchResults, "Nenhuma estação encontrada. Tente outro termo ou filtro.");
            return;
        }
        searchResults.innerHTML = "";
        const frag = document.createDocumentFragment();
        valid.forEach((s) => frag.appendChild(buildStationItem(s, "search")));
        searchResults.appendChild(frag);
        markPlayingItems();
    }

    function renderRecents() {
        if (!recentsList) return;
        if (!recents.length) {
            emptyState(recentsList, "Nenhuma rádio tocada ainda.");
            return;
        }
        recentsList.innerHTML = "";
        const frag = document.createDocumentFragment();
        recents.forEach((s) => frag.appendChild(buildStationItem(s, "recents")));
        recentsList.appendChild(frag);
        markPlayingItems();
    }

    function refreshFavStates() {
        [searchResults, recentsList].forEach((container) => {
            if (!container) return;
            container.querySelectorAll(".station-item").forEach((item) => {
                const b = item.querySelector(".act-fav");
                if (!b) return;
                const fav = isFavorited(item.dataset.stationuuid);
                b.textContent = fav ? "★" : "☆";
                b.classList.toggle("is-fav", fav);
                b.title = fav ? "Já nos favoritos" : "Adicionar aos favoritos";
                b.setAttribute("aria-label", b.title);
            });
        });
    }

    function renderFavorites() {
        favoritesList.innerHTML = "";
        const cats = getSortedCategoryNames();
        if (!cats.length) {
            emptyState(favoritesList, "Nenhuma rádio favorita ainda. Busque acima e toque na estrela.");
            refreshFavStates();
            return;
        }
        const frag = document.createDocumentFragment();
        cats.forEach((c) => frag.appendChild(buildCategoryBlock(c)));
        favoritesList.appendChild(frag);
        markPlayingItems();
        refreshFavStates();
    }

    function buildCategoryBlock(category) {
        const stations = favorites[category] || [];
        const isOpen = openCategories.has(category);

        const block = document.createElement("div");
        block.className = "fav-category" + (stations.length ? "" : " fav-category--empty") + (isOpen ? " is-open" : "");
        block.dataset.categoryName = category;

        const header = document.createElement("div");
        header.className = "fav-category__header";

        const handle = document.createElement("span");
        handle.className = "fav-category__handle";
        handle.textContent = "⋮⋮";
        handle.title = "Arrastar para reordenar";
        header.appendChild(handle);

        const nameBtn = document.createElement("button");
        nameBtn.type = "button";
        nameBtn.className = "fav-category__name";
        nameBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        const chev = document.createElement("span");
        chev.className = "fav-category__chev";
        chev.setAttribute("aria-hidden", "true");
        chev.textContent = "▸";
        const label = document.createElement("span");
        label.className = "fav-category__label";
        label.textContent = category;
        const count = document.createElement("span");
        count.className = "fav-category__count";
        count.textContent = String(stations.length);
        nameBtn.append(chev, label, count);
        header.appendChild(nameBtn);

        header.appendChild(iconButton("⋯", "Opções da categoria", "", () => categoryMenu(category)));

        const body = document.createElement("div");
        body.className = "fav-category__body" + (isOpen ? "" : " hidden-section");
        if (!stations.length) {
            const hint = document.createElement("p");
            hint.className = "fav-category__empty-hint";
            hint.textContent = "Categoria vazia — mova rádios para cá ou exclua nas opções (⋯).";
            body.appendChild(hint);
        } else {
            stations.forEach((st) => body.appendChild(buildStationItem(st, "favorites", category)));
        }

        nameBtn.addEventListener("click", () => {
            const open = block.classList.toggle("is-open");
            body.classList.toggle("hidden-section", !open);
            nameBtn.setAttribute("aria-expanded", open ? "true" : "false");
            if (open) openCategories.add(category);
            else openCategories.delete(category);
        });

        setupCategoryDrag(block, header, category);
        block.append(header, body);
        return block;
    }

    // ============================================================
    // Drag & drop (desktop)
    // ============================================================
    function isBefore(e, el) {
        const r = el.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
    }
    function clearDragMarkers() {
        document
            .querySelectorAll(".drag-over-top, .drag-over-bottom")
            .forEach((el) => el.classList.remove("drag-over-top", "drag-over-bottom"));
    }

    function setupStationDrag(item, station, category) {
        item.addEventListener("dragstart", (e) => {
            dragData = { kind: "station", uuid: station.stationuuid, from: category };
            e.dataTransfer.effectAllowed = "move";
            try {
                e.dataTransfer.setData("text/plain", station.stationuuid);
            } catch (_) {}
            item.classList.add("dragging");
        });
        item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
            clearDragMarkers();
            dragData = null;
        });
        item.addEventListener("dragover", (e) => {
            if (!dragData || dragData.kind !== "station") return;
            e.preventDefault();
            const before = isBefore(e, item);
            item.classList.toggle("drag-over-top", before);
            item.classList.toggle("drag-over-bottom", !before);
        });
        item.addEventListener("dragleave", () => {
            item.classList.remove("drag-over-top", "drag-over-bottom");
        });
        item.addEventListener("drop", (e) => {
            if (!dragData || dragData.kind !== "station") return;
            e.preventDefault();
            e.stopPropagation();
            const d = dragData;
            const targetCat = item.dataset.category;
            const before = isBefore(e, item);
            const targetList = favorites[targetCat] || [];
            let idx = targetList.findIndex((s) => s.stationuuid === item.dataset.stationuuid);
            if (idx < 0) idx = targetList.length;
            else if (!before) idx += 1;
            if (d.from === targetCat) {
                const cur = targetList.findIndex((s) => s.stationuuid === d.uuid);
                if (cur > -1 && cur < idx) idx -= 1;
            }
            clearDragMarkers();
            moveStation(d.uuid, d.from, targetCat, idx);
        });
    }

    function setupCategoryDrag(block, header, category) {
        header.draggable = true;
        header.addEventListener("dragstart", (e) => {
            dragData = { kind: "category", category };
            e.dataTransfer.effectAllowed = "move";
            try {
                e.dataTransfer.setData("text/plain", category);
            } catch (_) {}
            block.classList.add("dragging");
        });
        header.addEventListener("dragend", () => {
            block.classList.remove("dragging");
            clearDragMarkers();
            dragData = null;
        });
        block.addEventListener("dragover", (e) => {
            if (!dragData || dragData.kind !== "category") return;
            e.preventDefault();
            const before = isBefore(e, block);
            block.classList.toggle("drag-over-top", before);
            block.classList.toggle("drag-over-bottom", !before);
        });
        block.addEventListener("dragleave", () => {
            block.classList.remove("drag-over-top", "drag-over-bottom");
        });
        block.addEventListener("drop", (e) => {
            if (!dragData || dragData.kind !== "category") return;
            e.preventDefault();
            const dragged = dragData.category;
            const before = isBefore(e, block);
            clearDragMarkers();
            dragData = null;
            if (dragged === category) return;
            const order = getSortedCategoryNames();
            order.splice(order.indexOf(dragged), 1);
            let ti = order.indexOf(category);
            if (!before) ti += 1;
            order.splice(ti, 0, dragged);
            categoryOrder = order;
            try {
                localStorage.setItem(LS.order, JSON.stringify(categoryOrder));
            } catch (_) {}
            renderFavorites();
        });
    }

    // ============================================================
    // Busca (API Radio Browser + filtros)
    // ============================================================
    function readFilters() {
        return {
            country: filterCountry ? filterCountry.value.trim() : "",
            tag: filterTag ? filterTag.value.trim() : "",
            language: filterLanguage ? filterLanguage.value.trim() : ""
        };
    }
    function persistFilters() {
        try {
            localStorage.setItem(LS.filters, JSON.stringify(readFilters()));
        } catch (_) {}
    }
    function restoreFilters() {
        try {
            const f = JSON.parse(localStorage.getItem(LS.filters)) || {};
            if (f.country && filterCountry) filterCountry.value = f.country;
            if (f.tag && filterTag) filterTag.value = f.tag;
            if (f.language && filterLanguage) filterLanguage.value = f.language;
            if (f.country || f.tag || f.language) setFiltersOpen(true);
        } catch (_) {}
    }
    function setFiltersOpen(open) {
        searchFilters.classList.toggle("hidden-section", !open);
        toggleFiltersButton.setAttribute("aria-expanded", String(open));
    }

    async function searchStations() {
        const term = searchInput.value.trim();
        const f = readFilters();
        persistFilters();

        if (!term && !f.country && !f.tag && !f.language) {
            emptyState(searchResults, "Digite um nome ou use os filtros avançados.");
            return;
        }
        emptyState(searchResults, "Buscando…");

        if (searchAbort) searchAbort.abort();
        searchAbort = new AbortController();

        const params = new URLSearchParams({
            limit: "40",
            hidebroken: "true",
            order: "clickcount",
            reverse: "true"
        });
        if (term) params.set("name", term);
        if (f.country) params.set("countrycode", f.country);
        if (f.tag) params.set("tag", f.tag.toLowerCase());
        if (f.language) params.set("language", f.language.toLowerCase());

        for (let i = 0; i < API_URLS.length; i++) {
            try {
                const res = await fetch(`${API_URLS[i]}?${params.toString()}`, {
                    headers: { Accept: "application/json" },
                    signal: searchAbort.signal
                });
                if (!res.ok) throw new Error("HTTP " + res.status);
                const stations = await res.json();
                if (!Array.isArray(stations)) throw new Error("Resposta inválida");
                renderSearchResults(stations);
                return;
            } catch (err) {
                if (err.name === "AbortError") return;
                if (i === API_URLS.length - 1) {
                    emptyState(searchResults, "Não foi possível buscar agora. Verifique a conexão e tente de novo.");
                    showToast("Falha na busca: " + err.message, 4000);
                }
            }
        }
    }

    // ============================================================
    // Player
    // ============================================================
    function setPlayerState(state) {
        playerBar.dataset.state = state;
        setMediaPlaybackState(state);

        if (isTrack(currentStation)) {
            // Faixa da biblioteca: capa e nomes já vêm do Jellyfin, sem
            // consultar o Worker de "tocando agora".
            clearInterval(nowPlayingPollTimer);
            nowPlayingPollTimer = 0;
            nowPlayingToken++;
            applyArt(currentStation.favicon || null);
            if (carTrackInfo) carTrackInfo.hidden = true;
        } else if (state === "playing" && currentStation) {
            refreshNowPlaying(currentStation);
            clearInterval(nowPlayingPollTimer);
            nowPlayingPollTimer = setInterval(() => {
                if (playerBar.dataset.state === "playing" && currentStation) refreshNowPlaying(currentStation);
            }, 20000);
        } else {
            clearInterval(nowPlayingPollTimer);
            nowPlayingPollTimer = 0;
            clearNowPlaying();
        }

        updateCarModeUI();
    }

    // Rádio: ▶ e ■. Faixa da biblioteca: ▶/❚❚ (pausa de verdade) e ⏭; o
    // "parar" e o "anterior" ficam no painel expandido (queueRow).
    function updatePlayButtons(isPlaying) {
        const track = isTrack(currentStation);
        playerBar.classList.toggle("is-track", track);
        queueRow.hidden = !track;
        trackFavButton.hidden = !track;
        refreshFavUI();
        if (track) {
            const playing = !audioPlayer.paused;
            playButton.disabled = false;
            playButton.textContent = playing ? "❚❚" : "▶";
            playButton.setAttribute("aria-label", playing ? "Pausar" : "Tocar");
            stopButton.disabled = queue.index >= queue.items.length - 1;
            stopButton.textContent = "⏭";
            stopButton.setAttribute("aria-label", "Próxima faixa");
            queueStatus.textContent = queue.items.length ? `Faixa ${queue.index + 1} de ${queue.items.length}` : "";
            return;
        }
        playButton.disabled = !currentStation || isPlaying;
        playButton.textContent = "▶";
        playButton.setAttribute("aria-label", "Tocar");
        stopButton.disabled = !currentStation;
        stopButton.textContent = "■";
        stopButton.setAttribute("aria-label", "Parar");
    }

    function markPlayingItems() {
        const uuid = currentStation && playerBar.dataset.state !== "idle" ? currentStation.stationuuid : null;
        document.querySelectorAll(".station-item").forEach((item) => {
            item.classList.toggle("is-playing", !!uuid && item.dataset.stationuuid === uuid);
        });
    }

    // Monta a lista de URLs a tentar, priorizando HTTPS numa página HTTPS
    // (evita o bloqueio de conteúdo misto do navegador).
    function streamCandidates(station) {
        const out = [];
        const add = (u) => {
            if (u && typeof u === "string" && !out.includes(u)) out.push(u);
        };
        add(preferHttps(station.url_resolved));
        add(preferHttps(station.url));
        add(station.url_resolved);
        add(station.url);
        return out;
    }

    function playStream(station) {
        if (!station || !station.url_resolved) {
            showToast("URL da estação indisponível.");
            return;
        }
        stopStream(true);
        currentStation = station;
        lastStation = station;
        // Faixas da biblioteca ficam fora das estatísticas, recentes e
        // presets — esses são das rádios.
        const track = isTrack(station);
        if (track) setTrackMediaMetadata(station);
        else setStationMediaMetadata(station);
        const token = ++playToken;
        streamSettling = true;
        if (!track && window.radioData) window.radioData.recordClick(station);

        nowPlaying.textContent = `Carregando: ${station.name}…`;
        setMarqueeText(nowPlayingSub, playerSubtitle(station));
        setPlayerState("loading");
        updatePlayButtons(false);

        const candidates = streamCandidates(station);

        const onPlaying = () => {
            if (token !== playToken || currentStation !== station) return;
            streamSettling = false;
            nowPlaying.textContent = station.name;
            setMarqueeText(nowPlayingSub, playerSubtitle(station));
            setPlayerState("playing");
            updatePlayButtons(true);
            document.title = `▶ ${station.name} · Rádio Player`;
            if (window.RadioWakeLock) window.RadioWakeLock.request();
            markPlayingItems();
            if (track) return;
            if (window.radioData) window.radioData.startListeningSession(station);
            recordRecent(station);
            setTimeout(updateTopRadios, 1200);
        };

        const attempt = (i) => {
            if (token !== playToken) return;
            const url = candidates[i];

            const fail = (err) => {
                if (token !== playToken) return;
                if (currentHls) {
                    try {
                        currentHls.destroy();
                    } catch (_) {}
                    currentHls = null;
                }
                if (i + 1 < candidates.length) {
                    console.warn(
                        `Rádio "${station.name}": ${url} falhou (${err && err.message}); tentando alternativa.`
                    );
                    attempt(i + 1);
                } else {
                    streamSettling = false;
                    handlePlayError(station, err);
                }
            };

            if (url.includes(".m3u8")) {
                if (window.Hls && Hls.isSupported()) {
                    currentHls = new Hls();
                    currentHls.loadSource(url);
                    currentHls.attachMedia(audioPlayer);
                    currentHls.on(Hls.Events.MANIFEST_PARSED, () => {
                        audioPlayer.play().then(onPlaying).catch(fail);
                    });
                    currentHls.on(Hls.Events.ERROR, (evt, data) => {
                        if (data && data.fatal) fail(new Error(data.details || data.type || "HLS"));
                    });
                } else if (audioPlayer.canPlayType("application/vnd.apple.mpegurl")) {
                    audioPlayer.src = url;
                    audioPlayer.play().then(onPlaying).catch(fail);
                } else {
                    streamSettling = false;
                    showToast("Este navegador não suporta esta rádio (HLS).", 4000);
                    stopStream();
                }
            } else {
                audioPlayer.src = url;
                audioPlayer.load();
                audioPlayer.play().then(onPlaying).catch(fail);
            }
        };

        attempt(0);
    }

    function handlePlayError(station, error) {
        console.error("Erro ao tocar", station && station.name, error);
        let msg = `Não foi possível tocar "${station.name}".`;
        if (error && error.name === "NotAllowedError") {
            msg = "Toque no ▶ para iniciar o áudio.";
        } else if (isTrack(station)) {
            msg += " Confira se o Tailscale está ligado.";
        } else if (station.url_resolved && station.url_resolved.startsWith("http:") && location.protocol === "https:") {
            msg += " A rádio usa HTTP e pode estar sendo bloqueada pelo navegador.";
        } else {
            msg += " Pode estar fora do ar ou sem conexão.";
        }
        showToast(msg, 4500);
        stopStream();
        setPlayerState("idle");
    }

    function stopStream(silent) {
        streamSettling = false;
        if (window.radioData) window.radioData.endListeningSession();
        try {
            audioPlayer.pause();
        } catch (_) {}
        if (currentHls) {
            try {
                currentHls.destroy();
            } catch (_) {}
            currentHls = null;
        }
        audioPlayer.removeAttribute("src");
        try {
            audioPlayer.load();
        } catch (_) {}
        if (window.RadioWakeLock) window.RadioWakeLock.release();

        currentStation = null;
        updatePlayButtons(false);
        updateTrackProgress();
        markPlayingItems();
        document.title = "Rádio Player Online";

        if (!silent) {
            cancelSleepTimer(false);
            nowPlaying.textContent = "Nenhuma rádio tocando";
            setMarqueeText(nowPlayingSub, "");
            setPlayerState("idle");
        }
    }

    // ============================================================
    // Modo Carro
    // ============================================================
    function updateCarModeUI() {
        if (!carModeScreen || carModeScreen.hidden) return;
        const state = playerBar.dataset.state;
        carModeScreen.dataset.state = state;
        const isBusy = state === "playing" || state === "loading";

        const track = isTrack(currentStation);
        carModeScreen.classList.toggle("is-track", track);

        if (currentStation) {
            carStationName.textContent = currentStation.name || "Sem nome";
            carStationSub.textContent = playerSubtitle(currentStation) || "";
        } else {
            carStationName.textContent = "Nenhuma rádio selecionada";
            carStationSub.textContent = "Toque em um preset abaixo";
        }

        const live = track ? "Biblioteca" : "Ao vivo";
        carStatusLabel.textContent =
            state === "playing" ? live : state === "loading" ? "Carregando…" : state === "paused" ? "Pausado" : "Parado";
        carPlayButton.disabled = !currentStation;
        // Faixa: o botão grande pausa/retoma; rádio: para/reconecta.
        const glyph = isBusy ? (track ? "❚❚" : "■") : "▶";
        carPlayButton.textContent = glyph;
        carPlayButton.setAttribute("aria-label", isBusy ? (track ? "Pausar" : "Parar") : "Tocar");
        carPrevButton.setAttribute("aria-label", track ? "Faixa anterior" : "Estação anterior");
        carNextButton.setAttribute("aria-label", track ? "Próxima faixa" : "Próxima estação");

        refreshCarPresetActive();
        updateTrackProgress();
    }

    function setArtImage(el, url) {
        if (!el) return;
        if (url) {
            el.src = url;
            el.hidden = false;
        } else {
            el.removeAttribute("src");
            el.hidden = true;
        }
    }

    // Atualiza a capa nos dois lugares e esconde o equalizador animado
    // enquanto ela estiver visível (ele só faz sentido como indicador de
    // "tocando" quando não há capa pra mostrar).
    function applyArt(url) {
        setArtImage(carArt, url);
        setArtImage(nowPlayingArt, url);
        playerBar.classList.toggle("has-art", !!url);
        carModeScreen.classList.toggle("has-art", !!url);
    }

    // Letreiro: só anima quando o texto não cabe no espaço disponível.
    // `el` é o "visor" (overflow:hidden); por dentro ele ganha uma faixa
    // (.marquee__track) que é a parte realmente medida e animada.
    function setMarqueeText(el, text) {
        if (!el) return;
        let track = el.querySelector(".marquee__track");
        if (!track) {
            track = document.createElement("span");
            track.className = "marquee__track";
            el.textContent = "";
            el.appendChild(track);
        }
        track.classList.remove("is-scrolling");
        track.style.removeProperty("--marquee-shift");
        track.style.removeProperty("--marquee-duration");
        const oldClone = track.querySelector(".marquee__clone");
        if (oldClone) oldClone.remove();
        track.textContent = text || "";
        if (!text) return;

        requestAnimationFrame(() => {
            if (track.textContent !== text) return; // texto já mudou de novo
            const mainWidth = track.scrollWidth;
            if (mainWidth <= el.clientWidth + 1) return;

            const gap = 48;
            const clone = document.createElement("span");
            clone.className = "marquee__clone";
            clone.setAttribute("aria-hidden", "true");
            clone.style.paddingLeft = gap + "px";
            clone.textContent = text;
            track.appendChild(clone);

            const shift = mainWidth + gap;
            const speed = 45; // px por segundo — ritmo confortável de leitura
            const duration = Math.max(6, shift / speed);
            track.style.setProperty("--marquee-shift", `-${shift}px`);
            track.style.setProperty("--marquee-duration", `${duration}s`);
            track.classList.add("is-scrolling");
        });
    }

    function clearNowPlaying() {
        nowPlayingToken++;
        applyArt(null);
        if (carTrackInfo) {
            carTrackInfo.hidden = true;
            setMarqueeText(carTrackInfo, "");
        }
        if (currentStation) setMarqueeText(nowPlayingSub, playerSubtitle(currentStation) || "");
    }

    // Busca "tocando agora" (artista/faixa/capa) via o Worker do metadado ICY,
    // com fallback pra busca de capa na iTunes. Atualiza tanto a barra fixa do
    // player quanto o Modo Carro, estando ele aberto ou não. Opcional: some de
    // volta ao comportamento atual se NOWPLAYING_WORKER_URL não estiver
    // configurado ou a estação não enviar metadado.
    async function refreshNowPlaying(station) {
        if (!NOWPLAYING_WORKER_URL || !station || !station.url_resolved) return;
        const token = ++nowPlayingToken;

        let data = null;
        try {
            const res = await fetch(NOWPLAYING_WORKER_URL + "?url=" + encodeURIComponent(station.url_resolved));
            if (res.ok) data = await res.json();
        } catch (_) {
            // metadado é um extra — falha aqui nunca deve afetar o player
        }
        if (token !== nowPlayingToken) return;

        if (!data || !data.title) {
            applyArt(null);
            if (carTrackInfo) {
                carTrackInfo.hidden = true;
                setMarqueeText(carTrackInfo, "");
            }
            if (currentStation === station) {
                setMarqueeText(nowPlayingSub, stationDetails(station) || "");
                setStationMediaMetadata(station);
            }
            return;
        }

        let art = data.art || null;
        if (!art) {
            try {
                const term = encodeURIComponent([data.artist, data.title].filter(Boolean).join(" "));
                const r2 = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&limit=1`);
                const j2 = await r2.json();
                const hit = j2 && j2.results && j2.results[0];
                if (hit && hit.artworkUrl100) art = hit.artworkUrl100.replace("100x100", "600x600");
            } catch (_) {}
        }
        if (token !== nowPlayingToken) return;

        // A capa (e o espaço que ela ocupa) precisa estar definida ANTES de
        // medir o letreiro — senão a medição roda com um layout mais largo do
        // que o real, e o texto nunca entra em scroll quando devia.
        applyArt(art);

        const label = data.artist ? `${data.artist} — ${data.title}` : data.title;
        if (carTrackInfo) {
            carTrackInfo.hidden = false;
            setMarqueeText(carTrackInfo, label);
        }
        if (currentStation === station) {
            setMarqueeText(nowPlayingSub, label);
            setMediaMetadata({
                title: data.title,
                artist: data.artist || station.name,
                album: data.artist ? station.name : "",
                art: art || station.favicon
            });
        }
    }

    // ============================================================
    // Media Session — o que aparece na notificação, na tela de bloqueio e,
    // via Bluetooth (AVRCP), no painel do carro. Também recebe os botões
    // de mídia do volante/central: play, stop e próxima/anterior.
    // Feito para o Chrome do Android; em outros navegadores o suporte varia
    // e a ausência da API é simplesmente ignorada.
    // ============================================================
    const hasMediaSession = "mediaSession" in navigator && typeof window.MediaMetadata === "function";
    const APP_ICON_URL = new URL("icons/icon-512x512.png", location.href).href;

    function setMediaMetadata({ title, artist, album, art }) {
        if (!hasMediaSession) return;
        const artwork = [];
        if (art) artwork.push({ src: preferHttps(art) });
        artwork.push({ src: APP_ICON_URL, sizes: "512x512", type: "image/png" });
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title || "",
                artist: artist || "",
                album: album || "",
                artwork
            });
        } catch (_) {}
    }

    function setStationMediaMetadata(station) {
        if (!station) return;
        setMediaMetadata({
            title: station.name || "Rádio",
            artist: stationDetails(station) || "Rádio ao vivo",
            art: station.favicon
        });
    }

    function setTrackMediaMetadata(track) {
        setMediaMetadata({ title: track.name, artist: track.artist, album: track.album, art: track.favicon });
    }

    function formatTime(sec) {
        const s = Math.max(0, Math.floor(sec || 0));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const ss = String(s % 60).padStart(2, "0");
        return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
    }

    function trackDurationSec() {
        if (!isTrack(currentStation)) return 0;
        return isFinite(audioPlayer.duration) && audioPlayer.duration > 0
            ? audioPlayer.duration
            : currentStation.duration || 0;
    }

    // Barra de tempo arrastável (player e Modo Carro) + posição na
    // notificação do Android. Só pra faixas; rádio ao vivo não tem.
    function updateTrackProgress() {
        const dur = trackDurationSec();
        const pos = Math.min(audioPlayer.currentTime || 0, dur);
        const durLabel = formatTime(dur);
        [
            [trackSeek, trackElapsed, trackDuration],
            [carSeek, carElapsed, carDuration]
        ].forEach(([seek, elapsed, total]) => {
            if (!seek) return;
            seek.max = String(Math.floor(dur));
            total.textContent = durLabel;
            if (seekDragging) return;
            seek.value = String(Math.floor(pos));
            seek.style.setProperty("--seek-pct", dur ? (pos / dur) * 100 + "%" : "0%");
            elapsed.textContent = formatTime(pos);
        });

        if (!hasMediaSession || !navigator.mediaSession.setPositionState) return;
        try {
            if (dur) {
                navigator.mediaSession.setPositionState({ duration: dur, position: pos, playbackRate: 1 });
                positionStateSet = true;
            } else if (positionStateSet) {
                navigator.mediaSession.setPositionState();
                positionStateSet = false;
            }
        } catch (_) {}
    }

    function setMediaPlaybackState(state) {
        if (!hasMediaSession) return;
        try {
            navigator.mediaSession.playbackState =
                state === "playing" || state === "loading" ? "playing" : currentStation ? "paused" : "none";
        } catch (_) {}
    }

    // Próxima/anterior seguem os presets do Modo Carro (mais ouvidas por
    // tempo), carregando-os se o Modo Carro ainda não foi aberto.
    async function mediaStep(delta) {
        if (!carPresets.length) await loadCarPresets();
        carStep(delta);
    }

    // Arrastar mostra o tempo; soltar pula pra ele.
    function wireSeek(seek, elapsed) {
        if (!seek) return;
        seek.addEventListener("input", () => {
            seekDragging = true;
            const dur = trackDurationSec();
            elapsed.textContent = formatTime(+seek.value);
            seek.style.setProperty("--seek-pct", dur ? (+seek.value / dur) * 100 + "%" : "0%");
        });
        seek.addEventListener("change", () => {
            seekDragging = false;
            if (isTrack(currentStation) && trackDurationSec()) audioPlayer.currentTime = +seek.value;
            updateTrackProgress();
        });
    }

    // Altura real do player (cresce com a barra de tempo e o painel aberto):
    // as telas usam isso no espaço do fim, pra nada ficar escondido atrás dele.
    function watchPlayerHeight() {
        const apply = () => document.documentElement.style.setProperty("--player-live", playerBar.offsetHeight + "px");
        apply();
        if (window.ResizeObserver) new ResizeObserver(apply).observe(playerBar);
        else window.addEventListener("resize", apply);
    }

    function wireMediaSession() {
        if (!hasMediaSession) return;
        const handlers = {
            // Rádio ao vivo: "pausar" é parar; "tocar" reconecta no ao vivo.
            // Faixa da biblioteca: pausa e retoma de onde parou.
            play: () => {
                if (isTrack(currentStation)) {
                    audioPlayer.play().catch((err) => handlePlayError(currentStation, err));
                    return;
                }
                const st = currentStation || lastStation;
                if (st) playStream(st);
            },
            pause: () => (isTrack(currentStation) ? audioPlayer.pause() : stopStream()),
            stop: () => stopStream(),
            nexttrack: () => (isTrack(currentStation) ? queueStep(1) : mediaStep(1)),
            previoustrack: () => (isTrack(currentStation) ? queuePrev() : mediaStep(-1)),
            seekto: (d) => {
                if (!isTrack(currentStation) || !d || d.seekTime == null) return;
                audioPlayer.currentTime = d.seekTime;
                updateTrackProgress();
            }
        };
        Object.keys(handlers).forEach((action) => {
            try {
                navigator.mediaSession.setActionHandler(action, handlers[action]);
            } catch (_) {
                // ação não suportada neste navegador
            }
        });
    }

    function refreshCarPresetActive() {
        const uuid = currentStation ? currentStation.stationuuid : null;
        carPresetGrid.querySelectorAll(".car-preset").forEach((el) => {
            el.classList.toggle("is-active", !!uuid && el.dataset.stationuuid === uuid);
        });
    }

    function buildCarPresetTile(station, index) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "car-preset";
        b.dataset.stationuuid = station.stationuuid;

        const num = document.createElement("span");
        num.className = "car-preset__num";
        num.textContent = "#" + (index + 1);

        const name = document.createElement("b");
        name.textContent = station.name || "Sem nome";

        const time = document.createElement("span");
        time.textContent = station._timeLabel || "";

        b.append(num, name, time);
        b.addEventListener("click", () => playCarPreset(index));
        return b;
    }

    function renderCarPresets() {
        carPresetGrid.innerHTML = "";
        if (!carPresets.length) {
            emptyState(carPresetGrid, "Ouça algumas rádios para elas aparecerem aqui.");
            return;
        }
        const frag = document.createDocumentFragment();
        carPresets.forEach((st, i) => frag.appendChild(buildCarPresetTile(st, i)));
        carPresetGrid.appendChild(frag);
        refreshCarPresetActive();
    }

    async function loadCarPresets() {
        if (!window.radioData) {
            carPresets = [];
            renderCarPresets();
            return;
        }
        try {
            const top = await window.radioData.getTopByTime(8);
            carPresets = top.map((r) => ({
                stationuuid: r.stationId,
                name: r.name,
                url_resolved: r.url,
                favicon: "",
                country: "",
                codec: "",
                bitrate: "",
                _timeLabel: window.radioData.formatTime(r.totalTime || 0)
            }));
        } catch (_) {
            carPresets = [];
        }
        renderCarPresets();
    }

    function playCarPreset(index) {
        if (index < 0 || index >= carPresets.length) return;
        playStream(carPresets[index]);
    }

    function carStep(delta) {
        if (!carPresets.length) return;
        const cur = currentStation ? carPresets.findIndex((p) => p.stationuuid === currentStation.stationuuid) : -1;
        const next = cur > -1 ? (cur + delta + carPresets.length) % carPresets.length : 0;
        playCarPreset(next);
    }

    function tickCarClock() {
        const d = new Date();
        carClock.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }

    // Tela cheia de verdade (esconde as barras de status e de navegação do
    // Android). Precisa de um toque do usuário — por isso é pedida ao abrir o
    // Modo Carro e de novo a cada toque nele, caso o sistema tenha saído da
    // tela cheia (ao alternar pro GPS, por exemplo). Não funciona no iPhone:
    // o Safari não permite tela cheia fora de vídeos.
    function requestCarFullscreen() {
        const el = document.documentElement;
        if (carModeScreen.hidden || document.fullscreenElement || !el.requestFullscreen) return;
        el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    }

    function leaveFullscreen() {
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }

    function enterCarMode() {
        carModeScreen.hidden = false;
        document.body.style.overflow = "hidden";
        requestCarFullscreen();
        pushOverlayState("car");
        updateCarModeUI();
        loadCarPresets();
        tickCarClock();
        clearInterval(carClockTimer);
        carClockTimer = setInterval(tickCarClock, 15000);
    }

    function exitCarMode(fromHistory) {
        if (carModeScreen.hidden) return;
        carModeScreen.hidden = true;
        document.body.style.overflow = "";
        leaveFullscreen();
        if (!fromHistory) popOverlayState("car");
        clearInterval(carClockTimer);
        carClockTimer = 0;
    }

    // ============================================================
    // Tela de busca
    // ============================================================
    function openSearch() {
        searchScreen.hidden = false;
        document.body.style.overflow = "hidden";
        pushOverlayState("search");
        // Só abre o teclado se ainda não há resultados pra ver.
        if (!searchResults.children.length) searchInput.focus();
    }

    function closeSearch(fromHistory) {
        if (searchScreen.hidden) return;
        searchScreen.hidden = true;
        document.body.style.overflow = "";
        searchInput.blur();
        if (!fromHistory) popOverlayState("search");
    }

    // Telas sobrepostas (busca, Modo Carro) entram no histórico, pra que o
    // "voltar" do Android feche a tela em vez de sair do app.
    function pushOverlayState(name) {
        try {
            history.pushState({ overlay: name }, "");
        } catch (_) {}
    }

    function popOverlayState(name) {
        if (history.state && history.state.overlay === name) history.back();
    }

    // ============================================================
    // Minha biblioteca (Jellyfin) — fila de reprodução
    // ============================================================
    function trackToStation(item) {
        const J = window.Jellyfin;
        noteFavorites([item]);
        return {
            kind: "track",
            itemId: item.Id,
            stationuuid: "jf-" + item.Id,
            name: item.Name || "Sem título",
            artist: item.AlbumArtist || (item.Artists || []).join(", "),
            album: item.Album || "",
            url_resolved: J.streamUrl(item),
            favicon: J.imageUrl(item, 600),
            duration: item.RunTimeTicks ? item.RunTimeTicks / 1e7 : 0
        };
    }

    function shuffled(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Mesma música em mais de um álbum (coletânea, deluxe, remaster) tem id
    // diferente no Jellyfin — compara artista + título "limpos".
    function trackKey(item) {
        const norm = (t) =>
            String(t || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[([][^)\]]*(remaster|deluxe|edition|edicao|mono|stereo|version|versao|bonus)[^)\]]*[)\]]/g, "")
                .replace(/\s-\s.*(remaster|edition|version|mono|stereo).*$/, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim();
        // Título sem letras latinas (japonês, por ex.) vira vazio — usa o original.
        const key = (t) => norm(t) || String(t || "").toLowerCase();
        const artist = (item.Artists && item.Artists[0]) || item.AlbumArtist || "";
        return key(artist) + "|" + key(item.Name);
    }

    // Tira faixas repetidas: sempre pelo id; com byKey, também pela música.
    function uniqueTracks(list, { byKey = false } = {}) {
        const seen = new Set();
        return (list || []).filter((i) => {
            const keys = byKey ? [i.Id, trackKey(i)] : [i.Id];
            if (keys.some((k) => seen.has(k))) return false;
            keys.forEach((k) => seen.add(k));
            return true;
        });
    }

    function isAudioItem(i) {
        return !!i && !!i.Id && (i.Type === "Audio" || i.MediaType === "Audio");
    }

    function playQueue(items, start = 0, { shuffle = false } = {}) {
        const list = uniqueTracks((items || []).filter(isAudioItem));
        if (!list.length) {
            showToast("Nada para tocar aqui.");
            return;
        }
        queue = { items: shuffle ? shuffled(list) : list, index: -1 };
        playQueueIndex(shuffle ? 0 : Math.max(0, Math.min(start, list.length - 1)));
    }

    function playQueueIndex(i) {
        if (i < 0 || i >= queue.items.length) return;
        queue.index = i;
        rememberPlayed(queue.items[i].Id);
        playStream(trackToStation(queue.items[i]));
    }

    // Últimas faixas tocadas — o "Tocar tudo no aleatório" evita repeti-las.
    const PLAYED_MAX = 400;
    function loadPlayed() {
        try {
            const a = JSON.parse(localStorage.getItem(LS.played));
            return Array.isArray(a) ? a : [];
        } catch (_) {
            return [];
        }
    }

    function rememberPlayed(id) {
        const list = loadPlayed().filter((x) => x !== id);
        list.push(id);
        try {
            localStorage.setItem(LS.played, JSON.stringify(list.slice(-PLAYED_MAX)));
        } catch (_) {}
    }

    // Sorteia a biblioteca toda: busca mais que o necessário, tira repetidas
    // e as que tocaram há pouco, e toca um lote. Acabou o lote, para.
    async function shuffleAll() {
        showToast("Sorteando músicas…");
        try {
            const res = await window.Jellyfin.randomTracks(400);
            const all = uniqueTracks(((res && res.Items) || []).filter(isAudioItem), { byKey: true });
            const order = loadPlayed();
            const played = new Set(order);
            let fresh = all.filter((i) => !played.has(i.Id));
            // Biblioteca pequena (quase tudo já tocou): completa com as tocadas há mais tempo.
            if (fresh.length < 50) {
                const old = all.filter((i) => played.has(i.Id)).sort((a, b) => order.indexOf(a.Id) - order.indexOf(b.Id));
                fresh = fresh.concat(old);
            }
            playQueue(fresh.slice(0, 150));
        } catch (err) {
            showToast(err.message || "Erro ao carregar.", 4000);
        }
    }

    // ---------- Favoritos (❤ do Jellyfin) ----------
    function noteFavorites(items) {
        (items || []).forEach((i) => {
            if (i && i.Id && i.UserData) favState.set(i.Id, !!i.UserData.IsFavorite);
        });
    }

    function setFavGlyph(btn, on) {
        btn.textContent = on ? "❤" : "♡";
        btn.classList.toggle("is-fav", on);
        btn.setAttribute("aria-pressed", String(on));
        const label = on ? "Remover das favoritas" : "Adicionar às favoritas";
        btn.title = label;
        btn.setAttribute("aria-label", label);
    }

    function refreshFavUI() {
        const id = isTrack(currentStation) ? currentStation.itemId : null;
        const on = !!id && !!favState.get(id);
        setFavGlyph(trackFavButton, on);
        setFavGlyph(carFavButton, on);
        document.querySelectorAll("[data-fav-id]").forEach((b) => setFavGlyph(b, !!favState.get(b.dataset.favId)));
    }

    async function toggleFavorite(itemId) {
        if (!itemId || !window.Jellyfin) return;
        const on = !favState.get(itemId);
        favState.set(itemId, on);
        refreshFavUI();
        try {
            await window.Jellyfin.setFavorite(itemId, on);
            delete libHomeCache.favorites;
            showToast(on ? "❤ Adicionada às favoritas." : "Removida das favoritas.");
            const view = libStack[libStack.length - 1];
            if (!libraryScreen.hidden && view && view.type === "home" && view.tab === "favorites") {
                view.scroll = libraryBody.scrollTop;
                renderLibraryView();
            }
        } catch (err) {
            favState.set(itemId, !on);
            refreshFavUI();
            showToast(err.message || "Não foi possível salvar o favorito.", 4000);
        }
    }

    function queueStep(delta) {
        if (!queue.items.length) return;
        const next = queue.index + delta;
        if (next >= queue.items.length) {
            showToast("Fim da fila.");
            return;
        }
        playQueueIndex(Math.max(0, next));
    }

    // Como num player comum: no meio da música, "anterior" volta ao começo dela.
    function queuePrev() {
        if (audioPlayer.currentTime > 3 || queue.index <= 0) {
            audioPlayer.currentTime = 0;
            updateTrackProgress();
            return;
        }
        playQueueIndex(queue.index - 1);
    }

    function onTrackEnded() {
        if (queue.index < queue.items.length - 1) {
            playQueueIndex(queue.index + 1);
        } else {
            stopStream();
            showToast("Fim da fila. 🎵");
        }
    }

    function toggleTrackPause() {
        if (audioPlayer.paused) audioPlayer.play().catch((err) => handlePlayError(currentStation, err));
        else audioPlayer.pause();
    }

    // ============================================================
    // Minha biblioteca — tela (navegação em pilha, como pastas)
    // Cada nível entra no histórico, então o "voltar" do Android sobe um
    // nível; no topo, fecha a tela.
    // ============================================================
    const LIB_TABS = {
        playlists: { label: "Playlists", load: (start) => window.Jellyfin.playlists({ start }) },
        albums: { label: "Álbuns", load: (start) => window.Jellyfin.albums({ start }) },
        artists: { label: "Artistas", load: (start) => window.Jellyfin.artists({ start }) },
        favorites: { label: "Favoritas", load: (start) => window.Jellyfin.favoriteTracks({ start }) }
    };

    function openLibrary() {
        if (!window.Jellyfin || !window.Jellyfin.isConfigured()) {
            openSheet(settingsSheet);
            return;
        }
        libraryScreen.hidden = false;
        document.body.style.overflow = "hidden";
        libStack = [{ type: "home", tab: "playlists" }];
        pushLibraryState();
        renderLibraryView();
    }

    function closeLibrary(fromHistory) {
        if (libraryScreen.hidden) return;
        libraryScreen.hidden = true;
        document.body.style.overflow = "";
        librarySearchInput.blur();
        libToken++;
        if (!fromHistory) {
            const depth = history.state && history.state.overlay === "library" ? history.state.depth : 0;
            if (depth) history.go(-depth);
        }
        libStack = [];
    }

    function pushLibraryState() {
        try {
            history.pushState({ overlay: "library", depth: libStack.length }, "");
        } catch (_) {}
    }

    function libraryPush(view) {
        const cur = libStack[libStack.length - 1];
        if (cur) cur.scroll = libraryBody.scrollTop;
        libStack.push(view);
        pushLibraryState();
        renderLibraryView();
    }

    // Chamado pelo popstate: volta pro nível guardado no histórico.
    function libraryGoTo(depth) {
        libStack = libStack.slice(0, Math.max(1, depth));
        renderLibraryView();
    }

    function loadLibraryView(view, start = 0) {
        const J = window.Jellyfin;
        switch (view.type) {
            case "home":
                return LIB_TABS[view.tab].load(start);
            case "album":
                return J.albumTracks(view.item.Id);
            case "playlist":
                return J.playlistTracks(view.item.Id);
            case "artist":
                return J.artistAlbums(view.item.Id);
            case "mix":
                return J.instantMix(view.item.Id);
            case "search":
                return J.search(view.term);
        }
        return Promise.resolve(null);
    }

    function libraryError(err) {
        emptyState(libraryList, (err && err.message) || "Erro ao carregar.");
        if (err && err.kind === "auth") {
            showToast(err.message, 4500);
        }
    }

    async function renderLibraryView() {
        const view = libStack[libStack.length - 1];
        if (!view) return;
        const token = ++libToken;
        const isHome = view.type === "home";

        libraryHome.hidden = !isHome;
        libraryTitle.textContent = isHome ? "Minha biblioteca" : view.title;
        libraryActions.hidden = true;
        libraryActions.innerHTML = "";
        libraryMoreButton.hidden = true;
        if (isHome) {
            libraryTabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === view.tab));
        }

        // Dados ficam guardados: voltar um nível não busca tudo de novo.
        let data = isHome ? libHomeCache[view.tab] : view.data;
        if (!data) {
            emptyState(libraryList, "Carregando…");
            try {
                const res = await loadLibraryView(view);
                let items = (res && res.Items) || [];
                // Mix: a lista mostrada é exatamente a fila que vai tocar.
                if (view.type === "mix") items = uniqueTracks(items.filter(isAudioItem), { byKey: true });
                noteFavorites(items);
                data = { items, total: (res && res.TotalRecordCount) || items.length };
            } catch (err) {
                if (token === libToken) libraryError(err);
                return;
            }
            if (isHome) libHomeCache[view.tab] = data;
            else view.data = data;
        }
        if (token !== libToken) return;

        drawLibraryView(view, data);
        libraryBody.scrollTop = view.scroll || 0;
        if (view.autoplay) {
            view.autoplay = false;
            playQueue(data.items);
        }
    }

    async function loadMoreLibrary() {
        const view = libStack[libStack.length - 1];
        if (!view || view.type !== "home") return;
        const data = libHomeCache[view.tab];
        if (!data) return;
        libraryMoreButton.disabled = true;
        try {
            const res = await loadLibraryView(view, data.items.length);
            noteFavorites((res && res.Items) || []);
            data.items = data.items.concat((res && res.Items) || []);
            data.total = (res && res.TotalRecordCount) || data.total;
            const keep = libraryBody.scrollTop;
            drawLibraryView(view, data);
            libraryBody.scrollTop = keep;
        } catch (err) {
            showToast(err.message || "Erro ao carregar.", 4000);
        } finally {
            libraryMoreButton.disabled = false;
        }
    }

    function libraryButton(label, onClick, variant = "secondary") {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn--sm btn--" + variant;
        b.textContent = label;
        b.addEventListener("click", onClick);
        return b;
    }

    function formatDuration(ticks) {
        if (!ticks) return "";
        const s = Math.round(ticks / 1e7);
        return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }

    // Linha de lista no mesmo visual das rádios (.station-item), pra que o
    // destaque de "tocando agora" (markPlayingItems) funcione igual.
    function buildLibraryRow({ uuid, title, subtitle, art, placeholder = "🎵", onClick, action }) {
        const item = document.createElement("div");
        item.className = "station-item";
        if (uuid) item.dataset.stationuuid = uuid;

        const main = document.createElement("button");
        main.type = "button";
        main.className = "station-main";

        const ph = () => {
            const s = document.createElement("span");
            s.className = "station-favicon-ph" + (/^\d+$/.test(placeholder) ? " is-number" : "");
            s.textContent = placeholder;
            return s;
        };
        let artEl;
        if (art) {
            artEl = document.createElement("img");
            artEl.className = "station-favicon";
            artEl.alt = "";
            artEl.loading = "lazy";
            artEl.src = art;
            artEl.addEventListener("error", () => artEl.replaceWith(ph()));
        } else {
            artEl = ph();
        }

        const text = document.createElement("div");
        text.className = "station-text";
        const nm = document.createElement("span");
        nm.className = "station-name";
        nm.textContent = title || "Sem título";
        const dt = document.createElement("span");
        dt.className = "station-details";
        dt.textContent = subtitle || "";
        text.append(nm, dt);

        main.append(artEl, text);
        main.addEventListener("click", onClick);
        item.appendChild(main);

        if (action) {
            const actions = document.createElement("div");
            actions.className = "station-actions";
            const b = iconButton(action.glyph, action.title, action.favId ? "fav-btn" : "", action.onClick);
            if (action.favId) {
                b.dataset.favId = action.favId;
                setFavGlyph(b, !!favState.get(action.favId));
            }
            actions.appendChild(b);
            item.appendChild(actions);
        }
        return item;
    }

    function openLibraryItem(item) {
        const kind = { MusicAlbum: "album", Playlist: "playlist", MusicArtist: "artist" }[item.Type];
        if (kind) libraryPush({ type: kind, item, title: item.Name || "Sem título" });
    }

    // Toca um álbum/playlist direto da lista, sem abrir.
    async function quickPlay(item) {
        try {
            const res =
                item.Type === "Playlist"
                    ? await window.Jellyfin.playlistTracks(item.Id)
                    : await window.Jellyfin.albumTracks(item.Id);
            playQueue((res && res.Items) || []);
        } catch (err) {
            showToast(err.message || "Erro ao carregar.", 4000);
        }
    }

    // Mix parecido / do artista: abre a lista montada e já começa a tocar.
    function openMix(item) {
        libraryPush({ type: "mix", item, title: "Mix: " + (item.Name || "Sem título"), autoplay: true });
    }

    function itemSubtitle(item) {
        switch (item.Type) {
            case "MusicAlbum":
                return [item.AlbumArtist, item.ProductionYear].filter(Boolean).join(" · ") || "Álbum";
            case "Playlist":
                return "Playlist";
            case "MusicArtist":
                return "Artista";
            case "Audio":
                return [item.AlbumArtist || (item.Artists || []).join(", "), formatDuration(item.RunTimeTicks)]
                    .filter(Boolean)
                    .join(" · ");
        }
        return "";
    }

    function drawLibraryView(view, data) {
        const J = window.Jellyfin;
        const items = data.items;
        const tracks = items.filter((i) => i.Type === "Audio");

        // Ações do topo nas telas de detalhe.
        if (view.type === "album" || view.type === "playlist") {
            libraryActions.append(
                libraryButton("▶ Tocar", () => playQueue(tracks), "primary"),
                libraryButton("🔀 Aleatório", () => playQueue(tracks, 0, { shuffle: true })),
                libraryButton("🎲 Mix parecido", () => openMix(view.item))
            );
            libraryActions.hidden = false;
        } else if (view.type === "artist") {
            libraryActions.append(libraryButton("🎲 Mix do artista", () => openMix(view.item), "primary"));
            libraryActions.hidden = false;
        } else if ((view.type === "mix" || (view.type === "home" && view.tab === "favorites")) && tracks.length) {
            libraryActions.append(
                libraryButton("▶ Tocar", () => playQueue(tracks), "primary"),
                libraryButton("🔀 Aleatório", () => playQueue(tracks, 0, { shuffle: true }))
            );
            libraryActions.hidden = false;
        }

        if (!items.length) {
            const msg =
                view.type === "search"
                    ? "Nada encontrado para essa busca."
                    : view.type === "home" && view.tab === "favorites"
                      ? "Nenhuma música favorita ainda. Toque no ♡ de uma música para adicionar."
                      : view.type === "home"
                        ? `Nenhum item em ${LIB_TABS[view.tab].label.toLowerCase()}.`
                      : "Vazio.";
            emptyState(libraryList, msg);
            return;
        }

        libraryList.innerHTML = "";
        const frag = document.createDocumentFragment();
        items.forEach((item) => {
            if (item.Type === "Audio") {
                const idx = tracks.indexOf(item);
                const num = view.type === "album" && item.IndexNumber ? String(item.IndexNumber) : "🎵";
                frag.appendChild(
                    buildLibraryRow({
                        uuid: "jf-" + item.Id,
                        title: item.Name,
                        subtitle: itemSubtitle(item),
                        art: view.type === "album" ? "" : J.imageUrl(item, 96),
                        placeholder: num,
                        onClick: () => playQueue(tracks, idx),
                        action: { glyph: "♡", title: "Favoritar", favId: item.Id, onClick: () => toggleFavorite(item.Id) }
                    })
                );
                return;
            }
            const playable = item.Type === "MusicAlbum" || item.Type === "Playlist";
            frag.appendChild(
                buildLibraryRow({
                    title: item.Name,
                    subtitle: itemSubtitle(item),
                    art: J.imageUrl(item, 96),
                    placeholder: item.Type === "MusicArtist" ? "🎤" : item.Type === "Playlist" ? "📃" : "💿",
                    onClick: () => openLibraryItem(item),
                    action: playable ? { glyph: "▶", title: "Tocar", onClick: () => quickPlay(item) } : null
                })
            );
        });
        libraryList.appendChild(frag);
        libraryMoreButton.hidden = !(view.type === "home" && items.length < data.total);
        markPlayingItems();
    }

    function searchLibrary() {
        const term = librarySearchInput.value.trim();
        if (!term) return;
        librarySearchInput.blur();
        libraryPush({ type: "search", term, title: `Busca: ${term}` });
    }

    // ============================================================
    // Minha biblioteca — conexão (Configurações)
    // ============================================================
    function renderJellyfinSetting() {
        const J = window.Jellyfin;
        const connected = !!J && J.isConfigured();
        libraryOpenButton.hidden = !connected;
        jellyfinSetting.innerHTML = "";
        if (!J) return;

        const p = document.createElement("p");
        if (!connected) {
            p.textContent = "Ouça as músicas do seu servidor Jellyfin aqui no app, junto com as rádios.";
            jellyfinSetting.append(p, libraryButton("Conectar servidor", openJellyfinLogin, "ghost"));
            return;
        }

        let host = J.server;
        try {
            host = new URL(J.server).host;
        } catch (_) {}
        p.textContent = `Conectado como ${J.userName} em ${host}.`;

        const chips = document.createElement("div");
        chips.className = "chips";
        chips.setAttribute("role", "group");
        chips.setAttribute("aria-label", "Qualidade do áudio");
        [
            ["original", "Qualidade original"],
            ["data", "Economizar dados"]
        ].forEach(([q, label]) => {
            const c = document.createElement("button");
            c.type = "button";
            c.className = "chip" + (J.quality === q ? " is-active" : "");
            c.textContent = label;
            c.addEventListener("click", () => {
                J.setQuality(q);
                renderJellyfinSetting();
                showToast(q === "data" ? "MP3 192 kbps a partir da próxima faixa." : "Arquivo original a partir da próxima faixa.");
            });
            chips.appendChild(c);
        });

        const disconnect = libraryButton(
            "Desconectar",
            async () => {
                const ok = await confirmDialog("Desconectar do Jellyfin? O botão 🎵 some até você conectar de novo.", {
                    title: "Minha biblioteca",
                    okLabel: "Desconectar",
                    danger: true
                });
                if (!ok) return;
                if (isTrack(currentStation)) stopStream();
                queue = { items: [], index: -1 };
                Object.keys(libHomeCache).forEach((k) => delete libHomeCache[k]);
                await J.logout();
                renderJellyfinSetting();
                showToast("Jellyfin desconectado.");
            },
            "ghost"
        );
        jellyfinSetting.append(p, chips, disconnect);
    }

    function modalField(label, input) {
        const l = document.createElement("label");
        l.className = "modal__field";
        const s = document.createElement("span");
        s.textContent = label;
        l.append(s, input);
        return l;
    }

    function modalInput(type, value, placeholder, autocomplete) {
        const i = document.createElement("input");
        i.className = "input";
        i.type = type;
        i.value = value || "";
        i.placeholder = placeholder || "";
        if (autocomplete) i.autocomplete = autocomplete;
        i.autocapitalize = "off";
        i.spellcheck = false;
        return i;
    }

    function openJellyfinLogin() {
        const J = window.Jellyfin;
        const wrap = document.createElement("div");
        const intro = document.createElement("p");
        intro.style.margin = "0";
        intro.textContent =
            "Use o endereço https do Tailscale Serve (o celular precisa estar com o Tailscale ligado). A senha não fica salva — só a sessão.";

        const server = modalInput("url", J.server, "https://servidor.tailnet.ts.net", "url");
        server.inputMode = "url";
        const user = modalInput("text", J.userName, "", "username");
        const pass = modalInput("password", "", "", "current-password");

        const error = document.createElement("p");
        error.className = "modal__error";
        error.hidden = true;

        wrap.append(
            intro,
            modalField("Endereço do servidor", server),
            modalField("Usuário", user),
            modalField("Senha", pass),
            error
        );

        let busy = false;
        const submit = async (close) => {
            if (busy) return;
            if (!server.value.trim() || !user.value.trim()) {
                error.textContent = "Preencha o endereço e o usuário.";
                error.hidden = false;
                return;
            }
            busy = true;
            error.hidden = true;
            const btn = modal.actionsEl.lastElementChild;
            btn.disabled = true;
            btn.textContent = "Conectando…";
            try {
                await J.login({
                    server: server.value,
                    username: user.value.trim(),
                    password: pass.value
                });
                close("__done__");
                Object.keys(libHomeCache).forEach((k) => delete libHomeCache[k]);
                renderJellyfinSetting();
                showToast(`Conectado! Toque no 🎵 lá em cima para abrir sua biblioteca.`, 4500);
            } catch (err) {
                error.textContent = err.message || "Não foi possível conectar.";
                error.hidden = false;
                btn.disabled = false;
                btn.textContent = "Conectar";
            } finally {
                busy = false;
            }
        };

        const modal = buildModal({
            title: "Conectar ao Jellyfin",
            body: wrap,
            actions: [
                { label: "Cancelar", variant: "ghost", value: null },
                { label: "Conectar", variant: "primary", onClick: submit }
            ]
        });
        [server, user, pass].forEach((i) =>
            i.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    submit(modal.close);
                }
            })
        );
        setTimeout(() => (server.value ? (user.value ? pass : user) : server).focus(), 40);
    }

    // ============================================================
    // Recentes
    // ============================================================
    function loadRecents() {
        try {
            recents = JSON.parse(localStorage.getItem(LS.recents)) || [];
        } catch (_) {
            recents = [];
        }
        if (!Array.isArray(recents)) recents = [];
    }

    function recordRecent(station) {
        if (!station || !station.stationuuid) return;
        const entry = {
            stationuuid: station.stationuuid,
            name: station.name,
            url_resolved: station.url_resolved,
            url: station.url || "",
            favicon: station.favicon || "",
            country: station.country || "",
            codec: station.codec || "",
            bitrate: station.bitrate || "",
            playedAt: Date.now()
        };
        recents = recents.filter((r) => r.stationuuid !== station.stationuuid);
        recents.unshift(entry);
        recents = recents.slice(0, 25);
        try {
            localStorage.setItem(LS.recents, JSON.stringify(recents));
        } catch (_) {}
        renderRecents();
    }

    // ============================================================
    // Sleep timer
    // ============================================================
    function setSleepTimer(minutes) {
        cancelSleepTimer(true);
        sleepChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", Number(c.dataset.min) === minutes));
        if (!minutes) {
            sleepStatus.textContent = "";
            return;
        }
        sleepState.minutes = minutes;
        sleepState.deadline = Date.now() + minutes * 60000;
        sleepState.tickId = setInterval(updateSleepStatus, 1000);
        updateSleepStatus();
        showToast(`Sleep timer: desliga em ${minutes} min.`);
    }

    function updateSleepStatus() {
        const left = sleepState.deadline - Date.now();
        if (left <= 0) {
            triggerSleep();
            return;
        }
        const m = Math.floor(left / 60000);
        const s = Math.floor((left % 60000) / 1000);
        sleepStatus.textContent = `⏱️ ${m}:${String(s).padStart(2, "0")}`;
    }

    function triggerSleep() {
        clearInterval(sleepState.tickId);
        sleepState.tickId = 0;
        sleepStatus.textContent = "";

        const startVol = audioPlayer.volume;
        const steps = 20;
        let n = 0;
        sleepState.fadeId = setInterval(() => {
            n++;
            audioPlayer.volume = Math.max(0, startVol * (1 - n / steps));
            if (n >= steps) {
                clearInterval(sleepState.fadeId);
                sleepState.fadeId = 0;
                stopStream();
                audioPlayer.volume = startVol;
                isMuted = false;
                updateVolumeUI();
                showToast("Sleep timer: rádio desligada. 😴", 4000);
            }
        }, 200);

        sleepChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", Number(c.dataset.min) === 0));
    }

    function cancelSleepTimer(silent) {
        if (sleepState.tickId) clearInterval(sleepState.tickId);
        if (sleepState.fadeId) clearInterval(sleepState.fadeId);
        sleepState = { deadline: 0, tickId: 0, fadeId: 0, minutes: 0 };
        if (sleepStatus) sleepStatus.textContent = "";
        if (!silent && sleepChips) {
            sleepChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", Number(c.dataset.min) === 0));
        }
    }

    // ============================================================
    // Volume
    // ============================================================
    function updateVolumeUI() {
        const v = Math.round(audioPlayer.volume * 100);
        volumeDisplay.textContent = v + "%";
        volumeControl.value = String(audioPlayer.volume);
        muteButton.textContent = v === 0 || isMuted ? "🔇" : v < 50 ? "🔉" : "🔊";
    }

    function changeVolume(delta) {
        audioPlayer.volume = Math.min(1, Math.max(0, audioPlayer.volume + delta));
        isMuted = audioPlayer.volume === 0;
        updateVolumeUI();
    }

    // ============================================================
    // Estatísticas / Top
    // ============================================================
    async function showAnalytics(type) {
        currentAnalyticsTab = type;
        clicksTab.classList.toggle("is-active", type === "clicks");
        timeTab.classList.toggle("is-active", type === "time");
        if (!window.radioData) {
            emptyState(analyticsResults, "Estatísticas indisponíveis.");
            return;
        }
        try {
            const data =
                type === "clicks"
                    ? await window.radioData.getTopByClicks(15)
                    : await window.radioData.getTopByTime(15);
            if (!data.length) {
                emptyState(analyticsResults, "Sem dados ainda. Ouça algumas rádios!");
                return;
            }
            analyticsResults.innerHTML = "";
            data.forEach((s, i) => {
                const row = document.createElement("div");
                row.className = "analytics-item";
                const rank = document.createElement("span");
                rank.className = "analytics-rank";
                rank.textContent = i + 1 + ".";
                const nm = document.createElement("span");
                nm.className = "analytics-station-name";
                nm.textContent = s.name;
                const st = document.createElement("span");
                st.className = "analytics-stats";
                st.textContent =
                    type === "clicks" ? `${s.clicks} clicks` : window.radioData.formatTime(s.totalTime || 0);
                row.append(rank, nm, st);
                analyticsResults.appendChild(row);
            });
        } catch (_) {
            emptyState(analyticsResults, "Erro ao carregar estatísticas.");
        }
    }

    async function updateTopRadios() {
        if (!window.radioData || !topRadiosButtons) return;
        try {
            const top = await window.radioData.getTopByTime(8);
            if (!top.length) {
                emptyState(topRadiosButtons, "Nenhuma rádio ouvida ainda.");
                return;
            }
            topRadiosButtons.innerHTML = "";
            top.forEach((r, i) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "top-radio-btn";
                b.textContent = `${i + 1}. ${r.name.length > 22 ? r.name.slice(0, 22) + "…" : r.name}`;
                b.title = `${r.name} · ${window.radioData.formatTime(r.totalTime || 0)}`;
                b.addEventListener("click", () =>
                    playStream({
                        stationuuid: r.stationId,
                        name: r.name,
                        url_resolved: r.url,
                        favicon: "",
                        country: "",
                        codec: "",
                        bitrate: ""
                    })
                );
                topRadiosButtons.appendChild(b);
            });
        } catch (_) {
            emptyState(topRadiosButtons, "Erro ao carregar.");
        }
    }

    // ============================================================
    // Tema / cor
    // ============================================================
    function applyTheme(theme) {
        const dark = theme === "dark";
        document.body.classList.toggle("dark-theme", dark);
        themeToggleButton.textContent = dark ? "☀️" : "🌙";
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", dark ? "#0b1220" : "#0f172a");
    }
    function toggleTheme() {
        const next = document.body.classList.contains("dark-theme") ? "light" : "dark";
        applyTheme(next);
        try {
            localStorage.setItem(LS.theme, next);
        } catch (_) {}
    }
    function initTheme() {
        let saved = null;
        try {
            saved = localStorage.getItem(LS.theme);
        } catch (_) {}
        const prefersDark = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
        applyTheme(saved || (prefersDark ? "dark" : "light"));
        if (window.matchMedia) {
            matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
                let s = null;
                try {
                    s = localStorage.getItem(LS.theme);
                } catch (_) {}
                if (!s) applyTheme(e.matches ? "dark" : "light");
            });
        }
    }

    function applyTitleColor(color) {
        ["blue", "green", "purple", "red", "orange"].forEach((x) =>
            document.body.classList.toggle("title-color-" + x, x === color)
        );
        titleColorChips.querySelectorAll(".chip").forEach((ch) =>
            ch.classList.toggle("is-active", ch.dataset.color === color)
        );
    }
    function initTitleColor() {
        let c = "default";
        try {
            c = localStorage.getItem(LS.color) || "default";
        } catch (_) {}
        applyTitleColor(c);
    }

    // ============================================================
    // Sheet de configurações
    // ============================================================
    function openSheet(sheet) {
        sheet.hidden = false;
        document.body.style.overflow = "hidden";
    }
    function closeSheet(sheet) {
        sheet.hidden = true;
        document.body.style.overflow = "";
    }

    // ============================================================
    // PWA
    // ============================================================
    function registerServiceWorker() {
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("SW falhou:", err));
            });
        }
    }

    // ============================================================
    // Eventos
    // ============================================================
    function wireEvents() {
        searchOpenButton.addEventListener("click", openSearch);
        searchCloseButton.addEventListener("click", () => closeSearch());
        window.addEventListener("popstate", (e) => {
            const st = e.state;
            if (!libraryScreen.hidden && st && st.overlay === "library") {
                libraryGoTo(st.depth);
                return;
            }
            closeSearch(true);
            exitCarMode(true);
            closeLibrary(true);
        });

        // Minha biblioteca
        libraryOpenButton.addEventListener("click", openLibrary);
        libraryBackButton.addEventListener("click", () => history.back());
        librarySearchButton.addEventListener("click", searchLibrary);
        librarySearchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") searchLibrary();
        });
        libraryTabs.addEventListener("click", (e) => {
            const tab = e.target.closest(".tab");
            const view = libStack[0];
            if (!tab || !view || view.tab === tab.dataset.tab) return;
            view.tab = tab.dataset.tab;
            view.scroll = 0;
            renderLibraryView();
        });
        libraryShuffleAllButton.addEventListener("click", shuffleAll);
        libraryMoreButton.addEventListener("click", loadMoreLibrary);
        queuePrevButton.addEventListener("click", queuePrev);
        queueStopButton.addEventListener("click", () => stopStream());
        searchButton.addEventListener("click", searchStations);
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") searchStations();
        });
        toggleFiltersButton.addEventListener("click", () =>
            setFiltersOpen(searchFilters.classList.contains("hidden-section"))
        );
        [filterCountry, filterTag, filterLanguage].forEach((f) => f && f.addEventListener("change", persistFilters));
        clearFiltersButton.addEventListener("click", () => {
            filterCountry.value = "";
            filterTag.value = "";
            filterLanguage.value = "";
            persistFilters();
            showToast("Filtros limpos.");
        });

        manualAddButton.addEventListener("click", () => {
            const name = manualName.value.trim();
            const url = manualUrl.value.trim();
            if (!name || !url) {
                showToast("Preencha nome e URL.");
                return;
            }
            if (!isValidHttpUrl(url)) {
                showToast("URL inválida. Use http:// ou https://");
                return;
            }
            const station = {
                stationuuid: "manual-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
                name,
                url_resolved: url,
                favicon: "",
                country: "",
                codec: "",
                bitrate: ""
            };
            playStream(station);
            addToFavorites(station);
            manualName.value = "";
            manualUrl.value = "";
        });

        manageCategoriesButton.addEventListener("click", openCategoryManager);

        exportFavoritesButton.addEventListener("click", () => {
            if (!Object.keys(favorites).length) {
                showToast("Nada para exportar.");
                return;
            }
            downloadJson(favorites, "radio_favoritos.json");
            showToast("Favoritos exportados.");
        });
        importFavoritesButton.addEventListener("click", () => importFile.click());
        importFile.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const data = JSON.parse(reader.result);
                    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Formato inválido.");
                    if (Object.keys(favorites).length) {
                        const ok = await confirmDialog("Isso substitui seus favoritos atuais. Continuar?", {
                            title: "Importar favoritos",
                            okLabel: "Substituir",
                            danger: true
                        });
                        if (!ok) {
                            importFile.value = "";
                            return;
                        }
                    }
                    favorites = data;
                    persistFavorites();
                    renderFavorites();
                    showToast("Favoritos importados.");
                } catch (err) {
                    showToast("Erro ao importar: " + err.message, 4000);
                } finally {
                    importFile.value = "";
                }
            };
            reader.onerror = () => {
                showToast("Erro ao ler o arquivo.");
                importFile.value = "";
            };
            reader.readAsText(file);
        });

        clearRecentsButton.addEventListener("click", async () => {
            if (!recents.length) return;
            const ok = await confirmDialog("Limpar o histórico de rádios recentes?", {
                title: "Limpar histórico",
                okLabel: "Limpar",
                danger: true
            });
            if (!ok) return;
            recents = [];
            try {
                localStorage.removeItem(LS.recents);
            } catch (_) {}
            renderRecents();
        });

        // Player
        playButton.addEventListener("click", () => {
            if (!currentStation) {
                showToast("Selecione uma rádio para tocar.");
                return;
            }
            if (isTrack(currentStation)) {
                toggleTrackPause();
                return;
            }
            if (
                currentStation.url_resolved.includes(".m3u8") &&
                !currentHls &&
                window.Hls &&
                Hls.isSupported()
            ) {
                playStream(currentStation);
                return;
            }
            audioPlayer
                .play()
                .then(() => {
                    setPlayerState("playing");
                    updatePlayButtons(true);
                    markPlayingItems();
                    if (window.radioData) window.radioData.startListeningSession(currentStation);
                    if (window.RadioWakeLock) window.RadioWakeLock.request();
                })
                .catch((err) => handlePlayError(currentStation, err));
        });
        stopButton.addEventListener("click", () => (isTrack(currentStation) ? queueStep(1) : stopStream()));

        // Modo Carro
        carModeButton.addEventListener("click", enterCarMode);
        carExitButton.addEventListener("click", () => exitCarMode());
        carModeScreen.addEventListener("click", requestCarFullscreen);
        carPlayButton.addEventListener("click", () => {
            if (isTrack(currentStation)) {
                toggleTrackPause();
                return;
            }
            const state = playerBar.dataset.state;
            if (state === "playing" || state === "loading") stopStream();
            else if (currentStation) playStream(currentStation);
        });
        carPrevButton.addEventListener("click", () => (isTrack(currentStation) ? queuePrev() : carStep(-1)));
        carNextButton.addEventListener("click", () => (isTrack(currentStation) ? queueStep(1) : carStep(1)));
        carArt.addEventListener("error", () => {
            carArt.hidden = true;
        });
        document.addEventListener("keydown", (e) => {
            if (e.key !== "Escape") return;
            if (carModeScreen && !carModeScreen.hidden) exitCarMode();
            else if (!searchScreen.hidden && settingsSheet.hidden) closeSearch();
            else if (!libraryScreen.hidden && settingsSheet.hidden && !modalRoot.children.length) history.back();
        });

        trackFavButton.addEventListener("click", () => isTrack(currentStation) && toggleFavorite(currentStation.itemId));
        carFavButton.addEventListener("click", () => isTrack(currentStation) && toggleFavorite(currentStation.itemId));
        wireSeek(trackSeek, trackElapsed);
        wireSeek(carSeek, carElapsed);
        watchPlayerHeight();

        playerExpandButton.addEventListener("click", () => {
            const nowHidden = playerPanel.classList.toggle("hidden-section");
            playerExpandButton.setAttribute("aria-expanded", String(!nowHidden));
        });

        audioPlayer.addEventListener("playing", () => {
            if (!currentStation) return;
            setPlayerState("playing");
            updatePlayButtons(true);
            markPlayingItems();
            if (window.RadioWakeLock) window.RadioWakeLock.request();
        });
        audioPlayer.addEventListener("waiting", () => {
            if (currentStation && playerBar.dataset.state === "playing") setPlayerState("loading");
        });
        // Pausa de faixa da biblioteca, venha de onde vier (botão, notificação,
        // fone desconectado). A pausa que o próprio stopStream faz ao trocar
        // de faixa chega aqui com o <audio> já tocando a próxima — ignorada.
        audioPlayer.addEventListener("pause", () => {
            if (!isTrack(currentStation) || !audioPlayer.paused || audioPlayer.ended) return;
            setPlayerState("paused");
            updatePlayButtons(false);
            if (window.RadioWakeLock) window.RadioWakeLock.release();
        });
        audioPlayer.addEventListener("timeupdate", updateTrackProgress);
        audioPlayer.addEventListener("ended", () => (isTrack(currentStation) ? onTrackEnded() : stopStream()));
        audioPlayer.addEventListener("error", () => {
            if (currentStation && !currentHls && !streamSettling) handlePlayError(currentStation, new Error("audio"));
        });
        audioPlayer.addEventListener("volumechange", () => {
            try {
                localStorage.setItem(LS.volume, String(audioPlayer.volume));
            } catch (_) {}
        });

        volumeControl.addEventListener("input", () => {
            audioPlayer.volume = parseFloat(volumeControl.value);
            isMuted = audioPlayer.volume === 0;
            updateVolumeUI();
        });
        muteButton.addEventListener("click", () => {
            if (isMuted || audioPlayer.volume === 0) {
                audioPlayer.volume = lastVolume || 1;
                isMuted = false;
            } else {
                lastVolume = audioPlayer.volume;
                audioPlayer.volume = 0;
                isMuted = true;
            }
            updateVolumeUI();
        });
        volumeUp.addEventListener("click", () => changeVolume(0.1));
        volumeDown.addEventListener("click", () => changeVolume(-0.1));

        sleepChips.addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (!chip) return;
            const min = Number(chip.dataset.min);
            if (min && !currentStation) {
                showToast("Toque uma rádio antes de definir o timer.");
                return;
            }
            setSleepTimer(min);
        });

        // Estatísticas
        clicksTab.addEventListener("click", () => showAnalytics("clicks"));
        timeTab.addEventListener("click", () => showAnalytics("time"));
        exportAnalyticsButton.addEventListener("click", async () => {
            if (!window.radioData) return;
            try {
                downloadJson(await window.radioData.exportData(), "radio_estatisticas.json");
                showToast("Estatísticas exportadas.");
            } catch (_) {
                showToast("Erro ao exportar.");
            }
        });
        clearAnalyticsButton.addEventListener("click", async () => {
            if (!window.radioData) return;
            const ok = await confirmDialog("Apagar todas as estatísticas de uso?", {
                title: "Limpar dados",
                okLabel: "Apagar",
                danger: true
            });
            if (!ok) return;
            try {
                await window.radioData.clearAllData();
                showAnalytics(currentAnalyticsTab);
                updateTopRadios();
                showToast("Estatísticas apagadas.");
            } catch (_) {
                showToast("Erro ao limpar.");
            }
        });

        // Seções sanfonadas
        document.querySelectorAll(".card__toggle").forEach((btn) => {
            const target = document.getElementById(btn.dataset.target);
            if (!target) return;
            btn.addEventListener("click", () => {
                const hidden = target.classList.toggle("hidden-section");
                btn.setAttribute("aria-expanded", String(!hidden));
                if (!hidden && btn.dataset.target === "analyticsContent") showAnalytics(currentAnalyticsTab);
                if (!hidden && btn.dataset.target === "recentsContent") renderRecents();
            });
        });

        // Tema / cor / configurações
        themeToggleButton.addEventListener("click", toggleTheme);
        if (themeToggleButton2) themeToggleButton2.addEventListener("click", toggleTheme);
        titleColorChips.addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (!chip) return;
            applyTitleColor(chip.dataset.color);
            try {
                localStorage.setItem(LS.color, chip.dataset.color);
            } catch (_) {}
        });
        settingsButton.addEventListener("click", () => openSheet(settingsSheet));
        settingsSheet.querySelectorAll("[data-close-sheet]").forEach((el) =>
            el.addEventListener("click", () => closeSheet(settingsSheet))
        );
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !settingsSheet.hidden) closeSheet(settingsSheet);
        });

        // Atalho: barra de espaço = play/stop
        document.addEventListener("keydown", (e) => {
            if (e.code !== "Space") return;
            const tag = (document.activeElement && document.activeElement.tagName) || "";
            if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(tag)) return;
            if (!currentStation) return;
            e.preventDefault();
            if (playerBar.dataset.state === "playing" && !isTrack(currentStation)) stopStream();
            else playButton.click();
        });

        // Instalação PWA
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installInstructions.hidden = false;
        });
        installAppButton.addEventListener("click", async () => {
            if (!deferredPrompt) return;
            installInstructions.hidden = true;
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
        });
        window.addEventListener("appinstalled", () => {
            installInstructions.hidden = true;
            deferredPrompt = null;
        });
    }

    // ============================================================
    // Init
    // ============================================================
    function init() {
        loadFavorites();
        loadRecents();
        initTheme();
        initTitleColor();
        restoreFilters();

        try {
            const v = parseFloat(localStorage.getItem(LS.volume));
            if (!isNaN(v)) audioPlayer.volume = Math.min(1, Math.max(0, v));
        } catch (_) {}

        wireEvents();
        wireMediaSession();
        renderJellyfinSetting();
        renderFavorites();
        renderRecents();
        updateVolumeUI();
        updatePlayButtons(false);
        emptyState(topRadiosButtons, "Nenhuma rádio ouvida ainda.");
        registerServiceWorker();

        // Aguarda o IndexedDB de estatísticas ficar pronto (radioData.js)
        let tries = 0;
        const waitStats = setInterval(() => {
            tries++;
            if (window.radioData && window.radioData.db) {
                clearInterval(waitStats);
                showAnalytics("clicks");
                updateTopRadios();
            } else if (tries > 25) {
                clearInterval(waitStats);
            }
        }, 400);
        setInterval(() => {
            if (window.radioData && window.radioData.db) updateTopRadios();
        }, 60000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
