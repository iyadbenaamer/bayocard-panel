import { Router } from "express";

import { get, deleteRequestLogs } from "../controllers/requestLog.controller.js";

const router = Router();

// Admin request logs list with filters
router.get("/", get);

// Admin request logs bulk delete
router.delete("/", deleteRequestLogs);

export default router;
