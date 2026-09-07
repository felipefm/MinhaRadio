/**
 * Screen Wake Lock — mantém a tela ligada ENQUANTO uma rádio está tocando.
 * v3.0: o lock só é solicitado pelo player (request/release), não mais no load.
 * Exposto em window.RadioWakeLock.
 */
(function () {
    "use strict";

    let wakeLock = null;
    let wanted = false;

    async function request() {
        wanted = true;
        if (!("wakeLock" in navigator) || wakeLock) return;
        try {
            wakeLock = await navigator.wakeLock.request("screen");
            wakeLock.addEventListener("release", () => {
                wakeLock = null;
            });
        } catch (err) {
            wakeLock = null;
            console.warn("Wake Lock indisponível:", err && err.message);
        }
    }

    function release() {
        wanted = false;
        if (wakeLock) {
            wakeLock.release().catch(() => {});
            wakeLock = null;
        }
    }

    // Reobtém o lock ao voltar para a aba, se ainda estivermos tocando.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && wanted && !wakeLock) request();
    });

    window.RadioWakeLock = { request, release };
})();
