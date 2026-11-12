module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    app: "RAXTCG",
    status: "ok",
    marketApiConfigured: Boolean(process.env.PKMNPRICES_API_KEY)
  });
};
