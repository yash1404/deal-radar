import type {
  DealSortField,
  HealthStatus,
  ListDealsQuery,
  SortOrder,
} from "../types/dealApi.types";

export interface ValidationError {
  field: string;
  message: string;
}

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: ValidationError[] };

const HEALTH_STATUSES: HealthStatus[] = ["healthy", "at_risk", "critical"];
const SORT_FIELDS: DealSortField[] = [
  "deal_id",
  "stage",
  "amount",
  "close_date",
  "health_score",
  "createdAt",
  "updatedAt",
];
const SORT_ORDERS: SortOrder[] = ["asc", "desc"];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_EVENTS_LIMIT = 50;
const MAX_EVENTS_LIMIT = 200;

function parsePositiveInt(
  value: unknown,
  field: string,
  errors: ValidationError[],
  options: { defaultValue: number; max?: number },
): number {
  if (value === undefined || value === null || value === "") {
    return options.defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    errors.push({
      field,
      message: `${field} must be a positive integer`,
    });
    return options.defaultValue;
  }

  if (options.max !== undefined && parsed > options.max) {
    errors.push({
      field,
      message: `${field} must be at most ${options.max}`,
    });
    return options.max;
  }

  return parsed;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateListDealsQuery(
  query: Record<string, unknown>,
): ValidationResult<ListDealsQuery> {
  const errors: ValidationError[] = [];

  const page = parsePositiveInt(query.page, "page", errors, {
    defaultValue: DEFAULT_PAGE,
  });
  const limit = parsePositiveInt(query.limit, "limit", errors, {
    defaultValue: DEFAULT_LIMIT,
    max: MAX_LIMIT,
  });

  const sortByRaw = parseOptionalString(query.sortBy) ?? "updatedAt";
  if (!SORT_FIELDS.includes(sortByRaw as DealSortField)) {
    errors.push({
      field: "sortBy",
      message: `sortBy must be one of: ${SORT_FIELDS.join(", ")}`,
    });
  }

  const sortOrderRaw = parseOptionalString(query.sortOrder) ?? "desc";
  if (!SORT_ORDERS.includes(sortOrderRaw as SortOrder)) {
    errors.push({
      field: "sortOrder",
      message: `sortOrder must be one of: ${SORT_ORDERS.join(", ")}`,
    });
  }

  const stage = parseOptionalString(query.stage);
  const search = parseOptionalString(query.search);

  let healthStatus: HealthStatus | undefined;
  const healthStatusRaw = parseOptionalString(query.healthStatus);
  if (healthStatusRaw !== undefined) {
    if (!HEALTH_STATUSES.includes(healthStatusRaw as HealthStatus)) {
      errors.push({
        field: "healthStatus",
        message: `healthStatus must be one of: ${HEALTH_STATUSES.join(", ")}`,
      });
    } else {
      healthStatus = healthStatusRaw as HealthStatus;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      page,
      limit,
      sortBy: sortByRaw as DealSortField,
      sortOrder: sortOrderRaw as SortOrder,
      ...(stage ? { stage } : {}),
      ...(healthStatus ? { healthStatus } : {}),
      ...(search ? { search } : {}),
    },
  };
}

export function validateDealIdParam(
  dealId: unknown,
): ValidationResult<string> {
  if (typeof dealId !== "string") {
    return {
      ok: false,
      errors: [{ field: "dealId", message: "dealId is required" }],
    };
  }

  const trimmed = dealId.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      errors: [{ field: "dealId", message: "dealId cannot be empty" }],
    };
  }

  return { ok: true, data: trimmed };
}

export function validateDealEventsQuery(
  query: Record<string, unknown>,
): ValidationResult<{ limit: number }> {
  const errors: ValidationError[] = [];
  const limit = parsePositiveInt(query.limit, "limit", errors, {
    defaultValue: DEFAULT_EVENTS_LIMIT,
    max: MAX_EVENTS_LIMIT,
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: { limit } };
}
