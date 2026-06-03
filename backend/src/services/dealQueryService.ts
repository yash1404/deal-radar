import type { QueryFilter, SortOrder as MongooseSortOrder } from "mongoose";

import { Deal, type IDeal } from "../models/deal.model";
import { Event, type IEvent } from "../models/event.model";
import type {
  DealDetailResponse,
  DealEventItem,
  DealEventsResponse,
  DealListItem,
  HealthStatus,
  ListDealsQuery,
  PaginatedDealsResponse,
} from "../types/dealApi.types";
import { DealNotFoundError } from "./dealService";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveHealthStatus(healthScore: number): HealthStatus {
  if (healthScore >= 70) {
    return "healthy";
  }

  if (healthScore >= 40) {
    return "at_risk";
  }

  return "critical";
}

function buildHealthScoreFilter(
  healthStatus: HealthStatus,
): QueryFilter<IDeal>["health_score"] {
  switch (healthStatus) {
    case "healthy":
      return { $gte: 70 };
    case "at_risk":
      return { $gte: 40, $lt: 70 };
    case "critical":
      return { $lt: 40 };
  }
}

function buildDealFilter(query: ListDealsQuery): QueryFilter<IDeal> {
  const filter: QueryFilter<IDeal> = {};

  if (query.stage) {
    filter.stage = {
      $regex: new RegExp(`^${escapeRegex(query.stage)}$`, "i"),
    };
  }

  if (query.healthStatus) {
    filter.health_score = buildHealthScoreFilter(query.healthStatus);
  }

  if (query.search) {
    filter.deal_id = { $regex: escapeRegex(query.search), $options: "i" };
  }

  return filter;
}

function toDealListItem(deal: IDeal): DealListItem {
  return {
    deal_id: deal.deal_id,
    stage: deal.stage,
    amount: deal.amount,
    close_date: deal.close_date.toISOString(),
    health_score: deal.health_score,
    health_reason: deal.health_reason,
    health_status: resolveHealthStatus(deal.health_score),
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

function toDealDetailResponse(deal: IDeal): DealDetailResponse {
  return {
    deal_id: deal.deal_id,
    stage: deal.stage,
    amount: deal.amount,
    close_date: deal.close_date.toISOString(),
    health_score: deal.health_score,
    health_reason: deal.health_reason,
    health_status: resolveHealthStatus(deal.health_score),
    metadata: {
      created_at: deal.createdAt.toISOString(),
      updated_at: deal.updatedAt.toISOString(),
    },
  };
}

function toDealEventItem(event: IEvent): DealEventItem {
  return {
    event_id: event.event_id,
    deal_id: event.deal_id,
    type: event.type,
    payload: event.payload,
    occurred_at: event.occurred_at.toISOString(),
    createdAt: event.createdAt.toISOString(),
  };
}

export async function listDeals(
  query: ListDealsQuery,
): Promise<PaginatedDealsResponse> {
  const filter = buildDealFilter(query);
  const sortDirection: MongooseSortOrder = query.sortOrder === "asc" ? 1 : -1;
  const sort = { [query.sortBy]: sortDirection } as Record<string, MongooseSortOrder>;
  const skip = (query.page - 1) * query.limit;

  const [deals, total] = await Promise.all([
    Deal.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .lean<IDeal[]>()
      .exec(),
    Deal.countDocuments(filter).exec(),
  ]);

  return {
    data: deals.map(toDealListItem),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function getDealByDealId(dealId: string): Promise<DealDetailResponse> {
  const deal = await Deal.findOne({ deal_id: dealId }).lean<IDeal>().exec();

  if (!deal) {
    throw new DealNotFoundError(dealId);
  }

  return toDealDetailResponse(deal);
}

export async function getDealEvents(
  dealId: string,
  limit: number,
): Promise<DealEventsResponse> {
  const dealExists = await Deal.exists({ deal_id: dealId });
  if (!dealExists) {
    throw new DealNotFoundError(dealId);
  }

  const [events, total] = await Promise.all([
    Event.find({ deal_id: dealId })
      .sort({ occurred_at: -1 })
      .limit(limit)
      .lean<IEvent[]>()
      .exec(),
    Event.countDocuments({ deal_id: dealId }).exec(),
  ]);

  return {
    deal_id: dealId,
    data: events.map(toDealEventItem),
    total,
  };
}
