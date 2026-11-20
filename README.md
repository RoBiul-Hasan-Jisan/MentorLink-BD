# MentorLink BD

Career mentorship for Bangladeshi university students (English / বাংলা).
Loop: career goal → skill gap → free resources / quiz → explainable mentor match → sessions → four-week plan → CV → vetted job → outcome feedback.

```
backend/       Node.js + Express + Mongoose + Socket.IO     40 Jest tests
mobile/        Flutter (Riverpod, GoRouter, Dio, flutter_map)
admin-panel/   Next.js web admin panel (Firebase Web SDK)
```

## Who can post jobs (rule)
**Only an `employer` can post a job.** An employer is a user whose role is `employer` AND who is an active member of a **verified** company.
- The only endpoint that creates a job is `POST /api/employer/jobs` (`backend/src/routes/employer.js`). Student, mentor, department and admin accounts get **403** there.
- The old open route `POST /api/opportunities` (student / mentor / admin posting) was **deleted**. It now returns 404 for everyone.
- Students, mentors, departments and admins can only read jobs (students can also save, apply and report). Admins review and approve/hide jobs, but never post them.
- A client can never set its own role. `employer` is given by the server only when an admin verifies the company (`POST /api/admin/organizations/:id/review`).
- Every new job post (and every repost) is held for admin review and only becomes visible to students after an admin approves it.
- Every job in the database carries `sourceLabel: 'employer'` and an `organizationId`.
- Mobile app: the "Post a job" buttons and screens for students and mentors were removed. Only the recruiter dashboard has "Post a job". Mentors now see a read-only list of live jobs. The Privacy screen table says "Post jobs: company/employer accounts only".
- If your database still has old jobs from students, mentors or admins, run `cd backend && npm run cleanup:jobs`. It deletes those jobs and their applications, interviews, papers, offers, messages, saved marks and reports. `npm run seed:demo` does the same cleanup automatically.

## Demo jobs: which employer posted which job
All demo accounts use password `Demo@12345`. **19 jobs in total: 17 live, 2 waiting for admin review** (1 of the 17 live jobs is closed).

| Employer account (sign in) | Name | Company | Job posted | Status |
|---|---|---|---|---|
| employer@demo.mentorlink.bd | Demo Employer (Phase 2), owner | Demo Tech Ltd | Junior Backend Developer (Demo) | live |
| employer@demo.mentorlink.bd | | Demo Tech Ltd | Frontend Developer (Demo) | live |
| employer@demo.mentorlink.bd | | Demo Tech Ltd | QA Engineer (Demo) | live |
| employer@demo.mentorlink.bd | | Demo Tech Ltd | Junior Data Scientist (Demo) | live |
| employer@demo.mentorlink.bd | | Demo Tech Ltd | Mobile App Developer (Demo) | live |
| employer@demo.mentorlink.bd | | Demo Tech Ltd | DevOps Intern (Demo) | live |
| employer@demo.mentorlink.bd | | Demo Tech Ltd | Security Analyst Trainee (Demo) | live |
| employer@demo.mentorlink.bd | | Demo Tech Ltd | UI/UX Design Intern (Demo) | live |
| employer@demo.mentorlink.bd | | Demo Tech Ltd | Sales Assistant, closed (Demo) | live, **closed** |
| employer@demo.mentorlink.bd | | Demo Tech Ltd | Backend Developer, awaiting review (Demo) | **pending** admin review |
| employer.hr@demo.mentorlink.bd | Rafiq Ahmed, recruiter (same company, 2nd recruiter) | Demo Tech Ltd | Technical Support Engineer (Demo) | live |
| employer2@demo.mentorlink.bd | Nusrat Karim (HR), owner | Demo Bay Analytics Ltd | Business Intelligence Analyst (Demo) | live |
| employer2@demo.mentorlink.bd | | Demo Bay Analytics Ltd | Analytics Intern (Demo) | live |
| employer2@demo.mentorlink.bd | | Demo Bay Analytics Ltd | Data Entry Operator (Demo) | live |
| employer3@demo.mentorlink.bd | Imran Chowdhury (HR), owner | Demo Karnaphuli Textiles Ltd | Accounts Executive (Demo) | live |
| employer3@demo.mentorlink.bd | | Demo Karnaphuli Textiles Ltd | Merchandiser Trainee (Demo) | live |
| employer3@demo.mentorlink.bd | | Demo Karnaphuli Textiles Ltd | Textile Quality Inspector (Demo) | **pending** admin review |
| employer4@demo.mentorlink.bd | Tahmina Haque (HR), owner | Demo Shikhon Learning Hub | Spoken English Instructor (Demo) | live |
| employer4@demo.mentorlink.bd | | Demo Shikhon Learning Hub | Student Success Officer (Demo) | live |

How to check each one:
1. Sign in as that employer: the recruiter dashboard lists exactly the jobs of its own company (`GET /api/employer/jobs`). Recruiters of the same company (Demo Tech Ltd has two) see the same jobs. Another company's jobs return 404.
2. Sign in as `admin@demo.mentorlink.bd` (password `Admin@12345`): Jobs tab shows every job with its poster and source; the source is `employer` for all 19.
3. Try the rule: sign in as a student, mentor or department account and call `POST /api/employer/jobs`: you get 403. `POST /api/opportunities` gives 404 for everyone.
4. A company that is still waiting for verification (Demo Greenway Logistics, owner student.su@) cannot post at all until the admin verifies it.
5. Removed from the demo because they were posted by non-employers: 11 admin jobs, 5 student posts, 1 alumni referral (and their applicants).

## Job portal v2: what was added
**Employer side**
- **Recruiter sign-up:** a new "Recruiter (company)" card on sign-up creates the recruiter account and its company together (`POST /api/auth/register-recruiter`). The account can do nothing until an admin verifies the company; the app shows "Waiting for admin verification". Students can no longer register a company.
- **Richer job form:** salary range (BDT/month), vacancies, experience level (fresher/junior/mid), city, and up to 3 screening questions.
- **Edit, draft, repost:** `PATCH /api/employer/jobs/:id` (edit; money words send a live job back to review; admin-removed jobs cannot be edited), `saveAsDraft` + `POST .../submit`, `POST .../repost`, `POST .../reopen`.
- **Applicant ranking:** `GET /api/employer/jobs/:id/applicants?sort=fit|newest|stage&stage=...`. Skill fit % and screening answers are shown; fit appears **only if the student agreed to share "skills"** when applying.
- **Job stats:** views, saves, applications, applicants per stage (`GET /api/employer/jobs/:id/stats`). The dashboard shows views and saves on every job.
- **Response rate:** the company page and recruiter dashboard show how many applicants got a reply and the average days to the first reply (only after 3+ applications older than 3 days).
- **Nudges:** an applicant waiting 7+ days in "Applied" sends the employer team one reminder per job.

