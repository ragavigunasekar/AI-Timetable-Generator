import test from "node:test";
import assert from "node:assert/strict";
import db from "../db.js";
import { buildUserScopedGenerationPayload } from "./aiScopeService.js";

async function clearUserRows(userId) {
  await db.run("DELETE FROM allocations WHERE userId = ?", userId);
  await db.run("DELETE FROM teachers WHERE userId = ?", userId);
  await db.run("DELETE FROM subjects WHERE userId = ?", userId);
  await db.run("DELETE FROM classes WHERE userId = ?", userId);
  await db.run("DELETE FROM school_settings WHERE userId = ?", userId);
}

test("buildUserScopedGenerationPayload uses only the authenticated user's records", async () => {
  const userId = 987654321;
  const foreignUserId = 123456789;

  try {
    await clearUserRows(userId);
    await clearUserRows(foreignUserId);

    await db.run(
      "INSERT INTO teachers (id, userId, code, name, subject, workload, availability, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      "own-teacher",
      userId,
      "T1",
      "Own Teacher",
      "Math",
      "5",
      "Mon,Tue,Wed,Thu,Fri",
      new Date().toISOString(),
      new Date().toISOString()
    );
    await db.run(
      "INSERT INTO teachers (id, userId, code, name, subject, workload, availability, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      "foreign-teacher",
      foreignUserId,
      "T2",
      "Foreign Teacher",
      "Science",
      "4",
      "Mon,Tue,Wed,Thu,Fri",
      new Date().toISOString(),
      new Date().toISOString()
    );

    await db.run(
      "INSERT INTO subjects (id, userId, name, periodsPerWeek, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      "own-subject",
      userId,
      "Algebra",
      "5",
      new Date().toISOString(),
      new Date().toISOString()
    );
    await db.run(
      "INSERT INTO subjects (id, userId, name, periodsPerWeek, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      "foreign-subject",
      foreignUserId,
      "Chemistry",
      "4",
      new Date().toISOString(),
      new Date().toISOString()
    );

    await db.run(
      "INSERT INTO classes (id, userId, className, section, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      "own-class",
      userId,
      "Grade 8",
      "A",
      new Date().toISOString(),
      new Date().toISOString()
    );
    await db.run(
      "INSERT INTO classes (id, userId, className, section, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      "foreign-class",
      foreignUserId,
      "Grade 9",
      "B",
      new Date().toISOString(),
      new Date().toISOString()
    );

    await db.run(
      "INSERT INTO allocations (id, userId, classId, subjectId, teacherId, periods, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      "own-allocation",
      userId,
      "own-class",
      "own-subject",
      "own-teacher",
      4,
      new Date().toISOString(),
      new Date().toISOString()
    );
    await db.run(
      "INSERT INTO allocations (id, userId, classId, subjectId, teacherId, periods, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      "foreign-allocation",
      foreignUserId,
      "foreign-class",
      "foreign-subject",
      "foreign-teacher",
      2,
      new Date().toISOString(),
      new Date().toISOString()
    );

    const payload = await buildUserScopedGenerationPayload(userId, {
      allocations: [
        {
          id: "foreign-allocation",
          classId: "foreign-class",
          subjectId: "foreign-subject",
          teacherId: "foreign-teacher",
          periods: 2,
        },
      ],
      teachers: [{ id: "foreign-teacher", name: "Foreign Teacher", subject: "Science" }],
      subjects: [{ id: "foreign-subject", name: "Chemistry" }],
      classes: [{ id: "foreign-class", className: "Grade 9", section: "B" }],
      settings: { schoolName: "Injected" },
    });

    assert.equal(payload.allocations.length, 1);
    assert.equal(payload.allocations[0].id, "own-allocation");
    assert.equal(payload.teachers[0].id, "own-teacher");
    assert.equal(payload.subjects[0].id, "own-subject");
    assert.equal(payload.classes[0].id, "own-class");
    assert.equal(payload.settings.userId, userId);
  } finally {
    await clearUserRows(userId);
    await clearUserRows(foreignUserId);
  }
});
