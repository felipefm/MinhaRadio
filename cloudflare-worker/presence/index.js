/* ============================================================
   Rádio Player Online — Worker "presence" (contador de ouvintes)
   ============================================================
   Recebe o sinal anônimo que o app manda enquanto toca (presence.js) e
   responde ao painel do dono com quem está ouvindo agora e quantos
   aparelhos usaram o player por dia.

   Estado num Durable Object só ("global"), tudo no armazenamento dele —
   a Cloudflare tira o objeto da memória quando fica parado (entre um
   sinal e outro, de 2 min), então nada pode depender só da memória:
   - ouvindo agora: chave "s:<id>", some 5 min depois do último sinal;
   - aparelhos por dia: "day:<data>" (ids aleatórios + "é do dono"), 60 dias.

   Rotas:
   POST /ping    { id, label, kind, device, mine }   (só do app)
   POST /bye     { id }                              (só do app)
   GET  /status  Authorization: Bearer <READ_TOKEN>  (painel do dono)

   Deploy (wrangler, nesta pasta):
     npx wrangler login
     npx wrangler deploy
     npx wrangler secret put READ_TOKEN     (invente uma chave longa)
   Depois cole a URL do Worker em PRESENCE_WORKER_URL no topo do app.js.
   ============================================================ */

const ALLOWED_ORIGINS = ["https://radio.felipefm.com", "http://localhost:8098", "http://127.0.0.1:8098"];
const ACTIVE_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 500;
const MAX_IDS_PER_DAY = 2000;
const KEEP_DAYS = 60;
const SHOW_DAYS = 14;

function corsHeaders(origin) {
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin"
    };
}

const clip = (v, n) => String(v == null ? "" : v).slice(0, n);

// Dia no fuso de Brasília (o "hoje" do dono).
function dayKey(ms) {
    return new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get("Origin") || "";
        const cors = corsHeaders(origin);
        const reply = (body, status = 200, extra = {}) => new Response(body, { status, headers: { ...cors, ...extra } });

        if (request.method === "OPTIONS") return reply(null, 204);

        const stub = env.PRESENCE.get(env.PRESENCE.idFromName("global"));

        if (request.method === "POST" && (url.pathname === "/ping" || url.pathname === "/bye")) {
            if (!ALLOWED_ORIGINS.includes(origin)) return reply("forbidden", 403);
            let body;
            try {
                body = JSON.parse(await request.text());
            } catch (_) {
                return reply("bad request", 400);
            }
            const id = clip(body && body.id, 40);
            if (!/^[a-z0-9]{8,40}$/i.test(id)) return reply("bad id", 400);
            const cf = request.cf || {};
            const event = {
                op: url.pathname.slice(1),
                id,
                label: clip(body.label, 80),
                kind: body.kind === "track" ? "track" : "radio",
                device: clip(body.device, 20),
                mine: !!body.mine,
                country: clip(cf.country, 4),
                city: clip(cf.city, 60)
            };
            await stub.fetch("https://presence/event", { method: "POST", body: JSON.stringify(event) });
            return reply(null, 204);
        }

        if (request.method === "GET" && url.pathname === "/status") {
            const auth = request.headers.get("Authorization") || "";
            if (!env.READ_TOKEN || auth !== "Bearer " + env.READ_TOKEN) return reply("unauthorized", 401);
            const res = await stub.fetch("https://presence/status");
            return reply(await res.text(), 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        }

        return reply("not found", 404);
    }
};

export class Presence {
    constructor(ctx) {
        this.ctx = ctx;
        this.day = null; // { key, ids: { id: mine } } — cache do dia atual
    }

    // Sessões ativas (lidas do armazenamento); apaga as vencidas.
    async activeSessions(now) {
        const all = await this.ctx.storage.list({ prefix: "s:" });
        const active = [];
        const stale = [];
        for (const [key, s] of all) {
            if (now - s.lastSeen > ACTIVE_MS) stale.push(key);
            else active.push(s);
        }
        if (stale.length) await this.ctx.storage.delete(stale);
        return active;
    }

    async countDay(id, mine, now) {
        const key = "day:" + dayKey(now);
        if (!this.day || this.day.key !== key) {
            this.day = { key, ids: (await this.ctx.storage.get(key)) || {} };
            await this.cleanupOldDays(now);
        }
        const ids = this.day.ids;
        if (ids[id] === mine) return;
        if (!(id in ids) && Object.keys(ids).length >= MAX_IDS_PER_DAY) return;
        ids[id] = mine;
        await this.ctx.storage.put(key, ids);
    }

    async cleanupOldDays(now) {
        const limit = dayKey(now - KEEP_DAYS * 86400000);
        const all = await this.ctx.storage.list({ prefix: "day:" });
        const old = [...all.keys()].filter((k) => k.slice(4) < limit);
        if (old.length) await this.ctx.storage.delete(old);
    }

    async fetch(request) {
        const url = new URL(request.url);
        const now = Date.now();

        if (url.pathname === "/event") {
            const e = await request.json();
            const key = "s:" + e.id;
            if (e.op === "bye") {
                await this.ctx.storage.delete(key);
                return new Response(null, { status: 204 });
            }
            const prev = await this.ctx.storage.get(key);
            if (!prev && (await this.activeSessions(now)).length >= MAX_SESSIONS) {
                return new Response(null, { status: 204 });
            }
            await this.ctx.storage.put(key, {
                id: e.id,
                label: e.label,
                kind: e.kind,
                device: e.device,
                mine: e.mine,
                country: e.country,
                city: e.city,
                since: prev && prev.label === e.label ? prev.since : now,
                lastSeen: now
            });
            await this.countDay(e.id, e.mine, now);
            return new Response(null, { status: 204 });
        }

        if (url.pathname === "/status") {
            const listening = (await this.activeSessions(now))
                .sort((a, b) => Number(a.mine) - Number(b.mine) || b.lastSeen - a.lastSeen)
                .map((s) => ({ ...s, id: s.id.slice(-6) }));
            const keys = [];
            for (let i = 0; i < SHOW_DAYS; i++) keys.push("day:" + dayKey(now - i * 86400000));
            const stored = await this.ctx.storage.get(keys);
            const days = keys.map((k) => {
                const ids = stored.get(k) || {};
                const values = Object.values(ids);
                return { day: k.slice(4), total: values.length, mine: values.filter(Boolean).length };
            });
            return Response.json({ now, listening, days });
        }

        return new Response("not found", { status: 404 });
    }
}
