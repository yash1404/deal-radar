import type { NextFunction, Request, Response } from "express";

import { enqueueCrmEvent, type CrmEventJobData } from "../queue/eventQueue";

interface ValidationError {
  field: string;
  message: string;
}

type ValidationResult =
  | { ok: true; data: CrmEventJobData }
  | { ok: false; errors: ValidationError[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(
  body: Record<string, unknown>,
  field: string,
  errors: ValidationError[],
): string | undefined {
  const value = body[field];

  if (value === undefined || value === null) {
    errors.push({ field, message: `${field} is required` });
    return undefined;
  }

  if (typeof value !== "string") {
    errors.push({ field, message: `${field} must be a string` });
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push({ field, message: `${field} cannot be empty` });
    return undefined;
  }

  return trimmed;
}

const CRM_PAYLOAD_FIELDS = [
  "stage",
  "amount",
  "close_date",
  "source",
  "is_source_of_truth",
] as const;

function mergeCrmFieldsIntoPayload(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...payload };

  for (const field of CRM_PAYLOAD_FIELDS) {
    if (body[field] !== undefined && body[field] !== null) {
      merged[field] = body[field];
    }
  }

  return merged;
}

function validateWebhookPayload(body: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isPlainObject(body)) {
    return {
      ok: false,
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
    };
  }

  const event_id = requireNonEmptyString(body, "event_id", errors);
  const deal_id = requireNonEmptyString(body, "deal_id", errors);
  const type = requireNonEmptyString(body, "type", errors);

  let payload: Record<string, unknown> = {};
  if (body.payload !== undefined && body.payload !== null) {
    if (!isPlainObject(body.payload)) {
      errors.push({ field: "payload", message: "payload must be an object" });
    } else {
      payload = body.payload;
    }
  }

  let occurred_at: string;
  if (body.occurred_at !== undefined && body.occurred_at !== null) {
    if (typeof body.occurred_at !== "string" && !(body.occurred_at instanceof Date)) {
      errors.push({
        field: "occurred_at",
        message: "occurred_at must be an ISO date string",
      });
      occurred_at = new Date().toISOString();
    } else {
      const parsed = new Date(body.occurred_at as string | Date);
      if (Number.isNaN(parsed.getTime())) {
        errors.push({
          field: "occurred_at",
          message: "occurred_at must be a valid date",
        });
        occurred_at = new Date().toISOString();
      } else {
        occurred_at = parsed.toISOString();
      }
    }
  } else {
    occurred_at = new Date().toISOString();
  }

  if (errors.length > 0 || !event_id || !deal_id || !type) {
    return { ok: false, errors };
  }

  const mergedPayload = mergeCrmFieldsIntoPayload(body, payload);

  return {
    ok: true,
    data: {
      event_id,
      deal_id,
      type,
      payload: mergedPayload,
      occurred_at,
      received_at: new Date().toISOString(),
    },
  };
}

function isDuplicateJobError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Job") &&
    error.message.toLowerCase().includes("exist")
  );
}

export async function handleWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validation = validateWebhookPayload(req.body);

    if (!validation.ok) {
      res.status(400).json({
        message: "Validation failed",
        errors: validation.errors,
      });
      return;
    }

    try {
      const { jobId } = await enqueueCrmEvent(validation.data);

      res.status(200).json({
        message: "Event accepted",
        event_id: validation.data.event_id,
        jobId,
      });
    } catch (error) {
      if (isDuplicateJobError(error)) {
        res.status(200).json({
          message: "Event already queued",
          event_id: validation.data.event_id,
        });
        return;
      }

      throw error;
    }
  } catch (error) {
    next(error);
  }
}
