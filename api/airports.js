const AIRPORTS = require("../server/src/airports");

module.exports = function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  res.json(AIRPORTS);
};
