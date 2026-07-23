import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { settingsValidation } from "../middleware/validator.js";
import db from "../db.js";
import logger from "../utils/logger.js";

const router = Router();

// GET /api/settings
router.get("/", authenticate, async (req, res) => {
  try {
    const settings = await db.get("SELECT * FROM school_settings WHERE id = 1");
    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }
    return res.json({ success: true, data: settings });
  } catch (error) {
    logger.error(`Failed to fetch settings: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch settings" });
  }
});

// PUT /api/settings
router.put("/", authenticate, settingsValidation.update, async (req, res) => {
  try {
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
    } = req.body;

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
           breakDurations = ?
       WHERE id = 1`,
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
      breakDurations
    );

    const settings = await db.get("SELECT * FROM school_settings WHERE id = 1");
    logger.info("School settings updated");
    return res.json({ success: true, data: settings });
  } catch (error) {
    logger.error(`Failed to update settings: ${error.message}`);
    return res.status(400).json({ success: false, message: error.message || "Failed to update settings" });
  }
});

export default router;