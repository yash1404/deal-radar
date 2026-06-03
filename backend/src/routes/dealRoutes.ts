import { Router } from "express";

import {
  getDealEventsHandler,
  getDealHandler,
  getDealHealthHandler,
  listDealsHandler,
} from "../controllers/dealController";

const dealRoutes = Router();

dealRoutes.get("/", listDealsHandler);
dealRoutes.get("/:dealId/health", getDealHealthHandler);
dealRoutes.get("/:dealId/events", getDealEventsHandler);
dealRoutes.get("/:dealId", getDealHandler);

export default dealRoutes;
