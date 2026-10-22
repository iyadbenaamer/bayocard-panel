import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import cron from "node-cron";

import authRoute from "./routes/auth.route.js";
import userRoute from "./routes/user.route.js";
import searchRoute from "./routes/search.route.js";
import adminRoute from "./routes/admin.route.js";
import cardCategoryRoute from "./routes/cardCategory.route.js";
import cardTypeRoute from "./routes/cardType.route.js";
import cardTierRoute from "./routes/cardTier.route.js";
import cardRoute from "./routes/card.route.js";
import orderRoute from "./routes/order.route.js";
import transactionRoute from "./routes/transaction.route.js";
import requestLogRoute from "./routes/requestLog.route.js";
import settingRoute from "./routes/setting.route.js";
import appVersionRoute from "./routes/appVersion.route.js";
import dealRoute from "./routes/deal.route.js";
import paymentMethodRoute from "./routes/paymentMethod.route.js";
import discountRoute from "./routes/discount.route.js";
import notificationRoute from "./routes/notification.route.js";
import connectDB from "./config/db.js";
import { runAutoDeleteJob } from "./utils/autoDelete.js";

import { verifyToken } from "./middleware/auth.middleware.js";

dotenv.config();

/*CONFIGURATIONS*/
const UPLOAD_DIR = process.env.UPLOAD_DIR || "C:\\Users\\Iyad\\bayocard\\";
const storagePath = path.join(UPLOAD_DIR, "storage");

const app = express();
// Behind a reverse proxy, req.protocol reports "http" unless this is set,
// even when the real public request was https - which would send Expo a
// scheme it can't actually reach when building notification image URLs
// (see toAbsoluteImageUrl in notification.controller.js).
app.set("trust proxy", 1);
const cookieSecret = process.env.COOKIE_SECRET || process.env.JWT_SECRET;
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;
const corsOptions = {
  origin: corsOrigins,
  credentials: true,
};
app.use(express.json({ limit: "200mb" }));
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("short"));
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(cors(corsOptions));
app.use("/storage", express.static(storagePath));
app.use(cookieParser(cookieSecret));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: "Too many requests from this IP, please try again after a minute",
  }),
);

/*ROUTES*/
app.use("/api/", authRoute);

app.use(verifyToken);
app.use("/api/user", userRoute);
app.use("/api/search", searchRoute);
app.use("/api/admin", adminRoute);
app.use("/api/card-categories", cardCategoryRoute);
app.use("/api/card-types", cardTypeRoute);
app.use("/api/card-tiers", cardTierRoute);
app.use("/api/cards", cardRoute);
app.use("/api/orders", orderRoute);
app.use("/api/transactions", transactionRoute);
app.use("/api/request-logs", requestLogRoute);
app.use("/api/settings", settingRoute);
app.use("/api/app-version", appVersionRoute);
app.use("/api/deals", dealRoute);
app.use("/api/payment-methods", paymentMethodRoute);
app.use("/api/discounts", discountRoute);
app.use("/api/notifications", notificationRoute);

/*MONGOOSE SETUP*/
connectDB();

// Purges sold-out cards/orders/transactions past the admin-configured
// retention window (see the "مدة الحذف التلقائي بالأيام" setting). Runs
// daily at 00:00 server time; a no-op when the setting is unset or 0.
cron.schedule("0 0 * * *", () => {
  runAutoDeleteJob();
});

const PORT = process.env.PORT;
const server = createServer(app);

const startServer = async () => {
  try {
    server.listen(PORT, () => console.log(`Server Connected on Port: ${PORT}`));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
