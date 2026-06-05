"use client";

import { useEffect, useMemo, useRef } from "react";

import EventCard from "@/components/EventCard";
import Filters from "@/components/Filters";
import { useStreamStore } from "@/store/streamStore";

function connectionLabel(status: string): string {
  switch (status) {
    case "connected":
      return "Live";
    case "connecting":
      return "Connecting";
    case "paused":
      return "Paused";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

function connectionDotClass(status: string): string {
  switch (status) {
    case "connected":
      return "bg-emerald-500";
    case "connecting":
      return "bg-amber-400 animate-pulse";
    case "paused":
      return "bg-zinc-400";
    case "error":
      return "bg-rose-500";
    default:
      return "bg-zinc-300";
  }
}

export default function ActivityStream() {
  const pause = useStreamStore((state) => state.pause);
  const resume = useStreamStore((state) => state.resume);
  const connectionStatus = useStreamStore((state) => state.connectionStatus);
  const error = useStreamStore((state) => state.error);
  const isPaused = useStreamStore((state) => state.isPaused);
  const events = useStreamStore((state) => state.events);
  const filters = useStreamStore((state) => state.filters);

  const listRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const { connect, disconnect } = useStreamStore.getState();
    connect();
    return () => {
      disconnect();
    };
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.eventType && event.type !== filters.eventType) {
        return false;
      }
      if (
        filters.dealId &&
        !event.dealId.toLowerCase().includes(filters.dealId.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [events, filters.dealId, filters.eventType]);

  useEffect(() => {
    if (isPaused || !shouldAutoScrollRef.current || !listRef.current) {
      return;
    }

    listRef.current.scrollTop = 0;
  }, [filteredEvents.length, isPaused]);

  const handleScroll = (): void => {
    const container = listRef.current;
    if (!container) {
      return;
    }

    shouldAutoScrollRef.current = container.scrollTop < 48;
  };

  const isLoading = connectionStatus === "connecting" && events.length === 0;
  const isEmpty = !isLoading && filteredEvents.length === 0 && connectionStatus !== "error";

  return (
    <section className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Activity Stream</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${connectionDotClass(connectionStatus)}`}
            />
            <span>{connectionLabel(connectionStatus)}</span>
            <span>·</span>
            <span>{events.length} events buffered</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPaused ? (
            <button
              type="button"
              onClick={resume}
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={pause}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Pause
            </button>
          )}
        </div>
      </header>

      <Filters />

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-xl bg-zinc-100"
              />
            ))}
          </div>
        ) : null}

        {connectionStatus === "error" ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error ?? "Unable to connect to the activity stream."}
          </div>
        ) : null}

        {isEmpty ? (
          <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
            <p className="text-sm text-zinc-500">
              No activity yet. Events will appear here in real time when deals are
              updated via webhook processing.
            </p>
          </div>
        ) : null}

        {!isLoading && filteredEvents.length > 0 ? (
          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
