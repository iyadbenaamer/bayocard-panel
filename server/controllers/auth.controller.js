import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import Setting from "../models/setting.model.js";

import { handleError } from "../utils/errorHandler.js";

const REMEMBER_ME_EXPIRATION = "90d";
const ACCESS_TOKEN_EXPIRATION = "14d";
const ACCESS_TOKEN_COOKIE = "admin_token";

const parseDurationToMs = (duration) => {
  if (typeof duration !== "string") {
    return null;
  }
  const match = duration.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
};

const setAuthCookies = (res, { accessToken, rememberMe }) => {
  const isProduction = process.env.NODE_ENV === "production";
  const accessMaxAge = parseDurationToMs(
    rememberMe ? REMEMBER_ME_EXPIRATION : ACCESS_TOKEN_EXPIRATION,
  );

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: isProduction,
    ...(accessMaxAge ? { maxAge: accessMaxAge } : {}),
  });
};

const clearAuthCookies = (res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: isProduction,
  });
};

const createAccessToken = (adminId, expiresIn = ACCESS_TOKEN_EXPIRATION) =>
  jwt.sign({ adminId, role: "admin" }, process.env.JWT_SECRET, {
    expiresIn,
  });

const createAuthTokens = (adminId, { rememberMe = false } = {}) => ({
  accessToken: createAccessToken(
    adminId,
    rememberMe ? REMEMBER_ME_EXPIRATION : ACCESS_TOKEN_EXPIRATION,
  ),
});

export const login = async (req, res) => {
  try {
    let { username, password, rememberMe } = req.body;
    if (!(username && password)) {
      return res.status(400).json({ code: "ADMIN_CREDENTIALS_REQUIRED" });
    }
    username = username.trim();
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(404).json({ code: "ADMIN_NOT_FOUND" });
    }
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ code: "ADMIN_INCORRECT_PASSWORD" });
    }
    const { accessToken } = createAuthTokens(admin.id, {
      rememberMe: Boolean(rememberMe),
    });
    setAuthCookies(res, {
      accessToken,
      rememberMe: Boolean(rememberMe),
    });
    return res.status(200).json({
      admin: { id: admin.id, username: admin.username },
    });
  } catch (err) {
    return handleError(err, res);
  }
};
