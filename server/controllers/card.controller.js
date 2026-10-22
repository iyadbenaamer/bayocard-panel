import mongoose from "mongoose";
import fs from "fs";
import ExcelJS from "exceljs";

import Card from "../models/card.model.js";
import CardTier from "../models/cardTier.model.js";
import CardType from "../models/cardType.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";

import { handleError } from "../utils/errorHandler.js";
import parsePagination from "../utils/parsePagination.js";
import crypto from "crypto";
import { decryptCardCode, encryptCardCode } from "../utils/cardCodeCrypto.js";
import generateRandomSerialNumber from "../utils/generateRandomSerialNumber.js";
import { recordCardSale } from "../utils/statsTracker.js";

const isValidSerialNumber = (value) => /^\d{15}$/.test(value);

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

const hashCardCode = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const normalizeOptionalString = (value) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const nextValue = String(value).trim();
  return nextValue ? nextValue : null;
};

const normalizeOptionalDate = (value) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return { error: true };
  }

  return parsedDate;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Cards don't reference their sale order directly: the Order's line items
// list the Card ids that were fulfilled. Resolves an order id/id-fragment
// query down to the matching card ids by walking that chain.
const resolveCardIdsByOrderQuery = async (query) => {
  const isFullId = mongoose.Types.ObjectId.isValid(query) && query.length === 24;
  const orderMatch = isFullId
    ? { _id: new mongoose.Types.ObjectId(query) }
    : {
        $expr: {
          $regexMatch: {
            input: { $toString: "$_id" },
            regex: escapeRegex(query),
            options: "i",
          },
        },
      };

  const orders = await Order.find(orderMatch).select("items.cards");
  const cardIds = new Set();
  orders.forEach((order) => {
    (order.items ?? []).forEach((item) => {
      (item.cards ?? []).forEach((cardId) => cardIds.add(String(cardId)));
    });
  });
  return [...cardIds];
};

const parseExcelCodes = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets?.[0];
  if (!sheet) return [];

  const codes = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cellValue = row.getCell(1)?.value;
    if (cellValue == null) return;

    let normalizedValue = cellValue;
    if (typeof cellValue === "object") {
      if (cellValue.text) {
        normalizedValue = cellValue.text;
      } else if (Array.isArray(cellValue.richText)) {
        normalizedValue = cellValue.richText.map((part) => part.text).join("");
      } else if ("result" in cellValue) {
        normalizedValue = cellValue.result;
      }
    }

    const trimmed = String(normalizedValue).trim();
    if (trimmed.length > 0) {
      codes.push(trimmed);
    }
  });

  return codes;
};

const withDecryptedCode = (card) => {
  const data = card.toObject();
  data.code = decryptCardCode(data.code);
  return data;
};

