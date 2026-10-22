import { Router } from "express";

import { getAppVersion, updateAppVersion } from "../controllers/appVersion.controller.js";

const router = Router();

router.get("/", getAppVersion);
router.put("/", updateAppVersion);

export default router;