**Student side**
- **Job alerts:** when a job goes live, students whose verified skills fit it (40%+) get one notification. They can switch it off in Profile > Job alerts (`jobAlertsOn`).
- **Filters:** salary 20k+, fresher, Chattogram (API: `minSalary`, `experience`, `city`). **Similar jobs** under every job. **Company page** (`GET /api/companies/:id`: public facts, response rate, open jobs; never the private proof).
- **Deadline reminders:** a saved job closing within 48 hours sends one reminder (unless already applied).
- **Apply form:** answers the employer's questions and chooses to share "Skill levels" (on by default, can be unticked).

**Admin side**
- **Bulk approve / reject:** `POST /api/admin/opportunities/bulk-review` (pending only, up to 50, audited, posters told). The review queue is sorted oldest-first with an `overdue` flag (target: reviewed within 48 hours).
- **Auto-close:** every 15 minutes, approved jobs past their deadline are closed automatically.

## Who can use what (access matrix)
Roles are fixed on the server. A client can never choose or change a role. Every route checks the role; the test `backend/tests/jobportal.test.js` ("access matrix") proves it, and `safety.test.js` / `employer.test.js` / `hiring_flow.test.js` cover posting, isolation between companies and the hiring steps.

| Function | Student | Mentor | Department | Employer | Admin |
|---|---|---|---|---|---|
| Browse, save, apply to jobs, see company pages | yes | read only | read only | no | read only |
| Post / edit / close / repost jobs, see own applicants | no | no | no | yes (own verified company only) | no |
| Move applicants, interviews, papers, offers, messages | own applications only | no | no | yes (own company only) | read only (every view is audited) |
| Approve / reject / hide jobs, verify companies, bulk review | no | no | no | no | yes |
| Learning roadmaps, resources, community feed, directory | yes | yes | yes | no | yes |
| Mentor requests and sessions | requests | answers | no | no | sees all |
| Department analytics and approvals | no | no | yes | no | yes |
| Everyone's data, reports, audit log, hiring overview | no | no | no | no | **yes (only admin sees everything)** |

What the admin can see "between" them: `GET /api/admin/hiring/overview`, each job's applicants and pipeline (`/admin/jobs/:id/applications`), the messages of any application (each read is written to the audit log), reports, and the audit log.
Another company's jobs and applicants look like 404 to an employer. An applicant never sees other applicants.

## Honest status
| Part | Status |
|---|---|
| Backend (MVP + Phase 2: resources, quizzes, companies) | Built. 40 tests pass against FerretDB (a MongoDB-compatible database). Run `npm test` once on real MongoDB too. |
| Admin panel | Compiles (`next build`). Sign-in not tested against your live Firebase. |
| Flutter app | All MVP and Phase 2 screens written. **Never compiled by me** (no Flutter SDK in my environment). Expect small fixes on first run: send the error text and they are quick to fix. |
| Push notifications (FCM) | Server stores device tokens and sends pushes; the app registers its token on Android/iOS. Not tested on a device. |
| Not built | Mentor profile detail screen, CV builder beyond a basic version, resource "saved / in-progress" states (only "done" exists), resource reporting by students, link checker, TypeScript in the admin panel (it is JavaScript). |

## Setup
### 1. Backend
```bash
cd backend
cp .env.example .env         # already filled for you in the zip; never upload .env to GitHub
npm install
npm test                     # SAFE: uses mongodb://127.0.0.1:27017/mentorlink_test (TEST_MONGODB_URI). Never touches MONGODB_URI.
npm start                    # http://localhost:4000
DEMO_MODE=true npm run seed:demo   # needs backend/serviceAccount.json (Firebase > Project settings > Service accounts > Generate new private key)
```
- Atlas: allow your IP in Network Access (for learning: `0.0.0.0/0`). Firebase console: enable Authentication > Email/Password.
- Auth: the app sends the Firebase credential as `Authorization: Bearer <string>`. The server verifies it with Firebase Admin and reads the **role from MongoDB**. We write no JWT code.
- University pins in `src/seed/universities.json`: East Delta and Southern are set from public coordinates (Wikipedia). The others are approximate (`"verified": false`); check them on a map.

### 2. Mobile
```bash
cd mobile
flutter create . --org bd.mentorlink --project-name mentorlink_bd
# copy android_config/google-services.json to android/app/ and set applicationId "mentorlinkbd.com" in android/app/build.gradle
flutter pub get
flutter run -d chrome --dart-define=API_URL=http://localhost:4000 --dart-define=DEMO=true
# Android emulator: --dart-define=API_URL=http://10.0.2.2:4000
```
`DEMO=true` shows quick-fill demo account chips on the sign-in screen. The app asks for **no location permission**.

### 3. Admin panel
```bash
cd admin-panel && npm install && npm run dev      # http://localhost:3000
```
Tabs: Queue (users, mentor applications, job posts with scam flags), Companies (verify / reject / suspend, with private proof), Resources, Audit log, Fairness, Universities.

## Demo accounts (after `seed:demo`)
| Role | Email | Password | University |
|---|---|---|---|
| Student | student.edu@demo.mentorlink.bd | Demo@12345 | East Delta University (Robiul) |
| Student | student.su@demo.mentorlink.bd | Demo@12345 | Southern University |
| Mentor | mentor1@demo.mentorlink.bd | Demo@12345 | East Delta University (Abrar) |
| Mentor | mentor2@demo.mentorlink.bd | Demo@12345 | Southern University |
| Department | dept@demo.mentorlink.bd | Demo@12345 | East Delta University (Dayan) |
| Admin | admin@demo.mentorlink.bd | Admin@12345 | n/a (Ayesha) |
| Employer | employer@demo.mentorlink.bd | Demo@12345 | member of verified "Demo Tech Ltd" |

