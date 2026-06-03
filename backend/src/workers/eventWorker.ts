import { Worker, type Job } from "bullmq";
import mongoose from "mongoose";

import { getRedisConnectionOptions } from "../config/redis";
import {
  EVENT_JOB_NAME,
  EVENT_QUEUE_NAME,
  type CrmEventJobData,
} from "../queue/eventQueue";
import { updateDealFromEvent, recalculateDealHealth } from "../services/dealService";
import { isDuplicateEvent, saveEvent } from "../services/eventService";
import { emitSseEvent, type SsePayload } from "../services/sseService";

export type EventJobResult =
  | { status: "skipped"; reason: "duplicate"; event_id: string }
  | {
      status: "processed";
      event_id: string;
      deal_id: string;
      health_score: number;
    };

let eventWorker: Worker<CrmEventJobData, EventJobResult> | null = null;

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

async function processCrmEvent(
  job: Job<CrmEventJobData>,
): Promise<EventJobResult> {
  const { event_id, deal_id, type, payload, occurred_at } = job.data;
  const occurredAt = new Date(occurred_at);

  console.log(
    `[EventWorker] Processing jobId=${job.id} event_id=${event_id} deal_id=${deal_id} type=${type}`,
  );

  const duplicate = await isDuplicateEvent(event_id);
  if (duplicate) {
    console.log(`[EventWorker] Duplicate event_id=${event_id}, skipping`);
    return { status: "skipped", reason: "duplicate", event_id };
  }

  const session = await mongoose.startSession();

  try {
    let result: EventJobResult = {
      status: "processed",
      event_id,
      deal_id,
      health_score: 0,
    };
    let ssePayload: SsePayload | null = null;

    await session.withTransaction(async () => {
      const duplicateInTx = await isDuplicateEvent(event_id, session);
      if (duplicateInTx) {
        result = { status: "skipped", reason: "duplicate", event_id };
        return;
      }

      await saveEvent(
        {
          event_id,
          deal_id,
          type,
          payload,
          occurred_at: occurredAt,
        },
        session,
      );

      await updateDealFromEvent(deal_id, type, payload, occurredAt, session);

      const { deal, health } = await recalculateDealHealth(
        deal_id,
        session,
        occurredAt,
      );

      result = {
        status: "processed",
        event_id,
        deal_id,
        health_score: health.health_score,
      };

      ssePayload = {
        type: "deal.updated",
        deal_id,
        event_id,
        timestamp: new Date().toISOString(),
        data: {
          deal,
          health_score: health.health_score,
          health_reason: health.health_reason,
          job_id: job.id,
        },
      };
    });

    if (result.status === "processed" && ssePayload) {
      emitSseEvent(ssePayload);
      console.log(
        `[EventWorker] Completed event_id=${event_id} health_score=${result.health_score}`,
      );
    }

    return result;
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      console.log(
        `[EventWorker] Duplicate key on event_id=${event_id}, skipping`,
      );
      return { status: "skipped", reason: "duplicate", event_id };
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[EventWorker] Failed event_id=${event_id} jobId=${job.id}: ${message}`,
    );
    throw error;
  } finally {
    await session.endSession();
  }
}

export function startEventWorker(): Worker<CrmEventJobData, EventJobResult> {
  if (eventWorker) {
    return eventWorker;
  }

  eventWorker = new Worker<CrmEventJobData, EventJobResult>(
    EVENT_QUEUE_NAME,
    async (job) => {
      if (job.name !== EVENT_JOB_NAME) {
        console.warn(
          `[EventWorker] Unexpected job name="${job.name}" jobId=${job.id}`,
        );
      }

      return processCrmEvent(job);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
    },
  );

  eventWorker.on("completed", (job, result) => {
    console.log(
      `[EventWorker] Job completed jobId=${job.id} status=${result?.status ?? "unknown"}`,
    );
  });

  eventWorker.on("failed", (job, error) => {
    console.error(
      `[EventWorker] Job failed jobId=${job?.id ?? "unknown"}: ${error.message}`,
    );
  });

  eventWorker.on("error", (error) => {
    console.error("[EventWorker] Worker error:", error.message);
  });

  console.log("[EventWorker] Started");
  return eventWorker;
}

export async function closeEventWorker(): Promise<void> {
  if (!eventWorker) {
    return;
  }

  await eventWorker.close();
  eventWorker = null;
  console.log("[EventWorker] Stopped");
}
