# Route Audit

**Scope and honesty note.** Routes were discovered from the real source (`mobile/lib/router.dart` plus each `*Routes` list, the Next.js `admin-panel/app`, and `backend/src/app.js`). **62 Flutter routes** were found. No route was executed: the Flutter SDK is not installed and the package registry is blocked in this environment. 'Fixed (untested)' means source was changed by this audit and read back, but not compiled. 'Unverified' means not compiled and not line-reviewed in depth; the Security column then repeats only what the backend route code shows.

Admin panel: a single route `/` (tabs: Queue, Reports (new), Companies, Resources, Audit log, Fairness, Universities); duplicate stale `page.js`/`layout.js` were removed, `.tsx` is canonical. Backend public page: `GET /p/:slug` (Career Passport).

| Route | User role | Purpose | Status | Data source | UI/UX issues | Functional issues | Security issues | Recommended improvements | Priority | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | all signed-in (role shell) | Shell with role-specific tabs | Unverified | GET /me, /readiness, /plan, /matches, /opportunities | Home loads 5+ providers at once; no per-section retry noted | Student Join button only showed a toast (FIXED) | Role only from server | Career Action Center on Home (see roadmap) | P1 | mobile/lib/features/home.dart, shell.dart |
| `/welcome` | guest | Landing | Working (widget test exists) | local | - | - | - | - | P3 | features/welcome.dart, test/welcome_screen_test.dart |
| `/sign-in` | guest | Firebase email sign-in | Unverified | Firebase Auth | No password-reset link found in source search | - | Relies on Firebase brute-force limits | Add 'Forgot password' via Firebase sendPasswordResetEmail | P2 | features/auth.dart |
| `/sign-up` | guest | Create account | Unverified | Firebase Auth + POST /auth/register-profile | - | - | Role forced to student server-side (good) | - | P3 | backend/src/routes/core.js |
| `/complete-profile` | new user | Profile step | Unverified | POST /auth/register-profile | - | - | - | - | P3 | router.dart redirect |
| `/verify` | student | Upload verification docs | Unverified | POST /me/verification-doc | - | - | MIME + magic-byte check, 300 KB cap (good); docs stored in MongoDB | Move to object storage later | P3 | routes/extras.js |
| `/problem` | signed-in | Shown when /me fails | Unverified | - | - | - | - | - | P3 | router.dart |
| `/notifications` | all | Notification list | Fixed (untested) | GET /notifications, POST /notifications/:id/read, /read-all | No pagination UI (server now supports ?before) | Tap only marked read, never navigated (FIXED via typed target) | Destination ids validated client + server; screens re-check access | Add load-more + unread badge | P1 | features/notifications.dart, core/notify_route.dart, utils/notifyTarget.js |
| `/privacy` | all | Privacy toggles, export, delete | Partial | PATCH /me/privacy, GET /me/export, DELETE /me | No pending indicator on toggles | Reminder/quiet-hour settings were stored but ignored (FIXED in notify()); export misses posts, passport, sprints, projects, GitHub, invites; delete leaves posts/passport/sprints rows | Deleted users' public passport is hidden (good) | Complete export and deletion coverage | P1 | routes/extras.js:178-215 |
| `/goal` | student | Choose career goal | Unverified | PUT /me/goal | - | - | - | - | P2 | features/onboarding.dart |
| `/roles` | admin | Role list/preview | Unverified | GET /admin/users, PATCH /admin/users/:id/role | Name search only | - | Server blocks self-change and admin/employer changes (good); audited | - | P3 | features/privacy.dart, routes/extras.js |
| `/skill-gap` | student | Compare skills to goal | Unverified | GET /me/readiness | - | - | - | Explain evidence + freshness | P2 | features/skillgap.dart |
| `/job-gaps` | student | Skills seen in job posts | Unverified | GET /me/job-gaps | - | Needs >=3 approved posts to be meaningful (labelled in app) | - | - | P3 | features/job_gaps.dart |
| `/targets` | student | Milestone list | Unverified | GET /targets | - | Overlaps with /roadmaps and /my-paths | - | Clarify labels (see PROJECT_AUDIT section 9) | P2 | features/targets.dart |
| `/target/:key` | student | Milestone detail | Unverified | GET /targets/:key | - | Unknown key behaviour not checked | - | - | P2 | features/targets.dart |
| `/roadmaps` | student | Roadmap list | Unverified | GET /roadmaps | - | - | - | - | P3 | features/roadmap.dart |
| `/roadmap/:skillKey` | student | Roadmap detail | Unverified | GET /roadmaps/:skillKey, PUT topics | - | - | - | - | P3 | features/roadmap.dart |
| `/quiz/:skill` | student | Skill quiz | Unverified | GET/POST /quizzes/:skillKey | - | Quiz result becomes evidence; must not equal 'verified' skill | - | Show 'self-tested' vs 'mentor-endorsed' | P2 | routes/learning.js |
| `/plan` | student | Four-week plan | Unverified | GET /me/plan, PATCH /tasks/:id | - | Plan only fills after mentor completes a session; mentors previously could not (FIXED) | - | - | P1 | features/career.dart:242 |
| `/career-graph` | student | Skill/role graph | Unverified | GET /me/graph | No accessible text alternative checked | - | - | Add list view for screen readers | P2 | features/career_graph.dart |
| `/decision-lab` | student | Scenario comparison | Unverified (logic unit test exists) | GET /me/decision-lab, POST simulate | - | - | - | - | P3 | features/decision_lab.dart, test/decision_lab_logic_test.dart |
| `/help-finder` | student | Find help for a gap | Unverified | GET /me/help-finder | - | - | - | - | P3 | features/career.dart |
| `/how-matching` | all | Explain matching | Working by source | GET /matching/info | - | - | Weights read from the same constants the code uses (good) | - | P3 | routes/extras.js:30 |
| `/my-paths` | student | Saved targets | Unverified | PUT /me/targets, GET /me/dashboard | Overlaps /targets | - | - | Merge navigation labels, keep URLs | P2 | features/hub.dart |
| `/progress` | student | Progress and badges | Unverified | GET /me/progress | - | Progress also computed in /me/plan, /me/loop and passport: risk of mismatched numbers | - | One shared progress service | P2 | routes/extras.js:137 |
| `/portfolio` | student | Projects and GitHub | Unverified | GET /me/portfolio, POST/PUT/DELETE projects, github start/verify | - | - | GitHub verification is code-checked on server; not run here | - | P2 | routes/career.js |
| `/cv` | student | CV builder + PDF | Unverified | POST /me/cv, /me/cv/check | - | - | Contact block stripped for mentors/employers unless shared | - | P2 | features/cv.dart |
| `/resources` | student | Learning resources | Unverified | GET /resources, progress, report | - | - | https-only URLs enforced for admin-added resources | - | P3 | features/resources.dart |
| `/pathways` | student | Pathways and Q&A hub | Unverified | - | Overlaps /qa | - | - | - | P3 | features/sessions.dart |
| `/path-twins` | student | Similar journeys | Unverified | GET /me/path-twins | - | - | - | - | P3 | features/path_twin.dart |
| `/passport` | student | Career Passport settings | Unverified | GET/PUT /me/passport, rotate | - | - | Opt-in, random slug, rotation, noindex, escaped HTML (good); requires verified account | Add visible 'revoke now' confirmation | P2 | routes/startup.js:64-120 |
| `/outcome-tracker` | student | Self-reported outcomes | Unverified | GET /me/outcome-tracker | - | - | Self-reported; labelled | - | P3 | routes/loop.js |
| `/mock-interviews` | student/mentor | Mock interviews | Unverified | GET/POST /mock-interviews | - | - | - | - | P3 | routes/extras.js |
| `/mentor/:id` | student | Mentor profile | Working by source | GET /mentors/:id | Report action added (FIXED) | - | No contact data exposed | - | P3 | features/mentor_detail.dart |
| `/request/:mentorId` | student | Send request | Unverified | POST /requests | - | - | Server checks block, capacity, duplicates | - | P2 | features/onboarding.dart |
| `/mentor/request/:id` | mentor | Review request | Fixed (untested) | GET /requests, POST /requests/:id/decision | Direct link refetches list (ok) | No way to schedule after accept (FIXED); decision was not atomic (FIXED) | Mentor-only, ownership checked | - | P1 | features/mentor.dart, mentor_more.dart, routes/mentoring.js |
| `/chat/:id` | student/mentor | Request chat | Unverified | GET/POST /requests/:id/messages + Socket.IO | No report/block entry point | Chat ignores blocks | Only two parties of an accepted request | Enforce block in chat | P2 | features/chat.dart, realtime.js |
| `/sessions` | student/mentor | Sessions | Fixed (untested) | GET /sessions, cancel, rate, complete | Screen was student-only | Mentors had no complete/notes action; Join only displayed link (FIXED) | Cancel/no-show rules server side | Add reschedule | P1 | features/sessions.dart, mentor_sessions.dart |
| `/session-notes/:id` | student | Read session notes | Unverified | GET /sessions | Falls back to 'not found' text | - | Private mentor notes not separated from shared notes | Add private-notes field | P2 | features/sessions.dart |
| `/gap/:skillKey/mentors` | student | Mentors for a gap | Unverified | GET /me/gaps/:skillKey/mentors | - | - | - | - | P3 | features/loop.dart |
| `/mentor/setup` | mentor | Mentor profile | Unverified | PUT /me/mentor-profile | - | - | Counters cannot be set (strict schema) | - | P3 | features/mentor_more.dart |
| `/mentor/journey` | mentor | Mentor journey | Unverified | PUT /me/journey | - | - | - | - | P3 | features/path_twin.dart |
| `/mentor/mentee/:id` | mentor | Review pack | Unverified | GET /mentees/:studentId/review-pack | - | - | Accepted-mentee check in route (verify in tests) | - | P2 | routes/loop.js:63 |
| `/mentor/reviews` | mentor | Evidence review queue | Unverified | GET /mentor/review-queue | - | - | - | - | P2 | features/loop.dart |
| `/mentor/sprint-reviews` | mentor | Sprint reviews | Unverified | GET /mentor/sprint-reviews | - | - | - | - | P3 | features/launch.dart |
| `/mentor/plan-reviews` | mentor | Plan reviews | Unverified | GET /mentor/plan-reviews | - | - | - | - | P3 | features/career.dart |
| `/review-cv/:studentId` | mentor | CV review | Unverified | GET /mentees/:studentId/cv | - | - | Accepted-mentee check + contact stripped (good) | - | P3 | routes/opportunities.js:38 |
| `/sprints` | student | Mentor sprints | Unverified | /me/sprints* | - | - | - | - | P3 | features/launch.dart |
| `/my-reviews` | student | Review feedback | Unverified | GET /me/reviews | - | - | - | - | P3 | features/loop.dart |
| `/mentor/post-opportunity` | mentor | Post a job | Unverified | POST /opportunities | - | - | Verified users only; scam flags; admin review | - | P3 | routes/opportunities.js |
| `/applications` | student | My applications | Unverified | GET /me/applications, withdraw | - | Withdraw allowed from any stage; re-apply blocked by unique index | - | Restrict withdraw by stage | P2 | routes/opportunities.js:143 |
| `/opportunity/:id` | student/mentor/dept/admin | Job detail + apply + report | Unverified | GET /opportunities/:id, apply, /reports | - | - | Duplicate apply prevented by unique index | Search/filters, saved jobs | P2 | features/jobs_more.dart |
| `/applicants/:id` | employer | Applicants for a job | Fixed (untested) | GET /employer/jobs/:id/applicants | Title lost on refresh (FIXED: looked up from jobs list) | Mentor posters cannot open this (employer endpoint only) | Org-ownership check on server; only consented fields | Null-safe populate for deleted students | P2 | features/employer.dart, routes/employer.js |
| `/invites` | student | Company invitations | Unverified | GET /me/invites, respond | - | No expiry on invites | - | Add expiry | P3 | routes/startup.js |
| `/feed` | member | Community feed | Unverified | GET /feed, posts, reactions | - | - | Report auto-hide after 3 reporters | - | P3 | features/feed.dart |
| `/post/:id` | member | Post detail | Unverified | GET /posts/:id | - | - | - | - | P3 | features/feed.dart |
| `/qa` | student/mentor | Questions | Unverified | GET /qa | - | - | - | - | P3 | features/community.dart |
| `/qa/:id` | student/mentor | Question detail | Unverified | GET /qa/:id | - | - | - | - | P3 | features/community.dart |
| `/report-user` | student/mentor | Report a user | Fixed (untested) | POST /reports (+ /users/:id/block) | Was unreachable (no caller) and depended on router state; now ?id=&name= with entry points on mentor profile and request | User reports had no reviewer (FIXED: admin Reports tab) | Target must exist; self-report refused; reporter never shown | Add entry point in chat | P1 | features/privacy.dart, sessions.dart, routes/opportunities.js, admin.js |
| `/university-map` | student/mentor/dept/admin | Campus map + directory | Fixed (untested) | GET /directory/universities | Map ignored low-data mode; no attribution (FIXED) | Seed/verified flag not stored in DB (cannot tell verified from approximate pin) | Employers refused; people shown at campus only | Store coordsVerified; consider a self-hosted tile source for production (OSM public tiles are not for heavy use) | P1 | features/university.dart, models/people.js |
| `/university/:id` | student/mentor/dept/admin | Members at a campus | Unverified | GET /directory/universities/:id/members | - | - | Opt-in and verified only; name shown as 'First L.' | - | P3 | features/university.dart |
| `/admin-impact` | admin | Impact card | Unverified | GET /admin/impact | No period / sample size / definitions shown | - | - | Add metric definitions and small-cohort suppression | P2 | features/loop.dart:527 |
| `/` (admin panel) | admin | Admin tabs | Fixed (untested build) | `/api/admin/*` via Firebase token | Tables unpaged except users; no responsive check | Duplicate .js files removed; Reports tab added | Role enforced server-side (good); UI check only hides tabs | Pagination, confirm dialogs on all destructive actions | P1 | admin-panel/app/page.tsx |
