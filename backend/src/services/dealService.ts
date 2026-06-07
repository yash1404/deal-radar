import type { ClientSession } from "mongoose";

import { Deal, type IDeal } from "../models/deal.model";
import {
  calculateHealth,
  type HealthScoreResult,
} from "./healthScoringService";

const DEFAULT_STAGE = "prospecting";
const DEFAULT_AMOUNT = 0;
const DEFAULT_CLOSE_DAYS = 30;

export class DealNotFoundError extends Error {
  constructor(dealId: string) {
    super(`Deal not found: ${dealId}`);
    this.name = "DealNotFoundError";
  }
}

function readString(
  payload: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = payload[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(
  payload: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = payload[key];
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function readDate(
  payload: Record<string, unknown>,
  key: string,
): Date | undefined {
  const value = payload[key];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
}

function defaultCloseDate(from: Date): Date {
  const closeDate = new Date(from);
  closeDate.setDate(closeDate.getDate() + DEFAULT_CLOSE_DAYS);
  return closeDate;
}

function buildDealDefaults(
  dealId: string,
  payload: Record<string, unknown>,
  occurredAt: Date,
): Pick<IDeal, "deal_id" | "stage" | "amount" | "close_date"> {
  return {
    deal_id: dealId,
    stage: readString(payload, "stage") ?? DEFAULT_STAGE,
    amount: readNumber(payload, "amount") ?? DEFAULT_AMOUNT,
    close_date: readDate(payload, "close_date") ?? defaultCloseDate(occurredAt),
  };
}

export async function findDealByDealId(
  dealId: string,
  session?: ClientSession,
): Promise<IDeal | null> {
  const query = Deal.findOne({ deal_id: dealId });
  if (session) {
    query.session(session);
  }

  return query.lean<IDeal>().exec();
}

export async function updateDealFromEvent(
  dealId: string,
  eventType: string,
  payload: Record<string, unknown>,
  occurredAt: Date,
  session?: ClientSession,
): Promise<IDeal> {
  const query = Deal.findOne({ deal_id: dealId });
  if (session) {
    query.session(session);
  }

  let deal = await query.exec();

  if (!deal) {
    const defaults = buildDealDefaults(dealId, payload, occurredAt);
    const initialHealth = calculateHealth(defaults, occurredAt);

    const created = await Deal.create(
      [
        {
          ...defaults,
          health_score: initialHealth.health_score,
          health_reason: initialHealth.health_reason,
        },
      ],
      session ? { session } : undefined,
    );

    deal = created[0] ?? null;
    console.log(
      `[DealService] Created deal deal_id=${dealId} from event type=${eventType}`,
    );
  } else {
    const stage = readString(payload, "stage");
    const amount = readNumber(payload, "amount");
    const closeDate = readDate(payload, "close_date");

    if (stage !== undefined) {
      deal.stage = stage;
    }

    if (amount !== undefined) {
      deal.amount = amount;
    }

    if (closeDate !== undefined) {
      deal.close_date = closeDate;
    }

    await deal.save(session ? { session } : undefined);
    console.log(
      `[DealService] Updated deal deal_id=${dealId} from event type=${eventType}`,
    );
  }

  if (!deal) {
    throw new DealNotFoundError(dealId);
  }

  return deal.toObject();
}

export async function applyHealthToDeal(
  dealId: string,
  health: HealthScoreResult,
  session?: ClientSession,
): Promise<IDeal> {
  const query = Deal.findOneAndUpdate(
    { deal_id: dealId },
    {
      $set: {
        health_score: health.health_score,
        health_reason: health.health_reason,
      },
    },
    { new: true, runValidators: true },
  );

  if (session) {
    query.session(session);
  }

  const deal = await query.exec();
  if (!deal) {
    throw new DealNotFoundError(dealId);
  }

  console.log(
    `[DealService] Health updated deal_id=${dealId} score=${health.health_score}`,
  );

  return deal.toObject();
}

export async function recalculateDealHealth(
  dealId: string,
  session?: ClientSession,
  now: Date = new Date(),
): Promise<{ deal: IDeal; health: HealthScoreResult }> {
  const deal = await findDealByDealId(dealId, session);
  if (!deal) {
    throw new DealNotFoundError(dealId);
  }

  const health = calculateHealth(deal, now);
  const updatedDeal = await applyHealthToDeal(dealId, health, session);

  return { deal: updatedDeal, health };
}
