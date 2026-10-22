import { Router } from "express";

import {
  getPaginated,
  createOne,
  updateOne,
  updateOrderList,
  deleteOne,
} from "../controllers/cardTier.controller.js";

import { verifyId } from "../middleware/validate.middleware.js";

const router = Router();

router.get("/", getPaginated);
router.post("/", createOne);
router.patch("/", verifyId, updateOne);
router.patch("/order", updateOrderList);
router.delete("/", verifyId, deleteOne);

export default router;
