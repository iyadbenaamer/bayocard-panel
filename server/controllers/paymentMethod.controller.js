import path from "path";
import mongoose from "mongoose";

import PaymentMethod from "../models/paymentMethod.model.js";

import { safeDelete } from "../middleware/media.middleware.js";
import * as ezonePay from "../services/ezonePay.js";
import { handleError } from "../utils/errorHandler.js";
import parsePagination from "../utils/parsePagination.js";

const normalizeBoolean = (value) =>
  value === "true" ? true : value === "false" ? false : value;

export const getPaginated = async (req, res) => {
  try {
    const { active } = req.query;
    const isPaginated =
      req.query.page !== undefined && req.query.limit !== undefined;
    const { page, limit } = parsePagination(req.query.page, req.query.limit);

    const filter = {};
    if (active === "true") {
      filter.active = true;
    }
    if (active === "false") {
      filter.active = false;
    }

    let query = PaymentMethod.find(filter).sort({
      order: 1,
      createdAt: -1,
      _id: 1,
    });
    if (isPaginated) {
      query = query.skip((page - 1) * limit).limit(limit);
    }
    const paymentMethods = await query;
    const total = await PaymentMethod.countDocuments(filter);

    return res.status(200).json({ paymentMethods, total });
  } catch (err) {
    return handleError(err, res);
  }
};

const toSyncedMethod = (method) => {
  const providerMethodId = Number(
    method?.id ??
      method?.Id ??
      method?.paymentMethodId ??
      method?.PaymentMethodId,
  );
  const label = String(
    method?.name ??
      method?.Name ??
      method?.paymentMethodName ??
      method?.PaymentMethodName ??
      method?.displayName ??
      method?.DisplayName ??
      "",
  ).trim();
  const methodCode = String(method?.method ?? method?.Method ?? "").trim();
  const rawIsOnline = method?.isOnline ?? method?.IsOnline;
  const isOnline =
    rawIsOnline === undefined || rawIsOnline === null
      ? true
      : rawIsOnline === true || rawIsOnline === "true"
        ? true
        : rawIsOnline === false || rawIsOnline === "false"
          ? false
          : null;
  const logoUrl = String(
    method?.logoUrl ??
      method?.LogoUrl ??
      method?.imageUrl ??
      method?.ImageUrl ??
      "",
  ).trim();
  const { minDeposit, maxDeposit } = ezonePay.getDepositLimits(method);

  if (
    !Number.isSafeInteger(providerMethodId) ||
    providerMethodId <= 0 ||
    !label ||
    isOnline === null
  ) {
    const error = new Error("EZONE_API_RESPONSE_INVALID");
    error.code = "EZONE_API_RESPONSE_INVALID";
    throw error;
  }

  const slug = (methodCode || label)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return {
    providerMethodId,
    name: `ezone_${providerMethodId}${slug ? `_${slug}` : ""}`,
    label,
    isOnline,
    minDeposit,
    maxDeposit,
    iconPath: /^https?:\/\//i.test(logoUrl) ? logoUrl : "",
  };
};

export const syncFromEzone = async (req, res) => {
  try {
    const upstreamMethods = await ezonePay.getPaymentMethods();
    const methods = upstreamMethods.map(toSyncedMethod);
    const providerMethodIds = new Set(
      methods.map((method) => method.providerMethodId),
    );
    if (providerMethodIds.size !== methods.length) {
      const error = new Error("EZONE_API_RESPONSE_INVALID");
      error.code = "EZONE_API_RESPONSE_INVALID";
      throw error;
    }

    let createdCount = 0;
    let updatedCount = 0;
    for (const method of methods) {
      const existing = await PaymentMethod.findOne({
        provider: "ezone",
        providerMethodId: method.providerMethodId,
      });
      const values = {
        ...method,
        provider: "ezone",
        iconPath: method.iconPath || existing?.iconPath || "",
        active: existing ? existing.active && method.isOnline : method.isOnline,
      };

      if (existing) {
        await PaymentMethod.updateOne(
          { _id: existing._id },
          { $set: values },
          { runValidators: true },
        );
        updatedCount += 1;
      } else {
        const lastMethod = await PaymentMethod.findOne()
          .sort({ order: -1, createdAt: -1 })
          .select("order");
        values.order = Number(lastMethod?.order ?? 0) + 1;
        await PaymentMethod.create(values);
        createdCount += 1;
      }
    }

    if (providerMethodIds.size > 0) {
      await PaymentMethod.updateMany(
        {
          provider: "ezone",
          providerMethodId: { $nin: [...providerMethodIds] },
        },
        { $set: { active: false } },
      );
    }

    return res
      .status(200)
      .json({ syncedCount: methods.length, createdCount, updatedCount });
  } catch (err) {
    if (err.code === "EZONE_API_KEY_MISSING") {
      return res.status(500).json({ code: "EZONE_API_KEY_MISSING" });
    }
    if (
      err.code === "EZONE_API_REQUEST_FAILED" ||
      err.code === "EZONE_API_UNAVAILABLE" ||
      err.code === "EZONE_API_RESPONSE_INVALID"
    ) {
      return res.status(502).json({
        code: err.code,
        providerStatus: err.status || null,
      });
    }
    return handleError(err, res);
  }
};

