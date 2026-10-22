import { Schema, model, Types } from "mongoose";

const { ObjectId } = Types;

// Mirrored from bayocard/server/models/apiKey.model.js — same collection, same
// shape. Unlike sessions, API keys are only ever *written* here (this repo
// is the sole issuer); bayocard/server only reads keyHash to verify requests.
// See AUTH_SESSIONS_PLAN.md.
const apiKeySchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, unique: true },
    keyPrefix: { type: String, required: true },
    createdBy: { type: ObjectId, ref: "Admin" },
    // Who issued this key - an admin via bayocard-panel, or the business user
    // themselves via the mobile app's self-service flow. Defaults to "admin"
    // since every key predating self-service was admin-issued.
    createdByType: { type: String, enum: ["admin", "user"], default: "admin" },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

apiKeySchema.index({ user: 1 });

const ApiKey = model("ApiKey", apiKeySchema);
export default ApiKey;
