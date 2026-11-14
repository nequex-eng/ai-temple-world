const CORS = {
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};
const allowedOrigin = (origin) => {
  if (!origin) return "*";
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && (
      u.hostname === "ai-temple-world.pages.dev" ||
      u.hostname.endsWith(".ai-temple-world.pages.dev") ||
      u.hostname === "localhost" || u.hostname === "127.0.0.1"
    ) ? origin : "https://ai-temple-world.pages.dev";
  } catch { return "https://ai-temple-world.pages.dev"; }
};
const headers = (request) => ({ ...CORS, "Access-Control-Allow-Origin": allowedOrigin(request.headers.get("Origin")), "Content-Type": "application/json; charset=utf-8" });
const reply = (request, data, status = 200) => new Response(JSON.stringify(data), { status, headers: headers(request) });
const clean = (v, max = 40) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max);
const validId = (v) => /^[a-f0-9-]{36}$/i.test(String(v || ""));
const color = (v, fallback) => /^#[0-9a-f]{6}$/i.test(String(v || "")) ? v : fallback;
const ACTIONS = new Set(["bow", "kneel", "meditate", "incense", "bell", "lotus", "greet", "sweep", "chant"]);
const LANGS = new Set(["zh", "ja", "ko", "th"]);
const now = () => new Date().toISOString();


const LANGUAGE_NAMES = { zh: "Simplified Chinese", ja: "Japanese", ko: "Korean", th: "Thai" };

async function reserveAiRequest(env, playerId, kind, dailyLimit, minIntervalMs) {
  const recent = await env.DB.prepare(
    "SELECT created_at FROM ai_requests WHERE player_id=? AND kind=? ORDER BY created_at DESC LIMIT 1"
  ).bind(playerId, kind).first();
  if (recent && Date.now() - Date.parse(recent.created_at) < minIntervalMs) return "Please wait a moment before trying again.";
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM ai_requests WHERE player_id=? AND kind=? AND date(created_at)=date('now')"
  ).bind(playerId, kind).first();
  if ((count?.total || 0) >= dailyLimit) return "The daily AI allowance for this guest has been reached.";
  await env.DB.prepare("INSERT INTO ai_requests(id,player_id,kind,created_at) VALUES(?,?,?,?)")
    .bind(crypto.randomUUID(), playerId, kind, now()).run();
  return null;
}

