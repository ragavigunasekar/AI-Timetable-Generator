import { create } from "zustand";
import type { Teacher } from "../types/Teacher";
import type { Subject } from "../types/Subject";
import type { SchoolClass } from "../types/Class";
import type { SchoolSettings } from "../types/SchoolSettings";
import type { Allocation } from "../types/Allocation";
import type { OptimizationRecommendation } from "../types/Optimization";

export interface TimetableEntry {
  subject: string;
  className: string;
  teacher?: string;
  locked?: boolean;
}

export type TimetableData = Record<string, Record<number, TimetableEntry[]>>;

export type ConflictType = 
  | "workload" 
  | "double_booking" 
  | "class_overload" 
  | "room_conflict" 
  | "subject_imbalance" 
  | "consecutive_periods"
  | "missing_teacher"
  | "unallocated_subject";

export interface ConflictSuggestion {
  issue: string;
  cause: string;
  suggestedFix: string;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: "critical" | "warning" | "info";
  entityId: string;
  entityName: string;
  message: string;
  suggestion: ConflictSuggestion;
}

interface SchoolState {
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
  schoolSettings: SchoolSettings;
  allocations: Allocation[];
  generatedTimetable: TimetableData;
  conflicts: Conflict[];
  timetableHealthScore: number;

  // ─── Optimization slice ────────────────────────────────────────────────────
  // Populated by useOptimizationEngine hook when the user triggers analysis.
  // Never modified directly by conflict logic — fully decoupled.
  optimizationRecommendations: OptimizationRecommendation[];
  setOptimizationRecommendations: (recommendations: OptimizationRecommendation[]) => void;
  clearOptimizationRecommendations: () => void;

  setTeachers: (teachers: Teacher[]) => void;
  deleteTeacher: (id: string) => void;
  setSubjects: (subjects: Subject[]) => void;
  deleteSubject: (id: string) => void;
  setClasses: (classes: SchoolClass[]) => void;
  deleteClass: (id: string) => void;
  setSchoolSettings: (settings: SchoolSettings) => void;
  setAllocations: (allocations: Allocation[]) => void;
  setGeneratedTimetable: (timetable: TimetableData) => void;
  clearGeneratedTimetable: () => void;
  recalculateConflicts: () => void;
  setInitialData: (data: {
    teachers?: Teacher[];
    subjects?: Subject[];
    classes?: SchoolClass[];
    schoolSettings?: SchoolSettings;
    allocations?: Allocation[];
  }) => void;
}

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

