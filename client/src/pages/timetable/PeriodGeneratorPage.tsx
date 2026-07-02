import { useMemo, useState } from "react";
import { useSchoolStore } from "../../store/schoolStore";

function PeriodGeneratorPage() {
  const settings = useSchoolStore((state) => state.schoolSettings);
  const [startTime, setStartTime] = useState(settings.startTime || "09:00");
  const [endTime, setEndTime] = useState(settings.endTime || "15:00");
  const [periodsPerDay, setPeriodsPerDay] = useState(Number(settings.periodsPerDay) || 8);
  const [lunchDuration, setLunchDuration] = useState(Number(settings.lunchDuration) || 30);

  const generatedPeriods = useMemo(() => {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    const totalMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const lunchMinutes = Math.max(0, lunchDuration);
    const availableMinutes = Math.max(0, totalMinutes - lunchMinutes);
    const periodCount = Math.max(1, periodsPerDay);
    const durationPerPeriod = Math.floor(availableMinutes / periodCount);

    return Array.from({ length: periodCount }, (_, index) => {
      const periodStart = new Date(start.getTime() + index * durationPerPeriod * 60000);
      const periodEnd = new Date(periodStart.getTime() + durationPerPeriod * 60000);
      return {
        period: index + 1,
        start: periodStart.toTimeString().slice(0, 5),
        end: periodEnd.toTimeString().slice(0, 5),
      };
    });
  }, [endTime, lunchDuration, periodsPerDay, startTime]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Period Generator</h1>

      <div className="bg-white p-6 rounded-xl shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col text-sm font-medium text-slate-600">
            Start Time
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="border p-3 rounded-lg mt-1" />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-600">
            End Time
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="border p-3 rounded-lg mt-1" />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-600">
            Periods Per Day
            <input type="number" min="1" value={periodsPerDay} onChange={(e) => setPeriodsPerDay(Number(e.target.value) || 1)} className="border p-3 rounded-lg mt-1" />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-600">
            Lunch Break (Minutes)
            <input type="number" min="0" value={lunchDuration} onChange={(e) => setLunchDuration(Number(e.target.value) || 0)} className="border p-3 rounded-lg mt-1" />
          </label>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow mt-8">
        <h2 className="text-xl font-semibold mb-4">Generated Periods</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-2">Period</th>
                <th className="text-left p-2">Start</th>
                <th className="text-left p-2">End</th>
              </tr>
            </thead>
            <tbody>
              {generatedPeriods.map((period) => (
                <tr key={period.period} className="border-t">
                  <td className="p-2">{period.period}</td>
                  <td className="p-2">{period.start}</td>
                  <td className="p-2">{period.end}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PeriodGeneratorPage;