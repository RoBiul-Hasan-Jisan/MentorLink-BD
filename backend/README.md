# MentorLink BD: Backend API

A mentorship and career-readiness platform for Bangladeshi university students. This repository is the **backend only**. It was built **API-first**: every route is tested with `curl`, a smoke-test script and automated tests, so the mobile app (Flutter) can be built later on a contract that is already proven.

![Node](https://img.shields.io/badge/Node.js-Express-339933) ![DB](https://img.shields.io/badge/MongoDB-Mongoose-47A248) ![Auth](https://img.shields.io/badge/Auth-Firebase-FFCA28) ![Realtime](https://img.shields.io/badge/Realtime-Socket.IO-010101)

---

## Table of contents
1. [Features](#1-features)
2. [Tech stack](#2-tech-stack)
3. [Development approach: API-first](#3-development-approach-api-first)
4. [Getting started](#4-getting-started)
5. [Testing without a frontend](#5-testing-without-a-frontend)
6. [Demo accounts](#6-demo-accounts)
7. [API reference](#7-api-reference)
8. [Real-time (Socket.IO)](#8-real-time-socketio)
9. [Business rules](#9-business-rules)
10. [How the scores work](#10-how-the-scores-work)
11. [Security and privacy](#11-security-and-privacy)
12. [Project status and roadmap](#12-project-status-and-roadmap)

---

## 1. Features
- **Identity and roles:** Firebase sign-in; roles `student`, `mentor`, `department`, `admin`. Everyone starts as a student; only an admin approval changes a role.
- **Skills and readiness:** career goal, evidence-based skill levels, readiness score, skill gaps, time-to-ready estimate.
- **Mentor matching:** explainable score with factor breakdown and a fairness re-ranking.
- **Mentoring workflow:** requests, sessions, session notes, action plan, comments.
- **Chat and notifications:** live chat (Socket.IO), in-app notifications and FCM push.
- **Career tools:** CV builder with mentor review, opportunity board, applications with a staged pipeline.
- **Safety:** blocks, user and post reports, auto-hide, fee/OTP phrase flagging, admin audit log.
- **Department view:** anonymized cohort statistics.

## 2. Tech stack
| Layer | Technology |
|---|---|
| Runtime / framework | Node.js, Express |
| Database | MongoDB with Mongoose |
| Authentication | Firebase Authentication (ID token verified with Firebase Admin). **No custom JWT code.** |
| Real-time | Socket.IO |
| Push notifications | Firebase Cloud Messaging (best effort) |
| Scoring | Plain formulas (TF-IDF cosine and weighted sums). **No external AI API.** |

## 3. Development approach: API-first
The backend was built and verified **before any frontend existed**:

1. **Design the contract:** routes, roles, request and response shapes (section 7).
2. **Build in phases:** each phase adds a group of routes and its business rules (section 12).
3. **Seed realistic data:** demo users for every role, so each route can be exercised for real.
4. **Test every route without a UI:**
   - `npm test` runs the automated tests.
   - `scripts/smoke-test.sh` calls every route group with each demo role and compares the HTTP status with the expected one.
   - Manual `curl` calls for the rules that need a closer look (privacy guard, role guard, capacity).
5. **Check three things on every route:** it works for the right role (`200/201`), it rejects the wrong role (`403`), and it rejects a missing token (`401`).
6. **Frontend later:** the Flutter app only consumes a tested API.

## 4. Getting started

### Prerequisites
- Node.js 18+
- A MongoDB database (Atlas or local)
- A Firebase project with a service-account JSON and a Web API key

### Install and configure
```bash
npm install
cp .env.example .env
```
Fill in `.env`:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (use the **rotated** password) |
| Firebase credentials path | Path to the service-account JSON (see `.env.example`) |
| `FIREBASE_WEB_API_KEY` | Needed by `npm run token` to sign in demo users |
| `ALLOW_PLACEHOLDER_COORDS` | `true` until real campus coordinates are filled in |
| `DEMO_MODE` | `true` only when running `seed:demo` |
| `DEPT_MIN_COHORT` | Minimum group size before department numbers are shown |
| `REPORT_HIDE_THRESHOLD` | Distinct reporters needed to auto-hide a post (default 3) |

Place the Firebase service-account file at `secrets/firebase-admin.json`. It is gitignored. **Never commit it.**

### Seed and run
```bash
npm run seed:universities   # needs ALLOW_PLACEHOLDER_COORDS=true until real coordinates are set
npm run seed:skills         # skills and 6 role templates
npm run seed:demo           # needs DEMO_MODE=true; demo users, profiles, evidence, 3 extra mentors
npm run dev                 # http://localhost:4000/health
```

### Before the demo (team TODO)
Open each campus on Google Maps and put the real `[longitude, latitude]` in `seed/universities.json` (or call `PATCH /api/admin/universities/:id` as admin). Then set `ALLOW_PLACEHOLDER_COORDS=false`.

## 5. Testing without a frontend

### 5.1 Automated tests
```bash
npm test
```

### 5.2 Route smoke test (all route groups, all roles)
```bash
bash scripts/smoke-test.sh
# optional: BASE_URL=https://your-server bash scripts/smoke-test.sh
```
For each demo role it signs in, calls the routes that role should reach, and also checks that forbidden calls are rejected. Output looks like:

```
PASS  GET /health                          (expected 200, got 200)
PASS  student -> GET /api/me               (expected 200, got 200)
PASS  student -> POST /api/admin/...       (expected 403, got 403)
FAIL  mentor -> GET /api/matches           (expected 403, got 200)
Summary: 38 passed, 1 failed
```
The script exits with a non-zero code if anything fails, so it can also run in CI.

### 5.3 Manual checks with curl
```bash
# Get the credential the Firebase SDK would give the app
TOKEN=$(npm run -s token -- student.edu@demo.mentorlink.bd 'Demo@12345')

curl -s localhost:4000/api/me            -H "Authorization: Bearer $TOKEN"
curl -s localhost:4000/api/directory/map -H "Authorization: Bearer $TOKEN"
curl -s localhost:4000/api/universities
```

### 5.4 Expected results for key guards
| Check | Request | Expected |
|---|---|---|
| Public route | `GET /api/universities` (no token) | `200` |
| Missing token | `GET /api/me` (no token) | `401` |
| Role guard | student calls `POST /api/admin/universities` | `403` |
| Privacy guard | `PATCH /api/me/privacy` with `{"showInDirectory":true,"latitude":22.3}` | `400` |
| Student-only route | mentor calls `GET /api/matches` | `403` |
| Ownership | student reads another student's request `GET /api/requests/:id` | `404` |

### 5.5 Route checklist
Mark each route group when it passes for the right role, is rejected for the wrong role, and is rejected without a token.

- [ ] Health and public (`/health`, `/api/universities`)
- [ ] Auth and profile (`/api/auth`, `/api/me/*`)
- [ ] Directory (`/api/directory/*`)
- [ ] Skills, goal, evidence, readiness, matches
- [ ] Requests and sessions (including notes)
- [ ] Plan and tasks
- [ ] Chats and notifications
- [ ] CV and CV review
- [ ] Opportunities and applications
- [ ] Blocks and reports
- [ ] Role requests
- [ ] Department
- [ ] Admin

## 6. Demo accounts
All emails end with `@demo.mentorlink.bd`.

| Role | Email prefix | Password |
|---|---|---|
| Student | `student.edu` | `Demo@12345` |
| Mentor | `mentor1`, `mentor2` | `Demo@12345` |
| Department | `dept` | `Demo@12345` |
| Admin | `admin` | `Admin@12345` |

> Demo accounts exist only when `DEMO_MODE=true`. Remove them before any real deployment.

## 7. API reference
Authenticated routes need `Authorization: Bearer <Firebase ID token>`.

### Phase 1: Core
| Method | Path | Roles |
|---|---|---|
| GET | `/health` | public |
| GET | `/api/universities` | public |
| POST | `/api/auth/register-profile` | any Firebase user without a profile (always becomes student) |
| GET | `/api/me` | any signed-in |
| PATCH | `/api/me/privacy`, `/api/me/settings` | any signed-in |
| GET | `/api/directory/map` | student, mentor, department, admin |
| GET | `/api/directory/universities/:id/members` | student, mentor, admin |
| POST / PATCH | `/api/admin/universities` | admin |
| PATCH | `/api/admin/users/:id/verification` | admin |

### Phase 2a: Skills, readiness, matching
| Method | Path | Roles |
|---|---|---|
| GET | `/api/skills`, `/api/roles` | any signed-in |
| GET / PUT | `/api/me/goal` | student |
| GET / POST | `/api/me/evidence` | student (only `self` and `project`; both stay unverified) |
| GET | `/api/me/readiness` | student |
| GET | `/api/matches` | student (top 5, factor scores, reasons, keyword baseline) |
| GET / PUT | `/api/me/mentor-profile` | mentor (rating and session stats are server-only) |

### Phase 3: Requests, sessions, plan, chat, notifications
| Method | Path | Roles / notes |
|---|---|---|
| POST | `/api/requests` | verified student: goal, 2 to 3 questions, preferred slots, format |
| GET | `/api/requests?status=` | own only (student: sent, mentor: received) |
| GET | `/api/requests/:id` | the two people on it (others get 404) |
| POST | `/api/requests/:id/accept`, `/decline` `{reason}` | mentor; accept is capacity-checked atomically |
| POST | `/api/requests/:id/cancel` | student, while pending |
| POST | `/api/sessions` | mentor, on an accepted request |
| GET | `/api/sessions`, `/api/sessions/:id` | participants |
| PATCH | `/api/sessions/:id` | mentor (reschedule) |
| POST | `/api/sessions/:id/cancel` | either person (within 2 h = `lateCancel`, informational) |
| POST | `/api/sessions/:id/complete` | mentor, after start time |
| POST | `/api/sessions/:id/rate` `{rating}` | student, once |
| POST / PATCH / GET | `/api/sessions/:id/notes` | mentor writes, both read |
| POST | `/api/sessions/:id/notes/steps/:stepId/add-to-plan` | student (idempotent) |
| GET / POST | `/api/plan`, `/api/plan/start` | student |
| POST / PATCH / DELETE | `/api/plan/tasks(/:id)` | student, own tasks only |
| GET | `/api/plan/mentees/:studentId` | mentor of that student only |
| POST | `/api/plan/tasks/:id/comments` | mentor of that student only |
| GET | `/api/chats`, `/api/chats/:requestId/messages` | participants of an **accepted** request |
| POST | `/api/chats/:requestId/messages` `{body, clientId}`, `/read` | same |
| GET / POST | `/api/notifications`, `/read-all`, `/:id/read` | own |
| POST / DELETE | `/api/notifications/device-token` | register or remove the FCM token (on login / logout) |

### Phase 4a: CV, opportunities, applications, safety, admin, department
| Method | Path | Roles / notes |
|---|---|---|
| POST / GET | `/api/cv`, `/api/cv/:id` | student (mentor can read a mentee's CV). No phone, email or address fields exist |
| POST / PATCH | `/api/cv/:id/review-request`, `/comments`, `/comments/:cid/resolve` | student asks; mentor of that student comments |
| POST | `/api/opportunities` | verified mentor or admin; `noFeeConfirmed` must be `true`; first post is reviewed |
| GET | `/api/opportunities?employmentType=` | student, mentor, admin: approved and not expired; students get `fit` per post |
| GET | `/api/opportunities/mine`, `/:id` | poster sees own posts in any status; others only approved (404 otherwise) |
| PATCH / POST | `/api/opportunities/:id`, `/:id/close` | poster only; editing a live post sends it back to review |
| POST | `/api/opportunities/:id/report` | student, mentor; one person counts once; 3 different people auto-hide |
| POST | `/api/opportunities/:id/apply` | verified student: `cvVersionId` + explicit `consent` (saved as `consentSnapshot`) |
| GET | `/api/opportunities/:id/applications` | poster only: only the fields each student consented to |
| GET / POST | `/api/applications`, `/:id`, `/:id/withdraw` | student, own only; includes `uiStage` and `timeline` |
| PATCH | `/api/applications/:id/stage` | the poster of that post; server validates every move |
| POST / GET / DELETE | `/api/blocks` | student, mentor |
| POST | `/api/reports/user` | reasons from the design sheet; `alsoBlock` optional |
| POST / GET | `/api/role-requests` | student asks to become mentor or department; admin approves |
| GET / PATCH / POST | `/api/me/consents`, `/api/me/outcome-feedback` | consent switches, "did mentoring help?" |
| GET | `/api/mentor/impact` | mentor: sessions, students, hours, rating, consented outcomes |
| GET / POST | `/api/department/overview`, `/affiliations`, `/affiliations/:userId/approve` | department: anonymized counts; approve students of the same department |
| GET | `/api/admin/summary`, `/role-requests`, `/users`, `/opportunities`, `/reports`, `/audit`, `/fairness` | admin |
| POST | `/api/admin/role-requests/:id/approve`, `/reject`; `/opportunities/:id/approve`, `/restore`, `/hide`, `/remove`; `/reports/user/:id/resolve`; `/preview` | admin, all audit-logged |

## 8. Real-time (Socket.IO)
Use the credential from the Firebase SDK. Never use a custom token.

```js
// Flutter: socket_io_client
const socket = io(API_URL, { auth: { token: firebaseCredential }, transports: ['websocket'] });
socket.emit('join', { requestId }, ack);                      // accepted requests only
socket.emit('message', { requestId, body, clientId }, ack);   // clientId makes a retry safe
socket.on('message', ...); socket.on('notification', ...); socket.on('read', ...);
```

## 9. Business rules
**Roles and access**
- Everyone signs up as `student`. `POST /api/role-requests` plus an admin approval is the only way to change a role. The client never chooses a role.

**Requests and capacity**
- A week runs Saturday to Friday (Bangladesh time). Accepting counts against `weeklyCapacity`; at the cap the mentor is "paused" automatically (computed, resets next week).
- Requests expire after 7 days. A student can have at most 3 pending requests, and one pending request per mentor.

**Chat**
- Exists only for an accepted request, only for its two people, never across a block. Messages with fee or OTP phrases are flagged for admin review.

**Reminders and push**
- `runReminders()` runs every minute from `server.js` (tasks with `reminderAt`, sessions starting within the hour). Each reminder is claimed atomically so it is sent once.
- `notify()` always saves the notification and emits it live. FCM push is best effort and never breaks the request. Dead tokens are removed automatically. The service account needs Firebase Cloud Messaging enabled.

**Applications**
- Stages: `Applied > Under Review > Shortlisted > Interview > Offer > Hired`, with `Rejected` from any active stage and `Withdrawn` only by the student. Each move is validated on the server and saved in `stageHistory`.
- The app shows 5 stages (Applied, Shortlisted, Interview, Selected, Not selected) through `uiStage`.

**Trust labels**
- Every post has three separate labels: who posted it, whether an admin reviewed the listing, and the no-fee declaration. `organizationVerified` stays `false` until the company portal exists.

**Moderation**
- Auto-hide at `REPORT_HIDE_THRESHOLD` distinct reporters (default 3). Restoring a post dismisses its open reports.
- Every admin action and every automatic hide is in `GET /api/admin/audit`. An admin reading applicants is logged too.

**Progress**
- Completing a plan task never changes a skill level. Only reviewed evidence does.

## 10. How the scores work
- **Readiness** = `100 x sum(w x min(s/r, 1)) / sum(w)`. Gaps are ordered by `w x (r - s)`.
- **Evidence-based level:** verified evidence (quiz, endorsement) counts in full. A self-rating or an unreviewed project counts at most level 1. Confidence = share of the student's skills that have verified evidence.
- **Time to ready** = sum of estimated hours (`hoursPerLevel` in `seed/skillsAndRoles.json`, uncalibrated v0) / weekly hours. Returns `null` plus a note if weekly hours is 0.
- **Match score** = 30% career (TF-IDF cosine + 0.15 tag bonus) + 25% top-2 gap coverage + 15% experience + 10% language + 10% schedule + 10% reliability.
- **Fair re-ranking:** a mentor whose projected share of the last 30 days of recommendations would exceed 25% is pushed out (enforced only after 20 recommendations, so a small pilot is not blocked). One rising mentor slot is kept.
- **Fit %** for opportunities uses the readiness formula. A skill with no evidence is shown as `not_provided`, not as a proven lack.
- Gender, religion, region and family background are **never** inputs.

## 11. Security and privacy
- Authentication is Firebase only. The server verifies the ID token on every request (HTTP and Socket.IO).
- Role checks happen on the server. Ownership checks return `404` so other people's data is not revealed.
- Exact student coordinates are never accepted from the client (privacy guard returns `400`).
- Posters never receive a student's email or phone. Department and fit are shared only if ticked in the consent step.
- Department statistics are anonymized and hidden for groups smaller than `DEPT_MIN_COHORT`.
- Secrets (`.env`, `secrets/firebase-admin.json`) are gitignored. Rotate any password that was ever shared.

## 12. Project status and roadmap
| Phase | Scope | Status |
|---|---|---|
| 1 | Auth, profiles, privacy, directory, admin basics | Done |
| 2a | Skills, readiness, matching | Done |
| 3 | Requests, sessions, plan, chat, notifications | Done |
| 4a | CV, opportunities, applications, safety, admin, department | Done |
| Next | File uploads for proof documents (a `proofUrl` link is used for now) | Planned |
| Next | Per-student progress lists for mentors | Planned |
| Next | Workshops and community Q&A | Planned |
| Next | Learning-resource hub | Planned |
| Next | Company portal (Phase 2 tier) | Planned |
| Next | Flutter mobile app | Planned |
