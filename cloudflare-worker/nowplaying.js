/* ============================================================
   Rádio Player Online — Worker "nowplaying"
   ============================================================
   Lê o metadado ICY (StreamTitle/StreamUrl) que o Shoutcast/Icecast
   intercala no meio do áudio bruto do stream. O navegador não tem como
   ler isso de um <audio>, então esse Worker faz a leitura por fora e
   devolve só o resultado em JSON: { artist, title, art }.

   Deploy (dashboard do Cloudflare):
   1. Workers & Pages → Create application → Create Worker.
   2. Cole todo este arquivo como o código do Worker e publique.
   3. Ajuste ALLOWED_ORIGINS abaixo para o(s) domínio(s) reais do app.
   4. Copie a URL do Worker (ex.: https://nowplaying.SEUSUBDOMINIO.workers.dev)
      e cole em NOWPLAYING_WORKER_URL no topo do app.js.

   Uso: GET <worker>/?url=<stream_url_codificada>
   ============================================================ */

const ALLOWED_ORIGINS = [
    "https://radio.felipefm.com",
    "http://localhost:8099"
];

const MAX_METAINT = 512 * 1024; // limite de segurança (bytes de áudio antes do 1º metadado)
const FETCH_TIMEOUT_MS = 8000;

function corsHeaders(origin) {
    const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": allow,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin"
    };
}

function json(data, status, origin) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
    });
}

async function readIcyMetadata(streamUrl, signal) {
    const upstream = await fetch(streamUrl, {
        headers: {
            "Icy-MetaData": "1",
            "User-Agent": "Mozilla/5.0 (compatible; RadioPlayerNowPlaying/1.0)"
        },
        signal
    });

    const metaint = parseInt(upstream.headers.get("icy-metaint") || "", 10);
    if (!metaint || metaint > MAX_METAINT || !upstream.body) {
        if (upstream.body) upstream.body.cancel().catch(() => {});
        return { title: null };
    }

    const reader = upstream.body.getReader();
    let buf = new Uint8Array(0);
    const append = (chunk) => {
        const next = new Uint8Array(buf.length + chunk.length);
        next.set(buf, 0);
        next.set(chunk, buf.length);
        buf = next;
    };

    // Lê bytes de áudio até passar do limite onde o bloco de metadado começa.
    while (buf.length <= metaint) {
        const { value, done } = await reader.read();
        if (done) {
            reader.cancel().catch(() => {});
            return { title: null };
        }
        append(value);
    }

    const lenByte = buf[metaint];
    const metaLen = lenByte * 16;
    const metaStart = metaint + 1;

    if (metaLen > 0) {
        while (buf.length < metaStart + metaLen) {
            const { value, done } = await reader.read();
            if (done) break;
            append(value);
        }
    }

    reader.cancel().catch(() => {});

    const text = new TextDecoder("utf-8").decode(buf.slice(metaStart, metaStart + metaLen));
    const titleMatch = /StreamTitle='([^']*)'/.exec(text);
    const urlMatch = /StreamUrl='([^']*)'/.exec(text);
    const raw = titleMatch ? titleMatch[1].trim() : "";
    const art = urlMatch && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(urlMatch[1]) ? urlMatch[1] : null;

    if (!raw) return { title: null, art };

    let artist = "";
    let title = raw;
    const parts = raw.split(" - ");
    if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
    }
    return { artist: artist || null, title: title || null, raw, art };
}

export default {
    async fetch(request) {
        const origin = request.headers.get("Origin") || "";

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }
        if (request.method !== "GET") {
            return json({ error: "método não suportado" }, 405, origin);
        }

        const reqUrl = new URL(request.url);
        const stream = reqUrl.searchParams.get("url");
        if (!stream || !/^https?:\/\//i.test(stream)) {
            return json({ error: "parâmetro 'url' ausente ou inválido" }, 400, origin);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const data = await readIcyMetadata(stream, controller.signal);
            return json(data, 200, origin);
        } catch (err) {
            return json({ title: null, error: String((err && err.message) || err) }, 200, origin);
        } finally {
            clearTimeout(timeout);
        }
    }
};
