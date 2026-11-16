// Pure rules for the job-readiness path (no database).
const JR = require('../src/services/jobready');
const { levelsFromEvidence } = require('../src/services/readiness');
const { fitOf } = require('../src/services/jobtools');

describe('interview question bank', () => {
  test('every role gets general + role questions with unique ids and both languages', () => {
    for (const key of Object.keys(JR.ROLE_FAMILY)) {
      const qs = JR.questionsFor(key);
      expect(qs.length).toBeGreaterThanOrEqual(6);
      expect(new Set(qs.map((x) => x.id)).size).toBe(qs.length);
      for (const x of qs) { expect(x.en).toBeTruthy(); expect(x.bn).toBeTruthy(); }
    }
  });
  test('an unknown role still gets the general questions', () => {
    expect(JR.questionsFor('nope').length).toBe(5);
  });
  test('isQuestionOf only accepts that role\'s own ids', () => {
    const id = JR.questionsFor('data-analyst')[3].id;
    expect(JR.isQuestionOf('data-analyst', id)).toBe(true);
    expect(JR.isQuestionOf('qa-engineer', id)).toBe(false);
  });
  test('practice summary uses the latest rating per question and flags weak answers', () => {
    const [a, b] = JR.questionsFor('qa-engineer');
    const s = JR.practiceSummary('qa-engineer', [
      { questionId: a.id, rating: 1, createdAt: '2026-01-01' }, { questionId: a.id, rating: 4, createdAt: '2026-01-02' },
      { questionId: b.id, rating: 2, createdAt: '2026-01-02' },
    ]);
    expect(s.answered).toBe(2); expect(s.average).toBe(3); expect(s.weakest).toEqual([b.id]);
  });
});

describe('job-ready checklist', () => {
  const base = { hasGoal: true, cvCount: 1, cvScore: 90, confidence: 70, mocksDone: 0, practiceAnswered: 5, applications: 3 };
  test('all done -> complete and next step says keep applying', () => {
    const c = JR.buildChecklist(base);
    expect(c.complete).toBe(true); expect(c.percent).toBe(100);
    expect(JR.nextStep(c).key).toBe('done');
  });
  test('next step is the FIRST item not done, in path order', () => {
    expect(JR.nextStep(JR.buildChecklist({ ...base, hasGoal: false })).key).toBe('goal');
    expect(JR.nextStep(JR.buildChecklist({ ...base, cvScore: 60 })).key).toBe('cv');
    expect(JR.nextStep(JR.buildChecklist({ ...base, confidence: 20 })).key).toBe('proof');
    expect(JR.nextStep(JR.buildChecklist({ ...base, practiceAnswered: 2 })).key).toBe('mock');
    expect(JR.nextStep(JR.buildChecklist({ ...base, applications: 1 })).key).toBe('apply');
  });
  test('no CV at all is never "CV complete"', () => {
    expect(JR.buildChecklist({ ...base, cvCount: 0, cvScore: 100 }).items.find((i) => i.key === 'cv').done).toBe(false);
  });
  test('one finished mentor mock interview is enough for the mock step', () => {
    expect(JR.buildChecklist({ ...base, practiceAnswered: 0, mocksDone: 1 }).items.find((i) => i.key === 'mock').done).toBe(true);
  });
  test('self-rated skills do not count: proof depends only on the confidence (non-self) share', () => {
    expect(JR.buildChecklist({ ...base, confidence: 59 }).items.find((i) => i.key === 'proof').done).toBe(false);
    expect(JR.buildChecklist({ ...base, confidence: 60 }).items.find((i) => i.key === 'proof').done).toBe(true);
  });
});

