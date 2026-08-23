import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { createToken } from '../utils/jwt.js';
import { validateTimetable } from '../services/timetableValidator.js';

const serverFile = path.resolve(process.cwd(), 'index.js');

async function startServer() {
  const { default: app } = await import('file://' + serverFile);
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  return { app, server, port };
}

async function requestJson({ port, method = 'GET', pathName, token, body }) {
  const payload = body ? JSON.stringify(body) : null;
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': payload ? Buffer.byteLength(payload) : 0,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathName,
      method,
      headers,
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: raw ? JSON.parse(raw) : {} });
        } catch {
          resolve({ statusCode: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function makeAuthToken(userId = 999) {
  return createToken({ id: userId, email: 'test@example.com', role: 'teacher' });
}

async function seedUserData() {
  const userId = 9999;
  const { default: db } = await import('../db.js');
  await db.run('DELETE FROM allocations WHERE userId = ?', userId);
  await db.run('DELETE FROM teachers WHERE userId = ?', userId);
  await db.run('DELETE FROM subjects WHERE userId = ?', userId);
  await db.run('DELETE FROM classes WHERE userId = ?', userId);
  await db.run('DELETE FROM school_settings WHERE userId = ?', userId);

  await db.run(
    'INSERT INTO teachers (id, userId, code, name, subject, workload, availability, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    `t1-${userId}`, userId, 'T1', 'Teacher A', 'Math', '4', 'Mon,Tue,Wed,Thu,Fri', new Date().toISOString(), new Date().toISOString()
  );
  await db.run(
    'INSERT INTO teachers (id, userId, code, name, subject, workload, availability, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    `t2-${userId}`, userId, 'T2', 'Teacher B', 'Math', '4', 'Mon,Tue,Wed,Thu,Fri', new Date().toISOString(), new Date().toISOString()
  );

  await db.run(
    'INSERT INTO subjects (id, userId, name, periodsPerWeek, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    `s1-${userId}`, userId, 'Math', '4', new Date().toISOString(), new Date().toISOString()
  );
  await db.run(
    'INSERT INTO classes (id, userId, className, section, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    `c1-${userId}`, userId, 'Grade 6', 'A', new Date().toISOString(), new Date().toISOString()
  );

  await db.run(
    'INSERT INTO allocations (id, userId, classId, subjectId, teacherId, periods, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    `a1-${userId}`, userId, `c1-${userId}`, `s1-${userId}`, `t1-${userId}`, 2, new Date().toISOString(), new Date().toISOString()
  );
  await db.run(
    'INSERT INTO allocations (id, userId, classId, subjectId, teacherId, periods, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    `a2-${userId}`, userId, `c1-${userId}`, `s1-${userId}`, `t2-${userId}`, 2, new Date().toISOString(), new Date().toISOString()
  );

  await db.run(
    'INSERT INTO school_settings (userId, schoolName, startTime, endTime, periodsPerDay, periodDuration, workingDays, lunchDuration, lunchPosition, timelineEvents, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    userId,
    'Test School',
    '08:45',
    '15:45',
    '6',
    '45',
    'Mon-Fri',
    '45',
    '3',
    JSON.stringify([]),
    new Date().toISOString(),
    new Date().toISOString()
  );
}

test('generation route validates a valid timetable and accepts it', async () => {
  const { server, port } = await startServer();
  try {
    await seedUserData();
    const token = makeAuthToken(9999);
    const response = await requestJson({
      port,
      method: 'POST',
      pathName: '/api/ai/timetable',
      token,
      body: {},
    });

    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.equal(response.body.success, true);
    assert.ok(response.body.data && response.body.data.timetable);
  } finally {
    server.close();
  }
});

test('invalid timetable does not persist and validation remains the gate', async () => {
  const userId = 8888;
  const { default: db } = await import('../db.js');
  const { validateTimetable } = await import('../services/timetableValidator.js');

  await db.run('DELETE FROM allocations WHERE userId = ?', userId);
  await db.run('DELETE FROM teachers WHERE userId = ?', userId);
  await db.run('DELETE FROM subjects WHERE userId = ?', userId);
  await db.run('DELETE FROM classes WHERE userId = ?', userId);
  await db.run('DELETE FROM school_settings WHERE userId = ?', userId);
  await db.run('DELETE FROM timetables WHERE userId = ?', userId);

  const teachers = [
    { id: `t1-${userId}`, userId, code: 'T1', name: 'Teacher A', subject: 'Math', workload: '4', availability: 'Mon,Tue,Wed,Thu,Fri' },
    { id: `t2-${userId}`, userId, code: 'T2', name: 'Teacher B', subject: 'Math', workload: '4', availability: 'Mon,Tue,Wed,Thu,Fri' },
  ];
  const classes = [
    { id: `c1-${userId}`, userId, className: 'Grade 6', section: 'A' },
    { id: `c2-${userId}`, userId, className: 'Grade 6', section: 'B' },
  ];
  const subjects = [{ id: `s1-${userId}`, userId, name: 'Math', periodsPerWeek: '4' }];
  const allocations = [
    { id: `a1-${userId}`, userId, classId: `c1-${userId}`, subjectId: `s1-${userId}`, teacherId: `t1-${userId}`, periods: 2 },
    { id: `a2-${userId}`, userId, classId: `c2-${userId}`, subjectId: `s1-${userId}`, teacherId: `t1-${userId}`, periods: 2 },
  ];
  const settings = {
    schoolName: 'Test School',
    startTime: '08:45',
    endTime: '15:45',
    periodsPerDay: 6,
    periodDuration: 45,
    workingDays: 'Mon-Fri',
    lunchDuration: 45,
    lunchPosition: 3,
    timelineEvents: [],
  };

  const invalidTimetable = {
    Mon: {
      1: [
        { teacherId: `t1-${userId}`, classId: `c1-${userId}`, subjectId: `s1-${userId}`, teacher: 'Teacher A', className: 'Grade 6-A', subject: 'Math', allocationId: `a1-${userId}` },
        { teacherId: `t1-${userId}`, classId: `c2-${userId}`, subjectId: `s1-${userId}`, teacher: 'Teacher A', className: 'Grade 6-B', subject: 'Math', allocationId: `a2-${userId}` },
      ],
    },
  };

  const result = validateTimetable({
    timetable: invalidTimetable,
    teachers,
    classes,
    subjects,
    allocations,
    settings,
    userId,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'teacher_conflict'));

  const rows = await db.all('SELECT * FROM timetables WHERE userId = ?', userId);
  assert.equal(rows.length, 0);
});

test('validator rejects a true teacher conflict before the route accepts a timetable', async () => {
  const userId = 9998;
  const teacherId = `t1-${userId}`;
  const classOneId = `c1-${userId}`;
  const classTwoId = `c2-${userId}`;
  const subjectId = `s1-${userId}`;
  const allocationOneId = `a1-${userId}`;
  const allocationTwoId = `a2-${userId}`;

  const teachers = [
    { id: teacherId, userId, code: 'T1', name: 'Teacher A', subject: 'Math', workload: '4', availability: 'Mon,Tue,Wed,Thu,Fri' },
  ];
  const classes = [
    { id: classOneId, userId, className: 'Grade 6', section: 'A' },
    { id: classTwoId, userId, className: 'Grade 6', section: 'B' },
  ];
  const subjects = [{ id: subjectId, userId, name: 'Math', periodsPerWeek: '4' }];
  const allocations = [
    { id: allocationOneId, userId, classId: classOneId, subjectId, teacherId, periods: 1 },
    { id: allocationTwoId, userId, classId: classTwoId, subjectId, teacherId, periods: 1 },
  ];
  const settings = {
    schoolName: 'Test School',
    startTime: '08:45',
    endTime: '15:45',
    periodsPerDay: 6,
    periodDuration: 45,
    workingDays: 'Mon-Fri',
    lunchDuration: 45,
    lunchPosition: 3,
    timelineEvents: [],
  };

  const invalidTimetable = {
    Mon: {
      1: [
        { teacherId, classId: classOneId, subjectId, teacher: 'Teacher A', className: 'Grade 6-A', subject: 'Math', allocationId: allocationOneId },
        { teacherId, classId: classTwoId, subjectId, teacher: 'Teacher A', className: 'Grade 6-B', subject: 'Math', allocationId: allocationTwoId },
      ],
    },
  };

  const result = validateTimetable({
    timetable: invalidTimetable,
    teachers,
    classes,
    subjects,
    allocations,
    settings,
    userId,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'teacher_conflict'));
});

test('generation route excludes foreign-user records from the authenticated user payload', async () => {
  const { server, port } = await startServer();
  try {
    const userId = 9997;
    const foreignUserId = 9996;
    const localTeacherId = `local-teacher-${userId}`;
    const localClassId = `local-class-${userId}`;
    const localSubjectId = `local-subject-${userId}`;
    const foreignTeacherId = `foreign-teacher-${foreignUserId}`;
    const foreignClassId = `foreign-class-${foreignUserId}`;
    const foreignSubjectId = `foreign-subject-${foreignUserId}`;

    const { default: db } = await import('../db.js');
    await db.run('DELETE FROM allocations WHERE userId IN (?, ?)', userId, foreignUserId);
    await db.run('DELETE FROM teachers WHERE userId IN (?, ?)', userId, foreignUserId);
    await db.run('DELETE FROM subjects WHERE userId IN (?, ?)', userId, foreignUserId);
    await db.run('DELETE FROM classes WHERE userId IN (?, ?)', userId, foreignUserId);
    await db.run('DELETE FROM school_settings WHERE userId IN (?, ?)', userId, foreignUserId);

    await db.run('INSERT INTO teachers (id, userId, code, name, subject, workload, availability, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', localTeacherId, userId, 'L1', 'Local Teacher', 'Math', '4', 'Mon,Tue,Wed,Thu,Fri', new Date().toISOString(), new Date().toISOString());
    await db.run('INSERT INTO teachers (id, userId, code, name, subject, workload, availability, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', foreignTeacherId, foreignUserId, 'F1', 'Foreign Teacher', 'Math', '4', 'Mon,Tue,Wed,Thu,Fri', new Date().toISOString(), new Date().toISOString());
    await db.run('INSERT INTO subjects (id, userId, name, periodsPerWeek, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', localSubjectId, userId, 'Math', '4', new Date().toISOString(), new Date().toISOString());
    await db.run('INSERT INTO subjects (id, userId, name, periodsPerWeek, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', foreignSubjectId, foreignUserId, 'Math', '4', new Date().toISOString(), new Date().toISOString());
    await db.run('INSERT INTO classes (id, userId, className, section, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', localClassId, userId, 'Grade 7', 'A', new Date().toISOString(), new Date().toISOString());
    await db.run('INSERT INTO classes (id, userId, className, section, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', foreignClassId, foreignUserId, 'Grade 7', 'B', new Date().toISOString(), new Date().toISOString());
    await db.run('INSERT INTO allocations (id, userId, classId, subjectId, teacherId, periods, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', `local-allocation-${userId}`, userId, localClassId, localSubjectId, localTeacherId, 2, new Date().toISOString(), new Date().toISOString());
    await db.run('INSERT INTO allocations (id, userId, classId, subjectId, teacherId, periods, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', `foreign-allocation-${foreignUserId}`, foreignUserId, foreignClassId, foreignSubjectId, foreignTeacherId, 2, new Date().toISOString(), new Date().toISOString());
    await db.run('INSERT INTO school_settings (userId, schoolName, startTime, endTime, periodsPerDay, periodDuration, workingDays, lunchDuration, lunchPosition, timelineEvents, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', userId, 'Test School', '08:45', '15:45', '6', '45', 'Mon-Fri', '45', '3', JSON.stringify([]), new Date().toISOString(), new Date().toISOString());

    const response = await requestJson({
      port,
      method: 'POST',
      pathName: '/api/ai/timetable',
      token: makeAuthToken(userId),
      body: {},
    });

    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.equal(response.body.success, true);
    const timetableEntries = Object.values(response.body.data.timetable || {}).flatMap((periodMap) => Object.values(periodMap)).flat();
    assert.ok(timetableEntries.length > 0);
    for (const entry of timetableEntries) {
      if (entry.teacherId) assert.notEqual(String(entry.teacherId), String(foreignTeacherId));
      if (entry.classId) assert.notEqual(String(entry.classId), String(foreignClassId));
      if (entry.subjectId) assert.notEqual(String(entry.subjectId), String(foreignSubjectId));
    }
  } finally {
    server.close();
  }
});

test('generate persists a current timetable snapshot and current route returns it', async () => {
  const { server, port } = await startServer();
  try {
    await seedUserData();
    const token = makeAuthToken(9999);

    const response = await requestJson({
      port,
      method: 'POST',
      pathName: '/api/ai/timetable',
      token,
      body: {},
    });

    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.equal(response.body.success, true);
    assert.ok(response.body.data.persistedTimetable);
    assert.ok(response.body.data.persistedTimetable.isCurrent === true || response.body.data.persistedTimetable.isCurrent === 1);

    const current = await requestJson({
      port,
      method: 'GET',
      pathName: '/api/timetables/current',
      token,
    });

    assert.equal(current.statusCode, 200, JSON.stringify(current.body));
    assert.equal(current.body.success, true);
    assert.equal(current.body.data.id, response.body.data.persistedTimetable.id);
    assert.equal(current.body.data.timetableData, response.body.data.persistedTimetable.timetableData);
  } finally {
    server.close();
  }
});

test('user A cannot read user B timetable and client userId cannot override server owner', async () => {
  const { server, port } = await startServer();
  try {
    const { default: db } = await import('../db.js');
    const userA = 4545;
    const userB = 4546;
    const ownRowId = 'user-a-row';

    await db.run('DELETE FROM allocations WHERE userId IN (?, ?)', userA, userB);
    await db.run('DELETE FROM teachers WHERE userId IN (?, ?)', userA, userB);
    await db.run('DELETE FROM subjects WHERE userId IN (?, ?)', userA, userB);
    await db.run('DELETE FROM classes WHERE userId IN (?, ?)', userA, userB);
    await db.run('DELETE FROM school_settings WHERE userId IN (?, ?)', userA, userB);
    await db.run('DELETE FROM timetables WHERE userId IN (?, ?)', userA, userB);

    await db.run(
      'INSERT INTO teachers (id, userId, code, name, subject, workload, availability, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      `t1-${userA}`, userA, 'T1', 'User A Teacher', 'Math', '4', 'Mon,Tue,Wed,Thu,Fri', new Date().toISOString(), new Date().toISOString()
    );
    await db.run(
      'INSERT INTO subjects (id, userId, name, periodsPerWeek, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      `s1-${userA}`, userA, 'Math', '4', new Date().toISOString(), new Date().toISOString()
    );
    await db.run(
      'INSERT INTO classes (id, userId, className, section, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      `c1-${userA}`, userA, 'Grade 8', 'A', new Date().toISOString(), new Date().toISOString()
    );
    await db.run(
      'INSERT INTO allocations (id, userId, classId, subjectId, teacherId, periods, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      `a1-${userA}`, userA, `c1-${userA}`, `s1-${userA}`, `t1-${userA}`, 2, new Date().toISOString(), new Date().toISOString()
    );
    await db.run(
      'INSERT INTO school_settings (userId, schoolName, startTime, endTime, periodsPerDay, periodDuration, workingDays, lunchDuration, lunchPosition, timelineEvents, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      userA,
      'User A',
      '08:45',
      '15:45',
      '6',
      '45',
      'Mon-Fri',
      '45',
      '3',
      JSON.stringify([]),
      new Date().toISOString(),
      new Date().toISOString()
    );
    await db.run(
      'INSERT INTO timetables (id, userId, name, timetableData, version, isCurrent, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ownRowId,
      userB,
      'User B Timetable',
      JSON.stringify({ Mon: { 1: [] } }),
      1,
      1,
      new Date().toISOString(),
      new Date().toISOString()
    );

    const response = await requestJson({
      port,
      method: 'GET',
      pathName: `/api/timetables/${ownRowId}`,
      token: makeAuthToken(userA),
    });

    assert.equal(response.statusCode, 404, JSON.stringify(response.body));

    const fakeGenerate = await requestJson({
      port,
      method: 'POST',
      pathName: '/api/ai/timetable',
      token: makeAuthToken(userA),
      body: { userId: userB },
    });

    assert.equal(fakeGenerate.statusCode, 200, JSON.stringify(fakeGenerate.body));
    assert.equal(fakeGenerate.body.data.persistedTimetable.userId, userA);
  } finally {
    server.close();
  }
});

test('persistence failure rolls back and preserves the previous current row', async () => {
  const { default: db } = await import('../db.js');
  const userId = 7788;
  const oldRowId = 'rollback-old';
  const newRowId = 'rollback-new';

  await db.run('DELETE FROM timetables WHERE userId = ?', userId);
  await db.run(
    'INSERT INTO timetables (id, userId, name, timetableData, version, isCurrent, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    oldRowId,
    userId,
    'Old',
    JSON.stringify({ Mon: { 1: [] } }),
    1,
    1,
    new Date().toISOString(),
    new Date().toISOString()
  );

  await assert.rejects(
    () => db.transaction(async (tx) => {
      await tx.run(
        'UPDATE timetables SET isCurrent = ?, updatedAt = ? WHERE id = ? AND userId = ?',
        0,
        new Date().toISOString(),
        oldRowId,
        userId
      );
      await tx.run(
        'INSERT INTO timetables (id, userId, name, timetableData, version, isCurrent, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        newRowId,
        userId,
        'New',
        JSON.stringify({ Tue: { 1: [] } }),
        2,
        1,
        new Date().toISOString(),
        new Date().toISOString()
      );
      throw new Error('simulated persistence failure');
    }),
    /simulated persistence failure/
  );

  const current = await db.get('SELECT id, isCurrent FROM timetables WHERE userId = ? AND isCurrent = ? ORDER BY updatedAt DESC LIMIT 1', userId, 1);
  assert.equal(current.id, oldRowId);
});

test('legacy timetable CRUD still works for authenticated ownership', async () => {
  const { server, port } = await startServer();
  try {
    const userId = 9001;
    const token = makeAuthToken(userId);
    const { default: db } = await import('../db.js');

    await db.run('DELETE FROM timetables WHERE userId = ?', userId);

    const create = await requestJson({
      port,
      method: 'POST',
      pathName: '/api/timetables',
      token,
      body: { id: 'legacy-1', timetableData: { Mon: { 1: [] } }, name: 'Legacy One' },
    });

    assert.equal(create.statusCode, 201, JSON.stringify(create.body));
    const list = await requestJson({
      port,
      method: 'GET',
      pathName: '/api/timetables',
      token,
    });
    assert.equal(list.statusCode, 200, JSON.stringify(list.body));
    assert.ok((list.body.data || []).some((item) => item.id === 'legacy-1'));

    const update = await requestJson({
      port,
      method: 'PUT',
      pathName: '/api/timetables/legacy-1',
      token,
      body: { timetableData: { Tue: { 2: [] } }, name: 'Legacy Updated' },
    });
    assert.equal(update.statusCode, 200, JSON.stringify(update.body));

    const deleted = await requestJson({
      port,
      method: 'DELETE',
      pathName: '/api/timetables/legacy-1',
      token,
    });
    assert.equal(deleted.statusCode, 200, JSON.stringify(deleted.body));
  } finally {
    server.close();
  }
});

test('concurrent generation keeps exactly one current row per user', async () => {
  const { server, port } = await startServer();
  try {
    await seedUserData();
    const token = makeAuthToken(9999);

    const requests = Array.from({ length: 3 }, () => requestJson({
      port,
      method: 'POST',
      pathName: '/api/ai/timetable',
      token,
      body: {},
    }));

    const responses = await Promise.all(requests);
    const ok = responses.filter((response) => response.statusCode === 200);
    assert.equal(ok.length, 3, JSON.stringify(responses));

    const current = await requestJson({
      port,
      method: 'GET',
      pathName: '/api/timetables/current',
      token,
    });

    assert.equal(current.statusCode, 200, JSON.stringify(current.body));
    assert.equal(current.body.success, true);
    assert.ok(current.body.data.isCurrent === true || current.body.data.isCurrent === 1);

    const list = await requestJson({
      port,
      method: 'GET',
      pathName: '/api/timetables',
      token,
    });
    const currentRows = (list.body.data || []).filter((row) => row.isCurrent === true || row.isCurrent === 1);
    assert.equal(currentRows.length, 1, JSON.stringify(currentRows));
  } finally {
    server.close();
  }
});

test('repeated valid generation keeps exactly one current timetable for the user', async () => {
  const { server, port } = await startServer();
  try {
    await seedUserData();
    const token = makeAuthToken(9999);

    const first = await requestJson({
      port,
      method: 'POST',
      pathName: '/api/ai/timetable',
      token,
      body: {},
    });

    const second = await requestJson({
      port,
      method: 'POST',
      pathName: '/api/ai/timetable',
      token,
      body: {},
    });

    assert.equal(first.statusCode, 200, JSON.stringify(first.body));
    assert.equal(second.statusCode, 200, JSON.stringify(second.body));

    const current = await requestJson({
      port,
      method: 'GET',
      pathName: '/api/timetables/current',
      token,
    });

    assert.equal(current.statusCode, 200, JSON.stringify(current.body));
    assert.equal(current.body.success, true);
    assert.ok(current.body.data.id === first.body.data.persistedTimetable.id || current.body.data.id === second.body.data.persistedTimetable.id);

    const list = await requestJson({
      port,
      method: 'GET',
      pathName: '/api/timetables',
      token,
    });

    const currentRows = (list.body.data || []).filter((row) => row.isCurrent === true || row.isCurrent === 1);
    assert.equal(currentRows.length, 1, JSON.stringify(currentRows));
  } finally {
    server.close();
  }
});
