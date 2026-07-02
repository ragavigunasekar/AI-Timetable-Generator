function parseWorkingDays(workingDays = 'Mon-Fri') {
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

function buildBaseTimetable(days, periodsPerDay, lunchDuration) {
  const timetable = {};
  const lunchPeriod = Math.max(1, Math.min(periodsPerDay, Math.floor(periodsPerDay / 2)));
  days.forEach((day) => {
    timetable[day] = {};
    for (let period = 1; period <= periodsPerDay; period += 1) {
      timetable[day][period] = [];
    }
    if (lunchDuration > 0) {
      timetable[day][lunchPeriod] = [{ subject: 'Lunch', className: 'Break', teacher: '—', locked: true }];
    }
  });

  return { timetable, lunchPeriod };
}

function getSubjectCategory(subjectName = '') {
  const normalized = subjectName.toLowerCase();
  if (['mathematics', 'science', 'physics', 'chemistry'].some((value) => normalized.includes(value))) return 'core';
  if (['language', 'tamil', 'english', 'hindi', 'art', 'activity', 'music', 'craft'].some((value) => normalized.includes(value))) return 'creative';
  return 'general';
}

function scoreTimetable(candidate) {
  const { timetable, days, periodsPerDay, lunchPeriod, allocations, teachers, subjects } = candidate;
  let score = 40;
  const teacherUsage = new Map();
  const subjectSpread = new Map();
  const daySubjectMix = new Map();
  const requiredPeriods = allocations.reduce((sum, allocation) => sum + Number(allocation.periods || 0), 0);
  let assignedPeriods = 0;

  for (const day of days) {
    const dailySubjects = new Set();
    let dayDifficulty = 0;
    for (let period = 1; period <= periodsPerDay; period += 1) {
      const entries = timetable[day][period] || [];
      for (const entry of entries) {
        if (entry.locked) continue;
        assignedPeriods += 1;
        const subjectCategory = getSubjectCategory(entry.subject);
        const teacherName = entry.teacher;
        const subjectName = entry.subject;

        teacherUsage.set(teacherName, (teacherUsage.get(teacherName) || 0) + 1);
        subjectSpread.set(subjectName, (subjectSpread.get(subjectName) || 0) + 1);
        dailySubjects.add(subjectName);

        if (period <= 2) score += subjectCategory === 'core' ? 6 : 2;
        if (period >= periodsPerDay - 1) score += subjectCategory === 'creative' ? 5 : 1.5;
        if (subjectCategory === 'core' && period > 2) score -= 1.5;
        if (subjectCategory === 'creative' && period <= 2) score -= 2;
        dayDifficulty += subjectCategory === 'core' ? 2 : 1;
      }
    }
    daySubjectMix.set(day, dailySubjects.size);
    score += dailySubjects.size >= 3 ? 5 : 2;
    score += dayDifficulty >= 4 ? 3 : 0;
  }

  if (assignedPeriods === requiredPeriods) score += 25;

  const teacherCapacityPenalty = [...teacherUsage.entries()].reduce((sum, [teacherName, count]) => {
    const teacher = teachers.find((item) => item.name === teacherName);
    const limit = Number(teacher?.workload || 999);
    return sum + (count > limit ? 40 : 0);
  }, 0);
  score -= teacherCapacityPenalty;

  const unevenDistributionPenalty = [...subjectSpread.entries()].reduce((sum, [subjectName, count]) => {
    const expected = requiredPeriods / Math.max(1, subjects.length);
    return sum + Math.max(0, Math.abs(count - expected) * 2.2);
  }, 0);
  score -= unevenDistributionPenalty;

  const repeatedSequencePenalty = days.reduce((sum, day) => {
    const sequence = Object.keys(timetable[day] || {})
      .map((period) => timetable[day][period].find((entry) => !entry.locked)?.subject || 'Free')
      .filter((value, index, values) => index === values.findIndex((candidate) => candidate === value));
    const repeated = sequence.filter((subject, index) => subject === sequence[index + 1]).length;
    return sum + repeated * 7;
  }, 0);
  score -= repeatedSequencePenalty;

  const lunchPenalty = lunchPeriod ? 0 : 0;
  score += lunchPenalty;

  return score;
}

function buildCandidateTimetable(input, options = {}) {
  const { allocations = [], teachers = [], subjects = [], classes = [], settings = {} } = input;
  const days = parseWorkingDays(settings.workingDays || 'Mon-Fri');
  const periodsPerDay = Math.max(1, Number(settings.periodsPerDay) || 8);
  const lunchDuration = Math.max(0, Number(settings.lunchDuration) || 0);
  const { timetable, lunchPeriod } = buildBaseTimetable(days, periodsPerDay, lunchDuration);

  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const classMap = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass]));

  const teacherUsage = new Map();
  const classUsage = new Map();
  const teacherDayUsage = new Map();
  const classDaySubjectUsage = new Map();
  const teacherDayPeriod = new Map();
  const classDayPeriod = new Map();

  const assignmentOrder = [...allocations]
    .filter((allocation) => allocation.classId && allocation.subjectId)
    .sort((a, b) => Number(b.periods) - Number(a.periods));

  const rng = makeSeededRandom((options.randomSeed || 1) + assignmentOrder.length * 97);

  for (const allocation of assignmentOrder) {
    const subject = subjectMap.get(allocation.subjectId);
    const schoolClass = classMap.get(allocation.classId);
    const teacher = allocation.teacherId ? teacherMap.get(allocation.teacherId) : null;
    const requestedPeriods = Math.max(1, Number(allocation.periods) || 1);
    const className = schoolClass ? `${schoolClass.className}-${schoolClass.section}` : 'Unknown Class';

    for (let slot = 0; slot < requestedPeriods; slot += 1) {
      const optionsList = [];
      for (const day of days) {
        for (let period = 1; period <= periodsPerDay; period += 1) {
          if (lunchDuration > 0 && period === lunchPeriod) continue;

          const teacherKey = `${day}-${teacher?.name || 'Unassigned'}-${period}`;
          const classKey = `${day}-${className}-${period}`;
          if (teacherDayPeriod.get(teacherKey) || classDayPeriod.get(classKey)) continue;

          const teacherPeriods = (teacherUsage.get(teacher?.id || 'unassigned') || 0) + 1;
          const teacherLimit = teacher ? Number(teacher.workload) || 999 : 999;
          if (teacher && teacherPeriods > teacherLimit) continue;

          const classPeriods = (classUsage.get(schoolClass?.id || 'unknown') || 0) + 1;
          const classCapacity = days.length * periodsPerDay;
          if (classPeriods > classCapacity) continue;

          const previousEntry = (timetable[day][period - 1] || []).find((entry) => !entry.locked);
          const nextEntry = (timetable[day][period + 1] || []).find((entry) => !entry.locked);
          const subjectCategory = getSubjectCategory(subject?.name || '');
          const dayTeacherCount = teacherDayUsage.get(`${day}-${teacher?.name || 'Unassigned'}`) || 0;
          const sameSubjectCount = classDaySubjectUsage.get(`${className}-${day}-${subject?.name || 'Unknown Subject'}`) || 0;

          let placementScore = 0;
          if (period <= 2) placementScore += subjectCategory === 'core' ? 14 : 4;
          if (period >= periodsPerDay - 1) placementScore += subjectCategory === 'creative' ? 10 : 3;
          if (subjectCategory === 'core' && period > 2) placementScore -= 3;
          if (subjectCategory === 'creative' && period <= 2) placementScore -= 2;
          placementScore -= dayTeacherCount * 2.4;
          placementScore -= sameSubjectCount * 2.6;
          if (previousEntry && previousEntry.subject === subject?.name) placementScore -= 4;
          if (previousEntry && getSubjectCategory(previousEntry.subject) !== subjectCategory) placementScore += 2;
          if (nextEntry && nextEntry.subject === subject?.name) placementScore -= 3;
          if (nextEntry && getSubjectCategory(nextEntry.subject) !== subjectCategory) placementScore += 1.5;
          placementScore += rng() * 2;

          optionsList.push({ day, period, score: placementScore });
        }
      }

      if (optionsList.length === 0) {
        const fallbackDay = days[0];
        const fallbackPeriod = 1;
        timetable[fallbackDay][fallbackPeriod].push({ subject: subject?.name || 'Unknown Subject', className, teacher: teacher?.name || 'Unassigned' });
        continue;
      }

      const bestScore = Math.max(...optionsList.map((option) => option.score));
      const bestOptions = optionsList.filter((option) => option.score >= bestScore - 0.1);
      const choice = bestOptions[Math.floor(rng() * bestOptions.length)];

      timetable[choice.day][choice.period].push({
        subject: subject?.name || 'Unknown Subject',
        className,
        teacher: teacher?.name || 'Unassigned',
      });
      teacherUsage.set(teacher?.id || 'unassigned', (teacherUsage.get(teacher?.id || 'unassigned') || 0) + 1);
      classUsage.set(schoolClass?.id || 'unknown', (classUsage.get(schoolClass?.id || 'unknown') || 0) + 1);
      teacherDayUsage.set(`${choice.day}-${teacher?.name || 'Unassigned'}`, (teacherDayUsage.get(`${choice.day}-${teacher?.name || 'Unassigned'}`) || 0) + 1);
      classDaySubjectUsage.set(`${className}-${choice.day}-${subject?.name || 'Unknown Subject'}`, (classDaySubjectUsage.get(`${className}-${choice.day}-${subject?.name || 'Unknown Subject'}`) || 0) + 1);
      teacherDayPeriod.set(`${choice.day}-${teacher?.name || 'Unassigned'}-${choice.period}`, true);
      classDayPeriod.set(`${choice.day}-${className}-${choice.period}`, true);
    }
  }

  return { timetable, lunchPeriod, allocations, teachers, subjects, classes, days, periodsPerDay, lunchDuration };
}

