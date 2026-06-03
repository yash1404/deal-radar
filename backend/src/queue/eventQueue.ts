import { Queue, type JobsOptions } from "bullmq";

import { getRedisConnectionOptions } from "../config/redis";

export const EVENT_QUEUE_NAME = "crm-events";
export const EVENT_JOB_NAME = "process-crm-event";

export interface CrmEventJobData {
  event_id: string;
  deal_id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  received_at: string;
}

let eventQueue: Queue<CrmEventJobData> | null = null;

export function getEventQueue(): Queue<CrmEventJobData> {
  if (!eventQueue) {
    eventQueue = new Queue<CrmEventJobData>(EVENT_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    });
  }

  return eventQueue;
}

export async function enqueueCrmEvent(
  data: CrmEventJobData,
): Promise<{ jobId: string }> {
  const queue = getEventQueue();
  const jobOptions: JobsOptions = {
    jobId: data.event_id,
  };
  const job = await queue.add(EVENT_JOB_NAME, data, jobOptions);

  return { jobId: job.id ?? data.event_id };
}

export async function closeEventQueue(): Promise<void> {
  if (eventQueue) {
    await eventQueue.close();
    eventQueue = null;
  }
}
