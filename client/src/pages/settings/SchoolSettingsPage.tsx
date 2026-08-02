import { useEffect, useState } from "react";
import {
  School,
  Clock3,
  CalendarDays,
  UtensilsCrossed,
  Landmark,
  Save,
  GraduationCap,
  Coffee,
  PlusCircle,
  Trash2,
} from "lucide-react";
import api from "../../services/api";
import { useSchoolStore } from "../../store/schoolStore";
import type { SchoolSettings } from "../../types/SchoolSettings";
import { LoadingState } from "../../components/common/LoadingState";
import { useToast } from "../../components/ui/ToastProvider";
import { getApiErrorMessage } from "../../utils/errorUtils";

const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

function SchoolSettingsPage() {
  const setSchoolSettings = useSchoolStore((state) => state.setSchoolSettings);
  const { showToast } = useToast();

  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: "",
    academicYear: "",
    startTime: "",
    endTime: "",
    periodsPerDay: "",
    periodDuration: "",
    workingDays: "",
    shortBreaks: "",
    shortBreakDuration: "",
    lunchDuration: "",
    lunchPosition: "",
    assemblyPeriod: "",
    prayerPeriod: "",
    breakPositions: "",
    breakDurations: "",
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
        setSettings(response.data as SchoolSettings);
        setSchoolSettings(response.data as SchoolSettings);
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

  const timelineEvents = Array.isArray(settings.timelineEvents) ? settings.timelineEvents : [];

  const toggleDay = (day: string) => {
    let updated: string[];
    if (selectedDays.includes(day)) {
      updated = selectedDays.filter((d) => d !== day);
    } else {
      updated = [...selectedDays, day];
    }
    const ordered = allDays.filter((d) => updated.includes(d));
    setSettings({ ...settings, workingDays: ordered.join(",") });
  };

  const updateTimelineEvent = (
    index: number,
    field: "name" | "type" | "startTime" | "endTime",
    value: string
  ) => {
    const nextEvents = [...timelineEvents];
    nextEvents[index] = { ...nextEvents[index], [field]: value };
    setSettings({ ...settings, timelineEvents: nextEvents });
  };

  const addTimelineEvent = () => {
    setSettings({
      ...settings,
      timelineEvents: [
        ...timelineEvents,
        { name: "", type: "custom", startTime: "", endTime: "" },
      ],
    });
  };

  const removeTimelineEvent = (index: number) => {
    const nextEvents = timelineEvents.filter((_, eventIndex) => eventIndex !== index);
    setSettings({ ...settings, timelineEvents: nextEvents });
  };

  const handleSave = async () => {
    const periodsPerDay = Number(settings.periodsPerDay);
    const periodDuration = Number(settings.periodDuration);
    const lunchDuration = Number(settings.lunchDuration);

    if (!settings.schoolName.trim()) {
      setError("School name is required.");
      return;
    }
    if (!settings.startTime || !settings.endTime) {
      setError("School start and end times are required.");
      return;
    }
    if (!Number.isFinite(periodsPerDay) || periodsPerDay < 1 || periodsPerDay > 15) {
      setError("Periods per day must be between 1 and 15.");
      return;
    }
    if (!Number.isFinite(periodDuration) || periodDuration < 1 || periodDuration > 180) {
      setError("Period duration must be between 1 and 180 minutes.");
      return;
    }
    if (!Number.isFinite(lunchDuration) || lunchDuration < 0) {
      setError("Lunch duration must be 0 or more minutes.");
      return;
    }
    if (!settings.workingDays || selectedDays.length === 0) {
      setError("Please select at least one working day.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setMessage("");
      await api.put("/settings", settings);
      setSchoolSettings(settings);
      setMessage("Settings updated successfully.");
      showToast("success", "School settings saved successfully.");
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
          Configure your school&apos;s working schedule, breaks, lunch, assembly, and timetable
          preferences. All settings are private to your account.
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
                    <HelperText>Displayed across timetables and reports.</HelperText>
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

              {/* School Timings */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <CardHeader
                  icon={Clock3}
                  title="School Timings"
                  subtitle="Define when the school day starts and ends."
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
                    <FieldLabel htmlFor="periodsPerDay" required>
                      Periods Per Day
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
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>1 – 15 periods.</HelperText>
                  </div>
                  <div>
                    <FieldLabel htmlFor="periodDuration" required>
                      Period Duration
                    </FieldLabel>
                    <div className="relative">
                      <input
                        id="periodDuration"
                        type="number"
                        min={1}
                        max={180}
                        value={settings.periodDuration}
                        onChange={(e) =>
                          setSettings({ ...settings, periodDuration: e.target.value })
                        }
                        placeholder="45"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-16 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                        min
                      </span>
                    </div>
                    <HelperText>Length of each teaching period.</HelperText>
                  </div>
                </div>
              </div>

              {/* Working Days */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <CardHeader
                  icon={CalendarDays}
                  title="Working Days"
                  subtitle="Select the days the school operates each week."
                />
                <div className="flex flex-wrap gap-3">
                  {allDays.map((day) => {
                    const active = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`min-w-[88px] rounded-xl border px-5 py-3.5 text-sm font-semibold transition-all
                        ${
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
                <p className="mt-4 text-sm text-slate-500">
                  <span className="font-medium text-slate-700">Selected:</span>{" "}
                  {settings.workingDays ? (
                    selectedDays.join(", ")
                  ) : (
                    <span className="text-rose-500">None (please select at least one)</span>
                  )}
                </p>
              </div>

              {/* Lunch */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <CardHeader
                  icon={UtensilsCrossed}
                  title="Lunch Break"
                  subtitle="Configure the lunch period timing and duration."
                />
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  <div className="lg:col-span-2">
                    <FieldLabel htmlFor="lunchPosition">Lunch Start</FieldLabel>
                    <input
                      id="lunchPosition"
                      type="number"
                      min={0}
                      value={settings.lunchPosition}
                      onChange={(e) =>
                        setSettings({ ...settings, lunchPosition: e.target.value })
                      }
                      placeholder="After which period?"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>
                      Enter the period number after which lunch starts. Use 0 to disable.
                    </HelperText>
                  </div>
                  <div>
                    <FieldLabel htmlFor="lunchDuration">Lunch Duration</FieldLabel>
                    <div className="relative">
                      <input
                        id="lunchDuration"
                        type="number"
                        min={0}
                        value={settings.lunchDuration}
                        onChange={(e) =>
                          setSettings({ ...settings, lunchDuration: e.target.value })
                        }
                        placeholder="45"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-16 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                        min
                      </span>
                    </div>
                    <HelperText>Typically 30 – 60 minutes.</HelperText>
                  </div>
                </div>
              </div>

              {/* Short Breaks */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <CardHeader
                  icon={Coffee}
                  title="Short Breaks"
                  subtitle="Short recess breaks between periods."
                />
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <FieldLabel htmlFor="shortBreaks">Number of Short Breaks</FieldLabel>
                    <input
                      id="shortBreaks"
                      type="number"
                      min={0}
                      value={settings.shortBreaks}
                      onChange={(e) =>
                        setSettings({ ...settings, shortBreaks: e.target.value })
                      }
                      placeholder="2"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="shortBreakDuration">Break Duration</FieldLabel>
                    <div className="relative">
                      <input
                        id="shortBreakDuration"
                        type="number"
                        min={0}
                        value={settings.shortBreakDuration}
                        onChange={(e) =>
                          setSettings({ ...settings, shortBreakDuration: e.target.value })
                        }
                        placeholder="10"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-16 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                        min
                      </span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="breakPositions">Break Positions</FieldLabel>
                    <input
                      id="breakPositions"
                      type="text"
                      value={settings.breakPositions ?? ""}
                      onChange={(e) =>
                        setSettings({ ...settings, breakPositions: e.target.value })
                      }
                      placeholder="e.g. 2,7"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>
                      Comma-separated period numbers after which breaks occur.
                    </HelperText>
                  </div>
                  <div className="md:col-span-2 lg:col-span-4">
                    <FieldLabel htmlFor="breakDurations">Break Durations (per break)</FieldLabel>
                    <input
                      id="breakDurations"
                      type="text"
                      value={settings.breakDurations ?? ""}
                      onChange={(e) =>
                        setSettings({ ...settings, breakDurations: e.target.value })
                      }
                      placeholder="e.g. 10,10"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>
                      Comma-separated durations matching each break position (in minutes).
                    </HelperText>
                  </div>
                </div>
              </div>

              {/* Assembly & Prayer */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <CardHeader
                  icon={Landmark}
                  title="Assembly & Prayer"
                  subtitle="Reserve periods for school assembly and daily prayers."
                />
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="assemblyPeriod">Assembly Period</FieldLabel>
                    <input
                      id="assemblyPeriod"
                      type="text"
                      value={settings.assemblyPeriod}
                      onChange={(e) =>
                        setSettings({ ...settings, assemblyPeriod: e.target.value })
                      }
                      placeholder="e.g. 1 or leave blank"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>
                      Enter the period number reserved for assembly. Leave blank to disable.
                    </HelperText>
                  </div>
                  <div>
                    <FieldLabel htmlFor="prayerPeriod">Prayer Period</FieldLabel>
                    <input
                      id="prayerPeriod"
                      type="text"
                      value={settings.prayerPeriod}
                      onChange={(e) =>
                        setSettings({ ...settings, prayerPeriod: e.target.value })
                      }
                      placeholder="e.g. 6 or leave blank"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <HelperText>
                      Enter the period number reserved for prayer. Leave blank to disable.
                    </HelperText>
                  </div>
                </div>
              </div>

              {/* Timeline Events */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <CardHeader
                    icon={Clock3}
                    title="Daily Timeline Events"
                    subtitle="Reserve fixed blocks such as assembly, prayer, lunch, lab, library, or other daily activities."
                  />
                  <button
                    type="button"
                    onClick={addTimelineEvent}
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    <PlusCircle size={16} />
                    Add Event
                  </button>
                </div>

                {timelineEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    No fixed events yet. Add a daily block to give the scheduler a more realistic school day structure.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timelineEvents.map((event, index) => (
                      <div
                        key={`${event.name || "event"}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <FieldLabel htmlFor={`timeline-name-${index}`}>Event Name</FieldLabel>
                              <input
                                id={`timeline-name-${index}`}
                                type="text"
                                value={event.name}
                                onChange={(e) => updateTimelineEvent(index, "name", e.target.value)}
                                placeholder="Assembly"
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                              />
                            </div>
                            <div>
                              <FieldLabel htmlFor={`timeline-type-${index}`}>Event Type</FieldLabel>
                              <input
                                id={`timeline-type-${index}`}
                                type="text"
                                value={event.type}
                                onChange={(e) => updateTimelineEvent(index, "type", e.target.value)}
                                placeholder="assembly"
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                              />
                            </div>
                            <div>
                              <FieldLabel htmlFor={`timeline-start-${index}`}>Start Time</FieldLabel>
                              <input
                                id={`timeline-start-${index}`}
                                type="time"
                                value={event.startTime}
                                onChange={(e) => updateTimelineEvent(index, "startTime", e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                              />
                            </div>
                            <div>
                              <FieldLabel htmlFor={`timeline-end-${index}`}>End Time</FieldLabel>
                              <input
                                id={`timeline-end-${index}`}
                                type="time"
                                value={event.endTime}
                                onChange={(e) => updateTimelineEvent(index, "endTime", e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTimelineEvent(index)}
                            className="rounded-xl border border-rose-200 p-2.5 text-rose-600 transition hover:bg-rose-50"
                            aria-label={`Remove ${event.name || "event"}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <HelperText>
                  Fixed events are reserved in the daily schedule and teaching periods are derived around them.
                </HelperText>
              </div>

              {/* Save Action */}
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
                  {isSaving ? (
                    <span className="inline-flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Save Configuration"
                  )}
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
