// RAX visual card identification. Images are processed in-memory and not stored.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ ok: false, error: "OPENAI_API_KEY is not configured on the server." });
  const image = req.body && req.body.image;
  if (typeof image !== "string" || !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image)) return res.status(400).json({ ok: false, error: "A JPEG, PNG, or WebP data URL is required." });
  if (image.length > 7000000) return res.status(413).json({ ok: false, error: "Image is too large. Please use a smaller photo." });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini", store: false, max_output_tokens: 350,
        input: [{ role: "user", content: [
          { type: "input_text", text: "Identify the Pokémon Trading Card Game card in this image. Read only visible details; never guess uncertain fields. Return ONLY valid JSON with keys: is_pokemon_card (boolean), name (string or empty), collector_number (string or empty, format number/total if visible), set_name (string or empty), language (string or empty), finish (string or empty), confidence (number 0 to 1), notes (short string). If not a Pokémon card, set is_pokemon_card false. Preserve leading zeroes." },
          { type: "input_image", image_url: image, detail: "high" }
        ] }]
      }), signal: controller.signal
    });
    const raw = await response.text(); let data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
    if (!response.ok) { const e = data.error || {}; return res.status(response.status).json({ ok: false, error: String(e.message || "Vision request failed").slice(0, 500), code: e.code || null }); }
    const output = (data.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text || "").join("\n");
    const cleaned = output.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    let card; try { card = JSON.parse(cleaned); } catch (_) { return res.status(502).json({ ok: false, error: "Vision returned an unreadable identification result." }); }
    return res.status(200).json({ ok: true, card });
  } catch (e) { return res.status(e.name === "AbortError" ? 504 : 502).json({ ok: false, error: e.name === "AbortError" ? "Card image recognition timed out." : "Card image recognition request failed." }); }
  finally { clearTimeout(timer); }
}