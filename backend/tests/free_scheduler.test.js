// No database needed: the free-scheduler hook and the admin revocation check.
const express = require('express');
const request = require('supertest');

jest.mock('../src/services/reminders', () => ({ runReminders: jest.fn(async () => ({ sessions: 1, tasks: 0, closedJobs: 2, savedJobs: 0, nudges: 0 })) }));
const tick = require('../src/routes/tick');
const mk = () => { const a = express(); a.post('/internal/tick', tick); return a; };

describe('POST /internal/tick', () => {
  afterEach(() => { delete process.env.CRON_SECRET; });
  test('is off (404) when CRON_SECRET is not set', async () => {
    expect((await request(mk()).post('/internal/tick').set('x-cron-secret', 'x')).status).toBe(404);
  });
  test('rejects a missing or wrong secret', async () => {
    process.env.CRON_SECRET = 'right-secret';
    expect((await request(mk()).post('/internal/tick')).status).toBe(401);
    expect((await request(mk()).post('/internal/tick').set('x-cron-secret', 'wrong')).status).toBe(401);
  });
  test('runs the job with the right secret', async () => {
    process.env.CRON_SECRET = 'right-secret';
    const r = await request(mk()).post('/internal/tick').set('x-cron-secret', 'right-secret');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, closedJobs: 2 });
  });
});
