import { parseWorkingDays } from "./timetableOptimizer.js";
import { buildTimeSlots } from "./timeSlots.js";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ERROR_SEVERITY = "error";
const WARNING_SEVERITY = "warning";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
}

function readJsonIfNeeded(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function stringifyReference(refs = {}) {
  const items = [];
  for (const [key, value] of Object.entries(refs)) {
    if (value !== undefined && value !== null && value !== "") {
      items.push(`${key}:${String(value)}`);
    }
  }
  return items.join(", ");
}

function makeError(code, message, references = {}) {
  return {
    code,
    message,
    severity: ERROR_SEVERITY,
    references: Object.keys(references).length > 0 ? references : undefined,
  };
}

function makeWarning(code, message, references = {}) {
  return {
    code,
    message,
    severity: WARNING_SEVERITY,
    references: Object.keys(references).length > 0 ? references : undefined,
  };
}

function normalizeSettings(settings = {}) {
  if (!isPlainObject(settings)) return {};
  return settings;
}

function normalizeTeacherAvailability(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((value) => normalizeString(value))
      .filter(Boolean);
  }
  if (typeof rawValue === "string") {
    return rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function buildDataset(input) {
  const schoolData = isPlainObject(input?.schoolData) ? input.schoolData : {};
  const teachers = normalizeList(schoolData.teachers ?? input?.teachers ?? []);
  const classes = normalizeList(schoolData.classes ?? input?.classes ?? []);
  const subjects = normalizeList(schoolData.subjects ?? input?.subjects ?? []);
  const allocations = normalizeList(schoolData.allocations ?? input?.allocations ?? []);
  const settings = normalizeSettings(schoolData.settings ?? input?.settings ?? {});

  return {
    teachers,
    classes,
    subjects,
    allocations,
    settings,
    userId: input?.userId ?? schoolData.userId ?? null,
  };
}

function normalizeTimetableData(value) {
  const parsed = readJsonIfNeeded(value);
  if (!parsed) return {};
  if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  return {};
}

function makeIdMap(records, key = "id") {
  const map = new Map();
  for (const record of records) {
    if (!isPlainObject(record)) continue;
    const idValue = normalizeString(record[key]);
    if (idValue) {
      map.set(idValue, record);
    }
  }
  return map;
}

function makeNameMap(records, lookupKeys) {
  const map = new Map();
  for (const record of records) {
    if (!isPlainObject(record)) continue;
    for (const key of lookupKeys) {
      const value = normalizeString(record[key]);
      if (value) {
        map.set(value, record);
      }
    }
  }
  return map;
}

function resolveTeacher(entry, teacherMapById, teacherMapByName, teacherMapByCode) {
  const teacherId = normalizeString(entry?.teacherId || entry?.teacher_id);
  if (teacherId) {
    return teacherMapById.get(teacherId) || null;
  }

  const teacherName = normalizeString(entry?.teacher || entry?.teacherName || entry?.name);
  if (teacherName) {
    const teacher = teacherMapByName.get(teacherName) || teacherMapByCode.get(teacherName);
    if (teacher) return teacher;
  }

  return null;
}

function resolveClass(entry, classMapById, classMapByName, classMapByLabel) {
  const classId = normalizeString(entry?.classId || entry?.class_id);
  if (classId) {
    return classMapById.get(classId) || null;
  }

  const className = normalizeString(entry?.className || entry?.class || entry?.classLabel || entry?.name || "");
  if (className) {
    const schoolClass = classMapByName.get(className) || classMapByLabel.get(className);
    if (schoolClass) return schoolClass;
  }

  return null;
}

function resolveSubject(entry, subjectMapById, subjectMapByName) {
  const subjectId = normalizeString(entry?.subjectId || entry?.subject_id);
  if (subjectId) {
    return subjectMapById.get(subjectId) || null;
  }

  const subjectName = normalizeString(entry?.subject || entry?.subjectName);
  if (subjectName) {
    const subject = subjectMapByName.get(subjectName);
    if (subject) return subject;
  }

  return null;
}

function detectTeacherConflict(key, current, teacher, day, period, errors, statistics) {
  if (current.has(key)) {
    statistics.teacherConflicts += 1;
    errors.push(
      makeError("teacher_conflict", `Teacher ${teacher} is assigned to multiple classes during ${day} period ${period}`, {
        teacherId: teacher,
        day,
        period,
      })
    );
    return true;
  }
  current.add(key);
  return false;
}

function detectClassConflict(key, current, className, day, period, errors, statistics) {
  if (current.has(key)) {
    statistics.classConflicts += 1;
    errors.push(
      makeError("class_conflict", `Class ${className} is assigned to multiple teachers during ${day} period ${period}`, {
        classId: className,
        day,
        period,
      })
    );
    return true;
  }
  current.add(key);
  return false;
}

function addReference(refs, key, value) {
  if (value !== undefined && value !== null && value !== "") {
    refs[key] = value;
  }
}

function matchesAllocation(entry, allocation) {
  const entryTeacherId = normalizeString(entry?.teacherId || entry?.teacher_id);
  const entryClassId = normalizeString(entry?.classId || entry?.class_id);
  const entrySubjectId = normalizeString(entry?.subjectId || entry?.subject_id);
  const entryTeacherName = normalizeString(entry?.teacher || entry?.teacherName || entry?.name);
  const entryClassName = normalizeString(entry?.className || entry?.class || entry?.classLabel || "");
  const entrySubjectName = normalizeString(entry?.subject || entry?.subjectName || "");

  const allocationTeacherId = normalizeString(allocation?.teacherId || allocation?.teacher_id);
  const allocationClassId = normalizeString(allocation?.classId || allocation?.class_id);
  const allocationSubjectId = normalizeString(allocation?.subjectId || allocation?.subject_id);
  const allocationTeacherName = normalizeString(allocation?.teacherName || allocation?.teacher || "");
  const allocationClassName = normalizeString(allocation?.className || allocation?.class || "");
  const allocationSubjectName = normalizeString(allocation?.subjectName || allocation?.subject || "");

  const sameId =
    (entryTeacherId && allocationTeacherId && entryTeacherId === allocationTeacherId) ||
    (entryClassId && allocationClassId && entryClassId === allocationClassId) ||
    (entrySubjectId && allocationSubjectId && entrySubjectId === allocationSubjectId);

  const sameName =
    (entryTeacherName && allocationTeacherName && entryTeacherName === allocationTeacherName) ||
    (entryClassName && allocationClassName && entryClassName === allocationClassName) ||
    (entrySubjectName && allocationSubjectName && entrySubjectName === allocationSubjectName);

  if (entryTeacherId && allocationTeacherId && entryTeacherId !== allocationTeacherId) return false;
  if (entryClassId && allocationClassId && entryClassId !== allocationClassId) return false;
  if (entrySubjectId && allocationSubjectId && entrySubjectId !== allocationSubjectId) return false;

  if (entryTeacherName && allocationTeacherName && entryTeacherName !== allocationTeacherName) return false;
  if (entryClassName && allocationClassName && entryClassName !== allocationClassName) return false;
  if (entrySubjectName && allocationSubjectName && entrySubjectName !== allocationSubjectName) return false;

  if ((entryTeacherId || entryClassId || entrySubjectId) && !sameId && !sameName) {
    return false;
  }

  return true;
}

function countRequiredPeriods(allocation) {
  const value = Number(allocation?.periods ?? allocation?.periodsRequired ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function computeClassDayPeriodKey(day, period, classKey) {
  return `${day}|${period}|${classKey}`;
}

function computeTeacherDayPeriodKey(day, period, teacherKey) {
  return `${day}|${period}|${teacherKey}`;
}

export function validateTimetable(input = {}) {
  const dataset = buildDataset(input);
  const rawTimetableInput = input?.timetable ?? input?.timetableData ?? input?.data ?? null;
  if (rawTimetableInput !== null && rawTimetableInput !== undefined && (Array.isArray(rawTimetableInput) || typeof rawTimetableInput !== "object")) {
    return {
      valid: false,
      status: "validation_failed",
      errors: [makeError("invalid_structure", "Timetable input must be an object keyed by day and period.")],
      warnings: [],
      statistics: {
        teacherConflicts: 0,
        classConflicts: 0,
        requiredPeriods: 0,
        placedPeriods: 0,
        underPlacedAllocations: 0,
        overPlacedAllocations: 0,
        fixedEventViolations: 0,
        invalidEntries: 0,
        uniqueTeachersUsed: 0,
        uniqueClassesScheduled: 0,
        uniqueSubjectsScheduled: 0,
        allocationsScheduled: 0,
        allocationsMissing: 0,
        teacherWorkloadViolations: 0,
        availabilityViolations: 0,
      },
      summary: { feasibility: "infeasible", riskLevel: "high" },
    };
  }

  const timetableInput = normalizeTimetableData(rawTimetableInput);

  const errors = [];
  const warnings = [];
  const statistics = {
    teacherConflicts: 0,
    classConflicts: 0,
    requiredPeriods: 0,
    placedPeriods: 0,
    underPlacedAllocations: 0,
    overPlacedAllocations: 0,
    fixedEventViolations: 0,
    invalidEntries: 0,
    uniqueTeachersUsed: 0,
    uniqueClassesScheduled: 0,
    uniqueSubjectsScheduled: 0,
    allocationsScheduled: 0,
    allocationsMissing: 0,
    teacherWorkloadViolations: 0,
    availabilityViolations: 0,
  };

  const teacherMapById = makeIdMap(dataset.teachers, "id");
  const teacherMapByName = makeNameMap(dataset.teachers, ["name", "code"]);
  const teacherMapByCode = makeNameMap(dataset.teachers, ["code"]);
  const classMapById = makeIdMap(dataset.classes, "id");
  const classMapByName = makeNameMap(dataset.classes, ["className", "section"]);
  const classMapByLabel = makeNameMap(dataset.classes, ["className"]);
  const subjectMapById = makeIdMap(dataset.subjects, "id");
  const subjectMapByName = makeNameMap(dataset.subjects, ["name"]);
  const allocationMapById = makeIdMap(dataset.allocations, "id");

  const settings = normalizeSettings(dataset.settings);
  const workingDays = parseWorkingDays(settings.workingDays || "Mon-Fri");
  const validDays = new Set(workingDays);
  const validPeriodLookup = new Map();
  const fixedBlockLookup = new Map();

  for (const day of workingDays) {
    const daySlots = buildTimeSlots(settings, day);
    const validPeriods = new Set();
    const blockedPeriods = new Set();

    for (const slot of daySlots) {
      const period = Number(slot.period);
      if (!Number.isFinite(period)) continue;
      validPeriods.add(period);
      if (slot.type === "fixed" || slot.isTeachingBlocked === true) {
        blockedPeriods.add(period);
      }
    }

    validPeriodLookup.set(day, validPeriods);
    fixedBlockLookup.set(day, blockedPeriods);
  }

  if (!timetableInput || typeof timetableInput !== "object" || Array.isArray(timetableInput)) {
    errors.push(makeError("invalid_structure", "Timetable input is missing or not an object."));
    return {
      valid: false,
      status: "validation_failed",
      errors,
      warnings,
      statistics,
      summary: { feasibility: "infeasible", riskLevel: "high" },
    };
  }

  const timetable = timetableInput;
  const seenTeacherKeys = new Set();
  const seenClassKeys = new Set();
  const seenSubjectKeys = new Set();
  const teacherUsageMap = new Map();
  const classUsageMap = new Map();
  const teacherDayPeriodKeys = new Set();
  const classDayPeriodKeys = new Set();
  const allocationPlacementCounts = new Map();
  const allocationRequiredPeriods = new Map();

  for (const allocation of dataset.allocations) {
    const allocationId = normalizeString(allocation?.id);
    if (allocationId) {
      allocationRequiredPeriods.set(allocationId, countRequiredPeriods(allocation));
      allocationPlacementCounts.set(allocationId, 0);
    }
  }

  if (dataset.userId !== null && dataset.userId !== undefined) {
    for (const teacher of dataset.teachers) {
      if (teacher && teacher.userId !== undefined && teacher.userId !== null && String(teacher.userId) !== String(dataset.userId)) {
        errors.push(
          makeError("unauthorized_user_scope", `Teacher ${teacher.id || teacher.name || "unknown"} is outside the authenticated user's scope.`, {
            teacherId: teacher.id || teacher.name || "unknown",
            userId: dataset.userId,
          })
        );
      }
    }
    for (const schoolClass of dataset.classes) {
      if (schoolClass && schoolClass.userId !== undefined && schoolClass.userId !== null && String(schoolClass.userId) !== String(dataset.userId)) {
        errors.push(
          makeError("unauthorized_user_scope", `Class ${schoolClass.id || schoolClass.className || "unknown"} is outside the authenticated user's scope.`, {
            classId: schoolClass.id || schoolClass.className || "unknown",
            userId: dataset.userId,
          })
        );
      }
    }
    for (const subject of dataset.subjects) {
      if (subject && subject.userId !== undefined && subject.userId !== null && String(subject.userId) !== String(dataset.userId)) {
        errors.push(
          makeError("unauthorized_user_scope", `Subject ${subject.id || subject.name || "unknown"} is outside the authenticated user's scope.`, {
            subjectId: subject.id || subject.name || "unknown",
            userId: dataset.userId,
          })
        );
      }
    }
    for (const allocation of dataset.allocations) {
      if (allocation && allocation.userId !== undefined && allocation.userId !== null && String(allocation.userId) !== String(dataset.userId)) {
        errors.push(
          makeError("unauthorized_user_scope", `Allocation ${allocation.id || "unknown"} is outside the authenticated user's scope.`, {
            allocationId: allocation.id || "unknown",
            userId: dataset.userId,
          })
        );
      }
    }
  }

  const totalTeachingSlots = workingDays.reduce((sum, day) => sum + (buildTimeSlots(settings, day).filter((slot) => slot.type === "teaching").length), 0);
  if (statistics.requiredPeriods > totalTeachingSlots) {
    errors.push(
      makeError("impossible_capacity", `Required periods (${statistics.requiredPeriods}) exceed the total available teaching slots (${totalTeachingSlots}).`, {
        requiredPeriods: statistics.requiredPeriods,
        availableTeachingSlots: totalTeachingSlots,
      })
    );
  }

  for (const [day, dayEntries] of Object.entries(timetable)) {
    if (!validDays.has(day)) {
      errors.push(makeError("invalid_day", `Day ${day} is not in the configured working days.`, { day }));
      continue;
    }

    if (!isPlainObject(dayEntries)) {
      errors.push(makeError("malformed_entry", `Day ${day} must contain period objects.`, { day }));
      statistics.invalidEntries += 1;
      continue;
    }

    const validPeriods = validPeriodLookup.get(day) || new Set();
    const blockedPeriods = fixedBlockLookup.get(day) || new Set();

    for (const [periodRaw, entries] of Object.entries(dayEntries)) {
      const periodValue = Number(periodRaw);
      const periodKey = Number(periodValue);

      if (!Number.isInteger(periodKey)) {
        errors.push(makeError("invalid_period", `Day ${day} contains a non-numeric period key: ${periodRaw}.`, { day, period: periodRaw }));
        statistics.invalidEntries += 1;
        continue;
      }

      if (!validPeriods.has(periodKey)) {
        errors.push(makeError("invalid_period", `Period ${periodKey} for ${day} is not a valid teaching slot.`, { day, period: periodKey }));
        statistics.invalidEntries += 1;
        continue;
      }

      if (!Array.isArray(entries)) {
        errors.push(makeError("malformed_entry", `Entries for ${day}/${periodKey} must be an array.`, { day, period: periodKey }));
        statistics.invalidEntries += 1;
        continue;
      }

      for (const entry of entries) {
        if (!isPlainObject(entry)) {
          errors.push(makeError("malformed_entry", `Entry at ${day}/${periodKey} is not an object.`, { day, period: periodKey }));
          statistics.invalidEntries += 1;
          continue;
        }

        const isFixedEntry = entry.locked === true && (entry.type === "fixed" || entry.eventType || entry.fixed === true);
        if (isFixedEntry) {
          continue;
        }

        statistics.placedPeriods += 1;

        if (blockedPeriods.has(periodKey)) {
          statistics.fixedEventViolations += 1;
          errors.push(
            makeError("fixed_event_violation", `Teaching entry is scheduled inside a blocked time slot on ${day} period ${periodKey}.`, {
              day,
              period: periodKey,
            })
          );
        }

        const teacherObj = resolveTeacher(entry, teacherMapById, teacherMapByName, teacherMapByCode);
        const classObj = resolveClass(entry, classMapById, classMapByName, classMapByLabel);
        const subjectObj = resolveSubject(entry, subjectMapById, subjectMapByName);

        const teacherKey = teacherObj ? normalizeString(teacherObj.id || teacherObj.name || teacherObj.code) : normalizeString(entry.teacher || entry.teacherName || entry.teacherId || entry.teacher_id);
        const classKey = classObj ? normalizeString(classObj.id || classObj.className || classObj.section) : normalizeString(entry.className || entry.class || entry.classId || entry.class_id || "");
        const subjectKey = subjectObj ? normalizeString(subjectObj.id || subjectObj.name) : normalizeString(entry.subject || entry.subjectName || entry.subjectId || entry.subject_id || "");

        if (teacherKey && teacherKey.length > 0) {
          seenTeacherKeys.add(teacherKey);
        }
        if (classKey && classKey.length > 0) {
          seenClassKeys.add(classKey);
        }
        if (subjectKey && subjectKey.length > 0) {
          seenSubjectKeys.add(subjectKey);
        }

        if (!teacherObj) {
          errors.push(
            makeError("invalid_id", `Teacher reference is not valid for ${day} period ${periodKey}.`, {
              day,
              period: periodKey,
              teacherId: teacherKey || null,
            })
          );
          statistics.invalidEntries += 1;
        }

        if (!classObj) {
          errors.push(
            makeError("invalid_id", `Class reference is not valid for ${day} period ${periodKey}.`, {
              day,
              period: periodKey,
              classId: classKey || null,
            })
          );
          statistics.invalidEntries += 1;
        }

        if (!subjectObj) {
          errors.push(
            makeError("invalid_id", `Subject reference is not valid for ${day} period ${periodKey}.`, {
              day,
              period: periodKey,
              subjectId: subjectKey || null,
            })
          );
          statistics.invalidEntries += 1;
        }

        if (dataset.userId !== null && dataset.userId !== undefined) {
          if (teacherObj && teacherObj.userId !== undefined && teacherObj.userId !== null && String(teacherObj.userId) !== String(dataset.userId)) {
            errors.push(
              makeError("unauthorized_user_scope", `Teacher ${teacherKey} is outside the authenticated user's scope.`, {
                teacherId: teacherKey,
                userId: dataset.userId,
              })
            );
          }
          if (classObj && classObj.userId !== undefined && classObj.userId !== null && String(classObj.userId) !== String(dataset.userId)) {
            errors.push(
              makeError("unauthorized_user_scope", `Class ${classKey} is outside the authenticated user's scope.`, {
                classId: classKey,
                userId: dataset.userId,
              })
            );
          }
          if (subjectObj && subjectObj.userId !== undefined && subjectObj.userId !== null && String(subjectObj.userId) !== String(dataset.userId)) {
            errors.push(
              makeError("unauthorized_user_scope", `Subject ${subjectKey} is outside the authenticated user's scope.`, {
                subjectId: subjectKey,
                userId: dataset.userId,
              })
            );
          }
        }

        if (teacherObj && teacherObj.availability !== undefined && teacherObj.availability !== null) {
          const allowedDays = normalizeTeacherAvailability(teacherObj.availability);
          if (allowedDays.length > 0 && !allowedDays.includes(day)) {
            statistics.availabilityViolations += 1;
            errors.push(
              makeError("unavailable_teacher", `Teacher ${teacherKey} is not available on ${day}.`, {
                teacherId: teacherKey,
                day,
              })
            );
          }
        }

        const teacherDayPeriodKey = computeTeacherDayPeriodKey(day, periodKey, teacherKey);
        if (teacherKey && teacherKey.length > 0) {
          if (teacherDayPeriodKeys.has(teacherDayPeriodKey)) {
            statistics.teacherConflicts += 1;
            errors.push(
              makeError("teacher_conflict", `Teacher ${teacherKey} is assigned to multiple classes during ${day} period ${periodKey}.`, {
                teacherId: teacherKey,
                day,
                period: periodKey,
              })
            );
          }
          teacherDayPeriodKeys.add(teacherDayPeriodKey);
        }

        const classDayPeriodKey = computeClassDayPeriodKey(day, periodKey, classKey);
        if (classKey && classKey.length > 0) {
          if (classDayPeriodKeys.has(classDayPeriodKey)) {
            statistics.classConflicts += 1;
            errors.push(
              makeError("class_conflict", `Class ${classKey} receives multiple allocations during ${day} period ${periodKey}.`, {
                classId: classKey,
                day,
                period: periodKey,
              })
            );
          }
          classDayPeriodKeys.add(classDayPeriodKey);
        }

        if (teacherKey) {
          teacherUsageMap.set(teacherKey, (teacherUsageMap.get(teacherKey) || 0) + 1);
        }
        if (classKey) {
          classUsageMap.set(classKey, (classUsageMap.get(classKey) || 0) + 1);
        }

        const allocationIdFromEntry = normalizeString(entry?.allocationId || entry?.allocation_id);
        if (allocationIdFromEntry) {
          const allocation = allocationMapById.get(allocationIdFromEntry);
          if (!allocation) {
            errors.push(
              makeError("invalid_id", `Allocation ${allocationIdFromEntry} is not present in the authenticated user's dataset.`, {
                allocationId: allocationIdFromEntry,
              })
            );
          } else {
            const placementCount = allocationPlacementCounts.get(allocationIdFromEntry) || 0;
            allocationPlacementCounts.set(allocationIdFromEntry, placementCount + 1);
          }
        } else {
          const matchedAllocation = dataset.allocations.find((allocation) => matchesAllocation(entry, allocation));
          if (matchedAllocation) {
            const matchedAllocationId = normalizeString(matchedAllocation.id);
            if (matchedAllocationId) {
              const placementCount = allocationPlacementCounts.get(matchedAllocationId) || 0;
              allocationPlacementCounts.set(matchedAllocationId, placementCount + 1);
            }
          }
        }
      }
    }
  }

  const uniqueTeacherCount = new Set();
  const uniqueClassCount = new Set();
  const uniqueSubjectCount = new Set();

  for (const [day, dayEntries] of Object.entries(timetable)) {
    if (!isPlainObject(dayEntries)) continue;
    for (const entries of Object.values(dayEntries)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!isPlainObject(entry)) continue;
        if (entry.locked === true && (entry.type === "fixed" || entry.eventType || entry.fixed === true)) {
          continue;
        }
        const teacherRef = normalizeString(entry.teacher || entry.teacherName || entry.teacherId || entry.teacher_id || "");
        const classRef = normalizeString(entry.className || entry.class || entry.classId || entry.class_id || "");
        const subjectRef = normalizeString(entry.subject || entry.subjectName || entry.subjectId || entry.subject_id || "");
        if (teacherRef) uniqueTeacherCount.add(teacherRef);
        if (classRef) uniqueClassCount.add(classRef);
        if (subjectRef) uniqueSubjectCount.add(subjectRef);
      }
    }
  }

  statistics.uniqueTeachersUsed = uniqueTeacherCount.size;
  statistics.uniqueClassesScheduled = uniqueClassCount.size;
  statistics.uniqueSubjectsScheduled = uniqueSubjectCount.size;

  const allocationStates = [];
  for (const allocation of dataset.allocations) {
    const allocationId = normalizeString(allocation?.id);
    const required = countRequiredPeriods(allocation);
    if (!allocationId) continue;
    statistics.requiredPeriods += required;

    const placed = allocationPlacementCounts.get(allocationId) || 0;
    const underPlaced = placed < required;
    const overPlaced = placed > required;

    if (underPlaced) {
      statistics.underPlacedAllocations += 1;
      allocationStates.push({
        allocationId,
        required,
        placed,
        status: "under_placed",
      });
      if (!errors.some((error) => error.code === "invalid_id")) {
        errors.push(
          makeError("under_placement", `Allocation ${allocationId} requires ${required} periods but only ${placed} are placed.`, {
            allocationId,
            requiredPeriods: required,
            placedPeriods: placed,
          })
        );
      }
    }

    if (overPlaced) {
      statistics.overPlacedAllocations += 1;
      allocationStates.push({
        allocationId,
        required,
        placed,
        status: "over_placed",
      });
      if (!errors.some((error) => error.code === "invalid_id")) {
        errors.push(
          makeError("over_placement", `Allocation ${allocationId} is over-placed: ${placed} placed against a required ${required} periods.`, {
            allocationId,
            requiredPeriods: required,
            placedPeriods: placed,
          })
        );
      }
    }

    if (placed > 0 && required > 0 && allocationId) {
      statistics.allocationsScheduled += 1;
    }
    if (placed === 0 && required > 0) {
      statistics.allocationsMissing += 1;
    }
  }

  for (const [teacherId, assignedPeriods] of teacherUsageMap.entries()) {
    const teacher = teacherMapById.get(teacherId) || teacherMapByName.get(teacherId) || teacherMapByCode.get(teacherId);
    if (!teacher) continue;
    const workloadValue = Number(teacher.workload ?? teacher.maxWorkload ?? teacher.workloadLimit ?? 0);
    if (Number.isFinite(workloadValue) && workloadValue > 0 && assignedPeriods > workloadValue) {
      statistics.teacherWorkloadViolations += 1;
      errors.push(
        makeError("workload_violation", `Teacher ${teacherId} is assigned ${assignedPeriods} periods, exceeding workload ${workloadValue}.`, {
          teacherId,
          assignedPeriods: assignedPeriods,
          workload: workloadValue,
        })
      );
    }
  }

  const impossibleCapacityByTeacher = [];
  for (const teacher of dataset.teachers) {
    const teacherId = normalizeString(teacher?.id || teacher?.name || teacher?.code || "");
    if (!teacherId) continue;
    const availableDays = normalizeTeacherAvailability(teacher.availability);
    const usableDays = availableDays.length > 0 ? availableDays.filter((day) => validDays.has(day)) : [...validDays];
    const teacherAssigned = teacherUsageMap.get(teacherId) || 0;
    const workloadLimit = Number(teacher.workload ?? teacher.maxWorkload ?? teacher.workloadLimit ?? 0);
    if (usableDays.length === 0 && teacherAssigned > 0) {
      impossibleCapacityByTeacher.push(teacherId);
    }
    if (Number.isFinite(workloadLimit) && workloadLimit > 0 && teacherAssigned > workloadLimit) {
      impossibleCapacityByTeacher.push(teacherId);
    }
  }

  const totalRequiredPeriods = dataset.allocations.reduce((sum, allocation) => sum + countRequiredPeriods(allocation), 0);
  const totalAvailableTeachingSlots = workingDays.reduce((sum, day) => sum + (buildTimeSlots(settings, day).filter((slot) => slot.type === "teaching").length), 0);

  if (totalRequiredPeriods > totalAvailableTeachingSlots || impossibleCapacityByTeacher.length > 0) {
    errors.push(
      makeError("impossible_capacity", "The input data demonstrates that the required timetable demand cannot be achieved given the known teacher capacity and blocked slots.", {
        requiredPeriods: totalRequiredPeriods,
        availableTeachingSlots: totalAvailableTeachingSlots,
        teacherIds: [...new Set(impossibleCapacityByTeacher)],
      })
    );
  }

  if (errors.length === 0) {
    return {
      valid: true,
      status: "valid",
      errors: [],
      warnings,
      statistics,
      summary: {
        feasibility: "feasible",
        riskLevel: "low",
      },
    };
  }

  const hasStructuralFailure = errors.some((error) => [
    "invalid_structure",
    "malformed_entry",
    "invalid_day",
    "invalid_period",
    "invalid_id",
    "unauthorized_user_scope",
  ].includes(error.code));

  const hasImpossibleCapacity = errors.some((error) => error.code === "impossible_capacity");
  const hasOnlyCoverageIssues = errors.some((error) => ["under_placement", "over_placement"].includes(error.code));

  let status = "partial";
  if (hasStructuralFailure) {
    status = "validation_failed";
  } else if (hasImpossibleCapacity) {
    status = "infeasible";
  } else if (hasOnlyCoverageIssues) {
    status = "partial";
  }

  return {
    valid: false,
    status,
    errors,
    warnings,
    statistics,
    summary: {
      feasibility: hasImpossibleCapacity ? "not_feasible" : (errors.some((error) => ["under_placement", "over_placement"].includes(error.code)) ? "partially_feasible" : "infeasible"),
      riskLevel: hasStructuralFailure ? "high" : (hasImpossibleCapacity ? "high" : "medium"),
    },
  };
}

export default validateTimetable;
