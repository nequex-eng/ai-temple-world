const API_ORIGIN = "https://temple-world-api.nequex.workers.dev";
const CANONICAL_HOST = "helixtemple.com";

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    // Permanent host normalization for the default Pages domain and www alias.
    // Keep the original path and query string byte-for-byte through URL serialization.
    if (incoming.hostname === "helixtemple.pages.dev" || incoming.hostname === "www.helixtemple.com") {
      incoming.protocol = "https:";
      incoming.hostname = CANONICAL_HOST;
      incoming.port = "";
      return new Response(null, {
        status: 301,
        headers: {
          Location: incoming.toString(),
          "Cache-Control": "public, max-age=3600",
          "X-Robots-Tag": "noindex"
        }
      });
    }
    if (incoming.pathname === "/google0231bbe40ae157c7.html") {
      return new Response("google-site-verification: google0231bbe40ae157c7.html", {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }
    if (incoming.pathname === "/locale") {
      const country = String(request.cf?.country || "").toUpperCase();
      const language = country === "CN" || country === "TW" || country === "HK" || country === "MO" ? "zh"
        : country === "JP" ? "ja"
        : country === "KR" ? "ko"
        : country === "TH" ? "th" : "en";
      return Response.json({ country, language }, {
        headers: { "Cache-Control": "no-store", "Vary": "CF-IPCountry" }
      });
    }
    if (incoming.pathname === "/api" || incoming.pathname.startsWith("/api/")) {
      const upstreamUrl = new URL(incoming.pathname + incoming.search, API_ORIGIN);
      // Preserve JSON bodies and WebSocket Upgrade headers while proxying the API.
      return fetch(new Request(upstreamUrl, request));
    }
    return env.ASSETS.fetch(request);
  }
};
