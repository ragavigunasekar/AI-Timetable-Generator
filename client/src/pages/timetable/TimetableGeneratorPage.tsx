import { useMemo, useState, useEffect, useCallback, useRef } from "react";

import {
  Trash2,
  LayoutGrid,
  UserRound,
  BookOpen,
  CalendarDays,
  Search,
  Undo2,
  Redo2,
  AlertCircle,
  School,
  Utensils,
  Coffee,
  Dumbbell,
  Music,
  FlaskConical,
  Bus,
  Target,
  FileText,
  Users,
  Landmark,
  Clock,
  Sparkles,
  Lock,
} from "lucide-react";

import {
  useSchoolStore,
  type TimetableEntry as StoreTimetableEntry,
  type TimetableData,
} from "../../store/schoolStore";
import { buildTimeSlots } from "./timetableUtils";
import { parseWorkingDays } from "../../utils/dateUtils";
import { useToast } from "../../components/ui/ToastProvider";
import api from "../../services/api";

type ViewMode = "weekly" | "teacher" | "class" | "subject";
type FlatEntry = StoreTimetableEntry & { day: string; period: number };

const EVENT_ICON_MAP: Record<string, React.ComponentType<any>> = {
  School,
  Utensils,
  Coffee,
  BookOpen,
  Dumbbell,
  Music,
  FlaskConical,
  Bus,
  Target,
  FileText,
  Users,
  Landmark,
  Clock,
};

function getEventIcon(subjectName: string, iconKey?: string) {
  if (iconKey && EVENT_ICON_MAP[iconKey]) return EVENT_ICON_MAP[iconKey];
  const s = (subjectName || "").toLowerCase();
  if (s.includes("assembly")) return School;
  if (s.includes("lunch") || s.includes("food")) return Utensils;
  if (s.includes("break") || s.includes("recess")) return Coffee;
  if (s.includes("sport") || s.includes("pe") || s.includes("game")) return Dumbbell;
  if (s.includes("music") || s.includes("art")) return Music;
  if (s.includes("lab") || s.includes("practical")) return FlaskConical;
  if (s.includes("bus") || s.includes("transport")) return Bus;
  if (s.includes("club") || s.includes("activity")) return Target;
  if (s.includes("exam") || s.includes("test")) return FileText;
  if (s.includes("prayer")) return Landmark;
  return Clock;
}

// ─── Undo/Redo History ─────────────────────────────────────────────────────────
interface HistoryEntry {
  timetable: TimetableData;
  timestamp: number;
}

const MAX_HISTORY = 50;

