const MODEL = process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { message: "Method not allowed." } });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(503).json({ error: { message: "OpenAI Vision 尚未配置。请在 Vercel 添加 OPENAI_API_KEY，然后重新部署。" } });
  }
  const image = req.body && req.body.image;
  if (typeof image !== "string" || !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image)) {
    return res.status(400).json({ error: { message: "请提供 JPEG、PNG 或 WebP 卡片照片。" } });
  }
  if (image.length > 5 * 1024 * 1024) {
    return res.status(413).json({ error: { message: "照片太大，请降低相机分辨率后重试。" } });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50000);
  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        max_output_tokens: 300,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Identify the single Pokémon Trading Card Game card in this photo. Read only visible, verifiable card information. Do not guess. Return ONLY valid JSON with keys: is_pokemon_card (boolean), name (string or empty), number (string like 074/128 or empty), set_name (string or empty), language (string or empty), variant (string or empty), confidence (number 0 to 1). If the card is not clearly visible, set is_pokemon_card false and leave identity fields empty. The card title is usually near the top; distinguish it from attack names."
            },
            { type: "input_image", image_url: image, detail: "high" }
          ]
        }]
      }),
      signal: controller.signal
    });
    const raw = await upstream.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { return res.status(502).json({ error: { message: "OpenAI 返回了无法解析的响应。" } }); }
    if (!upstream.ok) {
      const message = data && data.error && data.error.message || "OpenAI Vision 请求失败。";
      return res.status(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, { error: { message } });
    }
    const outputText = (data.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text || "")
      .join("\n");
    let card;
    try {
      const cleaned = outputText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      card = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: { message: "视觉模型没有返回有效卡片资料，请重新扫描。" } });
    }
    const clean = value => typeof value === "string" ? value.trim().slice(0, 120) : "";
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      card: {
        is_pokemon_card: card.is_pokemon_card === true,
        name: clean(card.name),
        number: clean(card.number),
        set_name: clean(card.set_name),
        language: clean(card.language),
        variant: clean(card.variant),
        confidence: Math.max(0, Math.min(1, Number(card.confidence) || 0))
      }
    });
  } catch (error) {
    const message = error && error.name === "AbortError"
      ? "OpenAI Vision 请求超时，请让卡片更靠近镜头后重试。"
      : "无法连接 OpenAI Vision，请检查 API 配置或稍后重试。";
    return res.status(502).json({ error: { message } });
  } finally {
    clearTimeout(timer);
  }
};

module.exports.config = { maxDuration: 60 };
