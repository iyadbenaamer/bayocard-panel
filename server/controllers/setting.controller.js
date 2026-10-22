import { Types } from "mongoose";

import Setting from "../models/setting.model.js";
import User from "../models/user.model.js";
import { handleError } from "../utils/errorHandler.js";
import { sendPushNotifications } from "../utils/pushNotifications.js";

const DOLLAR_RATE_KEYS = ["سعر الدولار", "dollarRate"];
const isDollarRateKey = (key) =>
  DOLLAR_RATE_KEYS.includes((key ?? "").toString().trim());
const isNumericDollarRate = (value) => {
  if (value === undefined || value === null) return false;
  const strValue = value.toString().trim();
  if (!strValue) return false;
  return !Number.isNaN(Number(strValue));
};

// Key holding the number of days after a sale (card/order/transaction) after
// which the auto-delete cron job (see utils/autoDelete.js) purges the record.
export const AUTO_DELETE_DURATION_KEYS = [
  "مدة الحذف التلقائي بالأيام",
  "autoDeleteDurationDays",
];
const isAutoDeleteDurationKey = (key) =>
  AUTO_DELETE_DURATION_KEYS.includes((key ?? "").toString().trim());
const isValidAutoDeleteDuration = (value) => {
  if (value === undefined || value === null) return false;
  const strValue = value.toString().trim();
  if (!strValue) return false;
  const num = Number(strValue);
  return !Number.isNaN(num) && num >= 0;
};

// Key holding the percentage fee charged to the sender on a balance
// exchange between two users (see bayocard/server/controllers/exchange.controller.js).
// 0 means no fee.
const EXCHANGE_FEE_SETTING_KEY = "نسبة رسوم تحويل الرصيد";
const isExchangeFeeKey = (key) =>
  (key ?? "").toString().trim() === EXCHANGE_FEE_SETTING_KEY;
const isValidExchangeFee = (value) => {
  if (value === undefined || value === null) return false;
  const strValue = value.toString().trim();
  if (!strValue) return false;
  const num = Number(strValue);
  return !Number.isNaN(num) && num >= 0 && num <= 100;
};

const PROTECTED_SETTING_KEYS = [
  "support",
  ...DOLLAR_RATE_KEYS,
  ...AUTO_DELETE_DURATION_KEYS,
  EXCHANGE_FEE_SETTING_KEY,
];

const NUMERIC_KEY_VALIDATORS = [
  {
    test: isDollarRateKey,
    isValid: isNumericDollarRate,
    code: "SETTING_DOLLAR_RATE_VALUE_INVALID",
    message: "Dollar rate value must be numeric",
  },
  {
    test: isAutoDeleteDurationKey,
    isValid: isValidAutoDeleteDuration,
    code: "SETTING_AUTO_DELETE_DURATION_VALUE_INVALID",
    message: "Auto-delete duration must be a non-negative number",
  },
  {
    test: isExchangeFeeKey,
    isValid: isValidExchangeFee,
    code: "SETTING_EXCHANGE_FEE_VALUE_INVALID",
    message: "Exchange fee must be a number between 0 and 100",
  },
];

// Returns an error payload if `key` is a validated protected setting whose
// `value` fails its validator, otherwise null.
const validateNumericSetting = (key, value) => {
  for (const { test, isValid, code, message } of NUMERIC_KEY_VALIDATORS) {
    if (test(key) && !isValid(value)) return { code, message };
  }
  return null;
};

// Notifies every business user with a registered device of a dollar rate
// change. Not awaited by callers: delivery failures should never affect the
// setting update response.
const notifyBusinessUsersOfDollarRateChange = async (newValue) => {
  try {
    const businessUsers = await User.find({
      role: "business",
      pushTokens: { $exists: true, $not: { $size: 0 } },
    }).select("pushTokens");

    const tokens = businessUsers.flatMap((user) => user.pushTokens);
    if (tokens.length === 0) return;

    await sendPushNotifications(tokens, {
      title: "Bayo Card",
      body: `تم تحديث سعر الدولار`,
      data: { type: "dollarRateChanged", value: newValue },
    });
  } catch (err) {
    console.error(
      "Failed to notify business users of dollar rate change:",
      err,
    );
  }
};

export const getAll = async (req, res) => {
  try {
    const settings = await Setting.find().sort({ key: 1 });
    return res.status(200).json(settings);
  } catch (err) {
    return handleError(err, res);
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ code: "SETTING_ID_INVALID" });
    }
    const setting = await Setting.findById(id);
    if (!setting) return res.status(404).json({ code: "SETTING_NOT_FOUND" });
    return res.status(200).json(setting);
  } catch (err) {
    return handleError(err, res);
  }
};

export const createOne = async (req, res) => {
  try {
    const { key, value, description, group } = req.body;
    if (!key) return res.status(400).json({ code: "SETTING_KEY_REQUIRED" });

    const trimmedKey = key?.toString().trim();
    if (!trimmedKey)
      return res.status(400).json({ code: "SETTING_KEY_REQUIRED" });

    const numericError = validateNumericSetting(trimmedKey, value);
    if (numericError) return res.status(400).json(numericError);

    // Prevent creating protected settings
    if (PROTECTED_SETTING_KEYS.includes(trimmedKey)) {
      return res.status(403).json({
        code: "SETTING_CANNOT_CREATE",
        message: "Cannot create protected setting",
      });
    }

    const exists = await Setting.findOne({ key: trimmedKey });
    if (exists) return res.status(409).json({ code: "SETTING_KEY_EXISTS" });

    const setting = new Setting({ key: trimmedKey, value, description, group });
    await setting.save();
    return res.status(201).json(setting);
  } catch (err) {
    return handleError(err, res);
  }
};

