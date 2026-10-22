import { Router } from "express";

import { getStats } from "../controllers/stats.controller.js";

const router = Router();

// Admin stats
router.get("/stats", getStats);

export default router;
