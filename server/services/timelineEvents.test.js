import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeSlots, getEffectiveTimelineEvents, convertLegacySettingsToEvents } from './timeSlots.js';
import { generateOptimizedTimetable } from './timetableOptimizer.js';

test('Timeline Creation: builds chronological timeline events & derived teaching slots', () => {
  const settings = {
    startTime: '09:00',
    endTime: '16:00',
    periodDuration: '45',
    timelineEvents: [
      { id: 'e1', title: 'Assembly', type: 'assembly', startTime: '09:00', endTime: '09:20', isTeachingBlocked: true },
      { id: 'e2', title: 'Lunch Break', type: 'lunch', startTime: '12:40', endTime: '13:20', isTeachingBlocked: true },
    ],
  };

  const slots = buildTimeSlots(settings);
  assert.ok(slots.length > 0, 'Should return non-empty list of slots');

  const assembly = slots.find((s) => s.label === 'Assembly');
  assert.ok(assembly, 'Assembly event slot should exist');
  assert.equal(assembly.type, 'fixed');
  assert.equal(assembly.start, '09:00');
  assert.equal(assembly.end, '09:20');

  const lunch = slots.find((s) => s.label === 'Lunch Break');
  assert.ok(lunch, 'Lunch event slot should exist');
  assert.equal(lunch.type, 'fixed');
  assert.equal(lunch.start, '12:40');
  assert.equal(lunch.end, '13:20');

  const teachingSlots = slots.filter((s) => s.type === 'teaching');
  assert.ok(teachingSlots.length >= 4, 'Derived teaching slots should be calculated dynamically');
});

test('Scheduler Respects Events: locks teachers and classes during timeline events', () => {
  const input = {
    allocations: [
      { id: 'a1', classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 3 },
    ],
    teachers: [
      { id: 't1', name: 'Dr. Smith', subject: 'Maths', workload: '5' },
    ],
    subjects: [{ id: 's1', name: 'Mathematics' }],
    classes: [{ id: 'c1', className: 'Grade 10', section: 'A' }],
    settings: {
      startTime: '09:00',
      endTime: '15:00',
      workingDays: 'Mon-Fri',
      periodDuration: '45',
      timelineEvents: [
        { id: 'evt-1', title: 'Assembly', type: 'assembly', startTime: '09:00', endTime: '09:20', isTeachingBlocked: true },
        { id: 'evt-2', title: 'Lunch Break', type: 'lunch', startTime: '12:00', endTime: '12:40', isTeachingBlocked: true },
      ],
    },
  };

  const result = generateOptimizedTimetable(input, { candidateCount: 4, randomSeed: 5 });

  for (const [day, periods] of Object.entries(result.timetable)) {
    for (const [periodKey, entries] of Object.entries(periods)) {
      for (const entry of entries) {
        if (entry.subject === 'Assembly' || entry.subject === 'Lunch Break') {
          assert.equal(entry.locked, true, 'Timeline events must be locked');
          assert.equal(entry.teacher, '—', 'No teacher assigned to timeline event slot');
        }
      }
    }
  }
});

test('Backward Compatibility Migration: converts legacy settings to timeline events', () => {
  const legacySettings = {
    startTime: '08:45',
    endTime: '15:30',
    periodDuration: '45',
    periodsPerDay: '8',
    assemblyPeriod: '1',
    lunchPosition: '5',
    lunchDuration: '40',
    breakPositions: '2',
    breakDurations: '10',
    timelineEvents: [], // empty
  };

  const events = getEffectiveTimelineEvents(legacySettings);
  assert.ok(events.length >= 3, 'Should automatically migrate assembly, break, and lunch into timeline events');

  const assembly = events.find((e) => e.type === 'assembly');
  assert.ok(assembly, 'Assembly event should be auto-created');

  const lunch = events.find((e) => e.type === 'lunch');
  assert.ok(lunch, 'Lunch event should be auto-created');

  const breakEvt = events.find((e) => e.type === 'break');
  assert.ok(breakEvt, 'Short break event should be auto-created');
});

test('Custom Event Persistence: handles unlimited custom event types and icons', () => {
  const customSettings = {
    startTime: '09:00',
    endTime: '16:00',
    periodDuration: '45',
    timelineEvents: [
      { id: 'c1', title: 'Robotics Club', type: 'club', startTime: '14:00', endTime: '14:30', icon: 'Target', isTeachingBlocked: true },
      { id: 'c2', title: 'Swimming Practice', type: 'sports', startTime: '15:00', endTime: '15:40', icon: 'Dumbbell', isTeachingBlocked: true },
    ],
  };

  const slots = buildTimeSlots(customSettings);
  const robotics = slots.find((s) => s.label === 'Robotics Club');
  assert.ok(robotics, 'Custom Robotics Club event slot should be created');
  assert.equal(robotics.icon, 'Target');

  const swimming = slots.find((s) => s.label === 'Swimming Practice');
  assert.ok(swimming, 'Custom Swimming Practice event slot should be created');
  assert.equal(swimming.icon, 'Dumbbell');
});

test('Multi-User Safety & Data Isolation Structure', () => {
  const user1Settings = {
    userId: 101,
    schoolName: 'School Alpha',
    timelineEvents: [
      { id: 'a1', title: 'Alpha Assembly', type: 'assembly', startTime: '09:00', endTime: '09:20' },
    ],
  };

  const user2Settings = {
    userId: 102,
    schoolName: 'School Beta',
    timelineEvents: [
      { id: 'b1', title: 'Beta Prayer', type: 'prayer', startTime: '08:30', endTime: '08:45' },
    ],
  };

  const alphaEvents = getEffectiveTimelineEvents(user1Settings);
  const betaEvents = getEffectiveTimelineEvents(user2Settings);

  assert.ok(alphaEvents.some((e) => e.title === 'Alpha Assembly'));
  assert.ok(!alphaEvents.some((e) => e.title === 'Beta Prayer'), 'User 1 must not see User 2 events');

  assert.ok(betaEvents.some((e) => e.title === 'Beta Prayer'));
  assert.ok(!betaEvents.some((e) => e.title === 'Alpha Assembly'), 'User 2 must not see User 1 events');
});
