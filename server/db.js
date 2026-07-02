import sqlite3 from "sqlite3";
import { open } from "sqlite";

const db = await open({
  filename: "./school.db",
  driver: sqlite3.Database,
});

// -------------------- SAFE MIGRATION --------------------
try {
  const tableExists = await db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='allocations'"
  );

  if (tableExists) {
    const columns = await db.all("PRAGMA table_info(allocations)");
    const hasClassId = columns.some((c) => c.name === "classId");

    if (!hasClassId) {
      console.log("🔄 Migrating allocations table...");
      await db.exec("DROP TABLE IF EXISTS allocations");
    }
  }
} catch (err) {
  console.error("DB Migration Error:", err);
}

// -------------------- TABLES --------------------
await db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher'
);

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT,
  subject TEXT,
  workload TEXT
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT,
  periodsPerWeek TEXT
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  className TEXT,
  section TEXT
);

CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  classId TEXT,
  subjectId TEXT,
  teacherId TEXT,
  periods INTEGER
);

CREATE TABLE IF NOT EXISTS school_settings (
  id INTEGER PRIMARY KEY,
  schoolName TEXT,
  startTime TEXT,
  endTime TEXT,
  periodsPerDay TEXT,
  periodDuration TEXT,
  workingDays TEXT,
  shortBreaks TEXT,
  shortBreakDuration TEXT,
  lunchDuration TEXT,
  lunchPosition TEXT,
  assemblyPeriod TEXT,
  prayerPeriod TEXT,
  breakPositions TEXT,
  breakDurations TEXT
);
`);

// -------------------- DEFAULT SETTINGS --------------------
const existingSettings = await db.get(
  "SELECT id FROM school_settings WHERE id = 1"
);

if (!existingSettings) {
  await db.run(
    `INSERT INTO school_settings
    (
      id,
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
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    1,
    "State Board Government School",
    "08:45",
    "16:00",
    "8",
    "45",
    "Mon-Fri",
    "2",
    "10",
    "45",
    "5",
    "",
    "",
    "2,7",
    "10,10"
  );
}

export default db;