import mongoose from "mongoose";

import Session from "../models/session.model.js";
import { handleError } from "../utils/errorHandler.js";

// Admin view of a user's active devices - read/revoke only. Sessions are
// created exclusively by bayocard/server during mobile-app login.
export const getUserSessions = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ code: "CHECK_INVALID_USER_ID" });
    }

    const sessions = await Session.find({
      user: userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select("platform deviceName appVersion createdAt lastUsedAt")
      .sort({ lastUsedAt: -1 });

    return res.status(200).json(sessions);
  } catch (err) {
    return handleError(err, res);
  }
};

// Remote sign-out of one device, initiated by an admin (e.g. a reported lost
// phone) rather than the user themselves.
export const revokeSession = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ code: "CHECK_INVALID_SESSION_ID" });
    }

    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({ code: "AUTH_SESSION_NOT_FOUND" });
    }
    session.revokedAt = new Date();
    await session.save();
    return res.status(200).json({ code: "AUTH_SESSION_REVOKED" });
  } catch (err) {
    return handleError(err, res);
  }
};
