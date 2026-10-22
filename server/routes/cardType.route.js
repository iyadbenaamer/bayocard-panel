import { Router } from "express";

import {
  createOne,
  getPaginated,
  getOne,
  getByCategory,
  updateOne,
  updateOrderList,
  deleteOne,
} from "../controllers/cardType.controller.js";

import { uploadSingleFile } from "../middleware/media.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { verifyId } from "../middleware/validate.middleware.js";

const router = Router();

router.get("/", getPaginated);
router.get("/by-category", getByCategory);
router.post(
  "/",

  // accept both `media` (card type image) and `printImage` (printable image)
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "printImage", maxCount: 1 },
  ]),
  uploadSingleFile,
  createOne,
);
router.get("/get-one", verifyId, getOne);
router.patch(
  "/",

  verifyId,
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "printImage", maxCount: 1 },
  ]),
  uploadSingleFile,
  updateOne,
);
router.patch("/order", updateOrderList);
router.delete("/", verifyId, deleteOne);

export default router;
