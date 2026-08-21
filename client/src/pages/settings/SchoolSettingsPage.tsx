import { useEffect, useState, useCallback, useMemo } from "react";
import {
  School,
  Clock3,
  CalendarDays,
  Save,
  GraduationCap,
  PlusCircle,
  Trash2,
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
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import api from "../../services/api";
import { useSchoolStore } from "../../store/schoolStore";
import type { SchoolSettings, TimelineEvent } from "../../types/SchoolSettings";
import { LoadingState } from "../../components/common/LoadingState";
import { useToast } from "../../components/ui/ToastProvider";
import { getApiErrorMessage } from "../../utils/errorUtils";
import { v4 as uuidv4 } from "uuid";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ICON_MAP: Record<string, React.ComponentType<any>> = {
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

const ICON_OPTIONS = [
  { key: "School", label: "Assembly / School", icon: School },
  { key: "Utensils", label: "Lunch / Food", icon: Utensils },
  { key: "Coffee", label: "Short Break", icon: Coffee },
  { key: "BookOpen", label: "Study Hour", icon: BookOpen },
  { key: "Dumbbell", label: "Sports / PE", icon: Dumbbell },
  { key: "Music", label: "Music / Arts", icon: Music },
  { key: "FlaskConical", label: "Lab / Science", icon: FlaskConical },
  { key: "Bus", label: "Bus / Arrival", icon: Bus },
  { key: "Target", label: "Club / Activity", icon: Target },
  { key: "FileText", label: "Exam / Quiz", icon: FileText },
  { key: "Users", label: "Meeting / Staff", icon: Users },
  { key: "Landmark", label: "Prayer / Hall", icon: Landmark },
];

const PRESET_EVENT_TYPES = [
  { label: "Assembly", icon: "School", type: "assembly", startTime: "09:00", endTime: "09:15" },
  { label: "Morning Break", icon: "Coffee", type: "break", startTime: "10:45", endTime: "11:00" },
  { label: "Lunch Break", icon: "Utensils", type: "lunch", startTime: "12:30", endTime: "13:15" },
  { label: "Afternoon Break", icon: "Coffee", type: "break", startTime: "14:30", endTime: "14:45" },
  { label: "Sports", icon: "Dumbbell", type: "sports", startTime: "15:00", endTime: "16:00" },
  { label: "Study Hour", icon: "BookOpen", type: "study", startTime: "15:30", endTime: "16:15" },
  { label: "Prayer", icon: "Landmark", type: "prayer", startTime: "08:45", endTime: "09:00" },
  { label: "Exam", icon: "FileText", type: "exam", startTime: "09:30", endTime: "11:30" },
  { label: "Club", icon: "Target", type: "club", startTime: "15:00", endTime: "16:00" },
];

function toMinutes(timeStr: string) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function FieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
    >
      {children}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-slate-500">{children}</p>;
}

function CardHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<any>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600">
        <Icon className="w-[22px] h-[22px]" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function normalizeTimelineEvents(events?: TimelineEvent[] | null): TimelineEvent[] {
  if (!Array.isArray(events)) return [];
  return events.filter(Boolean).map((event, index) => ({
    ...event,
    id: event.id || `event-${index + 1}`,
    title: event.title !== undefined && event.title !== null ? event.title : (event.name ?? ""),
    name: event.name !== undefined && event.name !== null ? event.name : (event.title ?? ""),
    type: event.type || "custom",
    startTime: event.startTime || "",
    endTime: event.endTime || "",
    icon: event.icon || "Clock",
    isTeachingBlocked: event.isTeachingBlocked !== false,
    days: Array.isArray(event.days) ? event.days : [],
  }));
}

function validateTimelineEvents(events: TimelineEvent[], schoolStartTime?: string, schoolEndTime?: string) {
  const errors: string[][] = events.map(() => []);
  const seenNames = new Map<string, number>();
  const schoolStart = toMinutes(schoolStartTime || "");
  const schoolEnd = toMinutes(schoolEndTime || "");

  events.forEach((event, index) => {
    const name = (event.title || event.name || "").trim().toLowerCase();
    const start = toMinutes(event.startTime || "");
    const end = toMinutes(event.endTime || "");

    if (!event.title?.trim() && !event.name?.trim()) {
      errors[index].push("Event name is required.");
    } else if (seenNames.has(name)) {
      errors[index].push("Duplicate event name.");
    } else {
      seenNames.set(name, index);
    }

    if (!event.startTime || !event.endTime) {
      errors[index].push("Start and end times are required.");
    } else if (end <= start) {
      errors[index].push("End time must be after start time.");
    } else if (schoolStart && schoolEnd && (start < schoolStart || end > schoolEnd)) {
      errors[index].push("Event falls outside school hours.");
    }
  });

  events.forEach((event, index) => {
    if (!event.startTime || !event.endTime) return;
    const start = toMinutes(event.startTime);
    const end = toMinutes(event.endTime);
    events.forEach((otherEvent, otherIndex) => {
      if (index === otherIndex || !otherEvent.startTime || !otherEvent.endTime) return;
      const otherStart = toMinutes(otherEvent.startTime);
      const otherEnd = toMinutes(otherEvent.endTime);
      if (start < otherEnd && end > otherStart) {
        if (!errors[index].includes("Overlaps another event.")) {
          errors[index].push("Overlaps another event.");
        }
      }
    });
  });

  return errors;
}

// ─── STABLE TIMELINE EVENT CARD COMPONENT (FIXES CURSOR LOSS FOCUS BUG) ───────────
function EventRowCard({
  event,
  onChange,
  onRemove,
  validationMessages,
}: {
  event: TimelineEvent;
  onChange: (updated: TimelineEvent) => void;
  onRemove: () => void;
  validationMessages?: string[];
}) {
  const EventIcon = ICON_MAP[event.icon || "Clock"] || Clock;

  const startMins = toMinutes(event.startTime);
  const endMins = toMinutes(event.endTime);
  const duration = endMins - startMins;
  const isTimeInvalid = event.startTime && event.endTime && duration <= 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300">
      <div className="flex flex-col gap-4">
        {/* Header Row: Icon, Title, Type, Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            {/* Icon Picker Select */}
            <div className="relative group flex-shrink-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-100">
                <EventIcon size={20} />
              </div>
              <select
                aria-label="Select Event Icon"
                value={event.icon || "Clock"}
                onChange={(e) => onChange({ ...event, icon: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Title Input - STABLE COMPONENT IDENTITY PRESERVES CURSOR FOCUS */}
            <div className="flex-1">
              <input
                type="text"
                value={event.title || ""}
                onChange={(e) => onChange({ ...event, title: e.target.value, name: e.target.value })}
                placeholder="e.g. Morning Assembly"
                className="w-full text-base font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-none py-1 bg-transparent transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Teaching Block Toggle */}
            <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={event.isTeachingBlocked !== false}
                onChange={(e) => onChange({ ...event, isTeachingBlocked: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-700">Block Teaching</span>
            </label>

            {/* Delete Button */}
            <button
              type="button"
              onClick={onRemove}
              className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 transition"
              title="Delete Event"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Form Inputs Grid: Type, Start Time, End Time, Duration indicator */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div>
            <FieldLabel>Event Type</FieldLabel>
            <input
              type="text"
              value={event.type || ""}
              onChange={(e) => onChange({ ...event, type: e.target.value })}
              placeholder="assembly, lunch, break..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div>
            <FieldLabel>Start Time</FieldLabel>
            <input
              type="time"
              value={event.startTime || ""}
              onChange={(e) => onChange({ ...event, startTime: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div>
            <FieldLabel>End Time</FieldLabel>
            <input
              type="time"
              value={event.endTime || ""}
              onChange={(e) => onChange({ ...event, endTime: e.target.value })}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all ${
                isTimeInvalid
                  ? "border-rose-400 focus:ring-rose-100"
                  : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-100"
              }`}
            />
          </div>

          <div className="text-xs font-medium text-slate-500 pb-2.5">
            {duration > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg">
                <Clock size={14} /> {duration} min block
              </span>
            ) : isTimeInvalid ? (
              <span className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                <AlertCircle size={14} /> End time must be after start
              </span>
            ) : (
              <span className="text-slate-400">Set start and end times</span>
            )}
          </div>
        </div>

        {validationMessages && validationMessages.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {validationMessages.map((message) => (
              <div key={message}>{message}</div>
            ))}
          </div>
        )}

        {/* Days Filter Optional Selection */}
        <div className="pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
            Applies To Days (Leave empty for all working days)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_DAYS.map((d) => {
              const isSelected = Array.isArray(event.days) && event.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    const currentDays = Array.isArray(event.days) ? event.days : [];
                    const nextDays = isSelected
                      ? currentDays.filter((x) => x !== d)
                      : [...currentDays, d];
                    onChange({ ...event, days: nextDays });
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SchoolSettingsPage() {
  const setSchoolSettings = useSchoolStore((state) => state.setSchoolSettings);
  const { showToast } = useToast();

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: "",
    academicYear: "",
    startTime: "08:45",
    endTime: "16:00",
    periodsPerDay: "8",
    periodDuration: "45",
    workingDays: "Mon,Tue,Wed,Thu,Fri",
    timelineEvents: [],
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await api.get("/settings");
        const loadedData = response.data?.data || response.data;
        const normalized: SchoolSettings = {
          ...loadedData,
          timelineEvents: Array.isArray(loadedData.timelineEvents)
            ? loadedData.timelineEvents.map((evt: any) => ({
                id: evt.id || uuidv4(),
                title: evt.title || evt.name || "Event",
                type: evt.type || "custom",
                startTime: evt.startTime || "09:00",
                endTime: evt.endTime || "09:30",
                icon: evt.icon || "Clock",
                isTeachingBlocked: evt.isTeachingBlocked !== false,
                days: Array.isArray(evt.days) ? evt.days : [],
              }))
            : [],
        };
        setSettings(normalized);
        setSchoolSettings(normalized);
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, "Unable to load school settings.");
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [setSchoolSettings]);

  const selectedDays = settings.workingDays
    ? settings.workingDays.split(",").map((d) => d.trim())
    : [];

  const timelineEvents = useMemo(
    () => normalizeTimelineEvents(settings.timelineEvents),
    [settings.timelineEvents]
  );
  const timelineValidation = useMemo(
    () => validateTimelineEvents(timelineEvents, settings.startTime, settings.endTime),
    [timelineEvents, settings.startTime, settings.endTime]
  );

  const toggleDay = (day: string) => {
    let updated: string[];
    if (selectedDays.includes(day)) {
      updated = selectedDays.filter((d) => d !== day);
    } else {
      updated = [...selectedDays, day];
    }
    const ordered = ALL_DAYS.filter((d) => updated.includes(d));
    setSettings({ ...settings, workingDays: ordered.join(",") });
  };

  // STABLE EVENT UPDATE HANDLER
  const updateTimelineEvent = useCallback((updatedEvent: TimelineEvent) => {
    setSettings((prev) => {
      const currentEvents = prev.timelineEvents || [];
      const index = currentEvents.findIndex((e) => e.id === updatedEvent.id);
      if (index === -1) return prev;
      const nextEvents = [...currentEvents];
      nextEvents[index] = updatedEvent;
      return { ...prev, timelineEvents: nextEvents };
    });
  }, []);

  const addTimelineEvent = (preset?: { label: string; icon: string; type: string; startTime?: string; endTime?: string }) => {
    let startTime = preset?.startTime || "10:00";
    let endTime = preset?.endTime || "10:15";

    if (!preset?.startTime) {
      const existingEvents = settings.timelineEvents || [];
      if (existingEvents.length > 0) {
        let maxEndMins = 0;
        existingEvents.forEach((e) => {
          const eEnd = toMinutes(e.endTime);
          if (eEnd > maxEndMins) maxEndMins = eEnd;
        });
        if (maxEndMins > 0 && maxEndMins < 24 * 60 - 30) {
          const h = Math.floor(maxEndMins / 60).toString().padStart(2, "0");
          const m = (maxEndMins % 60).toString().padStart(2, "0");
          startTime = `${h}:${m}`;
          const endMins = maxEndMins + 15;
          const eh = Math.floor(endMins / 60).toString().padStart(2, "0");
          const em = (endMins % 60).toString().padStart(2, "0");
          endTime = `${eh}:${em}`;
        }
      }
    }

    const newEvent: TimelineEvent = {
      id: uuidv4(),
      title: preset?.label || "New Event",
      type: preset?.type || "custom",
      startTime,
      endTime,
      icon: preset?.icon || "Clock",
      isTeachingBlocked: true,
      days: [],
    };
    setSettings((prev) => ({
      ...prev,
      timelineEvents: [...(prev.timelineEvents || []), newEvent],
    }));
  };

  const removeTimelineEvent = useCallback((index: number, id?: string) => {
    setSettings((prev) => {
      const list = prev.timelineEvents || [];
      return {
        ...prev,
        timelineEvents: list.filter((e, i) => {
          if (id && e.id) return e.id !== id;
          return i !== index;
        }),
      };
    });
  }, []);

  // Validation
  const validateSettings = (): string | null => {
    if (!settings.schoolName.trim()) return "School name is required.";
    if (!settings.startTime || !settings.endTime) return "School start and end times are required.";
    
    const startMins = toMinutes(settings.startTime);
    const endMins = toMinutes(settings.endTime);
    if (endMins <= startMins) return "School end time must be after start time.";

    const periodsPerDay = Number(settings.periodsPerDay);
    if (!Number.isFinite(periodsPerDay) || periodsPerDay < 1 || periodsPerDay > 15) {
      return "Periods per day must be between 1 and 15.";
    }

    const periodDuration = Number(settings.periodDuration);
    if (!Number.isFinite(periodDuration) || periodDuration < 1 || periodDuration > 180) {
      return "Period duration must be between 1 and 180 minutes.";
    }

    if (!settings.workingDays || selectedDays.length === 0) {
      return "Please select at least one working day.";
    }

    const validationErrors = validateTimelineEvents(timelineEvents, settings.startTime, settings.endTime);
    for (const [index, messages] of validationErrors.entries()) {
      if (messages.length > 0) {
        const label = timelineEvents[index]?.title || timelineEvents[index]?.name || "This event";
        return `${label}: ${messages[0]}`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateSettings();
    if (validationError) {
      setError(validationError);
      showToast("error", validationError);
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setMessage("");
      const response = await api.put("/settings", settings);
      const updatedData = response.data?.data || settings;
      setSchoolSettings(updatedData);
      setMessage("School timeline configuration updated successfully.");
      showToast("success", "School timeline configuration saved successfully.");
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "Unable to save settings.");
      setError(msg);
      showToast("error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">
          School Configuration
        </h1>
        <p className="mt-2 text-slate-500 leading-relaxed">
          Configure school hours, working days, and unified **Daily Timeline Events**. The scheduler will automatically derive teaching slots around your fixed events.
        </p>
      </div>

      <div className="space-y-6 max-w-5xl">
        {isLoading ? (
          <LoadingState
            title="Loading settings"
            message="Fetching school configuration from the server."
            compact
          />
        ) : (
          <>
            <div className="grid gap-6">
              {/* School Information */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <CardHeader
                  icon={School}
                  title="School Information"
                  subtitle="Basic details about your institution."
                />
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="schoolName" required>
                      School Name
                    </FieldLabel>
                    <input
                      id="schoolName"
                      type="text"
                      value={settings.schoolName}
                      onChange={(e) =>
                        setSettings({ ...settings, schoolName: e.target.value })
                      }
                      placeholder="e.g. Springfield Public School"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>Displayed across timetables and exports.</HelperText>
                  </div>
                  <div>
                    <FieldLabel htmlFor="academicYear">Academic Year</FieldLabel>
                    <input
                      id="academicYear"
                      type="text"
                      value={settings.academicYear ?? ""}
                      onChange={(e) =>
                        setSettings({ ...settings, academicYear: e.target.value })
                      }
                      placeholder="e.g. 2025-2026"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>Used in report headers and exports.</HelperText>
                  </div>
                </div>
              </div>

              {/* School Timings & Teaching Slot Config */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <CardHeader
                  icon={Clock3}
                  title="School Operating Timings"
                  subtitle="Define overall operating hours and lesson duration."
                />
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <FieldLabel htmlFor="startTime" required>
                      School Start Time
                    </FieldLabel>
                    <input
                      id="startTime"
                      type="time"
                      value={settings.startTime}
                      onChange={(e) =>
                        setSettings({ ...settings, startTime: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>First bell of the day.</HelperText>
                  </div>
                  <div>
                    <FieldLabel htmlFor="endTime" required>
                      School End Time
                    </FieldLabel>
                    <input
                      id="endTime"
                      type="time"
                      value={settings.endTime}
                      onChange={(e) =>
                        setSettings({ ...settings, endTime: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>Dismissal time.</HelperText>
                  </div>
                  <div>
                    <FieldLabel htmlFor="periodDuration" required>
                      Teaching Period Duration
                    </FieldLabel>
                    <div className="relative">
                      <input
                        id="periodDuration"
                        type="number"
                        min={15}
                        max={180}
                        value={settings.periodDuration}
                        onChange={(e) =>
                          setSettings({ ...settings, periodDuration: e.target.value })
                        }
                        placeholder="45"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-16 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                        min
                      </span>
                    </div>
                    <HelperText>Target length per lesson.</HelperText>
                  </div>
                  <div>
                    <FieldLabel htmlFor="periodsPerDay" required>
                      Target Max Periods
                    </FieldLabel>
                    <input
                      id="periodsPerDay"
                      type="number"
                      min={1}
                      max={15}
                      value={settings.periodsPerDay}
                      onChange={(e) =>
                        setSettings({ ...settings, periodsPerDay: e.target.value })
                      }
                      placeholder="8"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>Max periods limit per day.</HelperText>
                  </div>
                </div>
              </div>

              {/* Working Days */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <CardHeader
                  icon={CalendarDays}
                  title="Working Days"
                  subtitle="Select operating days of the school week."
                />
                <div className="flex flex-wrap gap-3">
                  {ALL_DAYS.map((day) => {
                    const active = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`min-w-[88px] rounded-xl border px-5 py-3.5 text-sm font-semibold transition-all ${
                          active
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UNIFIED DAILY TIMELINE EVENTS MODULE */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles size={20} className="text-indigo-600" />
                      <h2 className="text-xl font-bold text-slate-800">Daily Timeline Events</h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Add assembly, lunch, breaks, sports, labs, or custom activities. Slots are reserved automatically and teaching periods are derived between events.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => addTimelineEvent()}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                  >
                    <PlusCircle size={18} />
                    Add Event
                  </button>
                </div>

                {/* Preset Quick Add Bar */}
                <div className="mb-6 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2.5">
                    Quick Add Common School Events
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_EVENT_TYPES.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => addTimelineEvent(preset)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
                      >
                        <PlusCircle size={14} className="text-indigo-500" />
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Event Cards List */}
                {timelineEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <Clock size={36} className="mx-auto text-slate-400 mb-2" />
                    <h3 className="text-base font-bold text-slate-700">No Timeline Events Defined</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                      Click &quot;Add Event&quot; above or pick a quick preset to add assembly, lunch, breaks, or sports.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timelineEvents.map((evt, idx) => (
                      <EventRowCard
                        key={evt.id}
                        event={evt}
                        onChange={updateTimelineEvent}
                        onRemove={() => removeTimelineEvent(idx, evt.id)}
                        validationMessages={timelineValidation[idx]}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Save Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 pb-4">
                <div className="flex flex-col gap-1">
                  {message && (
                    <div className="inline-flex items-center gap-2 text-emerald-700 text-sm font-medium bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl w-fit">
                      <GraduationCap size={16} />
                      {message}
                    </div>
                  )}
                  {error && (
                    <div className="inline-flex items-center gap-2 text-rose-700 text-sm font-medium bg-rose-50 border border-rose-200 px-4 py-2.5 rounded-xl w-fit">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-4 font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-indigo-800 hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Save size={18} />
                  {isSaving ? "Saving Configuration..." : "Save Configuration"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SchoolSettingsPage;
