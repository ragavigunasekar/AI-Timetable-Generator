/**
 * optimizationEngine.ts
 *
 * Pure function optimization service. No React, no Zustand, no side effects.
 * Input: snapshot of school store state. Output: OptimizationRecommendation[].
 *
 * Independently testable — can be imported in any context including Node.js tests.
 *
 * Future modules (Room Optimization, Lab Scheduling, Teacher Availability,
 * Consecutive Period Rules, Subject Spread Optimization) add new analyzer
 * functions following the same pattern and register them in runAllAnalyzers().
 */

import type { Teacher } from "../types/Teacher";
import type { Subject } from "../types/Subject";
import type { SchoolClass } from "../types/Class";
import type { Allocation } from "../types/Allocation";
import type { SchoolSettings } from "../types/SchoolSettings";
import type { Conflict } from "../store/schoolStore";
import type {
  OptimizationEngineInput,
  OptimizationEngineOutput,
  OptimizationRecommendation,
  AffectedEntity,
  HealthImpactAnalysis,
} from "../types/Optimization";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseWorkingDaysCount(workingDays: string): number {
  const trimmed = workingDays?.trim() ?? "";
  const ordered = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const capitalize = (s: string): string => {
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

  const normalized = trimmed.replace(/\s+/g, "");
  const rangeMatch = normalized.match(/^([A-Za-z]+)-([A-Za-z]+)$/);

  if (rangeMatch) {
    const from = capitalize(rangeMatch[1]);
    const to = capitalize(rangeMatch[2]);
    const fromIdx = ordered.indexOf(from);
    const toIdx = ordered.indexOf(to);
    if (fromIdx >= 0 && toIdx >= fromIdx) return toIdx - fromIdx + 1;
  }

  const list = trimmed
    .split(",")
    .map((d) => capitalize(d.trim()))
    .filter((d) => ordered.includes(d));

  return list.length > 0 ? list.length : 5;
}

/** Build a HealthImpactAnalysis for a single recommendation. */
function buildHealthImpact(
  currentHealthScore: number,
  conflictIdsResolved: string[],
  allConflicts: Conflict[],
  pointsGained: number
): HealthImpactAnalysis {
  const estimatedNewHealthScore = Math.min(100, currentHealthScore + pointsGained);
  return {
    currentHealthScore,
    estimatedNewHealthScore,
    estimatedHealthIncrease: estimatedNewHealthScore - currentHealthScore,
    conflictsRemovedCount: conflictIdsResolved.length,
    conflictsRemainingCount: allConflicts.length - conflictIdsResolved.length,
    conflictIdsResolved,
  };
}

// ─── Analyzer 1: Teacher Workload Rebalancing ─────────────────────────────────

function analyzeWorkloadRebalancing(
  teachers: Teacher[],
  allocations: Allocation[],
  classes: SchoolClass[],
  subjects: Subject[],
  conflicts: Conflict[],
  schoolSettings: SchoolSettings,
  currentHealthScore: number
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const periodsPerDay = Number(schoolSettings.periodsPerDay) || 8;
  const daysCount = parseWorkingDaysCount(schoolSettings.workingDays);
  const weeklyCapacity = daysCount * periodsPerDay;

  // Compute allocated periods per teacher
  const teacherPeriodMap: Record<string, number> = {};
  allocations.forEach((a) => {
    if (a.teacherId) {
      teacherPeriodMap[a.teacherId] = (teacherPeriodMap[a.teacherId] ?? 0) + Number(a.periods);
    }
  });

  // Find overloaded teachers
  teachers.forEach((teacher) => {
    const allocated = teacherPeriodMap[teacher.id] ?? 0;
    const maxWorkload = Number(teacher.workload);

    const workloadConflict = conflicts.find((c) => c.id === `workload-${teacher.id}`);
    const doubleBookingConflict = conflicts.find((c) => c.id === `double-booking-${teacher.id}`);

    if (!workloadConflict && !doubleBookingConflict) return;

    const isDoubleBooking = !!doubleBookingConflict;
    const overBy = isDoubleBooking
      ? allocated - weeklyCapacity
      : allocated - (isNaN(maxWorkload) ? 0 : maxWorkload);

    if (overBy <= 0) return;

    const resolvedConflictIds: string[] = [];
    if (workloadConflict) resolvedConflictIds.push(workloadConflict.id);
    if (doubleBookingConflict) resolvedConflictIds.push(doubleBookingConflict.id);

    const pointsGained = (isDoubleBooking ? 25 : 0) + (workloadConflict ? 15 : 0);

    // Find allocations belonging to this teacher sorted by period count desc
    const teacherAllocations = allocations
      .filter((a) => a.teacherId === teacher.id)
      .sort((a, b) => Number(b.periods) - Number(a.periods));

    // Find alternative teachers who have remaining capacity
    const alternativeTeachers = teachers.filter((t) => {
      if (t.id === teacher.id) return false;
      const tAllocated = teacherPeriodMap[t.id] ?? 0;
      const tMax = Number(t.workload);
      const tCapacity = isNaN(tMax) || tMax <= 0 ? weeklyCapacity : Math.min(tMax, weeklyCapacity);
      return tAllocated + overBy <= tCapacity;
    });

    const affectedEntities: AffectedEntity[] = [
      { entityId: teacher.id, entityName: teacher.name, entityType: "teacher" },
      ...teacherAllocations.slice(0, 3).map<AffectedEntity>((a) => {
        const cls = classes.find((c) => c.id === a.classId);
        const sub = subjects.find((s) => s.id === a.subjectId);
        return {
          entityId: a.id,
          entityName: `${cls ? `${cls.className}-${cls.section}` : "Unknown"} / ${sub?.name ?? "Unknown"}`,
          entityType: "allocation",
        };
      }),
    ];

    const steps: string[] = [
      `Identify which allocations contribute to ${teacher.name}'s ${overBy} excess period(s).`,
      `Reassign at least ${overBy} period(s) worth of allocations to another teacher.`,
      ...(alternativeTeachers.length > 0
        ? [`Suggested alternative teachers with available capacity: ${alternativeTeachers.slice(0, 3).map((t) => t.name).join(", ")}.`]
        : ["No teacher currently has sufficient free capacity. Consider adding a new teacher or reducing total allocation periods."]),
      `After reassignment, verify no new workload conflicts are introduced.`,
    ];

    recommendations.push({
      id: `workload-rebalancing-${teacher.id}`,
      type: "workload_rebalancing",
      title: `Rebalance ${teacher.name}'s Workload`,
      description: `${teacher.name} is assigned ${allocated} periods but is limited to ${isNaN(maxWorkload) ? weeklyCapacity : maxWorkload} (weekly capacity: ${weeklyCapacity}). Reassigning ${overBy} period(s) will resolve ${resolvedConflictIds.length} conflict(s) and gain +${pointsGained} health points.`,
      priority: isDoubleBooking ? "critical" : "high",
      effort: alternativeTeachers.length > 0 ? "low" : "high",
      confidenceScore: alternativeTeachers.length > 0 ? 85 : 45,
      affectedEntities,
      healthImpact: buildHealthImpact(currentHealthScore, resolvedConflictIds, conflicts, pointsGained),
      implementationStrategy: {
        action: "reassign_teacher",
        steps,
        targetAllocationIds: teacherAllocations.map((a) => a.id),
        suggestedTeacherId: alternativeTeachers[0]?.id,
      },
      isAutoApplicable: false,
    });
  });

  return recommendations;
}

// ─── Analyzer 2: Class Overload Reduction ─────────────────────────────────────

function analyzeClassOverloadReduction(
  classes: SchoolClass[],
  allocations: Allocation[],
  subjects: Subject[],
  conflicts: Conflict[],
  schoolSettings: SchoolSettings,
  currentHealthScore: number
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const periodsPerDay = Number(schoolSettings.periodsPerDay) || 8;
  const daysCount = parseWorkingDaysCount(schoolSettings.workingDays);
  const weeklyCapacity = daysCount * periodsPerDay;

  const classPeriodMap: Record<string, number> = {};
  allocations.forEach((a) => {
    if (a.classId) {
      classPeriodMap[a.classId] = (classPeriodMap[a.classId] ?? 0) + Number(a.periods);
    }
  });

  classes.forEach((cls) => {
    const allocated = classPeriodMap[cls.id] ?? 0;
    if (allocated <= weeklyCapacity) return;

    const overBy = allocated - weeklyCapacity;
    const conflictId = `class-overload-${cls.id}`;
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (!conflict) return;

    const className = `${cls.className}-${cls.section}`;
    const classAllocations = allocations
      .filter((a) => a.classId === cls.id)
      .sort((a, b) => Number(b.periods) - Number(a.periods));

    const affectedEntities: AffectedEntity[] = [
      { entityId: cls.id, entityName: className, entityType: "class" },
      ...classAllocations.slice(0, 4).map<AffectedEntity>((a) => {
        const sub = subjects.find((s) => s.id === a.subjectId);
        return {
          entityId: a.id,
          entityName: sub?.name ?? "Unknown Subject",
          entityType: "allocation",
        };
      }),
    ];

    const steps = [
      `Class ${className} is over-allocated by ${overBy} period(s) (${allocated} / ${weeklyCapacity} max).`,
      `Review the ${classAllocations.length} allocation(s) for this class.`,
      `Reduce the period count of one or more allocations so the total does not exceed ${weeklyCapacity}.`,
      `The largest allocation is currently ${subjects.find((s) => s.id === classAllocations[0]?.subjectId)?.name ?? "Unknown"} with ${classAllocations[0]?.periods ?? 0} period(s) — consider reducing this first.`,
    ];

    recommendations.push({
      id: `class-overload-${cls.id}`,
      type: "class_overload_reduction",
      title: `Reduce Overload for Class ${className}`,
      description: `Class ${className} has ${allocated} allocated periods, exceeding the weekly capacity of ${weeklyCapacity}. Reducing by ${overBy} period(s) will resolve this critical conflict and restore +20 health points.`,
      priority: "critical",
      effort: "medium",
      confidenceScore: 95,
      affectedEntities,
      healthImpact: buildHealthImpact(currentHealthScore, [conflictId], conflicts, 20),
      implementationStrategy: {
        action: "reduce_periods",
        steps,
        targetAllocationIds: classAllocations.map((a) => a.id),
        suggestedPeriodDelta: -overBy,
      },
      isAutoApplicable: false,
    });
  });

  return recommendations;
}

// ─── Analyzer 3: Missing Teacher Assignment Resolution ─────────────────────────

function analyzeMissingTeacherAssignments(
  teachers: Teacher[],
  subjects: Subject[],
  classes: SchoolClass[],
  allocations: Allocation[],
  conflicts: Conflict[],
  currentHealthScore: number
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  const missingTeacherConflicts = conflicts.filter((c) => c.type === "missing_teacher");

  missingTeacherConflicts.forEach((conflict) => {
    const alloc = allocations.find((a) => a.id === conflict.entityId);
    if (!alloc) return;

    const cls = classes.find((c) => c.id === alloc.classId);
    const sub = subjects.find((s) => s.id === alloc.subjectId);
    const className = cls ? `${cls.className}-${cls.section}` : "Unknown Class";
    const subjectName = sub?.name ?? "Unknown Subject";

    // Find teachers whose subject field contains the subject name (case-insensitive)
    const matchingTeachers = teachers.filter((t) =>
      t.subject.toLowerCase().includes(subjectName.toLowerCase()) ||
      subjectName.toLowerCase().includes(t.subject.toLowerCase())
    );

    const confidence = matchingTeachers.length > 0 ? 80 : 30;

    const affectedEntities: AffectedEntity[] = [
      { entityId: alloc.id, entityName: `${className} / ${subjectName}`, entityType: "allocation" },
      { entityId: alloc.classId, entityName: className, entityType: "class" },
      { entityId: alloc.subjectId, entityName: subjectName, entityType: "subject" },
    ];

    const steps: string[] = [
      `Allocation: ${subjectName} for class ${className} has no teacher assigned.`,
      ...(matchingTeachers.length > 0
        ? [
            `${matchingTeachers.length} teacher(s) matched by subject specialization: ${matchingTeachers.slice(0, 3).map((t) => `${t.name} (${t.subject})`).join(", ")}.`,
            `Review the matched teacher(s) and assign the most suitable one to this allocation.`,
          ]
        : [
            `No teachers found whose subject field matches "${subjectName}".`,
            `Assign any available teacher manually, or update teacher subject specialization records.`,
          ]),
      `After assignment, verify the teacher's total workload does not exceed their configured maximum.`,
    ];

    recommendations.push({
      id: `missing-teacher-${alloc.id}`,
      type: "missing_teacher_assignment",
      title: `Assign Teacher to ${className} / ${subjectName}`,
      description: `The allocation of ${subjectName} for class ${className} has no teacher. ${matchingTeachers.length > 0 ? `${matchingTeachers.length} potentially qualified teacher(s) identified.` : "No subject-matched teachers found — manual assignment required."} Resolving this will gain +5 health points.`,
      priority: "high",
      effort: matchingTeachers.length > 0 ? "low" : "medium",
      confidenceScore: confidence,
      affectedEntities,
      healthImpact: buildHealthImpact(currentHealthScore, [conflict.id], conflicts, 5),
      implementationStrategy: {
        action: "assign_teacher",
        steps,
        targetAllocationIds: [alloc.id],
        suggestedTeacherId: matchingTeachers[0]?.id,
      },
      isAutoApplicable: false,
    });
  });

  return recommendations;
}

// ─── Analyzer 4: Subject Distribution Balancing ───────────────────────────────

function analyzeSubjectDistributionBalancing(
  subjects: Subject[],
  _allocations: Allocation[],
  conflicts: Conflict[],
  currentHealthScore: number
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  const unallocatedSubjectConflicts = conflicts.filter((c) => c.type === "unallocated_subject");

  // Group by subject to produce one recommendation per unallocated subject
  unallocatedSubjectConflicts.forEach((conflict) => {
    const sub = subjects.find((s) => s.id === conflict.entityId);
    if (!sub) return;

    const conflictIds = [conflict.id];

    const steps = [
      `Subject "${sub.name}" is defined but has no class allocations.`,
      `Navigate to Allocations and create at least one allocation linking "${sub.name}" to a class.`,
      `Assign a teacher specializing in "${sub.name}" to the new allocation.`,
      sub.periodsPerWeek
        ? `The subject is configured for ${sub.periodsPerWeek} periods per week — use this as a guide.`
        : `No default period count is configured for this subject — set one in the Subjects settings.`,
    ];

    recommendations.push({
      id: `subject-distribution-${sub.id}`,
      type: "subject_distribution_balancing",
      title: `Allocate Subject "${sub.name}" to a Class`,
      description: `"${sub.name}" exists in the system but is not assigned to any class. This creates an informational conflict and reduces the health score by 5 points. Create at least one allocation to resolve this.`,
      priority: "medium",
      effort: "low",
      confidenceScore: 90,
      affectedEntities: [{ entityId: sub.id, entityName: sub.name, entityType: "subject" }],
      healthImpact: buildHealthImpact(currentHealthScore, conflictIds, conflicts, 5),
      implementationStrategy: {
        action: "create_allocation",
        steps,
        targetAllocationIds: [],
      },
      isAutoApplicable: false,
    });
  });

  return recommendations;
}

// ─── Analyzer 5: Timetable Capacity Optimization ──────────────────────────────

function analyzeCapacityOptimization(
  teachers: Teacher[],
  classes: SchoolClass[],
  allocations: Allocation[],
  conflicts: Conflict[],
  schoolSettings: SchoolSettings,
  currentHealthScore: number
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const periodsPerDay = Number(schoolSettings.periodsPerDay) || 8;
  const daysCount = parseWorkingDaysCount(schoolSettings.workingDays);
  const weeklyCapacity = daysCount * periodsPerDay;

  // Compute utilization
  const teacherPeriodMap: Record<string, number> = {};
  allocations.forEach((a) => {
    if (a.teacherId) {
      teacherPeriodMap[a.teacherId] = (teacherPeriodMap[a.teacherId] ?? 0) + Number(a.periods);
    }
  });

  const classPeriodMap: Record<string, number> = {};
  allocations.forEach((a) => {
    if (a.classId) {
      classPeriodMap[a.classId] = (classPeriodMap[a.classId] ?? 0) + Number(a.periods);
    }
  });

  // Only generate capacity advisory if there are no critical conflicts
  const hasCriticalConflicts = conflicts.some((c) => c.severity === "critical");
  if (hasCriticalConflicts) return [];

  // Identify underutilized teachers (< 50% of their max workload used)
  const underutilizedTeachers = teachers.filter((t) => {
    const allocated = teacherPeriodMap[t.id] ?? 0;
    const maxWorkload = Number(t.workload);
    if (isNaN(maxWorkload) || maxWorkload <= 0) return false;
    return allocated / maxWorkload < 0.5 && allocated > 0;
  });

  // Identify classes approaching capacity (> 80% but < 100%)
  const nearCapacityClasses = classes.filter((c) => {
    const allocated = classPeriodMap[c.id] ?? 0;
    const ratio = allocated / weeklyCapacity;
    return ratio >= 0.8 && ratio < 1.0;
  });

  if (underutilizedTeachers.length === 0 && nearCapacityClasses.length === 0) {
    return [];
  }

  const steps: string[] = [
    "Review the overall timetable capacity utilization below.",
    ...(underutilizedTeachers.length > 0
      ? [
          `${underutilizedTeachers.length} teacher(s) are using less than 50% of their configured workload: ${underutilizedTeachers.slice(0, 3).map((t) => t.name).join(", ")}.`,
          "Consider assigning additional subjects or redistributing periods to these teachers for better balance.",
        ]
      : []),
    ...(nearCapacityClasses.length > 0
      ? [
          `${nearCapacityClasses.length} class(es) are approaching weekly capacity (>80%): ${nearCapacityClasses.slice(0, 3).map((c) => `${c.className}-${c.section}`).join(", ")}.`,
          "Avoid adding more allocations to these classes without first reviewing their total periods.",
        ]
      : []),
  ];

  const affectedEntities: AffectedEntity[] = [
    ...underutilizedTeachers.slice(0, 3).map<AffectedEntity>((t) => ({
      entityId: t.id,
      entityName: t.name,
      entityType: "teacher",
    })),
    ...nearCapacityClasses.slice(0, 3).map<AffectedEntity>((c) => ({
      entityId: c.id,
      entityName: `${c.className}-${c.section}`,
      entityType: "class",
    })),
  ];

  recommendations.push({
    id: "capacity-optimization-advisory",
    type: "capacity_optimization",
    title: "Timetable Capacity Advisory",
    description: `${underutilizedTeachers.length > 0 ? `${underutilizedTeachers.length} teacher(s) are underutilized.` : ""} ${nearCapacityClasses.length > 0 ? `${nearCapacityClasses.length} class(es) are near weekly capacity.` : ""} No conflicts exist but addressing these now prevents future scheduling problems.`,
    priority: "low",
    effort: "medium",
    confidenceScore: 70,
    affectedEntities,
    healthImpact: buildHealthImpact(currentHealthScore, [], conflicts, 0),
    implementationStrategy: {
      action: "review_capacity",
      steps,
      targetAllocationIds: [],
    },
    isAutoApplicable: false,
  });

  return recommendations;
}

// ─── Priority Sort Order ──────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<OptimizationRecommendation["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Main Engine Entry Point ──────────────────────────────────────────────────

export function generateOptimizationRecommendations(
  input: OptimizationEngineInput
): OptimizationEngineOutput {
  const {
    teachers,
    subjects,
    classes,
    allocations,
    conflicts,
    schoolSettings,
    currentHealthScore,
  } = input;

  // Run all analyzers — each returns OptimizationRecommendation[]
  const allRecommendations: OptimizationRecommendation[] = [
    ...analyzeWorkloadRebalancing(teachers, allocations, classes, subjects, conflicts, schoolSettings, currentHealthScore),
    ...analyzeClassOverloadReduction(classes, allocations, subjects, conflicts, schoolSettings, currentHealthScore),
    ...analyzeMissingTeacherAssignments(teachers, subjects, classes, allocations, conflicts, currentHealthScore),
    ...analyzeSubjectDistributionBalancing(subjects, allocations, conflicts, currentHealthScore),
    ...analyzeCapacityOptimization(teachers, classes, allocations, conflicts, schoolSettings, currentHealthScore),
  ];

  // Sort by priority then by estimated health increase descending
  const sorted = allRecommendations.sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.healthImpact.estimatedHealthIncrease - a.healthImpact.estimatedHealthIncrease;
  });

  const criticalCount = sorted.filter((r) => r.priority === "critical").length;
  const highCount = sorted.filter((r) => r.priority === "high").length;
  const maxHealthGain = sorted.reduce((sum, r) => sum + r.healthImpact.estimatedHealthIncrease, 0);

  return {
    recommendations: sorted,
    summary: {
      totalRecommendations: sorted.length,
      maxHealthGain: Math.min(100 - currentHealthScore, maxHealthGain),
      criticalCount,
      highCount,
    },
  };
}
