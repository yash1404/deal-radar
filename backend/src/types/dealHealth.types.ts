export type RiskLevel = "healthy" | "warning" | "at_risk";

export type HealthInsightSource = "openai" | "rules";

export interface DealHealthApiResponse {
  deal_id: string;
  health_score: number | null;
  health_status: RiskLevel | null;
  health_reason: string;
  source: HealthInsightSource;
}

export interface RuleScoreResult {
  score: number;
  adjustments: string[];
}

export interface DealHealthContext {
  deal_id: string;
  stage: string;
  amount: number;
  close_date: string;
  activity_count: number;
  last_activity_at: string | null;
  recent_activities: Array<{
    event_id: string;
    type: string;
    occurred_at: string;
  }>;
  rule_score: number;
  rule_adjustments: string[];
}

/** @deprecated Legacy shape — health endpoint now returns DealHealthApiResponse */
export type DealHealthStatus = "ok" | "insufficient_data";

export interface InsufficientDealHealthResponse {
  status: "insufficient_data";
  score: null;
  reason: string;
  missing_fields: string[];
}

export interface DealHealthInsightResponse {
  status: "ok";
  score: number;
  rule_score: number;
  risk_level: RiskLevel;
  explanation: string;
  recommendations: string[];
}

export type DealHealthResponse = DealHealthApiResponse;
