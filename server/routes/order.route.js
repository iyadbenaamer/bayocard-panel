import { Router } from "express";

import {
  getMany,
  getOne,
  deleteMany,
} from "../controllers/order.controller.js";
import { upload } from "../middleware/upload.middleware.js";
import { verifyId } from "../middleware/validate.middleware.js";

const router = Router();

router.get("/", getMany);
router.get("/one", getOne);
router.delete("/", deleteMany);

export default router;
