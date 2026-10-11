const S = require('../src/services/stageMachine');
const { opportunityFit } = require('../src/services/fit');
const { fairnessStats } = require('../src/services/fairness');
const { cvCompleteness } = require('../src/services/cvService');
const { flagOpportunity } = require('../src/utils/scamKeywords');

describe('application stage machine', () => {
  test('allowed forward moves', () => {
    expect(S.canTransition('Applied', 'Under Review')).toBe(true);
    expect(S.canTransition('Applied', 'Shortlisted')).toBe(true);
    expect(S.canTransition('Shortlisted', 'Interview')).toBe(true);
    expect(S.canTransition('Offer', 'Hired')).toBe(true);
  });
  test('no skipping, no going back, terminal stages stay terminal', () => {
    expect(S.canTransition('Applied', 'Interview')).toBe(false);
    expect(S.canTransition('Applied', 'Hired')).toBe(false);
    expect(S.canTransition('Interview', 'Shortlisted')).toBe(false);
    for (const t of ['Hired', 'Rejected', 'Withdrawn']) expect(S.NEXT[t]).toEqual([]);
    expect(S.canTransition('Applied', 'Withdrawn')).toBe(false); // withdrawing is the student's own action
  });
  test('any active stage can be rejected; withdraw only while active', () => {
    for (const s of ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Offer']) { expect(S.canTransition(s, 'Rejected')).toBe(true); expect(S.canWithdraw(s)).toBe(true); }
    for (const s of ['Hired', 'Rejected', 'Withdrawn']) expect(S.canWithdraw(s)).toBe(false);
  });
  test('maps to the 5 stages in the design', () => {
    expect(['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected', 'Withdrawn'].map(S.uiStage))
      .toEqual(['Applied', 'Applied', 'Shortlisted', 'Interview', 'Selected', 'Selected', 'Not selected', 'Withdrawn']);
  });
  test('timeline dots', () => {
    const st = (t) => t.map((x) => x.state);
    expect(st(S.timeline('Shortlisted', [{ stage: 'Applied' }]))).toEqual(['done', 'current', 'todo', 'todo']); // as in the design
    expect(st(S.timeline('Hired', [{ stage: 'Interview' }]))).toEqual(['done', 'done', 'done', 'done']);
    expect(st(S.timeline('Rejected', [{ stage: 'Applied' }, { stage: 'Interview' }]))).toEqual(['done', 'done', 'stopped', 'todo']);
  });
});

describe('job fit', () => {
  const req = [{ skillKey: 'sql', weight: 5, requiredLevel: 3 }, { skillKey: 'powerbi', weight: 4, requiredLevel: 2 },
    { skillKey: 'excel', weight: 3, requiredLevel: 2 }, { skillKey: 'statistics', weight: 3, requiredLevel: 2 }];
  const lv = { sql: { level: 1, verified: false }, excel: { level: 2, verified: true }, statistics: { level: 2, verified: true } };
  const names = { sql: { nameEn: 'SQL' }, powerbi: { nameEn: 'Power BI' } };
  test('met, gap and not_provided are told apart (missing evidence is not shown as a proven lack)', () => {
    const f = opportunityFit(req, lv, { sql: 6, powerbi: 5 }, 6, names);
    const by = Object.fromEntries(f.skills.map((s) => [s.skillKey, s.state]));
    expect(by).toEqual({ sql: 'gap', powerbi: 'not_provided', excel: 'met', statistics: 'met' });
    expect(f.fitPercent).toBe(Math.round(100 * (5 / 3 + 0 + 3 + 3) / 15)); // 51
    expect(f.topGaps).toEqual(['sql', 'powerbi']);
    expect(f.projectedIfTopGapsClosed).toBeGreaterThan(f.fitPercent);
  });
  test('weeks to close is null (with a note) when weekly hours is 0', () => {
    expect(opportunityFit(req, lv, {}, 0).weeksToClose).toBeNull();
  });
});

describe('fairness check', () => {
  test('highest share and compliance against the 25% limit', () => {
    const f = fairnessStats([{ mentorId: 'a', n: 21 }, { mentorId: 'b', n: 40 }, { mentorId: 'c', n: 39 }]);
    expect(f.total).toBe(100); expect(f.highestShare).toBe(40); expect(f.highestMentorId).toBe('b'); expect(f.compliant).toBe(false);
    expect(fairnessStats([{ mentorId: 'a', n: 25 }, { mentorId: 'b', n: 25 }, { mentorId: 'c', n: 25 }, { mentorId: 'd', n: 25 }]).compliant).toBe(true);
  });
  test('empty data and small samples are handled', () => {
    expect(fairnessStats([])).toMatchObject({ total: 0, highestShare: 0, compliant: true, sampleTooSmall: true });
  });
});

describe('CV completeness', () => {
  test('sections and hint', () => {
    const cv = { headline: 'Data Analyst', summary: 'x', education: [{ institution: 'EDU' }], projects: [{ title: 'p1', url: 'https://x.y' }] };
    expect(cvCompleteness(cv, 3)).toMatchObject({ percent: 88, sections: { personal: 'done', education: 'done', projects: '1 of 2', skills: 'synced' }, hint: 'add_project' });
    expect(cvCompleteness({ projects: [] }, 0).percent).toBe(0);
    expect(cvCompleteness({ ...cv, projects: [{ url: 'https://a.b' }, { title: 'no link' }] }, 1).hint).toBe('add_project_link');
  });
});

describe('opportunity flags', () => {
  test('keywords and missing company name', () => {
    expect(flagOpportunity({ title: 'Data Entry Job, Earn Daily', organization: '', description: 'Pay a registration fee first' }))
      .toEqual(expect.arrayContaining(['earn daily', 'registration fee', 'no company name']));
    expect(flagOpportunity({ title: 'Junior Data Analyst', organization: 'Acme Software', description: 'Support weekly reports.' })).toEqual([]);
  });
});
