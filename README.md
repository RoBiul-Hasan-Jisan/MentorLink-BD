# MentorLink BD

Career mentorship for Bangladeshi university students (English / বাংলা).
Loop: career goal → skill gap → free resources / quiz → explainable mentor match → sessions → four-week plan → CV → vetted job → outcome feedback.

```
backend/       Node.js + Express + Mongoose + Socket.IO     40 Jest tests
mobile/        Flutter (Riverpod, GoRouter, Dio, flutter_map)
admin-panel/   Next.js web admin panel (Firebase Web SDK)
```

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

## 5-minute demo
1. **Robiul (student):** Home shows readiness for Data Analyst, ranked gaps, weeks to ready. Open the skill-gap report: radar, free resources, take the SQL quiz (server-graded, adds quiz evidence).
2. **Mentors tab:** Abrar with the six-part score and "Why this mentor". Send a request.
3. **Abrar (mentor):** accept, chat. (API) schedule a session and complete it with next steps: they become tasks in Robiul's four-week plan.
4. **Robiul:** Plan tab: tick a task. Jobs tab: apply with the consent screen; the tracker shows the 5 stages.
5. **Employer:** post a job (first post goes to admin review), open applicants (only consented fields), move a stage (invalid jumps are rejected).
6. **Ayesha (admin panel):** approve the job, verify a company, check the audit log and the fairness tab. Report a job 3 times from different accounts: it auto-hides.
7. **University map:** East Delta and Southern show at different campus pins. Members appear as "Robiul H.", never an address. The employer gets 403 on the directory.

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
- Skill levels come from quiz, project or mentor evidence; the quiz bank is small (SQL, Excel, Python, 5 questions each).
- Seeded learning resources are English; add Bangla ones from the admin panel.
- Chat is plain text over Socket.IO; no file sharing. Reminders are in-app notifications plus push; no scheduled reminder job yet.
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