function parseWorkingDays(workingDays: string) {
  const trimmed = workingDays?.trim();
  const defaultDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  if (!trimmed) {
    return defaultDays;
  }

  const normalized = trimmed.replace(/\s+/g, "");
  const rangeMatch = normalized.match(/^([A-Za-z]+)-([A-Za-z]+)$/);
  
  const capitalize = (s: string) => {
    if (!s) return "";
    const lower = s.toLowerCase();
    if (lower.startsWith("mon")) return "Mon";
    if (lower.startsWith("tue")) return "Tue";
    if (lower.startsWith("wed")) return "Wed";
    if (lower.startsWith("thu")) return "Thu";
    if (lower.startsWith("fri")) return "Fri";
    if (lower.startsWith("sat")) return "Sat";
    if (lower.startsWith("sun")) return "Sun";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const ordered = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (rangeMatch) {
    const from = capitalize(rangeMatch[1]);
    const to = capitalize(rangeMatch[2]);
    const fromIndex = ordered.indexOf(from);
    const toIndex = ordered.indexOf(to);
    if (fromIndex >= 0 && toIndex >= fromIndex) {
      return ordered.slice(fromIndex, toIndex + 1);
    }
  }

  return trimmed
    .split(",")
    .map((day) => capitalize(day.trim()))
    .filter((day) => ordered.includes(day));
}

export const useSchoolStore = create<SchoolState>((set, get) => ({
  teachers: [],
  subjects: [],
  classes: [],
  schoolSettings: defaultSettings,
  allocations: [],
  generatedTimetable: {},
  conflicts: [],
  timetableHealthScore: 100,
  optimizationRecommendations: [],
  setOptimizationRecommendations: (recommendations) => set({ optimizationRecommendations: recommendations }),
  clearOptimizationRecommendations: () => set({ optimizationRecommendations: [] }),
  
  recalculateConflicts: () => {
    const { teachers, allocations, classes, schoolSettings, subjects } = get();
    
    const conflicts: Conflict[] = [];
    const days = parseWorkingDays(schoolSettings.workingDays);
    const periodsPerDay = Number(schoolSettings.periodsPerDay) || 8;
    const weeklyCapacity = days.length * periodsPerDay;
    let deductions = 0;

    // 1. Check Teacher Workload and Double Booking
    const teacherPeriods: Record<string, number> = {};
    allocations.forEach((alloc) => {
      if (alloc.teacherId) {
        teacherPeriods[alloc.teacherId] = (teacherPeriods[alloc.teacherId] || 0) + Number(alloc.periods);
      }
    });

    teachers.forEach((teacher) => {
      const allocated = teacherPeriods[teacher.id] || 0;
      const maxWorkload = Number(teacher.workload);

      // Workload limit conflict (Warning)
      if (!isNaN(maxWorkload) && maxWorkload > 0) {
        if (allocated > maxWorkload) {
          conflicts.push({
            id: `workload-${teacher.id}`,
            type: "workload",
            severity: "warning",
            entityId: teacher.id,
            entityName: teacher.name,
            message: `Teacher ${teacher.name} workload exceeds configured maximum (${allocated}/${maxWorkload} periods).`,
            suggestion: {
              issue: `Teacher ${teacher.name} exceeds workload by ${allocated - maxWorkload} periods.`,
              cause: `Total assigned periods = ${allocated}, max workload = ${maxWorkload}.`,
              suggestedFix: `Reassign ${allocated - maxWorkload} periods to another teacher.`,
            },
          });
          deductions += 15;
        }
      }

      // Weekly capacity double booking conflict (Critical)
      if (allocated > weeklyCapacity) {
        conflicts.push({
          id: `double-booking-${teacher.id}`,
          type: "double_booking",
          severity: "critical",
          entityId: teacher.id,
          entityName: teacher.name,
          message: `Teacher ${teacher.name} allocated periods (${allocated}) exceed weekly school capacity (${weeklyCapacity} periods).`,
          suggestion: {
            issue: `Teacher ${teacher.name} has double booking risk due to over-scheduling.`,
            cause: `Allocated periods = ${allocated}, max weekly periods = ${weeklyCapacity}.`,
            suggestedFix: `Reallocate some courses or reduce period counts to fit ${teacher.name} within ${weeklyCapacity} periods.`,
          },
        });
        deductions += 25;
      }
    });

    // 2. Check Class Over-allocation (Critical)
    const classPeriods: Record<string, number> = {};
    allocations.forEach((alloc) => {
      if (alloc.classId) {
        classPeriods[alloc.classId] = (classPeriods[alloc.classId] || 0) + Number(alloc.periods);
      }
    });

    classes.forEach((c) => {
      const allocated = classPeriods[c.id] || 0;
      if (allocated > weeklyCapacity) {
        const className = `${c.className}-${c.section}`;
        conflicts.push({
          id: `class-overload-${c.id}`,
          type: "class_overload",
          severity: "critical",
          entityId: c.id,
          entityName: className,
          message: `Class ${className} total allocated periods (${allocated}) exceed weekly capacity of ${weeklyCapacity} periods.`,
          suggestion: {
            issue: `Class ${className} is over-allocated by ${allocated - weeklyCapacity} periods.`,
            cause: `Total allocated periods = ${allocated}, max capacity = ${weeklyCapacity}.`,
            suggestedFix: `Reduce periods or delete some allocations for Class ${className} until they fit within ${weeklyCapacity} periods.`,
          },
        });
        deductions += 20;
      }
    });

    // 3. Find Missing Teacher Assignments (Warning)
    allocations.forEach((alloc) => {
      if (!alloc.teacherId) {
        const schoolClass = classes.find((c) => c.id === alloc.classId);
        const className = schoolClass ? `${schoolClass.className}-${schoolClass.section}` : "Unknown Class";
        const subjectName = subjects.find((s) => s.id === alloc.subjectId)?.name || "Unknown Subject";
        
        conflicts.push({
          id: `missing-teacher-${alloc.id}`,
          type: "missing_teacher",
          severity: "warning",
          entityId: alloc.id,
          entityName: `${className} - ${subjectName}`,
          message: `Allocation for ${className} (${subjectName}) is missing a teacher assignment.`,
          suggestion: {
            issue: `No teacher assigned for ${subjectName} in class ${className}.`,
            cause: `Allocation was added with 'Select Teacher (Optional)' left blank.`,
            suggestedFix: `Assign a qualified teacher to this allocation.`,
          },
        });
        deductions += 5;
      }
    });

    // 4. Find Unallocated Subjects (Info)
    const allocatedSubjectIds = new Set(allocations.map((a) => a.subjectId));
    subjects.forEach((subject) => {
      if (!allocatedSubjectIds.has(subject.id)) {
        conflicts.push({
          id: `unallocated-subject-${subject.id}`,
          type: "unallocated_subject",
          severity: "info",
          entityId: subject.id,
          entityName: subject.name,
          message: `Subject '${subject.name}' has no class allocations.`,
          suggestion: {
            issue: `Subject '${subject.name}' is unallocated.`,
            cause: `No class allocations reference this subject.`,
            suggestedFix: `Create an allocation mapping this subject to a class and teacher.`,
          },
        });
        deductions += 5;
      }
    });

    set({ 
      conflicts,
      timetableHealthScore: Math.max(0, 100 - deductions)
    });
  },

  setTeachers: (teachers) => {
    const teacherIds = new Set(teachers.map((t) => t.id));
    set((state) => ({
      teachers,
      allocations: state.allocations.map((a) =>
        a.teacherId && !teacherIds.has(a.teacherId) ? { ...a, teacherId: undefined } : a
      ),
    }));
    get().recalculateConflicts();
  },
  deleteTeacher: (id) => {
    set((state) => ({
      teachers: state.teachers.filter((t) => t.id !== id),
      allocations: state.allocations.map((a) =>
        a.teacherId === id ? { ...a, teacherId: undefined } : a
      ),
    }));
    get().recalculateConflicts();
  },
  setSubjects: (subjects) => {
    const subjectIds = new Set(subjects.map((s) => s.id));
    set((state) => ({
      subjects,
      allocations: state.allocations.filter((a) => subjectIds.has(a.subjectId)),
    }));
    get().recalculateConflicts();
  },
  deleteSubject: (id) => {
    set((state) => ({
      subjects: state.subjects.filter((s) => s.id !== id),
      allocations: state.allocations.filter((a) => a.subjectId !== id),
    }));
    get().recalculateConflicts();
  },
  setClasses: (classes) => {
    const classIds = new Set(classes.map((c) => c.id));
    set((state) => ({
      classes,
      allocations: state.allocations.filter((a) => classIds.has(a.classId)),
    }));
    get().recalculateConflicts();
  },
  deleteClass: (id) => {
    set((state) => ({
      classes: state.classes.filter((c) => c.id !== id),
      allocations: state.allocations.filter((a) => a.classId !== id),
    }));
    get().recalculateConflicts();
  },
  setSchoolSettings: (settings) => {
    set({ schoolSettings: settings });
    get().recalculateConflicts();
  },
  setAllocations: (allocations) => {
    set({ allocations });
    get().recalculateConflicts();
  },
  setGeneratedTimetable: (timetable) => set({ generatedTimetable: timetable }),
  clearGeneratedTimetable: () => set({ generatedTimetable: {} }),
  setInitialData: (data) => {
    set((state) => {
      const nextState = { ...state };
      if (data.teachers) nextState.teachers = data.teachers;
      if (data.subjects) nextState.subjects = data.subjects;
      if (data.classes) nextState.classes = data.classes;
      if (data.schoolSettings) nextState.schoolSettings = data.schoolSettings;
      if (data.allocations) nextState.allocations = data.allocations;

      // Clean up orphaned entries
      if (data.teachers) {
        const ids = new Set(data.teachers.map((t) => t.id));
        nextState.allocations = nextState.allocations.map((a) =>
          a.teacherId && !ids.has(a.teacherId) ? { ...a, teacherId: undefined } : a
        );
      }
      if (data.subjects) {
        const ids = new Set(data.subjects.map((s) => s.id));
        nextState.allocations = nextState.allocations.filter((a) => ids.has(a.subjectId));
      }
      if (data.classes) {
        const ids = new Set(data.classes.map((c) => c.id));
        nextState.allocations = nextState.allocations.filter((a) => ids.has(a.classId));
      }

      return nextState;
    });
    get().recalculateConflicts();
  },
}));
