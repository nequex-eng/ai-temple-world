const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") ? "https://temple-world-api.nequex.workers.dev" : window.location.origin;
const PLAYER_KEY = "temple-world-player-id";
export function getPlayerId() {
  let id = localStorage.getItem(PLAYER_KEY);
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_KEY, id);
  }
  return id;
}
export class TempleNetwork {
  constructor({ onStatus = () => {}, onMessage = () => {}, onError = () => {} } = {}) {
    this.playerId = getPlayerId();
    // One shared sanctuary: every visitor enters the same live room.
    this.room = "great-hall";
    this.instance = 0;
    this.region = "auto";
    const roomLabel = document.getElementById("room-label");
    if (roomLabel) roomLabel.textContent = "GREAT HALL · SHARED";
    this.onStatus = onStatus;
    this.onMessage = onMessage;
    this.onError = onError;
    this.socket = null;
    this.profile = null;
    this.position = { x: 0, z: 18, rotation: 0 };
    this.closedByUser = false;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.welcomeTimer = null;
    this.welcomed = false;
    this.hasJoinedRoom = false;
    this.retry = 0;
    this.lastSent = 0;
    this.lastBroadcastPosition = null;
    this.pendingChatQueue = [];
    this.chatFlushTimer = null;
  }
  async request(path, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(API_BASE + path, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || ("Request failed (" + response.status + ")"));
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }
  async askFortune(question, birthInfo, hexagram, history, language) {
    return this.request("/api/fortune", { method: "POST", body: JSON.stringify({ player_id: this.playerId, question, birth_info: birthInfo, hexagram, history, language }) }, 60000);
  }
  async askAbbot(message, history, language, location) {
    return this.request("/api/abbot", {
      method: "POST",
      body: JSON.stringify({ player_id: this.playerId, message, history, language, location })
    }, 60000);
  }
  async health() { return this.request("/api/health", {}, 30000); }
  async visit() { return this.request("/api/session", { method: "POST", body: JSON.stringify({ player_id: this.playerId }) }); }
  async loadProfile() {
    try {
      const data = await this.request("/api/profile?id=" + encodeURIComponent(this.playerId));
      return data.profile || null;
    } catch { return null; }
  }
  async saveProfile(profile, language) {
    return this.request("/api/profile", {
      method: "POST",
      body: JSON.stringify({ id: this.playerId, ...profile, language })
    });
  }
  async logActivity(action, location) {
    try {
      await this.request("/api/activity", { method: "POST", body: JSON.stringify({ player_id: this.playerId, action, location }) });
    } catch (error) { this.onError(error); }
  }
  async getStats() {
    return this.request("/api/stats");
  }
  async getPrayers() {
    const data = await this.request("/api/prayers");
    return data.prayers || [];
  }
  async deleteMyData() { return this.request("/api/data", { method: "DELETE", body: JSON.stringify({ player_id: this.playerId }) }); }
  async postPrayer(message, language, display_name) {
    return this.request("/api/prayers", { method: "POST", body: JSON.stringify({ player_id: this.playerId, message, language, display_name }) }, 45000);
  }
  async deletePrayer(id) {
    return this.request("/api/prayers/" + encodeURIComponent(id), { method: "DELETE", body: JSON.stringify({ player_id: this.playerId }) }, 20000);
  }
  connect(profile, position = this.position) {
    this.profile = profile;
    this.position = position;
    this.closedByUser = false;
    this.openSocket();
  }
  openSocket() {
    if (!this.profile || this.closedByUser) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    this.onStatus("connecting");
    const p = this.profile, pos = this.position;
    const query = new URLSearchParams({
      id: this.playerId,
      name: p.name || "行者",
      robe: p.robe || "#b49a72",
      skin: p.skin || "#d7ad87",
      style: p.style || "monk",
      language: p.language || localStorage.getItem("temple-language") || "zh",
      x: String(pos.x || 0),
      z: String(pos.z ?? 18),
      rotation: String(pos.rotation ?? 0),
      resume: this.hasJoinedRoom ? "1" : "0"
    });
    const socket = new WebSocket(API_BASE.replace(/^http/, "ws") + "/api/live?" + query.toString());
    this.socket = socket;
    this.welcomed = false;
    socket.addEventListener("open", () => {
      if (this.socket !== socket) return;
      this.retry = 0;
      this.onStatus("connecting");
      clearInterval(this.heartbeatTimer);
      clearTimeout(this.welcomeTimer);
      this.heartbeatTimer = setInterval(() => {
        if (this.socket === socket && socket.readyState === WebSocket.OPEN) this.send({ type: "ping", at: Date.now() });
      }, 8000);
      this.welcomeTimer = setTimeout(() => {
        if (this.socket === socket && !this.welcomed && socket.readyState === WebSocket.OPEN) {
          this.onStatus("offline");
          socket.close(4000, "Shared room did not initialize");
        }
      }, 12000);
    });
    socket.addEventListener("message", event => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === "welcome") {
          this.welcomed = true;
          this.hasJoinedRoom = true;
          clearTimeout(this.welcomeTimer);
          this.welcomeTimer = null;
          this.onStatus("online");
          this.flushChatQueue(socket);
        }
        this.onMessage(message);
      } catch {}
    });
    socket.addEventListener("error", () => { if (this.socket === socket) this.onStatus("offline"); });
    socket.addEventListener("close", event => {
      if (this.socket !== socket) return;
      clearInterval(this.heartbeatTimer);this.heartbeatTimer=null;
      clearTimeout(this.welcomeTimer);this.welcomeTimer=null;
      clearTimeout(this.chatFlushTimer);this.chatFlushTimer=null;
      this.socket = null;
      if (event.code === 4001) { this.closedByUser = true; this.onStatus("offline"); return; }
      if (this.closedByUser) return;
      this.onStatus("offline");
      this.scheduleReconnect();
    });
  }
  scheduleReconnect() {
    if (this.reconnectTimer || this.closedByUser) return;
    const delay = Math.min(30000, 900 * Math.pow(1.7, this.retry++));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }
  send(payload) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    try { this.socket.send(JSON.stringify(payload)); return true; } catch { return false; }
  }
  move(position, force = false) {
    this.position = position;
    const time = performance.now();
    if (!force && time - this.lastSent < 110) return;
    const previous = this.lastBroadcastPosition;
    if (!force && previous &&
      Math.hypot(position.x - previous.x, position.z - previous.z) < 0.035 &&
      Math.abs(position.rotation - previous.rotation) < 0.035) return;
    this.lastSent = time;
    this.lastBroadcastPosition = { ...position };
    this.send({ type: "move", ...position });
  }
  action(action) { this.send({ type: "action", action }); }
  flushChatQueue(socket = this.socket) {
    if (!socket || this.socket !== socket || socket.readyState !== WebSocket.OPEN || !this.welcomed || !this.pendingChatQueue.length || this.chatFlushTimer) return;
    const queued = this.pendingChatQueue.shift();
    if (!this.send({ type: "chat", id: queued.id, message: queued.message })) { this.pendingChatQueue.unshift(queued); return; }
    if (this.pendingChatQueue.length) this.chatFlushTimer = setTimeout(() => {
      this.chatFlushTimer = null;
      this.flushChatQueue(socket);
    }, 1050);
  }
  chat(message) {
    const clean = String(message || "").trim().slice(0, 220);
    if (!clean || this.pendingChatQueue.length >= 10) return false;
    const id = crypto.randomUUID();
    if (this.socket?.readyState === WebSocket.OPEN && this.welcomed && !this.pendingChatQueue.length) return this.send({ type: "chat", id, message: clean }) ? id : false;
    this.pendingChatQueue.push({ id, message: clean });
    if (!this.closedByUser && this.socket?.readyState !== WebSocket.CONNECTING) this.openSocket();
    if (this.socket?.readyState === WebSocket.OPEN && this.welcomed) this.flushChatQueue();
    return id;
  }
  close() {
    this.closedByUser = true;
    clearInterval(this.heartbeatTimer);this.heartbeatTimer=null;
    clearTimeout(this.welcomeTimer);this.welcomeTimer=null;
    clearTimeout(this.chatFlushTimer);this.chatFlushTimer=null;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "Leaving the sanctuary");
  }
}
