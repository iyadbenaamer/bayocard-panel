import { Router } from "express";

import {
  update,
  deleteUser,
  getOne,
  getMany,
  create,
} from "../controllers/user.controller.js";

import {
  getUserCustomPricing,
  createUserCustomPricing,
  deleteUserCustomPricing,
} from "../controllers/customPricing.controller.js";
import { getUserFavorites } from "../controllers/favorite.controller.js";
import {
  getUserSessions,
  revokeSession,
} from "../controllers/session.controller.js";
import {
  getUserApiKeys,
  createApiKey,
  deleteApiKey,
} from "../controllers/apiKey.controller.js";

import { verifyFields, verifyId } from "../middleware/validate.middleware.js";

const router = Router();

router.post("/", verifyFields, create);
router.get("/many", getMany);
router.get("/", getOne);
router.patch("/", verifyFields, update);
router.delete("/", deleteUser);

// Admin custom pricing
router.get("/custom-pricing", getUserCustomPricing);
router.post("/custom-pricing", createUserCustomPricing);
router.delete("/custom-pricing", deleteUserCustomPricing);

// Admin favorites (read-only)
router.get("/favorites", getUserFavorites);

// Device sessions (mobile app) - read/revoke only, sessions are created by
// bayocard/server during login
router.get("/sessions", getUserSessions);
router.delete("/sessions", revokeSession);

// Business API keys - issued/deleted here (see AUTH_SESSIONS_PLAN.md);
// bayocard/server only ever verifies them. No revoke/cancel action - deleting
// a key is the only way to disable it.
router.get("/api-keys", getUserApiKeys);
router.post("/api-keys", createApiKey);
router.delete("/api-keys/:id", deleteApiKey);

export default router;
