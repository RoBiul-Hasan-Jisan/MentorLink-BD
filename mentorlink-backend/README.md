# MentorLink BD backend (Phase 1)

Node + Express + Mongoose. Auth is Firebase only: **no JWT code** in this repo.

## Setup
```bash
npm install
cp .env.example .env        # fill MONGODB_URI (NEW rotated password) and credentials path
# put the Firebase service-account JSON at secrets/firebase-admin.json (gitignored)
npm run seed:universities   # needs ALLOW_PLACEHOLDER_COORDS=true until real coordinates are filled
npm run seed:skills         # skills + 6 role templates (also run by seed:demo)
npm run seed:demo           # needs DEMO_MODE=true; Firebase + MongoDB demo users, profiles, evidence, 3 extra seed mentors
npm run dev                 # http://localhost:4000/health
npm test
```

## Before the demo (team TODO)
1. Open each campus on Google Maps and put the real `[longitude, latitude]` in `seed/universities.json`
   (or call `PATCH /api/admin/universities/:id` as admin). Then set `ALLOW_PLACEHOLDER_COORDS=false`.

## Try each demo account with curl
```bash
# 1) get the credential the Firebase SDK would give the app (needs FIREBASE_WEB_API_KEY in .env)
TOKEN=$(npm run -s token -- student.edu@demo.mentorlink.bd 'Demo@12345')

# 2) call the API
curl -s localhost:4000/api/me -H "Authorization: Bearer $TOKEN"
curl -s localhost:4000/api/directory/map -H "Authorization: Bearer $TOKEN"
curl -s localhost:4000/api/universities
curl -s -X PATCH localhost:4000/api/me/privacy -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"showInDirectory":false}'

# privacy guard -> 400
curl -s -X PATCH localhost:4000/api/me/privacy -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"showInDirectory":true,"latitude":22.3}'

# student on admin endpoint -> 403
curl -s -X POST localhost:4000/api/admin/universities -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{}'
```
Repeat with: `mentor1@`, `mentor2@`, `dept@` (`Demo@12345`) and `admin@` (`Admin@12345`) `demo.mentorlink.bd`.

## Endpoints (Phase 1)
| Method | Path | Roles |
|---|---|---|
| GET | /health | public |
| GET | /api/universities | public |
| POST | /api/auth/register-profile | any Firebase user without a profile (always becomes student) |
| GET | /api/me | any signed-in |
| PATCH | /api/me/privacy, /api/me/settings | any signed-in |
| GET | /api/directory/map | student, mentor, department, admin |
| GET | /api/directory/universities/:id/members | student, mentor, admin |
| POST/PATCH | /api/admin/universities | admin |
| PATCH | /api/admin/users/:id/verification | admin |

## Phase 2a endpoints (skills, readiness, matching)
| Method | Path | Roles |
|---|---|---|
| GET | /api/skills, /api/roles | any signed-in |
| GET/PUT | /api/me/goal | student |
| GET/POST | /api/me/evidence | student (only `self` and `project`; both stay unverified) |
| GET | /api/me/readiness | student |
| GET | /api/matches | student (top 5 + factor scores + reasons + keyword baseline) |
| GET/PUT | /api/me/mentor-profile | mentor (stats like rating/sessions are server-only) |

```bash
TOKEN=$(npm run -s token -- student.edu@demo.mentorlink.bd 'Demo@12345')
curl -s localhost:4000/api/me/readiness -H "Authorization: Bearer $TOKEN"
curl -s localhost:4000/api/matches      -H "Authorization: Bearer $TOKEN"
curl -s -X PUT localhost:4000/api/me/goal -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"careerGoalRoleKey":"data-analyst","weeklyHours":6,"languages":["bn","en"],"preferredSlots":["Sun 20:30"]}'
```

