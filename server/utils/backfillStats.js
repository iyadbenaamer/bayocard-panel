// One-time backfill for the persistent stats counters (see stats.model.js /
// cardSaleStat.model.js). Run this once, right after deploying the
// stats-tracking feature, to seed the counters from cards that are already
// sold and still in the database. It cannot recover counts for sold cards
// that were purged by the auto-delete job before this feature existed -
// that history is gone.
//
// Safe to re-run: it overwrites each counter with a fresh count of
// currently-sold cards rather than incrementing, so running it twice does
// not double-count. Do NOT run it after the app has been live with this
// feature for a while, though - a re-run would overwrite (and lose) any
// increments recorded for cards sold and then purged since the first run.
//
// Usage: node utils/backfillStats.js
import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Card from "../models/card.model.js";
import CardTier from "../models/cardTier.model.js";
import Stats, { SOLD_CARDS_COUNT_KEY } from "../models/stats.model.js";
import CardSaleStat from "../models/cardSaleStat.model.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const perTierCounts = await Card.aggregate([
    { $match: { soldTo: { $ne: null }, tierId: { $ne: null } } },
    { $group: { _id: "$tierId", soldCount: { $sum: 1 } } },
  ]);

  const tiers = await CardTier.find({
    _id: { $in: perTierCounts.map((row) => row._id) },
  }).select("typeId");
  const typeIdByTier = new Map(
    tiers.map((tier) => [String(tier._id), tier.typeId]),
  );

  // Roll tier-level counts up to their card type, since the leaderboard is
  // ranked by CardType (e.g. "Steam"), not by individual denomination.
  const soldCountByType = new Map();
  let totalSoldCards = 0;
  for (const row of perTierCounts) {
    const typeId = typeIdByTier.get(String(row._id));
    if (!typeId) continue;

    totalSoldCards += row.soldCount;
    const key = String(typeId);
    soldCountByType.set(key, {
      typeId,
      soldCount: (soldCountByType.get(key)?.soldCount || 0) + row.soldCount,
    });
  }

  for (const { typeId, soldCount } of soldCountByType.values()) {
    await CardSaleStat.findOneAndUpdate(
      { typeId },
      { $set: { soldCount } },
      { upsert: true },
    );
  }

  await Stats.findOneAndUpdate(
    { key: SOLD_CARDS_COUNT_KEY },
    { $set: { value: totalSoldCards } },
    { upsert: true },
  );

  console.log(
    `[backfillStats] seeded ${soldCountByType.size} card-type counter(s), ` +
      `totalSoldCards=${totalSoldCards}`,
  );

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("[backfillStats] failed:", err);
  process.exit(1);
});
