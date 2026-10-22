import mongoose from "mongoose";

import User from "../models/user.model.js";
import RequestLog from "../models/requestLog.model.js";

import { handleError } from "../utils/errorHandler.js";
import parsePagination from "../utils/parsePagination.js";

const ACTION_TYPES = {
  login: 1,
  signup: 1,
  verification_code: 1,
  password_change: 1,
  checkout: 1,
};
const STATUSES = { success: 1, failure: 1 };

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

export const get = async (req, res) => {
  try {
    const {
      userId,
      userQuery,
      actionType,
      status,
      startDate,
      endDate,
      sortOrder,
    } = req.query;
    const { page, limit } = parsePagination(req.query.page, req.query.limit);

    const filter = {};
    const hasUserQuery = Boolean(userQuery && userQuery.trim());

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ code: "REQUEST_LOG_USER_INVALID" });
      }
      filter.userId = userId;
    } else if (hasUserQuery) {
      // Matches either a registered account (by userId) or the raw
      // name/phone captured directly on the log itself - the latter is what
      // makes a failed login against an unregistered phone, or a rejected
      // signup, searchable even though there's no User doc to join against.
      const users = await User.find(buildUserSearchFilter(userQuery))
        .select("_id")
        .limit(200);
      const userIds = users.map((user) => user._id);
      const rawMatch = buildUserSearchFilter(userQuery);

      filter.$or = [
        ...(rawMatch.$or || []),
        ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : []),
      ];
    }

    if (actionType) {
      if (!ACTION_TYPES[actionType]) {
        return res
          .status(400)
          .json({ code: "REQUEST_LOG_ACTION_TYPE_INVALID" });
      }
      filter.actionType = actionType;
    }

    if (status) {
      if (!STATUSES[status]) {
        return res.status(400).json({ code: "REQUEST_LOG_STATUS_INVALID" });
      }
      filter.status = status;
    }

    const normalizedStart = normalizeDate(startDate, false);
    const normalizedEnd = normalizeDate(endDate, true);
    if ((startDate && !normalizedStart) || (endDate && !normalizedEnd)) {
      return res.status(400).json({ code: "REQUEST_LOG_DATE_INVALID" });
    }
    if (normalizedStart || normalizedEnd) {
      filter.createdAt = {};
      if (normalizedStart) {
        filter.createdAt.$gte = normalizedStart;
      }
      if (normalizedEnd) {
        filter.createdAt.$lte = normalizedEnd;
      }
    }

    const resolvedSortOrder = sortOrder === "asc" ? 1 : -1;

    const [logs, total] = await Promise.all([
      RequestLog.find(filter)
        .sort({ createdAt: resolvedSortOrder, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: "userId", select: "name phone" }),
      RequestLog.countDocuments(filter),
    ]);

    const payload = logs.map((log) => {
      const logObj = log.toObject();
      const user =
        logObj.userId && typeof logObj.userId === "object"
          ? logObj.userId
          : null;
      return {
        ...logObj,
        user,
        userId: user?._id ?? logObj.userId,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.status(200).json({
      logs: payload,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    return handleError(err, res);
  }
};

export const deleteRequestLogs = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const normalizedIds = [
      ...new Set(ids.map((id) => String(id).trim())),
    ].filter(Boolean);

    if (normalizedIds.length === 0) {
      return res.status(400).json({ code: "REQUEST_LOG_IDS_REQUIRED" });
    }

    const invalidIds = normalizedIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (invalidIds.length) {
      return res.status(400).json({ code: "REQUEST_LOG_ID_INVALID" });
    }

    const result = await RequestLog.deleteMany({
      _id: { $in: normalizedIds },
    });

    return res.status(200).json({
      deleted: result.deletedCount || 0,
    });
  } catch (err) {
    return handleError(err, res);
  }
};
