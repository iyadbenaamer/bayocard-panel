import express from "express";

import { login } from "../controllers/auth.controller.js";

import { verifyFields } from "../middleware/validate.middleware.js";

const router = express.Router();

router.post("/login", login);

export default router;
