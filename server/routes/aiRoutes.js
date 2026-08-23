import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { generateAndPersistTimetable } from "../services/timetableGenerationPipeline.js";
import logger from "../utils/logger.js";

const router = Router();

// POST /api/ai/timetable - Generate timetable using AI/optimizer
router.post("/timetable", authenticate, async (req, res) => {
  try {
    const result = await generateAndPersistTimetable({
      userId: req.user.id,
      incomingPayload: req.body || {},
    });

    logger.info(`Timetable generated with score: ${result.score}`);

    return res.json({
      success: true,
      data: {
        timetable: result.timetable,
        conflicts: result.conflicts,
        unplacedAllocations: result.unplacedAllocations,
        score: result.score,
        meta: result.meta,
        validation: result.validation,
        persistedTimetable: result.persistedTimetable,
      },
    });
  } catch (error) {
    logger.error(`AI timetable generation failed: ${error.message}`);
    const status = error.statusCode || 500;
    const validation = error.validation || null;

    return res.status(status).json({
      success: false,
      message: error.message || "Failed to generate timetable",
      validation,
    });
  }
});

export default router;