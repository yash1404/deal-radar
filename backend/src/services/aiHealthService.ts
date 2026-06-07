import OpenAI from "openai";

import {
  buildDealHealthUserPrompt,
  DEAL_HEALTH_SYSTEM_PROMPT,
} from "../prompts/dealHealthPrompt";
import type {
  DealHealthApiResponse,
  DealHealthContext,
  RiskLevel,
} from "../types/dealHealth.types";
import { DealNotFoundError } from "./dealService";
import { evaluateRuleHealth, resolveHealthStatus } from "./ruleHealthEngine";
import {
  loadDealHealthContext,
  validateDealHealthInputs,
} from "./validationService";

export class AiHealthServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiHealthServiceError";
  }
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildHealthContext(
  deal: import("../models/deal.model").IDeal,
  events: import("../models/event.model").IEvent[],
  ruleScore: number,
  ruleAdjustments: string[],
): DealHealthContext {
  const sortedEvents = [...events].sort(
    (a, b) => b.occurred_at.getTime() - a.occurred_at.getTime(),
  );
  const lastActivityAt =
    events.length > 0
      ? sortedEvents.reduce(
          (latest, event) =>
            event.occurred_at > latest ? event.occurred_at : latest,
          sortedEvents[0]!.occurred_at,
        )
      : null;

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
    rule_score: ruleScore,
    rule_adjustments: ruleAdjustments,
  };
}

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiHealthServiceError("OPENAI_API_KEY is not configured");
  }

  return new OpenAI({ apiKey });
}

function isOpenAiUnavailableError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return true;
  }

  if (error instanceof AiHealthServiceError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("fetch failed")
    );
  }

  return false;
}

function getOpenAiErrorLogMessage(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    return `status=${error.status} type=${error.type ?? "unknown"} message=${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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

  const expectedRisk = resolveHealthStatus(ruleScore);
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
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 20_000);

  console.log(
    `[AiHealthService] Requesting OpenAI explanation deal_id=${context.deal_id} model=${model}`,
  );

  const completion = await client.chat.completions.create(
    {
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: DEAL_HEALTH_SYSTEM_PROMPT },
        { role: "user", content: buildDealHealthUserPrompt(context) },
      ],
    },
    { timeout: timeoutMs },
  );

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AiHealthServiceError("OpenAI returned an empty response");
  }

  return parseAiExplanation(content, context.rule_score);
}

function buildRuleFallbackResponse(
  dealId: string,
  evaluation: ReturnType<typeof evaluateRuleHealth>,
): DealHealthApiResponse {
  return {
    deal_id: dealId,
    health_score: evaluation.score,
    health_status: evaluation.health_status,
    health_reason: evaluation.health_reason,
    source: "rules",
  };
}

function buildInsufficientResponse(
  dealId: string,
  missingFields: string[],
): DealHealthApiResponse {
  const fieldsList = missingFields.join(", ");
  return {
    deal_id: dealId,
    health_score: null,
    health_status: null,
    health_reason: `Cannot score deal because required information is missing: ${fieldsList}.`,
    source: "rules",
  };
}

function buildOpenAiSuccessResponse(
  dealId: string,
  aiResult: AiExplanationPayload,
): DealHealthApiResponse {
  const recommendationsText =
    aiResult.recommendations.length > 0
      ? ` Recommendations: ${aiResult.recommendations.join(" ")}`
      : "";

  return {
    deal_id: dealId,
    health_score: clampScore(aiResult.score),
    health_status: aiResult.risk_level,
    health_reason: `${aiResult.explanation}${recommendationsText}`.trim(),
    source: "openai",
  };
}

export async function getDealHealthInsight(
  dealId: string,
): Promise<DealHealthApiResponse> {
  const { deal, events } = await loadDealHealthContext(dealId);

  if (!deal) {
    throw new DealNotFoundError(dealId);
  }

  const validation = validateDealHealthInputs(deal, events);

  if (!validation.sufficient) {
    console.log(
      `[AiHealthService] Insufficient data deal_id=${dealId} missing=${validation.missingFields.join(",")}`,
    );
    return buildInsufficientResponse(dealId, validation.missingFields);
  }

  const ruleEvaluation = evaluateRuleHealth(validation.deal, validation.events);
  const context = buildHealthContext(
    validation.deal,
    validation.events,
    ruleEvaluation.score,
    ruleEvaluation.reasons,
  );

  console.log(
    `[AiHealthService] Rule score deal_id=${dealId} score=${ruleEvaluation.score}`,
  );

  try {
    const aiResult = await generateAiExplanation(context);
    return buildOpenAiSuccessResponse(dealId, aiResult);
  } catch (error) {
    if (!isOpenAiUnavailableError(error)) {
      const message = getOpenAiErrorLogMessage(error);
      console.error(
        `[AiHealthService] Unexpected error deal_id=${dealId}: ${message}`,
      );
      return buildRuleFallbackResponse(dealId, ruleEvaluation);
    }

    console.warn(
      `[AI Health] OpenAI unavailable, using rule engine. deal_id=${dealId} reason=${getOpenAiErrorLogMessage(error)}`,
    );
    return buildRuleFallbackResponse(dealId, ruleEvaluation);
  }
}
