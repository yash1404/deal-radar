import mongoose from "mongoose";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined in environment variables`);
  }
  return value;
}

export async function connectDB(): Promise<void> {
  const mongoUri = requireEnv("MONGO_URI");

  mongoose.connection.on("connected", () => {
    console.log("[MongoDB] Connected successfully");
  });

  mongoose.connection.on("error", (error: Error) => {
    console.error("[MongoDB] Connection error:", error.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("[MongoDB] Disconnected");
  });

  try {
    await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connection established (database: ${mongoose.connection.name})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[MongoDB] Failed to connect:", message);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.connection.close();
  console.log("[MongoDB] Connection closed gracefully");
}
