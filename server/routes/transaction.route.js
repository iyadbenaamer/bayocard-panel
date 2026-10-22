import { Router } from "express";

import {
  createDeposit,
  createRefund,
  get,
  deleteTransactions,
} from "../controllers/transaction.controller.js";

const router = Router();

// Admin transactions list with filters
router.get("/", get);

// Admin balance deposit
router.post("/deposit", createDeposit);

// Admin refund
router.post("/refund", createRefund);

// Admin transactions bulk delete
router.delete("/", deleteTransactions);

export default router;