async function minimaxChat(env, messages, maxTokens = 480) {
  if (!env.MINIMAX_API_KEY) throw new Error("AI_NOT_CONFIGURED");
  const base = String(env.MINIMAX_BASE_URL || "https://api.minimaxi.com/v1").replace(/\/+$/, "");
  const model = env.MINIMAX_MODEL || "MiniMax-M3.1-Flash";
  const response = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.MINIMAX_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.35, max_tokens: maxTokens, stream: false })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("MiniMax request failed (" + response.status + "): " + clean(data?.base_resp?.status_msg || data?.error?.message || "", 180));
  const raw = data?.choices?.[0]?.message?.content;
  const answer = Array.isArray(raw) ? raw.map(part => part?.text || "").join("") : String(raw || "");
  if (!answer.trim()) throw new Error("MiniMax returned an empty response.");
  return answer.trim().slice(0, 1400);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function handleApi(request, env, url) {
  const path = url.pathname;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  if (path === "/api/health") {
    const db = await env.DB.prepare("SELECT 1 AS ok").first();
    return reply(request, { ok: true, service: "temple-world-api", realtime: true, database: db?.ok === 1, aiEnabled: !!env.MINIMAX_API_KEY, timestamp: now() });
  }

  if (path === "/api/translate" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.player_id)) return reply(request, { error: "Invalid player." }, 400);
    const message = clean(body.message, 220);
    const source = LANGS.has(body.source_language) ? body.source_language : "zh";
    const target = LANGS.has(body.target_language) ? body.target_language : "zh";
    if (!message) return reply(request, { error: "Message is empty." }, 400);
    if (source === target) return reply(request, { available: true, translated: message, cached: true });
    if (!env.MINIMAX_API_KEY) return reply(request, { available: false, error: "Translation is not configured yet." }, 503);
    const cacheKey = await sha256(source + "\u0000" + target + "\u0000" + message);
    const cached = await env.DB.prepare("SELECT translated_text FROM translations WHERE cache_key=?").bind(cacheKey).first();
    if (cached?.translated_text) return reply(request, { available: true, translated: cached.translated_text, cached: true });
    const limitError = await reserveAiRequest(env, body.player_id, "translate", 60, 250);
    if (limitError) return reply(request, { error: limitError }, 429);
    try {
      const translated = await minimaxChat(env, [
        { role: "system", content: "Translate the user's short public chat message into " + LANGUAGE_NAMES[target] + ". Preserve the meaning, tone, names and emojis. Return only the translation, with no explanation or quotation marks." },
        { role: "user", content: message }
      ], 180);
      await env.DB.prepare("INSERT OR REPLACE INTO translations(cache_key,source_language,target_language,translated_text,created_at) VALUES(?,?,?,?,?)")
        .bind(cacheKey, source, target, translated, now()).run();
      return reply(request, { available: true, translated, cached: false });
    } catch (error) {
      return reply(request, { error: clean(error.message, 220) || "Translation failed." }, 502);
    }
  }
  if (path === "/api/abbot" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.player_id)) return reply(request, { error: "Invalid player." }, 400);
    const message = clean(body.message, 600);
    if (message.length < 2) return reply(request, { error: "Please write a little more." }, 400);
    if (!env.MINIMAX_API_KEY) return reply(request, { available: false, error: "The abbot is resting until the AI service is configured." }, 503);
    const language = LANGS.has(body.language) ? body.language : "zh";
    const history = Array.isArray(body.history) ? body.history.slice(-8).map(item => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: clean(item?.content, 500)
    })).filter(item => item.content.length > 0) : [];
    const location = clean(body.location, 50);
    const limitError = await reserveAiRequest(env, body.player_id, "abbot", 20, 2200);
    if (limitError) return reply(request, { error: limitError }, 429);
    const system = [
      "You are the resident guide and abbot of a peaceful online Buddhist temple.",
      "Reply in " + LANGUAGE_NAMES[language] + ". Be warm, clear, respectful, non-sectarian and concise (roughly 60–120 words).",
      "Explain Buddhist ideas and contemplative practices in an accessible way; distinguish traditions when relevant and admit uncertainty.",
      "Never claim supernatural powers, guaranteed outcomes, miracles, karmic punishment or certainty about a person's fate.",
      "Never solicit money, donations, offerings or personal information. Never pressure anyone to adopt a religion.",
      "Do not provide medical, legal or financial instructions; encourage qualified professional help for those topics.",
      "If a person appears at risk of immediate harm, encourage contacting local emergency services and a trusted person.",
      "You are an AI guide in a digital environment, not a human monk and cannot perform real-world rituals.",
      location ? "The visitor is currently exploring: " + location + "." : ""
    ].filter(Boolean).join(" ");
    try {
      const answer = await minimaxChat(env, [{ role: "system", content: system }, ...history, { role: "user", content: message }], 520);
      return reply(request, { available: true, answer });
    } catch (error) {
      return reply(request, { error: clean(error.message, 220) || "The abbot could not respond." }, 502);
    }
  }

  if (path === "/api/session" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.player_id)) return reply(request, { error: "Invalid session." }, 400);
    const stamp = now();
    await env.DB.prepare("INSERT OR IGNORE INTO visits(day,player_id,created_at) VALUES(date(?),?,?)").bind(stamp, body.player_id, stamp).run();
    return reply(request, { ok: true });
  }
  if (path === "/api/profile" && request.method === "GET") {
    const id = url.searchParams.get("id");
    if (!validId(id)) return reply(request, { error: "A valid player id is required." }, 400);
    const row = await env.DB.prepare("SELECT id,name,robe,skin,style,language,created_at,updated_at FROM profiles WHERE id=?").bind(id).first();
    return row ? reply(request, { profile: row }) : reply(request, { profile: null }, 404);
  }
  if (path === "/api/profile" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.id)) return reply(request, { error: "Invalid profile." }, 400);
    const name = clean(body.name, 18) || "行者";
    const robe = color(body.robe, "#b49a72");
    const skin = color(body.skin, "#d7ad87");
    const style = body.style === "pilgrim" ? "pilgrim" : "monk";
    const language = LANGS.has(body.language) ? body.language : "zh";
    const stamp = now();
    await env.DB.prepare(
      "INSERT INTO profiles(id,name,robe,skin,style,language,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) " +
      "ON CONFLICT(id) DO UPDATE SET name=excluded.name,robe=excluded.robe,skin=excluded.skin,style=excluded.style,language=excluded.language,updated_at=excluded.updated_at"
    ).bind(body.id, name, robe, skin, style, language, stamp, stamp).run();
    return reply(request, { ok: true, profile: { id: body.id, name, robe, skin, style, language } });
  }
  if (path === "/api/data" && request.method === "DELETE") {
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.player_id)) return reply(request, { error: "Invalid request." }, 400);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM activities WHERE player_id=?").bind(body.player_id),
      env.DB.prepare("DELETE FROM prayers WHERE player_id=?").bind(body.player_id),
      env.DB.prepare("DELETE FROM visits WHERE player_id=?").bind(body.player_id),
      env.DB.prepare("DELETE FROM offerings WHERE player_id=?").bind(body.player_id),
      env.DB.prepare("DELETE FROM profiles WHERE id=?").bind(body.player_id)
    ]);
    return reply(request, { ok: true, deleted: true });
  }
  if (path === "/api/activity" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.player_id) || !ACTIONS.has(body.action)) return reply(request, { error: "Invalid activity." }, 400);
    const last = await env.DB.prepare("SELECT created_at FROM activities WHERE player_id=? ORDER BY created_at DESC LIMIT 1").bind(body.player_id).first();
    if (last && Date.now() - Date.parse(last.created_at) < 450) return reply(request, { error: "Please pause before recording another activity." }, 429);
    const location = clean(body.location, 40) || "temple";
    await env.DB.prepare("INSERT INTO activities(id,player_id,action,location,created_at) VALUES(?,?,?,?,?)")
      .bind(crypto.randomUUID(), body.player_id, body.action, location, now()).run();
    return reply(request, { ok: true });
  }
  if (path === "/api/stats" && request.method === "GET") {
    const [visits, activity, prayers] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS total FROM visits WHERE day=date('now')").first(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM activities WHERE date(created_at)=date('now')").first(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM prayers").first()
    ]);
    return reply(request, { todayVisitors: visits?.total || 0, todayActivities: activity?.total || 0, wishes: prayers?.total || 0 });
  }
  if (path === "/api/prayers" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT id,display_name,message,language,created_at FROM prayers ORDER BY created_at DESC LIMIT 30").all();
    return reply(request, { prayers: rows.results || [] });
  }
  if (path === "/api/prayers" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.player_id)) return reply(request, { error: "Invalid request." }, 400);
    const message = clean(body.message, 240);
    if (message.length < 2) return reply(request, { error: "Please write a little more." }, 400);
    const last = await env.DB.prepare("SELECT created_at FROM prayers WHERE player_id=? ORDER BY created_at DESC LIMIT 1").bind(body.player_id).first();
    if (last && Date.now() - Date.parse(last.created_at) < 60000) return reply(request, { error: "Please pause for a moment before posting another wish." }, 429);
    const profile = await env.DB.prepare("SELECT name FROM profiles WHERE id=?").bind(body.player_id).first();
    const name = clean(profile?.name || body.display_name || "行者", 18) || "行者";
    const language = LANGS.has(body.language) ? body.language : "zh";
    const id = crypto.randomUUID(), created_at = now();
    await env.DB.prepare("INSERT INTO prayers(id,player_id,display_name,message,language,created_at) VALUES(?,?,?,?,?,?)")
      .bind(id, body.player_id, name, message, language, created_at).run();
    return reply(request, { ok: true, prayer: { id, display_name: name, message, language, created_at } }, 201);
  }
  return reply(request, { error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/live") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket upgrade required.", { status: 426 });
      const id = env.TEMPLE_ROOMS.idFromName("global-sanctuary");
      return env.TEMPLE_ROOMS.get(id).fetch(request);
    }
    try { return await handleApi(request, env, url); }
    catch (error) {
      console.error("API error", error);
      return reply(request, { error: "The sanctuary service is temporarily unavailable." }, 500);
    }
  }
};

