import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import logger from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ─── CORS ───────────────────────────────────────────────────────────────────────
// Supports env-driven CORS_ORIGIN for deployment flexibility, with safe defaults.
const corsOriginEnv = process.env.CORS_ORIGIN || "";
const hardcodedOrigins = [
  "http://localhost:5173",
  "https://ai-timetable-generator-ten.vercel.app",
];
const allowedOrigins = corsOriginEnv.length > 0
  ? [...new Set([...corsOriginEnv.split(",").map((o) => o.trim()), ...hardcodedOrigins])]
  : hardcodedOrigins;

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server and same-origin requests (no Origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow localhost variants in development
    if (NODE_ENV === "development" && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    logger.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight uses same restricted config

// ─── Security Headers ────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: NODE_ENV === "production",
    crossOriginEmbedderPolicy: false,
  })
);

// ─── Rate Limiting ──────────────────────────────────────────────────────────────
// Auth limiter: tight by default (20 req/15 min). Override via env for CI/test.
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

// General limiter: 200 req/min in production. Override RATE_LIMIT_GENERAL_MAX for E2E.
// Never set to 0 or disabled — always enforce a ceiling.
const generalLimiterMax = Math.max(
  1,
  parseInt(process.env.RATE_LIMIT_GENERAL_MAX || "200", 10)
);
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: generalLimiterMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
  keyGenerator: (req) => req.ip,
});

app.use(generalLimiter);

// ─── Body Parsing ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Request Logging ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ─── Health & Root ──────────────────────────────────────────────────────────────
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
      name: "SmartScheduler API",
      version: "1.0.0",
      health: "/api/health",
    },
  });
});

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api", resourceRoutes); // teachers, subjects, classes, allocations
app.use("/api/settings", settingsRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/ai", aiRoutes);

// ─── Error Handling ────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Process Safety ────────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(
    `Unhandled Rejection: ${reason instanceof Error ? reason.message : String(reason)}`
  );
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Server listening on http://localhost:${PORT}`);
  logger.info(`Environment: ${NODE_ENV}`);
  logger.info(`CORS origins: ${allowedOrigins.join(", ")}`);
});

export default app;