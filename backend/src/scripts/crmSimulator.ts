import "dotenv/config";

import axios from "axios";

type CrmSource = "salesforce" | "hubspot";

type SimEventType =
  | "stage_changed"
  | "email_sent"
  | "meeting_booked"
  | "note_added"
  | "deal_closed";

interface SimDealState {
  dealId: string;
  stage: string;
  amount: number;
  closeDate: Date;
  skipActivity: boolean;
  eventSequence: number;
}

interface CrmSimulatorEvent {
  event_id: string;
  deal_id: string;
  type: SimEventType;
  stage: string;
  amount: number;
  close_date: string;
  source: CrmSource;
  is_source_of_truth: boolean;
  occurred_at: string;
  payload: Record<string, unknown>;
}

const DEAL_IDS = ["D-1001", "D-1002", "D-1003", "D-1004", "D-1005"] as const;
const STAGE_FLOW = [
  "Discovery",
  "Qualification",
  "Negotiation",
  "Closed-Won",
  "Closed-Lost",
] as const;

const EVENT_TYPES: SimEventType[] = [
  "stage_changed",
  "email_sent",
  "meeting_booked",
  "note_added",
  "deal_closed",
];

const WEBHOOK_URL =
  process.env.WEBHOOK_URL?.trim() ?? "http://localhost:5000/webhook";

const FIXED_INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS ?? 0);

let globalEventCounter = 0;
const recentEventIds: string[] = [];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)]!;
}

