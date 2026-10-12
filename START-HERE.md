# MentorLink BD: START HERE (for beginners)

Everything you gave me is **already filled in**. You do not need to type any key or password anywhere.

```
MentorLink-BD/
  START-HERE.md            <- this guide
  ENV-EXPLAINED.md         <- what every setting means (read later, to learn)
  mentorlink-backend/      <- the server (Node.js). Has .env and secrets/ already filled in
  mentorlink-app/          <- the phone app (Flutter)
```

> Folders starting with a dot (like `.env`) are hidden on Windows. In File Explorer: View > Show > Hidden items.

---------------------------------------------------------------------
## PART 1. Install the tools (one time)

1. **Node.js** (LTS version, 18 or newer): https://nodejs.org . Check in a terminal: `node -v`
2. **Flutter** (3.22 or newer) and **Android Studio**: https://docs.flutter.dev/get-started/install . Then run `flutter doctor` and fix what it complains about (Android SDK, accept licenses with `flutter doctor --android-licenses`).
3. An **Android emulator** (Android Studio > Device Manager > Create device) or a real Android phone with USB debugging on.

---------------------------------------------------------------------
## PART 2. Two switches in the websites (one time, 3 minutes)

**MongoDB Atlas** (your database) - https://cloud.mongodb.com
- Left menu **Network Access** > **Add IP Address** > **Add Current IP Address** > Confirm.
- (For learning only you may choose "Allow access from anywhere". Remove it later.)
- Without this step the server says it cannot connect.

**Firebase** (your login system) - https://console.firebase.google.com > project `mentorlink-67926`
- **Build > Authentication > Sign-in method > Email/Password > Enable > Save.**
- Without this step nobody can log in.

---------------------------------------------------------------------
## PART 3. Start the server

Open a terminal in the `mentorlink-backend` folder.

```bash
npm install            # downloads the libraries (first time only, takes a minute)
npm run seed:demo      # creates the demo accounts + sample data (safe to run again)
npm run dev            # starts the server
```

You should see `MentorLink API + sockets on :4000`. Keep this terminal open.
Test it: open http://localhost:4000/health in your browser. It must show `{"status":"ok"}`.

Optional: `npm test` runs the automatic tests (the first run downloads a small test database, so it needs internet).

---------------------------------------------------------------------
## PART 4. Make the Flutter project (one time)

You need a Flutter project that has the app's Android settings. Two ways:

**Way A. You already have your Flutter project** (the one where you ran `flutterfire configure`):
1. Copy the `lib` and `assets` folders from `mentorlink-app` into it (replace what is there).
2. Open your `pubspec.yaml` and copy the `dependencies:` list and the `assets:` part from `mentorlink-app/pubspec.yaml`.
3. Skip to step 5 below.

**Way B. New project:**
1. In a terminal: `flutter create mentorlink_bd`
2. Copy `lib` and `assets` from `mentorlink-app` into `mentorlink_bd` (replace), and replace `pubspec.yaml` with the one from `mentorlink-app`.
3. Copy `mentorlink-app/android_setup/google-services.json` to `mentorlink_bd/android/app/google-services.json`.
4. Open `android/app/build.gradle` (or `build.gradle.kts`) and change `applicationId` to exactly `"mentorlinkbd.com"` and `minSdk` to `23`. The Google services plugin must be added too. The easiest way is to run once: `dart pub global activate flutterfire_cli` then `flutterfire configure` and choose project `mentorlink-67926` (it does that step for you).
5. Open `android/app/src/main/AndroidManifest.xml` and add the lines from `mentorlink-app/android_setup/AndroidManifest.snippet.xml` (internet, notifications). **Never add location permission.**
6. For development only, create `android/app/src/debug/AndroidManifest.xml` with `android:usesCleartextTraffic="true"` on `<application>` (see the snippet file), so the app may talk to your local server.

---------------------------------------------------------------------
## PART 5. Run the app

With the server still running (Part 3) and your emulator open:

```bash
flutter pub get
flutter run
```

The address of the server (`http://10.0.2.2:4000`) and demo mode are already built in. That is the emulator's name for "my computer".

**Real phone on USB instead of the emulator:**
```bash
adb reverse tcp:4000 tcp:4000
flutter run --dart-define=API_URL=http://127.0.0.1:4000
```

---------------------------------------------------------------------
## PART 6. Log in with the demo accounts

On the login screen tap a demo button (it only fills the email and password), then press **Log in**.

| Role | Email | Password |
|---|---|---|
| Student (East Delta) | student.edu@demo.mentorlink.bd | Demo@12345 |
| Student (Southern) | student.su@demo.mentorlink.bd | Demo@12345 |
| Alumni mentor | mentor1@demo.mentorlink.bd | Demo@12345 |
| Alumni mentor 2 | mentor2@demo.mentorlink.bd | Demo@12345 |
| Department | dept@demo.mentorlink.bd | Demo@12345 |
| Admin | admin@demo.mentorlink.bd | Admin@12345 |

Try this story: log in as the student, look at Mentors, send a request; log out; log in as `mentor1`, accept it, open the chat; then back as the student and chat. Then look at Jobs and apply.

---------------------------------------------------------------------
## PART 7. If something goes wrong

| What you see | What it means and what to do |
|---|---|
| Server: `Startup failed: ... ECONNREFUSED` or `timed out` / `Could not connect to any servers` | Atlas does not allow your IP. Do Part 2 (Network Access). |
| Server: `bad auth` / `Authentication failed` | The MongoDB password in `.env` is wrong or was changed. Put the new one in `MONGODB_URI`. |
| Seed: `DEMO_MODE is not "true"` | Open `.env`, make sure the line is `DEMO_MODE=true`. |
| Seed: `Refusing to seed ... [0,0] coordinates` | Make sure `.env` has `ALLOW_PLACEHOLDER_COORDS=true`. |
| Seed or login: `auth/operation-not-allowed` | Email/Password is not enabled in Firebase. Do Part 2. |
| App: "No connection" on the emulator | Is the server running? Open http://localhost:4000/health on your computer. |
| App on a real phone: "No connection" | Use the `adb reverse` command in Part 5. |
| App closes at start with a Firebase error | `google-services.json` is missing in `android/app/` or `applicationId` is not `mentorlinkbd.com`. |
| `flutter run`: Gradle or minSdk error | Set `minSdk 23` (Part 4). |
| Red error text with a line number when building | Copy the whole message and send it to me. I wrote the app without being able to compile it, so a few small fixes are normal. |
| Login works but the app shows an empty screen | The seed was not run. Run `npm run seed:demo` again. |

---------------------------------------------------------------------
## PART 8. Keep your secrets safe

- `mentorlink-backend/.env` and `mentorlink-backend/secrets/firebase-admin.json` are **secret**. They give full access to your database and Firebase.
- Do **not** upload them to GitHub or send them in chats. The `.gitignore` already hides them from Git.
- You posted the database password and the Firebase key in a chat, so please **change both soon**: ENV-EXPLAINED.md shows exactly how.
- The map pins are all at 0,0 for now. Later, as admin, you will set the real campus coordinates (screen: Queue > university icon).
