import db from "../db.js";

function normalizeList(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(Boolean);
}

export async function buildUserScopedGenerationPayload(userId, incomingPayload) {
  const [allocations, teachers, subjects, classes, settings] = await Promise.all([
    db.all(
      "SELECT id, userId, classId, subjectId, teacherId, periods, createdAt, updatedAt FROM allocations WHERE userId = ? ORDER BY createdAt DESC",
      userId
    ),
    db.all(
      "SELECT id, userId, code, name, subject, workload, availability, createdAt, updatedAt FROM teachers WHERE userId = ? ORDER BY createdAt DESC",
      userId
    ),
    db.all(
      "SELECT id, userId, name, periodsPerWeek, createdAt, updatedAt FROM subjects WHERE userId = ? ORDER BY createdAt DESC",
      userId
    ),
    db.all(
      "SELECT id, userId, className, section, createdAt, updatedAt FROM classes WHERE userId = ? ORDER BY createdAt DESC",
      userId
    ),
    db.get("SELECT * FROM school_settings WHERE userId = ?", userId),
  ]);

  const scopedSettings = {
    ...(settings || {}),
    userId,
  };

  return {
    allocations: normalizeList(allocations),
    teachers: normalizeList(teachers),
    subjects: normalizeList(subjects),
    classes: normalizeList(classes),
    settings: scopedSettings,
    incoming: {
      allocations: normalizeList(incomingPayload?.allocations),
      teachers: normalizeList(incomingPayload?.teachers),
      subjects: normalizeList(incomingPayload?.subjects),
      classes: normalizeList(incomingPayload?.classes),
      settings: incomingPayload?.settings || {},
    },
  };
}
