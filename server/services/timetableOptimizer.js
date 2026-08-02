import { buildTimeSlots, getEffectiveTimelineEvents } from './timeSlots.js';

export function parseWorkingDays(workingDays = 'Mon-Fri') {
  const trimmed = workingDays?.trim();
  if (!trimmed) return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const normalized = trimmed.replace(/\s+/g, '');
  const ordered = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const capitalize = (value) => {
    if (!value) return '';
    const lower = value.toLowerCase();
    if (lower.startsWith('mon')) return 'Mon';
    if (lower.startsWith('tue')) return 'Tue';
    if (lower.startsWith('wed')) return 'Wed';
    if (lower.startsWith('thu')) return 'Thu';
    if (lower.startsWith('fri')) return 'Fri';
    if (lower.startsWith('sat')) return 'Sat';
    if (lower.startsWith('sun')) return 'Sun';
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  };

  if (/^[A-Za-z]+-[A-Za-z]+$/.test(normalized)) {
    const [start, end] = normalized.split('-');
    const startIndex = ordered.indexOf(capitalize(start));
    const endIndex = ordered.indexOf(capitalize(end));
    if (startIndex >= 0 && endIndex >= 0 && endIndex >= startIndex) {
      return ordered.slice(startIndex, endIndex + 1);
    }
  }

  return normalized
    .split(',')
    .map((day) => capitalize(day.trim()))
    .filter((day) => ordered.includes(day));
}

function makeSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the base timetable structure:
 * - Fixed timeline event slots get locked entries
 * - Teaching slots get empty arrays
 * Period keys are derived entirely from buildTimeSlots — no hardcoded Period1..8 assumptions.
 */
export function buildBaseTimetable(days, periodsPerDay, _lunchDuration, settings = {}) {
  const timetable = {};

  days.forEach((day) => {
    timetable[day] = {};
    const slots = buildTimeSlots(settings, day);

    slots.forEach((slot) => {
      if (slot.type === 'fixed') {
        const slotKey = slot.period;
        timetable[day][slotKey] = [
          {
            subject: slot.label,
            className: 'All',
            teacher: '—',
            locked: true,
            type: 'fixed',
            eventType: slot.eventType || 'custom',
            icon: slot.icon || 'Clock',
            startTime: slot.start,
            endTime: slot.end,
          },
        ];
      } else {
        timetable[day][slot.period] = [];
      }
    });
  });

  return { timetable };
}

function getSubjectCategory(subjectName = '') {
  const normalized = subjectName.toLowerCase();
  if (['mathematics', 'math', 'maths', 'science', 'physics', 'chemistry', 'biology'].some((value) => normalized.includes(value))) return 'core';
  if (['language', 'tamil', 'english', 'hindi', 'art', 'activity', 'music', 'craft', 'sports', 'pe'].some((value) => normalized.includes(value))) return 'creative';
  return 'general';
}

