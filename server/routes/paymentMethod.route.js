import { Router } from "express";

import {
  createOne,
  getPaginated,
  syncFromEzone,
  updateOrderList,
  updateOne,
  deleteOne,
} from "../controllers/paymentMethod.controller.js";

import {
  attachIconPath,
  uploadPaymentIcon,
} from "../middleware/paymentIconUpload.middleware.js";
import { verifyId } from "../middleware/validate.middleware.js";

const router = Router();

router.post("/sync-ezone", syncFromEzone);
router.get("/", getPaginated);
router.patch("/order", updateOrderList);
router.post(
  "/",
  uploadPaymentIcon.single("icon"),
  attachIconPath,
  createOne,
);
router.patch(
  "/",
  verifyId,
  uploadPaymentIcon.single("icon"),
  attachIconPath,
  updateOne,
);
router.delete("/", verifyId, deleteOne);

export default router;
