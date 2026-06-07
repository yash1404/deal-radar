import type { IDeal } from "../models/deal.model";

export interface HealthScoreResult {
  health_score: number;
  health_reason: string;
}

const STAGE_BASE_SCORES: Record<string, number> = {
  prospecting: 35,
  qualification: 50,
  proposal: 65,
  negotiation: 78,
  closed_won: 95,
  closed_lost: 15,
};

const DEFAULT_STAGE_SCORE = 45;

type DealHealthInput = Pick<IDeal, "stage" | "amount" | "close_date">;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeStage(stage: string): string {
  return stage.trim().toLowerCase().replace(/\s+/g, "_");
}

function scoreFromCloseDate(closeDate: Date, now: Date): { delta: number; reason: string } {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / msPerDay);

  if (daysUntilClose < 0) {
    return {
      delta: -25,
      reason: `Close date is ${Math.abs(daysUntilClose)} day(s) overdue`,
    };
  }

  if (daysUntilClose <= 7) {
    return {
      delta: 10,
      reason: `Close date within ${daysUntilClose} day(s)`,
    };
  }

  if (daysUntilClose <= 30) {
    return {
      delta: 5,
      reason: `Close date within ${daysUntilClose} day(s)`,
    };
  }

  return {
    delta: -5,
    reason: `Close date is ${daysUntilClose} day(s) away`,
  };
}

function scoreFromAmount(amount: number): { delta: number; reason: string } {
  if (amount >= 100_000) {
    return { delta: 8, reason: "High deal value" };
  }

  if (amount >= 25_000) {
    return { delta: 4, reason: "Moderate deal value" };
  }

  if (amount > 0) {
    return { delta: 0, reason: "Standard deal value" };
  }

  return { delta: -10, reason: "Deal amount not set" };
}

export function calculateHealth(
  deal: DealHealthInput,
  now: Date = new Date(),
): HealthScoreResult {
  const normalizedStage = normalizeStage(deal.stage);
  const baseScore =
    STAGE_BASE_SCORES[normalizedStage] ?? DEFAULT_STAGE_SCORE;

  const closeDateImpact = scoreFromCloseDate(deal.close_date, now);
  const amountImpact = scoreFromAmount(deal.amount);

  const health_score = clampScore(
    baseScore + closeDateImpact.delta + amountImpact.delta,
  );

  const health_reason = [
    `Stage "${deal.stage}" base score ${baseScore}`,
    closeDateImpact.reason,
    amountImpact.reason,
    `Final health score ${health_score}`,
  ].join("; ");

  return { health_score, health_reason };
}
