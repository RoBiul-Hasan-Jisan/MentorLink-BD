// CV format v2: one clean, single-page, ATS-friendly layout whose sections can be re-ordered and hidden.
// Pure functions only (no database), so they are easy to test.
//
// Privacy: the `contact` block (email, phone, city, links) is the student's own and is NEVER shown to mentors,
// and companies see it only when the student ticks "contact" on the application consent screen.

const SECTION_KEYS = ['summary', 'skills', 'projects', 'experience', 'education', 'achievements', 'languages'];
const ACCENTS = ['#1F5FBF', '#0A4A39', '#7A2E8E', '#B4441A', '#222222'];
const TEMPLATES = ['classic', 'compact'];

const str = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);
const arr = (v) => (Array.isArray(v) ? v : []);
const lines = (v, max = 300, cap = 8) => arr(v).map((x) => str(x, max)).filter(Boolean).slice(0, cap);
const links = (v) => arr(v).map((l) => ({ label: str(l && l.label, 30), url: str(l && l.url, 200) })).filter((l) => l.label && /^https:\/\//i.test(l.url)).slice(0, 6);

// Turn anything we ever stored (old v1 shape or the new v2 shape) into the v2 shape with safe defaults.
function normalizeCv(data, user = {}) {
  const d = data && typeof data === 'object' ? data : {};
  const legacy = d.v !== 2;
  const order = arr(d.sectionOrder).filter((k) => SECTION_KEYS.includes(k));
  for (const k of SECTION_KEYS) if (!order.includes(k)) order.push(k);

  let skills;
  if (legacy) {
    const flat = lines(d.skills, 40, 25);
    skills = flat.length ? [{ label: 'Skills', items: flat }] : [];
  } else {
    skills = arr(d.skills).map((g) => ({ label: str(g && g.label, 40), items: lines(g && g.items, 40, 25) })).filter((g) => g.label || g.items.length).slice(0, 8);
  }

  const projects = arr(d.projects).map((p) => {
    p = p || {};
    const oldLink = legacy && p.url ? [{ label: 'Link', url: p.url }] : [];
    const bullets = p.bullets !== undefined ? lines(p.bullets, 300, 6) : (p.description ? [str(p.description, 400)] : []);
    return { title: str(p.title, 100), links: links(p.links !== undefined ? p.links : oldLink), bullets, tech: str(p.tech, 160) };
  }).filter((p) => p.title).slice(0, 8);

  const experience = arr(d.experience).map((x) => {
    x = x || {};
    const bullets = x.bullets !== undefined ? lines(x.bullets, 300, 6) : (x.details ? [str(x.details, 400)] : []);
    return { role: str(x.role, 100), organization: str(x.organization, 100), period: str(x.period, 40), bullets };
  }).filter((x) => x.role || x.organization).slice(0, 8);

  const education = arr(d.education).map((e) => {
    e = e || {};
    return { degree: str(e.degree, 120), institution: str(e.institution, 120), period: str(e.period !== undefined ? e.period : e.year, 40), note: str(e.note, 80) };
  }).filter((e) => e.degree || e.institution).slice(0, 5);

  const achievements = arr(d.achievements).map((a) => (typeof a === 'string' ? { lead: '', text: str(a, 300) } : { lead: str(a && a.lead, 100), text: str(a && a.text, 300) })).filter((a) => a.lead || a.text).slice(0, 10);

  const c = d.contact && typeof d.contact === 'object' ? d.contact : {};
  return {
    v: 2,
    template: TEMPLATES.includes(d.template) ? d.template : 'classic',
    accent: ACCENTS.includes(d.accent) ? d.accent : ACCENTS[0],
    fullName: str(d.fullName || user.displayName, 80),
    headline: str(d.headline, 120),
    contact: { city: str(c.city, 60), email: str(c.email, 100), phone: str(c.phone, 30), links: links(c.links) },
    sectionOrder: order,
    hidden: arr(d.hidden).filter((k) => SECTION_KEYS.includes(k)),
    summary: str(d.summary, 700),
    skills, projects, experience, education, achievements,
    languages: lines(d.languages, 40, 8),
  };
}

// What a mentor (or a company without the "contact" tick) may see.
function stripContact(cv) {
  return { ...cv, contact: { city: '', email: '', phone: '', links: [] } };
}

// Quick, rule-based tips (no AI service, no cost). Every tip says WHY, so the student can judge it.
const WEAK_START = /^(worked on|responsible for|helped|assisted|involved in|participated in|tried to)\b/i;
function cvTips(cv) {
  const tips = [];
  const t = (id, en, bn) => tips.push({ id, en, bn });
  const show = (k) => !cv.hidden.includes(k);
  if (show('summary')) {
    if (!cv.summary) t('summary_missing', 'Add a 2-3 line summary: who you are, your strongest proof, and the role you want.', 'দুই-তিন লাইনের সারসংক্ষেপ যোগ করুন: আপনি কে, সবচেয়ে বড় প্রমাণ কী, কোন চাকরি চান।');
    else if (cv.summary.length < 120) t('summary_short', 'Your summary is very short. Add one proof point (a project, a result or a contest).', 'সারসংক্ষেপ খুব ছোট। একটি প্রমাণ (প্রজেক্ট, ফলাফল বা প্রতিযোগিতা) যোগ করুন।');
    else if (cv.summary.length > 600) t('summary_long', 'Your summary is long. Keep it to about 4 lines so it is read.', 'সারসংক্ষেপ বড়। প্রায় ৪ লাইনে রাখুন যাতে সবাই পড়ে।');
  }
  if (show('skills') && cv.skills.length === 0) t('skills_missing', 'Add your skills grouped by type, for example "Languages: Python, SQL".', 'ধরন অনুযায়ী দক্ষতা যোগ করুন, যেমন "Languages: Python, SQL"।');
  if (show('education') && cv.education.length === 0) t('education_missing', 'Add your education (degree, university, years).', 'শিক্ষা যোগ করুন (ডিগ্রি, বিশ্ববিদ্যালয়, সাল)।');
  if (show('projects') && cv.projects.length === 0) t('projects_missing', 'Add 1-3 projects. Projects are the strongest proof for a student.', '১-৩টি প্রজেক্ট যোগ করুন। শিক্ষার্থীর জন্য প্রজেক্টই সবচেয়ে বড় প্রমাণ।');
  const items = [...(show('projects') ? cv.projects.map((p) => ({ where: p.title, bullets: p.bullets })) : []), ...(show('experience') ? cv.experience.map((x) => ({ where: x.role, bullets: x.bullets })) : [])];
  const noNumber = items.filter((i) => i.bullets.length && !i.bullets.some((b) => /\d/.test(b)));
  if (noNumber.length) t('numbers', `Add a number or result to: ${noNumber.slice(0, 3).map((i) => i.where).join(', ')} (for example "97% accuracy", "50 users").`, `এগুলোতে সংখ্যা বা ফলাফল যোগ করুন: ${noNumber.slice(0, 3).map((i) => i.where).join(', ')} (যেমন "৯৭% নির্ভুলতা", "৫০ জন ব্যবহারকারী")।`);
  const weak = items.filter((i) => i.bullets.some((b) => WEAK_START.test(b)));
  if (weak.length) t('weak_verbs', `Start bullets with a strong action verb (Built, Designed, Led) in: ${weak.slice(0, 3).map((i) => i.where).join(', ')}.`, `এগুলোর বুলেট শক্তিশালী ক্রিয়া দিয়ে শুরু করুন (Built, Designed, Led): ${weak.slice(0, 3).map((i) => i.where).join(', ')}।`);
  const long = items.filter((i) => i.bullets.length > 4);
  if (long.length) t('too_many', `Keep each item to 2-4 bullets: ${long.slice(0, 3).map((i) => i.where).join(', ')}.`, `প্রতিটিতে ২-৪টি বুলেট রাখুন: ${long.slice(0, 3).map((i) => i.where).join(', ')}।`);
  if (show('projects') && cv.projects.length && cv.projects.every((p) => p.links.length === 0)) t('project_links', 'Add a GitHub or live-demo link to at least one project so people can check it.', 'অন্তত একটি প্রজেক্টে GitHub বা লাইভ ডেমো লিংক দিন যাতে সবাই যাচাই করতে পারে।');
  if (!cv.contact.email) t('email', 'Add an email so employers can reach you. It is shared only if you tick "contact" when you apply.', 'ইমেইল যোগ করুন যাতে নিয়োগদাতা যোগাযোগ করতে পারে। আবেদনের সময় "contact" টিক দিলেই শুধু শেয়ার হয়।');
  if (!cv.headline) t('headline', 'Add a headline under your name, for example "Data Analyst (Aspiring)".', 'নামের নিচে একটি শিরোনাম দিন, যেমন "Data Analyst (Aspiring)"।');
  const total = cv.projects.length + cv.experience.length;
  return { tips, score: Math.max(0, 100 - tips.length * 10), note: total === 0 ? 'Empty sections are skipped in the PDF.' : '' };
}

// The demo CV shown in the app: Robiul's own CV layout, with no phone or email.
function sampleCv() {
  return normalizeCv({
    v: 2, template: 'classic', accent: ACCENTS[0], fullName: 'Robiul Hasan Jisan',
    headline: 'Machine Learning Engineer (Aspiring) · Full-Stack Developer',
    contact: { city: 'Chattogram, Bangladesh', links: [{ label: 'GitHub: RoBiul-Hasan-Jisan', url: 'https://github.com/RoBiul-Hasan-Jisan' }] },
    sectionOrder: ['summary', 'skills', 'projects', 'experience', 'education', 'achievements', 'languages'],
    summary: 'Full-stack developer and aspiring ML engineer with hands-on experience shipping 25+ production web and AI/ML applications, from calibrated computer-vision classifiers and local RAG systems to full-stack platforms and a from-scratch compiler. Strong algorithmic foundation (500+ problems solved, ICPC Asia Dhaka Regional Honorable Mention) paired with the ability to take AI/ML concepts from research to deployed product.',
    skills: [
      { label: 'Languages', items: ['C', 'C++', 'Java', 'Python', 'SQL', 'JavaScript', 'TypeScript'] },
      { label: 'AI / ML / DL', items: ['PyTorch', 'TensorFlow', 'Scikit-learn', 'NumPy', 'Pandas', 'RAG', 'NLP', 'Sentence Transformers'] },
      { label: 'Web / Full-Stack', items: ['React', 'Next.js', 'Node.js/Express', 'Tailwind CSS', 'REST APIs', 'Firebase', 'MongoDB', 'PostgreSQL'] },
      { label: 'Tools & Practices', items: ['Git', 'CI/CD', 'Flask', 'Data Structures & Algorithms'] },
    ],
    projects: [
      { title: 'GreenEye: Leaf Health Detector', links: [{ label: 'GitHub', url: 'https://github.com/RoBiul-Hasan-Jisan' }], bullets: ['Built a deep-learning pipeline that identifies plant species and flags disease across 40+ categories from a single photo.', 'Implemented multi-stage inference, role-based dashboards, and full prediction history on a PostgreSQL backend.'], tech: 'PyTorch, Flask, Python, PostgreSQL' },
      { title: 'FoodGenome AI: Calibrated Food Classifier', links: [{ label: 'GitHub', url: 'https://github.com/RoBiul-Hasan-Jisan' }], bullets: ['Trained a Food-101 classifier reaching 97.16% top-1 accuracy, with conformal prediction sets giving a 99.56% measured coverage guarantee.', 'Traced each of the 101 categories to a 32-nutrient USDA profile and exposed model attention for interpretability.'], tech: 'Python, Deep Learning, Conformal Prediction, Computer Vision' },
      { title: 'SemantiKB: Local Semantic-Chunking RAG System', links: [{ label: 'GitHub', url: 'https://github.com/RoBiul-Hasan-Jisan' }], bullets: ['Designed a context-aware chunking method using sentence embeddings to split documents at true topic boundaries, instead of fixed-size blocks.', 'Built a fully local RAG pipeline (Sentence Transformers, ChromaDB, Ollama) requiring no paid APIs.'], tech: 'Python, Sentence Transformers, ChromaDB, Ollama' },
    ],
    experience: [
      { role: 'Data Analyst & Project Manager', organization: 'NASA App Challenge', period: 'Sep 2025 – Oct 2025', bullets: ['Worked on the Terra Celebration animation project and its accompanying website.', 'Analyzed datasets and coordinated tasks across a cross-platform, collaborative team workflow.'] },
      { role: 'Core Developer', organization: 'Team 4Looper', period: 'May 2025 – Aug 2025', bullets: ['Developed a streaming-style web platform with dynamic content and interactive UI.', 'Owned project management, database architecture, and CI/CD across the team.'] },
    ],
    education: [
      { degree: 'Bachelor of Science (BSc) in Computer Science and Engineering', institution: 'East Delta University', period: '2023 – 2027 (Ongoing)', note: '' },
      { degree: 'Higher Secondary Certificate (HSC), Science', institution: 'Hazera Taju Degree College, Chittagong', period: '2018 – 2020', note: 'GPA: 5.00 / 5.00' },
    ],
    achievements: [
      { lead: '2024 ICPC Asia Dhaka Regional', text: 'Honorable Mention, representing East Delta University in Asia\'s premier team programming competition.' },
      { lead: 'Intra University Programming Contest (2022–2023)', text: 'competed in annual algorithmic problem-solving competitions.' },
    ],
    languages: ['Bangla (Native)', 'English (Fluent)'],
  });
}

module.exports = { SECTION_KEYS, ACCENTS, TEMPLATES, normalizeCv, stripContact, cvTips, sampleCv };