export const updateOne = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ code: "SETTING_ID_INVALID" });
    }

    // load existing so we can protect support key
    const existingSetting = await Setting.findById(id);
    if (!existingSetting)
      return res.status(404).json({ code: "SETTING_NOT_FOUND" });

    const update = {};
    const { key, value, description, group } = req.body;
    if (key !== undefined) update.key = key?.toString().trim();
    if (value !== undefined) update.value = value;
    if (description !== undefined) update.description = description;
    if (group !== undefined) update.group = group;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ code: "SETTING_NO_UPDATE_FIELDS" });
    }

    const targetKey = update.key ?? existingSetting.key;
    if (update.value !== undefined) {
      const numericError = validateNumericSetting(targetKey, update.value);
      if (numericError) return res.status(400).json(numericError);
    }

    // do not allow renaming the protected keys (support, dollarRate, auto-delete duration)
    if (
      PROTECTED_SETTING_KEYS.includes(existingSetting.key) &&
      update.key &&
      !PROTECTED_SETTING_KEYS.includes(update.key)
    ) {
      return res.status(403).json({
        code: "SETTING_CANNOT_RENAME",
        message: "Cannot rename protected setting",
      });
    }

    // If key is being updated, ensure uniqueness
    if (update.key) {
      const exists = await Setting.findOne({
        key: update.key,
        _id: { $ne: id },
      });
      if (exists) return res.status(409).json({ code: "SETTING_KEY_EXISTS" });
    }

    const updated = await Setting.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    );

    if (
      isDollarRateKey(targetKey) &&
      update.value !== undefined &&
      update.value !== existingSetting.value
    ) {
      notifyBusinessUsersOfDollarRateChange(updated.value);
    }

    return res.status(200).json(updated);
  } catch (err) {
    return handleError(err, res);
  }
};

export const updateMany = async (req, res) => {
  try {
    const updates = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ code: "SETTING_NO_UPDATES" });
    }

    const results = [];
    for (const u of updates) {
      const { id, key, value, description, group } = u;
      if (id && !Types.ObjectId.isValid(id)) {
        continue; // skip invalid id entries
      }

      if (id) {
        // protect support and dollarRate keys from being renamed via bulk edit
        const existing = await Setting.findById(id);
        const update = {};
        if (key !== undefined) update.key = key?.toString().trim();
        if (value !== undefined) update.value = value;
        if (description !== undefined) update.description = description;
        if (group !== undefined) update.group = group;
        if (Object.keys(update).length === 0) continue;

        if (
          existing &&
          PROTECTED_SETTING_KEYS.includes(existing.key) &&
          update.key &&
          !PROTECTED_SETTING_KEYS.includes(update.key)
        ) {
          // skip attempts to rename protected settings
          delete update.key;
        }

        const targetKey = update.key ?? existing?.key;
        if (update.value !== undefined) {
          const numericError = validateNumericSetting(targetKey, update.value);
          if (numericError) return res.status(400).json(numericError);
        }

        if (update.key) {
          const exists = await Setting.findOne({
            key: update.key,
            _id: { $ne: id },
          });
          if (exists) {
            return res.status(409).json({
              code: "SETTING_KEY_EXISTS",
              message: `Key ${update.key} already exists`,
            });
          }
        }

        const updated = await Setting.findByIdAndUpdate(
          id,
          { $set: update },
          { new: true },
        );
        if (updated) {
          results.push(updated);
          if (
            isDollarRateKey(targetKey) &&
            update.value !== undefined &&
            update.value !== existing?.value
          ) {
            notifyBusinessUsersOfDollarRateChange(updated.value);
          }
        }
      } else {
        const trimmedKey = key?.toString().trim();
        if (!trimmedKey) continue;
        const numericError = validateNumericSetting(trimmedKey, value);
        if (numericError) return res.status(400).json(numericError);
        const exists = await Setting.findOne({ key: trimmedKey });
        if (exists) continue;
        const newSetting = new Setting({
          key: trimmedKey,
          value,
          description,
          group,
        });
        await newSetting.save();
        results.push(newSetting);
      }
    }

    return res.status(200).json(results);
  } catch (err) {
    return handleError(err, res);
  }
};

export const deleteOne = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ code: "SETTING_ID_INVALID" });
    }
    const setting = await Setting.findById(id);
    if (!setting) return res.status(404).json({ code: "SETTING_NOT_FOUND" });
    if (PROTECTED_SETTING_KEYS.includes(setting.key)) {
      return res.status(403).json({
        code: "SETTING_CANNOT_DELETE",
        message: "Cannot delete protected setting",
      });
    }
    const deleted = await Setting.findByIdAndDelete(id);
    return res.status(200).json({ message: "SETTING_DELETED" });
  } catch (err) {
    return handleError(err, res);
  }
};
