import { buildUserScopedGenerationPayload } from "./aiScopeService.js";
import { generateOptimizedTimetable } from "./timetableOptimizer.js";
import { validateTimetable } from "./timetableValidator.js";
import db from "../db.js";
import logger from "../utils/logger.js";
import { randomUUID } from "node:crypto";

function serializeSnapshot(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function getCurrentUserTime() {
  return new Date().toISOString();
}

export async function persistCurrentTimetableForUser({ userId, timetable, name = "Generated Timetable", source = "ai-generated" }) {
  const now = getCurrentUserTime();
  const rowId = randomUUID();

  return db.transaction(async (tx) => {
    const existingRows = await tx.all(
      'SELECT id, version, "isCurrent" FROM timetables WHERE "userId" = ? ORDER BY "updatedAt" DESC, id DESC',
      userId
    );

    const currentIds = existingRows
      .filter((row) => row.isCurrent === true || row.isCurrent === 1)
      .map((row) => row.id);

    for (const currentId of currentIds) {
      await tx.run(
        'UPDATE timetables SET "isCurrent" = false, "updatedAt" = ? WHERE id = ? AND "userId" = ?',
        now,
        currentId,
        userId
      );
    }

    const nextVersion = existingRows.length > 0 ? Math.max(...existingRows.map((row) => Number(row.version || 1))) + 1 : 1;

    const insertResult = await tx.run(
      'INSERT INTO timetables (id, "userId", name, "timetableData", version, "isCurrent", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      rowId,
      userId,
      name,
      serializeSnapshot(timetable),
      nextVersion,
      true,
      now,
      now
    );

    const persisted = await tx.get(
      'SELECT id, "userId", name, "timetableData", version, "isCurrent", "createdAt", "updatedAt" FROM timetables WHERE id = ? AND "userId" = ?',
      rowId,
      userId
    );

    if (!persisted) {
      throw new Error("Failed to persist generated timetable snapshot");
    }

    logger.info(`Persisted current timetable for user ${userId}: ${rowId} (version=${persisted.version})`);
    return { ...persisted, changes: insertResult?.changes ?? 1 };
  });
}

export async function generateAndPersistTimetable({ userId, incomingPayload = {} }) {
  const { allocations, teachers, subjects, classes, settings } = await buildUserScopedGenerationPayload(userId, incomingPayload);

  if (!allocations.length || !teachers.length || !subjects.length || !classes.length || !settings) {
    const error = new Error("Missing required data: allocations, teachers, subjects, classes, settings");
    error.statusCode = 400;
    throw error;
  }

  const result = generateOptimizedTimetable(
    { allocations, teachers, subjects, classes, settings },
    { candidateCount: 8, localSearchRounds: 6, randomSeed: Date.now() % 10000 }
  );

  const validation = validateTimetable({
    timetable: result.timetable,
    teachers,
    classes,
    subjects,
    allocations,
    settings,
    userId,
  });

  if (!validation.valid) {
    const error = new Error("Generated timetable failed validation.");
    error.statusCode = 400;
    error.validation = {
      status: validation.status,
      errors: validation.errors,
      warnings: validation.warnings,
      summary: validation.summary,
      statistics: validation.statistics,
    };
    throw error;
  }

  const persistedTimetable = await persistCurrentTimetableForUser({
    userId,
    timetable: result.timetable,
    name: "Generated Timetable",
    source: "ai-generated",
  });

  return {
    timetable: result.timetable,
    conflicts: result.conflicts,
    unplacedAllocations: result.unplacedAllocations,
    score: result.score,
    meta: result.meta,
    validation,
    persistedTimetable,
  };
}
