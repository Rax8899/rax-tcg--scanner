const UPSTREAM = "https://api.pkmnprices.com/v1";
const ALLOWED_ORIGINS = new Set([
  "https://rax8899.github.io",
]);

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://rax8899.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonError(message, status, origin) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function allowedPath(path) {
  return path === "cards" ||
    /^cards\/\d+$/.test(path) ||
    /^cards\/\d+\/(?:prices\/history|sales\/volume)$/.test(path) ||
    /^cards\/\d+\/listings\/(?:ebay|cardmarket|tcgplayer)$/.test(path);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return jsonError("Method not allowed", 405, origin);
    if (origin && !ALLOWED_ORIGINS.has(origin)) return jsonError("Origin not allowed", 403, origin);
    if (!env.PKMNPRICES_API_KEY) {
      return jsonError("Server API key is not configured. Add PKMNPRICES_API_KEY as a Worker secret.", 503, origin);
    }

    const incoming = new URL(request.url);
    const path = incoming.pathname.replace(/^\/+/, "");
    if (!allowedPath(path)) return jsonError("This API route is not enabled by the RAX Worker.", 404, origin);

    const upstreamUrl = new URL(`${UPSTREAM}/${path}`);
    upstreamUrl.search = incoming.search;
    try {
      const upstream = await fetch(upstreamUrl.toString(), {
        method: "GET",
        headers: { "X-API-Key": env.PKMNPRICES_API_KEY, "Accept": "application/json" },
        cf: { cacheTtl: 0, cacheEverything: false },
      });
      const headers = new Headers(cors);
      headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      const warning = upstream.headers.get("Warning");
      if (warning) headers.set("Warning", warning);
      const retryAfter = upstream.headers.get("Retry-After");
      if (retryAfter) headers.set("Retry-After", retryAfter);
      return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
    } catch (error) {
      return jsonError("Upstream PkmnPrices request failed: " + (error?.message || "unknown error"), 502, origin);
    }
  },
};
