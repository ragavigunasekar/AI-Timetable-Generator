import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import db from "../db.js";
import logger from "../utils/logger.js";

const router = Router();

// GET /api/timetables - List all saved timetables
router.get("/", authenticate, async (req, res) => {
  try {
    const timetables = await db.all(
      "SELECT id, timetableData, createdAt, updatedAt FROM timetables ORDER BY updatedAt DESC"
    );
    return res.json({ success: true, data: timetables });
  } catch (error) {
    logger.error(`Failed to fetch timetables: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch timetables" });
  }
});

// GET /api/timetables/:id - Get a specific timetable
router.get("/:id", authenticate, async (req, res) => {
  try {
    const timetable = await db.get(
      "SELECT id, timetableData, createdAt, updatedAt FROM timetables WHERE id = ?",
      req.params.id
    );
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }
    return res.json({ success: true, data: timetable });
  } catch (error) {
    logger.error(`Failed to fetch timetable: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch timetable" });
  }
});

// POST /api/timetables - Save a new timetable
router.post("/", authenticate, async (req, res) => {
  try {
    const { id, timetableData } = req.body;
    if (!id || !timetableData) {
      return res.status(400).json({ success: false, message: "id and timetableData are required" });
    }

    // Check if timetable already exists
    const existing = await db.get("SELECT id FROM timetables WHERE id = ?", String(id));
    if (existing) {
      return res.status(409).json({ success: false, message: "A timetable with this ID already exists" });
    }

    const now = new Date().toISOString();
    await db.run(
      "INSERT INTO timetables (id, timetableData, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      String(id),
      typeof timetableData === "string" ? timetableData : JSON.stringify(timetableData),
      now,
      now
    );

    const timetable = await db.get(
      "SELECT id, timetableData, createdAt, updatedAt FROM timetables WHERE id = ?",
      String(id)
    );

    logger.info(`Timetable saved: ${id}`);
    return res.status(201).json({ success: true, data: timetable });
  } catch (error) {
    logger.error(`Failed to save timetable: ${error.message}`);
    return res.status(400).json({ success: false, message: error.message || "Failed to save timetable" });
  }
});

// PUT /api/timetables/:id - Update an existing timetable
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { timetableData } = req.body;
    if (!timetableData) {
      return res.status(400).json({ success: false, message: "timetableData is required" });
    }

    const now = new Date().toISOString();
    const result = await db.run(
      "UPDATE timetables SET timetableData = ?, updatedAt = ? WHERE id = ?",
      typeof timetableData === "string" ? timetableData : JSON.stringify(timetableData),
      now,
      req.params.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }

    const timetable = await db.get(
      "SELECT id, timetableData, createdAt, updatedAt FROM timetables WHERE id = ?",
      req.params.id
    );

    logger.info(`Timetable updated: ${req.params.id}`);
    return res.json({ success: true, data: timetable });
  } catch (error) {
    logger.error(`Failed to update timetable: ${error.message}`);
    return res.status(400).json({ success: false, message: error.message || "Failed to update timetable" });
  }
});

// DELETE /api/timetables/:id
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const result = await db.run("DELETE FROM timetables WHERE id = ?", req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }
    logger.info(`Timetable deleted: ${req.params.id}`);
    return res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error(`Failed to delete timetable: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message || "Failed to delete timetable" });
  }
});

export default router;