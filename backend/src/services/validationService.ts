import { Deal, type IDeal } from "../models/deal.model";
import { Event, type IEvent } from "../models/event.model";
import { DealNotFoundError } from "./dealService";

export interface DealHealthValidationSuccess {
  sufficient: true;
  deal: IDeal;
  events: IEvent[];
}

export interface DealHealthValidationFailure {
  sufficient: false;
  missingFields: string[];
  reason: string;
}

export type DealHealthValidationResult =
  | DealHealthValidationSuccess
  | DealHealthValidationFailure;

const INSUFFICIENT_REASON =
  "Cannot score deal because required information is missing";

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function hasStage(deal: IDeal): boolean {
  return typeof deal.stage === "string" && deal.stage.trim().length > 0;
}

function hasCloseDate(deal: IDeal): boolean {
  return isValidDate(deal.close_date);
}

function hasAmount(deal: IDeal): boolean {
  return typeof deal.amount === "number" && !Number.isNaN(deal.amount);
}

export function validateDealHealthInputs(
  deal: IDeal | null,
  events: IEvent[],
): DealHealthValidationResult {
  const missingFields: string[] = [];

  if (!deal) {
    return {
      sufficient: false,
      missingFields: ["deal"],
      reason: INSUFFICIENT_REASON,
    };
  }

  if (!hasStage(deal)) {
    missingFields.push("stage");
  }

  if (!hasCloseDate(deal)) {
    missingFields.push("close_date");
  }

  if (!hasAmount(deal)) {
    missingFields.push("amount");
  }

  if (missingFields.length > 0) {
    return {
      sufficient: false,
      missingFields,
      reason: INSUFFICIENT_REASON,
    };
  }

  return {
    sufficient: true,
    deal,
    events,
  };
}

export async function loadDealHealthContext(
  dealId: string,
): Promise<{ deal: IDeal | null; events: IEvent[] }> {
  const deal = await Deal.findOne({ deal_id: dealId }).lean<IDeal>().exec();
  if (!deal) {
    throw new DealNotFoundError(dealId);
  }

  const events = await Event.find({ deal_id: dealId })
    .sort({ occurred_at: -1 })
    .lean<IEvent[]>()
    .exec();

  return { deal, events };
}

export async function validateDealForHealthScoring(
  dealId: string,
): Promise<DealHealthValidationResult> {
  const { deal, events } = await loadDealHealthContext(dealId);
  return validateDealHealthInputs(deal, events);
}
