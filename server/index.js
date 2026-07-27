import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import logger from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const corsOrigins = corsOrigin.split(",").map((o) => o.trim());

app.use(
  helmet({
    contentSecurityPolicy: NODE_ENV === "production",
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin) || corsOrigins.includes("*")) {
        return callback(null, true);
      }
      if (NODE_ENV === "development") {
        return callback(null, true);
      }
      logger.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || "20", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
  keyGenerator: (req) => req.ip,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
  keyGenerator: (req) => req.ip,
});

app.use(generalLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      version: "1.0.0",
    },
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: "Ragavi Scheduler AI API",
      version: "1.0.0",
      health: "/api/health",
      docs: {
        auth: "/api/auth/*",
        resources: "/api/teachers, /api/subjects, /api/classes, /api/allocations",
        settings: "/api/settings",
        timetables: "/api/timetables",
        ai: "/api/ai/*",
      },
    },
  });
});

app.use("/api/auth", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api", resourceRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});

app.listen(PORT, () => {
  logger.info(`Server listening on http://localhost:${PORT}`);
  logger.info(`Environment: ${NODE_ENV}`);
  logger.info(`CORS origins: ${corsOrigins.join(", ")}`);
});

export default app;
