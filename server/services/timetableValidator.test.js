import validateTimetable from './timetableValidator.js';

const settings = {
  schoolName: 'Test School',
  workingDays: 'Mon-Fri',
  startTime: '08:45',
  endTime: '15:45',
  periodDuration: 45,
  periodsPerDay: 6,
  lunchDuration: 45,
  lunchPosition: 3,
  breakPositions: '2,4',
  breakDurations: '10,10',
  timelineEvents: [],
};

const teachers = [
  { id: 't1', userId: 1, name: 'Teacher A', code: 'T1', availability: 'Mon,Tue,Wed,Thu,Fri', workload: 18 },
  { id: 't2', userId: 1, name: 'Teacher B', code: 'T2', availability: 'Mon,Tue,Wed,Thu,Fri', workload: 18 },
];

const classes = [
  { id: 'c1', userId: 1, className: 'A', section: '1' },
  { id: 'c2', userId: 1, className: 'B', section: '1' },
];

const subjects = [
  { id: 's1', userId: 1, name: 'Math', periodsPerWeek: '4' },
  { id: 's2', userId: 1, name: 'Science', periodsPerWeek: '4' },
];

const validPayload = {
  timetable: {
    Mon: {
      1: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
      2: [{ teacherId: 't2', classId: 'c1', subjectId: 's1', teacher: 'Teacher B', className: 'A-1', subject: 'Math', allocationId: 'alloc-2' }],
    },
    Tue: {
      1: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
      2: [{ teacherId: 't2', classId: 'c1', subjectId: 's1', teacher: 'Teacher B', className: 'A-1', subject: 'Math', allocationId: 'alloc-2' }],
    },
  },
  teachers,
  classes: [{ id: 'c1', userId: 1, className: 'A', section: '1' }],
  subjects,
  allocations: [
    { id: 'alloc-1', userId: 1, classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 2 },
    { id: 'alloc-2', userId: 1, classId: 'c1', subjectId: 's1', teacherId: 't2', periods: 2 },
  ],
  settings,
  userId: 1,
};

const cases = [
  ['valid', validPayload, ['valid']],
  ['teacher_conflict', {
    ...validPayload,
    timetable: {
      Mon: {
        1: [
          { teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math' },
          { teacherId: 't1', classId: 'c2', subjectId: 's1', teacher: 'Teacher A', className: 'B-1', subject: 'Math' },
        ],
      },
    },
    classes,
    allocations: [
      { id: 'alloc-1', userId: 1, classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 1 },
      { id: 'alloc-2', userId: 1, classId: 'c2', subjectId: 's1', teacherId: 't1', periods: 1 },
    ],
  }, ['teacher_conflict']],
  ['class_conflict', {
    ...validPayload,
    timetable: {
      Mon: {
        1: [
          { teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math' },
          { teacherId: 't2', classId: 'c1', subjectId: 's2', teacher: 'Teacher B', className: 'A-1', subject: 'Science' },
        ],
      },
    },
    allocations: [
      { id: 'alloc-1', userId: 1, classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 1 },
      { id: 'alloc-2', userId: 1, classId: 'c1', subjectId: 's2', teacherId: 't2', periods: 1 },
    ],
  }, ['class_conflict']],
  ['invalid_teacher_id', {
    ...validPayload,
    timetable: { Mon: { 1: [{ teacherId: 't999', classId: 'c1', subjectId: 's1', teacher: 'Nope', className: 'A-1', subject: 'Math' }] } },
  }, ['invalid_id']],
  ['invalid_class_id', {
    ...validPayload,
    timetable: { Mon: { 1: [{ teacherId: 't1', classId: 'c999', subjectId: 's1', teacher: 'Teacher A', className: 'Z-1', subject: 'Math' }] } },
  }, ['invalid_id']],
  ['invalid_subject_id', {
    ...validPayload,
    timetable: { Mon: { 1: [{ teacherId: 't1', classId: 'c1', subjectId: 's999', teacher: 'Teacher A', className: 'A-1', subject: 'Math' }] } },
  }, ['invalid_id']],
  ['invalid_allocation_id', {
    ...validPayload,
    timetable: { Mon: { 1: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'bad' }] } },
  }, ['invalid_id']],
  ['under_placement', {
    ...validPayload,
    allocations: [{ id: 'alloc-1', userId: 1, classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 5 }],
    timetable: {
      Mon: {
        1: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
        2: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
        3: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
        4: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
      },
    },
  }, ['under_placement']],
  ['over_placement', {
    ...validPayload,
    allocations: [{ id: 'alloc-1', userId: 1, classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 5 }],
    timetable: {
      Mon: {
        1: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
        2: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
        3: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
        4: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
        5: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
        6: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math', allocationId: 'alloc-1' }],
      },
    },
  }, ['over_placement']],
  ['fixed_event_violation', {
    ...validPayload,
    settings: {
      ...settings,
      timelineEvents: [{ id: 'event-1', title: 'Assembly', type: 'assembly', startTime: '08:45', endTime: '09:05', isTeachingBlocked: true, days: ['Mon'] }],
    },
    timetable: {
      Mon: { 1: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math' }] },
    },
  }, ['fixed_event_violation']],
  ['unavailable_teacher', {
    ...validPayload,
    teachers: [{ id: 't1', userId: 1, name: 'Teacher A', code: 'T1', availability: 'Mon,Wed,Fri', workload: 18 }],
    timetable: { Tue: { 1: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math' }] } },
  }, ['unavailable_teacher']],
  ['invalid_day', {
    ...validPayload,
    timetable: { Sun: { 1: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math' }] } },
  }, ['invalid_day']],
  ['invalid_period', {
    ...validPayload,
    timetable: { Mon: { 99: [{ teacherId: 't1', classId: 'c1', subjectId: 's1', teacher: 'Teacher A', className: 'A-1', subject: 'Math' }] } },
  }, ['invalid_period']],
  ['unauthorized_user_scope', {
    ...validPayload,
    teachers: [{ id: 't1', userId: 2, name: 'Teacher A', code: 'T1', availability: 'Mon,Tue,Wed,Thu,Fri', workload: 18 }],
    classes: [{ id: 'c1', userId: 2, className: 'A', section: '1' }],
    subjects: [{ id: 's1', userId: 2, name: 'Math', periodsPerWeek: '4' }],
    allocations: [{ id: 'alloc-1', userId: 2, classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 1 }],
    userId: 1,
  }, ['unauthorized_user_scope']],
  ['malformed_timetable', {
    ...validPayload,
    timetable: [{ bad: true }],
  }, ['invalid_structure']],
  ['impossible_capacity', {
    ...validPayload,
    allocations: [{ id: 'alloc-1', userId: 1, classId: 'c1', subjectId: 's1', teacherId: 't1', periods: 50 }],
    timetable: {},
  }, ['impossible_capacity']],
];

let passed = 0;
for (const [name, payload, expected] of cases) {
  const result = validateTimetable(payload);
  const codes = result.errors.map((error) => error.code);

  const ok = expected.includes('valid')
    ? result.valid === true
    : expected.some((code) => codes.includes(code));

  if (!ok) {
    console.log('FAIL', name, { valid: result.valid, status: result.status, codes, expected });
    process.exitCode = 1;
    break;
  }
  passed += 1;
}

if (process.exitCode !== 1) {
  console.log(`PASS ${passed}/${cases.length}`);
}