export const createOne = async (req, res) => {
  try {
    let { name, label, minDeposit, maxDeposit, active } = req.body;
    const iconPath = req.iconPath;

    name = name?.trim();
    label = label?.trim();

    if (!name) {
      return res.status(400).json({ code: "PAYMENT_METHOD_NAME_REQUIRED" });
    }
    if (!label) {
      return res.status(400).json({ code: "PAYMENT_METHOD_LABEL_REQUIRED" });
    }
    if (!iconPath) {
      return res.status(400).json({ code: "PAYMENT_METHOD_ICON_REQUIRED" });
    }

    const parsedMin = Number(minDeposit);
    const parsedMax =
      maxDeposit === "" || maxDeposit === null || maxDeposit === undefined
        ? null
        : Number(maxDeposit);
    if (!Number.isFinite(parsedMin) || parsedMin < 0) {
      return res
        .status(400)
        .json({ code: "PAYMENT_METHOD_MIN_DEPOSIT_INVALID" });
    }
    if (
      parsedMax !== null &&
      (!Number.isFinite(parsedMax) || parsedMax <= parsedMin)
    ) {
      return res
        .status(400)
        .json({ code: "PAYMENT_METHOD_MAX_DEPOSIT_INVALID" });
    }

    const existing = await PaymentMethod.findOne({ name });
    if (existing) {
      return res.status(400).json({ code: "PAYMENT_METHOD_NAME_TAKEN" });
    }

    const lastMethod = await PaymentMethod.findOne()
      .sort({ order: -1, createdAt: -1 })
      .select("order");
    const normalizedActive = normalizeBoolean(active);

    const paymentMethod = new PaymentMethod({
      name,
      label,
      iconPath,
      minDeposit: parsedMin,
      maxDeposit: parsedMax,
      active: typeof normalizedActive === "boolean" ? normalizedActive : true,
      order: Number(lastMethod?.order ?? 0) + 1,
    });

    await paymentMethod.save();
    return res.status(201).json(paymentMethod);
  } catch (err) {
    if (req.iconPath) {
      const newIconPath = path.join(process.env.UPLOAD_DIR, req.iconPath);
      await safeDelete(newIconPath);
    }
    return handleError(err, res);
  }
};

