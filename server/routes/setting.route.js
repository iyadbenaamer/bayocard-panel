import { Router } from "express";

import {
  getAll,
  getOne,
  createOne,
  updateOne,
  updateMany,
  deleteOne,
} from "../controllers/setting.controller.js";

import { verifyId } from "../middleware/validate.middleware.js";

const router = Router();

router.get("/all", getAll);
router.get("/:id", verifyId, getOne);
router.post("/", createOne);
// bulk/array update (accepts [{id?,key?,value?,description?,group?}, ...])
router.patch("/", updateMany);
router.patch("/:id", verifyId, updateOne);
router.delete("/:id", verifyId, deleteOne);

export default router;
