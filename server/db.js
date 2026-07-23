import sqlite3 from "sqlite3";
import { open } from "sqlite";

const db = await open({
  filename: "./school.db",
  driver: sqlite3.Database,
});

// -------------------- SAFE MIGRATION --------------------
// -------------------- SCHEMA DEFINITIONS --------------------
const TABLE_CREATORS = {
  users: `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher'
  )`,
  teachers: `CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT,
    subject TEXT,
    workload TEXT,
    availability TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri'
  )`,
  subjects: `CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT,
    periodsPerWeek TEXT
  )`,
  classes: `CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    className TEXT,
    section TEXT
  )`,
  allocations: `CREATE TABLE IF NOT EXISTS allocations (
    id TEXT PRIMARY KEY,
    classId TEXT,
    subjectId TEXT,
    teacherId TEXT,
    periods INTEGER
  )`,
  school_settings: `CREATE TABLE IF NOT EXISTS school_settings (
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
  )`,
  timetables: `CREATE TABLE IF NOT EXISTS timetables (
    id TEXT PRIMARY KEY,
    timetableData TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )`
};

const TABLE_COLUMNS = {
  users: {
    email: "TEXT UNIQUE NOT NULL",
    passwordHash: "TEXT NOT NULL",
    role: "TEXT NOT NULL DEFAULT 'teacher'"
  },
  teachers: {
    code: "TEXT",
    name: "TEXT",
    subject: "TEXT",
    workload: "TEXT",
    availability: "TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri'"
  },
  subjects: {
    name: "TEXT",
    periodsPerWeek: "TEXT"
  },
  classes: {
    className: "TEXT",
    section: "TEXT"
  },
  allocations: {
    classId: "TEXT",
    subjectId: "TEXT",
    teacherId: "TEXT",
    periods: "INTEGER"
  },
  school_settings: {
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
    breakDurations: "TEXT"
  },
  timetables: {
    timetableData: "TEXT",
    createdAt: "TEXT",
    updatedAt: "TEXT"
  }
};

// -------------------- RUN PROGRAMMATIC MIGRATIONS --------------------
try {
  console.log("🚀 Starting database migrations...");
  for (const [tableName, creatorSql] of Object.entries(TABLE_CREATORS)) {
    // 1. Create table if not exists
    await db.exec(creatorSql);
    
    // 2. Fetch current columns info
    const dbCols = await db.all(`PRAGMA table_info(${tableName})`);
    const existingColNames = dbCols.map(c => c.name.toLowerCase());
    
    // 3. Check for any missing columns defined in table columns schema
    const targetCols = TABLE_COLUMNS[tableName] || {};
    for (const [colName, colType] of Object.entries(targetCols)) {
      if (!existingColNames.includes(colName.toLowerCase())) {
        console.log(`🔄 DB Migration: Adding missing column '${colName}' (${colType}) to table '${tableName}'`);
        await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType}`);
      }
    }

    // 4. Verify final table schema after any migration changes
    const verifiedCols = await db.all(`PRAGMA table_info(${tableName})`);
    const verifiedColNames = new Set(
      verifiedCols.map((column) => column.name.toLowerCase())
    );
    const missingColumns = Object.keys(targetCols).filter(
      (columnName) => !verifiedColNames.has(columnName.toLowerCase())
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Schema verification failed for '${tableName}'. Missing columns: ${missingColumns.join(", ")}`
      );
    }

    console.log(
      `✅ Schema verified for '${tableName}' (${verifiedCols.length} columns found).`
    );
  }
  console.log("✓ Database migrations completed successfully!");
} catch (err) {
  console.error("❌ DB Migration Error:", err);
}

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