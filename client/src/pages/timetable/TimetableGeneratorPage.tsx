import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Download,
  Printer,
  Trash2,
  LayoutGrid,
  UserRound,
  BookOpen,
  CalendarDays,
  Search,
} from "lucide-react";

import {
  useSchoolStore,
  type TimetableEntry as StoreTimetableEntry,
} from "../../store/schoolStore";
import { formatTimeLabel } from "./timetableUtils";

type ViewMode =
  | "weekly"
  | "teacher"
  | "class"
  | "subject";

type FlatEntry = StoreTimetableEntry & {
  day: string;
  period: number;
};

function parseWorkingDays(workingDays: string) {
  const defaults = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  if (!workingDays?.trim()) return defaults;

  const ordered = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ];

  const normalize = (day: string) => {
    const d = day.toLowerCase();

    if (d.startsWith("mon")) return "Mon";
    if (d.startsWith("tue")) return "Tue";
    if (d.startsWith("wed")) return "Wed";
    if (d.startsWith("thu")) return "Thu";
    if (d.startsWith("fri")) return "Fri";
    if (d.startsWith("sat")) return "Sat";
    if (d.startsWith("sun")) return "Sun";

    return day;
  };

  const clean = workingDays.replace(/\s+/g, "");

  if (clean.includes("-")) {
    const [from, to] = clean.split("-");

    const start = ordered.indexOf(normalize(from));
    const end = ordered.indexOf(normalize(to));

    if (start >= 0 && end >= start) {
      return ordered.slice(start, end + 1);
    }
  }

  return clean
    .split(",")
    .map(normalize)
    .filter((x) => ordered.includes(x));
}

