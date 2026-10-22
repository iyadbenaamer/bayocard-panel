import AppVersion from "../models/appVersion.model.js";
import { handleError } from "../utils/errorHandler.js";
import { compareVersions, isValidVersionString } from "../utils/versionCompare.js";

const PLATFORMS = ["android", "ios"];

// There is only ever one AppVersion document - create it with schema
// defaults the first time it's requested rather than requiring a seed step.
const getSingleton = async () => {
  let doc = await AppVersion.findOne();
  if (!doc) {
    doc = await AppVersion.create({});
  }
  return doc;
};

export const getAppVersion = async (req, res) => {
  try {
    const doc = await getSingleton();
    return res.status(200).json(doc);
  } catch (err) {
    return handleError(err, res);
  }
};

export const updateAppVersion = async (req, res) => {
  try {
    const update = {};
    for (const platform of PLATFORMS) {
      const platformInput = req.body?.[platform];
      if (!platformInput) continue;

      const { minVersion, latestVersion, storeUrl } = platformInput;
      if (minVersion !== undefined) {
        if (!isValidVersionString(minVersion)) {
          return res.status(400).json({ code: "APP_VERSION_MIN_VERSION_INVALID" });
        }
        update[`${platform}.minVersion`] = minVersion.trim();
      }
      if (latestVersion !== undefined) {
        if (!isValidVersionString(latestVersion)) {
          return res.status(400).json({ code: "APP_VERSION_LATEST_VERSION_INVALID" });
        }
        update[`${platform}.latestVersion`] = latestVersion.trim();
      }
      if (storeUrl !== undefined) {
        update[`${platform}.storeUrl`] = storeUrl?.toString().trim() || "";
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ code: "APP_VERSION_NO_UPDATE_FIELDS" });
    }

    const existing = await getSingleton();
    for (const platform of PLATFORMS) {
      const min = update[`${platform}.minVersion`] ?? existing[platform].minVersion;
      const latest = update[`${platform}.latestVersion`] ?? existing[platform].latestVersion;
      if (compareVersions(min, latest) > 0) {
        return res.status(400).json({ code: "APP_VERSION_MIN_EXCEEDS_LATEST" });
      }
    }

    const updated = await AppVersion.findByIdAndUpdate(
      existing._id,
      { $set: update },
      { new: true },
    );
    return res.status(200).json(updated);
  } catch (err) {
    return handleError(err, res);
  }
};
