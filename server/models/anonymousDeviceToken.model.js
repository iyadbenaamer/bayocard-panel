import { Schema, model } from "mongoose";

// Mirrors bayocard/server/models/anonymousDeviceToken.model.js - both servers
// point at the same MongoDB database. bayocard/server is the writer (devices
// register/unregister themselves via its public /device-tokens endpoint);
// this side just reads it to reach the "unauthorized users" notification
// audience (see notifyUsers in notification.controller.js).
const anonymousDeviceTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["android", "ios"] },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

const AnonymousDeviceToken = model(
  "AnonymousDeviceToken",
  anonymousDeviceTokenSchema,
  "anonymous_device_tokens",
);
export default AnonymousDeviceToken;
