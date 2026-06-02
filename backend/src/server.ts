import "dotenv/config";
import http from "http";

import app from "./app";
import { connectDB, disconnectDB } from "./config/db";
import { connectRedis, disconnectRedis } from "./config/redis";

const PORT = Number(process.env.PORT ?? 5000);
const SHUTDOWN_TIMEOUT_MS = 10_000;

let isShuttingDown = false;

async function bootstrap(): Promise<void> {
  if (Number.isNaN(PORT)) {
    throw new Error("PORT must be a valid number");
  }

  console.log("[Server] Starting Deal Radar API...");

  await connectDB();
  await connectRedis();

  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(`[Server] ${signal} received. Shutting down gracefully...`);

    const forceExitTimer = setTimeout(() => {
      console.error("[Server] Shutdown timed out. Forcing exit.");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    server.close((closeError) => {
      void (async () => {
        if (closeError) {
          console.error("[Server] HTTP server close error:", closeError.message);
        } else {
          console.log("[Server] HTTP server closed");
        }

        try {
          await disconnectRedis();
          await disconnectDB();
          clearTimeout(forceExitTimer);
          console.log("[Server] Shutdown complete");
          process.exit(0);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[Server] Error during shutdown:", message);
          clearTimeout(forceExitTimer);
          process.exit(1);
        }
      })();
    });
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error("[Server] Unhandled promise rejection:", message);
});

process.on("uncaughtException", (error: Error) => {
  console.error("[Server] Uncaught exception:", error.message);
  process.exit(1);
});

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[Server] Failed to start:", message);
  process.exit(1);
});
