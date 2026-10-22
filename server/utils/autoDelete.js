import Card from "../models/card.model.js";
import Order from "../models/order.model.js";
import Transaction from "../models/transaction.model.js";
import RequestLog from "../models/requestLog.model.js";
import Setting from "../models/setting.model.js";
import { AUTO_DELETE_DURATION_KEYS } from "../controllers/setting.controller.js";

// Purges sold cards, orders, transactions and request logs once they are
// older than the admin-configured "auto-delete duration" setting (in days).
// Reads the duration on every run so admins can change it without
// restarting the server; a missing/zero/invalid value disables the job
// entirely.
export const runAutoDeleteJob = async () => {
  try {
    const setting = await Setting.findOne({
      key: { $in: AUTO_DELETE_DURATION_KEYS },
    });
    const durationDays = Number(setting?.value);
    if (!setting || !Number.isFinite(durationDays) || durationDays <= 0) {
      return;
    }

    const cutoff = new Date(Date.now() - durationDays * 24 * 60 * 60 * 1000);

    const [cardsResult, ordersResult, transactionsResult, requestLogsResult] =
      await Promise.all([
        Card.deleteMany({ soldTo: { $ne: null }, soldAt: { $lte: cutoff } }),
        Order.deleteMany({ createdAt: { $lte: cutoff } }),
        Transaction.deleteMany({ createdAt: { $lte: cutoff } }),
        RequestLog.deleteMany({ createdAt: { $lte: cutoff } }),
      ]);

    console.log(
      `[autoDelete] duration=${durationDays}d cutoff=${cutoff.toISOString()} ` +
        `cards=${cardsResult.deletedCount} orders=${ordersResult.deletedCount} ` +
        `transactions=${transactionsResult.deletedCount} ` +
        `requestLogs=${requestLogsResult.deletedCount}`,
    );
  } catch (err) {
    console.error("[autoDelete] Failed to run auto-delete job:", err);
  }
};