export const getPaginated = async (req, res) => {
  try {
    const { tierId, soldTo, serialNumber, isSold } = req.query;
    const { page, limit } = parsePagination(req.query.page, req.query.limit);

    const filter = {};

    if (tierId) {
      if (!mongoose.Types.ObjectId.isValid(tierId)) {
        return res.status(400).json({ code: "CARD_TIER_ID_INVALID" });
      }
      filter.tierId = tierId;
    }

    if (soldTo) {
      if (!mongoose.Types.ObjectId.isValid(soldTo)) {
        return res.status(400).json({ code: "CARD_SOLD_TO_INVALID" });
      }
      filter.soldTo = soldTo;
    } else if (isSold === "true") {
      filter.soldTo = { $ne: null };
    } else if (isSold === "false") {
      filter.soldTo = null;
    }

    if (serialNumber) {
      const escaped = serialNumber.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.serialNumber = { $regex: escaped, $options: "i" };
    }

    const startDate = normalizeDate(req.query.startDate, false);
    const endDate = normalizeDate(req.query.endDate, true);
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    const total = await Card.countDocuments(filter);
    const cards = await Card.find(filter)
      .sort({ serialNumber: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const payload = cards.map(withDecryptedCode);

    return res.status(200).json({
      cards: payload,
      total,
      totalPages,
      page,
      limit,
    });
  } catch (err) {
    return handleError(err, res);
  }
};

const CARD_SEARCH_TYPES = new Set([
  "serialNumber",
  "orderNumber",
  "pin",
  "code",
]);

// Strips ALL whitespace (not just leading/trailing) so pasted queries with
// stray or grouping spaces still match: e.g. "1234 5678" -> "12345678".
const stripWhitespace = (value) => value.replace(/\s+/g, "");

export const getByCategory = async (req, res) => {
  try {
    const {
      categoryId,
      sortBy,
      sortOrder,
      typeId,
      isSold,
      searchType,
      searchQuery,
    } = req.query;
    const { page, limit } = parsePagination(req.query.page, req.query.limit);

    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ code: "CARD_CATEGORY_ID_INVALID" });
    }

    if (typeId && !mongoose.Types.ObjectId.isValid(typeId)) {
      return res.status(400).json({ code: "CARD_TYPE_ID_INVALID" });
    }

    const allowedSortFields = new Set([
      "serialNumber",
      "isSold",
      "createdAt",
      "typeName",
      "tierTitle",
    ]);
    const sortFieldMap = { typeName: "typeName.ar", tierTitle: "tierTitle.ar" };
    const sortField = allowedSortFields.has(sortBy)
      ? (sortFieldMap[sortBy] ?? sortBy)
      : "serialNumber";
    const sortDirection = sortOrder === "desc" ? -1 : 1;

    const trimmedQuery = searchQuery ? stripWhitespace(searchQuery) : "";
    const effectiveSearchType = CARD_SEARCH_TYPES.has(searchType)
      ? searchType
      : "serialNumber";

    let matchSearch = {};
    if (trimmedQuery) {
      if (effectiveSearchType === "pin") {
        matchSearch = { pin: { $regex: escapeRegex(trimmedQuery), $options: "i" } };
      } else if (effectiveSearchType === "code") {
        // codeHash is a sha256 of the plaintext code, computed the same way
        // at write time, so this is an exact-match lookup on an indexed
        // field instead of decrypting every card's code to compare.
        matchSearch = { codeHash: hashCardCode(trimmedQuery) };
      } else if (effectiveSearchType === "orderNumber") {
        const cardIds = await resolveCardIdsByOrderQuery(trimmedQuery);
        matchSearch = {
          _id: { $in: cardIds.map((id) => new mongoose.Types.ObjectId(id)) },
        };
      } else {
        matchSearch = {
          serialNumber: { $regex: escapeRegex(trimmedQuery), $options: "i" },
        };
      }
    }

    const startDate = normalizeDate(req.query.startDate, false);
    const endDate = normalizeDate(req.query.endDate, true);
    const matchDate = {};
    if (startDate || endDate) {
      matchDate.createdAt = {};
      if (startDate) matchDate.createdAt.$gte = startDate;
      if (endDate) matchDate.createdAt.$lte = endDate;
    }

    const postJoinMatch = {
      "type.categoryId": new mongoose.Types.ObjectId(categoryId),
    };
    if (typeId) {
      postJoinMatch["type._id"] = new mongoose.Types.ObjectId(typeId);
    }
    if (isSold === "true" || isSold === "false") {
      postJoinMatch.isSold = isSold === "true";
    }

    const pipeline = [
      { $match: { ...matchSearch, ...matchDate } },
      {
        $lookup: {
          from: "card_tiers",
          localField: "tierId",
          foreignField: "_id",
          as: "tier",
        },
      },
      { $unwind: "$tier" },
      {
        $lookup: {
          from: "card_types",
          localField: "tier.typeId",
          foreignField: "_id",
          as: "type",
        },
      },
      { $unwind: "$type" },
      {
        $lookup: {
          from: "users",
          localField: "soldTo",
          foreignField: "_id",
          as: "buyer",
        },
      },
      { $unwind: { path: "$buyer", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          isSold: { $ne: ["$soldTo", null] },
        },
      },
      { $match: postJoinMatch },
      {
        $project: {
          serialNumber: 1,
          code: 1,
          isSold: 1,
          tierTitle: "$tier.title",
          typeName: "$type.name",
          buyerName: "$buyer.name",
          buyerPhone: "$buyer.phone",
          createdAt: 1,
        },
      },
      { $sort: { [sortField]: sortDirection, _id: 1 } },
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await Card.aggregate(pipeline);
    const total = result?.total?.[0]?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const cards = (result?.data ?? []).map((card) => ({
      ...card,
      code: decryptCardCode(card.code),
    }));

    return res.status(200).json({
      cards,
      total,
      totalPages,
      page,
    });
  } catch (err) {
    return handleError(err, res);
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ code: "CARD_ID_REQUIRED" });
    }

    const card = await Card.findById(id);
    if (!card) {
      return res.status(404).json({ code: "CARD_NOT_FOUND" });
    }

    const tier = await CardTier.findById(card.tierId).select("title typeId");
    const [type, buyer, order] = await Promise.all([
      tier ? CardType.findById(tier.typeId).select("name") : null,
      card.soldTo ? User.findById(card.soldTo).select("name phone") : null,
      // Cards don't store their sale order directly; the order's line items
      // list the card ids that were fulfilled, so we look it up in reverse.
      card.soldTo
        ? Order.findOne({ "items.cards": card._id }).select("_id")
        : null,
    ]);

    const data = withDecryptedCode(card);
    data.tierTitle = tier?.title ?? null;
    data.typeName = type?.name ?? null;
    data.buyerName = buyer?.name ?? null;
    data.buyerPhone = buyer?.phone ?? null;
    data.orderId = order?._id ?? null;

    return res.status(200).json(data);
  } catch (err) {
    return handleError(err, res);
  }
};