## 5-minute demo (sign in with the demo chips or the table above)
1. **Robiul (student, East Delta):** Home shows readiness for Data Analyst and the next steps. Open Skill gap: radar and ranked gaps. Tap a gap to open its roadmap (beginner to advanced topics, "Start here").
2. **Plan > Pick a target > Machine Learning:** tick what Robiul already knows (Python, NumPy/pandas, statistics). Show the score, the "proven" share, the group bars, and the ordered path: topics that can start now vs "first learn X".
3. **Quiz:** take the SQL quiz (graded on the server). Go back to Skill gap: the level changed because of quiz evidence, not because of ticks.
4. **Mentors tab:** top matches come from several universities (Abrar, Rahim Ahmed of North South, others). Open one: six-part score and "Why this mentor". Send a request.
5. **Abrar (mentor):** accept the request, open chat. A session note becomes tasks in Robiul's four-week plan.
6. **Robiul:** tick a task. Jobs tab: apply with the consent screen; the tracker shows the 5 stages.
7. **Employer (only employers can post jobs):** post a job (first post goes to admin review), open applicants (only consented fields), move a stage (invalid jumps are rejected).
8. **Ayesha (admin, same app, normal Sign in):** Queue tab approves the job; Companies, Resources (check links) and Insights (audit log, fairness, campuses).
9. **University map:** seven campuses at different pins; people appear as "Robiul H.", never an address. The employer gets 403 on the directory.

## Security and privacy review (what was checked)
- **67 endpoints**; all require sign-in except `GET /api/universities` (needed at sign-up, contains no personal data). Role is checked on the server for every route; ownership is checked for requests, sessions, plans, chat, CVs, applications.
- **Roles:** a client can never send or change its own role (strict schemas reject `role`). `mentor` only through admin approval; `employer` only through admin verification of a company, set by the server.
- **Company isolation:** a recruiter sees only jobs and applicants of their own verified company (others return 404); the private verification proof is never returned to employers or students; suspending a company hides its jobs.
- **Application data:** applicants are shown only the fields the student consented to (`consentSnapshot`); stage changes are validated server-side and recorded in `stageHistory`; the unique index blocks double applications.
- **Location:** no user has coordinates; requests containing lat/lng/location/address/gps are rejected with 400; the map shows campuses only; directory requires `verified` and `showInDirectory`; employers get 403.
- **Scam protection:** no-fee confirmation required; keyword flags; auto-hide at 3 unique reporters; admin restore/remove; audit logs.
- **Other:** helmet, CORS, rate limit, zod validation with strict schemas, one error shape. `grep -ri jwt` over our code finds only comments. No secrets in the repo except your local `.env` (git-ignored). `npm audit` reports 0 vulnerabilities for the backend.
- Tests never use your real database (name must end in `_test`).

## Known limitations
- No user study and no measured accuracy of the match score; the weights (30/25/15/10/10/10) are our own, documented, and adjustable. A keyword baseline is returned next to the matches for comparison.
- Skill levels come from quiz, project or mentor evidence; the quiz bank covers 8 skills with 8 questions each (small, written by us, not validated).
- Seeded links are unchecked until a teammate opens each one (admin Resources > Check links helps). Add more from the admin panel.
- Chat is plain text over Socket.IO; no file sharing. Reminders run every 15 minutes (in-app plus push); push has not been tested on a real phone.
- FerretDB does not support every MongoDB feature (no 2dsphere index): set `MONGO_GEO_INDEX=true` on real MongoDB/Atlas.
- We do not claim this is the first platform of its kind.


## Update: Home screen now follows the prototype
- Streak pill shows a real day streak (days in a row with a completed task, Asia/Dhaka days).
- Next-session card shows "Tomorrow, 6:30 PM" and the mentor's name and job title.
- Readiness text ends with "Close A and B to reach N%" (N = score if the two biggest gaps were closed).
- Task tags show the due weekday (Fri).


## Update 3
- Mentor profile screen (`GET /api/mentors/:id`, route `/mentor/:id`): expertise, languages, open slots, no contact details.
- Resources can be Saved / In progress / Done / Cleared (`PUT|DELETE /api/resources/:id/progress`) and reported as broken (`POST /api/resources/:id/report`, one report per student, hidden at 3 reports). Progress never raises a skill level.
- Backend tests: 42 passing. The new Flutter code has not been compiled here.
- Still not built: full CV builder, link checker, scheduled reminders, Bangla seed resources, larger quiz bank, TypeScript admin panel.


## Update 4 (corrections)
- Quiz bank is now 8 questions for each of 8 skills (64 questions). Quizzes are still short practice checks, not formal assessments.
- Scheduled reminders already exist: `services/reminders.js` runs every 15 minutes from `server.js` (sessions within 24 h, tasks due within 48 h, each reminded once). Earlier notes saying it was missing were wrong.
- The seed already contains two Bangla resources (10 Minute School, Programming Hero). Admins can add more.
- Backend tests: 43 passing.
- Still not built: full CV builder, automatic link checker, TypeScript admin panel, a measured match-accuracy study.

## Update 5
- Fixed firebase-admin v14 (no more admin.apps / admin.auth()); sign-in verification, push and seed:demo use the modular API.
- seed:demo needs backend/serviceAccount.json (Firebase Console > Project settings > Service accounts > Generate new private key). Keep it out of Git.

## Update 6
- seed now removes stale indexes left in an old database (fixes E11000 name_1 on skills).

## Update 7
- CV builder: structured, versioned CV (summary, skills, languages, education, project, experience). No phone/email/address stored. Screen: /cv (opened from Plan > CV builder). Backend tests: 44 passing.
- Mentor CV review exists in the API (POST /api/cv/:id/review) but has no mobile screen yet.

## Update 8
- Link checker: admin panel > Resources > Check all links (POST /api/admin/resources/check-links). https only, private addresses refused, redirects not followed; broken links are flagged, never hidden automatically.
- Mentor can open a mentee's CV (Requests > accepted > Review CV) and leave a comment.
- Backend tests: 46 passing; admin panel builds.
- Still not built: TypeScript admin panel, a measured match-accuracy study.

## Update 9
- Admin panel is now TypeScript (strict mode; `next build` passes).
- Match accuracy study kit in backend/study: STUDY_PROTOCOL.md, export-sheet.js (anonymous rating sheet), analyze.js (mean rating with 95% interval, rank-1 good rate, precision@3, Spearman, would-request rate). The kit is built and tested; the study itself has not been run, so there is no accuracy result yet.
- Backend tests: 48 passing.

## Update 10
- Campus pins for DU, BUET, NSU, BRAC University and CUET were checked against Wikipedia / latitude.to (BRAC was about 2 km off and is fixed). They are not checked on Google Maps: please confirm each pin once before the demo.

