import crypto from "crypto";

import { API_KEY_PREFIX } from "../config/authLimits.js";

// Must stay byte-for-byte identical to bayocard/server/utils/apiKey.js's
// generateApiKeySecret/hashApiKey - a key issued here has to hash to the
// same value the main server computes when verifying it.
export const generateApiKeySecret = () =>
  `${API_KEY_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;

export const hashApiKey = (key) =>
  crypto.createHash("sha256").update(key).digest("hex");

// Shown in the admin UI so a key can be identified without ever re-displaying
// the full secret after creation.
export const getKeyPrefix = (key) => key.slice(0, API_KEY_PREFIX.length + 10);
