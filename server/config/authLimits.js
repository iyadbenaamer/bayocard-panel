// Mirrored from bayocard/server/config/authLimits.js — kept in sync manually
// since the two repos share a database but not a codebase. If either copy
// changes (token prefix, caps), update both. See AUTH_SESSIONS_PLAN.md.
export const SESSION_LIMITS = { business: 2, individual: 5 };

// Soft cap on how many named API keys a single business account may hold.
// Enforced here at issuance time (bayocard/server only verifies keys, it
// doesn't issue them).
export const API_KEY_SOFT_CAP = 5;

export const API_KEY_PREFIX = "mdc_live_";