export function scoreTimetable(candidate) {
  const { timetable, days, allocations, teachers, subjects, unplacedAllocations } = candidate;
  let score = 150;
  const teacherUsage = new Map();
  const subjectSpread = new Map();
  const requiredPeriods = allocations.reduce((sum, allocation) => sum + Number(allocation.periods || 0), 0);
  let assignedPeriods = 0;
  let consecutivePeriodsPenalty = 0;
  let gapPenalty = 0;
  let workloadPenalty = 0;

  const teacherAvailabilityMap = new Map(
    (teachers || []).map((teacher) => [
      teacher.name,
      new Set((teacher.availability || '').split(',').map((value) => value.trim()).filter(Boolean)),
    ])
  );

  for (const day of days) {
    const dailySubjects = new Set();
    const teacherConsecutive = new Map();
    const classPeriodsMap = new Map();

    const periodKeys = Object.keys(timetable[day] || {}).map(Number).sort((a, b) => a - b);
    const periodsPerDay = periodKeys.length;

    for (const period of periodKeys) {
      const entries = timetable[day][period] || [];
      const currentPeriodTeachers = new Set();

      for (const entry of entries) {
        if (entry.locked) continue;
        assignedPeriods += 1;
        const subjectCategory = getSubjectCategory(entry.subject);
        const teacherName = entry.teacher;
        const subjectName = entry.subject;
        const className = entry.className;

        if (className) {
          if (!classPeriodsMap.has(className)) {
            classPeriodsMap.set(className, []);
          }
          classPeriodsMap.get(className).push(period);
        }

        if (teacherName && teacherName !== 'Unassigned' && teacherName !== '—') {
          teacherUsage.set(teacherName, (teacherUsage.get(teacherName) || 0) + 1);
          currentPeriodTeachers.add(teacherName);
        }
        subjectSpread.set(subjectName, (subjectSpread.get(subjectName) || 0) + 1);
        dailySubjects.add(subjectName);

        // Subject timing preferences (Core morning, Creative afternoon)
        if (period <= 2) score += subjectCategory === 'core' ? 8 : 2;
        if (period >= Math.max(1, periodsPerDay - 2)) score += subjectCategory === 'creative' ? 6 : 1;
        if (subjectCategory === 'core' && period > 3) score -= 1.5;
      }

      for (const t of teacherConsecutive.keys()) {
        if (currentPeriodTeachers.has(t)) {
          teacherConsecutive.set(t, teacherConsecutive.get(t) + 1);
          if (teacherConsecutive.get(t) > 3) {
            consecutivePeriodsPenalty += 10;
          }
        } else {
          teacherConsecutive.set(t, 0);
        }
      }
      for (const t of currentPeriodTeachers) {
        if (!teacherConsecutive.has(t)) {
          teacherConsecutive.set(t, 1);
        }
      }
    }

    for (const [, activePeriods] of classPeriodsMap.entries()) {
      if (activePeriods.length < 2) continue;
      activePeriods.sort((a, b) => a - b);

      for (let i = 0; i < activePeriods.length - 1; i++) {
        const currentPeriod = activePeriods[i];
        const nextPeriod = activePeriods[i + 1];
        const periodDiff = nextPeriod - currentPeriod;
        if (periodDiff > 1) {
          let gapCount = 0;
          for (let p = currentPeriod + 1; p < nextPeriod; p++) {
            const isLocked = (timetable[day][p] || []).some((entry) => entry.locked);
            if (!isLocked) gapCount += 1;
          }

          if (gapCount > 0) {
            gapPenalty += gapCount * 10;
          }
        }
      }
    }
  }

  score -= consecutivePeriodsPenalty;
  score -= gapPenalty;

  for (const [teacherName, count] of teacherUsage.entries()) {
    const teacher = teachers.find((item) => item.name === teacherName);
    const limit = Number(teacher?.workload || 999);
    if (count > limit) {
      workloadPenalty += (count - limit) * 36;
    }
    const availability = teacherAvailabilityMap.get(teacherName);
    if (availability && availability.size > 0) {
      const assignedDays = new Set();
      for (const day of days) {
        const hasEntry = Object.values(timetable[day] || {}).some((entries) =>
          entries.some((entry) => entry.teacher === teacherName && !entry.locked)
        );
        if (hasEntry) assignedDays.add(day);
      }
      const outsideAvailability = [...assignedDays].filter((day) => !availability.has(day));
      if (outsideAvailability.length > 0) {
        workloadPenalty += outsideAvailability.length * 60;
      }
    }
  }
  score -= workloadPenalty;

  score -= unplacedAllocations.length * 65;
  if (assignedPeriods === requiredPeriods && unplacedAllocations.length === 0) score += 50;

  return score;
}

/**
 * Attempts to swap an existing placed entry out of a slot to make room for a new allocation.
 * Returns true if the swap succeeded (the displaced entry found an alternate slot).
 */
