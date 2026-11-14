const API_BASE = "https://temple-world-api.nequex.workers.dev";
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
    this.onStatus = onStatus;
    this.onMessage = onMessage;
    this.onError = onError;
    this.socket = null;
    this.profile = null;
    this.position = { x: 0, z: 18, rotation: 0 };
    this.closedByUser = false;
    this.reconnectTimer = null;
    this.retry = 0;
    this.lastSent = 0;
    this.lastBroadcastPosition = null;
  }
  async request(path, options = {}) {
    const response = await fetch(API_BASE + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      cache: "no-store",
      credentials: "omit"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || ("Request failed (" + response.status + ")"));
    return body;
  }
  async health() { return this.request("/api/health"); }
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
    return this.request("/api/prayers", {
      method: "POST",
      body: JSON.stringify({ player_id: this.playerId, message, language, display_name })
    });
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
      language: p.language || "zh",
      x: String(pos.x || 0),
      z: String(pos.z ?? 18)
    });
    const socket = new WebSocket(API_BASE.replace(/^http/, "ws") + "/api/live?" + query.toString());
    this.socket = socket;
    socket.addEventListener("open", () => {
      if (this.socket !== socket) return;
      this.retry = 0;
      this.onStatus("online");
    });
    socket.addEventListener("message", event => {
      try { this.onMessage(JSON.parse(event.data)); } catch {}
    });
    socket.addEventListener("error", () => this.onStatus("offline"));
    socket.addEventListener("close", () => {
      if (this.socket === socket) this.socket = null;
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
  chat(message) { return this.send({ type: "chat", message }); }
  close() {
    this.closedByUser = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, "Leaving the sanctuary");
    this.socket = null;
  }
}
