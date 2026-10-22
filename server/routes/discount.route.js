import { Router } from "express";

import {
  getPaginated,
  createOne,
  updateOne,
  deleteOne,
} from "../controllers/discount.controller.js";

import { verifyId } from "../middleware/validate.middleware.js";

const router = Router();

router.get("/", getPaginated);
router.post("/", createOne);
router.patch("/", verifyId, updateOne);
router.delete("/", verifyId, deleteOne);

export default router;
