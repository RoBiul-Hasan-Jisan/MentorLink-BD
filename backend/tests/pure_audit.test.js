// Pure-function tests added by the audit. No database or Firebase needed: `npx jest tests/pure_audit.test.js`.
const { normalizeMeetingLink } = require('../src/utils/links');
const { buildTarget, inQuietHours } = require('../src/utils/notifyTarget');

test('meeting links: https only, scheme added, credentials and odd schemes refused', () => {
  expect(normalizeMeetingLink('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
  expect(normalizeMeetingLink('meet.google.com/abc')).toBe('https://meet.google.com/abc');
  for (const bad of ['http://x.com', 'javascript:alert(1)', 'file:///etc/passwd', 'https://u:p@x.com', 'a b.com', '', 'https://localhost/x', 'x'.repeat(301)]) {
    expect(normalizeMeetingLink(bad)).toBeNull();
  }
});

test('notification targets: allow-listed types and 24-hex ids only', () => {
  expect(buildTarget({ type: 'chat', id: '64b0c0ffee64b0c0ffee1234' })).toEqual({ type: 'chat', id: '64b0c0ffee64b0c0ffee1234' });
  expect(buildTarget({ type: 'plan' })).toEqual({ type: 'plan' });
  expect(buildTarget({ type: 'admin-panel', id: '64b0c0ffee64b0c0ffee1234' })).toBeUndefined();
  expect(buildTarget({ type: 'chat', id: '../x' })).toBeUndefined();
  expect(buildTarget(null)).toBeUndefined();
});

test('quiet hours use Bangladesh time and may wrap midnight', () => {
  expect(inQuietHours({ from: 22, to: 7 }, new Date('2026-10-21T17:00:00Z'))).toBe(true); // 23:00 Dhaka
  expect(inQuietHours({ from: 22, to: 7 }, new Date('2026-10-21T06:00:00Z'))).toBe(false); // 12:00 Dhaka
  expect(inQuietHours({ from: 9, to: 9 }, new Date())).toBe(false);
  expect(inQuietHours(undefined)).toBe(false);
});
