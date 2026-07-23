import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

import {
  Download,
  Trash2,
  LayoutGrid,
  UserRound,
  BookOpen,
  CalendarDays,
  Search,
  Save,
  Undo2,
  Redo2,
  RotateCcw,
  AlertCircle,
} from "lucide-react";

import {
  useSchoolStore,
  type TimetableEntry as StoreTimetableEntry,
  type TimetableData,
} from "../../store/schoolStore";
import { formatTimeLabel } from "./timetableUtils";
import { parseWorkingDays } from "../../utils/dateUtils";
import { useToast } from "../../components/ui/ToastProvider";
import api from "../../services/api";

type ViewMode = "weekly" | "teacher" | "class" | "subject";
type FlatEntry = StoreTimetableEntry & { day: string; period: number };
type ExportFormat = "csv" | "excel" | "pdf";

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
  periodsPerDay: number,
  lunchPeriod: number | null,
  settings: any
): DragValidation {
  // Check locked periods
  if (lunchPeriod !== null && targetPeriod === lunchPeriod) {
    return { valid: false, reason: "Cannot move to lunch period" };
  }
  if (settings?.assemblyPeriod && targetPeriod === Number(settings.assemblyPeriod)) {
    return { valid: false, reason: "Cannot move to assembly period" };
  }
  if (settings?.prayerPeriod && targetPeriod === Number(settings.prayerPeriod)) {
    return { valid: false, reason: "Cannot move to prayer period" };
  }

  // Check target cell is within bounds
  if (targetPeriod < 1 || targetPeriod > periodsPerDay) {
    return { valid: false, reason: "Period out of range" };
  }
  if (!days.includes(targetDay)) {
    return { valid: false, reason: "Invalid day" };
  }

  // Check for teacher double-booking in target cell
  const targetEntries = timetable[targetDay]?.[targetPeriod] || [];
  if (sourceEntry.teacher) {
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
  const s = subject.toLowerCase();
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
        } ${entry.locked ? "opacity-60 cursor-not-allowed" : "hover:shadow-md"}`}
      title={conflictReason || (entry.locked ? "Locked slot" : "Drag to move")}
    >
      <div className="font-semibold text-sm">{entry.subject}</div>
      <div className="mt-1 text-xs">{entry.className}</div>
      <div className="mt-1 text-xs opacity-70">{entry.teacher ?? "No Teacher"}</div>
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
      {locked.map((entry, i) => (
        <div
          key={`locked-${i}`}
          className="rounded-lg bg-slate-100 border border-slate-200 px-2 py-1 mb-1 text-xs text-slate-500 font-semibold text-center"
        >
          {entry.subject}
        </div>
      ))}
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
  const navigate = useNavigate();
  const { showToast } = useToast();

  const storeTimetable = useSchoolStore((state) => state.generatedTimetable);
  const setStoreTimetable = useSchoolStore((state) => state.setGeneratedTimetable);
  const clearStoreTimetable = useSchoolStore((state) => state.clearGeneratedTimetable);
  const settings = useSchoolStore((state) => state.schoolSettings);
  const unplacedAllocations = useSchoolStore((state) => state.unplacedAllocations);

  const [view, setView] = useState<ViewMode>("weekly");
  const [search, setSearch] = useState("");
  const [activeExport, setActiveExport] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [savedTimetables, setSavedTimetables] = useState<Array<{ id: string; updatedAt: string }>>([]);
  const [activeTimetableId, setActiveTimetableId] = useState<string | null>(null);
  const [autoSaveTimer, setAutoSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedData = useRef<string>("");
  const isInitialMount = useRef(true);

  // Drag state
  const [dragSource, setDragSource] = useState<{ entry: StoreTimetableEntry; day: string; period: number } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ day: string; period: number } | null>(null);
  const [dropValidation, setDropValidation] = useState<DragValidation | null>(null);
  const [editingCell, setEditingCell] = useState<{ day: string; period: number } | null>(null);

  // Conflict map: key = "day-period", value = reason string
  const [conflictMap, setConflictMap] = useState<Record<string, string>>({});

  const days = useMemo(() => parseWorkingDays(settings.workingDays), [settings.workingDays]);
  const periodsPerDay = Number(settings.periodsPerDay) || 8;
  const lunchPosition = Number(settings.lunchPosition) || 0;
  const lunchPeriod = lunchPosition > 0 && lunchPosition <= periodsPerDay ? lunchPosition : null;

  const timetableExists = Object.keys(storeTimetable).length > 0;

  // Undo/redo hook
  const { present, setPresent, undo, redo, reset, canUndo, canRedo } = useUndoRedo(storeTimetable);

  // Sync present back to store
  useEffect(() => {
    setStoreTimetable(present);
  }, [present, setStoreTimetable]);

  // ─── Conflict Detection ───────────────────────────────────────────────────
  const computeConflicts = useCallback((timetable: TimetableData) => {
    const conflicts: Record<string, string> = {};

    for (const day of days) {
      for (let period = 1; period <= periodsPerDay; period++) {
        const entries = timetable[day]?.[period] || [];
        const nonLocked = entries.filter((e) => !e.locked);

        // Check teacher double-booking within same cell
        const teacherSet = new Set<string>();
        for (const entry of nonLocked) {
          if (entry.teacher) {
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
  }, [days, periodsPerDay]);

  // Recompute conflicts whenever timetable changes
  useEffect(() => {
    computeConflicts(present);
  }, [present, computeConflicts]);

  // ─── Load Saved Timetable ─────────────────────────────────────────────────
  const handleLoad = useCallback(async (id: string) => {
    setFetching(true);
    try {
      const response = await api.get(`/timetables/${id}`);
      const data = response.data;
      let timetable: TimetableData;
      if (typeof data.timetableData === "string") {
        timetable = JSON.parse(data.timetableData);
      } else {
        timetable = data.timetableData;
      }
      reset(timetable);
      setActiveTimetableId(data.id);
      lastSavedData.current = JSON.stringify(timetable);
      showToast("success", "Timetable loaded.");
    } catch {
      showToast("error", "Failed to load timetable.");
    } finally {
      setFetching(false);
    }
  }, [reset, showToast]);

  // ─── Load Saved Timetables ────────────────────────────────────────────────
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const response = await api.get("/timetables");
        const timetables = response.data || [];
        setSavedTimetables(timetables);

        // Auto-load most recent if store is empty
        if (timetables.length > 0 && !timetableExists) {
          await handleLoad(timetables[0].id);
        }
      } catch {
        // Silently fail - saved timetables are optional
      }
    };
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto-Save ────────────────────────────────────────────────────────────
  const autoSave = useCallback(async (timetable: TimetableData) => {
    if (!activeTimetableId) return;
    const currentDataStr = JSON.stringify(timetable);
    if (lastSavedData.current === currentDataStr) return; // Prevent duplicate if unchanged

    setSaving(true);
    try {
      await api.put(`/timetables/${activeTimetableId}`, { timetableData: timetable });
      lastSavedData.current = currentDataStr;
    } catch {
      // Silent fail for auto-save
    } finally {
      setSaving(false);
    }
  }, [activeTimetableId]);

  // Debounced auto-save
  useEffect(() => {
    if (!activeTimetableId || !timetableExists) return;

    // Skip on initial mount to avoid saving what we just loaded
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const timer = setTimeout(() => {
      autoSave(present);
    }, 2000);
    setAutoSaveTimer(timer);
    return () => clearTimeout(timer);
  }, [present, activeTimetableId, timetableExists, autoSave]);

  // ─── Manual Save ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    const currentDataStr = JSON.stringify(present);
    if (activeTimetableId && lastSavedData.current === currentDataStr) {
      showToast("success", "Timetable is already up to date.");
      return;
    }

    setSaving(true);
    try {
      const id = activeTimetableId || `tt-${Date.now()}`;
      if (activeTimetableId) {
        await api.put(`/timetables/${id}`, { timetableData: present });
      } else {
        await api.post("/timetables", { id, timetableData: present });
        setActiveTimetableId(id);
      }
      lastSavedData.current = currentDataStr;
      showToast("success", "Timetable saved successfully.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save timetable";
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Reset / Clear ────────────────────────────────────────────────────────
  const handleClear = () => {
    clearStoreTimetable();
    reset({});
    setActiveTimetableId(null);
    navigate("/allocations");
  };

  // ─── Drag & Drop Handlers ─────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, entry: StoreTimetableEntry, sourceDay: string, sourcePeriod: number) => {
    setDragSource({ entry, day: sourceDay, period: sourcePeriod });
    e.dataTransfer.setData("text/plain", JSON.stringify({ day: sourceDay, period: sourcePeriod }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (day: string, period: number) => {
    setDragOverCell({ day, period });
    if (dragSource) {
      const validation = validateDrop(
        dragSource.entry,
        day,
        period,
        present,
        days,
        periodsPerDay,
        lunchPeriod,
        settings
      );
      setDropValidation(validation);
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
    setDropValidation(null);
  };

  const handleDrop = (targetDay: string, targetPeriod: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCell(null);

    if (!dragSource) return;
    if (dragSource.day === targetDay && dragSource.period === targetPeriod) {
      setDragSource(null);
      return;
    }

    const validation = validateDrop(
      dragSource.entry,
      targetDay,
      targetPeriod,
      present,
      days,
      periodsPerDay,
      lunchPeriod,
      settings
    );

    if (!validation.valid) {
      showToast("error", validation.reason || "Invalid move");
      setDragSource(null);
      setDropValidation(null);
      return;
    }

    // Deep-clone present so we never mutate React state directly.
    const newTimetable = JSON.parse(JSON.stringify(present)) as TimetableData;

    // Remove from source — access the array through the clone so splice
    // always acts on the live reference, not a detached [] fallback.
    if (!newTimetable[dragSource.day]) newTimetable[dragSource.day] = {};
    if (!newTimetable[dragSource.day][dragSource.period]) newTimetable[dragSource.day][dragSource.period] = [];
    const sourceArr = newTimetable[dragSource.day][dragSource.period];
    const entryIndex = sourceArr.findIndex(
      (e) =>
        e.subject === dragSource.entry.subject &&
        e.className === dragSource.entry.className &&
        e.teacher === dragSource.entry.teacher
    );
    if (entryIndex >= 0) {
      sourceArr.splice(entryIndex, 1);
    }

    // Add to target
    if (!newTimetable[targetDay]) newTimetable[targetDay] = {};
    if (!newTimetable[targetDay][targetPeriod]) newTimetable[targetDay][targetPeriod] = [];
    newTimetable[targetDay][targetPeriod].push({ ...dragSource.entry });

    setPresent(newTimetable);
    setDragSource(null);
    setDropValidation(null);
    showToast("success", "Entry moved successfully.");
  };

  // ─── Time Slots ───────────────────────────────────────────────────────────
  const timeSlots = useMemo(() => {
    const hour = Number(settings.startTime?.split(":")[0] ?? 8);
    const minute = Number(settings.startTime?.split(":")[1] ?? 45);
    const duration = Number(settings.periodDuration) || 45;
    let current = hour * 60 + minute;
    const slots: { label: string; start: string; end: string }[] = [];

    for (let i = 1; i <= periodsPerDay; i++) {
      const end = current + duration;
      slots.push({
        label: `Period ${i}`,
        start: formatTimeLabel(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`),
        end: formatTimeLabel(`${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`),
      });
      current = end;
    }
    return slots;
  }, [settings.startTime, settings.periodDuration, periodsPerDay]);

  // ─── Flat Entries ─────────────────────────────────────────────────────────
  const allEntries = useMemo<FlatEntry[]>(() => {
    const arr: FlatEntry[] = [];
    days.forEach((day) => {
      for (let period = 1; period <= periodsPerDay; period++) {
        const entries = present?.[day]?.[period] ?? [];
        entries.filter((e) => !e.locked).forEach((e) => arr.push({ ...e, day, period }));
      }
    });
    return arr;
  }, [present, days, periodsPerDay]);

  const teacherCount = new Set(allEntries.map((e) => e.teacher)).size;
  const classCount = new Set(allEntries.map((e) => e.className)).size;
  const subjectCount = new Set(allEntries.map((e) => e.subject)).size;

  // ─── Export ───────────────────────────────────────────────────────────────
  const buildCellDisplay = (entries: StoreTimetableEntry[]): string =>
    entries
      .filter((e) => !e.locked)
      .map((e) => `${e.subject} | ${e.className} | ${e.teacher ?? "No Teacher"}`)
      .join(" / ");

  const escapeRfc4180Field = (field: string): string => `"${field.replace(/"/g, '""').replace(/\r?\n/g, "\r\n")}"`;

  const buildExportRows = (): string[][] => {
    const rows: string[][] = [["Period", "Time Slot", ...days]];
    for (let period = 1; period <= periodsPerDay; period++) {
      const slot = timeSlots[period - 1];
      const row = [String(period), `${slot?.start ?? ""} - ${slot?.end ?? ""}`];
      for (const day of days) {
        row.push(buildCellDisplay(present?.[day]?.[period] ?? []));
      }
      rows.push(row);
    }
    return rows;
  };

  const exportCSV = async () => {
    setExportError("");
    setActiveExport("csv");
    try {
      const rows = buildExportRows();
      const csv = rows.map((row) => row.map((cell) => escapeRfc4180Field(cell)).join(",")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "generated-timetable.csv";
      a.click();
      URL.revokeObjectURL(url);
      showToast("success", "CSV exported successfully.");
    } catch {
      setExportError("CSV export failed. Please try again.");
      showToast("error", "CSV export failed.");
    } finally {
      setActiveExport(null);
    }
  };

  const exportExcel = async () => {
    setExportError("");
    setActiveExport("excel");
    try {
      const rows = buildExportRows();
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Timetable");
      XLSX.writeFile(workbook, "generated-timetable.xlsx");
      showToast("success", "Excel exported successfully.");
    } catch {
      setExportError("Excel export failed. Please try again.");
      showToast("error", "Excel export failed.");
    } finally {
      setActiveExport(null);
    }
  };

  const exportPDF = async () => {
    setExportError("");
    setActiveExport("pdf");
    try {
      const rows = buildExportRows();
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const margin = 32;
      let y = margin;
      doc.setFontSize(14);
      doc.text(`${settings.schoolName} Timetable`, margin, y);
      y += 20;
      doc.setFontSize(9);
      rows.forEach((row) => {
        const line = row.join(" | ");
        const lines = doc.splitTextToSize(line, 780);
        lines.forEach((entryLine: string) => {
          if (y > 560) { doc.addPage(); y = margin; }
          doc.text(entryLine, margin, y);
          y += 14;
        });
      });
      doc.save("generated-timetable.pdf");
      showToast("success", "PDF exported successfully.");
    } catch {
      setExportError("PDF export failed. Please try again.");
      showToast("error", "PDF export failed.");
    } finally {
      setActiveExport(null);
    }
  };

  // ─── Empty State ──────────────────────────────────────────────────────────
  if (!timetableExists) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold">No Timetable Generated</h2>
          <p className="mt-2 text-slate-500">Generate a timetable first or load a saved one.</p>

          {/* Saved timetables list */}
          {savedTimetables.length > 0 && (
            <div className="mt-6 text-left">
              <h3 className="text-sm font-bold text-slate-700 mb-2">Saved Timetables</h3>
              <div className="space-y-2">
                {savedTimetables.map((tt) => (
                  <button
                    key={tt.id}
                    onClick={() => handleLoad(tt.id)}
                    className="w-full text-left rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50 transition text-sm"
                  >
                    <span className="font-semibold">{tt.id}</span>
                    <span className="text-slate-400 ml-2">
                      ({new Date(tt.updatedAt).toLocaleDateString()})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => navigate("/allocations")}
            className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 text-white font-bold hover:bg-indigo-700"
          >
            Go to Allocations
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Generated Timetable
            {fetching && <span className="text-sm font-normal text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Loading...</span>}
          </h1>
          <p className="text-slate-500">{settings.schoolName}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Undo/Redo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo2 size={18} />
          </button>

          {/* Save */}
          <div className="flex items-center gap-2">
            {activeTimetableId && JSON.stringify(present) !== lastSavedData.current && (
              <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                Unsaved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || fetching}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-70"
            >
              <Save size={18} />
              {saving ? "Saving..." : "Save Timetable"}
            </button>
          </div>

          {/* Export */}
          <button
            onClick={() => void exportCSV()}
            disabled={activeExport !== null}
            className="rounded-xl border px-3 py-2 hover:bg-slate-100"
            title="Export CSV"
          >
            {activeExport === "csv" ? "..." : <Download size={18} />}
          </button>
          <button
            onClick={() => void exportExcel()}
            disabled={activeExport !== null}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-100"
          >
            {activeExport === "excel" ? "..." : "Excel"}
          </button>
          <button
            onClick={() => void exportPDF()}
            disabled={activeExport !== null}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-100"
          >
            {activeExport === "pdf" ? "..." : "PDF"}
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            className="rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            title="Clear timetable"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {exportError && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {exportError}
        </div>
      )}

      {/* Conflict Summary */}
      {Object.keys(conflictMap).length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <AlertCircle className="w-4 h-4" />
            {Object.keys(conflictMap).length} conflict(s) detected. Drag entries to resolve.
          </div>
          <div className="mt-1 text-xs text-amber-700">
            {Object.entries(conflictMap).map(([key, reason]) => (
              <div key={key}>{key}: {reason}</div>
            ))}
          </div>
        </div>
      )}

      {/* Unplaced Allocations */}
      {unplacedAllocations && unplacedAllocations.length > 0 && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
            <AlertCircle className="w-4 h-4" />
            {unplacedAllocations.length} unplaced allocation(s) detected. The AI could not fit these without causing clashes.
          </div>
          <div className="mt-2 text-xs text-rose-700 space-y-1">
            {unplacedAllocations.map((conflict: any, idx: number) => (
              <div key={idx} className="flex gap-2">
                <span className="font-medium">{conflict.className}</span> -
                <span className="font-medium">{conflict.subjectName}</span>
                ({conflict.teacherName}):
                <span className="text-rose-600">{conflict.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border bg-slate-50 p-2">
        {[
          { key: "weekly" as ViewMode, label: "Weekly", icon: LayoutGrid },
          { key: "teacher" as ViewMode, label: "Teacher", icon: UserRound },
          { key: "class" as ViewMode, label: "Class", icon: BookOpen },
          { key: "subject" as ViewMode, label: "Subject", icon: CalendarDays },
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

      {/* Statistics */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">Teachers</div>
          <div className="mt-2 text-3xl font-bold">{teacherCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">Classes</div>
          <div className="mt-2 text-3xl font-bold">{classCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">Subjects</div>
          <div className="mt-2 text-3xl font-bold">{subjectCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">Total Slots</div>
          <div className="mt-2 text-3xl font-bold">{allEntries.length}</div>
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="overflow-hidden rounded-3xl border bg-white shadow">
        {view === "weekly" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border p-3">Time</th>
                  {days.map((day) => (
                    <th key={day} className="border p-3">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((period, rowIndex) => (
                  <tr key={period}>
                    <td className="border p-3 font-medium">
                      <div>{timeSlots[rowIndex].label}</div>
                      <div className="text-xs text-slate-500">
                        {timeSlots[rowIndex].start} - {timeSlots[rowIndex].end}
                      </div>
                    </td>
                    {days.map((day) => {
                      const entries = present?.[day]?.[period] ?? [];
                      const cellKey = `${day}-${period}`;
                      const isOver = dragOverCell?.day === day && dragOverCell?.period === period;
                      const cellConflict = conflictMap[cellKey];

                      return (
                        <DropCell
                          key={cellKey}
                          day={day}
                          period={period}
                          entries={entries}
                          onDrop={handleDrop}
                          onDragEnter={() => handleDragEnter(day, period)}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          isDragOver={isOver}
                          conflictReason={isOver ? dropValidation?.reason || cellConflict : cellConflict}
                          onEntryDragStart={handleDragStart}
                          onClick={() => setEditingCell({ day, period })}
                        />
                      );
                    })}
                  </tr>
                ))}
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
                  <h2 className="mb-4 text-xl font-bold">{item}</h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {allEntries
                      .filter((entry) =>
                        view === "teacher" ? entry.teacher === item : view === "class" ? entry.className === item : entry.subject === item
                      )
                      .map((entry, index) => (
                        <div key={index} className="rounded-xl border bg-slate-50 p-4">
                          <div className="font-semibold">{entry.day}</div>
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

      {/* Auto-save indicator */}
      {activeTimetableId && (
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <RotateCcw className={`w-3 h-3 ${saving ? "animate-spin" : ""}`} />
          {saving ? "Saving..." : "Auto-save enabled"}
        </div>
      )}

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
                <div className="font-bold text-slate-800">{editingCell.day} — Period {editingCell.period}</div>
                <div className="text-xs text-slate-400 mt-0.5">Click an entry to remove it, or clear the entire slot</div>
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
                        <div className="text-[10px] text-amber-600 font-semibold mt-1">🔒 Locked</div>
                      )}
                    </div>
                    {!entry.locked && (
                      <button
                        onClick={() => {
                          const next = JSON.parse(JSON.stringify(present)) as TimetableData;
                          next[editingCell.day][editingCell.period].splice(idx, 1);
                          setPresent(next);
                          // Close modal only if slot is now empty
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