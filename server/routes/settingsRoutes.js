import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { settingsValidation } from "../middleware/validator.js";
import db, { ensureDefaultSettings } from "../db.js";
import logger from "../utils/logger.js";
import { getEffectiveTimelineEvents } from "../services/timeSlots.js";

function normalizeTimelineEvents(value) {
  if (!value) return [];
  let parsed = [];
  if (Array.isArray(value)) {
    parsed = value;
  } else if (typeof value === "string") {
    try {
      const p = JSON.parse(value);
      if (Array.isArray(p)) parsed = p;
    } catch {
      parsed = [];
    }
  }

  return parsed
    .filter(Boolean)
    .map((evt, idx) => ({
      id: evt.id || `evt-${idx + 1}-${Date.now()}`,
      title: evt.title || evt.name || "Event",
      type: evt.type || "custom",
      startTime: evt.startTime || "09:00",
      endTime: evt.endTime || "09:30",
      color: evt.color || "#6366f1",
      icon: evt.icon || "Clock",
      isRecurring: evt.isRecurring !== false,
      days: Array.isArray(evt.days) ? evt.days : [],
      isTeachingBlocked: evt.isTeachingBlocked !== false,
    }));
}

const router = Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    await ensureDefaultSettings(userId);
    const settings = await db.get(
      "SELECT * FROM school_settings WHERE userId = ?",
      userId
    );
    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }

    const effectiveEvents = getEffectiveTimelineEvents({
      ...settings,
      timelineEvents: normalizeTimelineEvents(settings.timelineEvents),
    });

    return res.json({
      success: true,
      data: {
        ...settings,
        timelineEvents: effectiveEvents,
      },
    });
  } catch (error) {
    logger.error(`Failed to fetch settings: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch settings" });
  }
});

router.put("/", authenticate, settingsValidation.update, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      schoolName,
      startTime,
      endTime,
      periodsPerDay,
      periodDuration,
      workingDays,
      academicYear,
      timelineEvents,
    } = req.body;

    await ensureDefaultSettings(userId);

    const normalizedEvents = normalizeTimelineEvents(timelineEvents);

    await db.run(
      `UPDATE school_settings
       SET schoolName = ?,
           startTime = ?,
           endTime = ?,
           periodsPerDay = ?,
           periodDuration = ?,
           workingDays = ?,
           academicYear = ?,
           timelineEvents = ?,
           updatedAt = ?
       WHERE userId = ?`,
      schoolName,
      startTime,
      endTime,
      periodsPerDay,
      periodDuration,
      workingDays,
      academicYear ?? "",
      JSON.stringify(normalizedEvents),
      new Date().toISOString(),
      userId
    );

    const settings = await db.get(
      "SELECT * FROM school_settings WHERE userId = ?",
      userId
    );
    logger.info(`School settings updated for user: ${userId}`);

    return res.json({
      success: true,
      data: {
        ...settings,
        timelineEvents: normalizeTimelineEvents(settings.timelineEvents),
      },
    });
  } catch (error) {
    logger.error(`Failed to update settings: ${error.message}`);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update settings",
    });
  }
});

export default router;