function useUndoRedo(initial: TimetableData) {
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [present, setPresent] = useState<TimetableData>(initial);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const skipRef = useRef(false);

  const pushState = useCallback((newTimetable: TimetableData) => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    setPast((prev) => {
      const entry: HistoryEntry = { timetable: present, timestamp: Date.now() };
      const next = [...prev, entry];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setPresent(newTimetable);
    setFuture([]);
  }, [present]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [...prev, { timetable: present, timestamp: Date.now() }]);
    skipRef.current = true;
    setPresent(previous.timetable);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture((prev) => prev.slice(0, -1));
    setPast((prev) => [...prev, { timetable: present, timestamp: Date.now() }]);
    skipRef.current = true;
    setPresent(next.timetable);
  }, [future, present]);

  const reset = useCallback((newTimetable: TimetableData) => {
    setPast([]);
    setPresent(newTimetable);
    setFuture([]);
  }, []);

  return {
    present,
    setPresent: (v: TimetableData) => {
      pushState(v);
    },
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

// ─── Conflict Validation ───────────────────────────────────────────────────────
interface DragValidation {
  valid: boolean;
  reason?: string;
}

function validateDrop(
  sourceEntry: StoreTimetableEntry,
  targetDay: string,
  targetPeriod: number,
  timetable: TimetableData,
  days: string[],
  periodsPerDay: number
): DragValidation {
  const targetEntries = timetable[targetDay]?.[targetPeriod] || [];
  const lockedEntry = targetEntries.find((e) => e.locked);
  if (lockedEntry) {
    return { valid: false, reason: `Cannot move to fixed event (${lockedEntry.subject}) slot` };
  }

  // Check target cell is within bounds
  if (targetPeriod < 1 || targetPeriod > periodsPerDay) {
    return { valid: false, reason: "Period out of range" };
  }
  if (!days.includes(targetDay)) {
    return { valid: false, reason: "Invalid day" };
  }

  // Check for teacher double-booking in target cell
  if (sourceEntry.teacher && sourceEntry.teacher !== "—" && sourceEntry.teacher !== "Unassigned") {
    const teacherConflict = targetEntries.find(
      (e) => e.teacher === sourceEntry.teacher && !e.locked
    );
    if (teacherConflict) {
      return {
        valid: false,
        reason: `Teacher ${sourceEntry.teacher} already assigned to ${teacherConflict.subject} in this slot`,
      };
    }
  }

  // Check for class double-booking in target cell
  if (sourceEntry.className) {
    const classConflict = targetEntries.find(
      (e) => e.className === sourceEntry.className && !e.locked
    );
    if (classConflict) {
      return {
        valid: false,
        reason: `Class ${sourceEntry.className} already has ${classConflict.subject} in this slot`,
      };
    }
  }

  return { valid: true };
}

// ─── Badge Colors ──────────────────────────────────────────────────────────────
function badge(subject: string) {
  const s = (subject || "").toLowerCase();
  if (s.includes("math") || s.includes("science") || s.includes("physics") || s.includes("chemistry")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (s.includes("english") || s.includes("language") || s.includes("tamil") || s.includes("hindi")) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (s.includes("art") || s.includes("music") || s.includes("activity")) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

// ─── Entry Card (Draggable) ────────────────────────────────────────────────────
function EntryCard({
  entry,
  onDragStart,
  isConflict,
  conflictReason,
}: {
  entry: StoreTimetableEntry;
  onDragStart?: (e: React.DragEvent, entry: StoreTimetableEntry) => void;
  isConflict?: boolean;
  conflictReason?: string;
}) {
  return (
    <div
      draggable={!entry.locked && !!onDragStart}
      onDragStart={(e) => onDragStart?.(e, entry)}
      className={`rounded-xl border p-3 shadow-sm cursor-grab active:cursor-grabbing transition-all duration-150 ${isConflict
          ? "border-red-400 bg-red-50 ring-2 ring-red-300"
          : badge(entry.subject)
        } ${entry.locked ? "opacity-75 cursor-not-allowed" : "hover:shadow-md"}`}
      title={conflictReason || (entry.locked ? "Fixed Event Slot" : "Drag to move")}
    >
      <div className="font-semibold text-sm">{entry.subject}</div>
      <div className="mt-1 text-xs font-medium">{entry.className}</div>
      <div className="mt-0.5 text-xs opacity-75">{entry.teacher ?? "No Teacher"}</div>
      {isConflict && conflictReason && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-red-600 font-semibold">
          <AlertCircle className="w-3 h-3" />
          {conflictReason}
        </div>
      )}
    </div>
  );
}

// ─── Drop Target Cell ──────────────────────────────────────────────────────────
function DropCell({
  day,
  period,
  entries,
  onDrop,
  onDragEnter,
  onDragOver,
  onDragLeave,
  isDragOver,
  conflictReason,
  onEntryDragStart,
  onClick,
}: {
  day: string;
  period: number;
  entries: StoreTimetableEntry[];
  onDrop: (day: string, period: number, e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  isDragOver: boolean;
  conflictReason?: string;
  onEntryDragStart: (e: React.DragEvent, entry: StoreTimetableEntry, day: string, period: number) => void;
  onClick?: () => void;
}) {
  const nonLocked = entries.filter((e) => !e.locked);
  const locked = entries.filter((e) => e.locked);

  return (
    <td
      className={`border p-2 align-top min-h-[80px] transition-all duration-150 ${isDragOver
          ? conflictReason
            ? "bg-red-100 border-red-400"
            : "bg-indigo-100 border-indigo-400"
          : ""
        }`}
      onDrop={(e) => onDrop(day, period, e)}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => onClick?.()}
    >
      {/* Fixed Timeline Events rendering with Lucide Icons & type-based colors */}
      {locked.map((entry, i) => {
        const EventIcon = getEventIcon(entry.subject, (entry as any).icon);
        const eventType = ((entry as any).eventType || entry.subject || "").toLowerCase();
        let colorClass = "bg-slate-100 border-slate-300 text-slate-700";
        let iconColorClass = "text-slate-500";
        if (eventType.includes("assembly") || eventType === "assembly") {
          colorClass = "bg-indigo-50 border-indigo-200 text-indigo-800";
          iconColorClass = "text-indigo-500";
        } else if (eventType.includes("lunch") || eventType === "lunch") {
          colorClass = "bg-amber-50 border-amber-200 text-amber-800";
          iconColorClass = "text-amber-500";
        } else if (eventType.includes("break") || eventType === "break") {
          colorClass = "bg-sky-50 border-sky-200 text-sky-800";
          iconColorClass = "text-sky-500";
        } else if (eventType.includes("sport") || eventType === "sports") {
          colorClass = "bg-emerald-50 border-emerald-200 text-emerald-800";
          iconColorClass = "text-emerald-500";
        } else if (eventType.includes("prayer") || eventType === "prayer") {
          colorClass = "bg-violet-50 border-violet-200 text-violet-800";
          iconColorClass = "text-violet-500";
        } else if (eventType.includes("exam") || eventType === "exam") {
          colorClass = "bg-rose-50 border-rose-200 text-rose-800";
          iconColorClass = "text-rose-500";
        } else if (eventType.includes("club") || eventType === "club") {
          colorClass = "bg-teal-50 border-teal-200 text-teal-800";
          iconColorClass = "text-teal-500";
        } else if (eventType.includes("meet") || eventType === "meeting") {
          colorClass = "bg-orange-50 border-orange-200 text-orange-800";
          iconColorClass = "text-orange-500";
        }
        return (
          <div
            key={`locked-${i}`}
            className={`rounded-xl border p-2 mb-1 text-xs font-semibold flex items-center gap-1.5 shadow-sm ${colorClass}`}
            title="Fixed Timeline Event — cannot be moved"
          >
            <EventIcon size={14} className={`flex-shrink-0 ${iconColorClass}`} />
            <span className="truncate">{entry.subject}</span>
          </div>
        );
      })}

      {nonLocked.length === 0 && locked.length === 0 ? (
        <span className="text-slate-300 text-xs">Free</span>
      ) : (
        <div className="space-y-1">
          {nonLocked.map((entry, index) => (
            <EntryCard
              key={`${entry.subject}-${entry.className}-${index}`}
              entry={entry}
              onDragStart={(e, en) => onEntryDragStart(e, en, day, period)}
              isConflict={!!conflictReason}
              conflictReason={conflictReason}
            />
          ))}
        </div>
      )}
    </td>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
function TimetableGeneratorPage() {
  const { showToast } = useToast();

  const storeTimetable = useSchoolStore((state) => state.generatedTimetable);
  const setStoreTimetable = useSchoolStore((state) => state.setGeneratedTimetable);
  const settings = useSchoolStore((state) => state.schoolSettings);
  const setSchoolSettings = useSchoolStore((state) => state.setSchoolSettings);
  const allocations = useSchoolStore((state) => state.allocations);
  const setUnplacedAllocations = useSchoolStore((state) => state.setUnplacedAllocations);

  const [view, setView] = useState<ViewMode>("weekly");
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);

  // Drag state
  const [dragSource, setDragSource] = useState<{ entry: StoreTimetableEntry; day: string; period: number } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ day: string; period: number } | null>(null);
  const [dropValidation, setDropValidation] = useState<DragValidation | null>(null);
  const [editingCell, setEditingCell] = useState<{ day: string; period: number } | null>(null);

  // Conflict map: key = "day-period", value = reason string
  const [conflictMap, setConflictMap] = useState<Record<string, string>>({});

  const days = useMemo(() => parseWorkingDays(settings.workingDays), [settings.workingDays]);
  const targetPeriodsPerDay = Number(settings.periodsPerDay) || 8;

  // Build Time Slots with Daily Timeline Events
  const timeSlots = useMemo(() => {
    return buildTimeSlots(settings);
  }, [settings]);

  const teachingSlotsCount = useMemo(() => {
    const derived = timeSlots.filter((s) => s.type === "teaching").length;
    return derived > 0 ? derived : targetPeriodsPerDay;
  }, [timeSlots, targetPeriodsPerDay]);

  // Undo/redo hook
  const { present, setPresent, undo, redo, reset, canUndo, canRedo } = useUndoRedo(storeTimetable);

  // Sync present back to store
  useEffect(() => {
    setStoreTimetable(present);
  }, [present, setStoreTimetable]);

  // Conflict Detection
  const computeConflicts = useCallback((timetable: TimetableData) => {
    const conflicts: Record<string, string> = {};

    for (const day of days) {
      for (let period = 1; period <= teachingSlotsCount; period++) {
        const entries = timetable[day]?.[period] || [];
        const nonLocked = entries.filter((e) => !e.locked);

        // Check teacher double-booking within same cell
        const teacherSet = new Set<string>();
        for (const entry of nonLocked) {
          if (entry.teacher && entry.teacher !== "—" && entry.teacher !== "Unassigned") {
            if (teacherSet.has(entry.teacher)) {
              conflicts[`${day}-${period}`] = `Teacher ${entry.teacher} double-booked`;
            }
            teacherSet.add(entry.teacher);
          }
        }

        // Check class double-booking within same cell
        const classSet = new Set<string>();
        for (const entry of nonLocked) {
          if (entry.className) {
            if (classSet.has(entry.className)) {
              conflicts[`${day}-${period}`] = `Class ${entry.className} double-booked`;
            }
            classSet.add(entry.className);
          }
        }
      }
    }

    setConflictMap(conflicts);
  }, [days, teachingSlotsCount]);

  useEffect(() => {
    computeConflicts(present);
  }, [present, computeConflicts]);

  const setInitialData = useSchoolStore((state) => state.setInitialData);

  // Load latest timetable & school data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsRes, teachersRes, subjectsRes, classesRes, allocationsRes, ttRes] = await Promise.all([
          api.get("/settings"),
          api.get("/teachers"),
          api.get("/subjects"),
          api.get("/classes"),
          api.get("/allocations"),
          api.get("/timetables"),
        ]);

        const settingsData = settingsRes.data?.data || settingsRes.data;
        const teachersData = teachersRes.data?.data || teachersRes.data;
        const subjectsData = subjectsRes.data?.data || subjectsRes.data;
        const classesData = classesRes.data?.data || classesRes.data;
        const allocationsData = allocationsRes.data?.data || allocationsRes.data;

        setInitialData({
          schoolSettings: settingsData,
          teachers: Array.isArray(teachersData) ? teachersData : [],
          subjects: Array.isArray(subjectsData) ? subjectsData : [],
          classes: Array.isArray(classesData) ? classesData : [],
          allocations: Array.isArray(allocationsData) ? allocationsData : [],
        });

        const list = ttRes.data?.data || ttRes.data || [];
        if (list.length > 0) {
          const latest = list[0];
          const singleRes = await api.get(`/timetables/${latest.id}`);
          const data = singleRes.data?.data || singleRes.data;
          if (data?.timetableData) {
            let timetable: TimetableData;
            if (typeof data.timetableData === "string") {
              timetable = JSON.parse(data.timetableData);
            } else {
              timetable = data.timetableData;
            }
            reset(timetable);
          }
        }
      } catch (err) {
        console.error("Failed to load timetable page data:", err);
      }
    };

    loadData();
  }, [reset, setInitialData, setSchoolSettings]);

  // Generate Timetable Action
  const handleGenerate = async () => {
    if (allocations.length === 0) {
      showToast("error", "No allocations found. Add class-subject allocations before generating.");
      return;
    }

    setGenerating(true);
    try {
      const response = await api.post("/ai/timetable", {
        candidateCount: 8,
        localSearchRounds: 6,
      });

      const resData = response.data?.data || response.data;
      if (resData?.timetable) {
        reset(resData.timetable);
        if (resData.unplacedAllocations) {
          setUnplacedAllocations(resData.unplacedAllocations);
        }
        showToast("success", "Timetable generated using Daily Timeline Events!");
      }
    } catch {
      showToast("error", "Failed to generate timetable. Check allocations and settings.");
    } finally {
      setGenerating(false);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (
    e: React.DragEvent,
    entry: StoreTimetableEntry,
    day: string,
    period: number
  ) => {
    if (entry.locked) return;
    setDragSource({ entry, day, period });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (day: string, period: number) => {
    if (!dragSource) return;
    setDragOverCell({ day, period });
    const validation = validateDrop(
      dragSource.entry,
      day,
      period,
      present,
      days,
      teachingSlotsCount
    );
    setDropValidation(validation);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dropValidation?.valid ? "move" : "none";
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
    setDropValidation(null);
  };

  const handleDrop = (targetDay: string, targetPeriod: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCell(null);

    if (!dragSource) return;

    const validation = validateDrop(
      dragSource.entry,
      targetDay,
      targetPeriod,
      present,
      days,
      teachingSlotsCount
    );

    if (!validation.valid) {
      showToast("error", validation.reason || "Invalid move");
      setDragSource(null);
      setDropValidation(null);
      return;
    }

    const { entry, day: srcDay, period: srcPeriod } = dragSource;

    if (srcDay === targetDay && srcPeriod === targetPeriod) {
      setDragSource(null);
      setDropValidation(null);
      return;
    }

    const newTimetable = JSON.parse(JSON.stringify(present)) as TimetableData;

    // Remove from source cell
    const srcEntries = newTimetable[srcDay]?.[srcPeriod] || [];
    const srcIdx = srcEntries.findIndex(
      (e) => e.subject === entry.subject && e.className === entry.className && e.teacher === entry.teacher
    );
    if (srcIdx !== -1) {
      srcEntries.splice(srcIdx, 1);
    }

    // Add to target cell
    if (!newTimetable[targetDay]) newTimetable[targetDay] = {};
    if (!newTimetable[targetDay][targetPeriod]) newTimetable[targetDay][targetPeriod] = [];
    newTimetable[targetDay][targetPeriod].push(entry);

    setPresent(newTimetable);
    setDragSource(null);
    setDropValidation(null);
    showToast("success", "Entry moved successfully.");
  };

  // Flat Entries for teacher/class/subject views
  const allEntries = useMemo<FlatEntry[]>(() => {
    const arr: FlatEntry[] = [];
    days.forEach((day) => {
      for (let period = 1; period <= teachingSlotsCount; period++) {
        const entries = present?.[day]?.[period] ?? [];
        entries.filter((e) => !e.locked).forEach((e) => arr.push({ ...e, day, period }));
      }
    });
    return arr;
  }, [present, days, teachingSlotsCount]);

  const plannerMetrics = useMemo(() => {
    const scheduledLessons = allEntries.length;
    const activeTeachers = new Set(allEntries.map((entry) => entry.teacher).filter((v): v is string => Boolean(v && v !== "Unassigned" && v !== "—"))).size;
    const activeClasses = new Set(allEntries.map((entry) => entry.className).filter(Boolean)).size;
    const activeSubjects = new Set(allEntries.map((entry) => entry.subject).filter(Boolean)).size;

    return {
      scheduledLessons,
      activeTeachers,
      activeClasses,
      activeSubjects,
    };
  }, [allEntries]);

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Timetable Generator
          </h1>
          <p className="mt-1.5 text-slate-500">
            Smart timetable solver aligned with your Daily Timeline Events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            title="Undo"
          >
            <Undo2 size={16} /> Undo
          </button>

          <button
            onClick={redo}
            disabled={!canRedo}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            title="Redo"
          >
            <Redo2 size={16} /> Redo
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-2.5 font-semibold text-white shadow hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-60 transition"
          >
            <Sparkles size={18} />
            {generating ? "Solving Timetable..." : "Generate Timetable"}
          </button>
        </div>
      </div>

      {/* View Switcher Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        {[
          { key: "weekly" as ViewMode, label: "Weekly Schedule", icon: CalendarDays },
          { key: "teacher" as ViewMode, label: "Teacher View", icon: UserRound },
          { key: "class" as ViewMode, label: "Class View", icon: LayoutGrid },
          { key: "subject" as ViewMode, label: "Subject View", icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 transition ${view === tab.key ? "bg-indigo-600 text-white" : "bg-white hover:bg-slate-100"
                }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 rounded-xl border bg-white px-3">
          <Search size={16} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${view}`}
            className="bg-transparent py-2 outline-none"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-2xs">
          <div className="text-sm text-slate-500">Teachers Scheduled</div>
          <div className="mt-2 text-3xl font-bold text-slate-800">{plannerMetrics.activeTeachers}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-2xs">
          <div className="text-sm text-slate-500">Classes Covered</div>
          <div className="mt-2 text-3xl font-bold text-slate-800">{plannerMetrics.activeClasses}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-2xs">
          <div className="text-sm text-slate-500">Subjects Active</div>
          <div className="mt-2 text-3xl font-bold text-slate-800">{plannerMetrics.activeSubjects}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-2xs">
          <div className="text-sm text-slate-500">Scheduled Lessons</div>
          <div className="mt-2 text-3xl font-bold text-slate-800">{plannerMetrics.scheduledLessons}</div>
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="overflow-hidden rounded-3xl border bg-white shadow">
        {view === "weekly" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border p-3 text-left font-semibold text-slate-700">Time & Event Slots</th>
                  {days.map((day) => (
                    <th key={day} className="border p-3 text-center font-semibold text-slate-700">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot, rowIndex) => {
                  const isFixedSlot = slot.type === "fixed";
                  const periodNum = slot.period || rowIndex + 1;

                  return (
                    <tr key={slot.id || rowIndex} className={isFixedSlot ? "bg-slate-50/80" : ""}>
                      {/* Slot Header Label */}
                      <td className={`border p-3 font-medium min-w-[160px] ${isFixedSlot ? "bg-slate-50" : ""}`}>
                        <div className="flex items-center gap-1.5">
                          {isFixedSlot ? (
                            <>
                              {(() => {
                                const SlotIcon = slot.icon ? EVENT_ICON_MAP[slot.icon] || Clock : Clock;
                                return <SlotIcon size={14} className="text-indigo-500 flex-shrink-0" />;
                              })()}
                              <span className="font-semibold text-indigo-700">{slot.label}</span>
                              <span className="ml-1 text-[10px] font-semibold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md border border-amber-200">Fixed</span>
                            </>
                          ) : (
                            <span className="font-semibold text-slate-800">{slot.label}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {slot.start} - {slot.end}
                        </div>
                      </td>

                      {/* Day Columns */}
                      {days.map((day) => {
                        const entries = present?.[day]?.[periodNum] ?? [];
                        const cellKey = `${day}-${periodNum}`;
                        const isOver = dragOverCell?.day === day && dragOverCell?.period === periodNum;
                        const cellConflict = conflictMap[cellKey];

                        return (
                          <DropCell
                            key={cellKey}
                            day={day}
                            period={periodNum}
                            entries={entries}
                            onDrop={handleDrop}
                            onDragEnter={() => handleDragEnter(day, periodNum)}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            isDragOver={isOver}
                            conflictReason={isOver ? dropValidation?.reason || cellConflict : cellConflict}
                            onEntryDragStart={handleDragStart}
                            onClick={() => setEditingCell({ day, period: periodNum })}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6 p-6">
            {[...new Set(allEntries.map((entry) =>
              view === "teacher" ? entry.teacher : view === "class" ? entry.className : entry.subject
            ).filter((item): item is string => Boolean(item)))]
              .filter((item) => item.toLowerCase().includes(search.toLowerCase()))
              .sort()
              .map((item) => (
                <div key={item} className="rounded-2xl border p-5">
                  <h2 className="mb-4 text-xl font-bold text-slate-800">{item}</h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {allEntries
                      .filter((entry) =>
                        view === "teacher" ? entry.teacher === item : view === "class" ? entry.className === item : entry.subject === item
                      )
                      .map((entry, index) => (
                        <div key={index} className="rounded-xl border bg-slate-50 p-4">
                          <div className="font-semibold text-slate-700">{entry.day}</div>
                          <div className="text-sm text-slate-500">Period {entry.period}</div>
                          <div className="mt-3">
                            <EntryCard entry={entry} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Cell Editor Modal */}
      {editingCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setEditingCell(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">{editingCell.day} — Slot {editingCell.period}</div>
                <div className="text-xs text-slate-400 mt-0.5">Click entry to remove, or clear slot</div>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
              {(() => {
                const cellEntries = present[editingCell.day]?.[editingCell.period] ?? [];
                const nonLocked = cellEntries.filter((e) => !e.locked);
                if (cellEntries.length === 0) {
                  return (
                    <div className="text-sm text-slate-400 text-center py-6">
                      Empty slot — drag an allocation here to fill it.
                    </div>
                  );
                }
                return cellEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between rounded-xl border p-3 ${entry.locked ? "bg-slate-50 border-slate-200" : badge(entry.subject)
                      }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-sm">{entry.subject}</div>
                      <div className="text-xs text-slate-600">{entry.className}</div>
                      <div className="text-xs text-slate-400">{entry.teacher ?? "No Teacher"}</div>
                      {entry.locked && (
                        <div className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Fixed Timeline Event
                        </div>
                      )}
                    </div>
                    {!entry.locked && (
                      <button
                        onClick={() => {
                          const next = JSON.parse(JSON.stringify(present)) as TimetableData;
                          next[editingCell.day][editingCell.period].splice(idx, 1);
                          setPresent(next);
                          if (nonLocked.length <= 1) setEditingCell(null);
                        }}
                        className="ml-3 flex-shrink-0 rounded-lg border border-red-200 bg-red-50 p-2 text-red-500 hover:bg-red-100 transition"
                        title="Remove this allocation"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t bg-slate-50 flex justify-between gap-2">
              <button
                onClick={() => {
                  const next = JSON.parse(JSON.stringify(present)) as TimetableData;
                  const kept = (next[editingCell.day]?.[editingCell.period] ?? []).filter(
                    (e: StoreTimetableEntry) => e.locked
                  );
                  next[editingCell.day][editingCell.period] = kept;
                  setPresent(next);
                  setEditingCell(null);
                }}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
              >
                Clear Slot
              </button>
              <button
                onClick={() => setEditingCell(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimetableGeneratorPage;