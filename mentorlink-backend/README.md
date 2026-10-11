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
