# Test Report

## Environment
Linux container, Node 22.22. No Flutter/Dart SDK, no MongoDB, no FerretDB. The npm registry returned HTTP 403 through the egress proxy (policy denial; not worked around), so `npm install` could not complete in `backend/` or `admin-panel/`. The partial `node_modules` left by the failed install were deleted.

## Commands actually executed
| Command | Result |
|---|---|
| `npm ci` / `npm install` (backend, admin-panel) | FAILED: registry blocked (ENOTFOUND direct, 403 via proxy) |
| `node --check` on every changed backend file (`app.js`, `server.js`, `realtime.js`, `routes/mentoring.js`, `opportunities.js`, `admin.js`, `services/reminders.js`, `utils/*.js`, `models/mentoring.js`) and the new tests | PASS |
| `node shim.js backend/tests/pure_audit.test.js` (3 tests of link normalisation, notification targets, quiet hours, run through a minimal `test/expect` shim, not real Jest) | 3 PASS |
| Source search for secrets in git: `git ls-files`, `git log -- backend/.env backend/serviceAccount.json` | Not tracked, no history |

## Not performed (blocked)
`npm test` (backend, 40+ suites), `flutter analyze`, `flutter test`, `next build`, type-check, any API/E2E flow, device/browser checks, responsive and accessibility checks, dependency vulnerability audit (`npm audit`).

## Unrun tests added
`backend/tests/audit_api.test.js` (sessions link/time rules, notification target, report validation and admin queue, atomic decision, `/ready`): syntax-checked only; may need small fixes to model required fields when first run. `mobile/test/notify_route_test.dart`: not run.

## Regression risk to check first
Existing suites touching changed code: `mentoring.test.js` (decision, sessions, reminders), `design.test.js` (notifications), `safety.test.js` (reports), `extras.test.js`. Existing sessions tests use future times, so the new future-time rule should not break them. `notify()` may now return `null` for suppressed reminders.

## Security tests
None executed. Authorization was reviewed by reading each route module.
