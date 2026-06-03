export type DealHealthStatus = "ok" | "insufficient_data";

export type RiskLevel = "healthy" | "warning" | "at_risk";

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

export type DealHealthResponse =
  | InsufficientDealHealthResponse
  | DealHealthInsightResponse;

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