## Update 11
- Admin tools are now inside the mobile app. Sign in with the normal Sign in screen (admin@demo.mentorlink.bd): tabs Queue, Companies, Resources (check links, add, hide), Insights (audit log, fairness, campuses). The web admin panel is optional and uses the same API and the same Firebase accounts.

## Update 12
- More demo people (all invented, password `Demo@12345`), spread over 7 universities: 10 extra students and 8 extra mentors. `npm run seed:demo` now creates 25 demo accounts in total.

| Extra student | University | Goal |
|---|---|---|
| student.du@ Nusrat Jahan | University of Dhaka | Data Analyst |
| student.buet@ Tanvir Ahmed | BUET | Junior Developer |
| student.nsu@ Farhana Akter | North South University | Banking Trainee |
| student.bracu@ Rakib Hasan | BRAC University | QA Engineer |
| student.cuet@ Sadia Islam | CUET | Junior Developer |
| student2.edu@ Mahmudul Karim | East Delta University | Management Trainee |
| student2.su@ Anika Tabassum | Southern University | Higher-Study |
| student2.du@ Imran Hossain | University of Dhaka | Data Analyst |
| student2.nsu@ Jannatul Ferdous | North South University | Data Analyst |
| student2.bracu@ Shakib Rahman | BRAC University | Banking Trainee |

| Extra mentor | University | Role |
|---|---|---|
| mentor.nsu@ Rahim Ahmed | North South University | Data Analyst |
| mentor.du@ Samira Chowdhury | University of Dhaka | Senior Officer, Retail Banking |
| mentor.buet@ Kamal Uddin | BUET | Software Engineer |
| mentor.bracu@ Tasnim Rahman | BRAC University | QA Lead |
| mentor.cuet@ Farid Hossain | CUET | Backend Engineer |
| mentor.edu@ Lutfun Nahar | East Delta University | HR Manager (rising) |
| mentor.su@ Zahid Hasan | Southern University | Data Scientist (rising) |
| mentor2.du@ Mehnaz Sultana | University of Dhaka | Research Associate |

(Every email ends with `@demo.mentorlink.bd`.)
- Learning roadmaps for all 15 skills (3 stages: beginner, intermediate, advanced; 133 topics with estimated hours). Open from Plan > Roadmaps, or tap a gap on the Skill-gap screen. Students tick topics; ticking is private and never raises a skill level. Links come from the approved resources of the same skill, and "Take the quiz" appears where a quiz exists. Hours are rough planning estimates.
- Backend tests: 50 passing.

## Update 13: Pick a target (real-world path and score)
- Plan tab, **Pick a target** (Machine Learning, Data Analysis, Backend Developer). Each target is a prerequisite graph of topics (`backend/src/data/targets.js`). Machine Learning has 24 topics, from Python, linear algebra and statistics through regression, metrics and scikit-learn to a project.
- The student ticks what they already know. The server returns: readiness % (importance-weighted: core 3, important 2, helpful 1), a **proven %** (only topics backed by quiz/project/mentor evidence), score per group (Maths, Programming, ML core...), the remaining hours and weeks (null if weekly study hours are not set), and an **ordered path** where every topic comes after its prerequisites. Topics that can be started now are marked "Start now"; others say what to learn first.
- Ticks are private self-reports (stored under `target:<key>`) and never create skill evidence.
- Endpoints: `GET /api/targets`, `GET /api/targets/:key`, `PUT /api/targets/:key/topics/:topicKey {known}`. Tests: `backend/tests/targets.test.js` (54 tests pass in total).
- Weights and hours are our planning estimates. The Flutter screen (`mobile/lib/features/targets.dart`) has not been compiled.

## Update 14: synced with your local copy
- Used your zip as the new base: your Flutter platform folders (android, ios, web...), the generated l10n files, and your safer `home.dart` (next-session card ignores malformed data).
- Removed: unused old `mobile/lib/features/student.dart`, duplicate `admin-panel` `.js` files (the `.tsx`/`.ts` versions are the real ones), and the default Flutter test that pointed to a missing `MyApp` (replaced by a small Ring test).
- `serviceAccount.json` is never included in zips. Keep your own copy in `backend/`.
- Backend: 54 tests pass. Flutter still not compiled by me; run `flutter analyze` and send me the output.

## Update 16: design/proposal gap build (part 1)
New Flutter screens so the app matches the design PDF: Free resources, Privacy & data, Report user, Roles (admin), department Overview/Approvals/Workshops, mentor Requests/Impact/Setup, Sessions and notes, Progress & badges, Mock interviews, How matching works, Pathways and Q&A, Verify (email + student ID), Goal wizard, and a full Request-a-session form. Profile now links to all of them. After "About you", students go to Verify.
Still open: jobs tabs and opportunity detail, application tracker stages, CV versions, notification grouping, admin queue proof viewer, phone OTP, PDF CV export.
**None of the Flutter code has been compiled by me** (no Flutter SDK here). Backend: 76 tests pass. Please run `flutter analyze` in `mobile` and send me the output.

## Update 17
Notifications grouped (Today / Earlier) with "Mark all read". Admin queue now has tabs (Accounts, Mentors, Departments, Posts), a proof-image viewer (each view is audit-logged) and scam flags. Interview-stage applications link to Mock interviews. Not yet built: scam Restore/Remove list (no backend list endpoint for hidden posts), CV versions UI, phone OTP, PDF export. Flutter is still uncompiled by me: please run `flutter analyze`.

## Update 18
Sign-up now has role cards (Student / Alumni mentor / Department); alumni and department only create an application, an admin approves the role. Admin queue has a "Reported" tab with Restore/Remove for auto-hidden posts (the queue API now returns `hiddenOpportunities`). Chat shows a safety banner and a Retry bar for unsent messages. Flutter is still uncompiled by me: run `flutter analyze` in `mobile`.

## Update 20: Path Twin (new feature)
Matches a student to mentors by **where the student is now**, not by the job they want. A mentor's journey is a list of dated skill milestones (month 0 = graduation). The student's current evidence-based skill levels are compared (weighted Jaccard) with each mentor's skills **at graduation**; the closest "twins" are shown with what they learned next, in order, the months to their first job, and "what most twins learned next". Mentors opt in (`shared`), only skills and months are stored (no employer, no salary), names show as first name + initial. It shows what happened for them, not a promise.
- API: `GET /api/me/path-twins` (student), `GET/PUT /api/me/journey` (mentor). Code: `backend/src/services/pathtwin.js`, `routes/journey.js`, `seed/journeys.js`, `tests/pathtwin.test.js` (6 new tests, 82 total pass).
- App: `features/path_twin.dart` (Profile > "Path Twin" for students, "My journey" for mentors). Flutter still uncompiled by me: run `flutter analyze`.

