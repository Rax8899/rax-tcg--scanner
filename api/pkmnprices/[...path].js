// Same-origin, server-side PkmnPrices proxy. The API key stays in Vercel env vars.
const UPSTREAM = "https://api.pkmnprices.com/v1";
function allowedPath(path) {
  return path === "cards" ||
    /^cards\/\d+$/.test(path) ||
    /^cards\/\d+\/(?:prices\/history|sales\/volume)$/.test(path) ||
    /^cards\/\d+\/listings\/(?:ebay|cardmarket|tcgplayer)$/.test(path) ||
    path === "sets" ||
    /^sets\/\d+$/.test(path) ||
    path === "sealed" ||
    /^sealed\/\d+$/.test(path) ||
    /^sealed\/\d+\/listings\/(?:ebay|cardmarket|tcgplayer)$/.test(path);
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: { message: "Method not allowed" } });
  const key = process.env.PKMNPRICES_API_KEY;
  if (!key) return res.status(503).json({ error: { message: "Server API key is not configured. Add PKMNPRICES_API_KEY to Vercel environment variables." } });

  const incoming = new URL(req.url, "https://raxtcg.vercel.app");
  const prefix = "/api/pkmnprices/";
  const path = incoming.pathname.startsWith(prefix) ? incoming.pathname.slice(prefix.length) : "";
  if (!allowedPath(path)) return res.status(404).json({ error: { message: "This RAX API route is not enabled." } });

  const upstreamUrl = new URL(UPSTREAM + "/" + path);
  upstreamUrl.search = incoming.search;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { "X-API-Key": key, "Accept": "application/json" },
      signal: controller.signal,
      cache: "no-store"
    });
    const raw = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("Content-Type") || "application/json; charset=utf-8");
    const retryAfter = upstream.headers.get("Retry-After");
    if (retryAfter) res.setHeader("Retry-After", retryAfter);
    return res.send(raw);
  } catch (e) {
    return res.status(e.name === "AbortError" ? 504 : 502).json({
      error: { message: e.name === "AbortError" ? "PkmnPrices request timed out." : "PkmnPrices upstream request failed." }
    });
  } finally {
    clearTimeout(timer);
  }
};
