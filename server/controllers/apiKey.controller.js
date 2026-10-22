import mongoose from "mongoose";

import ApiKey from "../models/apiKey.model.js";
import User from "../models/user.model.js";

import { generateApiKeySecret, hashApiKey, getKeyPrefix } from "../utils/apiKey.js";
import { API_KEY_SOFT_CAP } from "../config/authLimits.js";
import { handleError } from "../utils/errorHandler.js";

// Lists a user's keys without ever exposing the secret again after creation
// - only the prefix, name, creator, and usage state.
export const getUserApiKeys = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ code: "CHECK_INVALID_USER_ID" });
    }

    const apiKeys = await ApiKey.find({ user: userId })
      .select("name keyPrefix lastUsedAt createdByType createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json(apiKeys);
  } catch (err) {
    return handleError(err, res);
  }
};

// Issues a new key for a business user. The raw secret is returned exactly
// once here - only its hash is ever stored, so if the admin loses it the
// only recovery is deleting it and issuing a new one.
export const createApiKey = async (req, res) => {
  try {
    let { userId, name } = req.body;
    name = name?.trim();
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ code: "CHECK_INVALID_USER_ID" });
    }
    if (!name) {
      return res.status(400).json({ code: "API_KEY_NAME_REQUIRED" });
    }

    const user = await User.findById(userId).select("_id role");
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND" });
    }
    // Individual accounts can never hold an API key - see AUTH_SESSIONS_PLAN.md.
    if (user.role !== "business") {
      return res.status(400).json({ code: "API_KEY_NOT_ELIGIBLE_FOR_ROLE" });
    }

    const keyCount = await ApiKey.countDocuments({ user: userId });
    if (keyCount >= API_KEY_SOFT_CAP) {
      return res.status(409).json({ code: "API_KEY_LIMIT_REACHED" });
    }

    const secret = generateApiKeySecret();
    const apiKey = await ApiKey.create({
      user: userId,
      name,
      keyHash: hashApiKey(secret),
      keyPrefix: getKeyPrefix(secret),
      createdBy: req.admin?._id,
      createdByType: "admin",
    });

    return res.status(201).json({
      id: apiKey._id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      createdByType: apiKey.createdByType,
      createdAt: apiKey.createdAt,
      // Only ever sent in this one response - store it now, it can't be
      // retrieved again.
      secret,
    });
  } catch (err) {
    return handleError(err, res);
  }
};

// Permanently removes a key - there's no revoke/cancel action, deleting is
// the only way to disable one.
export const deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ code: "CHECK_INVALID_API_KEY_ID" });
    }

    const apiKey = await ApiKey.findByIdAndDelete(id);
    if (!apiKey) {
      return res.status(404).json({ code: "API_KEY_NOT_FOUND" });
    }
    return res.status(200).json({ code: "API_KEY_DELETED" });
  } catch (err) {
    return handleError(err, res);
  }
};
