import Discount from "../models/discount.model.js";
import CardTier from "../models/cardTier.model.js";

import { handleError } from "../utils/errorHandler.js";
import parsePagination from "../utils/parsePagination.js";

const normalizeBoolean = (value) =>
  value === "true" ? true : value === "false" ? false : value;

export const getPaginated = async (req, res) => {
  try {
    const isPaginated =
      req.query.page !== undefined && req.query.limit !== undefined;
    const { page, limit } = parsePagination(req.query.page, req.query.limit);

    let discountsQuery = Discount.find()
      .sort({ percentage: -1, createdAt: -1 })
      .populate({
        path: "tierId",
        select: "title sellPrice typeId",
        populate: { path: "typeId", select: "name categoryId" },
      });
    if (isPaginated) {
      discountsQuery = discountsQuery.skip((page - 1) * limit).limit(limit);
    }
    const discounts = await discountsQuery;
    const total = await Discount.countDocuments();

    return res.status(200).json({ discounts, total });
  } catch (err) {
    return handleError(err, res);
  }
};

export const createOne = async (req, res) => {
  try {
    const { tierId, percentage, isActive } = req.body;

    if (!tierId) {
      return res.status(400).json({ code: "DISCOUNT_TIER_ID_REQUIRED" });
    }

    const parsedPercentage = Number(percentage);
    if (
      percentage === undefined ||
      percentage === null ||
      percentage === "" ||
      Number.isNaN(parsedPercentage) ||
      parsedPercentage < 1 ||
      parsedPercentage > 100
    ) {
      return res.status(400).json({ code: "DISCOUNT_PERCENTAGE_INVALID" });
    }

    const tier = await CardTier.findById(tierId);
    if (!tier) {
      return res.status(404).json({ code: "CARD_TIER_NOT_FOUND" });
    }

    const existing = await Discount.findOne({ tierId });
    if (existing) {
      return res.status(409).json({ code: "DISCOUNT_TIER_ALREADY_EXISTS" });
    }

    const normalizedIsActive = normalizeBoolean(isActive);

    const discount = new Discount({
      tierId,
      percentage: parsedPercentage,
      isActive:
        typeof normalizedIsActive === "boolean" ? normalizedIsActive : true,
    });

    await discount.save();
    const populated = await discount.populate({
      path: "tierId",
      select: "title sellPrice typeId",
      populate: { path: "typeId", select: "name categoryId" },
    });

    return res.status(201).json(populated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ code: "DISCOUNT_TIER_ALREADY_EXISTS" });
    }
    return handleError(err, res);
  }
};

export const updateOne = async (req, res) => {
  try {
    const { id } = req.query;
    const { percentage, isActive } = req.body;

    const discount = await Discount.findById(id);
    if (!discount) {
      return res.status(404).json({ code: "DISCOUNT_NOT_FOUND" });
    }

    if (percentage !== undefined) {
      const parsedPercentage = Number(percentage);
      if (
        Number.isNaN(parsedPercentage) ||
        parsedPercentage < 1 ||
        parsedPercentage > 100
      ) {
        return res.status(400).json({ code: "DISCOUNT_PERCENTAGE_INVALID" });
      }
      discount.percentage = parsedPercentage;
    }

    const normalizedIsActive = normalizeBoolean(isActive);
    if (typeof normalizedIsActive === "boolean") {
      discount.isActive = normalizedIsActive;
    }

    await discount.save();
    const populated = await discount.populate({
      path: "tierId",
      select: "title sellPrice typeId",
      populate: { path: "typeId", select: "name categoryId" },
    });

    return res.status(200).json(populated);
  } catch (err) {
    return handleError(err, res);
  }
};

export const deleteOne = async (req, res) => {
  try {
    const { id } = req.query;
    const discount = await Discount.findById(id);
    if (!discount) {
      return res.status(404).json({ code: "DISCOUNT_NOT_FOUND" });
    }

    await discount.deleteOne();
    return res.status(200).json({ code: "DISCOUNT_DELETED" });
  } catch (err) {
    return handleError(err, res);
  }
};
