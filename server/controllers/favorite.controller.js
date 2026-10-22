import mongoose from "mongoose";

import Favorite from "../models/favorite.model.js";

import { handleError } from "../utils/errorHandler.js";

const buildFavoritePipeline = (match) => [
  { $match: match },
  {
    $lookup: {
      from: "card_types",
      localField: "cardTypeId",
      foreignField: "_id",
      as: "cardType",
    },
  },
  { $unwind: { path: "$cardType", preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: "card_categories",
      localField: "cardType.categoryId",
      foreignField: "_id",
      as: "category",
    },
  },
  { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 1,
      userId: 1,
      cardTypeId: 1,
      createdAt: 1,
      cardTypeName: "$cardType.name",
      cardTypeImage: "$cardType.image",
      categoryName: "$category.name",
    },
  },
];

export const getUserFavorites = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ code: "FAVORITE_USER_ID_INVALID" });
    }

    const favorites = await Favorite.aggregate([
      ...buildFavoritePipeline({
        userId: new mongoose.Types.ObjectId(userId),
      }),
      { $sort: { createdAt: -1, _id: -1 } },
    ]);

    return res.status(200).json(favorites);
  } catch (err) {
    return handleError(err, res);
  }
};
