import Card from "../models/card.model.js";
import CardType from "../models/cardType.model.js";
import Transaction from "../models/transaction.model.js";
import User from "../models/user.model.js";
import Stats, { SOLD_CARDS_COUNT_KEY } from "../models/stats.model.js";
import CardSaleStat from "../models/cardSaleStat.model.js";

import { handleError } from "../utils/errorHandler.js";

const TOP_SOLD_CARDS_LIMIT = 10;

export const getStats = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const [
      totalUsers,
      newUsersLast7Days,
      totalCards,
      availableCards,
      soldCardsCounter,
      totalCardTypes,
      activeCardTypes,
      purchasesLast7Days,
      refundsLast7Days,
      topSoldCardStats,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Card.countDocuments(),
      Card.countDocuments({ soldTo: null }),
      Stats.findOne({ key: SOLD_CARDS_COUNT_KEY }).select("value"),
      CardType.countDocuments(),
      CardType.countDocuments({ isActive: true }),
      Transaction.countDocuments({
        type: "purchase",
        createdAt: { $gte: sevenDaysAgo },
      }),
      Transaction.countDocuments({
        type: "refund",
        createdAt: { $gte: sevenDaysAgo },
      }),
      // These counters (unlike Card.countDocuments above) are never eroded
      // by the auto-delete purge of sold cards, since they are incremented
      // once at the moment of sale rather than derived from live Card rows.
      CardSaleStat.find()
        .sort({ soldCount: -1 })
        .limit(TOP_SOLD_CARDS_LIMIT)
        .populate({ path: "typeId", select: "name" }),
    ]);

    const soldCards = soldCardsCounter?.value || 0;

    const topSoldCards = topSoldCardStats
      .filter((stat) => stat.typeId)
      .map((stat) => ({
        typeId: stat.typeId._id,
        typeName: stat.typeId.name,
        soldCount: stat.soldCount,
      }));

    const topSoldType = topSoldCards[0]
      ? {
          typeId: topSoldCards[0].typeId,
          name: topSoldCards[0].typeName,
          soldCount: topSoldCards[0].soldCount,
        }
      : null;

    const [purchaseTotals, refundTotals] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: "purchase" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { type: "refund" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const totalRevenue = purchaseTotals?.[0]?.total || 0;
    const totalRefunds = refundTotals?.[0]?.total || 0;
    const netRevenue = totalRevenue - totalRefunds;

    return res.status(200).json({
      serverTime: now.toISOString(),
      stats: {
        totalUsers,
        newUsersLast7Days,
        totalCards,
        availableCards,
        soldCards,
        totalCardTypes,
        activeCardTypes,
        topSoldType,
        topSoldCards,
        totalRevenue,
        totalRefunds,
        netRevenue,
        purchasesLast7Days,
        refundsLast7Days,
      },
    });
  } catch (err) {
    return handleError(err, res);
  }
};
