# What every setting means (read this when you want to learn)

An "environment variable" is a setting that lives **outside the code**, so the same code can run on your laptop or on a real server just by changing the settings, and secrets are never written inside the code.

## 1. The server settings: `mentorlink-backend/.env`

| Setting | Your value | Secret? | What it does |
|---|---|---|---|
| `PORT` | `4000` | no | The door number the server listens on. The app calls `http://...:4000`. |
| `NODE_ENV` | `development` | no | Tells the server it is on a learning machine (more logging). |
| `DEMO_MODE` | `true` | no | Allows `npm run seed:demo` and the demo buttons. Set `false` before a real launch. |
| `MONGODB_URI` | `mongodb+srv://robiulhasanjisan88_db_user:<password>@cluster0.8auyt6y.mongodb.net/mentorlink?...` | **YES** | The address, user and password of your Atlas database. `mentorlink` at the end is the database name. |
| `FIREBASE_PROJECT_ID` | `mentorlink-67926` | no | Which Firebase project the server trusts. |
| `GOOGLE_APPLICATION_CREDENTIALS` | `./secrets/firebase-admin.json` | no (it is a path) | Where the server finds its Firebase "admin key" file. |
| `FIREBASE_WEB_API_KEY` | `AIzaSyBhVO...` | no (public) | Only used by `npm run token`, a helper that logs in from the terminal. |
| `ALLOW_PLACEHOLDER_COORDS` | `true` | no | Lets the university list load while campus coordinates are still `0,0`. |
| `CORS_ORIGINS` | `http://localhost:3000` | no | Which websites may call the server from a browser (for the future admin website). |
| `REPORT_HIDE_THRESHOLD` | `3` | no | How many different people must report a job post before it hides automatically. |
| `DEPT_MIN_COHORT` | `1` | no | Department reports hide groups smaller than this (privacy). 1 only for the demo; use 5+ for a real pilot. |

## 2. The Firebase admin key: `mentorlink-backend/secrets/firebase-admin.json`
- A file from Firebase (Project settings > Service accounts). It lets **the server** talk to Firebase with full power (check logins, create demo users, send push notifications).
- **Secret.** Anyone with it controls your Firebase project. It must stay only on the server.
- The app **never** has this file.

## 3. The app settings (the phone app)
These are **not secret**. They only say "this app belongs to project X". Safety comes from Firebase's rules and from the server checking every request.

| Where | What | Meaning |
|---|---|---|
| `lib/firebase_options.dart` | `apiKey`, `appId`, `projectId`... | Which Firebase project the app signs in to. From `flutterfire configure`. |
| `android/app/google-services.json` | same project, plus `package_name: mentorlinkbd.com` | The Android version of the same info. The package name must equal your app's `applicationId`. |
| `lib/core/config.dart` | `API_URL` = `http://10.0.2.2:4000` | Where the app finds your server. `10.0.2.2` is how an emulator says "my computer". |
| `lib/core/config.dart` | `DEMO_MODE` = `true` | Shows the demo login buttons. |

## 4. How the pieces talk (the big picture)
```
Phone app --(1) logs in with email+password--> Firebase
Phone app <--(2) gets a login proof from Firebase SDK-- Firebase
Phone app --(3) sends every request + that proof--> Your server (port 4000)
Your server --(4) asks Firebase "is this proof real?" (using firebase-admin.json)--> Firebase
Your server --(5) reads/writes data (using MONGODB_URI)--> MongoDB Atlas
```
Your code never creates or opens the login proof itself. That is why there is no JWT code in the project.

## 5. How to change the two secrets (do this soon)
**MongoDB password**
1. Atlas > **Database Access** > Edit user `robiulhasanjisan88_db_user` > Edit Password > Update User.
2. Open `.env`, replace the password inside `MONGODB_URI` (the part between `:` and `@`). Restart `npm run dev`.

**Firebase admin key**
1. Firebase Console > Project settings > **Service accounts** > Generate new private key.
2. Replace `secrets/firebase-admin.json` with the downloaded file (same name). Restart the server.
3. Google Cloud Console > IAM & Admin > Service Accounts > Keys: delete the **old** key.

## 6. Moving to a real server later
You do **not** copy `.env` to the internet. On the hosting website you type the same settings into its "Environment variables" screen. The code stays the same.
