import Redis, { type RedisOptions } from "ioredis";

let redisClient: Redis | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined in environment variables`);
  }
  return value;
}

function buildRedisOptions(): RedisOptions {
  const host = requireEnv("REDIS_HOST");
  const port = Number(requireEnv("REDIS_PORT"));
  const password = requireEnv("REDIS_PASSWORD");

  if (Number.isNaN(port)) {
    throw new Error("REDIS_PORT must be a valid number");
  }

  const username = process.env.REDIS_USERNAME;
  const useTls = process.env.REDIS_TLS !== "false";

  const options: RedisOptions = {
    host,
    port,
    password,
    // Required for BullMQ workers (blocking commands)
    maxRetriesPerRequest: null,
    ...(username ? { username } : {}),
    ...(useTls ? { tls: {} } : {}),
  };

  return options;
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error("Redis client is not initialized. Call connectRedis() first.");
  }
  return redisClient;
}

export async function connectRedis(): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }

  const client = new Redis(buildRedisOptions());

  client.on("connect", () => {
    console.log("[Redis] Connecting...");
  });

  client.on("ready", () => {
    console.log("[Redis] Connected successfully");
  });

  client.on("error", (error: Error) => {
    console.error("[Redis] Connection error:", error.message);
  });

  client.on("close", () => {
    console.log("[Redis] Connection closed");
  });

  redisClient = client;

  if (client.status === "ready") {
    console.log("[Redis] Connection established");
    return client;
  }

  await new Promise<void>((resolve, reject) => {
    const onReady = (): void => {
      cleanup();
      console.log("[Redis] Connection established");
      resolve();
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const cleanup = (): void => {
      client.off("ready", onReady);
      client.off("error", onError);
    };

    client.once("ready", onReady);
    client.once("error", onError);
  });

  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (!redisClient) {
    return;
  }

  await redisClient.quit();
  redisClient = null;
  console.log("[Redis] Connection closed gracefully");
}
