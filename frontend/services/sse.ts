import { getApiBaseUrl } from "@/services/api";
import type { SsePayload } from "@/types/api";

export type SseConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "closed";

export interface SseHandlers {
  onEvent: (payload: SsePayload) => void;
  onOpen?: () => void;
  onError?: (message: string) => void;
  onStatusChange?: (status: SseConnectionStatus) => void;
}

const SSE_EVENT_TYPES = ["deal.updated", "deal.health_updated", "event.processed"];

export function getSseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SSE_URL?.trim();
  if (configured) {
    return configured;
  }

  const path = process.env.NEXT_PUBLIC_SSE_PATH?.trim() || "/sse";
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export class DealRadarSseClient {
  private source: EventSource | null = null;

  connect(handlers: SseHandlers): void {
    this.disconnect();

    const url = getSseUrl();
    handlers.onStatusChange?.("connecting");

    const source = new EventSource(url);
    this.source = source;

    source.onopen = () => {
      handlers.onStatusChange?.("connected");
      handlers.onOpen?.();
    };

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        handlers.onStatusChange?.("closed");
        handlers.onError?.("SSE connection closed");
        return;
      }

      handlers.onStatusChange?.("error");
      handlers.onError?.("SSE connection error");
    };

    const handlePayload = (raw: string): void => {
      try {
        const payload = JSON.parse(raw) as SsePayload;
        handlers.onEvent(payload);
      } catch {
        handlers.onError?.("Failed to parse SSE payload");
      }
    };

    source.onmessage = (event) => {
      if (!event.data) {
        return;
      }
      handlePayload(event.data);
    };

    for (const eventType of SSE_EVENT_TYPES) {
      source.addEventListener(eventType, (event) => {
        const messageEvent = event as MessageEvent<string>;
        if (!messageEvent.data) {
          return;
        }
        handlePayload(messageEvent.data);
      });
    }
  }

  disconnect(): void {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
  }

  isConnected(): boolean {
    return this.source?.readyState === EventSource.OPEN;
  }
}