export const updateOne = async (req, res) => {
  try {
    const { id } = req.query;
    let { tierId, serialNumber, code, pin, expiryDate, soldTo, soldAt } =
      req.body;

    const card = await Card.findById(id);
    if (!card) {
      return res.status(404).json({ code: "CARD_NOT_FOUND" });
    }
    const wasSold = Boolean(card.soldTo);

    const resolveTargetTier = async () => {
      const targetTierId = tierId ?? card.tierId;
      return CardTier.findById(targetTierId);
    };

    if (tierId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(tierId)) {
        return res.status(400).json({ code: "CARD_TIER_ID_INVALID" });
      }
      const tierExists = await CardTier.findById(tierId);
      if (!tierExists) {
        return res.status(404).json({ code: "CARD_TIER_NOT_FOUND" });
      }
      card.tierId = tierId;
    }

    if (serialNumber !== undefined) {
      serialNumber = serialNumber?.trim();
      if (!serialNumber) {
        return res.status(400).json({ code: "CARD_SERIAL_NUMBER_REQUIRED" });
      }
      if (!isValidSerialNumber(serialNumber)) {
        return res.status(400).json({ code: "CARD_SERIAL_NUMBER_INVALID" });
      }
      if (await Card.findOne({ serialNumber, _id: { $ne: card._id } })) {
        return res.status(409).json({ code: "CARD_SERIAL_NUMBER_TAKEN" });
      }
      card.serialNumber = serialNumber;
    }

    if (code !== undefined) {
      code = code?.trim();
      if (!code) {
        return res.status(400).json({ code: "CARD_CODE_REQUIRED" });
      }
      const targetTier = await resolveTargetTier();
      if (!targetTier) {
        return res.status(404).json({ code: "CARD_TIER_NOT_FOUND" });
      }
      const relatedTierIds = await CardTier.find({
        typeId: targetTier.typeId,
      }).select("_id");
      const codeHash = hashCardCode(code);
      const duplicate = await Card.findOne({
        _id: { $ne: card._id },
        tierId: { $in: relatedTierIds.map((tier) => tier._id) },
        codeHash,
      });
      if (duplicate) {
        return res.status(409).json({ code: "CARD_CODE_DUPLICATE" });
      }
      card.code = encryptCardCode(code);
      card.codeHash = codeHash;
    }

    if (pin !== undefined) {
      card.pin = normalizeOptionalString(pin);
    }

    if (expiryDate !== undefined) {
      const parsedExpiryDate = normalizeOptionalDate(expiryDate);
      if (parsedExpiryDate && parsedExpiryDate.error) {
        return res.status(400).json({ code: "CARD_EXPIRY_DATE_INVALID" });
      }
      card.expiryDate = parsedExpiryDate;
    }

    if (tierId !== undefined && code === undefined && card.codeHash) {
      const targetTier = await resolveTargetTier();
      if (!targetTier) {
        return res.status(404).json({ code: "CARD_TIER_NOT_FOUND" });
      }
      const relatedTierIds = await CardTier.find({
        typeId: targetTier.typeId,
      }).select("_id");
      const duplicate = await Card.findOne({
        _id: { $ne: card._id },
        tierId: { $in: relatedTierIds.map((tier) => tier._id) },
        codeHash: card.codeHash,
      });
      if (duplicate) {
        return res.status(409).json({ code: "CARD_CODE_DUPLICATE" });
      }
    }

    if (soldTo !== undefined) {
      if (soldTo === null || soldTo === "") {
        card.soldTo = null;
      } else if (!mongoose.Types.ObjectId.isValid(soldTo)) {
        return res.status(400).json({ code: "CARD_SOLD_TO_INVALID" });
      } else {
        card.soldTo = soldTo;
      }
    }

    if (soldAt !== undefined) {
      const parsedSoldAt = soldAt ? new Date(soldAt) : null;
      if (parsedSoldAt && Number.isNaN(parsedSoldAt.getTime())) {
        return res.status(400).json({ code: "CARD_SOLD_AT_INVALID" });
      }
      card.soldAt = parsedSoldAt;
    }

    await card.save();

    // Best-effort: keep the persistent sold-cards stats counters in sync
    // when an admin marks a card sold/unsold by hand, since these counters
    // (not a live count of Card documents) drive the admin dashboard.
    const isSold = Boolean(card.soldTo);
    if (wasSold !== isSold) {
      try {
        const targetTier = await CardTier.findById(card.tierId).select(
          "typeId",
        );
        if (targetTier) {
          await recordCardSale({
            typeId: targetTier.typeId,
            delta: isSold ? 1 : -1,
          });
        }
      } catch (statsError) {
        console.error("Failed to record card sale stats:", statsError);
      }
    }

    return res.status(200).json(withDecryptedCode(card));
  } catch (err) {
    return handleError(err, res);
  }
};

