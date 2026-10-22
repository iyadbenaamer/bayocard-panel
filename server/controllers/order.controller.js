import { Types } from "mongoose";
import crypto from "crypto";
import { decryptCardCode, encryptCardCode } from "../utils/cardCodeCrypto.js";

import Card from "../models/card.model.js";
import CardTier from "../models/cardTier.model.js";
import CustomPricing from "../models/customPricing.model.js";
import Order from "../models/order.model.js";
import Setting from "../models/setting.model.js";
import Transaction from "../models/transaction.model.js";
import User from "../models/user.model.js";

import { handleError } from "../utils/errorHandler.js";
import { getEffectiveBuyPrice } from "../utils/priceCalculator.js";
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

export const getMany = async (req, res) => {
  try {
    const {
      userId,
      userQuery,
      role,
      provider,
      minTotal,
      maxTotal,
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
      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ code: "ORDER_USER_INVALID" });
      }
      filter.userId = new Types.ObjectId(userId);
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
          orders: [],
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

    if (provider) {
      if (!["local", "bamboo"].includes(provider)) {
        return res.status(400).json({ code: "ORDER_PROVIDER_INVALID" });
      }
      filter["items.provider"] = provider;
    }

    const parsedMinTotal = parseAmount(minTotal);
    const parsedMaxTotal = parseAmount(maxTotal);
    if (parsedMinTotal !== null || parsedMaxTotal !== null) {
      if (
        (parsedMinTotal !== null && parsedMinTotal < 0) ||
        (parsedMaxTotal !== null && parsedMaxTotal < 0)
      ) {
        return res.status(400).json({ code: "ORDER_TOTAL_INVALID" });
      }
      filter.totalAmount = {};
      if (parsedMinTotal !== null) {
        filter.totalAmount.$gte = parsedMinTotal;
      }
      if (parsedMaxTotal !== null) {
        filter.totalAmount.$lte = parsedMaxTotal;
      }
    }

    const normalizedStart = normalizeDate(startDate, false);
    const normalizedEnd = normalizeDate(endDate, true);
    if ((startDate && !normalizedStart) || (endDate && !normalizedEnd)) {
      return res.status(400).json({ code: "ORDER_DATE_INVALID" });
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
      totalAmount: "totalAmount",
    };
    const resolvedSortField = sortFieldMap[sortBy];
    const resolvedSortOrder = sortOrder === "asc" ? 1 : -1;

    const ordersPipeline = [];
    if (resolvedSortField) {
      ordersPipeline.push({
        $sort: {
          [resolvedSortField]: resolvedSortOrder,
          _id: 1,
        },
      });
    }

    ordersPipeline.push(
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          let: { lookupUserId: "$userId" },
          as: "userDoc",
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$lookupUserId"],
                },
              },
            },
            { $project: { _id: 1, name: 1, phone: 1 } },
          ],
        },
      },
      {
        $lookup: {
          from: "card_tiers",
          let: { lookupTierIds: "$items.tierId" },
          as: "tiers",
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$lookupTierIds"],
                },
              },
            },
            {
              $lookup: {
                from: "card_types",
                let: { lookupTypeId: "$typeId" },
                as: "typeDoc",
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$_id", "$$lookupTypeId"],
                      },
                    },
                  },
                  { $project: { _id: 1, name: 1 } },
                ],
              },
            },
            {
              $project: {
                _id: 1,
                title: 1,
                typeId: { $first: "$typeDoc" },
              },
            },
          ],
        },
      },
      {
        $addFields: {
          items: {
            $map: {
              input: { $ifNull: ["$items", []] },
              as: "item",
              in: {
                $let: {
                  vars: {
                    tier: {
                      $first: {
                        $filter: {
                          input: "$tiers",
                          as: "tier",
                          cond: { $eq: ["$$tier._id", "$$item.tierId"] },
                        },
                      },
                    },
                    itemWithoutCards: {
                      $arrayToObject: {
                        $filter: {
                          input: { $objectToArray: "$$item" },
                          as: "itemField",
                          cond: { $ne: ["$$itemField.k", "cards"] },
                        },
                      },
                    },
                  },
                  in: {
                    $mergeObjects: [
                      "$$itemWithoutCards",
                      {
                        title: {
                          $ifNull: ["$$tier.title", "$$item.title"],
                        },
                        tierId: {
                          $cond: [
                            { $ifNull: ["$$tier", false] },
                            {
                              _id: "$$tier._id",
                              title: "$$tier.title",
                              typeId: { $ifNull: ["$$tier.typeId", null] },
                            },
                            null,
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          user: {
            $first: "$userDoc",
          },
        },
      },
      {
        $addFields: {
          userId: {
            $ifNull: ["$user._id", "$userId"],
          },
        },
      },
      {
        $project: {
          userDoc: 0,
          tiers: 0,
        },
      },
    );

    const [aggregationResult] = await Order.aggregate([
      { $match: filter },
      {
        $facet: {
          orders: ordersPipeline,
          totalCount: [{ $count: "total" }],
        },
      },
    ]);

    const payload = aggregationResult?.orders || [];
    const total = aggregationResult?.totalCount?.[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      orders: payload,
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

export const deleteMany = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const normalizedIds = [
      ...new Set(ids.map((id) => String(id).trim())),
    ].filter(Boolean);

    if (normalizedIds.length === 0) {
      return res.status(400).json({ code: "ORDER_IDS_REQUIRED" });
    }

    const invalidIds = normalizedIds.filter(
      (id) => !Types.ObjectId.isValid(id),
    );
    if (invalidIds.length) {
      return res.status(400).json({ code: "ORDER_ID_INVALID" });
    }

    const result = await Order.deleteMany({
      _id: { $in: normalizedIds },
    });

    return res.status(200).json({
      deleted: result.deletedCount || 0,
    });
  } catch (err) {
    return handleError(err, res);
  }
};

export const getOne = async (req, res) => {
  try {
    const { id: paramId } = req.params;
    const id = paramId || req.query?.id;

    if (!id) {
      return res.status(400).json({ code: "ORDER_ID_REQUIRED" });
    }

    const order = await Order.findOne({
      _id: id,
    }).populate([
      {
        path: "userId",
        model: "User",
        select: "_id name phone",
      },
      {
        path: "items.cards",
        model: "Card",
      },
      {
        path: "items.tierId",
        model: "CardTier",
        populate: {
          path: "typeId",
          model: "CardType",
        },
      },
    ]);

    if (!order) {
      return res.status(404).json({ code: "ORDER_NOT_FOUND" });
    }

    const orderObj = order.toObject();
    const items = Array.isArray(orderObj.items) ? orderObj.items : [];
    const user =
      orderObj.userId && typeof orderObj.userId === "object"
        ? {
            _id: orderObj.userId._id,
            name: orderObj.userId.name,
            phone: orderObj.userId.phone,
          }
        : null;

    const payload = {
      _id: orderObj._id,
      user,
      totalAmount: orderObj.totalAmount,
      createdAt: orderObj.createdAt,
      items: items.map((item) => {
        const tier =
          item?.tierId && typeof item.tierId === "object" ? item.tierId : null;
        const type =
          tier?.typeId && typeof tier.typeId === "object" ? tier.typeId : null;
        const cards = Array.isArray(item?.cards) ? item.cards : [];

        return {
          tierId: tier
            ? {
                _id: tier._id,
                title: tier.title,
                typeId: type
                  ? {
                      _id: type._id,
                      name: type.name,
                      redeemFormat: type.redeemFormat ?? null,
                      image: type.image ?? null,
                      printImage: type.printImage ?? null,
                      showExpiryDateDay: type.showExpiryDateDay ?? null,
                    }
                  : null,
              }
            : null,
          title: tier?.title || item?.title,
          price: item?.price,
          quantity: item?.quantity,
          provider: item?.provider,
          cards: cards.map((card) => {
            if (!card || typeof card !== "object") {
              return card ? { _id: card } : card;
            }

            const decryptedCode = card.code
              ? decryptCardCode(card.code)
              : (card.code ?? null);

            return {
              _id: card._id,
              serialNumber: card.serialNumber ?? null,
              code: decryptedCode,
              pin: card.pin ?? null,
              expiryDate: card.expiryDate ?? null,
              redeemFormat: type?.redeemFormat || null,
            };
          }),
        };
      }),
    };

    return res.status(200).json(payload);
  } catch (err) {
    return handleError(err, res);
  }
};
