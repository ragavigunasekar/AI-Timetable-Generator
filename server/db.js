import sqlite3 from "sqlite3";
import { open } from "sqlite";

const db = await open({
  filename: "./school.db",
  driver: sqlite3.Database,
});

const VALID_TABLES = new Set([
  "users",
  "teachers",
  "subjects",
  "classes",
  "allocations",
  "school_settings",
  "timetables",
]);

export function isValidTable(tableName) {
  return VALID_TABLES.has(tableName);
}

const TABLE_CREATORS = {
  users: `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,
  teachers: `CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    code TEXT,
    name TEXT,
    subject TEXT,
    workload TEXT,
    availability TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )`,
  subjects: `CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    name TEXT,
    periodsPerWeek TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )`,
  classes: `CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    className TEXT,
    section TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )`,
  allocations: `CREATE TABLE IF NOT EXISTS allocations (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    classId TEXT,
    subjectId TEXT,
    teacherId TEXT,
    periods INTEGER,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )`,
  school_settings: `CREATE TABLE IF NOT EXISTS school_settings (
    userId INTEGER PRIMARY KEY,
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
    breakDurations TEXT,
    academicYear TEXT,
    timelineEvents TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )`,
  timetables: `CREATE TABLE IF NOT EXISTS timetables (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    name TEXT,
    timetableData TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )`,
};

const TABLE_COLUMNS = {
  users: {
    email: "TEXT UNIQUE NOT NULL",
    passwordHash: "TEXT NOT NULL",
    role: "TEXT NOT NULL DEFAULT 'teacher'",
    createdAt: "TEXT DEFAULT (datetime('now'))",
    updatedAt: "TEXT DEFAULT (datetime('now'))",
  },
  teachers: {
    userId: "INTEGER NOT NULL",
    code: "TEXT",
    name: "TEXT",
    subject: "TEXT",
    workload: "TEXT",
    availability: "TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri'",
    createdAt: "TEXT DEFAULT (datetime('now'))",
    updatedAt: "TEXT DEFAULT (datetime('now'))",
  },
  subjects: {
    userId: "INTEGER NOT NULL",
    name: "TEXT",
    periodsPerWeek: "TEXT",
    createdAt: "TEXT DEFAULT (datetime('now'))",
    updatedAt: "TEXT DEFAULT (datetime('now'))",
  },
  classes: {
    userId: "INTEGER NOT NULL",
    className: "TEXT",
    section: "TEXT",
    createdAt: "TEXT DEFAULT (datetime('now'))",
    updatedAt: "TEXT DEFAULT (datetime('now'))",
  },
  allocations: {
    userId: "INTEGER NOT NULL",
    classId: "TEXT",
    subjectId: "TEXT",
    teacherId: "TEXT",
    periods: "INTEGER",
    createdAt: "TEXT DEFAULT (datetime('now'))",
    updatedAt: "TEXT DEFAULT (datetime('now'))",
  },
  school_settings: {
    userId: "INTEGER PRIMARY KEY",
    schoolName: "TEXT",
    startTime: "TEXT",
    endTime: "TEXT",
    periodsPerDay: "TEXT",
    periodDuration: "TEXT",
    workingDays: "TEXT",
    shortBreaks: "TEXT",
    shortBreakDuration: "TEXT",
    lunchDuration: "TEXT",
    lunchPosition: "TEXT",
    assemblyPeriod: "TEXT",
    prayerPeriod: "TEXT",
    breakPositions: "TEXT",
    breakDurations: "TEXT",
    academicYear: "TEXT",
    timelineEvents: "TEXT",
    createdAt: "TEXT DEFAULT (datetime('now'))",
    updatedAt: "TEXT DEFAULT (datetime('now'))",
  },
  timetables: {
    userId: "INTEGER NOT NULL",
    name: "TEXT",
    timetableData: "TEXT",
    createdAt: "TEXT DEFAULT (datetime('now'))",
    updatedAt: "TEXT DEFAULT (datetime('now'))",
  },
};

async function migrateOldSchema() {
  try {
    const teachersCols = await db.all("PRAGMA table_info(teachers)");
    const hasTeacherUserId = teachersCols.some((c) => c.name.toLowerCase() === "userid");
    const usersCols = await db.all("PRAGMA table_info(users)");
    const usersColNames = new Set(usersCols.map((c) => c.name.toLowerCase()));
    const usersMissingTimestamps = !usersColNames.has("createdat") || !usersColNames.has("updatedat");

    if (!hasTeacherUserId || usersMissingTimestamps) {
      console.log("🔄 Migrating legacy schema: dropping and recreating all tables with new schema...");

      let existingUsers = [];
      let existingTeachers = [];
      let existingSubjects = [];
      let existingClasses = [];
      let existingAllocations = [];
      let existingSettings = null;
      let existingTimetables = [];

      try { existingUsers = await db.all("SELECT * FROM users"); } catch { /* no users table */ }
      try { existingTeachers = await db.all("SELECT * FROM teachers"); } catch { /* empty */ }
      try { existingSubjects = await db.all("SELECT * FROM subjects"); } catch { /* empty */ }
      try { existingClasses = await db.all("SELECT * FROM classes"); } catch { /* empty */ }
      try { existingAllocations = await db.all("SELECT * FROM allocations"); } catch { /* empty */ }
      try { existingSettings = await db.get("SELECT * FROM school_settings WHERE id = 1"); } catch { /* empty */ }
      try { existingTimetables = await db.all("SELECT * FROM timetables"); } catch { /* empty */ }

      const legacyUserId = 1;
      const hasLegacyUser = existingUsers.some((u) => u.id === legacyUserId)
        || existingTeachers.length > 0
        || existingSubjects.length > 0
        || existingClasses.length > 0
        || existingAllocations.length > 0
        || !!existingSettings
        || existingTimetables.length > 0;

      if (hasLegacyUser && !existingUsers.some((u) => u.id === legacyUserId)) {
        console.log("🔄 Creating legacy placeholder user for orphan data...");
        existingUsers.unshift({
          id: legacyUserId,
          email: "legacy@migrated.local",
          passwordHash: "$2a$10$migratedLegacyUserPlaceholderHashXXXXXXXXXXXXXXXX",
          role: "teacher",
        });
      }

      await db.exec("DROP TABLE IF EXISTS timetables");
      await db.exec("DROP TABLE IF EXISTS allocations");
      await db.exec("DROP TABLE IF EXISTS school_settings");
      await db.exec("DROP TABLE IF EXISTS classes");
      await db.exec("DROP TABLE IF EXISTS subjects");
      await db.exec("DROP TABLE IF EXISTS teachers");
      await db.exec("DROP TABLE IF EXISTS users");

      for (const creatorSql of Object.values(TABLE_CREATORS)) {
        await db.exec(creatorSql);
      }

      for (const u of existingUsers) {
        await db.run(
          `INSERT INTO users (id, email, passwordHash, role, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          u.id,
          u.email,
          u.passwordHash,
          u.role || "teacher"
        );
      }
      console.log(`✅ Migrated ${existingUsers.length} users`);

      for (const t of existingTeachers) {
        await db.run(
          `INSERT INTO teachers (id, userId, code, name, subject, workload, availability)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          t.id,
          t.userId ?? legacyUserId,
          t.code,
          t.name,
          t.subject,
          t.workload,
          t.availability ?? "Mon,Tue,Wed,Thu,Fri"
        );
      }
      console.log(`✅ Migrated ${existingTeachers.length} teachers`);

      for (const s of existingSubjects) {
        await db.run(
          `INSERT INTO subjects (id, userId, name, periodsPerWeek)
           VALUES (?, ?, ?, ?)`,
          s.id,
          s.userId ?? legacyUserId,
          s.name,
          s.periodsPerWeek
        );
      }
      console.log(`✅ Migrated ${existingSubjects.length} subjects`);

      for (const c of existingClasses) {
        await db.run(
          `INSERT INTO classes (id, userId, className, section)
           VALUES (?, ?, ?, ?)`,
          c.id,
          c.userId ?? legacyUserId,
          c.className,
          c.section
        );
      }
      console.log(`✅ Migrated ${existingClasses.length} classes`);

      for (const a of existingAllocations) {
        await db.run(
          `INSERT INTO allocations (id, userId, classId, subjectId, teacherId, periods)
           VALUES (?, ?, ?, ?, ?, ?)`,
          a.id,
          a.userId ?? legacyUserId,
          a.classId,
          a.subjectId,
          a.teacherId,
          a.periods
        );
      }
      console.log(`✅ Migrated ${existingAllocations.length} allocations`);

      if (existingSettings) {
        await db.run(
          `INSERT INTO school_settings
           (userId, schoolName, startTime, endTime, periodsPerDay, periodDuration,
            workingDays, shortBreaks, shortBreakDuration, lunchDuration,
            lunchPosition, assemblyPeriod, prayerPeriod, breakPositions, breakDurations, academicYear)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          existingSettings.userId ?? legacyUserId,
          existingSettings.schoolName ?? "My School",
          existingSettings.startTime ?? "08:45",
          existingSettings.endTime ?? "16:00",
          existingSettings.periodsPerDay ?? "8",
          existingSettings.periodDuration ?? "45",
          existingSettings.workingDays ?? "Mon,Tue,Wed,Thu,Fri",
          existingSettings.shortBreaks ?? "2",
          existingSettings.shortBreakDuration ?? "10",
          existingSettings.lunchDuration ?? "45",
          existingSettings.lunchPosition ?? "5",
          existingSettings.assemblyPeriod ?? "",
          existingSettings.prayerPeriod ?? "",
          existingSettings.breakPositions ?? "2,7",
          existingSettings.breakDurations ?? "10,10",
          existingSettings.academicYear ?? ""
        );
        console.log("✅ Migrated school settings");
      }

      for (const tt of existingTimetables) {
        await db.run(
          `INSERT INTO timetables (id, userId, name, timetableData, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          tt.id,
          tt.userId ?? legacyUserId,
          tt.name ?? "Untitled Timetable",
          tt.timetableData
        );
      }
      console.log(`✅ Migrated ${existingTimetables.length} timetables`);

      console.log("✓ Legacy schema migration completed!");
    }
  } catch (err) {
    console.warn("⚠ Legacy migration check skipped:", err.message);
  }
}

try {
  console.log("🚀 Starting database migrations...");
  for (const [tableName, creatorSql] of Object.entries(TABLE_CREATORS)) {
    await db.exec(creatorSql);

    const dbCols = await db.all(`PRAGMA table_info(${tableName})`);
    const existingColNames = dbCols.map((c) => c.name.toLowerCase());

    const targetCols = TABLE_COLUMNS[tableName] || {};
    for (const [colName, colType] of Object.entries(targetCols)) {
      if (!existingColNames.includes(colName.toLowerCase())) {
        if (colName.toLowerCase() === "userid" && tableName === "school_settings") continue;
        if (colName.toLowerCase() === "userid") {
          console.log(`🔄 Critical: Adding userId to ${tableName}...`);
        }
        try {
          await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType}`);
          console.log(`🔄 DB Migration: Added missing column '${colName}' (${colType}) to '${tableName}'`);
        } catch (alterErr) {
          console.warn(`⚠ Could not add column ${colName} to ${tableName}: ${alterErr.message}`);
        }
      }
    }

    const verifiedCols = await db.all(`PRAGMA table_info(${tableName})`);
    const verifiedColNames = new Set(
      verifiedCols.map((column) => column.name.toLowerCase())
    );
    const missingColumns = Object.keys(targetCols).filter(
      (columnName) => !verifiedColNames.has(columnName.toLowerCase())
    );

    if (missingColumns.length > 0) {
      console.warn(
        `⚠ Schema verification warning for '${tableName}'. Missing columns: ${missingColumns.join(", ")}. Will try legacy migration.`
      );
    }

    console.log(
      `✅ Schema verified for '${tableName}' (${verifiedCols.length} columns found).`
    );
  }

  await migrateOldSchema();

  console.log("✓ Database migrations completed successfully!");
} catch (err) {
  console.error("❌ DB Migration Error:", err);
}

export async function ensureDefaultSettings(userId) {
  const existing = await db.get(
    "SELECT userId FROM school_settings WHERE userId = ?",
    userId
  );

  if (!existing) {
    await db.run(
      `INSERT INTO school_settings
      (
        userId,
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
        academicYear
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      "My School",
      "08:45",
      "16:00",
      "8",
      "45",
      "Mon,Tue,Wed,Thu,Fri",
      "2",
      "10",
      "45",
      "5",
      "",
      "",
      "2,7",
      "10,10",
      ""
    );
    console.log(`✅ Default school settings created for user ${userId}`);
  }
}

export default db;
