"use client";

import { create } from "zustand";

import { DealRadarSseClient } from "@/services/sse";
import type { SsePayload, StreamEvent } from "@/types/api";

const MAX_EVENTS = 500;

export type StreamConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "paused"
  | "error";

export interface StreamFilters {
  eventType: string;
  dealId: string;
}

interface StreamState {
  events: StreamEvent[];
  pausedBuffer: StreamEvent[];
  connectionStatus: StreamConnectionStatus;
  error: string | null;
  isPaused: boolean;
  filters: StreamFilters;
  selectedEventId: string | null;
  connect: () => void;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
  setFilters: (filters: Partial<StreamFilters>) => void;
  clearFilters: () => void;
  selectEvent: (eventId: string) => void;
}

let sseClient: DealRadarSseClient | null = null;

function getClient(): DealRadarSseClient {
  if (!sseClient) {
    sseClient = new DealRadarSseClient();
  }
  return sseClient;
}

function trimEvents(events: StreamEvent[]): StreamEvent[] {
  if (events.length <= MAX_EVENTS) {
    return events;
  }
  return events.slice(0, MAX_EVENTS);
}

function mapSseToStreamEvent(payload: SsePayload): StreamEvent {
  const deal = payload.data.deal;
  const dealStage =
    typeof deal === "object" &&
    deal !== null &&
    "stage" in deal &&
    typeof (deal as { stage: unknown }).stage === "string"
      ? (deal as { stage: string }).stage
      : undefined;

  const summary = dealStage
    ? `Deal ${payload.deal_id} updated · ${dealStage}`
    : `Deal ${payload.deal_id} updated`;

  return {
    id: payload.event_id,
    dealId: payload.deal_id,
    type: payload.type,
    timestamp: payload.timestamp,
    summary,
    payload: payload.data,
  };
}

function prependEvent(events: StreamEvent[], event: StreamEvent): StreamEvent[] {
  if (events.some((item) => item.id === event.id)) {
    return events;
  }
  return trimEvents([event, ...events]);
}

export const useStreamStore = create<StreamState>((set, get) => ({
  events: [],
  pausedBuffer: [],
  connectionStatus: "idle",
  error: null,
  isPaused: false,
  filters: { eventType: "", dealId: "" },
  selectedEventId: null,

  connect: () => {
    const client = getClient();
    set({ connectionStatus: "connecting", error: null });

    client.connect({
      onOpen: () => {
        set((state) => ({
          connectionStatus: state.isPaused ? "paused" : "connected",
          error: null,
        }));
      },
      onEvent: (payload) => {
        const streamEvent = mapSseToStreamEvent(payload);
        const { isPaused, events, pausedBuffer } = get();

        if (isPaused) {
          set({
            pausedBuffer: prependEvent(pausedBuffer, streamEvent),
          });
          return;
        }

        set({
          events: prependEvent(events, streamEvent),
          connectionStatus: "connected",
          error: null,
        });
      },
      onError: (message) => {
        set({ connectionStatus: "error", error: message });
      },
      onStatusChange: (status) => {
        if (status === "connecting") {
          set({ connectionStatus: "connecting" });
        }
        if (status === "error") {
          set({ connectionStatus: "error" });
        }
      },
    });
  },

  disconnect: () => {
    getClient().disconnect();
    set({
      connectionStatus: "idle",
      events: [],
      pausedBuffer: [],
      selectedEventId: null,
      error: null,
    });
  },

  pause: () => {
    set({ isPaused: true, connectionStatus: "paused" });
  },

  resume: () => {
    set((state) => {
      const merged = trimEvents([...state.pausedBuffer, ...state.events]);
      return {
        isPaused: false,
        pausedBuffer: [],
        events: merged,
        connectionStatus: "connected",
      };
    });
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  clearFilters: () => {
    set({ filters: { eventType: "", dealId: "" } });
  },

  selectEvent: (eventId) => {
    set({ selectedEventId: eventId });
  },
}));
