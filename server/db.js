import sqlite3 from "sqlite3";
import { open } from "sqlite";
import pg from "pg";
import logger from "./utils/logger.js";

const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL;
export const usePg = Boolean(DATABASE_URL && DATABASE_URL.trim().length > 0);

let sqliteDb = null;
let pgPool = null;
let sqliteTransactionQueue = Promise.resolve();

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

// ─── PostgreSQL Query Translation Helpers ────────────────────────────────────
const CAMEL_CASE_COLUMNS = [
  "passwordHash",
  "userId",
  "schoolName",
  "startTime",
  "endTime",
  "className",
  "periodsPerWeek",
  "periodsPerDay",
  "periodDuration",
  "workingDays",
  "shortBreaks",
  "shortBreakDuration",
  "lunchDuration",
  "lunchPosition",
  "assemblyPeriod",
  "prayerPeriod",
  "breakPositions",
  "breakDurations",
  "academicYear",
  "timelineEvents",
  "timetableData",
  "classId",
  "subjectId",
  "teacherId",
  "createdAt",
  "updatedAt",
  "isCurrent",
  "version",
];

export function formatPgQuery(sql) {
  let formatted = sql;

  // Replace datetime('now') with CURRENT_TIMESTAMP
  formatted = formatted.replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP");

  // Ensure camelCase column names are enclosed in double quotes for Postgres
  for (const col of CAMEL_CASE_COLUMNS) {
    const regex = new RegExp(`(?<!["\\w])${col}(?!["\\w])`, "g");
    formatted = formatted.replace(regex, `"${col}"`);
  }

  // Replace ? placeholders with $1, $2, $3...
  let paramIndex = 1;
  formatted = formatted.replace(/\?/g, () => `$${paramIndex++}`);

  // For INSERT queries without RETURNING, append RETURNING id / userId
  if (/^\s*INSERT\s+INTO/i.test(formatted) && !/\bRETURNING\b/i.test(formatted)) {
    if (/\bINSERT\s+INTO\s+"?school_settings"?/i.test(formatted)) {
      formatted += ' RETURNING "userId"';
    } else {
      formatted += ' RETURNING id';
    }
  }

  return formatted;
}

// ─── Database Initialization ──────────────────────────────────────────────────
if (usePg) {
  logger.info(`🐘 PostgreSQL mode active (DATABASE_URL detected)`);
  try {
    pgPool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
    });

    const { rows } = await pgPool.query("SELECT 1 as ok");
    logger.info(`✅ PostgreSQL connection verified: ${rows[0]?.ok === 1 ? "connected" : "ready"}`);

    pgPool.on("error", (err) => {
      logger.error(`PostgreSQL Pool Error: ${err.message}`);
    });
  } catch (err) {
    logger.error(`❌ PostgreSQL connection failed. Failing startup instead of silently falling back to SQLite. ${err.message}`);
    throw err;
  }
} else {
  const DB_FILE = process.env.DB_PATH || "./school.db";
  logger.info(`🗄️ SQLite mode active (file: ${DB_FILE})`);
  sqliteDb = await open({
    filename: DB_FILE,
    driver: sqlite3.Database,
  });
}

