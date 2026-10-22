import fs from "fs";
import multer from "multer";
import path from "path";
import { config } from "dotenv";

import { handleError } from "../utils/errorHandler.js";

config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "C:\\Users\\Iyad\\bayocard\\";
const paymentIconsPath = path.join(UPLOAD_DIR, "storage", "payment_icons");

// Unlike the flat storage/ root used by upload.middleware.js, this subfolder
// isn't guaranteed to already exist on disk.
fs.mkdirSync(paymentIconsPath, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, paymentIconsPath);
  },
  filename: function (req, file, cb) {
    const ext = (path.extname(file.originalname) || "")
      .slice(0, 10)
      .toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

export const uploadPaymentIcon = multer({ storage });

export const attachIconPath = async (req, res, next) => {
  try {
    if (req.file) {
      req.iconPath = `/storage/payment_icons/${req.file.filename}`;
    } else if (req.files?.icon?.[0]) {
      req.iconPath = `/storage/payment_icons/${req.files.icon[0].filename}`;
    }
    next();
  } catch (err) {
    return handleError(err, res);
  }
};
