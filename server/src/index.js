require("dotenv").config();
const express = require("express");
const cors = require("cors");
const flightRoutes = require("./routes/flights");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api", flightRoutes);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Error handler
app.use((err, req, res, next) => {
  console.error("[Error]", err.message);
  const status = err.response?.status || 500;
  const message = err.response?.data?.message || err.message || "Internal server error";
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`RunwayScope server running on http://localhost:${PORT}`);
});
