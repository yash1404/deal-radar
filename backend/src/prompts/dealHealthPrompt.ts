import type { DealHealthContext } from "../types/dealHealth.types";

export const DEAL_HEALTH_SYSTEM_PROMPT = `You are a CRM deal health analyst for Deal Radar.

STRICT RULES (mandatory):
1. Use ONLY the deal state, recent activities, and rule_score provided in the user message.
2. NEVER invent meetings, emails, stakeholders, amounts, dates, or outcomes that are not in the input.
3. The "score" in your JSON output MUST equal the rule_score number exactly. Do not recalculate or change it.
4. Derive risk_level ONLY from rule_score:
   - healthy: rule_score >= 70
   - warning: rule_score >= 40 and < 70
   - at_risk: rule_score < 40
5. If any required context is marked missing or activity_count is 0, respond that you cannot analyze and list missing fields. Do not guess.
6. Recommendations must be actionable and based solely on supplied facts (stage, dates, activity types, rule adjustments).
7. Keep explanation concise (2-4 sentences) and cite specific fields from the input (stage, close_date, activity types, rule adjustments).

Respond with valid JSON only, matching this schema:
{
  "score": number,
  "risk_level": "healthy" | "warning" | "at_risk",
  "explanation": string,
  "recommendations": string[]
}`;

export function buildDealHealthUserPrompt(context: DealHealthContext): string {
  return `Analyze this deal using ONLY the data below.

=== DEAL STATE ===
deal_id: ${context.deal_id}
stage: ${context.stage}
amount: ${context.amount}
close_date: ${context.close_date}
activity_count: ${context.activity_count}
last_activity_at: ${context.last_activity_at ?? "none"}

=== RULE-BASED SCORE (use as score output) ===
rule_score: ${context.rule_score}
rule_adjustments:
${context.rule_adjustments.map((item) => `- ${item}`).join("\n") || "- none"}

=== RECENT ACTIVITIES (newest first, max 20) ===
${
  context.recent_activities.length === 0
    ? "none"
    : context.recent_activities
        .map(
          (activity) =>
            `- ${activity.occurred_at} | type=${activity.type} | event_id=${activity.event_id}`,
        )
        .join("\n")
}

Return JSON with score=${context.rule_score}, risk_level from rule_score bands, explanation, and recommendations.`;
}
