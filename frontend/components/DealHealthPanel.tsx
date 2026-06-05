"use client";

import { formatCurrency, formatDate } from "@/lib/format";
import { useDealStore } from "@/store/dealStore";
import type { RiskLevel } from "@/types/api";

function riskBadgeClass(risk: RiskLevel | null): string {

  console.log("risk", risk);
  switch (risk) {
    case "healthy":
      return "bg-emerald-100 text-emerald-800";
    case "warning":
      return "bg-amber-100 text-amber-800";
    case "at_risk":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function sourceLabel(source: string | undefined): string {
  if (source === "openai") {
    return "OpenAI";
  }
  if (source === "rules") {
    return "Rule engine";
  }
  return "Unknown";
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <aside className="flex h-full flex-col bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">Deal Health</h2>
        <p className="text-sm text-zinc-500">
          Select an activity event to inspect deal health and AI insights.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </aside>
  );
}

export default function DealHealthPanel() {
  const selectedDealId = useDealStore((state) => state.selectedDealId);
  const deal = useDealStore((state) => state.deal);
  const health = useDealStore((state) => state.health);

  console.log("health", health);
  
  const isLoading = useDealStore((state) => state.isLoading);
  const error = useDealStore((state) => state.error);

  if (!selectedDealId) {
    return (
      <PanelShell>
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-500">
            Click an event in the activity stream to view deal details and AI health
            analysis.
          </p>
        </div>
      </PanelShell>
    );
  }

  if (isLoading) {
    return (
      <PanelShell>
        <div className="space-y-4">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
          <div className="h-32 animate-pulse rounded-xl bg-zinc-100" />
        </div>
      </PanelShell>
    );
  }

  if (error) {
    return (
      <PanelShell>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      </PanelShell>
    );
  }

  if (!deal) {
    return (
      <PanelShell>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Deal data is unavailable.
        </div>
      </PanelShell>
    );
  }

  const riskLevel = health?.health_status ?? null;
  const score = health?.health_score ?? deal.health_score;

  return (
    <PanelShell>
      <div className="space-y-5">
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Deal ID
              </p>
              <h3 className="text-xl font-semibold text-zinc-900">{deal.deal_id}</h3>
            </div>
            {riskLevel ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${riskBadgeClass(riskLevel)}`}
              >
                {riskLevel.replace("_", " ")}
              </span>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-zinc-500">Stage</dt>
              <dd className="font-medium text-zinc-900">{deal.stage}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Amount</dt>
              <dd className="font-medium text-zinc-900">{formatCurrency(deal.amount)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Close Date</dt>
              <dd className="font-medium text-zinc-900">{formatDate(deal.close_date)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Health Score</dt>
              <dd className="font-medium text-zinc-900">
                {score !== null ? `${score}/100` : "N/A"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-zinc-500">Insight source</dt>
              <dd className="font-medium text-zinc-900">
                {sourceLabel(health?.source)}
              </dd>
            </div>
          </dl>
        </section>

        {health?.health_reason ? (
          <section className="rounded-xl border border-zinc-200 p-4">
            <h4 className="mb-2 text-sm font-semibold text-zinc-900">
              {health.source === "openai" ? "AI Explanation" : "Health Analysis"}
            </h4>
            <p className="text-sm leading-6 text-zinc-700">{health.health_reason}</p>
          </section>
        ) : null}

        {health?.health_score === null ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-amber-900">
              Insufficient data
            </h4>
            <p className="text-sm text-amber-800">
              {health.health_reason || "Cannot score this deal yet."}
            </p>
          </section>
        ) : null}

        <section className="rounded-xl border border-zinc-200 p-4 text-xs text-zinc-500">
          <p>Updated: {formatDate(deal.metadata.updated_at)}</p>
          <p>Created: {formatDate(deal.metadata.created_at)}</p>
        </section>
      </div>
    </PanelShell>
  );
}