function optimizeLocally(candidate, options = {}) {
  let best = candidate;
  let bestScore = scoreTimetable(candidate);

  for (let round = 0; round < (options.localSearchRounds || 6); round += 1) {
    const next = JSON.parse(JSON.stringify(candidate));
    const dayOrder = [...next.days];
    const sourceDay = dayOrder[round % dayOrder.length];
    const targetDay = dayOrder[(round + 1) % dayOrder.length];

    const sourceSlots = Object.entries(next.timetable[sourceDay] || {})
      .filter(([, entries]) => entries.some((entry) => !entry.locked))
      .map(([period, entries]) => ({ period: Number(period), entries }));
    const targetSlots = Object.entries(next.timetable[targetDay] || {})
      .filter(([, entries]) => entries.length === 0)
      .map(([period]) => ({ period: Number(period) }));

    if (sourceSlots.length === 0 || targetSlots.length === 0) continue;
    const sourceSlot = sourceSlots[round % sourceSlots.length];
    const targetSlot = targetSlots[(round + 2) % targetSlots.length];
    if (!sourceSlot || !targetSlot) continue;

    const movedEntries = sourceSlot.entries.filter((entry) => !entry.locked);
    next.timetable[sourceDay][sourceSlot.period] = [];
    next.timetable[targetDay][targetSlot.period] = movedEntries;

    const score = scoreTimetable(next);
    if (score > bestScore) {
      best = next;
      bestScore = score;
    }
  }

  return best;
}

export function generateOptimizedTimetable(input, options = {}) {
  const candidateCount = Math.max(1, Number(options.candidateCount) || 8);
  const localSearchRounds = Math.max(1, Number(options.localSearchRounds) || 6);
  const randomSeed = Number(options.randomSeed) || 1;

  const candidates = [];
  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = buildCandidateTimetable(input, { randomSeed: randomSeed + index * 17 });
    const optimized = optimizeLocally(candidate, { localSearchRounds, randomSeed: randomSeed + index * 13 });
    candidates.push(optimized);
  }

  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreTimetable(candidate) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.candidate;
  const requiredPeriods = input.allocations.reduce((sum, allocation) => sum + Number(allocation.periods || 0), 0);

  return {
    timetable: best.timetable,
    score: scored[0]?.score || 0,
    meta: {
      days: best.days,
      periodsPerDay: best.periodsPerDay,
      lunchPeriod: best.lunchPeriod,
      requiredPeriods,
      totalAssignments: Object.values(best.timetable).reduce((sum, periods) => sum + Object.values(periods).reduce((acc, entries) => acc + entries.filter((entry) => !entry.locked).length, 0), 0),
      teachers: input.teachers,
    },
  };
}