// ─── PostgreSQL Schema Creation ───────────────────────────────────────────────
const PG_TABLE_CREATORS = {
  users: `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'teacher',
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  teachers: `CREATE TABLE IF NOT EXISTS teachers (
    id VARCHAR(255) PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(255),
    name VARCHAR(255),
    subject VARCHAR(255),
    workload VARCHAR(255),
    availability TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  subjects: `CREATE TABLE IF NOT EXISTS subjects (
    id VARCHAR(255) PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    "periodsPerWeek" VARCHAR(255),
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  classes: `CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(255) PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "className" VARCHAR(255),
    section VARCHAR(255),
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  allocations: `CREATE TABLE IF NOT EXISTS allocations (
    id VARCHAR(255) PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "classId" VARCHAR(255),
    "subjectId" VARCHAR(255),
    "teacherId" VARCHAR(255),
    periods INTEGER,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  school_settings: `CREATE TABLE IF NOT EXISTS school_settings (
    "userId" INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    "schoolName" VARCHAR(255),
    "startTime" VARCHAR(255),
    "endTime" VARCHAR(255),
    "periodsPerDay" VARCHAR(255),
    "periodDuration" VARCHAR(255),
    "workingDays" VARCHAR(255),
    "shortBreaks" VARCHAR(255),
    "shortBreakDuration" VARCHAR(255),
    "lunchDuration" VARCHAR(255),
    "lunchPosition" VARCHAR(255),
    "assemblyPeriod" VARCHAR(255),
    "prayerPeriod" VARCHAR(255),
    "breakPositions" VARCHAR(255),
    "breakDurations" VARCHAR(255),
    "academicYear" VARCHAR(255),
    "timelineEvents" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  timetables: `CREATE TABLE IF NOT EXISTS timetables (
    id VARCHAR(255) PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    "timetableData" TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
};

// ─── SQLite Schema Creators ───────────────────────────────────────────────────
const SQLITE_TABLE_CREATORS = {
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
    version INTEGER NOT NULL DEFAULT 1,
    isCurrent INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )`,
};

// ─── Execute Initial Migrations / DDL ──────────────────────────────────────────
try {
  logger.info("🚀 Verifying database tables and schema...");
  if (usePg) {
    for (const [tableName, creatorSql] of Object.entries(PG_TABLE_CREATORS)) {
      await pgPool.query(creatorSql);
      logger.info(`✅ PostgreSQL table verified: '${tableName}'`);
    }
  } else {
    for (const [tableName, creatorSql] of Object.entries(SQLITE_TABLE_CREATORS)) {
      await sqliteDb.exec(creatorSql);
      logger.info(`✅ SQLite table verified: '${tableName}'`);
    }
  }
  logger.info("✓ Database schema verification completed successfully!");
} catch (err) {
  logger.error(`❌ DB Migration Error: ${err.message}`);
  if (usePg) {
    // Fail startup clearly if production DB configuration is invalid
    throw err;
  }
}

async function ensureTimetableLifecycleColumns() {
  try {
    if (usePg) {
      const { rows } = await pgPool.query(
        `SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'timetables'`
      );
      const existing = new Set(rows.map((row) => row.name));

      if (!existing.has("version")) {
        await pgPool.query('ALTER TABLE timetables ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1');
      }
      if (!existing.has("isCurrent")) {
        await pgPool.query('ALTER TABLE timetables ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT FALSE');
      }
    } else {
      const tableInfo = await sqliteDb.all("PRAGMA table_info(timetables)");
      const existing = new Set(tableInfo.map((column) => column.name));

      if (!existing.has("version")) {
        await sqliteDb.run("ALTER TABLE timetables ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
      }
      if (!existing.has("isCurrent")) {
        await sqliteDb.run("ALTER TABLE timetables ADD COLUMN isCurrent INTEGER NOT NULL DEFAULT 0");
      }
    }
  } catch (error) {
    logger.warn(`Could not ensure timetable lifecycle columns: ${error.message}`);
  }
}

await ensureTimetableLifecycleColumns();

async function ensureCurrentTimetableBackfill() {
  try {
    if (usePg) {
      await pgPool.query(`
        WITH ranked AS (
          SELECT id, "userId", ROW_NUMBER() OVER (
            PARTITION BY "userId" ORDER BY "updatedAt" DESC, id DESC
          ) AS rn
          FROM timetables
        )
        UPDATE timetables t
        SET version = r.rn,
            "isCurrent" = (r.rn = 1)
        FROM ranked r
        WHERE t.id = r.id
      `);

      await pgPool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_timetables_current_user
        ON timetables ("userId")
        WHERE "isCurrent" = TRUE
      `);
    } else {
      const rows = await sqliteDb.all('SELECT DISTINCT userId FROM timetables ORDER BY userId');
      for (const row of rows) {
        const userRows = await sqliteDb.all(
          'SELECT id FROM timetables WHERE userId = ? ORDER BY updatedAt DESC, id DESC',
          row.userId
        );

        for (let index = 0; index < userRows.length; index += 1) {
          await sqliteDb.run(
            'UPDATE timetables SET version = ?, isCurrent = ? WHERE id = ?',
            index + 1,
            index === 0 ? 1 : 0,
            userRows[index].id
          );
        }
      }

      await sqliteDb.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_timetables_current_user
        ON timetables (userId)
        WHERE isCurrent = 1
      `);
    }
  } catch (error) {
    logger.warn(`Could not backfill current timetable state: ${error.message}`);
  }
}

await ensureCurrentTimetableBackfill();

// ─── Universal DB Driver Wrapper Interface ────────────────────────────────────
const db = {
  async get(sql, ...params) {
    const flatParams = params.flat();
    if (usePg) {
      const formattedSql = formatPgQuery(sql);
      const res = await pgPool.query(formattedSql, flatParams);
      return res.rows[0] || undefined;
    }
    return sqliteDb.get(sql, ...flatParams);
  },

  async all(sql, ...params) {
    const flatParams = params.flat();
    if (usePg) {
      const formattedSql = formatPgQuery(sql);
      const res = await pgPool.query(formattedSql, flatParams);
      return res.rows;
    }
    return sqliteDb.all(sql, ...flatParams);
  },

  async run(sql, ...params) {
    const flatParams = params.flat();
    if (usePg) {
      const formattedSql = formatPgQuery(sql);
      const res = await pgPool.query(formattedSql, flatParams);
      const insertedId = res.rows[0]?.id ?? res.rows[0]?.userId ?? null;
      return {
        lastID: insertedId,
        changes: res.rowCount,
      };
    }
    return sqliteDb.run(sql, ...flatParams);
  },

  async exec(sql) {
    if (usePg) {
      const formattedSql = formatPgQuery(sql);
      await pgPool.query(formattedSql);
      return;
    }
    return sqliteDb.exec(sql);
  },

  async transaction(callback) {
    if (usePg) {
      const client = await pgPool.connect();
      const tx = {
        async get(sql, ...params) {
          const flatParams = params.flat();
          const res = await client.query(formatPgQuery(sql), flatParams);
          return res.rows[0] || undefined;
        },
        async all(sql, ...params) {
          const flatParams = params.flat();
          const res = await client.query(formatPgQuery(sql), flatParams);
          return res.rows;
        },
        async run(sql, ...params) {
          const flatParams = params.flat();
          const res = await client.query(formatPgQuery(sql), flatParams);
          return {
            lastID: res.rows[0]?.id ?? res.rows[0]?.userId ?? null,
            changes: res.rowCount,
          };
        },
        async exec(sql) {
          await client.query(formatPgQuery(sql));
          return;
        },
      };

      try {
        await client.query("BEGIN");
        const result = await callback(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    const queue = sqliteTransactionQueue.then(async () => {
      await sqliteDb.run("BEGIN");
      const tx = {
        async get(sql, ...params) {
          const flatParams = params.flat();
          return sqliteDb.get(sql, ...flatParams);
        },
        async all(sql, ...params) {
          const flatParams = params.flat();
          return sqliteDb.all(sql, ...flatParams);
        },
        async run(sql, ...params) {
          const flatParams = params.flat();
          return sqliteDb.run(sql, ...flatParams);
        },
        async exec(sql) {
          return sqliteDb.exec(sql);
        },
      };

      try {
        const result = await callback(tx);
        await sqliteDb.run("COMMIT");
        return result;
      } catch (error) {
        await sqliteDb.run("ROLLBACK");
        throw error;
      }
    });

    sqliteTransactionQueue = queue.catch(() => undefined);
    return queue;
  },
};

export async function ensureDefaultSettings(userId) {
  const existing = await db.get(
    'SELECT "userId" FROM school_settings WHERE "userId" = ?',
    userId
  );

  if (!existing) {
    await db.run(
      `INSERT INTO school_settings
      (
        "userId",
        "schoolName",
        "startTime",
        "endTime",
        "periodsPerDay",
        "periodDuration",
        "workingDays",
        "shortBreaks",
        "shortBreakDuration",
        "lunchDuration",
        "lunchPosition",
        "assemblyPeriod",
        "prayerPeriod",
        "breakPositions",
        "breakDurations",
        "academicYear"
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
    logger.info(`✅ Default school settings created for user ${userId}`);
  }
}

export default db;
