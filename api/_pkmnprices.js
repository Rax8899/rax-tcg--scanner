const UPSTREAM = "https://api.pkmnprices.com/v1";

async function forward(path, query, res) {
  const key = process.env.PKMNPRICES_API_KEY;
  if (!key) {
    return res.status(503).json({ error: { message: "Server API key is not configured. Add PKMNPRICES_API_KEY in Vercel Project Environment Variables." } });
  }
  const url = new URL(UPSTREAM + path);
  for (const [name, value] of Object.entries(query || {})) {
    if (Array.isArray(value)) value.forEach(v => url.searchParams.append(name, String(v)));
    else if (value != null && value !== "") url.searchParams.set(name, String(value));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-API-Key": key, "Accept": "application/json" },
      signal: controller.signal,
      cache: "no-store"
    });
    const raw = await upstream.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { return res.status(502).json({ error: { message: "Market data provider returned invalid JSON." } }); }
    res.setHeader("Cache-Control", "no-store");
    return res.status(upstream.status).json(data);
  } catch (error) {
    const message = error && error.name === "AbortError"
      ? "Market data request timed out. Please retry."
      : "Could not reach the market data provider. Please retry.";
    return res.status(502).json({ error: { message } });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { forward };
