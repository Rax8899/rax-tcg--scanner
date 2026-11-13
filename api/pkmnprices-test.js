// Server-side smoke test for the configured PkmnPrices key.
// Returns only public card metadata and price rows; never exposes the secret.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });
  const key = process.env.PKMNPRICES_API_KEY;
  if (!key) return res.status(503).json({ ok: false, stage: "configuration", error: "PKMNPRICES_API_KEY missing from Vercel environment" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const base = "https://api.pkmnprices.com/v1";
    const headers = { "X-API-Key": key, "Accept": "application/json" };
    const searchUrl = new URL(base + "/cards");
    searchUrl.search = new URLSearchParams({
      name: "Cresselia",
      number: "74",
      total_set_number: "128",
      per_page: "100"
    }).toString();

    const searchResponse = await fetch(searchUrl, { headers, signal: controller.signal, cache: "no-store" });
    const searchRaw = await searchResponse.text();
    let searchData = {};
    try { searchData = searchRaw ? JSON.parse(searchRaw) : {}; } catch (_) {}
    if (!searchResponse.ok) {
      const e = searchData.error || {};
      return res.status(200).json({
        ok: false, stage: "card_search", upstreamStatus: searchResponse.status,
        code: e.code || null, message: String(e.message || "PkmnPrices search failed").slice(0, 500)
      });
    }

    const cards = Array.isArray(searchData.data) ? searchData.data : Array.isArray(searchData.cards) ? searchData.cards : [];
    const matches = cards.filter(c =>
      String(c.name || "").toLowerCase() === "cresselia" &&
      parseInt(String(c.number || "").match(/\\d+/)?.[0] || "NaN", 10) === 74 &&
      parseInt(String(c.total_set_number || "").match(/\\d+/)?.[0] || "NaN", 10) === 128
    );

    let priceCheck = null;
    if (matches[0] && matches[0].id != null) {
      const priceResponse = await fetch(base + "/cards/" + encodeURIComponent(matches[0].id), {
        headers, signal: controller.signal, cache: "no-store"
      });
      const priceRaw = await priceResponse.text();
      let priceData = {};
      try { priceData = priceRaw ? JSON.parse(priceRaw) : {}; } catch (_) {}
      priceCheck = priceResponse.ok ? {
        ok: true,
        priceRows: Array.isArray(priceData.prices) ? priceData.prices.length : 0,
        currencies: [...new Set((priceData.prices || []).map(p => p.currency).filter(Boolean))],
        card: { id: priceData.id, name: priceData.name, number: priceData.number, set: priceData.set && priceData.set.name }
      } : {
        ok: false, upstreamStatus: priceResponse.status,
        message: String(priceData.error && priceData.error.message || "Card price request failed").slice(0, 500)
      };
    }

    return res.status(200).json({
      ok: true, stage: "complete",
      search: { resultCount: cards.length, sampleRecords: cards.slice(0, 5).map(c => ({ id: c.id, name: c.name, number: c.number, total_set_number: c.total_set_number, set: c.set })), exactMatchCount: matches.length, exactMatches: matches.slice(0, 10).map(c => ({
        id: c.id, name: c.name, number: c.number, total_set_number: c.total_set_number,
        set: c.set && c.set.name, image_url: c.image_url
      })) },
      priceCheck
    });
  } catch (e) {
    return res.status(200).json({
      ok: false, stage: "network_or_timeout",
      message: e.name === "AbortError" ? "PkmnPrices diagnostic timed out" : String(e.message || e).slice(0, 300)
    });
  } finally {
    clearTimeout(timer);
  }
};
