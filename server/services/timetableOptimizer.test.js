import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOptimizedTimetable } from './timetableOptimizer.js';
import { buildTimeSlots } from './timeSlots.js';

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
      startTime: '08:00',
      endTime: '16:00',
      workingDays: 'Mon-Fri',
      periodsPerDay: '5',
      periodDuration: '45',
      timelineEvents: [
        { id: 'e1', title: 'Lunch', type: 'lunch', startTime: '12:00', endTime: '12:45', isTeachingBlocked: true },
      ],
    },
  };
}

function assertConstraints(result) {
  const days = Object.keys(result.timetable);
  const teacherUsage = new Map();

  for (const day of days) {
    const periodKeys = Object.keys(result.timetable[day]);

    for (const period of periodKeys) {
      const entries = result.timetable[day][period] || [];
      const seenTeachers = new Set();
      const seenClasses = new Set();

      for (const entry of entries) {
        if (entry.locked) continue;
        assert.ok(entry.teacher);
        assert.ok(entry.className);

        if (entry.teacher && entry.teacher !== '—' && entry.teacher !== 'Unassigned') {
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

test('builds teaching slots from timeline events and preserves fixed events', () => {
  const settings = {
    startTime: '08:00',
    endTime: '15:00',
    periodDuration: '45',
    timelineEvents: [
      { id: '1', title: 'Assembly', type: 'assembly', startTime: '08:00', endTime: '08:20' },
      { id: '2', title: 'Prayer', type: 'prayer', startTime: '08:20', endTime: '08:25' },
      { id: '3', title: 'Lunch', type: 'lunch', startTime: '12:00', endTime: '12:30' },
    ],
  };

  const slots = buildTimeSlots(settings);
  assert.ok(slots.some((slot) => slot.type === 'fixed' && slot.label === 'Assembly'));
  assert.ok(slots.some((slot) => slot.type === 'fixed' && slot.label === 'Lunch'));
  assert.ok(slots.some((slot) => slot.type === 'teaching'));
});

test('generates a conflict-free timetable that satisfies workload constraints', () => {
  const input = createSampleInput();
  const result = generateOptimizedTimetable(input, { candidateCount: 8, randomSeed: 9 });
  assertConstraints(result);
  assert.ok(result.score > 0);
});

test('produces different timetables for different random seeds', () => {
  const input = createSampleInput();
  const first = generateOptimizedTimetable(input, { candidateCount: 8, randomSeed: 1 });
  const second = generateOptimizedTimetable(input, { candidateCount: 8, randomSeed: 2 });

  assert.notDeepEqual(first.timetable, second.timetable);
});

test('respects teacher availability when placing lessons', () => {
  const input = {
    allocations: [
      { id: 'a1', classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 2 },
    ],
    teachers: [
      { id: 't1', name: 'Alice', subject: 'Maths', workload: '3', availability: 'Mon,Tue' },
    ],
    subjects: [{ id: 's1', name: 'Mathematics' }],
    classes: [{ id: 'c1', className: 'Grade 6', section: 'A' }],
    settings: {
      startTime: '08:45',
      endTime: '15:00',
      workingDays: 'Mon-Fri',
      periodsPerDay: '3',
      periodDuration: '45',
      timelineEvents: [],
    },
  };

  const result = generateOptimizedTimetable(input, { candidateCount: 4, randomSeed: 7 });
  const usedDays = new Set();

  for (const [day, periods] of Object.entries(result.timetable)) {
    for (const [period, entries] of Object.entries(periods)) {
      for (const entry of entries) {
        if (!entry.locked && entry.teacher === 'Alice') {
          usedDays.add(day);
        }
      }
    }
  }

  assert.ok(usedDays.size <= 2, 'Alice should not be scheduled outside her availability');
  assert.ok(!usedDays.has('Wed'), 'Alice should not appear on Wednesday');
});
