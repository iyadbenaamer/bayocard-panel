import { Router } from "express";

import {
  createOne,
  deleteOne,
  deleteMany,
  importFromExcel,
  getOne,
  getPaginated,
  getByCategory,
  updateOne,
} from "../controllers/card.controller.js";

import { upload } from "../middleware/upload.middleware.js";
import { verifyId } from "../middleware/validate.middleware.js";

const router = Router();

router.get("/", getPaginated);
router.get("/by-category", getByCategory);
router.get("/get-one", verifyId, getOne);
router.post("/", createOne);
router.post("/import", upload.single("file"), importFromExcel);
router.patch("/", verifyId, updateOne);
router.delete("/bulk", deleteMany);
router.delete("/", verifyId, deleteOne);

export default router;
