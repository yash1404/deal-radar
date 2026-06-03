export type HealthStatus = "healthy" | "at_risk" | "critical";

export type DealSortField =
  | "deal_id"
  | "stage"
  | "amount"
  | "close_date"
  | "health_score"
  | "createdAt"
  | "updatedAt";

export type SortOrder = "asc" | "desc";

export interface ListDealsQuery {
  page: number;
  limit: number;
  sortBy: DealSortField;
  sortOrder: SortOrder;
  stage?: string;
  healthStatus?: HealthStatus;
  search?: string;
}

export interface DealListItem {
  deal_id: string;
  stage: string;
  amount: number;
  close_date: string;
  health_score: number;
  health_reason: string;
  health_status: HealthStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedDealsResponse {
  data: DealListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface DealMetadata {
  created_at: string;
  updated_at: string;
}

export interface DealDetailResponse {
  deal_id: string;
  stage: string;
  amount: number;
  close_date: string;
  health_score: number;
  health_reason: string;
  health_status: HealthStatus;
  metadata: DealMetadata;
}

export interface DealEventItem {
  event_id: string;
  deal_id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  createdAt: string;
}

export interface DealEventsResponse {
  deal_id: string;
  data: DealEventItem[];
  total: number;
}
