// CV format v2: normalising old data, privacy of the contact block, and the rule-based tips (no database).
const { normalizeCv, stripContact, cvTips, sampleCv, SECTION_KEYS } = require('../src/services/cv');

describe('normalizeCv', () => {
  test('turns an old v1 CV into v2 without losing anything', () => {
    const old = { summary: 'CSE student', skills: ['SQL', 'Excel'], languages: ['Bangla'], education: [{ institution: 'EDU', degree: 'BSc', year: '2027' }], projects: [{ title: 'Dash', description: 'Built it', url: 'https://x.y/z' }], experience: [{ role: 'Intern', organization: 'Acme', details: 'Did things' }] };
    const cv = normalizeCv(old, { displayName: 'Sara Khan' });
    expect(cv.v).toBe(2); expect(cv.fullName).toBe('Sara Khan');
    expect(cv.skills).toEqual([{ label: 'Skills', items: ['SQL', 'Excel'] }]);
    expect(cv.education[0]).toMatchObject({ degree: 'BSc', institution: 'EDU', period: '2027' });
    expect(cv.projects[0]).toMatchObject({ title: 'Dash', bullets: ['Built it'], links: [{ label: 'Link', url: 'https://x.y/z' }] });
    expect(cv.experience[0].bullets).toEqual(['Did things']);
    expect(cv.sectionOrder).toEqual(SECTION_KEYS);
  });
  test('is safe with junk, keeps only https links, clamps sizes and unknown section keys', () => {
    const cv = normalizeCv({ v: 2, sectionOrder: ['projects', 'nope', 'summary'], hidden: ['skills', 'x'], accent: '#000001', template: 'weird', projects: [{ title: 'P', links: [{ label: 'a', url: 'javascript:alert(1)' }, { label: 'b', url: 'https://ok.dev' }], bullets: Array(20).fill('x') }], contact: { links: [{ label: 'x', url: 'http://insecure' }] } });
    expect(cv.sectionOrder.slice(0, 2)).toEqual(['projects', 'summary']); expect(cv.sectionOrder).toHaveLength(SECTION_KEYS.length);
    expect(cv.hidden).toEqual(['skills']); expect(cv.template).toBe('classic'); expect(cv.accent).not.toBe('#000001');
    expect(cv.projects[0].links).toEqual([{ label: 'b', url: 'https://ok.dev' }]); expect(cv.projects[0].bullets).toHaveLength(6);
    expect(cv.contact.links).toEqual([]);
    expect(normalizeCv(null).v).toBe(2); expect(normalizeCv('text').projects).toEqual([]);
  });
  test('v2 data survives a second pass unchanged', () => {
    const once = sampleCv();
    expect(normalizeCv(once)).toEqual(once);
  });
});

describe('contact privacy', () => {
  test('stripContact removes email, phone, city and links but keeps the rest', () => {
    const cv = normalizeCv({ v: 2, summary: 'Hi', contact: { email: 'a@b.co', phone: '01700000000', city: 'Dhaka', links: [{ label: 'GitHub', url: 'https://github.com/x' }] } });
    const s = stripContact(cv);
    expect(JSON.stringify(s.contact)).not.toMatch(/a@b\.co|0170|Dhaka|github/); expect(s.summary).toBe('Hi');
  });
  test('the demo CV holds no phone number or email', () => {
    expect(JSON.stringify(sampleCv())).not.toMatch(/@|\b01\d{9}\b/);
  });
});

describe('cvTips', () => {
  test('an empty CV gets the basic tips, each with English and Bangla', () => {
    const r = cvTips(normalizeCv({ v: 2 }));
    const ids = r.tips.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['summary_missing', 'skills_missing', 'education_missing', 'projects_missing', 'email', 'headline']));
    expect(r.tips.every((t) => t.en && t.bn)).toBe(true);
  });
  test('flags bullets with no number, weak verbs, too many bullets and projects without links', () => {
    const cv = normalizeCv({ v: 2, headline: 'H', summary: 'x'.repeat(200), contact: { email: 'a@b.co' }, skills: [{ label: 'L', items: ['a'] }], education: [{ degree: 'B', institution: 'U' }], projects: [{ title: 'Proj', bullets: ['Worked on a thing', 'b', 'c', 'd', 'e'] }] });
    const ids = cvTips(cv).tips.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['numbers', 'weak_verbs', 'too_many', 'project_links']));
    expect(ids).not.toContain('email');
  });
  test('the demo CV scores reasonably and hidden sections are not criticised', () => {
    const demo = cvTips(sampleCv()); expect(demo.score).toBeGreaterThanOrEqual(60); expect(demo.tips.map((t) => t.id)).toContain('email'); // the demo has no email on purpose
    const hidden = normalizeCv({ v: 2, hidden: ['summary', 'skills', 'projects', 'education'], contact: { email: 'a@b.co' }, headline: 'H' });
    expect(cvTips(hidden).tips).toEqual([]);
  });
});