## Update 21: your platform description (paths, levels, multi-skill, community)
- **15 targets**: 8 new career paths (Web, App, Cybersecurity, UI/UX, Cloud/DevOps, Networking, Digital Marketing, Graphic Design) in `backend/src/data/targets_more.js`, next to ML, Data Analysis, Backend and the pathways. Hours and weights are planning estimates, not measured data. Topic-level free materials still come per skill (Resources); topics without a linked skill do not have their own links yet.
- **Named levels**: Beginner / Elementary / Intermediate / Advanced (labels over evidence levels 0-3). Quiz results now show the level, strong and weak topics (each question has a topic), and advice (resources + roadmap) for weak topics. Quizzes exist for 8 skills only.
- **Multi-skill**: follow up to 5 targets (star on "Pick a target"); `GET /me/dashboard` (one roadmap card per target, skill levels, next step) and `GET /me/target-mentors` (top 3 mentors per target with reasons). Screen: Profile > My paths. Mentor fit is a transparent heuristic: mentor expertise skills vs the target's linked skills, plus job-title words.
- **Community feed**: posts, comments, one-level replies, 3 reactions, follow people, join skill groups, search, report (3 reporters hide), admin moderation endpoints (`/admin/posts`). Screen: Profile > Community feed. Not done: an admin tab for feed moderation in the app, images in posts, notifications for reactions.
- Backend tests: 96 pass. Flutter is still uncompiled by me: run `flutter analyze`.

