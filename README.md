# MentorLink BD — MVP

Career mentorship for Bangladeshi university students. English / বাংলা.

```
backend/   Node.js + Express + Mongoose + Socket.IO   (tested: 33 Jest tests)
mobile/    Flutter (Riverpod, GoRouter, Dio, flutter_map)   (written, NOT compiled/tested yet)
```

## Honest status
- **Backend:** built and tested here against FerretDB (a MongoDB-compatible database). Run the same tests on real MongoDB.
- **Flutter app:** written complete for the MVP screens but never compiled (no Flutter SDK in the build environment). Expect to fix small compile errors on first run. Not built yet: Next.js admin panel, learning resource hub, employer portal, FCM push wiring, ARB-driven strings on every screen (some screens still have English literals).

## 0. Your Firebase + MongoDB are already filled in
- `backend/.env` already has your Atlas `MONGODB_URI` and `FIREBASE_PROJECT_ID=mentorlink-67926`. **Never upload `.env` to GitHub** (it is in `.gitignore`).
- Atlas: in MongoDB Atlas go to Network Access and allow your IP (for learning, `0.0.0.0/0`), otherwise the connection times out.
- Firebase: in the console turn on Authentication > Sign-in method > Email/Password.
- For `npm run seed:demo` you need a service account: Firebase Console > Project settings > Service accounts > Generate new private key. Save it as `backend/serviceAccount.json`.
- Mobile: `mobile/lib/firebase_options.dart` is already set. After `flutter create`, copy `mobile/android_config/google-services.json` to `mobile/android/app/google-services.json`, and set `applicationId "mentorlinkbd.com"` in `android/app/build.gradle`.

## Admin panel (web)
```bash
cd admin-panel
npm install
npm run dev        # http://localhost:3000  (backend must run on :4000)
```
Sign in as `admin@demo.mentorlink.bd` / `Admin@12345`. Tabs: verification queue (users, mentor applications, job posts with scam flags), audit log, fairness check, universities (campus pins). Non-admins are refused by the server.

## 1. Backend
```bash
cd backend
cp .env.example .env          # set MONGODB_URI, FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS
npm install
npm test                      # SAFE: uses a separate database mongodb://127.0.0.1:27017/mentorlink_test (set TEST_MONGODB_URI to change; its name must end with _test). It never touches MONGODB_URI.
DEMO_MODE=true npm run seed:demo   # creates Firebase users + MongoDB data (idempotent)
npm start                     # http://localhost:4000
```
- Auth: the app sends the Firebase credential as `Authorization: Bearer <string>`. The server verifies it with Firebase Admin and reads the role from MongoDB. There is no JWT code in this project.
- No Firebase project yet? Run the Firebase Auth Emulator (`firebase emulators:start --only auth`) and set `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`.
- **University coordinates in `src/seed/universities.json` are approximate placeholders** (`"verified": false`). Check each pin on a map, fix it, then set `"verified": true`. East Delta and Southern University pins are now verified from public coordinates (Wikipedia); the others are still approximate.

## 2. Mobile
```bash
cd mobile
flutter create . --org bd.mentorlink --project-name mentorlink_bd   # adds android/ios folders
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:4000        # Android emulator
# Chrome:  flutter run -d chrome --dart-define=API_URL=http://localhost:4000
# emulator auth: add --dart-define=AUTH_EMULATOR=10.0.2.2
```
If `CardTheme` errors on a newer Flutter, rename it to `CardThemeData` in `lib/core/theme.dart`.
The app requests **no location permission**.

## Demo accounts
| Role | Email | Password | University |
|---|---|---|---|
| Student | student.edu@demo.mentorlink.bd | Demo@12345 | East Delta University (Robiul) |
| Student | student.su@demo.mentorlink.bd | Demo@12345 | Southern University |
| Mentor | mentor1@demo.mentorlink.bd | Demo@12345 | East Delta University (Abrar) |
| Mentor | mentor2@demo.mentorlink.bd | Demo@12345 | Southern University |
| Department | dept@demo.mentorlink.bd | Demo@12345 | East Delta University (Dayan) |
| Admin | admin@demo.mentorlink.bd | Admin@12345 | — (Ayesha) |
| Employer (Phase 2) | employer@demo.mentorlink.bd | Demo@12345 | — |

## 5-minute demo
1. Sign in as Robiul: readiness for Data Analyst, ranked gaps, weeks to ready.
2. Mentors tab: Abrar with score and "Why this mentor" reasons. Send a request.
3. Sign in as Abrar: accept, chat. Then (API) schedule a session and complete it with next steps.
4. Robiul: Plan tab shows the new tasks; tick one.
5. Opportunities: apply with consent; tracker shows 5 stages. Report a post 3 times from different accounts: it auto-hides.
6. Ayesha: verification queue, approve; audit log.
7. University map: EDU and Southern pins differ; members show as "Robiul H.", never an address.

## What is tested (backend)
Role rules (student cannot self-assign a role, mentor application needs admin), privacy guard (rejects lat/lng/location/address), directory visibility and employer 403, matching maths and fair re-rank, capacity auto-pause, chat only after acceptance, no-fee confirmation and scam flags, one application per post, 5-stage mapping, auto-hide at 3 unique reporters, audit log, anonymized department numbers, idempotent demo seed.
