# Project Audit: MentorLink BD

**Method and limits.** Source-based audit of the uploaded repository (`backend/`, `mobile/`, `admin-panel/`). In this environment the npm registry was blocked (HTTP 403 from the egress proxy) and there is no Flutter SDK or MongoDB, so **no test suite, `flutter analyze`, `next build` or API call could be run**. Only `node --check` syntax checks and pure-function tests of two new helpers were executed. Everything below is "confirmed by reading source" unless it says otherwise.

## 1. Executive summary
Strengths: server-side roles (role always read from MongoDB), zod `.strict()` schemas on most writes, a privacy guard that rejects GPS fields, consent-based sharing with employers, opt-in public passport with rotating slug, atomic workshop seats, unique indexes against duplicate applications/reports, 30 backend test files.
Biggest risks: (1) real-looking credentials shipped in the zip; (2) the mentoring lifecycle could not move past "accepted" inside the Flutter app; (3) several settings and buttons implied behaviour that did not exist (low-data mode, reminders/quiet hours, Join); (4) user reports had no reviewer; (5) nothing has been compiled or run by anyone in this review.

## 2. Architecture
- `backend/`: Express 5, Mongoose 9, Socket.IO, firebase-admin, zod, helmet, express-rate-limit. 13 route modules + core + startup, 197 endpoints (`docs/API_AUDIT.md`). Auth: Firebase ID token verified, role from MongoDB (`middleware/auth.js`).
- `mobile/`: Flutter, Riverpod, GoRouter, Dio, flutter_map, Socket.IO client, 62 routes, Bangla/English via an inline `tr(context,en,bn)` helper (plus ARB files).
- `admin-panel/`: Next.js 14 App Router, one page with tabs, Firebase Web SDK.
- Scheduler: `setInterval` reminder job in `server.js`.

## 3. Security findings
| # | Finding | Severity | Status |
|---|---|---|---|
| S1 | `backend/.env` and `backend/serviceAccount.json` are inside the zip. Not tracked by git and not in git history (checked), but anyone holding the zip holds them. The service-account file is a real-format Firebase key for project `mentorlink-67926`. `.env` also contains a **commented-out MongoDB Atlas connection string with a password**. | P0 | **Needs your action**: rotate the Atlas database user password and generate a new Firebase service-account key (delete the old one in Google Cloud IAM). I cannot do this. Values are not reproduced in any report. |
| S2 | No root `.gitignore`; backend ignore list missed `.env.*` variants | P1 | Fixed (root `.gitignore`, backend `.gitignore`) |
| S3 | `meetingLink` accepted any string up to 300 chars (javascript:, http:) | P1 | Fixed on server and client |
| S4 | Firebase token verified without revocation check (`verifyIdToken` without `checkRevoked`); revoked sessions work until token expiry (~1 h) | P2 | Open (needs a Firebase call per request; recommend checking revocation only for admin routes) |
| S5 | CORS allows any origin when `CORS_ORIGINS` is empty; Socket.IO ignored the allow-list | P2 | Socket.IO fixed; production warning added; set `CORS_ORIGINS` |
| S6 | Account deletion does not remove community posts/comments, follows, passport, sprints, projects, GitHub link, invites, plan reviews; export omits the same data | P1 | Open (see roadmap) |
| S7 | Blocks are not enforced in chat or on sends after acceptance | P2 | Open |
| S8 | `GET /admin/*` list endpoints without paging (queue, organizations) | P3 | Audit log paging added; others open |
| S9 | Reports for users had no review queue | P1 | Fixed (admin API + admin tab) |
| S10 | Applicant listings dereference populated documents without null checks (deleted student or CV causes 500) | P2 | Open |
| S11 | `/admin/users/:id/verify` can mark any user, including admins, verified/rejected without checking documents were viewed | P3 | Open |
Positive checks: no NoSQL operator injection path found in query handling (Express 5 simple query parser, `String()` casts, zod strict bodies); regexes built from input are escaped; public passport HTML is escaped; verification docs checked by magic bytes; admin doc views are audited.

## 4. Functional findings
Confirmed bugs (source evidence in `docs/ROUTE_AUDIT.md`):
- F1 Home "Join" showed the meeting URL in a toast. **Fixed.**
- F2 Notification tap only marked read. **Fixed** (typed `target`).
- F3 Mentors have no UI to schedule or complete a session (`POST /sessions`, `/sessions/:id/complete` never called by the app); the sessions screen was student-only. **Fixed** (new dialogs, mentor menu entry).
- F4 Report-user screen had no entry point and used router `extra`. **Fixed** (query-param deep link + two entry points).
- F5 Low-data mode only stored a flag; its own subtitle promised the map would be replaced. **Fixed** for the university map; other screens do not use it yet (images).
- F6 Map had no OpenStreetMap attribution. **Fixed.**
- F7 Reminders ignored `remindersOn` and quiet hours; reminder job could double-send across instances. **Fixed.**
- F8 Privacy toggles in Profile had no error handling (silent failure). **Fixed** (`savePrivacySetting`).
- F9 Request decision was read-then-write (double accept could double count capacity). **Fixed.**
- F10 Applicants title lost on refresh. **Fixed.** (Data itself always loaded from the API.)
- F11 `app.js` swallowed `MODULE_NOT_FOUND` for any route module, hiding broken features. **Fixed.**
- F12 Admin panel had stale duplicate `page.js`/`layout.js`/`api.js`/`firebase.js` (older than the `.tsx`: no "Check all links"). **Removed.**
Probable / unverified: quiz → evidence → "verified" semantics; progress computed in several places; mentor-posted jobs have an applicants endpoint but no screen.

## 5. UX/UI, accessibility, localization (limited review)
Not visually tested. Observations from source: hard-coded `tr(en,bn)` strings instead of ARB keys; many fixed 48-56 px controls (good for touch); no semantic labels found on charts/graph; layout is a phone column (no tablet/desktop layouts reviewed); dialogs use fixed widths.

## 6. Data integrity / API
Missing: pagination on opportunities (limit 100), no search/filter on jobs; withdraw allowed at any stage; re-apply after withdraw blocked by unique index; `Notification` had no target; `University` has no `coordsVerified` field although the seed file carries `verified`.

## 7. Admin panel
Server-side authorization is real (every `/admin/*` route has `requireRole('admin')`). Single 170-line page, no tests, no pagination except users. Build not run.

## 8. Testing gaps
No Flutter tests beyond 3 files; no admin tests; backend has broad coverage but needs MongoDB (FerretDB per README). New tests: `backend/tests/pure_audit.test.js` (executed via a minimal shim, passed), `backend/tests/audit_api.test.js` (syntax-checked only), `mobile/test/notify_route_test.dart` (not run).

## 9. Career-module overlap (proposal, no merge done)
Keep all URLs. Suggested labels: Goal (choose) → Roles (explore) → Skill Gap (compare) → Roadmaps (learn) → Plan (do) → Portfolio (prove) → Passport/CV (share). `/targets`, `/my-paths`, `/pathways` overlap and should get distinct one-line purposes in navigation. Progress percentages appear in `/me/plan`, `/me/progress`, `/me/loop`, passport: unify.

## 10. Product recommendation: Career Action Center
Not built (cannot be verified here). Backend already has `/me/loop` and `/me/brief`; use them on Home as "next action + why + link", reusing goal, gaps, plan, sprints, reviews. See roadmap.

## 11. Dependencies and limits
Flutter pubspec pins `archive ^4.5.0` override; map uses public OSM tiles (not suitable for production traffic: use a provider with a licence or self-host). Reminder text prints UTC ISO time, not Dhaka local time.
