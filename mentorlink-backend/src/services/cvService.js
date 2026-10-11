// CV completeness (pure). Skills come from the student's evidence, so they are never typed into the CV.
function cvCompleteness(cv, evidenceSkillCount) {
  const personal = !!(cv.headline && cv.headline.trim() && cv.summary && cv.summary.trim());
  const education = (cv.education || []).length >= 1;
  const projects = cv.projects || [];
  const withLink = projects.filter((p) => p.url).length;
  const skills = evidenceSkillCount > 0;
  const percent = (personal ? 25 : 0) + (education ? 25 : 0) + (Math.min(projects.length, 2) / 2) * 25 + (skills ? 25 : 0);
  return {
    percent: Math.round(percent),
    sections: { personal: personal ? 'done' : 'missing', education: education ? 'done' : 'missing',
      projects: `${Math.min(projects.length, 2)} of 2`, skills: skills ? 'synced' : 'empty' },
    hint: projects.length < 2 ? 'add_project' : withLink < projects.length ? 'add_project_link' : null,
  };
}
module.exports = { cvCompleteness };
