# MentorLink BD backend (Phase 1)

Node + Express + Mongoose. Auth is Firebase only: **no JWT code** in this repo.

## Setup
```bash
npm install
cp .env.example .env        # fill MONGODB_URI (NEW rotated password) and credentials path
# put the Firebase service-account JSON at secrets/firebase-admin.json (gitignored)
npm run seed:universities   # needs ALLOW_PLACEHOLDER_COORDS=true until real coordinates are filled
npm run seed:demo           # needs DEMO_MODE=true; creates Firebase + MongoDB demo users
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
