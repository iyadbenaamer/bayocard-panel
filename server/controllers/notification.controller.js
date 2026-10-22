import path from "path";

import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import AnonymousDeviceToken from "../models/anonymousDeviceToken.model.js";

import { safeDelete } from "../middleware/media.middleware.js";
import { handleError } from "../utils/errorHandler.js";
import { sendPushNotifications } from "../utils/pushNotifications.js";
import parsePagination from "../utils/parsePagination.js";

const AUDIENCES = [
  "all",
  "authorized",
  "individual",
  "business",
  "unauthorized",
];

// Expo's push service fetches the image itself to attach it to the OS
// notification, so it needs an absolute, publicly reachable URL - the
// relative "/storage/xxx" path stored on the notification isn't enough, and
// UPLOAD_DIR can't supply one either (it's a filesystem path, e.g.
// "C:\Users\...\bayocard", not a URL - it has no protocol/host to give). This
// server already serves that same path publicly at /storage on its own
// origin (see index.js), so build the URL from the incoming admin request's
// own origin instead - no separate config needed.
const toAbsoluteImageUrl = (req, image) =>
  image ? `${req.protocol}://${req.get("host")}${image}` : undefined;

// "authorized" = any logged-in user (both roles); "all" is the same plus
// devices that never logged in. "unauthorized" only reaches those never-
// logged-in devices via AnonymousDeviceToken, since there's no User doc to
// read a pushToken from for them.
const ROLE_AUDIENCES = ["individual", "business"];

// Best-effort: push delivery failures should never affect the create
// response, mirroring notifyBusinessUsersOfDollarRateChange in
// setting.controller.js.
const notifyUsers = async (req, notification) => {
  try {
    const tokens = [];

    if (notification.audience !== "unauthorized") {
      const filter = { pushTokens: { $exists: true, $not: { $size: 0 } } };
      if (ROLE_AUDIENCES.includes(notification.audience)) {
        filter.role = notification.audience;
      }
      const users = await User.find(filter).select("pushTokens");
      tokens.push(...users.flatMap((user) => user.pushTokens));
    }

    if (
      notification.audience === "all" ||
      notification.audience === "unauthorized"
    ) {
      const anonymousDevices =
        await AnonymousDeviceToken.find().select("token");
      tokens.push(...anonymousDevices.map((device) => device.token));
    }

    if (tokens.length === 0) return;

    await sendPushNotifications(tokens, {
      title: notification.title,
      body: notification.text,
      image: toAbsoluteImageUrl(req, notification.image),
      data: {
        type: "notification",
        notificationId: notification._id,
        link: notification.link,
      },
    });
  } catch (err) {
    console.error("Failed to notify users of new notification:", err);
  }
};

export const getPaginated = async (req, res) => {
  try {
    const isPaginated =
      req.query.page !== undefined && req.query.limit !== undefined;
    const { page, limit } = parsePagination(req.query.page, req.query.limit);

    let notificationsQuery = Notification.find().sort({ createdAt: -1 });
    if (isPaginated) {
      notificationsQuery = notificationsQuery
        .skip((page - 1) * limit)
        .limit(limit);
    }
    const notifications = await notificationsQuery;
    const total = await Notification.countDocuments();

    return res.status(200).json({ notifications, total });
  } catch (err) {
    return handleError(err, res);
  }
};

export const createOne = async (req, res) => {
  try {
    let { title, text, link, audience } = req.body;
    const image = req.filePath ?? "";

    title = title?.trim() || "Bayo Card";
    text = text?.trim();
    link = link?.trim() ?? "";
    audience = audience?.trim() || "all";

    if (!text) {
      return res.status(400).json({ code: "NOTIFICATION_TEXT_REQUIRED" });
    }
    if (!AUDIENCES.includes(audience)) {
      return res.status(400).json({ code: "NOTIFICATION_INVALID_AUDIENCE" });
    }

    const notification = new Notification({
      title,
      text,
      image,
      link,
      audience,
    });
    await notification.save();

    notifyUsers(req, notification);

    return res.status(201).json(notification);
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
    let { title, text, link, audience } = req.body;
    const image = req.filePath ?? req.body.image;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ code: "NOTIFICATION_NOT_FOUND" });
    }

    if (title !== undefined) {
      notification.title = title?.trim() || "Bayo Card";
    }

    if (text !== undefined) {
      text = text?.trim();
      if (!text) {
        return res.status(400).json({ code: "NOTIFICATION_TEXT_REQUIRED" });
      }
      notification.text = text;
    }

    if (link !== undefined) {
      notification.link = link?.trim() ?? "";
    }

    if (audience !== undefined) {
      audience = audience?.trim() || "all";
      if (!AUDIENCES.includes(audience)) {
        return res.status(400).json({ code: "NOTIFICATION_INVALID_AUDIENCE" });
      }
      notification.audience = audience;
    }

    if (image !== undefined && image !== notification.image) {
      // If updating the image, delete the old one if it exists and a new
      // file was uploaded (not just re-sending the current path back).
      if (notification.image && req.filePath) {
        const oldImagePath = path.join(
          process.env.UPLOAD_DIR,
          notification.image,
        );
        await safeDelete(oldImagePath);
      }
      notification.image = image;
    }

    await notification.save();
    return res.status(200).json(notification);
  } catch (err) {
    if (req.filePath) {
      const newImagePath = path.join(process.env.UPLOAD_DIR, req.filePath);
      await safeDelete(newImagePath);
    }
    return handleError(err, res);
  }
};

// Reuses an already-saved notification to send it again to whichever users
// currently match its audience, without creating a duplicate record - lets
// the admin resend a recurring promo/announcement on demand.
export const resendOne = async (req, res) => {
  try {
    const { id } = req.query;
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ code: "NOTIFICATION_NOT_FOUND" });
    }

    await notifyUsers(req, notification);

    return res.status(200).json({ code: "NOTIFICATION_RESENT" });
  } catch (err) {
    return handleError(err, res);
  }
};

export const deleteOne = async (req, res) => {
  try {
    const { id } = req.query;
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ code: "NOTIFICATION_NOT_FOUND" });
    }

    if (notification.image) {
      const imagePath = path.join(process.env.UPLOAD_DIR, notification.image);
      await safeDelete(imagePath);
    }

    await notification.deleteOne();
    return res.status(200).json({ code: "NOTIFICATION_DELETED" });
  } catch (err) {
    return handleError(err, res);
  }
};
