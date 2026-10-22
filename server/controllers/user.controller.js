import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import User from "../models/user.model.js";
import Setting from "../models/setting.model.js";

import { generateCode } from "../utils/generateCode.js";
import { handleError } from "../utils/errorHandler.js";

const MAX_CODE_ATTEMPTS = 20;
const RESEND_FIRST_TWO_DELAY_MS = 60 * 1000;
const RESEND_AFTER_DELAY_MS = 5 * 60 * 1000;
const RESEND_AFTER_FIVE_DELAY_MS = 2 * 60 * 60 * 1000;
const CODE_EXPIRATION = process.env.CODE_EXPIRATION || "1h";
const ACCESS_TOKEN_EXPIRATION = process.env.ACCESS_TOKEN_EXPIRATION || "14d";
const REMEMBER_ME_ACCESS_EXPIRATION =
  process.env.REMEMBER_ME_ACCESS_EXPIRATION || "90d";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildUserSearchFilter = (searchTerm) => {
  const term = searchTerm.trim();
  const terms = term.split(/\s+/);

  const patterns = new Set();
  const addPattern = (item) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    patterns.add(escapeRegex(trimmed));
  };

  addPattern(term);
  terms.forEach(addPattern);

  const orConditions = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, "i");
    orConditions.push({ name: regex }, { phone: regex });
  }

  return orConditions.length > 0 ? { $or: orConditions } : {};
};

const normalizeDate = (value, isEnd) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  if (typeof value === "string" && value.length <= 10) {
    if (isEnd) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }
  }

  return parsed;
};

const getNextResendAfter = (codesSentCount = 0) => {
  const nextCount = codesSentCount + 1;
  const delay =
    nextCount <= 2
      ? RESEND_FIRST_TWO_DELAY_MS
      : nextCount >= 5
        ? RESEND_AFTER_FIVE_DELAY_MS
        : RESEND_AFTER_DELAY_MS;
  return new Date(Date.now() + delay);
};

export const getMany = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
    const sortBy = req.query.sortBy === "status" ? "status" : "name";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
    const sortField = sortBy === "status" ? "isActive" : "name";
    const role =
      req.query.role === "business" || req.query.role === "individual"
        ? req.query.role
        : "";
    const status =
      req.query.status === "active"
        ? true
        : req.query.status === "inactive"
          ? false
          : undefined;
    const query = req.query.query?.trim();

    const filter = {};
    if (role) {
      filter.role = role;
    }
    if (status !== undefined) {
      filter.isActive = status;
    }
    if (query) {
      Object.assign(filter, buildUserSearchFilter(query));
    }

    const startDate = normalizeDate(req.query.startDate, false);
    const endDate = normalizeDate(req.query.endDate, true);
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select("name phone role isActive createdAt")
      .sort({ [sortField]: sortOrder, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      users,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return handleError(err, res);
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.query;

    const profile = await User.findById(id).select(
      "name phone role balance isActive canBuy canSendCode canManageApiKeys verificationStatus createdAt updatedAt",
    );
    if (!profile) {
      return res.status(404).json({ code: "USER_NOT_FOUND" });
    }
    const support = await Setting.findOne({ key: "support" }).select("value");
    return res.status(200).json({ profile, support: support?.value || "" });
  } catch (err) {
    return handleError(err, res);
  }
};

export const create = async (req, res) => {
  try {
    let { name, phone, password, role } = req.body;
    name = name?.trim();
    phone = phone?.trim().toLowerCase();
    role = role?.trim().toLowerCase();
    if (!(name && phone && password && role)) {
      return res.status(400).json({ code: "AUTH_REQUIRED_FIELDS_MISSING" });
    }
    if (!["business", "individual"].includes(role)) {
      return res.status(400).json({ code: "AUTH_INVALID_ROLE" });
    }
    const isPhoneUsed = (await User.findOne({ phone })) ? true : false;
    if (isPhoneUsed) {
      return res.status(409).json({ code: "AUTH_PHONE_ALREADY_REGISTERED" });
    }
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      phone,
      name,
      role,
      password: hashedPassword,
      isActive: false,
    });
    newUser.isActive = true;
    newUser.verificationStatus.isVerified = true;
    newUser.verificationStatus.token = null;
    newUser.verificationStatus.remainingAttempts = MAX_CODE_ATTEMPTS;
    newUser.verificationStatus.codesSentCount = 0;
    newUser.verificationStatus.resendAfter = getNextResendAfter(0);
    await newUser.save();

    return res.status(201).json({ code: "AUTH_USER_CREATED" });
  } catch (err) {
    return handleError(err, res);
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.query;
    let {
      phone,
      password,
      name,
      username,
      role,
      balance,
      verificationStatus,
      isActive,
      canBuy,
      canSendCode,
      canManageApiKeys,
    } = req.body;

    if (!id) {
      return res.status(400).json({ code: "USER_ID_REQUIRED" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND" });
    }

    if (phone !== undefined) {
      phone = phone?.trim().toLowerCase();
      if (!phone) {
        return res.status(400).json({ code: "USER_PHONE_REQUIRED" });
      }
      if (await User.findOne({ phone, _id: { $ne: id } })) {
        return res.status(409).json({ code: "USER_PHONE_TAKEN" });
      }
      user.phone = phone;
    }

    if (username !== undefined) {
      username = username?.trim();
      if (!username) {
        return res.status(400).json({ code: "USER_USERNAME_REQUIRED" });
      }
      if (await User.findOne({ username, _id: { $ne: id } })) {
        return res.status(409).json({ code: "USER_USERNAME_TAKEN" });
      }
      user.username = username;
    }

    if (name !== undefined) {
      name = name?.trim();
      if (!name) {
        return res.status(400).json({ code: "USER_NAME_REQUIRED" });
      }
      user.name = name;
    }

    if (role !== undefined) {
      role = role?.trim().toLowerCase();
      if (!["business", "individual"].includes(role)) {
        return res.status(400).json({ code: "AUTH_INVALID_ROLE" });
      }
      user.role = role;
    }

    if (password) {
      const salt = await bcrypt.genSalt();
      user.password = await bcrypt.hash(password, salt);
    }

    if (balance !== undefined) {
      const parsedBalance = Number(balance);
      if (Number.isNaN(parsedBalance) || parsedBalance < 0) {
        return res.status(400).json({ code: "USER_BALANCE_INVALID" });
      }
      user.balance = parsedBalance;
    }

    if (verificationStatus?.isVerified !== undefined) {
      user.verificationStatus.isVerified =
        verificationStatus.isVerified === true;
    }

    if (typeof isActive === "boolean") {
      user.isActive = isActive;
    }

    if (typeof canBuy === "boolean") {
      user.canBuy = canBuy;
    }

    if (typeof canSendCode === "boolean") {
      user.canSendCode = canSendCode;
    }

    if (typeof canManageApiKeys === "boolean") {
      user.canManageApiKeys = canManageApiKeys;
    }

    await user.save();
    return res.status(200).json(user);
  } catch (err) {
    return handleError(err, res);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ code: "USER_ID_REQUIRED" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND" });
    }

    await user.deleteOne();
    return res.status(200).json({ code: "USER_DELETED" });
  } catch (err) {
    return handleError(err, res);
  }
};
