import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    phone: { type: String, unique: true, max: 20, required: true },
    password: {
      type: String,
      required: true,
      min: 8,
      max: 50,
    },
    name: {
      type: String,
      required: true,
      min: 2,
      max: 20,
    },
    role: {
      type: String,
      enum: ["business", "individual"],
      default: "business",
      required: true,
    },
    balance: {
      type: Number,
      default: () => 0,
      min: 0,
    },
    // if the user is verified, they can login and use the app, otherwise they need to verify their account first
    verificationStatus: {
      isVerified: { type: Boolean, default: false },
      token: String,
      remainingAttempts: { type: Number, default: 20, max: 20, min: 0 },
      resendAfter: Date,
      codesSentCount: { type: Number, default: 0 },
    },
    // if the user is blocked by admin, or deactivated their account, they won't be able to login
    isActive: { type: Boolean, default: false },
    // if the user is blocked by admin, they won't be able to buy cards, but they can still login and use the app
    canBuy: { type: Boolean, default: true },
    canSendCode: { type: Boolean, default: true },
    // business-only: lets the user self-serve their own API keys (create/revoke,
    // up to API_KEY_SOFT_CAP) from the mobile app instead of asking an admin.
    canManageApiKeys: { type: Boolean, default: false },
    // Expo push tokens for devices the user is logged into; used to deliver
    // notifications (e.g. dollar rate changes) via the Expo push service.
    pushTokens: { type: [String], default: [] },
    resetPassword: {
      token: String,
      remainingAttempts: { type: Number, default: 20, max: 20, min: 0 },
      resendAfter: Date,
      codesSentCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

const User = model("User", userSchema);
export default User;
