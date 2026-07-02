import { useEffect, useState } from "react";
import api from "../../services/api";
import { useSchoolStore } from "../../store/schoolStore";
import type { SchoolSettings } from "../../types/SchoolSettings";
import { LoadingState } from "../../components/common/LoadingState";

function SchoolSettingsPage() {
  const setSchoolSettings = useSchoolStore((state) => state.setSchoolSettings);
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
      } catch (error) {
        setError("Unable to load school settings.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [setSchoolSettings]);

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
    } catch (error) {
      setError("Unable to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">School Settings</h1>

      <div className="bg-white p-6 rounded-xl shadow max-w-3xl">
        {isLoading ? (
          <LoadingState
            title="Loading settings"
            message="Fetching school configuration from the server."
            compact
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={settings.schoolName}
                onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                placeholder="School Name"
                className="border p-3 rounded-lg"
              />
              <input
                value={settings.startTime}
                onChange={(e) => setSettings({ ...settings, startTime: e.target.value })}
                placeholder="Start Time"
                type="time"
                className="border p-3 rounded-lg"
              />
              <input
                value={settings.endTime}
                onChange={(e) => setSettings({ ...settings, endTime: e.target.value })}
                placeholder="End Time"
                type="time"
                className="border p-3 rounded-lg"
              />
              <input
                value={settings.periodsPerDay}
                onChange={(e) => setSettings({ ...settings, periodsPerDay: e.target.value })}
                placeholder="Periods Per Day"
                type="number"
                min="1"
                className="border p-3 rounded-lg"
              />
              <input
                value={settings.workingDays}
                onChange={(e) => setSettings({ ...settings, workingDays: e.target.value })}
                placeholder="Working Days"
                className="border p-3 rounded-lg"
              />
              <input
                value={settings.lunchDuration}
                onChange={(e) => setSettings({ ...settings, lunchDuration: e.target.value })}
                placeholder="Lunch Duration (minutes)"
                type="number"
                min="0"
                className="border p-3 rounded-lg"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="mt-6 bg-black text-white px-6 py-3 rounded-lg disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>

            {message && <div className="mt-4 text-green-600">{message}</div>}
            {error && <div className="mt-4 text-red-600">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export default SchoolSettingsPage;
