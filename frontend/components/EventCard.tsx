"use client";

import { memo, useCallback } from "react";

import { formatDateTime } from "@/lib/format";
import { useDealStore } from "@/store/dealStore";
import { useStreamStore } from "@/store/streamStore";
import type { StreamEvent } from "@/types/api";

interface EventCardProps {
  event: StreamEvent;
}

function EventCardComponent({ event }: EventCardProps) {
  const selectedEventId = useStreamStore((state) => state.selectedEventId);
  const selectEvent = useStreamStore((state) => state.selectEvent);
  const loadDealInsights = useDealStore((state) => state.loadDealInsights);

  const isSelected = selectedEventId === event.id;

  const handleClick = useCallback(() => {
    selectEvent(event.id);
    console.log("event", event);
    void loadDealInsights(event.dealId, event.id);
  }, [event.dealId, event.id, loadDealInsights, selectEvent]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        isSelected
          ? "border-sky-500 bg-sky-50 shadow-sm"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
          {event.type}
        </span>
        <time className="text-xs text-zinc-500">{formatDateTime(event.timestamp)}</time>
      </div>
      <p className="text-sm font-medium text-zinc-900">{event.summary}</p>
      <p className="mt-1 text-xs text-zinc-500">Deal ID: {event.dealId}</p>
    </button>
  );
}

const EventCard = memo(EventCardComponent);
export default EventCard;
