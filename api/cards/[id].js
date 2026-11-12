const { forward } = require("../_pkmnprices");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { message: "Method not allowed." } });
  }
  const id = String(req.query.id || "");
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: { message: "A valid numeric card ID is required." } });
  }
  return forward("/cards/" + encodeURIComponent(id), {}, res);
};
