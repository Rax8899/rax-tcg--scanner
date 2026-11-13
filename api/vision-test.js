// Server-side diagnostic: validates OpenAI Responses API image-input access without exposing the API key.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ ok: false, stage: "configuration", error: "OPENAI_API_KEY missing" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini",
        store: false,
        max_output_tokens: 40,
        input: [{ role: "user", content: [
          { type: "input_text", text: "Reply with exactly the words IMAGE INPUT OK if you can inspect this image." },
          { type: "input_image", image_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYElEQVR4nO3PQQ0AIBDAMED5SUcEj4ZkVbDtmVk/OzrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgPaBaIsAgBhHc02AAAAAElFTkSuQmCC", detail: "low" }
        ] }]
      }),
      signal: controller.signal
    });
    const raw = await upstream.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
    if (!upstream.ok) {
      const e = data && data.error || {};
      return res.status(200).json({
        ok: false, stage: "openai_request", upstreamStatus: upstream.status,
        errorType: e.type || null, errorCode: e.code || null,
        message: String(e.message || "OpenAI request failed").slice(0, 700)
      });
    }
    const output = (data.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text || "").join(" ");
    return res.status(200).json({ ok: true, stage: "vision_image_input", model: process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini", responseReceived: !!output, output: output.slice(0, 120) });
  } catch (e) {
    return res.status(200).json({ ok: false, stage: "network_or_timeout", message: e.name === "AbortError" ? "OpenAI diagnostic timed out" : String(e.message || e).slice(0, 300) });
  } finally { clearTimeout(timer); }
};
