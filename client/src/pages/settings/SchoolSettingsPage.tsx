import { useEffect, useState } from "react";
import {
  School,
  Clock3,
  CalendarDays,
  UtensilsCrossed,
  Landmark,
  Save,
} from "lucide-react";
import api from "../../services/api";
import { useSchoolStore } from "../../store/schoolStore";
import type { SchoolSettings } from "../../types/SchoolSettings";
import { LoadingState } from "../../components/common/LoadingState";
import { useToast } from "../../components/ui/ToastProvider";
import { getApiErrorMessage } from "../../utils/errorUtils";

function SchoolSettingsPage() {
  const setSchoolSettings = useSchoolStore((state) => state.setSchoolSettings);
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SchoolSettings>({
  schoolName: "",

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
});
const allDays = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];
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
        setSettings(response.data);
        setSchoolSettings(response.data);
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

const toggleDay = (day: string) => {
  let updated: string[];

  if (selectedDays.includes(day)) {
    updated = selectedDays.filter((d) => d !== day);
  } else {
    updated = [...selectedDays, day];
  }

  const ordered = allDays.filter((d) => updated.includes(d));

  setSettings({
    ...settings,
    workingDays: ordered.join(","),
  });
};
  const handleSave = async () => {
    const periodsPerDay = Number(settings.periodsPerDay);
    const lunchDuration = Number(settings.lunchDuration);

    if (!settings.schoolName.trim()) {
      setError("School name is required.");
      return;
    }

    if (!settings.startTime || !settings.endTime) {
      setError("Start and end time are required.");
      return;
    }

    if (!Number.isFinite(periodsPerDay) || periodsPerDay < 1) {
      setError("Periods per day must be at least 1.");
      return;
    }

    if (!Number.isFinite(lunchDuration) || lunchDuration < 0) {
      setError("Lunch duration must be 0 or more.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      await api.put("/settings", settings);
      setSchoolSettings(settings);
      setMessage("Settings updated successfully.");
      showToast("success", "Settings updated successfully.");
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "Unable to save settings.");
      setError(msg);
      showToast("error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
  <h1 className="text-4xl font-bold text-slate-800">
    School Configuration
  </h1>

  <p className="mt-2 text-slate-500">
    Configure your school's working schedule, breaks,
    lunch, assembly and timetable preferences.
  </p>
</div>
      <div className="space-y-6 max-w-6xl">
        {isLoading ? (
          <LoadingState
            title="Loading settings"
            message="Fetching school configuration from the server."
            compact
          />
        ) : (
          <>
            <div className="grid gap-6">

  {/* School */}
  <div className="rounded-2xl border bg-white p-6 shadow-sm">

    <div className="mb-5 flex items-center gap-3">

      <School className="text-indigo-600" />

      <h2 className="text-xl font-semibold">
        School Information
      </h2>

    </div>

    <input
      value={settings.schoolName}
      onChange={(e) =>
        setSettings({
          ...settings,
          schoolName: e.target.value,
        })
      }
      placeholder="School Name"
      className="w-full rounded-xl border p-3"
    />

  </div>

  {/* Timings */}

  <div className="rounded-2xl border bg-white p-6 shadow-sm">

    <div className="mb-5 flex items-center gap-3">

      <Clock3 className="text-indigo-600" />

      <h2 className="text-xl font-semibold">
        School Timings
      </h2>

    </div>

    <div className="grid gap-4 md:grid-cols-2">

      <input
        type="time"
        value={settings.startTime}
        onChange={(e) =>
          setSettings({
            ...settings,
            startTime: e.target.value,
          })
        }
        className="rounded-xl border p-3"
      />

      <input
        type="time"
        value={settings.endTime}
        onChange={(e) =>
          setSettings({
            ...settings,
            endTime: e.target.value,
          })
        }
        className="rounded-xl border p-3"
      />

      <input
        type="number"
        placeholder="Periods Per Day"
        value={settings.periodsPerDay}
        onChange={(e) =>
          setSettings({
            ...settings,
            periodsPerDay: e.target.value,
          })
        }
        className="rounded-xl border p-3"
      />

      <input
        type="number"
        placeholder="Period Duration (minutes)"
        value={settings.periodDuration}
        onChange={(e) =>
          setSettings({
            ...settings,
            periodDuration: e.target.value,
          })
        }
        className="rounded-xl border p-3"
      />

    </div>

  </div>

  {/* Working Days */}

  <div className="rounded-2xl border bg-white p-6 shadow-sm">

    <div className="mb-5 flex items-center gap-3">

      <CalendarDays className="text-indigo-600" />

      <h2 className="text-xl font-semibold">
        Working Days
      </h2>

    </div>

    <div className="flex flex-wrap gap-3">

  {allDays.map((day) => {

    const active = selectedDays.includes(day);

    return (
      <button
        key={day}
        type="button"
        onClick={() => toggleDay(day)}
        className={`rounded-xl border px-5 py-3 font-medium transition

        ${
          active
            ? "border-indigo-600 bg-indigo-600 text-white"
            : "border-slate-300 bg-white hover:bg-slate-100"
        }`}
      >
        {day}
      </button>
    );
  })}

</div>

<p className="mt-3 text-sm text-slate-500">
  Selected: {settings.workingDays || "None"}
</p>

  </div>

  {/* Lunch */}

  <div className="rounded-2xl border bg-white p-6 shadow-sm">

    <div className="mb-5 flex items-center gap-3">

      <UtensilsCrossed className="text-indigo-600" />

      <h2 className="text-xl font-semibold">
        Lunch
      </h2>

    </div>

    <div className="grid gap-4 md:grid-cols-2">

      <input
        type="number"
        placeholder="Lunch After Period"
        value={settings.lunchPosition}
        onChange={(e) =>
          setSettings({
            ...settings,
            lunchPosition: e.target.value,
          })
        }
        className="rounded-xl border p-3"
      />

      <input
        type="number"
        placeholder="Lunch Duration (minutes)"
        value={settings.lunchDuration}
        onChange={(e) =>
          setSettings({
            ...settings,
            lunchDuration: e.target.value,
          })
        }
        className="rounded-xl border p-3"
      />

    </div>

  </div>

  {/* Assembly */}

  <div className="rounded-2xl border bg-white p-6 shadow-sm">

    <div className="mb-5 flex items-center gap-3">

      <Landmark className="text-indigo-600" />

      <h2 className="text-xl font-semibold">
        Assembly & Prayer
      </h2>

    </div>

    <div className="grid gap-4 md:grid-cols-2">

      <input
        placeholder="Assembly Period"
        value={settings.assemblyPeriod}
        onChange={(e) =>
          setSettings({
            ...settings,
            assemblyPeriod: e.target.value,
          })
        }
        className="rounded-xl border p-3"
      />

      <input
        placeholder="Prayer Period"
        value={settings.prayerPeriod}
        onChange={(e) =>
          setSettings({
            ...settings,
            prayerPeriod: e.target.value,
          })
        }
        className="rounded-xl border p-3"
      />

    </div>

  </div>

  <button
    onClick={handleSave}
    disabled={isSaving}
    className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-70"
  >
    <Save size={18} />

    {isSaving
      ? "Saving..."
      : "Save Configuration"}
  </button>

</div>


            {message && <div className="mt-4 text-green-600">{message}</div>}
            {error && <div className="mt-4 text-red-600">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export default SchoolSettingsPage;
