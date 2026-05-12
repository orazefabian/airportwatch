import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import flightRoutes from "./routes/flights";
import { load as warmFileCache } from "./fileCache";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api", flightRoutes);

app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok" }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const error = err as { message?: string; response?: { status?: number; data?: { message?: string } } };
  console.error("[Error]", error.message);
  const status  = error.response?.status  || 500;
  const message = error.response?.data?.message || error.message || "Internal server error";
  res.status(status).json({ error: message });
});

warmFileCache().then(() => {
  app.listen(PORT, () => {
    console.log(`AirportWatch server running on http://localhost:${PORT}`);
  });
});