describe('weekly plan', () => {
  const gaps = [{ skillKey: 'sql', nameEn: 'SQL', nameBn: 'এসকিউএল', current: 1, required: 3 }, { skillKey: 'excel', nameEn: 'Excel', current: 0, required: 2 }, { skillKey: 'python', nameEn: 'Python', current: 0, required: 2 }, { skillKey: 'git', nameEn: 'Git', current: 0, required: 1 }];
  const resources = [{ skillKey: 'sql', title: 'SQL Tutorial', url: 'https://x.test/sql', kind: 'practice', free: true }, { skillKey: 'sql', title: 'SQL Course', url: 'https://x.test/sqlc', kind: 'course', free: true }, { skillKey: 'excel', title: 'Paid', url: 'https://x.test/p', kind: 'course', free: false }];
  test('at most 3 tasks, each with minutes and a way to prove it', () => {
    const p = JR.weeklyPlan({ gaps, resources, quizSkills: new Set(['sql']), weeklyHours: 6 });
    expect(p.tasks).toHaveLength(3);
    for (const t of p.tasks) { expect(t.minutes).toBeGreaterThanOrEqual(30); expect(t.minutes).toBeLessThanOrEqual(180); }
    expect(p.tasks[0].resource.url).toBe('https://x.test/sqlc'); // a course is preferred
    expect(p.tasks[0].proof).toBe('quiz'); expect(p.tasks[1].proof).toBe('project');
  });
  test('a paid resource is never offered; no free resource -> null', () => {
    const p = JR.weeklyPlan({ gaps, resources, quizSkills: new Set(), weeklyHours: 6 });
    expect(p.tasks[1].resource).toBeNull();
  });
  test('no gaps -> empty plan', () => { expect(JR.weeklyPlan({ gaps: [], resources, quizSkills: new Set(), weeklyHours: 6 }).tasks).toEqual([]); });
});

describe('ranked jobs: apply now vs almost there', () => {
  const have = levelsFromEvidence([{ skillKey: 'sql', level: 3, type: 'quiz' }, { skillKey: 'excel', level: 1, type: 'self' }]);
  const job = (id, skills) => ({ _id: id, requiredSkills: skills.map(([skillKey, requiredLevel]) => ({ skillKey, requiredLevel, weight: 1 })) });
  const jobs = [job('A', [['sql', 2]]), job('B', [['sql', 3], ['excel', 2]]), job('C', [['sql', 3], ['excel', 2], ['python', 2]]), job('D', [['python', 2], ['excel', 3], ['git', 1]]), job('E', [])];
  test('groups by how many skills are below the required level', () => {
    const { applyNow, almost } = JR.rankJobs(jobs, have, fitOf);
    expect(applyNow.map((x) => x.job._id).sort()).toEqual(['A', 'E']);
    expect(almost.map((x) => x.job._id)).toEqual(['B', 'C']); // fewest missing first
    expect(almost[0].missing).toEqual([{ skillKey: 'excel', need: 2, have: 1 }]);
  });
  test('jobs 3 or more skills away are in neither list', () => {
    const { applyNow, almost } = JR.rankJobs(jobs, have, fitOf);
    expect([...applyNow, ...almost].some((x) => x.job._id === 'D')).toBe(false);
  });
});

describe('what to do next per application stage', () => {
  test('every student-facing stage has advice in both languages and a route', () => {
    for (const s of ['Applied', 'Shortlisted', 'Interview', 'Selected', 'Not selected', 'Withdrawn']) {
      const n = JR.nextForStage(s); expect(n.en).toBeTruthy(); expect(n.bn).toBeTruthy(); expect(n.route).toMatch(/^\//);
    }
  });
  test('a rejection points to the job gap, an interview to practice', () => {
    expect(JR.nextForStage('Not selected').route).toBe('/job-gaps');
    expect(JR.nextForStage('Interview').route).toBe('/interview-practice');
  });
});

describe('success stories', () => {
  const row = (a, b, m) => ({ roleTitleEn: 'Data Analyst', roleTitleBn: 'ডেটা অ্যানালিস্ট', firstPercent: a, hirePercent: b, firstDay: '2026-01-01', hiredAt: new Date(Date.parse('2026-01-01') + m * 30 * 864e5) });
  test('hidden until enough students agreed (privacy)', () => {
    const r = JR.buildStories([row(30, 80, 3), row(20, 70, 4)]);
    expect(r.stories).toEqual([]); expect(r.hidden).toMatch(/privacy/);
  });
  test('with enough students, story text is real and anonymous', () => {
    const r = JR.buildStories([row(30, 85, 3), row(10, 60, 4), row(40, 90, 2), row(35, 75, 6), row(20, 70, 1)]);
    expect(r.stories).toHaveLength(5);
    expect(r.stories[0].en).toMatch(/^From \d+% to hired in \d+ months?: Data Analyst\.$/);
    expect(JSON.stringify(r)).not.toMatch(/name|university/i);
    expect(r.stories.find((s) => s.months === 1).en).toMatch(/1 month:/);
  });
  test('a story that got worse is never shown', () => {
    const r = JR.buildStories([row(80, 60, 3), row(10, 60, 4), row(40, 90, 2), row(35, 75, 6), row(20, 70, 1)]);
    expect(r.stories).toHaveLength(4);
  });
});