export class TempleRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    const current = this.ctx.getWebSockets();
    if (current.length >= 120) return new Response("The sanctuary is full. Please try another moment.", { status: 503 });
    const url = new URL(request.url);
    const player = {
      id: validId(url.searchParams.get("id")) ? url.searchParams.get("id") : crypto.randomUUID(),
      name: clean(url.searchParams.get("name"), 18) || "行者",
      robe: color(url.searchParams.get("robe"), "#b49a72"),
      skin: color(url.searchParams.get("skin"), "#d7ad87"),
      style: url.searchParams.get("style") === "pilgrim" ? "pilgrim" : "monk",
      language: LANGS.has(url.searchParams.get("language")) ? url.searchParams.get("language") : "zh",
      x: Math.max(-78, Math.min(78, Number(url.searchParams.get("x")) || 0)),
      z: Math.max(-78, Math.min(78, Number(url.searchParams.get("z")) || 18)),
      rotation: 0,
      action: "walk",
      joinedAt: Date.now()
    };
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(player);
    const peers = this.ctx.getWebSockets().filter(s => s !== server).map(s => s.deserializeAttachment()).filter(Boolean);
    const offeringRows = await this.env.DB.prepare("SELECT id,display_name,created_at FROM offerings ORDER BY created_at DESC LIMIT 24").all().catch(() => ({ results: [] }));
    server.send(JSON.stringify({ type: "welcome", players: peers, online: peers.length + 1, offerings: offeringRows.results || [] }));
    this.broadcast({ type: "player:join", player, online: peers.length + 1 }, server);
    return new Response(null, { status: 101, webSocket: client });
  }
  broadcast(message, except = null) {
    const payload = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(payload); } catch {}
    }
  }
  async webSocketMessage(ws, message) {
    let data;
    try { data = JSON.parse(message); } catch { return; }
    const player = ws.deserializeAttachment();
    if (!player || typeof data.type !== "string") return;
    if (data.type === "move") {
      const x = Number(data.x), z = Number(data.z), rotation = Number(data.rotation);
      if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(rotation)) return;
      const stamp = Date.now(), elapsed = player.lastMoveAt ? Math.max(50, Math.min(1000, stamp - player.lastMoveAt)) : 1000;
      if (player.lastMoveAt && stamp - player.lastMoveAt < 65) return;
      const nx = Math.max(-78, Math.min(78, x)), nz = Math.max(-78, Math.min(78, z));
      if (player.lastMoveAt && Math.hypot(nx - player.x, nz - player.z) > elapsed * .012 + 1.3) return;
      player.x = nx;
      player.z = nz;
      player.rotation = rotation;
      player.lastMoveAt = stamp;
      player.action = "walk";
      ws.serializeAttachment(player);
      this.broadcast({ type: "player:move", player }, ws);
      return;
    }
    if (data.type === "action" && ACTIONS.has(data.action)) {
      const actionStamp = Date.now();
      if (player.lastActionAt && actionStamp - player.lastActionAt < 550) return;
      player.lastActionAt = actionStamp;
      const near = (x, z, radius) => Math.hypot(player.x - x, player.z - z) <= radius;
      if (data.action === "incense" && !near(0, 0, 8)) return;
      if (data.action === "bell" && !near(-28, 2, 8)) return;
      if (data.action === "lotus" && !near(31, 33, 13)) return;
      if (data.action === "lotus") {
        if (player.lastLotusAt && Date.now() - player.lastLotusAt < 8000) return;
        player.lastLotusAt = Date.now();
        try {
          await this.env.DB.prepare("INSERT INTO offerings(id,player_id,display_name,kind,created_at) VALUES(?,?,?,?,?)")
            .bind(crypto.randomUUID(), player.id, player.name, "lotus", now()).run();
          await this.env.DB.prepare("DELETE FROM offerings WHERE id IN (SELECT id FROM offerings ORDER BY created_at DESC LIMIT -1 OFFSET 24)").run();
        } catch (error) { console.error("Lotus offering save failed", error); }
      }
      player.action = data.action;
      ws.serializeAttachment(player);
      this.broadcast({ type: "player:action", player }, ws);
      return;
    }
    if (data.type === "chat") {
      const messageText = clean(data.message, 220);
      if (messageText.length < 1 || (player.lastChatAt && Date.now() - player.lastChatAt < 900)) return;
      player.lastChatAt = Date.now();
      ws.serializeAttachment(player);
      this.broadcast({ type: "chat", id: crypto.randomUUID(), player: { id: player.id, name: player.name, language: player.language }, message: messageText, at: Date.now() });
    }
  }
  webSocketClose(ws) {
    const player = ws.deserializeAttachment();
    if (player) this.broadcast({ type: "player:leave", id: player.id, online: Math.max(0, this.ctx.getWebSockets().length - 1) }, ws);
  }
  webSocketError(ws) {
    const player = ws.deserializeAttachment();
    if (player) this.broadcast({ type: "player:leave", id: player.id }, ws);
  }
}