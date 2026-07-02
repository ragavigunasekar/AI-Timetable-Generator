/**
 * @deprecated entitiesStore.ts — PENDING REMOVAL
 *
 * Duplication Audit Result (2026-06-21):
 *   - `useEntitiesStore` is defined here but imported NOWHERE in the codebase.
 *   - `generateTimetable()` is defined here but called NOWHERE in the codebase.
 *   - All state slices (teachers, subjects, classes, allocations, schoolSettings,
 *     timetable) are fully superseded by `schoolStore.ts`, which is the single
 *     source of truth for all scheduling state.
 *
 * Removal Plan:
 *   - Safe to delete in the next cleanup phase.
 *   - No consumer components or pages reference this store.
 *   - Do NOT import from this file in new code.
 */
import { create } from "zustand";
import type { Teacher } from "../types/Teacher";
import type { Subject } from "../types/Subject";
import type { SchoolClass } from "../types/Class";
import type { Allocation } from "../types/Allocation";
import type { SchoolSettings } from "../types/SchoolSettings";

export type TimetableCell = {
  subject: string;
  className: string;
};

type EntitiesState = {
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
  allocations: Allocation[];
  timetable: Record<string, Record<number, TimetableCell[]>>;
  schoolSettings: SchoolSettings;
  setTeachers: (teachers: Teacher[]) => void;
  setSubjects: (subjects: Subject[]) => void;
  setClasses: (classes: SchoolClass[]) => void;
  setAllocations: (allocations: Allocation[]) => void;
  setSchoolSettings: (settings: SchoolSettings) => void;
  generateTimetable: () => void;
};

const defaultSettings: SchoolSettings = {
  schoolName: "State Board Government School",

  startTime: "08:45",
  endTime: "16:00",

  periodsPerDay: "8",
  periodDuration: "45",

  workingDays: "Mon-Fri",

  shortBreaks: "2",
  shortBreakDuration: "10",

  lunchDuration: "45",
  lunchPosition: "5",

  assemblyPeriod: "",
  prayerPeriod: "",

  breakPositions: "2,7",
  breakDurations: "10,10",
};

export const useEntitiesStore = create<EntitiesState>((set, get) => ({
  teachers: [],
  subjects: [],
  classes: [],
  allocations: [],
  timetable: {},
  schoolSettings: defaultSettings,
  setTeachers: (teachers) => set({ teachers }),
  setSubjects: (subjects) => set({ subjects }),
  setClasses: (classes) => set({ classes }),
  setAllocations: (allocations) => set({ allocations }),
  setSchoolSettings: (settings) => set({ schoolSettings: settings }),
  generateTimetable: () => {
    const { allocations, schoolSettings, classes, subjects } = get();
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const periodsPerDay = Number(schoolSettings.periodsPerDay) || 8;
    const timetable: Record<string, Record<number, TimetableCell[]>> = {};

    days.forEach((day) => {
      timetable[day] = {};
      for (let i = 1; i <= periodsPerDay; i++) {
        timetable[day][i] = [];
      }
    });

    let dayIndex = 0;
    let periodIndex = 1;

    allocations.forEach((alloc) => {
      const schoolClass = classes.find((c) => c.id === alloc.classId);
      const classNameStr = schoolClass ? `${schoolClass.className}-${schoolClass.section}` : "Unknown";
      const subjectNameStr = subjects.find((s) => s.id === alloc.subjectId)?.name || "Unknown";
      const periodCount = Number(alloc.periods) || 0;
      for (let i = 0; i < periodCount; i++) {
        const day = days[dayIndex];
        timetable[day][periodIndex].push({ subject: subjectNameStr, className: classNameStr });
        periodIndex++;
        if (periodIndex > periodsPerDay) {
          periodIndex = 1;
          dayIndex = (dayIndex + 1) % days.length;
        }
      }
    });

    set({ timetable });
  },
}));