## Update 22: outcome-driven career intelligence (teammate pitch)
Where each of the five ideas lives:
- **A. Career Gap Intelligence**: `GET /me/readiness` (role vs evidence) and NEW `GET /me/job-gaps` (what approved postings for the goal ask for, split into proven / self-rated only / missing, with a sample-size note). App: Profile > "What employers ask for".
- **B. Career Pathway Graph**: `data/targets*.js` (15 targets, prerequisite graph, verified vs self-ticked topics) + roadmaps. Projects and assessments link through the skill `ev` field.
- **C. Gap-to-Mentor**: `GET /me/gaps/:skillKey/mentors` (with kind of help and the evidence for each claim). App: Skill gap > "Find mentors for ...".
- **D. Mentor-in-the-loop**: `routes/loop.js` (review queue, review pack, endorse capped at the mentor's own level, advise on roadmap order). App: Profile > "Review mentees' work" (mentor), "Mentor feedback on my work" (student).
- **E. Career Outcome Tracker**: `GET /me/outcome-tracker`, consent-based `GET /admin/impact` (groups under 5 hidden, observational caveat). App: Profile > "Career outcome tracker"; admin: "Does mentoring help?".
The loop screens (`features/loop.dart`) existed but were not connected to the router; they are now. 108 backend tests pass. Flutter still uncompiled by me.

## Update 23: content merged in from the web version
- **14 new skill assessments** (84 questions, each with a topic tag) ported from the web version: Power BI, Programming Fundamentals, Mathematics, Data Analysis with Python, Machine Learning, HTML & CSS, JavaScript, Networking, Cybersecurity, Cloud & DevOps, UI/UX, Digital Marketing, Graphic Design, App Development. Data: `backend/src/seed/quizzes_more.js`; loaded by `seedQuizzes()` and `seedLearning()` (which also adds the 14 Skill rows with Bangla names). The existing SQL, Excel, Python, Statistics, Dashboards, Git, Testing and Communication quizzes are unchanged (the old tests depend on them).
- Tests added: `tests/quizzes_more.test.js` (data only) and `tests/quizzes_more_api.test.js` (needs MongoDB). **Neither was run here**: no MongoDB, and `npm install` timed out. The quiz data itself was checked with a Node script (valid answer index, topics present, no duplicate options or questions).
- Not merged yet: the web version's richer roadmap resources, option shuffling per attempt, and extra Bangla phrases.
- Secrets (`.env`, `serviceAccount.json`, `google-services.json`) are NOT in this folder. Copy your own back in.

## Learning phase: before you run it
Do these steps first. They are about keeping your keys safe, and they are a good habit for every project.

1. **Secret files are not in this folder.** I left out `backend/.env`, `backend/serviceAccount.json`, `admin-panel/.env.local` and `mobile/android_config/google-services.json`. Copy your own files back into the same places. Never upload them to GitHub (check that `.gitignore` lists them).
2. **Your earlier zips contained real keys.** If anyone else has seen them (a teammate, a chat, a public repository), create new ones:
   - Firebase: Project settings > Service accounts > Generate new private key, then delete the old key.
   - MongoDB Atlas: Database Access > edit the user > set a new password, then update `MONGODB_URI` in `.env`.
3. **Keep real keys out of zips you share.** Send `.env.example` instead.
4. Then run the app: `npm test`, then `DEMO_MODE=true npm run seed:demo`, then `npm start` (see Setup above).

## Update 24: learning links merged in from the web version
- **46 free learning links** ported from the web version's roadmaps (`backend/src/seed/resources_more.js`), for the 14 new skills plus Python, SQL and Git. `seedLearning()` loads them next to the old links, so they show up in Resources, quiz advice for weak topics and the roadmap screens by skill.
- Left out on purpose: the web version's "Video search" YouTube links (they are searches, not real pages) and 12 links the backend already had. Run Admin > Resources > Check all links before the pilot.
- Test added: `tests/resources_more.test.js` (data only, not run here: Jest could not be installed in my environment).
- Still not merged: the web version's stage topics, exercises and projects for the 10 career paths (they have no Bangla text or hours yet, which the backend roadmap format needs), and the Bangla learning links (the web version has almost none).

## Update 25: sign-in screen now matches the web version
- `mobile/lib/features/auth.dart` (`SignInScreen`): "Welcome back" heading with the one-role note, labelled Email and Password fields, **Log in**, **Forgot password?** (Firebase reset email), "New here? Sign up", and demo cards you tap to sign in (Student Robiul, Alumni mentor Abrar, Employer, Department staff Dayan, Administrator Ayesha). Demo cards show only when built with `--dart-define=DEMO=true`.
- On wide screens (Flutter web in Chrome, tablets, width over 860 px) the green diamond panel with "Two paths meet in the middle." shows on the left, as on the web. On a phone only the form shows. New helper `DiamondPanel` in `core/ui.dart`.
- The Employer card is new (the web version has no employer role). Bangla text is included.
- **Not compiled or run here** (no Flutter SDK): run `flutter analyze` in `mobile` and send me any error.

## Update 26: sign-up screens match the web version too
- New shared frame `AuthShell` in `mobile/lib/features/auth.dart` used by Sign in, Sign up and About you, so all three look like the web version (green art panel on wide screens, same heading, labelled fields, rounded choice cards).
- **Sign up step 1:** "Create your account", university email with hint, password (8+ characters), the Code of Conduct and data-use checkbox (Continue stays off until ticked), "Already registered? Log in". A confirmation email is sent after the account is created.
- **Sign up step 2 (About you):** "Who are you?" cards (Student, Alumni mentor, Department), full name, university, department, and the mentor fields when Alumni mentor is chosen. Same backend calls as before: the account is always a student, and the mentor or department role is a request for an admin to approve.
- The web version puts everything on one page. The app keeps two steps because the router moves a signed-in user to step 2 as soon as the Firebase account exists.
- Not compiled or run here (no Flutter SDK): run `flutter analyze` in `mobile`.

## Update 27: demo accounts always visible on the sign-in screen
- The demo cards (Student Robiul, Alumni mentor Abrar, Employer, Department staff Dayan, Administrator Ayesha) now show by default, like the web version, so you can test with one tap. You no longer need `--dart-define=DEMO=true`.
- They only work after `DEMO_MODE=true npm run seed:demo` has created the demo users in your Firebase project and database.
- **Before the pilot or any public build**, hide them: `flutter run --dart-define=DEMO=false` (or the same flag in `flutter build`). Demo accounts have known passwords.

## Update 28: community demo data
- `npm run seed:demo` now also fills the Community feed (`backend/src/seed/demo_community.js`, safe to run again; it adds only what is missing).
- **12 posts** in different groups (General, Data Analysis, Backend Developer, Higher study, Machine Learning, BCS, Freelancing, Entrepreneurship), written by 20 of the demo students and mentors, with **comments and replies**, **reactions** (like / helpful / idea), one post with a real https link, and **follows** (people and groups), so "Following" and the group list are not empty.
- **Two moderation examples** for the admin: a post reported once (shows in the admin Reported list) and a post with 3 reporters that is already hidden (test Restore and Remove). Both are marked DEMO in their text.
- Everything is invented demo content. Sign in as Robiul to see a populated feed, as Abrar to see mentor posts, and as Ayesha to test moderation.
- Test added: `tests/demo_community.test.js` (data only, not run here: Jest could not be installed). The data was checked with a Node script (valid groups, text lengths, one reaction per person, all emails exist in the seed).

## Update 29: Career Decision Lab (compare careers, what-if, next best step)
One screen that joins pieces you already have: readiness, approved job postings, the topic prerequisite graph and mentor profiles. Open it from Profile > "Career Decision Lab" (`/decision-lab`).
- **Compare**: your goal plus the two roles you are closest to (or pick up to 3). Glowing exploration graph: You -> roles (readiness %) -> top gap skills (level ring). Each role shows readiness, **proven readiness** (quiz / reviewed project / endorsement only), hours and weeks left.
- **Why this order**: `Priority P = D x W x G`. D = share of relevant approved postings that ask for the skill (needs at least 3 postings, otherwise D = 1 and the screen says it is using the role requirements). W = skill importance in the role. G = (required level - current level) / required level. All three numbers are shown per skill.
- **Prerequisites**: skill prerequisites are derived from the existing topic graph (`data/targets*.js`), for example Dashboards need SQL 1 and Excel 2. A blocked skill is never the "next step"; the screen says what to learn first.
- **What-if**: tick skills, run the simulation. It shows the readiness change and the study hours it would cost, labelled SIMULATION. It writes nothing and never raises the proven score.
- **Close the loop**: the next step opens the quiz (or roadmap/project), the roadmap, and gap-specific mentors (`/me/gaps/:skillKey/mentors`). After a quiz, coming back re-ranks the list.
- API: `GET /me/decision-lab?roles=a,b,c`, `POST /me/decision-lab/simulate {roleKey, learn:[{skillKey, level}]}`. Code: `services/decisionlab.js` (pure functions), `routes/lab.js`, `features/decision_lab.dart`.
- Limits (shown in the app): employer demand uses only the approved postings stored in MentorLink, not the whole market; readiness is preparedness under our model, not a chance of getting a job; weights and hours are planning estimates.
- Tests: `tests/decisionlab.test.js` (13, logic) and `tests/lab_api.test.js` (5, API with an in-memory fake of the models, no MongoDB needed). Both pass. The Flutter screen has **not been compiled**: run `flutter analyze` in `mobile`.

## Update 30: pilot study kit v2 (blinded A/B vs the keyword baseline)
- `backend/study/export-sheet-ab.js` builds a blinded rating sheet for the students you name (consent first). Each student rates one shuffled pool made of MentorLink's top 5 and the keyword baseline's top 5, shown as neutral profile cards.
- `backend/study/analyze-ab.js` reports rank-1 good rate, precision@3, mean rating, would-request rate and nDCG@5 for both methods, plus paired differences with 95% intervals and win / tie / loss counts.
- Protocol: `backend/study/STUDY_PROTOCOL.md` ("Version 2"). Step-by-step guide with consent text and report template: the "Pilot Study Guide" document.
- Tests: `tests/study_ab.test.js` (6 tests, pass; no database needed). The export script needs a real MongoDB and was only syntax-checked here, not run. The study itself has NOT been run, so there is still no accuracy result.

## Update 31: demo data for testing the study
- `backend/src/seed/demo_study.js`: 13 more demo mentors (23 verified with `seed:demo`), including a keyword decoy. `npm run study:dryrun` runs the whole study pipeline on invented students with no database. Its numbers are synthetic and must not be reported.
- Demo-data fix: several demo mentors had a weekly capacity below their accepted count, so they could not take requests (and showed 0 open spots in the Decision Lab). Capacity is now set above the accepted count.
- Tests: `tests/study_demo.test.js` (data checks, pooling, dry run). With the earlier new tests, 41 pass without a database.

## Update 32: review of the Combined zip
- Fixed: Mentor feedback screen pushed `/my-projects`, which does not exist (opens a blank error page). It now opens `/portfolio`.
- Fixed: `tests/quizzes_more.test.js` imported `QUIZZES` that `seed/quizzes.js` did not export; it is exported now.
- Flutter syntax check (tree-sitter) on all 54 Dart files: 0 problems. Still not compiled: run `flutter analyze`.
- The zip this came from held real keys (`backend/.env`, `serviceAccount.json`). They are removed from this copy; reset the Atlas password and rotate the Firebase key.

## Update 33: four launch features (the "wow" set)
All four reuse existing evidence, mentor review and company rules. The server enforces every rule; the app only shows it.

1. **Career Passport** (`/passport`, student). A verified proof profile the student owns: proven skills (quiz, reviewed project, mentor endorsement; **self-ratings never count**), projects, verified GitHub, milestones, finished sprints and a transparent *proof strength* (0-100, a plain count, not a prediction). The student switches sharing on, picks which sections others see, and gets a link and **QR code**. The public page is plain HTML at `GET /p/:slug` (no scripts, everything escaped, `noindex`) and JSON at `GET /api/public/passport/:slug`. The slug is random (not guessable); "New link" kills the old one. No email, phone or address is ever included. Only verified students can share.
2. **Mentor Sprint** (`/sprints`, student; `/mentor/sprint-reviews`, mentor). 7 days on one skill: baseline quiz, two learning days (shaped by weak quiz topics), two build days, publish proof, retest and send to a mentor. At least 5 days and an https proof link are needed to submit. The mentor can **endorse only up to their own level** in that skill (or ask for more work). An endorsement becomes `endorsement` evidence, so it raises the passport and the readiness score; finishing the days alone changes nothing.
3. **Daily Brief** (card on Home, `GET /me/brief`). One move for today chosen by fixed rules: session within 24 h, open sprint day, due task, unproven top gap (quiz), job closing soon, or "choose a goal". Day streak counts finished tasks and sprint days (Asia/Dhaka days). "Share my week" (`GET /me/week-card`) makes a short text card with first name only.
4. **Talent Pool** (employer tab "Talent"; student "Company invitations" `/invites`). A student opts in ("Let verified companies find me"). A **verified** company searches by proven skills (`skills=sql:2,python:1`) and sees first name + initial, university, department, proven skills and proof strength. **Never** contact details; "not proven" is shown instead of "does not know it". The company can invite (max 20 per day, one per student and job); the student accepts or declines. The directory stays closed to employers (unchanged).
- New code: `backend/src/services/startup.js` (pure rules), `routes/startup.js`, `models/startup.js`, `seed/demo_startup.js`, `mobile/lib/features/launch.dart`. New package: `qr_flutter` (run `flutter pub get`).
- Demo (after `DEMO_MODE=true npm run seed:demo`): Robiul has a shared passport at `/p/demo-robiul-passport`, one finished (endorsed) SQL sprint, a running Python sprint on day 3, and a pending invitation from Demo Tech Ltd. A second student (Nusrat) is in the talent pool.
- Passport links point to `API_URL` (`/p/<slug>`). For a real pilot, host the backend on a public https address so the QR code opens on any phone.
- Tests: `tests/startup.test.js` (14, logic) and `tests/startup_api.test.js` (6, API with an in-memory fake of the models). Both pass. Not run: the Mongoose queries against a real MongoDB, and the Flutter screens (**not compiled**: run `flutter pub get` then `flutter analyze`).
- **Business idea (not built):** free for students and mentors; companies pay only a success fee after a hire made through the Talent Pool. No payment code exists. No applicant is ever charged.

## Update 34 - CV maker v2
- New CV format (same layout as the demo PDF): header, summary, skills, projects, experience, education, achievements, languages.
- Edit screen: drag sections and items (projects, bullets, links) with the handle, hide a section with the eye, pick Classic/Compact and an accent colour, "Check my CV" gives rule-based tips (no API).
- Preview tab shows the real PDF (same bytes as the download). "Download PDF" uses the `pdf` + `printing` packages. Fonts load from Google Fonts on first use (internet needed once); Noto Sans Bengali is a fallback for Bangla text.
- Web: `web/index.html` now loads pdf.js for the preview. Run `flutter pub get`.
- Privacy: phone and email are stored in the CV but employers and mentors only see them if the student ticks "Contact" when applying.
- Older v1 CVs are converted automatically when opened.

## Build fixes (v35)
- launch.dart: week card uses dio directly (getJson only accepts a provider Ref).
- pubspec: dependency_overrides archive ^4.5.0 (image 4.11+ needs ZLibDecoder.decodeLazy, added in archive 4.4.0). Delete pubspec.lock before pub get.

## Hosted backend
Default API is https://dryrunapp.onrender.com (mobile/lib/core/api.dart). Override with --dart-define=API_URL=... for local runs. Render free plan sleeps when idle, so the first request can take about a minute (timeouts raised to 60 s). Seed the demo data on Render once if needed.


## Update 36: job search, saved jobs, chat blocking, complete data export and delete
Three items from `docs/IMPROVEMENT_ROADMAP.md` (P1 "complete data export and deletion", P2 "enforce blocks in chat", P2 "job search, filters, pagination, saved jobs").

1. **Job search and saved jobs.** `GET /api/opportunities` now takes `q`, `type`, `mode`, `minFit`, `closingSoon`, `hideApplied`, `savedOnly`, `sort=newest|deadline|fit`, `page`, `limit` (max 50) and returns `total`, `page`, `hasMore`. With no query it is still newest first (20 per page). Jobs whose deadline has passed are no longer listed (applying to them already failed). Each item has `daysLeft`; for students also `saved` and `applied`. Bad values return 400 `BAD_QUERY`. New: `POST` and `DELETE /api/opportunities/:id/save` (private to the student, at most 100) and a `saved` flag on the job detail. Rules are pure functions in `backend/src/services/jobsearch.js`. Flutter: the Jobs tab has a search box, type chips, Saved / Remote / Closing in 7 days / Hide applied chips, a sort menu, "Show more", a heart on every card, and "N days left"; the job detail has Save.
2. **Blocking now closes the chat.** Before, `POST /users/:id/block` hid people from lists but both people could still read and send messages. `GET` and `POST /requests/:id/messages` now return 403 when either side blocked the other, and a Socket.IO `join` is refused. No notification is sent to the blocked person. Rule: `backend/src/services/blocks.js`.
3. **One list for "Download my data" and "Delete my account"** (`backend/src/services/userdata.js`). Export and delete now cover passport, sprints, projects, GitHub link, plan reviews, mentor reviews, saved jobs, company invitations, journey, community posts, comments, follows, Q&A, hosted workshops, plans, matches and verification-document metadata (never the file bytes). Reactions and reports by the person are removed from other people's posts; a mentor's name is cleared from students' sprints and endorsements; comments on a deleted post go with it; chat messages of the other person go with the chat. Kept on purpose, and listed in the download as `keptAfterDeletion` with the reason: the blank account row, safety reports, the admin audit log, and job posts other students applied to.
   - **Bug fixed on the way:** the old delete and export looked up resource progress by `userId`, but the model uses `studentId`, so account deletion never removed it. Fixed.
   - **A test keeps this honest:** `tests/userdata.test.js` reads every model file and fails if a model that points at a user is in neither the delete list nor the "kept on purpose" list. A future feature cannot be added and forgotten.
   - Behaviour change to know about: workshops a person hosted are now deleted with their account (before they stayed, still showing the host's id).

**Tests:** `tests/jobsearch.test.js` (17), `tests/blocks.test.js` (6), `tests/userdata.test.js` (13). All 36 pass. They are plain Jest files with no database. **Honest status:** these were run with a small Jest-compatible runner because the package registry was blocked in the environment where this was written, so run `npm test` once yourself. The three route files (`opportunities.js`, `mentoring.js`, `extras.js`) pass a syntax check and an undefined-name lint but their HTTP routes were **not executed** (no Express/MongoDB there). The Flutter changes (`jobs.dart`, `jobs_more.dart`) are **not compiled**: run `flutter analyze` and send me the error text if there is any.

## Update 37: admin Jobs tab (all jobs and who applied)
- New admin tab **Jobs** (app: admin bottom bar). Lists every job post in any status (pending, approved, hidden, removed) with search and a status filter, totals (jobs, applications, pending), and per job: how many applied (and per stage), how many saved it, report count, scam flags, who posted it. Admin can Approve, Restore or Remove from the card. Tap a job (or "Who applied") for the applicant list.
- Privacy: the applicant list shows name, department, stage and date only. Never the CV, the note or contact details; those stay with what the student agreed to share with the poster.
- API: `GET /api/admin/jobs?status=&q=&page=&limit=` and `GET /api/admin/jobs/:id/applications` (admin only). Rules: `backend/src/services/adminjobs.js`; tests: `tests/adminjobs.test.js` (11, pass with the same Jest-compatible runner; routes not run against a database). Flutter: `mobile/lib/features/admin_jobs.dart`, tab added in `shell.dart` (not compiled; run `flutter analyze`).


## Update: free hosting, no paid server needed
- **Reminders on Render free plan:** the free service sleeps, so `setInterval` alone does not run. `.github/workflows/keepalive-and-tick.yml` (free GitHub scheduler, every 10 min) wakes the API and calls `POST /internal/tick`, which runs reminders, job alerts, auto-close and employer nudges. Setup: set `CRON_SECRET` on Render and as a GitHub Actions secret (same value). Without `CRON_SECRET` the endpoint is off. Free alternative: cron-job.org with the header `x-cron-secret`. Nothing is sent twice (atomic claims).
- **Admin sign-in revocation:** admin requests also check that the Firebase sign-in was not revoked. Other roles do not pay for the extra call.
- **Fixes:** finished applications (Hired / Rejected / Withdrawn) cannot be withdrawn (409); admin accounts cannot be verified/rejected through `/admin/users/:id/verify` (403); applicant lists skip deleted students instead of returning 500.
- **Rate limits (per IP per minute):** register 10, verification upload 6, reports 10, apply 20, chat send 40.
- **Admin panel:** removed the stale `.js` twins (`page.js`, `layout.js`, `lib/api.js`, `lib/firebase.js`); the `.tsx`/`.ts` files are canonical.
- **CI:** `.github/workflows/ci.yml` runs backend tests (real MongoDB service), `next build`, `flutter analyze` and `flutter test`. Free for public repos.
- Tests added: `free_scheduler.test.js` (passes, no database), `audit_fixes.test.js` (needs MongoDB; not run here, run `npm test` or push to see CI).


## Update: four new career tools (free, no AI, no paid service)
| Tool | Who | Where | API |
|---|---|---|---|
| **Career Action Center** | student | Home card "Do this next" + `/actions` | `GET /api/me/actions` |
| **Application tracker** | student | Career tab, Profile, `/tracker` | `GET /api/me/tracker` |
| **Interview practice feedback** | student + mentor | `/interview-practice` (ask), `/my-practice-feedback` (read), mentor menu "Interview practice requests" (`/mentor/practice`) | `POST /me/interview-practice/request-feedback`, `GET /me/practice-feedback`, `GET /mentor/practice-requests`, `POST /mentor/practice-requests/:id/feedback` |
| **Hiring analytics** | employer | Recruiter dashboard card, `/employer/analytics` | `GET /api/employer/analytics` |

- **Action Center rules (fixed, explainable):** unanswered offer > interview within 3 days > employer papers > session within 24 h > due task > unread mentor feedback > no goal > job closing in 3 days that fits 50%+ > biggest gap (quiz if no proof, else roadmap) > applications silent for 7+ days > no CV > no mentor. Shows the top 5, each with a reason in English and Bangla.
- **Tracker:** columns Saved / Applied / Interview / Offer / Finished. An application with no movement for 7 days in Applied or Under Review is flagged "No reply". Saved jobs are sorted by deadline; closed ones are hidden.
- **Practice feedback:** the mentor sees only the number of answers and the self-rated average (never the student's private notes), gives a score 1-5 plus one thing to improve. One answer per request; asking again before an answer refreshes the same request.
- **Hiring analytics:** funnel counts everyone who *reached* a stage (a later rejection does not remove them), median days to first reply and to hire, per-job views / saves / applications / hired. Counts only, no student names; fewer than 3 applicants is marked "a hint".
- **Privacy fix found on the way:** private interview-practice answers were missing from "download my data" and "delete my account". Added (`PracticeAnswer`, `PracticeReview`).
- **Tests:** `actions.test.js`, `tracker.test.js`, `employerstats.test.js` (pass, no database); `new_features_api.test.js` (needs MongoDB, run in CI or `npm test`).
- **Honest status:** the new Flutter code (`mobile/lib/features/action_center.dart` and the small edits in `home.dart`, `employer.dart`, `shell.dart`, `career.dart`, `ready.dart`, `router.dart`) has not been compiled (no Flutter SDK here); brackets and strings were machine-checked only. Run `flutter analyze` and send me any message.
