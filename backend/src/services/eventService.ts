import type { ClientSession } from "mongoose";

import { Event, type IEvent } from "../models/event.model";

export async function isDuplicateEvent(
  eventId: string,
  session?: ClientSession,
): Promise<boolean> {
  const query = Event.exists({ event_id: eventId });
  if (session) {
    query.session(session);
  }

  const result = await query;
  return result !== null;
}

export interface SaveEventInput {
  event_id: string;
  deal_id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

export async function saveEvent(
  input: SaveEventInput,
  session?: ClientSession,
): Promise<IEvent> {
  const created = await Event.create(
    [
      {
        event_id: input.event_id,
        deal_id: input.deal_id,
        type: input.type,
        payload: input.payload,
        occurred_at: input.occurred_at,
      },
    ],
    session ? { session } : undefined,
  );

  const event = created[0];
  if (!event) {
    throw new Error(`Failed to persist event ${input.event_id}`);
  }

  console.log(
    `[EventService] Saved event event_id=${input.event_id} deal_id=${input.deal_id}`,
  );

  return event.toObject();
}