## How the scores work (for the viva)
- **Readiness** = 100 x sum(w x min(s/r, 1)) / sum(w). Gaps are ordered by w x (r - s).
- **Evidence-based level:** verified evidence (quiz, endorsement) counts in full. A self-rating or an unreviewed project counts at most level 1. Confidence = share of the student's skills that have verified evidence.
- **Time to ready** = sum of estimated hours (rubric in `seed/skillsAndRoles.json`, `hoursPerLevel`, uncalibrated v0) / weekly hours. Returns `null` plus a note if weekly hours is 0.
- **Match score** = 30% career (TF-IDF cosine + 0.15 tag bonus) + 25% top-2 gap coverage + 15% experience + 10% language + 10% schedule + 10% reliability.
- **Fair re-ranking:** a mentor whose projected share of the last 30 days of recommendations would exceed 25% is pushed out (only enforced after 20 recommendations, so a tiny pilot is not blocked); one rising mentor slot is kept.
- Only formulas are used. No external AI API. Gender, religion, region and family background are never inputs.

## Phase 3 endpoints (requests, sessions, plan, chat, notifications)
| Method | Path | Roles / notes |
|---|---|---|
| POST | /api/requests | verified student. goal + 2 to 3 questions + preferred slots + format |
| GET | /api/requests?status= | own only (student: sent, mentor: received) |
| GET | /api/requests/:id | the two people on it (others get 404) |
| POST | /api/requests/:id/accept, /decline `{reason}` | mentor. Accept is capacity-checked atomically |
| POST | /api/requests/:id/cancel | student, while pending |
| POST | /api/sessions | mentor, on an accepted request |
| GET | /api/sessions, /api/sessions/:id | participants |
| PATCH | /api/sessions/:id | mentor (reschedule) |
| POST | /api/sessions/:id/cancel | either person (within 2 h = `lateCancel`, informational only) |
| POST | /api/sessions/:id/complete | mentor, after start time |
| POST | /api/sessions/:id/rate `{rating}` | student, once |
| POST/PATCH/GET | /api/sessions/:id/notes | mentor writes, both read |
| POST | /api/sessions/:id/notes/steps/:stepId/add-to-plan | student (idempotent) |
| GET | /api/plan, POST /api/plan/start | student |
| POST/PATCH/DELETE | /api/plan/tasks(/:id) | student, own tasks only |
| GET | /api/plan/mentees/:studentId | mentor of that student only |
| POST | /api/plan/tasks/:id/comments | mentor of that student only |
| GET | /api/chats, /api/chats/:requestId/messages | participants of an ACCEPTED request |
| POST | /api/chats/:requestId/messages `{body, clientId}`, /read | same |
| GET | /api/notifications, POST /read-all, /:id/read | own |
| POST/DELETE | /api/notifications/device-token | register / remove the FCM token (call on login / logout) |

### Socket.IO (live chat + live notifications)
```js
// Flutter: socket_io_client. Use the credential from the Firebase SDK (never your own token)
const socket = io(API_URL, { auth: { token: firebaseCredential }, transports: ['websocket'] });
socket.emit('join', { requestId }, ack);                          // only works for an accepted request
socket.emit('message', { requestId, body, clientId }, ack);       // clientId makes a retry safe ("Message queued")
socket.on('message', ...); socket.on('notification', ...); socket.on('read', ...);
```

### Rules worth knowing
- **Capacity:** a week runs Saturday to Friday (Bangladesh time). Accepting counts against `weeklyCapacity`; at the cap the mentor is "paused" automatically (computed, nothing to forget to clear) and resets next week.
- **Requests** expire after 7 days. A student can have at most 3 pending requests, and one pending request per mentor.
- **Chat** exists only for an accepted request, only for its two people, never across a block. Messages with fee/OTP phrases are flagged for admin review (Phase 4a).
- **Reminders:** `runReminders()` runs every minute from `server.js` (tasks with `reminderAt`, sessions starting within the hour). Each is claimed atomically so it is sent once.
- **Push:** `notify()` always saves the notification and emits it live; FCM push is best effort and never breaks the request. Dead tokens are removed automatically. The service account needs Firebase Cloud Messaging enabled.
- Completing a plan task never changes a skill level. Only reviewed evidence does.

