import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { buildUserScopedGenerationPayload } from "../services/aiScopeService.js";
import { generateOptimizedTimetable } from "../services/timetableOptimizer.js";
import logger from "../utils/logger.js";

const router = Router();

// POST /api/ai/timetable - Generate timetable using AI/optimizer
router.post("/timetable", authenticate, async (req, res) => {
  try {
    const incomingPayload = req.body || {};
    const { allocations, teachers, subjects, classes, settings } = await buildUserScopedGenerationPayload(req.user.id, incomingPayload);

    if (!allocations.length || !teachers.length || !subjects.length || !classes.length || !settings) {
      return res.status(400).json({
        success: false,
        message: "Missing required data: allocations, teachers, subjects, classes, settings",
      });
    }

    // Use the local optimizer engine with only the authenticated user's data.
    const result = generateOptimizedTimetable(
      { allocations, teachers, subjects, classes, settings },
      { candidateCount: 8, localSearchRounds: 6, randomSeed: Date.now() % 10000 }
    );

    logger.info(`Timetable generated with score: ${result.score}`);

    return res.json({
      success: true,
      data: {
        timetable: result.timetable,
        conflicts: result.conflicts,
        unplacedAllocations: result.unplacedAllocations,
        score: result.score,
        meta: result.meta,
      },
    });
  } catch (error) {
    logger.error(`AI timetable generation failed: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate timetable",
    });
  }
});

export default router;