export const createOne = async (req, res) => {
  try {
    let { tierId, serialNumber, code, pin, expiryDate, soldTo, soldAt } =
      req.body;

    if (!tierId || !code) {
      return res.status(400).json({ code: "CARD_REQUIRED_FIELDS_MISSING" });
    }

    if (!mongoose.Types.ObjectId.isValid(tierId)) {
      return res.status(400).json({ code: "CARD_TIER_ID_INVALID" });
    }

    const tierExists = await CardTier.findById(tierId);
    if (!tierExists) {
      return res.status(404).json({ code: "CARD_TIER_NOT_FOUND" });
    }

    serialNumber = serialNumber?.trim();
    if (serialNumber) {
      if (!isValidSerialNumber(serialNumber)) {
        return res.status(400).json({ code: "CARD_SERIAL_NUMBER_INVALID" });
      }
      if (await Card.findOne({ serialNumber })) {
        return res.status(409).json({ code: "CARD_SERIAL_NUMBER_TAKEN" });
      }
    }

    code = code?.trim();
    if (!code) {
      return res.status(400).json({ code: "CARD_CODE_REQUIRED" });
    }

    pin = normalizeOptionalString(pin);
    const normalizedExpiryDate = normalizeOptionalDate(expiryDate);
    if (normalizedExpiryDate && normalizedExpiryDate.error) {
      return res.status(400).json({ code: "CARD_EXPIRY_DATE_INVALID" });
    }

    const codeHash = hashCardCode(code);
    const relatedTierIds = await CardTier.find({
      typeId: tierExists.typeId,
    }).select("_id");
    const duplicate = await Card.findOne({
      tierId: { $in: relatedTierIds.map((tier) => tier._id) },
      codeHash,
    });
    if (duplicate) {
      return res.status(409).json({ code: "CARD_CODE_DUPLICATE" });
    }

    if (soldTo !== undefined) {
      if (soldTo === null || soldTo === "") {
        soldTo = null;
      } else if (!mongoose.Types.ObjectId.isValid(soldTo)) {
        return res.status(400).json({ code: "CARD_SOLD_TO_INVALID" });
      }
    }

    if (soldAt !== undefined) {
      const parsedSoldAt = soldAt ? new Date(soldAt) : null;
      if (parsedSoldAt && Number.isNaN(parsedSoldAt.getTime())) {
        return res.status(400).json({ code: "CARD_SOLD_AT_INVALID" });
      }
      soldAt = parsedSoldAt;
    }

    const shouldAutoGenerateSerial = !serialNumber;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const nextSerial = shouldAutoGenerateSerial
        ? generateRandomSerialNumber()
        : serialNumber;

      const card = new Card({
        tierId,
        serialNumber: nextSerial,
        code: encryptCardCode(code),
        codeHash,
        pin,
        expiryDate: normalizedExpiryDate,
        soldTo,
        soldAt,
      });

      try {
        await card.save();

        if (soldTo) {
          try {
            await recordCardSale({
              typeId: tierExists.typeId,
              delta: 1,
            });
          } catch (statsError) {
            console.error("Failed to record card sale stats:", statsError);
          }
        }

        return res.status(201).json(withDecryptedCode(card));
      } catch (err) {
        if (err?.code === 11000 && shouldAutoGenerateSerial) {
          continue;
        }
        if (err?.code === 11000) {
          return res.status(409).json({ code: "CARD_SERIAL_NUMBER_TAKEN" });
        }
        throw err;
      }
    }

    return res.status(409).json({ code: "CARD_SERIAL_NUMBER_TAKEN" });
  } catch (err) {
    return handleError(err, res);
  }
};

