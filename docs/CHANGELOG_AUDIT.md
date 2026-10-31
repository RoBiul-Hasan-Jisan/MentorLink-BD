# Changelog (audit session)
All changes are untested beyond syntax checks (see TEST_REPORT).

| Files | Reason | Before → After |
|---|---|---|
| `.gitignore` (new), `backend/.gitignore`, `backend/.env.example` | Secret hygiene | No root ignore → ignores env files, service-account keys; documents `RUN_SCHEDULER` |
| `admin-panel/app/page.js, layout.js`, `lib/api.js, firebase.js` (deleted) | Stale duplicates of `.tsx` | Two competing route files → `.tsx` only |
| `admin-panel/app/page.tsx` | Safety reports | No report queue → Reports tab with confirm + audit |
| `backend/src/app.js`, `server.js`, `realtime.js` | Reliability | Silent module skip, hang on failed start, open socket CORS → fail loudly, `/ready`, `RUN_SCHEDULER`, socket origin list, deleted users refused |
| `services/reminders.js`, `utils/helpers.js`, `utils/notifyTarget.js`, `models/mentoring.js` | Reminders and notification targets | Settings ignored, possible double send, no destinations → atomic claim, settings honoured, typed `target` |
| `routes/mentoring.js`, `utils/links.js` | Mentoring lifecycle | Any link string, past times, non-atomic decision, 50 notifications only → https links, future times, atomic decision, unread count and paging, block checks target |
| `routes/opportunities.js`, `routes/admin.js` | Reports | Any id reportable, no queue → target must exist, admin queue, audit-log paging |
| `mobile/lib/core/links.dart`, `features/home.dart`, `sessions.dart` | Join | Toast with URL → opens https link, Join button, role-aware screen |
| `features/mentor_sessions.dart` (new), `mentor.dart`, `shell.dart` | Mentor lifecycle | No schedule/complete → dialogs, "My sessions" entry |
| `core/notify_route.dart` (new), `features/notifications.dart` | Notification navigation | Mark read only → navigates |
| `features/privacy.dart`, `sessions.dart` (router), `mentor_detail.dart`, `mentor.dart` | Report user | State-based, unreachable → `/report-user?id=&name=`, validation, entry points |
| `features/university.dart` | Low-data, attribution | Always map → directory list in low-data, search, credit |
| `features/shell.dart`, `widgets.dart` | Settings | Silent failure → error toast via `savePrivacySetting` |
| `router.dart`, `features/employer.dart` | Applicants | Title from router state → query/lookup |
| `backend/tests/pure_audit.test.js`, `audit_api.test.js`, `mobile/test/notify_route_test.dart` (new) | Tests | see TEST_REPORT |
| `docs/*` | Reports | New |
