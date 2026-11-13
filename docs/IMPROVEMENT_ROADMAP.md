# Improvement Roadmap

Status key: Done (changed, untested unless stated) / Open.

## P0
| Task | Why | Implementation | Files | Status |
|---|---|---|---|---|
| Rotate exposed credentials | Zip held a Firebase service-account key and a commented MongoDB password | Rotate in Atlas and Google Cloud; keep keys out of archives; use `.env.example` | `backend/.env`, `backend/serviceAccount.json` | **Open: needs you** |

## P1
| Task | Why | Implementation | Files | Tests needed | Status |
|---|---|---|---|---|---|
| Mentor schedule/complete session in app | Lifecycle stopped after accept | Dialogs calling existing endpoints | `mobile/lib/features/mentor_sessions.dart`, `mentor.dart`, `sessions.dart`, `shell.dart` | Widget tests, manual run | Done |
| Safe meeting join | Toast only; unsafe links | `parseMeetingUri`, `openMeetingLink`, server `normalizeMeetingLink` | `core/links.dart`, `home.dart`, `utils/links.js`, `routes/mentoring.js` | `pure_audit.test.js` (passes), `audit_api.test.js` | Done |
| Notification destinations | No navigation | `target` on notifications, `notificationRoute` | `utils/notifyTarget.js`, `helpers.js`, `models/mentoring.js`, `core/notify_route.dart`, `notifications.dart` | Dart test, API test | Done |
| Report-user deep link + reviewer | Unreachable, state-based, no queue | Query-param route, entry points, server checks, admin queue | `privacy.dart`, `sessions.dart`, `opportunities.js`, `admin.js`, `admin-panel/app/page.tsx` | `audit_api.test.js` | Done |
| Low-data map + attribution | Setting did nothing | Directory list when on; OSM credit | `university.dart` | Widget test | Done |
| Reminders honour settings, no duplicates | Settings ignored; duplicate risk | Atomic claim, `remindersOn`, quiet hours | `services/reminders.js`, `helpers.js` | existing reminder test + API test | Done |
| Complete data export and deletion | Posts, passport, sprints, projects, GitHub, invites, plan reviews remain | Extend `/me/export` and `DELETE /me` to every model holding the user id | `routes/extras.js`, `services/userdata.js` | `tests/userdata.test.js` (guards new models) | Done (update 36; routes not run against a database) |
| Startup reliability | Silent missing modules | Require modules, `/ready`, exit on failed start | `app.js`, `server.js` | Boot test | Done |
| Admin duplicate files | Stale `.js` twins | Removed; `.tsx` canonical | `admin-panel/app`, `lib` | `next build` | Done (build not run) |

## P2
- ~~Enforce blocks in chat and message send~~ (done, update 36); check revocation on admin routes (`verifyIdToken(token, true)`).
- Null-safe populate in applicant lists; restrict withdraw by stage; ~~job search, filters, pagination, saved jobs~~ (done, update 36).
- Career Action Center: Home card using `/me/loop` + `/me/brief` with reason and link per action.
- One shared progress calculation; distinct labels for `/targets`, `/my-paths`, `/pathways`.
- Private vs shared mentor notes on sessions; reschedule flow; reminder text in Dhaka time.
- Admin impact/fairness: show period, sample size, definitions, completeness, small-cohort suppression.
- `University.coordsVerified` stored and shown; production tile provider.
- Accessibility pass (semantic labels, graph text alternative), tablet/desktop layouts, move strings to ARB.
- Admin panel: pagination, confirm dialogs, tests; Flutter widget/integration tests.

## P3
Invite expiry, edit org after verification re-review, animations, theme polish.
