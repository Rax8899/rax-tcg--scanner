const { forward } = require("./_pkmnprices");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { message: "Method not allowed." } });
  }
  return forward("/cards", req.query, res);
};
