import type { IDeal } from "../models/deal.model";
import type { IEvent } from "../models/event.model";
import type { RiskLevel } from "../types/dealHealth.types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DISCOVERY_STAGE = "discovery";

export interface RuleHealthEvaluation {
  score: number;
  health_status: RiskLevel;
  health_reason: string;
  reasons: string[];
}

function normalizeStage(stage: string): string {
  return stage.trim().toLowerCase().replace(/\s+/g, "_");
}

function isDiscoveryStage(stage: string): boolean {
  const normalized = normalizeStage(stage);
  return normalized === DISCOVERY_STAGE || normalized === "discovery";
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function getLastActivityDate(events: IEvent[]): Date | null {
  if (events.length === 0) {
    return null;
  }

  return events.reduce((latest, event) => {
    return event.occurred_at > latest ? event.occurred_at : latest;
  }, events[0]!.occurred_at);
}

export function resolveHealthStatus(score: number): RiskLevel {
  if (score >= 80) {
    return "healthy";
  }

  if (score >= 50) {
    return "warning";
  }

  return "at_risk";
}

export function buildRuleHealthReason(reasons: string[]): string {
  if (reasons.length === 0) {
    return "No significant risk signals detected.";
  }

  return reasons.join(" ");
}

export function evaluateRuleHealth(
  deal: IDeal,
  events: IEvent[],
  now: Date = new Date(),
): RuleHealthEvaluation {
  let score = 100;
  const reasons: string[] = [];

  if (events.length === 0) {
    score -= 40;
    reasons.push("Deal has no activity history.");
  } else {
    const lastActivityAt = getLastActivityDate(events);
    if (lastActivityAt) {
      const daysSinceActivity = daysBetween(lastActivityAt, now);
      if (daysSinceActivity >= 30) {
        score -= 30;
        reasons.push("No recent activity detected.");
      }
    }
  }

  const daysUntilClose = daysBetween(now, deal.close_date);
  if (isDiscoveryStage(deal.stage) && daysUntilClose >= 0 && daysUntilClose <= 7) {
    score -= 20;
    reasons.push("Discovery stage with close date within 7 days.");
  }

  if (deal.close_date.getTime() < now.getTime()) {
    score -= 25;
    reasons.push("Close date is overdue.");
  }

  if (deal.amount > 100_000 && isDiscoveryStage(deal.stage)) {
    score -= 10;
    reasons.push("Deal remains in Discovery despite high value.");
  }

  const finalScore = clampScore(score);
  const health_status = resolveHealthStatus(finalScore);
  const health_reason = buildRuleHealthReason(reasons);

  return {
    score: finalScore,
    health_status,
    health_reason,
    reasons,
  };
}
