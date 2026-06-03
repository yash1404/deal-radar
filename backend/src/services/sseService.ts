import type { Response } from "express";

export type SseEventType =
  | "deal.updated"
  | "deal.health_updated"
  | "event.processed";

export interface SsePayload {
  type: SseEventType;
  deal_id: string;
  event_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}

const clients = new Set<Response>();

function formatSseMessage(payload: SsePayload): string {
  return `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function registerSseClient(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  res.write(`: connected ${new Date().toISOString()}\n\n`);
  clients.add(res);

  console.log(`[SSE] Client connected (active=${clients.size})`);

  res.on("close", () => {
    clients.delete(res);
    console.log(`[SSE] Client disconnected (active=${clients.size})`);
  });
}

export function emitSseEvent(payload: SsePayload): void {
  const message = formatSseMessage(payload);

  for (const client of clients) {
    try {
      client.write(message);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : String(error);
      console.error("[SSE] Failed to write to client:", messageText);
      clients.delete(client);
    }
  }

  console.log(
    `[SSE] Emitted type=${payload.type} deal_id=${payload.deal_id} event_id=${payload.event_id} clients=${clients.size}`,
  );
}

export function getActiveSseClientCount(): number {
  return clients.size;
}
