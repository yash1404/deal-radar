import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import dealRoutes from "./routes/dealRoutes";
import sseRoutes from "./routes/sseRoutes";
import webhookRoutes from "./routes/webhookRoutes";
import { DealNotFoundError } from "./services/dealService";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/webhook", webhookRoutes);
app.use("/sse", sseRoutes);
app.use("/deals", dealRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DealNotFoundError) {
    res.status(404).json({ message: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[App] Unhandled error:", message);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
