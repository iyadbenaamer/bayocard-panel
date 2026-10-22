// One-time cleanup for card_sale_stats documents left over from before
// CardSaleStat was keyed by CardType instead of CardTier (see
// cardSaleStat.model.js). Before that change, one document existed per
// CardTier, so a CardType with more than one tier ended up with multiple
// documents sharing the same typeId - which breaks the collection's unique
// index and causes "duplicate key" React warnings/crashes anywhere a typeId
// list is rendered (e.g. the top-sold carousels). This merges those
// duplicates into a single document per typeId, summing their soldCount so
// no history is lost, then rebuilds the indexes.
//
// Safe to re-run: once there are no duplicates left, it's a no-op.
//
// Usage: node utils/dedupeCardSaleStats.js
import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import CardSaleStat from "../models/cardSaleStat.model.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const duplicateGroups = await CardSaleStat.aggregate([
    {
      $group: {
        _id: "$typeId",
        count: { $sum: 1 },
        totalSoldCount: { $sum: "$soldCount" },
        ids: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  for (const group of duplicateGroups) {
    const [keepId, ...removeIds] = group.ids;
    await CardSaleStat.updateOne(
      { _id: keepId },
      { $set: { soldCount: group.totalSoldCount }, $unset: { tierId: "" } },
    );
    await CardSaleStat.deleteMany({ _id: { $in: removeIds } });
  }

  await CardSaleStat.syncIndexes();

  console.log(
    `[dedupeCardSaleStats] merged ${duplicateGroups.length} duplicate typeId group(s)`,
  );

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("[dedupeCardSaleStats] failed:", err);
  process.exit(1);
});
