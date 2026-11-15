const API_ORIGIN = "https://temple-world-api.nequex.workers.dev";

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname === "/api" || incoming.pathname.startsWith("/api/")) {
      const upstreamUrl = new URL(incoming.pathname + incoming.search, API_ORIGIN);
      // Preserve JSON bodies and WebSocket Upgrade headers while proxying the API.
      return fetch(new Request(upstreamUrl, request));
    }
    return env.ASSETS.fetch(request);
  }
};
