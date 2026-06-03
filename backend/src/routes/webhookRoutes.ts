import { Router } from "express";

import { handleWebhook } from "../controllers/webhookController";

const webhookRoutes = Router();

webhookRoutes.post("/", handleWebhook);

export default webhookRoutes;