export const deleteOne = async (req, res) => {
  try {
    const { id } = req.query;

    const card = await Card.findById(id);
    if (!card) {
      return res.status(404).json({ code: "CARD_NOT_FOUND" });
    }

    await card.deleteOne();
    return res.status(200).json({ code: "CARD_DELETED" });
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
      return res.status(400).json({ code: "CARD_IDS_REQUIRED" });
    }

    const invalidIds = normalizedIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (invalidIds.length) {
      return res.status(400).json({ code: "CARD_ID_INVALID" });
    }

    const result = await Card.deleteMany({
      _id: { $in: normalizedIds },
    });

    return res.status(200).json({
      deleted: result.deletedCount || 0,
    });
  } catch (err) {
    return handleError(err, res);
  }
};

export const importFromExcel = async (req, res) => {
  const filePath = req.file?.path;
  try {
    const { tierId } = req.body;

    if (!filePath) {
      return res.status(400).json({ code: "CARD_IMPORT_FILE_REQUIRED" });
    }

    if (!tierId || !mongoose.Types.ObjectId.isValid(tierId)) {
      return res.status(400).json({ code: "CARD_TIER_ID_INVALID" });
    }

    const tierExists = await CardTier.findById(tierId);
    if (!tierExists) {
      return res.status(404).json({ code: "CARD_TIER_NOT_FOUND" });
    }

    const relatedTierIds = await CardTier.find({
      typeId: tierExists.typeId,
    }).select("_id");
    const relatedTierIdList = relatedTierIds.map((tier) => tier._id);

    const codes = await parseExcelCodes(filePath);
    if (codes.length === 0) {
      return res.status(400).json({ code: "CARD_IMPORT_EMPTY" });
    }

    let created = 0;
    const failed = [];

    for (const code of codes) {
      const normalizedCode = code?.trim();
      if (!normalizedCode) {
        continue;
      }

      const codeHash = hashCardCode(normalizedCode);
      const duplicate = await Card.findOne({
        tierId: { $in: relatedTierIdList },
        codeHash,
      });
      if (duplicate) {
        failed.push({ code: normalizedCode, reason: "CARD_CODE_DUPLICATE" });
        continue;
      }

      let createdCard = false;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const serialNumber = generateRandomSerialNumber();
        const card = new Card({
          tierId,
          serialNumber,
          code: encryptCardCode(normalizedCode),
          codeHash,
        });
        try {
          await card.save();
          created += 1;
          createdCard = true;
          break;
        } catch (err) {
          if (err?.code === 11000) {
            continue;
          }
          failed.push({ code: normalizedCode, reason: "CARD_CREATE_FAILED" });
          break;
        }
      }

      if (!createdCard) {
        failed.push({
          code: normalizedCode,
          reason: "CARD_SERIAL_NUMBER_TAKEN",
        });
      }
    }

    return res.status(201).json({
      created,
      failedCount: failed.length,
      failed,
    });
  } catch (err) {
    return handleError(err, res);
  } finally {
    if (filePath) {
      fs.promises.unlink(filePath).catch(() => null);
    }
  }
};
