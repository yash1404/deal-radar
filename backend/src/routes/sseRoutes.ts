import { Router, type Request, type Response } from "express";

import { registerSseClient } from "../services/sseService";

const sseRoutes = Router();

sseRoutes.get("/", (req: Request, res: Response) => {
  registerSseClient(res);

  const heartbeatMs = Number(process.env.SSE_HEARTBEAT_MS ?? 30_000);
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
  }, heartbeatMs);

  req.on("close", () => {
    clearInterval(heartbeat);
  });
});

export default sseRoutes;
