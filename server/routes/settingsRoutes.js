import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { settingsValidation } from "../middleware/validator.js";
import db, { ensureDefaultSettings } from "../db.js";
import logger from "../utils/logger.js";

function normalizeTimelineEvents(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
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
    return res.json({
      success: true,
      data: {
        ...settings,
        timelineEvents: normalizeTimelineEvents(settings.timelineEvents),
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
      shortBreaks,
      shortBreakDuration,
      lunchDuration,
      lunchPosition,
      assemblyPeriod,
      prayerPeriod,
      breakPositions,
      breakDurations,
      academicYear,
      timelineEvents,
    } = req.body;

    await ensureDefaultSettings(userId);

    await db.run(
      `UPDATE school_settings
       SET schoolName = ?,
           startTime = ?,
           endTime = ?,
           periodsPerDay = ?,
           periodDuration = ?,
           workingDays = ?,
           shortBreaks = ?,
           shortBreakDuration = ?,
           lunchDuration = ?,
           lunchPosition = ?,
           assemblyPeriod = ?,
           prayerPeriod = ?,
           breakPositions = ?,
           breakDurations = ?,
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
      shortBreaks,
      shortBreakDuration,
      lunchDuration,
      lunchPosition,
      assemblyPeriod,
      prayerPeriod,
      breakPositions,
      breakDurations,
      academicYear ?? "",
      JSON.stringify(normalizeTimelineEvents(timelineEvents)),
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
