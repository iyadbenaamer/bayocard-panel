import { Router } from "express";

import {
  createOne,
  getPaginated,
  updateOne,
  deleteOne,
} from "../controllers/deal.controller.js";

import { uploadSingleFile } from "../middleware/media.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { verifyId } from "../middleware/validate.middleware.js";

const router = Router();

router.get("/", getPaginated);
router.post("/", upload.fields([{ name: "media", maxCount: 1 }]), uploadSingleFile, createOne);
router.patch(
  "/",
  verifyId,
  upload.fields([{ name: "media", maxCount: 1 }]),
  uploadSingleFile,
  updateOne,
);
router.delete("/", verifyId, deleteOne);

export default router;
