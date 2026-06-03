import type { NextFunction, Request, Response } from "express";

import { getDealHealthInsight } from "../services/aiHealthService";
import {
  getDealByDealId,
  getDealEvents,
  listDeals,
} from "../services/dealQueryService";
import {
  validateDealEventsQuery,
  validateDealIdParam,
  validateListDealsQuery,
} from "../validators/dealQueryValidator";

export async function listDealsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validation = validateListDealsQuery(
      req.query as Record<string, unknown>,
    );

    if (!validation.ok) {
      res.status(400).json({
        message: "Validation failed",
        errors: validation.errors,
      });
      return;
    }

    const result = await listDeals(validation.data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getDealHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validation = validateDealIdParam(req.params.dealId);

    if (!validation.ok) {
      res.status(400).json({
        message: "Validation failed",
        errors: validation.errors,
      });
      return;
    }

    const deal = await getDealByDealId(validation.data);
    res.status(200).json(deal);
  } catch (error) {
    next(error);
  }
}

export async function getDealHealthHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validation = validateDealIdParam(req.params.dealId);

    if (!validation.ok) {
      res.status(400).json({
        message: "Validation failed",
        errors: validation.errors,
      });
      return;
    }

    const insight = await getDealHealthInsight(validation.data);
    res.status(200).json(insight);
  } catch (error) {
    next(error);
  }
}

export async function getDealEventsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const dealIdValidation = validateDealIdParam(req.params.dealId);

    if (!dealIdValidation.ok) {
      res.status(400).json({
        message: "Validation failed",
        errors: dealIdValidation.errors,
      });
      return;
    }

    const queryValidation = validateDealEventsQuery(
      req.query as Record<string, unknown>,
    );

    if (!queryValidation.ok) {
      res.status(400).json({
        message: "Validation failed",
        errors: queryValidation.errors,
      });
      return;
    }

    const events = await getDealEvents(
      dealIdValidation.data,
      queryValidation.data.limit,
    );
    res.status(200).json(events);
  } catch (error) {
    next(error);
  }
}