## Phase 4a endpoints (CV, opportunities, applications, safety, admin, department)
| Method | Path | Roles / notes |
|---|---|---|
| POST/GET | /api/cv, GET /api/cv/:id | student (mentor can read a mentee's CV). No phone/email/address fields exist |
| POST | /api/cv/:id/review-request, /comments, PATCH /comments/:cid/resolve | student asks; mentor of that student comments |
| POST | /api/opportunities | verified mentor or admin. `noFeeConfirmed` must be `true`. First post is reviewed |
| GET | /api/opportunities?employmentType= | student/mentor/admin: approved + not expired; students get `fit` per post |
| GET | /api/opportunities/mine, /:id | poster sees own posts in any status; others only approved ones (404 otherwise) |
| PATCH/POST | /api/opportunities/:id, /:id/close | poster only. Editing a live post sends it back to review |
| POST | /api/opportunities/:id/report | student/mentor. One person counts once. 3 different people auto-hide |
| POST | /api/opportunities/:id/apply | verified student: `cvVersionId` + explicit `consent` (saved as `consentSnapshot`) |
| GET | /api/opportunities/:id/applications | poster only: ONLY the fields each student consented to |
| GET/POST | /api/applications, /:id, /:id/withdraw | student, own only; response has `uiStage` and `timeline` (5-stage design) |
| PATCH | /api/applications/:id/stage | the poster of that post. Server validates every move |
| POST/GET/DELETE | /api/blocks | student/mentor |
| POST | /api/reports/user | reasons from the design sheet; `alsoBlock` optional |
| POST/GET | /api/role-requests | student asks to become mentor/department; an admin approves |
| GET/PATCH | /api/me/consents, POST /api/me/outcome-feedback | consent switches, "did mentoring help?" |
| GET | /api/mentor/impact | mentor: sessions, students, hours, rating, consented outcomes |
| GET/POST | /api/department/overview, /affiliations, /affiliations/:userId/approve | department: anonymized counts; approve students of the same department |
| GET | /api/admin/summary, /role-requests, /users, /opportunities, /reports, /audit, /fairness | admin |
| POST | /api/admin/role-requests/:id/approve, /reject; /opportunities/:id/approve, /restore, /hide, /remove; /reports/user/:id/resolve; /preview | admin, all audit-logged |

### Rules worth knowing
- **Roles:** everyone signs up as a `student`. An alumni/department user then calls `POST /api/role-requests`; only an admin approval changes the role (the server does it). The client never chooses a role.
- **Stages:** `Applied > Under Review > Shortlisted > Interview > Offer > Hired`, with `Rejected` from any active stage and `Withdrawn` only by the student. Each move is checked on the server and saved in `stageHistory`. The app shows 5 stages (Applied, Shortlisted, Interview, Selected, Not selected) through `uiStage`.
- **Three separate labels** on every post (`labels`): who posted it, whether an admin reviewed the listing, and the no-fee declaration. `organizationVerified` stays `false` until the company portal (Phase 2) exists.
- **Fit %** uses the same formula as readiness. A skill with no evidence is shown as `not_provided`, not as a proven lack.
- **Privacy:** posters never get email or phone. A student's department and fit are shared only if ticked in the consent step. Department numbers are anonymized, respect each student's switch, and are hidden for groups smaller than `DEPT_MIN_COHORT`.
- **Auto-hide:** `REPORT_HIDE_THRESHOLD` (default 3) distinct reporters. Restoring a post dismisses its open reports.
- **Audit:** every admin action and every automatic hide is in `GET /api/admin/audit`. An admin reading applicants is logged too.
- **Not built yet:** file uploads for proof documents (a link, `proofUrl`, is used for now), per-student progress lists for mentors, workshops/community Q&A, learning-resource hub and company portal (Phase 2 tier).
