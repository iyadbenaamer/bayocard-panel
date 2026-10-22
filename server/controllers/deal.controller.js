import path from "path";

import Deal from "../models/deal.model.js";

import { safeDelete } from "../middleware/media.middleware.js";
import { handleError } from "../utils/errorHandler.js";
import parsePagination from "../utils/parsePagination.js";

const normalizeBoolean = (value) =>
  value === "true" ? true : value === "false" ? false : value;

export const getPaginated = async (req, res) => {
  try {
    const { isActive } = req.query;
    const isPaginated =
      req.query.page !== undefined && req.query.limit !== undefined;
    const { page, limit } = parsePagination(req.query.page, req.query.limit);

    const filter = {};
    if (isActive === "true") {
      filter.isActive = true;
    }
    if (isActive === "false") {
      filter.isActive = false;
    }

    let dealsQuery = Deal.find(filter).sort({ createdAt: -1 });
    if (isPaginated) {
      dealsQuery = dealsQuery.skip((page - 1) * limit).limit(limit);
    }
    const deals = await dealsQuery;
    const total = await Deal.countDocuments(filter);

    return res.status(200).json({ deals, total });
  } catch (err) {
    return handleError(err, res);
  }
};

export const createOne = async (req, res) => {
  try {
    let { badge, link, isActive } = req.body;
    const background = req.filePath;

    badge = badge?.trim();
    link = link?.trim() ?? "";

    if (!badge) {
      return res.status(400).json({ code: "DEAL_BADGE_REQUIRED" });
    }
    if (!background) {
      return res.status(400).json({ code: "DEAL_BACKGROUND_REQUIRED" });
    }

    const normalizedIsActive = normalizeBoolean(isActive);

    const deal = new Deal({
      badge,
      link,
      background,
      isActive: typeof normalizedIsActive === "boolean" ? normalizedIsActive : true,
    });

    await deal.save();
    return res.status(201).json(deal);
  } catch (err) {
    if (req.filePath) {
      const newImagePath = path.join(process.env.UPLOAD_DIR, req.filePath);
      await safeDelete(newImagePath);
    }
    return handleError(err, res);
  }
};

export const updateOne = async (req, res) => {
  try {
    const { id } = req.query;
    let { badge, link, isActive } = req.body;
    const background = req.filePath ?? req.body.background;

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ code: "DEAL_NOT_FOUND" });
    }

    if (badge !== undefined) {
      badge = badge?.trim();
      if (!badge) {
        return res.status(400).json({ code: "DEAL_BADGE_REQUIRED" });
      }
      deal.badge = badge;
    }

    if (link !== undefined) {
      deal.link = link?.trim() ?? "";
    }

    if (background !== undefined) {
      if (!background) {
        return res.status(400).json({ code: "DEAL_BACKGROUND_REQUIRED" });
      }
      // If updating the background image, delete the old one if it exists
      // and is different (a new file was uploaded).
      if (deal.background && deal.background !== background) {
        const oldImagePath = path.join(process.env.UPLOAD_DIR, deal.background);
        await safeDelete(oldImagePath);
      }
      deal.background = background;
    }

    const normalizedIsActive = normalizeBoolean(isActive);
    if (typeof normalizedIsActive === "boolean") {
      deal.isActive = normalizedIsActive;
    }

    await deal.save();
    return res.status(200).json(deal);
  } catch (err) {
    // If update failed but we uploaded a new file, clean it up
    if (req.filePath) {
      const newImagePath = path.join(process.env.UPLOAD_DIR, req.filePath);
      await safeDelete(newImagePath);
    }
    return handleError(err, res);
  }
};

export const deleteOne = async (req, res) => {
  try {
    const { id } = req.query;
    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ code: "DEAL_NOT_FOUND" });
    }

    if (deal.background) {
      const imagePath = path.join(process.env.UPLOAD_DIR, deal.background);
      await safeDelete(imagePath);
    }

    await deal.deleteOne();
    return res.status(200).json({ code: "DEAL_DELETED" });
  } catch (err) {
    return handleError(err, res);
  }
};
