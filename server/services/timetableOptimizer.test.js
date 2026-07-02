import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOptimizedTimetable } from './timetableOptimizer.js';

function createSampleInput() {
  return {
    allocations: [
      { id: 'a1', classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 4 },
      { id: 'a2', classId: 'c1', subjectId: 's2', teacherId: 't2', periods: 3 },
      { id: 'a3', classId: 'c2', subjectId: 's3', teacherId: 't3', periods: 3 },
      { id: 'a4', classId: 'c2', subjectId: 's4', teacherId: 't1', periods: 2 },
      { id: 'a5', classId: 'c3', subjectId: 's5', teacherId: 't4', periods: 2 },
      { id: 'a6', classId: 'c3', subjectId: 's6', teacherId: 't2', periods: 2 },
    ],
    teachers: [
      { id: 't1', name: 'Alice', subject: 'Maths', workload: '6' },
      { id: 't2', name: 'Bob', subject: 'Science', workload: '5' },
      { id: 't3', name: 'Cara', subject: 'English', workload: '4' },
      { id: 't4', name: 'Drew', subject: 'Art', workload: '3' },
    ],
    subjects: [
      { id: 's1', name: 'Mathematics' },
      { id: 's2', name: 'Science' },
      { id: 's3', name: 'English' },
      { id: 's4', name: 'History' },
      { id: 's5', name: 'Art' },
      { id: 's6', name: 'Tamil' },
    ],
    classes: [
      { id: 'c1', className: 'Grade 6', section: 'A' },
      { id: 'c2', className: 'Grade 6', section: 'B' },
      { id: 'c3', className: 'Grade 7', section: 'A' },
    ],
    settings: {
      workingDays: 'Mon-Fri',
      periodsPerDay: '5',
      lunchDuration: '1',
    },
  };
}

function assertConstraints(result) {
  const days = Object.keys(result.timetable);
  const periodsPerDay = Object.keys(result.timetable[days[0]] || {}).length;
  const lunchPeriod = Math.max(1, Math.min(periodsPerDay, Math.floor(periodsPerDay / 2)));

  const teacherUsage = new Map();
  const classUsage = new Map();

  for (const day of days) {
    for (let period = 1; period <= periodsPerDay; period += 1) {
      const entries = result.timetable[day][period] || [];
      const seenTeachers = new Set();
      const seenClasses = new Set();

      for (const entry of entries) {
        if (entry.locked || entry.subject === 'Lunch') continue;
        assert.notEqual(period, lunchPeriod);
        assert.ok(entry.teacher);
        assert.ok(entry.className);

        if (entry.teacher) {
          assert.ok(!seenTeachers.has(entry.teacher), `Teacher ${entry.teacher} double-booked on ${day} period ${period}`);
          seenTeachers.add(entry.teacher);
        }

        if (entry.className) {
          assert.ok(!seenClasses.has(entry.className), `Class ${entry.className} double-booked on ${day} period ${period}`);
          seenClasses.add(entry.className);
        }

        const teacherCount = (teacherUsage.get(entry.teacher) || 0) + 1;
        teacherUsage.set(entry.teacher, teacherCount);
      }
    }
  }

  for (const teacher of result.meta.teachers) {
    const total = teacherUsage.get(teacher.name) || 0;
    assert.ok(total <= Number(teacher.workload), `${teacher.name} exceeds workload`);
  }

  assert.equal(result.meta.totalAssignments, result.meta.requiredPeriods);
}

test('generates a conflict-free timetable that satisfies workload and lunch constraints', () => {
  const input = createSampleInput();
  const result = generateOptimizedTimetable(input, { candidateCount: 8, localSearchRounds: 6, randomSeed: 9 });
  assertConstraints(result);
  assert.ok(result.score > 0);
});

test('produces different timetables for different random seeds', () => {
  const input = createSampleInput();
  const first = generateOptimizedTimetable(input, { candidateCount: 8, localSearchRounds: 6, randomSeed: 1 });
  const second = generateOptimizedTimetable(input, { candidateCount: 8, localSearchRounds: 6, randomSeed: 2 });

  assert.notDeepEqual(first.timetable, second.timetable);
});
