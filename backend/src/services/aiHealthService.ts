import OpenAI from "openai";

import type { IDeal } from "../models/deal.model";
import type { IEvent } from "../models/event.model";
import {
  buildDealHealthUserPrompt,
  DEAL_HEALTH_SYSTEM_PROMPT,
} from "../prompts/dealHealthPrompt";
import type {
  DealHealthContext,
  DealHealthResponse,
  InsufficientDealHealthResponse,
  RiskLevel,
  RuleScoreResult,
} from "../types/dealHealth.types";
import { validateDealForHealthScoring } from "./validationService";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DISCOVERY_STAGE = "discovery";

export class AiHealthServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiHealthServiceError";
  }
}

function normalizeStage(stage: string): string {
  return stage.trim().toLowerCase().replace(/\s+/g, "_");
}

function isDiscoveryStage(stage: string): boolean {
  return normalizeStage(stage) === DISCOVERY_STAGE;
}

function isMeetingEvent(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return normalized.includes("meeting");
}

function isEmailEvent(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return normalized.includes("email");
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

export function calculateRuleBasedHealthScore(
  deal: IDeal,
  events: IEvent[],
  now: Date = new Date(),
): RuleScoreResult {
  let score = 100;
  const adjustments: string[] = [];

  const lastActivityAt = getLastActivityDate(events);
  if (lastActivityAt) {
    const daysSinceActivity = daysBetween(lastActivityAt, now);
    if (daysSinceActivity >= 30) {
      score -= 30;
      adjustments.push(
        `No activity for ${daysSinceActivity} days (last activity ${lastActivityAt.toISOString()})`,
      );
    }
  }

  const daysUntilClose = daysBetween(now, deal.close_date);
  if (isDiscoveryStage(deal.stage) && daysUntilClose >= 0 && daysUntilClose <= 7) {
    score -= 20;
    adjustments.push(
      `Discovery stage with close date in ${daysUntilClose} day(s)`,
    );
  }

  if (deal.close_date.getTime() < now.getTime()) {
    score -= 25;
    adjustments.push("Close date has already passed");
  }

  const hasRecentMeeting = events.some((event) => {
    if (!isMeetingEvent(event.type)) {
      return false;
    }

    return daysBetween(event.occurred_at, now) <= 7;
  });

  if (hasRecentMeeting) {
    score += 10;
    adjustments.push("Recent meeting within 7 days");
  }

  const hasRecentEmail = events.some((event) => {
    if (!isEmailEvent(event.type)) {
      return false;
    }

    return daysBetween(event.occurred_at, now) <= 7;
  });

  if (hasRecentEmail) {
    score += 5;
    adjustments.push("Recent email within 7 days");
  }

  return {
    score: clampScore(score),
    adjustments,
  };
}

function resolveRiskLevel(score: number): RiskLevel {
  if (score >= 70) {
    return "healthy";
  }

  if (score >= 40) {
    return "warning";
  }

  return "at_risk";
}

function buildInsufficientResponse(
  missingFields: string[],
): InsufficientDealHealthResponse {
  return {
    status: "insufficient_data",
    score: null,
    reason: "Cannot score deal because required information is missing",
    missing_fields: missingFields,
  };
}

function buildHealthContext(
  deal: IDeal,
  events: IEvent[],
  ruleScore: RuleScoreResult,
): DealHealthContext {
  const sortedEvents = [...events].sort(
    (a, b) => b.occurred_at.getTime() - a.occurred_at.getTime(),
  );
  const lastActivityAt = getLastActivityDate(events);

  return {
    deal_id: deal.deal_id,
    stage: deal.stage,
    amount: deal.amount,
    close_date: deal.close_date.toISOString(),
    activity_count: events.length,
    last_activity_at: lastActivityAt?.toISOString() ?? null,
    recent_activities: sortedEvents.slice(0, 20).map((event) => ({
      event_id: event.event_id,
      type: event.type,
      occurred_at: event.occurred_at.toISOString(),
    })),
    rule_score: ruleScore.score,
    rule_adjustments: ruleScore.adjustments,
  };
}

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiHealthServiceError("OPENAI_API_KEY is not configured");
  }

  return new OpenAI({ apiKey });
}

interface AiExplanationPayload {
  score: number;
  risk_level: RiskLevel;
  explanation: string;
  recommendations: string[];
}

function parseAiExplanation(
  content: string,
  ruleScore: number,
): AiExplanationPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new AiHealthServiceError("OpenAI returned invalid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new AiHealthServiceError("OpenAI response must be a JSON object");
  }

  const record = parsed as Record<string, unknown>;
  const score = Number(record.score);
  const risk_level = record.risk_level;
  const explanation = record.explanation;
  const recommendations = record.recommendations;

  if (Number.isNaN(score) || score !== ruleScore) {
    throw new AiHealthServiceError(
      "OpenAI score must match the provided rule_score exactly",
    );
  }

  if (
    risk_level !== "healthy" &&
    risk_level !== "warning" &&
    risk_level !== "at_risk"
  ) {
    throw new AiHealthServiceError("OpenAI returned an invalid risk_level");
  }

  if (typeof explanation !== "string" || explanation.trim().length === 0) {
    throw new AiHealthServiceError("OpenAI returned an invalid explanation");
  }

  if (!Array.isArray(recommendations)) {
    throw new AiHealthServiceError("OpenAI returned invalid recommendations");
  }

  const normalizedRecommendations = recommendations
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const expectedRisk = resolveRiskLevel(ruleScore);
  if (risk_level !== expectedRisk) {
    throw new AiHealthServiceError(
      "OpenAI risk_level does not match rule_score bands",
    );
  }

  return {
    score,
    risk_level,
    explanation: explanation.trim(),
    recommendations: normalizedRecommendations,
  };
}

async function generateAiExplanation(
  context: DealHealthContext,
): Promise<AiExplanationPayload> {
  const client = getOpenAiClient();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  console.log(
    `[AiHealthService] Requesting OpenAI explanation deal_id=${context.deal_id} model=${model}`,
  );

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: DEAL_HEALTH_SYSTEM_PROMPT },
      { role: "user", content: buildDealHealthUserPrompt(context) },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AiHealthServiceError("OpenAI returned an empty response");
  }

  return parseAiExplanation(content, context.rule_score);
}

export async function getDealHealthInsight(
  dealId: string,
): Promise<DealHealthResponse> {
  const validation = await validateDealForHealthScoring(dealId);

  if (!validation.sufficient) {
    console.log(
      `[AiHealthService] Insufficient data deal_id=${dealId} missing=${validation.missingFields.join(",")}`,
    );
    return buildInsufficientResponse(validation.missingFields);
  }

  const { deal, events } = validation;
  const ruleScore = calculateRuleBasedHealthScore(deal, events);
  const context = buildHealthContext(deal, events, ruleScore);

  console.log(
    `[AiHealthService] Rule score deal_id=${dealId} score=${ruleScore.score}`,
  );

  try {
    const aiResult = await generateAiExplanation(context);

    return {
      status: "ok",
      score: aiResult.score,
      rule_score: ruleScore.score,
      risk_level: aiResult.risk_level,
      explanation: aiResult.explanation,
      recommendations: aiResult.recommendations,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[AiHealthService] AI explanation failed deal_id=${dealId}: ${message}`,
    );
    throw error;
  }
}
