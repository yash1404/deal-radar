"use client";

import { useMemo } from "react";

import { useStreamStore } from "@/store/streamStore";

export default function Filters() {
  const filters = useStreamStore((state) => state.filters);
  const events = useStreamStore((state) => state.events);
  const setFilters = useStreamStore((state) => state.setFilters);
  const clearFilters = useStreamStore((state) => state.clearFilters);

  const eventTypes = useMemo(() => {
    const types = new Set(events.map((event) => event.type));
    return Array.from(types).sort();
  }, [events]);

  const dealIds = useMemo(() => {
    const ids = new Set(events.map((event) => event.dealId));
    return Array.from(ids).sort();
  }, [events]);

  const hasActiveFilters = Boolean(filters.eventType || filters.dealId);

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="min-w-[160px] flex-1">
        <label
          htmlFor="event-type-filter"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Event type
        </label>
        <select
          id="event-type-filter"
          value={filters.eventType}
          onChange={(event) => setFilters({ eventType: event.target.value })}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        >
          <option value="">All types</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[160px] flex-1">
        <label
          htmlFor="deal-filter"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Deal
        </label>
        <input
          id="deal-filter"
          list="deal-id-options"
          value={filters.dealId}
          onChange={(event) => setFilters({ dealId: event.target.value })}
          placeholder="Filter by deal ID"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <datalist id="deal-id-options">
          {dealIds.map((dealId) => (
            <option key={dealId} value={dealId} />
          ))}
        </datalist>
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