function randomBool(probability: number): boolean {
  return Math.random() < probability;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIso(date: Date): string {
  return date.toISOString();
}

function getNextIntervalMs(): number {
  if (FIXED_INTERVAL_MS > 0) {
    return FIXED_INTERVAL_MS;
  }
  return randomInt(4000, 5000);
}

function createInitialDeals(): Map<string, SimDealState> {
  const deals = new Map<string, SimDealState>();

  for (const dealId of DEAL_IDS) {
    deals.set(dealId, {
      dealId,
      stage: "Discovery",
      amount: randomInt(25_000, 250_000),
      closeDate: addDays(new Date(), randomInt(20, 90)),
      skipActivity: dealId === "D-1005",
      eventSequence: 0,
    });
  }

  return deals;
}

function progressStage(current: string): string {
  const index = STAGE_FLOW.indexOf(current as (typeof STAGE_FLOW)[number]);
  if (index === -1) {
    return "Discovery";
  }

  if (index >= STAGE_FLOW.length - 1) {
    return randomBool(0.5) ? "Closed-Won" : "Closed-Lost";
  }

  if (randomBool(0.15) && index < STAGE_FLOW.length - 2) {
    return STAGE_FLOW[index + 2]!;
  }

  return STAGE_FLOW[index + 1]!;
}

function applyDirtyData(
  deal: SimDealState,
  event: CrmSimulatorEvent,
  options: {
    forceUnrealisticCloseDate: boolean;
    forceConflictingSource: boolean;
    forceOutOfOrder: boolean;
  },
): void {
  if (options.forceUnrealisticCloseDate) {
    deal.closeDate = addDays(new Date(), randomInt(1, 3));
    event.close_date = toIso(deal.closeDate);
    event.payload.unrealistic_close_date = true;
  }

  if (options.forceConflictingSource) {
    event.is_source_of_truth = !event.is_source_of_truth;
    event.payload.conflicting_source_of_truth = true;
    event.payload.alternate_source = event.source === "salesforce" ? "hubspot" : "salesforce";
  }

  if (options.forceOutOfOrder) {
    const outOfOrderDate = addDays(new Date(), -randomInt(5, 45));
    event.occurred_at = toIso(outOfOrderDate);
    event.payload.out_of_order = true;
  }
}

function buildEventPayload(
  type: SimEventType,
  deal: SimDealState,
  source: CrmSource,
): Record<string, unknown> {
  switch (type) {
    case "email_sent":
      return {
        subject: `Follow-up on ${deal.dealId}`,
        direction: randomBool(0.5) ? "outbound" : "inbound",
        rep: `rep_${randomInt(1, 5)}`,
      };
    case "meeting_booked":
      return {
        title: "Discovery call",
        attendees: randomInt(2, 6),
        location: randomBool(0.5) ? "Zoom" : "On-site",
      };
    case "note_added":
      return {
        note: `Rep note for ${deal.dealId}: stakeholder requested pricing review.`,
      };
    case "deal_closed":
      return {
        outcome: deal.stage,
        closed_amount: deal.amount,
      };
    case "stage_changed":
    default:
      return {
        previous_stage: STAGE_FLOW[Math.max(0, STAGE_FLOW.indexOf(deal.stage as (typeof STAGE_FLOW)[number]) - 1)] ?? "Discovery",
        new_stage: deal.stage,
      };
  }
}

function generateEvent(deals: Map<string, SimDealState>): {
  event: CrmSimulatorEvent;
  duplicateDelivery: boolean;
} {
  const deal = randomItem([...deals.values()]);
  const type = randomItem(EVENT_TYPES);
  const source: CrmSource = randomBool(0.5) ? "salesforce" : "hubspot";

  if (type === "stage_changed") {
    deal.stage = progressStage(deal.stage);
  }

  if (type === "deal_closed") {
    deal.stage = randomBool(0.65) ? "Closed-Won" : "Closed-Lost";
  }

  if (type === "email_sent" || type === "meeting_booked") {
    deal.eventSequence += 1;
  }

  if (randomBool(0.2)) {
    deal.amount = Math.max(10_000, deal.amount + randomInt(-20_000, 35_000));
  }

  const useDuplicateId = randomBool(0.12) && recentEventIds.length > 0;
  const event_id = useDuplicateId
    ? randomItem(recentEventIds)
    : `evt_${Date.now()}_${++globalEventCounter}`;

  if (!useDuplicateId) {
    recentEventIds.push(event_id);
    if (recentEventIds.length > 50) {
      recentEventIds.shift();
    }
  }

  const event: CrmSimulatorEvent = {
    event_id,
    deal_id: deal.dealId,
    type,
    stage: deal.stage,
    amount: deal.amount,
    close_date: toIso(deal.closeDate),
    source,
    is_source_of_truth: randomBool(0.85),
    occurred_at: toIso(new Date()),
    payload: buildEventPayload(type, deal, source),
  };

  applyDirtyData(deal, event, {
    forceUnrealisticCloseDate: randomBool(0.18),
    forceConflictingSource: randomBool(0.12),
    forceOutOfOrder: randomBool(0.15),
  });

  event.payload = {
    ...event.payload,
    stage: deal.stage,
    amount: deal.amount,
    close_date: event.close_date,
    source,
    is_source_of_truth: event.is_source_of_truth,
  };

  const duplicateDelivery = useDuplicateId && randomBool(0.7);

  return { event, duplicateDelivery };
}

async function postEvent(event: CrmSimulatorEvent): Promise<void> {
  await axios.post(WEBHOOK_URL, event, {
    headers: { "Content-Type": "application/json" },
    timeout: 10_000,
    validateStatus: (status) => status >= 200 && status < 300,
  });
}

async function sendEvent(event: CrmSimulatorEvent): Promise<void> {
  console.log(
    `[CRM Simulator] Sent event ${event.event_id} deal=${event.deal_id} type=${event.type}`,
  );
  await postEvent(event);
}

async function runTick(deals: Map<string, SimDealState>): Promise<void> {
  const inactiveDeal = [...deals.values()].find((deal) => deal.skipActivity);
  if (inactiveDeal && randomBool(0.35)) {
    console.log(
      `[CRM Simulator] Skipping activity for ${inactiveDeal.dealId} (no-activity simulation)`,
    );
    return;
  }

  const { event, duplicateDelivery } = generateEvent(deals);
  await sendEvent(event);

  if (duplicateDelivery) {
    console.log(
      `[CRM Simulator] Duplicate delivery ${event.event_id} deal=${event.deal_id}`,
    );
    await sendEvent(event);
  }
}

async function bootstrap(): Promise<void> {
  console.log(`[CRM Simulator] Starting → ${WEBHOOK_URL}`);
  console.log(
    `[CRM Simulator] Interval: ${
      FIXED_INTERVAL_MS > 0
        ? `${FIXED_INTERVAL_MS}ms fixed`
        : "random 2000-5000ms"
    }`,
  );

  const deals = createInitialDeals();

  const scheduleNext = (): void => {
    const delay = getNextIntervalMs();
    setTimeout(() => {
      void runTick(deals)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[CRM Simulator] Error: ${message}`);
        })
        .finally(scheduleNext);
    }, delay);
  };

  scheduleNext();
}

process.on("SIGINT", () => {
  console.log("[CRM Simulator] Stopped");
  process.exit(0);
});

void bootstrap();
