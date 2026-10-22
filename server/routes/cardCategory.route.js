import { Router } from "express";

import {
  getAll,
  createOne,
  updateAll,
  deleteOne,
} from "../controllers/cardCategory.controller.js";

const router = Router();

router.get("/", getAll);
router.post("/", createOne);
router.patch("/", updateAll);
router.delete("/", deleteOne);

export default router;
