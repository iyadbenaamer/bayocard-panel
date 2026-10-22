import mongoose from "mongoose";

import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";

import { handleError } from "../utils/errorHandler.js";
import parsePagination from "../utils/parsePagination.js";

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

const parseAmount = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const createDeposit = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId) {
      return res.status(400).json({ code: "TRANSACTION_USER_REQUIRED" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ code: "TRANSACTION_USER_INVALID" });
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ code: "TRANSACTION_AMOUNT_INVALID" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND" });
    }

    const balanceBefore = user.balance;
    user.balance = balanceBefore + parsedAmount;
    await user.save();

    const transaction = new Transaction({
      userId: user._id,
      type: "deposit",
      amount: parsedAmount,
      balanceBefore,
      balanceAfter: user.balance,
      createdByAdmin: req.admin?._id || undefined,
    });

    await transaction.save();

    return res.status(201).json({
      transaction,
      balance: user.balance,
    });
  } catch (err) {
    return handleError(err, res);
  }
};

export const createRefund = async (req, res) => {
  try {
    const { transactionId, amount } = req.body;

    if (!transactionId) {
      return res.status(400).json({ code: "TRANSACTION_ORIGINAL_REQUIRED" });
    }

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ code: "TRANSACTION_ORIGINAL_INVALID" });
    }

    const original = await Transaction.findById(transactionId);
    if (!original) {
      return res.status(404).json({ code: "TRANSACTION_ORIGINAL_NOT_FOUND" });
    }

    const parsedAmount =
      amount === undefined || amount === null
        ? original.amount
        : Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ code: "TRANSACTION_AMOUNT_INVALID" });
    }
    if (parsedAmount > original.amount) {
      return res.status(400).json({ code: "TRANSACTION_AMOUNT_EXCEEDS" });
    }

    const user = await User.findById(original.userId);
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND" });
    }

    const balanceBefore = user.balance;
    user.balance = balanceBefore + parsedAmount;
    await user.save();

    const refund = new Transaction({
      userId: user._id,
      type: "refund",
      amount: parsedAmount,
      balanceBefore,
      balanceAfter: user.balance,
      createdByAdmin: req.admin?._id || undefined,
      originalTransactionId: original._id,
    });

    await refund.save();

    return res.status(201).json({
      transaction: refund,
      balance: user.balance,
    });
  } catch (err) {
    return handleError(err, res);
  }
};

export const get = async (req, res) => {
  try {
    const {
      userId,
      userQuery,
      role,
      type,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = req.query;
    const { page, limit } = parsePagination(req.query.page, req.query.limit);

    const filter = {};
    const roleFilter =
      role === "business" || role === "individual" ? { role } : {};
    const hasUserQuery = Boolean(userQuery && userQuery.trim());

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ code: "TRANSACTION_USER_INVALID" });
      }
      filter.userId = userId;
    } else if (hasUserQuery || Object.keys(roleFilter).length > 0) {
      let usersQuery = User.find({
        ...(hasUserQuery ? buildUserSearchFilter(userQuery) : {}),
        ...roleFilter,
      }).select("_id");
      // The 200 cap only guards free-text search; a role filter is a broad
      // category (roughly half of all users) and must not be truncated.
      if (hasUserQuery) {
        usersQuery = usersQuery.limit(200);
      }
      const users = await usersQuery;
      const userIds = users.map((user) => user._id);
      if (userIds.length === 0) {
        return res.status(200).json({
          transactions: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
            hasMore: false,
          },
        });
      }
      filter.userId = { $in: userIds };
    }

    if (type) {
      if (!{ deposit: 1, purchase: 1, refund: 1 }[type]) {
        return res.status(400).json({ code: "TRANSACTION_TYPE_INVALID" });
      }
      filter.type = type;
    }

    const parsedMinAmount = parseAmount(minAmount);
    const parsedMaxAmount = parseAmount(maxAmount);
    if (parsedMinAmount !== null || parsedMaxAmount !== null) {
      if (
        (parsedMinAmount !== null && parsedMinAmount < 0) ||
        (parsedMaxAmount !== null && parsedMaxAmount < 0)
      ) {
        return res.status(400).json({ code: "TRANSACTION_AMOUNT_INVALID" });
      }
      filter.amount = {};
      if (parsedMinAmount !== null) {
        filter.amount.$gte = parsedMinAmount;
      }
      if (parsedMaxAmount !== null) {
        filter.amount.$lte = parsedMaxAmount;
      }
    }

    const normalizedStart = normalizeDate(startDate, false);
    const normalizedEnd = normalizeDate(endDate, true);
    if ((startDate && !normalizedStart) || (endDate && !normalizedEnd)) {
      return res.status(400).json({ code: "TRANSACTION_DATE_INVALID" });
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

    const sortFieldMap = {
      createdAt: "createdAt",
      amount: "amount",
      type: "type",
    };
    const resolvedSortField = sortFieldMap[sortBy] || "createdAt";
    const resolvedSortOrder = sortOrder === "asc" ? 1 : -1;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ [resolvedSortField]: resolvedSortOrder, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: "userId", select: "name phone" }),
      Transaction.countDocuments(filter),
    ]);

    const payload = transactions.map((tx) => {
      const txObj = tx.toObject();
      const user =
        txObj.userId && typeof txObj.userId === "object" ? txObj.userId : null;
      return {
        ...txObj,
        user,
        userId: user?._id ?? txObj.userId,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.status(200).json({
      transactions: payload,
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

export const deleteTransactions = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const normalizedIds = [
      ...new Set(ids.map((id) => String(id).trim())),
    ].filter(Boolean);

    if (normalizedIds.length === 0) {
      return res.status(400).json({ code: "TRANSACTION_IDS_REQUIRED" });
    }

    const invalidIds = normalizedIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (invalidIds.length) {
      return res.status(400).json({ code: "TRANSACTION_ID_INVALID" });
    }

    const result = await Transaction.deleteMany({
      _id: { $in: normalizedIds },
    });

    return res.status(200).json({
      deleted: result.deletedCount || 0,
    });
  } catch (err) {
    return handleError(err, res);
  }
};
