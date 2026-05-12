import type { VercelRequest, VercelResponse } from "@vercel/node";
import AIRPORTS from "../server/src/airports";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json(AIRPORTS);
}
