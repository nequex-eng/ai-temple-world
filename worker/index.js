const CORS = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
const ACTIONS = new Set(["bow", "kneel", "meditate", "incense", "bell", "lotus", "greet", "sweep"]);
const LANGS = new Set(["zh", "ja", "ko", "th"]);
const now = () => new Date().toISOString();

async function handleApi(request, env, url) {
  const path = url.pathname;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  if (path === "/api/health") return reply(request, { ok: true, service: "temple-world-api", realtime: true, database: true, timestamp: now() });
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
  if (path === "/api/activity" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.player_id) || !ACTIONS.has(body.action)) return reply(request, { error: "Invalid activity." }, 400);
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
    server.send(JSON.stringify({ type: "welcome", players: peers, online: peers.length + 1 }));
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
  webSocketMessage(ws, message) {
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