function trySwapIntoSlot(
  day,
  period,
  teacherName,
  className,
  subjectName,
  teacher,
  schoolClass,
  timetable,
  teacherSlotMap,
  classSlotMap,
  teacherUsage,
  classUsage,
  teacherDayUsage,
  classDaySubjectUsage,
  placed,
  settings,
  days,
  rng
) {
  // Find a non-locked entry in the target slot that can be moved
  const targetEntries = timetable[day][period] || [];
  const movableEntries = targetEntries.filter((e) => !e.locked);

  for (const victim of movableEntries) {
    // Try to find an alternate slot for the victim
    const victimTeacherKey = (key) => `${key.day}-${victim.teacher}-${key.period}`;
    const victimClassKey = (key) => `${key.day}-${victim.className}-${key.period}`;

    const alternateSlotsForDay = (altDay) => {
      return buildTimeSlots(settings, altDay)
        .filter((s) => s.type === 'teaching' && s.period !== period)
        .filter((s) => {
          const altTeacherKey = `${altDay}-${victim.teacher}-${s.period}`;
          const altClassKey = `${altDay}-${victim.className}-${s.period}`;
          const targetLocked = (timetable[altDay]?.[s.period] || []).some((e) => e.locked);
          return !targetLocked && !teacherSlotMap.has(altTeacherKey) && !classSlotMap.has(altClassKey);
        });
    };

    // Try current day first, then other days
    const orderedDays = [day, ...days.filter((d) => d !== day)];
    let displaced = false;
    for (const altDay of orderedDays) {
      const altSlots = alternateSlotsForDay(altDay);
      if (altSlots.length === 0) continue;

      const altSlot = altSlots[Math.floor(rng() * altSlots.length)];

      // Remove victim from current slot
      const victimIdx = targetEntries.findIndex(
        (e) => e.subject === victim.subject && e.className === victim.className && e.teacher === victim.teacher
      );
      if (victimIdx >= 0) {
        targetEntries.splice(victimIdx, 1);
        teacherSlotMap.delete(`${day}-${victim.teacher}-${period}`);
        classSlotMap.delete(`${day}-${victim.className}-${period}`);
        const pi = placed.findIndex(
          (p) => p.day === day && p.period === period && p.teacherName === victim.teacher && p.className === victim.className
        );
        if (pi >= 0) placed.splice(pi, 1);

        // Place victim in alternate slot
        if (!timetable[altDay]) timetable[altDay] = {};
        if (!timetable[altDay][altSlot.period]) timetable[altDay][altSlot.period] = [];
        timetable[altDay][altSlot.period].push({
          subject: victim.subject,
          className: victim.className,
          teacher: victim.teacher,
        });
        teacherSlotMap.set(`${altDay}-${victim.teacher}-${altSlot.period}`, true);
        classSlotMap.set(`${altDay}-${victim.className}-${altSlot.period}`, true);
        placed.push({
          day: altDay,
          period: altSlot.period,
          teacherName: victim.teacher,
          className: victim.className,
          subjectName: victim.subject,
        });

        displaced = true;
        break;
      }
    }

    if (displaced) return true;
  }

  return false;
}

