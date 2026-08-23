import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import db, { usePg } from "../db.js";
import logger from "../utils/logger.js";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const timetables = await db.all(
      "SELECT id, userId, name, timetableData, version, isCurrent, createdAt, updatedAt FROM timetables WHERE userId = ? ORDER BY updatedAt DESC, id DESC",
      userId
    );
    return res.json({ success: true, data: timetables });
  } catch (error) {
    logger.error(`Failed to fetch timetables: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch timetables" });
  }
});

router.get("/current", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const timetable = await db.get(
      "SELECT id, userId, name, timetableData, version, isCurrent, createdAt, updatedAt FROM timetables WHERE userId = ? AND isCurrent = ? ORDER BY updatedAt DESC, id DESC LIMIT 1",
      userId,
      usePg ? true : 1
    );

    if (!timetable) {
      return res.status(404).json({ success: false, message: "Current timetable not found" });
    }

    return res.json({ success: true, data: timetable });
  } catch (error) {
    logger.error(`Failed to fetch current timetable: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch current timetable" });
  }
});

router.get("/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const timetable = await db.get(
      "SELECT id, userId, name, timetableData, version, isCurrent, createdAt, updatedAt FROM timetables WHERE id = ? AND userId = ?",
      req.params.id,
      userId
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

router.post("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, timetableData, name } = req.body;
    if (!id || !timetableData) {
      return res.status(400).json({
        success: false,
        message: "id and timetableData are required",
      });
    }

    const existing = await db.get(
      "SELECT id FROM timetables WHERE id = ? AND userId = ?",
      String(id),
      userId
    );
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "A timetable with this ID already exists" });
    }

    const now = new Date().toISOString();
    const historyRows = await db.all(
      "SELECT id, version FROM timetables WHERE userId = ? ORDER BY updatedAt DESC, id DESC",
      userId
    );
    const nextVersion = historyRows.length > 0 ? Math.max(...historyRows.map((row) => Number(row.version || 1))) + 1 : 1;

    await db.transaction(async (tx) => {
      const currentRows = await tx.all(
        "SELECT id FROM timetables WHERE userId = ? AND isCurrent = ?",
        userId,
        usePg ? true : 1
      );

      for (const row of currentRows) {
        await tx.run(
          "UPDATE timetables SET isCurrent = ?, updatedAt = ? WHERE id = ? AND userId = ?",
          usePg ? false : 0,
          now,
          row.id,
          userId
        );
      }

      await tx.run(
        "INSERT INTO timetables (id, userId, name, timetableData, version, isCurrent, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        String(id),
        userId,
        name || "Untitled Timetable",
        typeof timetableData === "string" ? timetableData : JSON.stringify(timetableData),
        nextVersion,
        usePg ? true : 1,
        now,
        now
      );
    });

    const timetable = await db.get(
      "SELECT id, userId, name, timetableData, version, isCurrent, createdAt, updatedAt FROM timetables WHERE id = ? AND userId = ?",
      String(id),
      userId
    );

    logger.info(`Timetable saved: ${id} (user: ${userId})`);
    return res.status(201).json({ success: true, data: timetable });
  } catch (error) {
    logger.error(`Failed to save timetable: ${error.message}`);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to save timetable",
    });
  }
});

router.put("/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { timetableData, name } = req.body;
    if (!timetableData) {
      return res.status(400).json({
        success: false,
        message: "timetableData is required",
      });
    }

    const now = new Date().toISOString();
    const result = await db.run(
      "UPDATE timetables SET timetableData = ?, name = COALESCE(?, name), updatedAt = ? WHERE id = ? AND userId = ?",
      typeof timetableData === "string" ? timetableData : JSON.stringify(timetableData),
      name || null,
      now,
      req.params.id,
      userId
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }

    const timetable = await db.get(
      "SELECT id, userId, name, timetableData, version, isCurrent, createdAt, updatedAt FROM timetables WHERE id = ? AND userId = ?",
      req.params.id,
      userId
    );

    logger.info(`Timetable updated: ${req.params.id} (user: ${userId})`);
    return res.json({ success: true, data: timetable });
  } catch (error) {
    logger.error(`Failed to update timetable: ${error.message}`);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update timetable",
    });
  }
});

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const target = await db.get(
      "SELECT id, isCurrent FROM timetables WHERE id = ? AND userId = ?",
      req.params.id,
      userId
    );

    if (!target) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }

    const result = await db.transaction(async (tx) => {
      const deleted = await tx.run(
        "DELETE FROM timetables WHERE id = ? AND userId = ?",
        req.params.id,
        userId
      );

      if (deleted.changes === 0) {
        return { deleted: false };
      }

      if (target.isCurrent === true || target.isCurrent === 1) {
        const replacement = await tx.get(
          "SELECT id FROM timetables WHERE userId = ? ORDER BY updatedAt DESC, id DESC LIMIT 1",
          userId
        );

        if (replacement) {
          await tx.run(
            "UPDATE timetables SET isCurrent = ?, updatedAt = ? WHERE id = ? AND userId = ?",
            usePg ? true : 1,
            new Date().toISOString(),
            replacement.id,
            userId
          );
        }
      }

      return { deleted: true };
    });

    if (!result.deleted) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }

    logger.info(`Timetable deleted: ${req.params.id} (user: ${userId})`);
    return res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error(`Failed to delete timetable: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete timetable",
    });
  }
});

export default router;
