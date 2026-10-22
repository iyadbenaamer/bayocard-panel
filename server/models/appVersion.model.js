import { Schema, model } from "mongoose";

const platformVersionSchema = new Schema(
  {
    minVersion: { type: String, required: true, default: "1.0.0" },
    latestVersion: { type: String, required: true, default: "1.0.0" },
    storeUrl: { type: String, default: "" },
  },
  { _id: false },
);

// Singleton document (see appVersion.controller.js getSingleton) - there is
// only ever one AppVersion record, holding the admin-configured min/latest
// version per platform that the mobile app's force-update gate checks
// against (see AUTH_SESSIONS_PLAN.md-adjacent mobile app/_layout.jsx).
const appVersionSchema = new Schema(
  {
    android: { type: platformVersionSchema, default: () => ({}) },
    ios: { type: platformVersionSchema, default: () => ({}) },
  },
  { timestamps: true },
);

const AppVersion = model("AppVersion", appVersionSchema, "appversions");
export default AppVersion;
