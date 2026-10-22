import { Schema, model, Types } from "mongoose";

const { ObjectId } = Types;

// Mirrored from bayocard/server/models/session.model.js — same collection,
// same shape. The panel only ever reads/revokes rows here; sessions are
// created exclusively by bayocard/server during mobile-app login. See
// AUTH_SESSIONS_PLAN.md.
const sessionSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["android", "ios"], required: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String },
    appVersion: { type: String },
    attestation: {
      provider: {
        type: String,
        enum: ["play_integrity", "app_attest"],
        required: true,
      },
      verifiedAt: { type: Date, required: true },
    },
    ip: { type: String },
    lastUsedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

sessionSchema.index({ user: 1, revokedAt: 1, lastUsedAt: 1 });

const Session = model("Session", sessionSchema);
export default Session;
