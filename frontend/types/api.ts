export type HealthStatus = "healthy" | "at_risk" | "critical";

export type RiskLevel = "healthy" | "warning" | "at_risk";

export type HealthInsightSource = "openai" | "rules";

export interface DealDetail {
  deal_id: string;
  stage: string;
  amount: number;
  close_date: string;
  health_score: number;
  health_reason: string;
  health_status: HealthStatus;
  metadata: {
    created_at: string;
    updated_at: string;
  };
}

export interface DealHealth {
  deal_id: string;
  health_score: number | null;
  health_status: RiskLevel | null;
  health_reason: string;
  source: HealthInsightSource;
}

export interface SsePayload {
  type: string;
  deal_id: string;
  event_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface StreamEvent {
  id: string;
  dealId: string;
  type: string;
  timestamp: string;
  summary: string;
  payload: Record<string, unknown>;
}
