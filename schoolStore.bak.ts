import { create } from "zustand";
import type { Allocation } from "../types/Allocation";
import type { Teacher } from "../types/Teacher";
import type { Subject } from "../types/Subject";
import type { SchoolClass } from "../types/Class";
import type { SchoolSettings } from "../types/SchoolSettings";

export type TimetableCell = {
  subject: string;
  className: string;
};

const defaultSettings: SchoolSettings = {
  schoolName: "State Board Government School",
  startTime: "09:00",
  endTime: "15:00",
  periodsPerDay: "8",
  workingDays: "Mon-Fri",
  lunchDuration: "30",
};

type SchoolStore = {
  allocations: Allocation[];
  timetable: Record<string, Record<number, TimetableCell[]>>;
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
  schoolSettings: SchoolSettings;

  addAllocation: (allocation: Allocation) => void;
  generateTimetable: () => void;
  addTeacher: (teacher: Teacher) => void;
  deleteTeacher: (id: string) => void;
  setTeachers: (teachers: Teacher[]) => void;
  addSubject: (subject: Subject) => void;
  deleteSubject: (id: string) => void;
  setSubjects: (subjects: Subject[]) => void;
  addClass: (schoolClass: SchoolClass) => void;
  deleteClass: (id: string) => void;
  setClasses: (classes: SchoolClass[]) => void;
  setAllocations: (allocations: Allocation[]) => void;
  setSchoolSettings: (settings: Partial<SchoolSettings>) => void;
};

export const useSchoolStore = create<SchoolStore>((set, get) => ({
  allocations: [],
  timetable: {},
  teachers: [],
  subjects: [],
  classes: [],
  schoolSettings: defaultSettings,

  addAllocation: (a) =>
    set((state) => ({
      allocations: [...state.allocations, a],
    })),

  generateTimetable: () => {
    const { allocations, schoolSettings } = get();

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
      const periodCount = Number(alloc.periods) || 0;
      for (let i = 0; i < periodCount; i++) {
        const day = days[dayIndex];

        timetable[day][periodIndex].push({
          subject: alloc.subject,
          className: alloc.className,
        });

        periodIndex++;

        if (periodIndex > periodsPerDay) {
          periodIndex = 1;
          dayIndex = (dayIndex + 1) % days.length;
        }
      }
    });

    set({ timetable });
  },

  setSchoolSettings: (settings) =>
    set((state) => ({
      schoolSettings: { ...state.schoolSettings, ...settings },
    })),

  setTeachers: (teachers) => set({ teachers }),
  addTeacher: (teacher) =>
    set((state) => ({
      teachers: [...state.teachers, teacher],
    })),

  deleteTeacher: (id) =>
    set((state) => ({
      teachers: state.teachers.filter(
        (teacher) => teacher.id !== id
      ),
    })),

  setSubjects: (subjects) => set({ subjects }),
  addSubject: (subject) =>
    set((state) => ({
      subjects: [...state.subjects, subject],
    })),

  deleteSubject: (id) =>
    set((state) => ({
      subjects: state.subjects.filter(
        (subject) => subject.id !== id
      ),
    })),

  setClasses: (classes) => set({ classes }),
  addClass: (schoolClass) =>
    set((state) => ({
      classes: [...state.classes, schoolClass],
    })),

  deleteClass: (id) =>
    set((state) => ({
      classes: state.classes.filter(
        (schoolClass) => schoolClass.id !== id
      ),
    })),
  setAllocations: (allocations) => set({ allocations }),
}));