function badge(subject: string) {
  const s = subject.toLowerCase();

  if (
    s.includes("math") ||
    s.includes("science") ||
    s.includes("physics") ||
    s.includes("chemistry")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    s.includes("english") ||
    s.includes("language") ||
    s.includes("tamil") ||
    s.includes("hindi")
  ) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (
    s.includes("art") ||
    s.includes("music") ||
    s.includes("activity")
  ) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function EntryCard({
  entry,
}: {
  entry: StoreTimetableEntry;
}) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-sm ${badge(
        entry.subject
      )}`}
    >
      <div className="font-semibold">
        {entry.subject}
      </div>

      <div className="mt-1 text-xs">
        {entry.className}
      </div>

      <div className="mt-1 text-xs opacity-70">
  {entry.teacher ?? "No Teacher"}
</div>
    </div>
  );
}

function TimetableGeneratorPage() {
  const navigate = useNavigate();

  const generatedTimetable = useSchoolStore(
    (state) => state.generatedTimetable
  );

  const settings = useSchoolStore(
    (state) => state.schoolSettings
  );

  const clearGeneratedTimetable = useSchoolStore(
    (state) => state.clearGeneratedTimetable
  );

  const [view, setView] =
    useState<ViewMode>("weekly");

  const [search, setSearch] =
    useState("");

  const days = useMemo(
    () =>
      parseWorkingDays(
        settings.workingDays
      ),
    [settings.workingDays]
  );

  const periodsPerDay =
    Number(settings.periodsPerDay) || 8;

  const timetableExists =
    Object.keys(generatedTimetable).length >
    0;

  const timeSlots = useMemo(() => {
    const hour = Number(
      settings.startTime?.split(":")[0] ?? 8
    );

    const minute = Number(
      settings.startTime?.split(":")[1] ?? 45
    );

    const duration =
      Number(settings.periodDuration) || 45;

    let current = hour * 60 + minute;

    const slots: {
      label: string;
      start: string;
      end: string;
    }[] = [];

    for (
      let i = 1;
      i <= periodsPerDay;
      i++
    ) {
      const end = current + duration;

      slots.push({
        label: `Period ${i}`,
        start: formatTimeLabel(
          `${String(
            Math.floor(current / 60)
          ).padStart(2, "0")}:${String(
            current % 60
          ).padStart(2, "0")}`
        ),
        end: formatTimeLabel(
          `${String(
            Math.floor(end / 60)
          ).padStart(2, "0")}:${String(
            end % 60
          ).padStart(2, "0")}`
        ),
      });

      current = end;
    }

    return slots;
  }, [
    settings.startTime,
    settings.periodDuration,
    periodsPerDay,
    ]);

  const allEntries = useMemo<FlatEntry[]>(() => {
    const arr: FlatEntry[] = [];

    days.forEach((day) => {
      for (let period = 1; period <= periodsPerDay; period++) {
        const entries =
          generatedTimetable?.[day]?.[period] ?? [];

        entries
          .filter((e: StoreTimetableEntry) => !e.locked)
          .forEach((e: StoreTimetableEntry) =>
            arr.push({
              ...e,
              day,
              period,
            })
          );
      }
    });

    return arr;
  }, [
    generatedTimetable,
    days,
    periodsPerDay,
  ]);

  const teacherCount = new Set(
    allEntries.map((e) => e.teacher)
  ).size;

  const classCount = new Set(
    allEntries.map((e) => e.className)
  ).size;

  const subjectCount = new Set(
    allEntries.map((e) => e.subject)
  ).size;

  const exportCSV = () => {
    const rows: string[][] = [
      ["Period", ...days],
    ];

    for (
      let period = 1;
      period <= periodsPerDay;
      period++
    ) {
      const row = [String(period)];

      for (const day of days) {
        const entries =
          generatedTimetable?.[day]?.[period] ?? [];

        row.push(
          `"${entries
            .filter(
              (e: StoreTimetableEntry) => !e.locked
            )
            .map(
              (e) =>
                `${e.subject} | ${e.className} | ${e.teacher}`
            )
            .join(" / ")}"`
        );
      }

      rows.push(row);
    }

    const csv = rows
      .map((r) => r.join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download =
      "Generated Timetable.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  const clear = () => {
    clearGeneratedTimetable();
    navigate("/allocations");
  };

  if (!timetableExists) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold">
            No Timetable Generated
          </h2>

          <p className="mt-2 text-slate-500">
            Generate a timetable first.
          </p>

          <button
            onClick={() =>
              navigate("/allocations")
            }
            className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 text-white"
          >
            Go to Allocations
          </button>
        </div>
      </div>
    );
  }

  return (
  <div className="mx-auto max-w-7xl p-6">
    {/* Header */}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">

        <div>

          <h1 className="text-3xl font-bold">
            Generated Timetable
          </h1>

          <p className="text-slate-500">
            {settings.schoolName}
          </p>

        </div>

        <div className="flex gap-2">

          <button
            onClick={exportCSV}
            className="rounded-xl border px-4 py-2 hover:bg-slate-100"
          >
            <Download size={18} />
          </button>

          <button
            onClick={() => window.print()}
            className="rounded-xl border px-4 py-2 hover:bg-slate-100"
          >
            <Printer size={18} />
          </button>

          <button
            onClick={clear}
            className="rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            <Trash2 size={18} />
          </button>

        </div>

      </div>

      {/* Tabs */}

      <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border bg-slate-50 p-2">

        {[
          {
            key: "weekly",
            label: "Weekly",
            icon: LayoutGrid,
          },
          {
            key: "teacher",
            label: "Teacher",
            icon: UserRound,
          },
          {
            key: "class",
            label: "Class",
            icon: BookOpen,
          },
          {
            key: "subject",
            label: "Subject",
            icon: CalendarDays,
          },
        ].map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              onClick={() =>
                setView(tab.key as ViewMode)
              }
              className={`flex items-center gap-2 rounded-xl px-4 py-2 transition ${
                view === tab.key
                  ? "bg-indigo-600 text-white"
                  : "bg-white hover:bg-slate-100"
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 rounded-xl border bg-white px-3">

          <Search
            size={16}
            className="text-slate-500"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder={`Search ${view}`}
            className="bg-transparent py-2 outline-none"
          />

        </div>

      </div>

      {/* Statistics */}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">
            Teachers
          </div>
          <div className="mt-2 text-3xl font-bold">
            {teacherCount}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">
            Classes
          </div>
          <div className="mt-2 text-3xl font-bold">
            {classCount}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">
            Subjects
          </div>
          <div className="mt-2 text-3xl font-bold">
            {subjectCount}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">
            Total Slots
          </div>
          <div className="mt-2 text-3xl font-bold">
            {allEntries.length}
          </div>
        </div>

      </div>

           <div className="overflow-hidden rounded-3xl border bg-white shadow">
  {view === "weekly" ? (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-3">Time</th>

            {days.map((day) => (
              <th key={day} className="border p-3">
                {day}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from(
            { length: periodsPerDay },
            (_, i) => i + 1
          ).map((period, rowIndex) => (
            <tr key={period}>
              <td className="border p-3 font-medium">
                <div>{timeSlots[rowIndex].label}</div>

                <div className="text-xs text-slate-500">
                  {timeSlots[rowIndex].start} -{" "}
                  {timeSlots[rowIndex].end}
                </div>
              </td>

              {days.map((day) => {
                const entries =
                  generatedTimetable?.[day]?.[period] ?? [];

                return (
                  <td
                    key={`${day}-${period}`}
                    className="border p-3 align-top"
                  >
                    {entries.filter(
                      (e: StoreTimetableEntry) => !e.locked
                    ).length === 0 ? (
                      <span className="text-slate-400">
                        Free
                      </span>
                    ) : (
                      <div className="space-y-2">
                        {entries
                          .filter(
                            (e: StoreTimetableEntry) => !e.locked
                          )
                          .map((entry, index) => (
                            <EntryCard
                              key={index}
                              entry={entry}
                            />
                          ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="space-y-6 p-6">
      {[
  ...new Set(
    allEntries
      .map((entry) =>
        view === "teacher"
          ? entry.teacher
          : view === "class"
          ? entry.className
          : entry.subject
      )
      .filter((item): item is string => Boolean(item))
  ),
]
        .filter((item) =>
            item
            .toLowerCase()
            .includes(search.toLowerCase())
        )
        .sort()
        .map((item) => (
          <div
            key={item}
            className="rounded-2xl border p-5"
          >
            <h2 className="mb-4 text-xl font-bold">
              {item}
            </h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allEntries
                .filter((entry) =>
                  view === "teacher"
                    ? entry.teacher === item
                    : view === "class"
                    ? entry.className === item
                    : entry.subject === item
                )
                .map((entry, index) => (
                  <div
                    key={index}
                    className="rounded-xl border bg-slate-50 p-4"
                  >
                    <div className="font-semibold">
                      {entry.day}
                    </div>

                    <div className="text-sm text-slate-500">
                      Period {entry.period}
                    </div>

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
</div>    </div>
  );
}

export default TimetableGeneratorPage;