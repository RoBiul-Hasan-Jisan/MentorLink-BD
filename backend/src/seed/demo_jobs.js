// More DEMO jobs and internships (ALL posted by the employer demo account for Demo Tech Ltd; nobody else can post) so the job board, matching, job-gap and saved-jobs screens have variety.
// Every organisation here is invented and every title ends with "(Demo)". No listing asks for a fee.
// Idempotent: a job is only created if its title does not exist yet.
const { Opportunity, Organization, User } = require('../models');

const NOFEE = ' No fee is ever asked from applicants.';
const day = (n) => new Date(Date.now() + n * 864e5);
const sk = (...a) => a.map(([skillKey, requiredLevel, weight]) => ({ skillKey, requiredLevel, weight }));

// Posted by the employer demo account for the verified "Demo Tech Ltd" (sourceLabel "employer").
const EMPLOYER_JOBS = [
  ['Frontend Developer (Demo)', 'job', 'full_time', 'hybrid', 'Chattogram', 'Build responsive pages with HTML, CSS and JavaScript and review each other\u2019s pull requests.', sk(['htmlcss', 2, 3], ['javascript', 2, 3], ['git', 1, 1]), 22],
  ['QA Engineer (Demo)', 'job', 'full_time', 'onsite', 'Chattogram', 'Write test cases, run regression tests and report bugs clearly.', sk(['testing', 2, 3], ['git', 1, 1], ['communication', 2, 2]), 19],
  ['Junior Data Scientist (Demo)', 'job', 'full_time', 'hybrid', 'Dhaka', 'Train and evaluate simple models on tabular data and explain results to non-technical teammates.', sk(['machinelearning', 2, 3], ['python', 2, 3], ['statistics', 2, 2]), 27],
  ['Mobile App Developer (Demo)', 'job', 'full_time', 'remote', 'Remote', 'Ship features for a Flutter app used by small shops.', sk(['appdev', 2, 3], ['programming', 2, 2], ['git', 1, 1]), 24],
  ['DevOps Intern (Demo)', 'internship', 'internship', 'hybrid', 'Chattogram', 'Learn CI pipelines, containers and basic cloud deployment with a mentor.', sk(['clouddevops', 1, 3], ['git', 2, 2], ['networking', 1, 1]), 15],
  ['Security Analyst Trainee (Demo)', 'job', 'full_time', 'onsite', 'Dhaka', 'Monitor alerts, triage incidents and write short incident notes.', sk(['cybersecurity', 2, 3], ['networking', 2, 2]), 26],
  ['UI/UX Design Intern (Demo)', 'internship', 'internship', 'remote', 'Remote', 'Turn rough ideas into clickable prototypes and test them with five users.', sk(['uiux', 2, 3], ['graphicdesign', 1, 1], ['htmlcss', 1, 1]), 17],
];

async function seedMoreJobs() {
  const emp = await User.findOne({ email: 'employer@demo.mentorlink.bd' });
  if (!emp) return 0;
  const org = await Organization.findOne({ name: 'Demo Tech Ltd' });
  let created = 0;
  const add = async (doc) => { if (!(await Opportunity.exists({ title: doc.title }))) { await Opportunity.create({ noFeeConfirmed: true, ...doc }); created++; } };

  if (org) {
    for (const [title, type, employmentType, workplaceMode, locationText, desc, requiredSkills, deadline] of EMPLOYER_JOBS) {
      await add({ postedBy: emp._id, organizationId: org._id, organization: org.name, title, type, employmentType, workplaceMode, locationText, description: desc + NOFEE, requiredSkills, applicationDeadline: day(deadline), sourceLabel: 'employer', listingReviewed: true, status: 'approved' });
    }
  }
  // Moderation examples (not visible on the public board).
  await add({ postedBy: emp._id, organizationId: org && org._id, organization: org ? org.name : 'Demo Tech Ltd', title: 'Backend Developer, awaiting review (Demo)', type: 'job', employmentType: 'full_time', workplaceMode: 'hybrid', locationText: 'Chattogram', description: 'New listing waiting in the admin review queue.' + NOFEE, requiredSkills: sk(['backend', 2, 3], ['sql', 2, 2]), sourceLabel: 'employer', listingReviewed: false, status: 'pending' });
  // A closed job, to show how closed jobs look (posted by the employer, like every job).
  if (org) await add({ postedBy: emp._id, organizationId: org._id, organization: org.name, title: 'Sales Assistant, closed (Demo)', type: 'job', employmentType: 'full_time', workplaceMode: 'onsite', locationText: 'Chattogram', description: 'This demo listing is already closed, to show how closed jobs look.' + NOFEE, requiredSkills: sk(['communication', 2, 3]), applicationDeadline: day(-5), sourceLabel: 'employer', listingReviewed: true, status: 'approved', closed: true });
  return created;
}
module.exports = { seedMoreJobs, EMPLOYER_JOBS };