export const updateOne = async (req, res) => {
  try {
    const { id } = req.query;
    let { name, label, minDeposit, maxDeposit, active } = req.body;
    const iconPath = req.iconPath;

    const paymentMethod = await PaymentMethod.findById(id);
    if (!paymentMethod) {
      return res.status(404).json({ code: "PAYMENT_METHOD_NOT_FOUND" });
    }

    if (name !== undefined) {
      name = name.trim();
      if (!name) {
        return res.status(400).json({ code: "PAYMENT_METHOD_NAME_REQUIRED" });
      }
      if (name !== paymentMethod.name) {
        const existing = await PaymentMethod.findOne({ name });
        if (existing) {
          return res.status(400).json({ code: "PAYMENT_METHOD_NAME_TAKEN" });
        }
      }
      paymentMethod.name = name;
    }

    if (label !== undefined) {
      label = label.trim();
      if (!label) {
        return res.status(400).json({ code: "PAYMENT_METHOD_LABEL_REQUIRED" });
      }
      paymentMethod.label = label;
    }

    if (minDeposit !== undefined) {
      const parsedMin = Number(minDeposit);
      if (!Number.isFinite(parsedMin) || parsedMin < 0) {
        return res
          .status(400)
          .json({ code: "PAYMENT_METHOD_MIN_DEPOSIT_INVALID" });
      }
      paymentMethod.minDeposit = parsedMin;
    }

    if (maxDeposit !== undefined) {
      const parsedMax =
        maxDeposit === "" || maxDeposit === null ? null : Number(maxDeposit);
      if (
        parsedMax !== null &&
        (!Number.isFinite(parsedMax) || parsedMax <= paymentMethod.minDeposit)
      ) {
        return res
          .status(400)
          .json({ code: "PAYMENT_METHOD_MAX_DEPOSIT_INVALID" });
      }
      paymentMethod.maxDeposit = parsedMax;
    }

    if (iconPath !== undefined) {
      if (paymentMethod.iconPath && paymentMethod.iconPath !== iconPath) {
        const oldIconPath = path.join(
          process.env.UPLOAD_DIR,
          paymentMethod.iconPath,
        );
        await safeDelete(oldIconPath);
      }
      paymentMethod.iconPath = iconPath;
    }

    const normalizedActive = normalizeBoolean(active);
    if (typeof normalizedActive === "boolean") {
      paymentMethod.active = normalizedActive;
    }

    await paymentMethod.save();
    return res.status(200).json(paymentMethod);
  } catch (err) {
    if (req.iconPath) {
      const newIconPath = path.join(process.env.UPLOAD_DIR, req.iconPath);
      await safeDelete(newIconPath);
    }
    return handleError(err, res);
  }
};

export const updateOrderList = async (req, res) => {
  try {
    const paymentMethods = Array.isArray(req.body?.paymentMethods)
      ? req.body.paymentMethods
      : req.body;

    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
      return res.status(400).json({ code: "PAYMENT_METHOD_LIST_REQUIRED" });
    }

    const operations = [];
    const ids = [];
    const uniqueIds = new Set();

    for (const [index, item] of paymentMethods.entries()) {
      if (!item || typeof item !== "object") {
        return res.status(400).json({ code: "PAYMENT_METHOD_ID_INVALID" });
      }
      const id = item?.id ?? item?._id;
      if (!id || !mongoose.Types.ObjectId.isValid(id) || uniqueIds.has(id)) {
        return res.status(400).json({ code: "PAYMENT_METHOD_ID_INVALID" });
      }

      const nextOrder = Number(item.order);
      if (nextOrder !== index + 1) {
        return res.status(400).json({ code: "PAYMENT_METHOD_ORDER_INVALID" });
      }

      uniqueIds.add(id);
      ids.push(id);
      operations.push({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order: nextOrder } },
        },
      });
    }

    const total = await PaymentMethod.countDocuments();
    const matching = await PaymentMethod.countDocuments({
      _id: { $in: ids },
    });
    if (ids.length !== total || matching !== ids.length) {
      return res.status(400).json({ code: "PAYMENT_METHOD_LIST_INVALID" });
    }

    await PaymentMethod.bulkWrite(operations);
    const updated = await PaymentMethod.find({ _id: { $in: ids } }).sort({
      order: 1,
      createdAt: -1,
      _id: 1,
    });

    return res.status(200).json(updated);
  } catch (err) {
    return handleError(err, res);
  }
};

export const deleteOne = async (req, res) => {
  try {
    const { id } = req.query;
    const paymentMethod = await PaymentMethod.findById(id);
    if (!paymentMethod) {
      return res.status(404).json({ code: "PAYMENT_METHOD_NOT_FOUND" });
    }

    if (paymentMethod.iconPath) {
      const iconPath = path.join(
        process.env.UPLOAD_DIR,
        paymentMethod.iconPath,
      );
      await safeDelete(iconPath);
    }

    await paymentMethod.deleteOne();
    return res.status(200).json({ code: "PAYMENT_METHOD_DELETED" });
  } catch (err) {
    return handleError(err, res);
  }
};
