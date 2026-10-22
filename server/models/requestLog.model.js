import { Schema, model, Types } from "mongoose";

const { ObjectId } = Types;

// Mirrored from bayocard/server/models/requestLog.model.js — same collection,
// same shape. Rows are written exclusively by bayocard/server (login, signup,
// verification code, password change, checkout requests); the panel only
// reads/deletes them here. Deletion is handled by the shared auto-delete job
// (utils/autoDelete.js), the same admin-configurable duration that purges
// Orders/Transactions, so there is no TTL index on this copy either.
const requestLogSchema = new Schema(
  {
    actionType: {
      type: String,
      enum: [
        "login",
        "signup",
        "verification_code",
        "password_change",
        "checkout",
      ],
      required: true,
      index: true,
    },
    status: { type: String, enum: ["success", "failure"], required: true },
    resultCode: { type: String, default: null },
    // Only set for a failed "verification_code" attempt (wrong/expired
    // code) - how many attempts were left after this one.
    remainingAttempts: { type: Number, default: null },
    // Raw values as submitted on the request, captured up front before the
    // handler even knows whether they belong to a real account - so a failed
    // login against an unregistered phone, or a rejected signup, still shows
    // what was typed instead of leaving the row blank. `name` is only ever
    // set for signup (login/verification/password-change never submit one).
    phone: { type: String, default: null },
    name: { type: String, default: null },
    userId: { type: ObjectId, ref: "User", default: null, index: true },
    authMethod: { type: String, enum: ["session", "api_key"], default: null },
    method: { type: String, required: true },
    path: { type: String, required: true },
    ip: { type: String, default: null },
    location: {
      country: { type: String, default: null },
      region: { type: String, default: null },
      city: { type: String, default: null },
    },
    timeZone: { type: String, default: null },
    device: {
      platform: { type: String, default: null },
      deviceId: { type: String, default: null },
      deviceName: { type: String, default: null },
    },
  },
  { timestamps: true },
);

requestLogSchema.index({ userId: 1, createdAt: -1 });
requestLogSchema.index({ actionType: 1, createdAt: -1 });

const RequestLog = model("RequestLog", requestLogSchema, "requestlogs");
export default RequestLog;
