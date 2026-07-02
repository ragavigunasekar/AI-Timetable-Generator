import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import dotenv from "dotenv";
import db from "./db.js";
import { generateOptimizedTimetable } from "./services/timetableOptimizer.js";
import buildTimeSlots from "./services/timeSlots.js";

dotenv.config();

const app = express();

// -------------------- CONFIG --------------------
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecuresecret";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// OpenAI (safe init)
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// -------------------- MIDDLEWARE --------------------
app.use(express.json());

// 🔥 FIXED CORS (prevents Network Error)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://YOUR-FRONTEND-URL.onrender.com",
    ],
    credentials: true,
  })
);

// -------------------- HELPERS --------------------
function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// -------------------- HEALTH CHECK --------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server running smoothly 🚀" });
});

// -------------------- AUTH ROUTES --------------------

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const existing = await db.get(
      "SELECT * FROM users WHERE email = ?",
      email
    );

    if (existing) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.run(
      "INSERT INTO users (email, passwordHash) VALUES (?, ?)",
      email,
      passwordHash
    );

    const user = {
      id: result.lastID,
      email,
      role: "teacher",
    };

    const token = createToken(user);

    res.json({ token, user });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.get(
      "SELECT * FROM users WHERE email = ?",
      email
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// -------------------- SETTINGS --------------------
app.get("/api/settings", authenticate, async (req, res) => {
  const settings = await db.get(
    "SELECT * FROM school_settings WHERE id = 1"
  );
  res.json(settings);
});

app.put("/api/settings", authenticate, async (req, res) => {
  const {
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
  } = req.body;

  await db.run(
    `UPDATE school_settings SET 
      schoolName=?, startTime=?, endTime=?, 
      periodsPerDay=?, periodDuration=?, workingDays=?, shortBreaks=?, shortBreakDuration=?, lunchDuration=?, lunchPosition=?, assemblyPeriod=?, prayerPeriod=?, breakPositions=?, breakDurations=?
     WHERE id=1`,
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
  );

  const updated = await db.get(
    "SELECT * FROM school_settings WHERE id = 1"
  );

  res.json(updated);
});

// -------------------- TEACHERS --------------------
app.get("/api/teachers", authenticate, async (req, res) => {
  res.json(await db.all("SELECT * FROM teachers"));
});

app.post("/api/teachers", authenticate, async (req, res) => {
  const { id, code, name, subject, workload } = req.body;

  await db.run(
    "INSERT INTO teachers (id, code, name, subject, workload) VALUES (?, ?, ?, ?, ?)",
    id,
    code,
    name,
    subject,
    workload
  );

  res.json(await db.all("SELECT * FROM teachers"));
});

app.put("/api/teachers/:id", authenticate, async (req, res) => {
  const { code, name, subject, workload } = req.body;

  await db.run(
    "UPDATE teachers SET code=?, name=?, subject=?, workload=? WHERE id=?",
    code,
    name,
    subject,
    workload,
    req.params.id
  );

  res.json(await db.all("SELECT * FROM teachers"));
});

app.delete("/api/teachers/:id", authenticate, async (req, res) => {
  await db.run("DELETE FROM teachers WHERE id=?", req.params.id);

  await db.run(
    "UPDATE allocations SET teacherId=NULL WHERE teacherId=?",
    req.params.id
  );

  res.json({ success: true });
});

// -------------------- CLASSES --------------------
app.get("/api/classes", authenticate, async (req, res) => {
  res.json(await db.all("SELECT * FROM classes"));
});

app.post("/api/classes", authenticate, async (req, res) => {
  const { id, className, section } = req.body;

  await db.run(
    "INSERT INTO classes (id, className, section) VALUES (?, ?, ?)",
    id,
    className,
    section
  );

  res.json(await db.all("SELECT * FROM classes"));
});

app.put("/api/classes/:id", authenticate, async (req, res) => {
  const { className, section } = req.body;

  await db.run(
    "UPDATE classes SET className=?, section=? WHERE id=?",
    className,
    section,
    req.params.id
  );

  res.json(await db.all("SELECT * FROM classes"));
});

app.delete("/api/classes/:id", authenticate, async (req, res) => {
  await db.run("DELETE FROM classes WHERE id=?", req.params.id);
  await db.run("DELETE FROM allocations WHERE classId=?", req.params.id);
  res.json({ success: true });
});

// -------------------- SUBJECTS --------------------
app.get("/api/subjects", authenticate, async (req, res) => {
  res.json(await db.all("SELECT * FROM subjects"));
});

app.post("/api/subjects", authenticate, async (req, res) => {
  const { id, name, periodsPerWeek } = req.body;

  await db.run(
    "INSERT INTO subjects (id, name, periodsPerWeek) VALUES (?, ?, ?)",
    id,
    name,
    periodsPerWeek
  );

  res.json(await db.all("SELECT * FROM subjects"));
});

app.put("/api/subjects/:id", authenticate, async (req, res) => {
  const { name, periodsPerWeek } = req.body;

  await db.run(
    "UPDATE subjects SET name=?, periodsPerWeek=? WHERE id=?",
    name,
    periodsPerWeek,
    req.params.id
  );

  res.json(await db.all("SELECT * FROM subjects"));
});

app.delete("/api/subjects/:id", authenticate, async (req, res) => {
  await db.run("DELETE FROM subjects WHERE id=?", req.params.id);
  await db.run("DELETE FROM allocations WHERE subjectId=?", req.params.id);
  res.json({ success: true });
});

// -------------------- ALLOCATIONS --------------------
app.get("/api/allocations", authenticate, async (req, res) => {
  res.json(await db.all("SELECT * FROM allocations"));
});

app.post("/api/allocations", authenticate, async (req, res) => {
  const { id, classId, subjectId, teacherId, periods } = req.body;

  await db.run(
    "INSERT INTO allocations (id, classId, subjectId, teacherId, periods) VALUES (?, ?, ?, ?, ?)",
    id,
    classId,
    subjectId,
    teacherId || null,
    periods
  );

  res.json(await db.all("SELECT * FROM allocations"));
});

app.put("/api/allocations/:id", authenticate, async (req, res) => {
  const { classId, subjectId, teacherId, periods } = req.body;

  await db.run(
    "UPDATE allocations SET classId=?, subjectId=?, teacherId=?, periods=? WHERE id=?",
    classId,
    subjectId,
    teacherId || null,
    periods,
    req.params.id
  );

  res.json(await db.all("SELECT * FROM allocations"));
});

app.delete("/api/allocations/:id", authenticate, async (req, res) => {
  await db.run("DELETE FROM allocations WHERE id=?", req.params.id);
  res.json({ success: true });
});

// -------------------- AI TIMETABLE --------------------
function parseWorkingDays(workingDays = "Mon-Fri") {
  const trimmed = workingDays?.trim();
  if (!trimmed) return ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const normalized = trimmed.replace(/\s+/g, "");
  const ordered = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const capitalize = (value) => {
    if (!value) return "";
    const lower = value.toLowerCase();
    if (lower.startsWith("mon")) return "Mon";
    if (lower.startsWith("tue")) return "Tue";
    if (lower.startsWith("wed")) return "Wed";
    if (lower.startsWith("thu")) return "Thu";
    if (lower.startsWith("fri")) return "Fri";
    if (lower.startsWith("sat")) return "Sat";
    if (lower.startsWith("sun")) return "Sun";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  };

  if (/^[A-Za-z]+-[A-Za-z]+$/.test(normalized)) {
    const [start, end] = normalized.split("-");
    const startIndex = ordered.indexOf(capitalize(start));
    const endIndex = ordered.indexOf(capitalize(end));
    if (startIndex >= 0 && endIndex >= 0 && endIndex >= startIndex) {
      return ordered.slice(startIndex, endIndex + 1);
    }
  }

  return normalized
    .split(",")
    .map((day) => capitalize(day.trim()))
    .filter((day) => ordered.includes(day));
}

function buildTimetable({ allocations = [], teachers = [], subjects = [], classes = [], settings = {} }) {
  const days = parseWorkingDays(settings.workingDays || "Mon-Fri");
  const periodsPerDay = Math.max(1, Number(settings.periodsPerDay) || 8);
  const lunchDuration = Math.max(0, Number(settings.lunchDuration) || 0);
  const timetable = {};

  days.forEach((day) => {
    timetable[day] = {};
    for (let period = 1; period <= periodsPerDay; period += 1) {
      timetable[day][period] = [];
    }
  });

  const classMap = new Map(classes.map((item) => [item.id, item]));
  const subjectMap = new Map(subjects.map((item) => [item.id, item]));
  const teacherMap = new Map(teachers.map((item) => [item.id, item]));

  const classUsage = new Map();
  const teacherUsage = new Map();
  const classDayPeriodMap = new Map();
  const teacherDayPeriodMap = new Map();

  const normalizedAllocations = [...allocations]
    .filter((allocation) => allocation.classId && allocation.subjectId)
    .sort((a, b) => Number(b.periods) - Number(a.periods));

  for (const allocation of normalizedAllocations) {
    const subject = subjectMap.get(allocation.subjectId);
    const schoolClass = classMap.get(allocation.classId);
    const teacher = allocation.teacherId ? teacherMap.get(allocation.teacherId) : null;
    const requestedPeriods = Math.max(1, Number(allocation.periods) || 1);

    for (let slot = 0; slot < requestedPeriods; slot += 1) {
      let placed = false;
      for (const day of days) {
        const dayKey = `${day}`;
        for (let period = 1; period <= periodsPerDay; period += 1) {
          const periodKey = `${dayKey}-${period}`;
          const classKey = `${schoolClass?.id ?? "unknown"}-${dayKey}-${period}`;
          const teacherKey = `${teacher?.id ?? "unassigned"}-${dayKey}-${period}`;

          const classBusy = classDayPeriodMap.get(classKey) || false;
          const teacherBusy = teacher && teacherDayPeriodMap.get(teacherKey) ? teacherDayPeriodMap.get(teacherKey) : false;
          const periodUsage = (classUsage.get(schoolClass?.id ?? "unknown") || 0) + 1;
          const teacherPeriodUsage = teacher ? (teacherUsage.get(teacher.id) || 0) + 1 : 0;

          const teacherLimit = teacher ? Number(teacher.workload) || 999 : 999;
          const classCapacity = periodsPerDay * days.length;

          if (!classBusy && (!teacher || !teacherBusy) && periodUsage <= classCapacity && teacherPeriodUsage <= teacherLimit) {
            timetable[day][period].push({
              subject: subject?.name || "Unknown Subject",
              className: schoolClass ? `${schoolClass.className}-${schoolClass.section}` : "Unknown Class",
              teacher: teacher?.name || "Unassigned",
            });
            classDayPeriodMap.set(classKey, true);
            if (teacher) teacherDayPeriodMap.set(teacherKey, true);
            classUsage.set(schoolClass?.id ?? "unknown", periodUsage);
            if (teacher) teacherUsage.set(teacher.id, teacherPeriodUsage);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }

      if (!placed) {
        const fallbackDay = days[0];
        const fallbackPeriod = 1;
        timetable[fallbackDay][fallbackPeriod].push({
          subject: subject?.name || "Unknown Subject",
          className: schoolClass ? `${schoolClass.className}-${schoolClass.section}` : "Unknown Class",
          teacher: teacher?.name || "Unassigned",
        });
      }
    }
  }

  if (lunchDuration > 0) {
    const lunchPeriod = Math.max(1, Math.min(periodsPerDay, Math.floor(periodsPerDay / 2)));
    days.forEach((day) => {
      if (timetable[day][lunchPeriod]) {
        timetable[day][lunchPeriod].push({
          subject: "Lunch",
          className: "Break",
          teacher: "—",
        });
      }
    });
  }

  return timetable;
}

app.post("/api/ai/timetable", authenticate, async (req, res) => {
  try {
    const { allocations = [], teachers = [], subjects = [], classes = [], settings = {}, options = {} } = req.body;
    const result = generateOptimizedTimetable({ allocations, teachers, subjects, classes, settings }, options);
    const timeSlots = buildTimeSlots(settings);

res.json({
  timetable: result.timetable,
  score: result.score,
  meta: result.meta,
  timeSlots,
});
  } catch (error) {
    console.error("TIMETABLE GENERATION ERROR:", error);
    res.status(500).json({ message: "Failed to generate timetable" });
  }
});
app.get("/", (req, res) => {
  res.json({
    message: "AI Timetable Backend is Live 🚀",
    health: "/api/health",
  });
});
// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});