function buildCandidateTimetable(input, options = {}) {
  const { allocations = [], teachers = [], subjects = [], classes = [], settings = {} } = input;
  const days = parseWorkingDays(settings.workingDays || 'Mon-Fri');
  const targetPeriodsPerDay = Math.max(1, Number(settings.periodsPerDay) || 8);

  const { timetable } = buildBaseTimetable(days, targetPeriodsPerDay, Number(settings.lunchDuration) || 0, settings);

  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const classMap = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass]));

  const teacherUsage = new Map();
  const classUsage = new Map();
  const teacherDayUsage = new Map();
  const classDaySubjectUsage = new Map();
  const teacherSlotMap = new Map();
  const classSlotMap = new Map();

  const teacherAvailability = new Map(
    teachers.map((teacher) => [
      teacher.name,
      new Set((teacher.availability || '').split(',').map((value) => value.trim()).filter(Boolean)),
    ])
  );

  const unplacedAllocations = [];
  const conflicts = [];
  const rng = makeSeededRandom((options.randomSeed || 1) + 97);
  const placed = [];

  // Sort: most constrained allocations first (highest periods, fewest available slots)
  const assignmentOrder = [...allocations]
    .filter((allocation) => allocation.classId && allocation.subjectId)
    .sort((a, b) => Number(b.periods) - Number(a.periods));

  const buildCandidatePlacements = (allocation, teacherName, className, subjectName) => {
    const subjectCategory = getSubjectCategory(subjectName);
    const placements = [];

    for (const day of days) {
      const slotsForDay = buildTimeSlots(settings, day).filter((s) => s.type === 'teaching');
      for (const teachingSlot of slotsForDay) {
        const period = teachingSlot.period;
        const entriesInSlot = timetable[day][period] || [];
        if (entriesInSlot.some((entry) => entry.locked)) continue;

        const teacherKey = `${day}-${teacherName}-${period}`;
        const classKey = `${day}-${className}-${period}`;
        if (teacherName !== 'Unassigned' && teacherSlotMap.has(teacherKey)) continue;
        if (classSlotMap.has(classKey)) continue;

        const teacher = allocation.teacherId ? teacherMap.get(allocation.teacherId) : null;
        const teacherPeriods = (teacherUsage.get(teacher?.id || 'unassigned') || 0) + 1;
        const teacherLimit = teacher ? Number(teacher.workload) || 999 : 999;
        if (teacher && teacherPeriods > teacherLimit) continue;

        const availability = teacherAvailability.get(teacherName);
        if (teacher && availability && availability.size > 0 && !availability.has(day)) continue;

        const dayTeacherCount = teacherDayUsage.get(`${day}-${teacherName}`) || 0;
        const sameSubjectCount = classDaySubjectUsage.get(`${className}-${day}-${subjectName}`) || 0;

        let placementScore = 0;
        if (period <= 2) placementScore += subjectCategory === 'core' ? 14 : 4;
        if (period >= Math.max(1, slotsForDay.length - 1)) placementScore += subjectCategory === 'creative' ? 10 : 3;
        if (subjectCategory === 'core' && period > 3) placementScore -= 3;
        placementScore -= dayTeacherCount * 2.2;
        placementScore -= sameSubjectCount * 3.5;
        placementScore += rng() * 2;

        placements.push({ day, period, score: placementScore, slotsForDay });
      }
    }

    return placements.sort((a, b) => b.score - a.score);
  };

  const placeEntry = (day, period, teacherName, className, subjectName, teacher, schoolClass) => {
    timetable[day][period].push({ subject: subjectName, className, teacher: teacherName });
    teacherUsage.set(teacher?.id || 'unassigned', (teacherUsage.get(teacher?.id || 'unassigned') || 0) + 1);
    classUsage.set(schoolClass?.id || 'unknown', (classUsage.get(schoolClass?.id || 'unknown') || 0) + 1);
    teacherDayUsage.set(`${day}-${teacherName}`, (teacherDayUsage.get(`${day}-${teacherName}`) || 0) + 1);
    classDaySubjectUsage.set(`${className}-${day}-${subjectName}`, (classDaySubjectUsage.get(`${className}-${day}-${subjectName}`) || 0) + 1);
    teacherSlotMap.set(`${day}-${teacherName}-${period}`, true);
    classSlotMap.set(`${day}-${className}-${period}`, true);
    placed.push({ day, period, teacherName, className, subjectName });
  };

  const removeEntry = (day, period, teacherName, className, subjectName, teacher, schoolClass) => {
    const entries = timetable[day][period] || [];
    const index = entries.findIndex((entry) => entry.subject === subjectName && entry.className === className && entry.teacher === teacherName);
    if (index >= 0) entries.splice(index, 1);

    teacherUsage.set(teacher?.id || 'unassigned', Math.max(0, (teacherUsage.get(teacher?.id || 'unassigned') || 0) - 1));
    classUsage.set(schoolClass?.id || 'unknown', Math.max(0, (classUsage.get(schoolClass?.id || 'unknown') || 0) - 1));
    teacherDayUsage.set(`${day}-${teacherName}`, Math.max(0, (teacherDayUsage.get(`${day}-${teacherName}`) || 0) - 1));
    classDaySubjectUsage.set(`${className}-${day}-${subjectName}`, Math.max(0, (classDaySubjectUsage.get(`${className}-${day}-${subjectName}`) || 0) - 1));
    teacherSlotMap.delete(`${day}-${teacherName}-${period}`);
    classSlotMap.delete(`${day}-${className}-${period}`);
    const lastIndex = placed.findIndex((entry) => entry.day === day && entry.period === period && entry.teacherName === teacherName && entry.className === className && entry.subjectName === subjectName);
    if (lastIndex >= 0) placed.splice(lastIndex, 1);
  };

  const tryAssignAllocation = (allocationIndex) => {
    if (allocationIndex >= assignmentOrder.length) return true;

    const allocation = assignmentOrder[allocationIndex];
    const subject = subjectMap.get(allocation.subjectId);
    const schoolClass = classMap.get(allocation.classId);
    const teacher = allocation.teacherId ? teacherMap.get(allocation.teacherId) : null;
    const requestedPeriods = Math.max(1, Number(allocation.periods) || 1);
    const className = schoolClass ? `${schoolClass.className}-${schoolClass.section}` : 'Unknown Class';
    const teacherName = teacher?.name || 'Unassigned';
    const subjectName = subject?.name || 'Unknown Subject';

    const tryPlacePeriods = (remainingPeriods, usedSlots = new Set()) => {
      if (remainingPeriods === 0) return tryAssignAllocation(allocationIndex + 1);

      const candidates = buildCandidatePlacements(allocation, teacherName, className, subjectName)
        .filter((candidate) => !usedSlots.has(`${candidate.day}-${candidate.period}`));

      if (candidates.length === 0) return false;

      for (const candidate of candidates) {
        const slotKey = `${candidate.day}-${candidate.period}`;
        const nextUsedSlots = new Set(usedSlots);
        nextUsedSlots.add(slotKey);
        placeEntry(candidate.day, candidate.period, teacherName, className, subjectName, teacher, schoolClass);
        if (tryPlacePeriods(remainingPeriods - 1, nextUsedSlots)) return true;
        removeEntry(candidate.day, candidate.period, teacherName, className, subjectName, teacher, schoolClass);
      }

      return false;
    };

    if (!tryPlacePeriods(requestedPeriods)) {
      // Backtracking failed — attempt swap-based recovery for each period needed
      let swapSuccessCount = 0;
      const swapUsed = new Set();

      for (const day of days) {
        if (swapSuccessCount >= requestedPeriods) break;
        const slotsForDay = buildTimeSlots(settings, day).filter((s) => s.type === 'teaching');
        for (const slot of slotsForDay) {
          if (swapSuccessCount >= requestedPeriods) break;
          const slotKey = `${day}-${slot.period}`;
          if (swapUsed.has(slotKey)) continue;

          const teacherKey = `${day}-${teacherName}-${slot.period}`;
          const classKey = `${day}-${className}-${slot.period}`;
          const slotEntries = timetable[day][slot.period] || [];
          const isLocked = slotEntries.some((e) => e.locked);
          const teacherFree = teacherName === 'Unassigned' || !teacherSlotMap.has(teacherKey);
          const classFree = !classSlotMap.has(classKey);

          // If slot is free for both teacher and class, place directly
          if (!isLocked && teacherFree && classFree) {
            placeEntry(day, slot.period, teacherName, className, subjectName, teacher, schoolClass);
            swapUsed.add(slotKey);
            swapSuccessCount++;
            continue;
          }

          // If slot is occupied but not locked, try displacing the occupant
          if (!isLocked && !teacherFree || (!isLocked && !classFree)) {
            const swapped = trySwapIntoSlot(
              day, slot.period,
              teacherName, className, subjectName, teacher, schoolClass,
              timetable, teacherSlotMap, classSlotMap,
              teacherUsage, classUsage, teacherDayUsage, classDaySubjectUsage,
              placed, settings, days, rng
            );
            if (swapped) {
              // Verify the slot is now usable
              const recheckTeacherFree = teacherName === 'Unassigned' || !teacherSlotMap.has(teacherKey);
              const recheckClassFree = !classSlotMap.has(classKey);
              if (recheckTeacherFree && recheckClassFree && !(timetable[day][slot.period] || []).some((e) => e.locked)) {
                placeEntry(day, slot.period, teacherName, className, subjectName, teacher, schoolClass);
                swapUsed.add(slotKey);
                swapSuccessCount++;
              }
            }
          }
        }
      }

      if (swapSuccessCount < requestedPeriods) {
        const conflictDetails = {
          allocationId: allocation.id,
          teacherName,
          className,
          subjectName,
          reason: `Only ${swapSuccessCount}/${requestedPeriods} periods could be placed after backtracking and swap recovery`,
        };
        unplacedAllocations.push(conflictDetails);
        conflicts.push(conflictDetails);
      }

      return tryAssignAllocation(allocationIndex + 1);
    }

    return true;
  };

  tryAssignAllocation(0);

  return {
    timetable,
    unplacedAllocations,
    conflicts,
    allocations,
    teachers,
    subjects,
    classes,
    days,
    periodsPerDay: targetPeriodsPerDay,
    placed,
  };
}

export function generateOptimizedTimetable(input, options = {}) {
  const candidateCount = Math.max(1, Number(options.candidateCount) || 8);
  const randomSeed = Number(options.randomSeed) || 1;

  const candidates = [];
  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = buildCandidateTimetable(input, { randomSeed: randomSeed + index * 17 });
    candidates.push(candidate);
  }

  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreTimetable(candidate) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.candidate || candidates[0];
  const requiredPeriods = input.allocations.reduce((sum, allocation) => sum + Number(allocation.periods || 0), 0);

  return {
    timetable: best.timetable,
    conflicts: best.conflicts,
    unplacedAllocations: best.unplacedAllocations,
    score: scored[0]?.score || 0,
    meta: {
      days: best.days,
      periodsPerDay: best.periodsPerDay,
      requiredPeriods,
      totalAssignments: Object.values(best.timetable).reduce(
        (sum, periods) =>
          sum +
          Object.values(periods).reduce(
            (acc, entries) => acc + entries.filter((entry) => !entry.locked).length,
            0
          ),
        0
      ),
      teachers: input.teachers,
    },
  };
}

export default generateOptimizedTimetable;
