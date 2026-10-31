# API Audit

Generated from the route files in `backend/src/routes/` (static read; endpoints were **not executed** in this session because MongoDB and the npm registry were unavailable). `Roles` is the guard written in the route definition; `Validation` says whether a zod schema is attached (`-` = none / manual checks inside the handler).

Common behaviour: every protected route runs `auth.authenticate` (Firebase ID token verified, role read from MongoDB, deleted accounts refused). Errors use `{error:{code,message}}`. Request bodies are capped at 100 KB (450 KB for verification documents). Global rate limit 300 requests/min per IP.

Frontend callers: see `docs/ROUTE_AUDIT.md` (Data source column). Test coverage: existing suites in `backend/tests/` plus `pure_audit.test.js` (run) and `audit_api.test.js` (not run).

| Method | Endpoint | Roles | Validation | Route file |
|---|---|---|---|---|
| GET | `/api/admin/verification-queue` | admin | - | admin.js |
| POST | `/api/admin/users/:id/verify` | admin | zod | admin.js |
| POST | `/api/admin/mentor-applications/:id` | admin | zod | admin.js |
| POST | `/api/admin/opportunities/:id/review` | admin | zod | admin.js |
| GET | `/api/admin/reports` | admin | - | admin.js |
| POST | `/api/admin/reports/:id/resolve` | admin | zod | admin.js |
| GET | `/api/admin/audit-logs` | admin | - | admin.js |
| GET | `/api/admin/fairness` | admin | - | admin.js |
| POST | `/api/admin/universities` | admin | zod | admin.js |
| PATCH | `/api/admin/universities/:id` | admin | zod | admin.js |
| POST | `/api/admin/resources` | admin | zod | admin.js |
| POST | `/api/admin/resources/check-links` | admin | - | admin.js |
| DELETE | `/api/admin/resources/:id` | admin | - | admin.js |
| GET | `/api/department/overview` | department, admin | - | admin.js |
| GET | `/api/department/analytics` | department/admin | - | analytics.js |
| GET | `/api/me/graph` | student | - | career.js |
| GET | `/api/me/portfolio` | student | - | career.js |
| POST | `/api/me/projects` | student | zod | career.js |
| PUT | `/api/me/projects/:id` | student | zod | career.js |
| DELETE | `/api/me/projects/:id` | student | - | career.js |
| POST | `/api/me/projects/:id/request-review` | student | zod | career.js |
| GET | `/api/me/github` | student | - | career.js |
| POST | `/api/me/github/start` | student | zod | career.js |
| POST | `/api/me/github/verify` | student | - | career.js |
| POST | `/api/me/github/disconnect` | student | - | career.js |
| GET | `/api/me/plan-review` | student | - | career.js |
| POST | `/api/me/plan-review` | student | zod | career.js |
| GET | `/api/mentor/plan-reviews` | mentor | - | career.js |
| POST | `/api/mentor/plan-reviews/:id` | mentor | zod | career.js |
| GET | `/api/me/help-finder` | student | - | career.js |
| GET | `/api/me/help-finder/mentors` | student | - | career.js |
| GET | `/api/feed` | signed-in member | - | community.js |
| POST | `/api/posts` | signed-in poster | zod | community.js |
| GET | `/api/posts/:id` | signed-in member | - | community.js |
| DELETE | `/api/posts/:id` | signed-in member | - | community.js |
| POST | `/api/posts/:id/comments` | signed-in poster | zod | community.js |
| PUT | `/api/posts/:id/reaction` | signed-in member | zod | community.js |
| POST | `/api/posts/:id/report` | signed-in member | - | community.js |
| PUT | `/api/follow/user/:id` | signed-in member | - | community.js |
| DELETE | `/api/follow/user/:id` | signed-in member | - | community.js |
| PUT | `/api/follow/group/:key` | signed-in member | - | community.js |
| DELETE | `/api/follow/group/:key` | signed-in member | - | community.js |
| GET | `/api/groups` | signed-in member | - | community.js |
| GET | `/api/admin/posts` | admin | - | community.js |
| POST | `/api/admin/posts/:id/moderate` | admin | zod | community.js |
| GET | `/api/universities` | public | - | core.js |
| POST | `/api/auth/register-profile` | Firebase identity only (no profile yet) | zod | core.js |
| GET | `/api/me` | any signed-in user | - | core.js |
| PATCH | `/api/me/privacy` | any signed-in user | zod | core.js |
| POST | `/api/me/mentor-application` | student | zod | core.js |
| GET | `/api/directory/universities` | any signed-in user | - | core.js |
| GET | `/api/directory/universities/:id/members` | any signed-in user | - | core.js |
| POST | `/api/orgs/register` | student | zod | employer.js |
| GET | `/api/me/organization` | student, employer | - | employer.js |
| GET | `/api/employer/org` | employer (verified org) | - | employer.js |
| PATCH | `/api/employer/org` | employer (verified org) | zod | employer.js |
| POST | `/api/employer/jobs` | employer (verified org) | zod | employer.js |
| GET | `/api/employer/jobs` | employer (verified org) | - | employer.js |
| POST | `/api/employer/jobs/:id/close` | employer (verified org) | - | employer.js |
| GET | `/api/employer/jobs/:id/applicants` | employer (verified org) | - | employer.js |
| PATCH | `/api/employer/applications/:id/stage` | employer (verified org) | zod | employer.js |
| GET | `/api/admin/organizations` | admin | - | employer.js |
| POST | `/api/admin/organizations/:id/review` | admin | zod | employer.js |
| GET | `/api/matching/info` | any signed-in user | - | extras.js |
| POST | `/api/matches/:mentorId/dismiss` | student | - | extras.js |
| POST | `/api/requests/:id/cancel` | student | - | extras.js |
| POST | `/api/sessions/:id/cancel` | student, mentor | - | extras.js |
| POST | `/api/sessions/:id/rate` | student | zod | extras.js |
| POST | `/api/sessions/:id/mentor-no-show` | student | - | extras.js |
| POST | `/api/mock-interviews` | student | zod | extras.js |
| GET | `/api/mock-interviews` | student, mentor | - | extras.js |
| POST | `/api/mock-interviews/:id/feedback` | mentor | zod | extras.js |
| POST | `/api/mock-interviews/:id/cancel` | student, mentor | - | extras.js |
| GET | `/api/me/progress` | student | - | extras.js |
| GET | `/api/me/consents` | any signed-in user | - | extras.js |
| GET | `/api/me/export` | any signed-in user | - | extras.js |
| DELETE | `/api/me` | any signed-in user | zod | extras.js |
| POST | `/api/me/verification-doc` | public | zod | extras.js |
| GET | `/api/me/verification-docs` | any signed-in user | - | extras.js |
| DELETE | `/api/me/verification-docs/:id` | any signed-in user | - | extras.js |
| GET | `/api/admin/verification-docs/:userId` | admin | - | extras.js |
| POST | `/api/me/department-application` | student | zod | extras.js |
| GET | `/api/admin/department-applications` | admin | - | extras.js |
| POST | `/api/admin/department-applications/:id` | admin | zod | extras.js |
| GET | `/api/workshops` | public | - | extras.js |
| POST | `/api/workshops` | mentor, department, admin | zod | extras.js |
| POST | `/api/workshops/:id/join` | student | - | extras.js |
| DELETE | `/api/workshops/:id/join` | student | - | extras.js |
| POST | `/api/workshops/:id/cancel` | mentor, department, admin | - | extras.js |
| GET | `/api/qa` | public | - | extras.js |
| GET | `/api/qa/:id` | public | - | extras.js |
| POST | `/api/qa` | student, mentor | zod | extras.js |
| POST | `/api/qa/:id/answers` | student, mentor | zod | extras.js |
| POST | `/api/qa/:id/report` | student, mentor | - | extras.js |
| GET | `/api/admin/qa` | admin | - | extras.js |
| POST | `/api/admin/qa/:id/moderate` | admin | zod | extras.js |
| GET | `/api/me/impact` | mentor | - | extras.js |
| GET | `/api/me/impact/certificate` | mentor | - | extras.js |
| GET | `/api/department/weekly` | department/admin | - | extras.js |
| GET | `/api/department/approvals` | department/admin | - | extras.js |
| POST | `/api/department/approvals/:id` | department/admin | zod | extras.js |
| POST | `/api/department/bulk-approve` | department/admin | zod | extras.js |
| GET | `/api/department/report.csv` | department/admin | - | extras.js |
| GET | `/api/admin/users` | admin | - | extras.js |
| PATCH | `/api/admin/users/:id/role` | admin | zod | extras.js |
| POST | `/api/admin/preview` | admin | zod | extras.js |
| GET | `/api/admin/outcomes` | admin | - | extras.js |
| PUT | `/api/me/targets` | student | zod | hub.js |
| GET | `/api/me/dashboard` | student | - | hub.js |
| GET | `/api/me/target-mentors` | student | - | hub.js |
| GET | `/api/me/journey` | mentor | - | journey.js |
| PUT | `/api/me/journey` | mentor | zod | journey.js |
| GET | `/api/me/path-twins` | student | - | journey.js |
| GET | `/api/me/decision-lab` | student | - | lab.js |
| POST | `/api/me/decision-lab/simulate` | student | zod | lab.js |
| GET | `/api/roles` | any signed-in user | - | learning.js |
| GET | `/api/skills` | any signed-in user | - | learning.js |
| PUT | `/api/me/goal` | student | zod | learning.js |
| POST | `/api/me/evidence` | student | zod | learning.js |
| GET | `/api/me/readiness` | student | - | learning.js |
| GET | `/api/matches` | student | - | learning.js |
| GET | `/api/quizzes/:skillKey` | student | - | learning.js |
| POST | `/api/quizzes/:skillKey/submit` | student | zod | learning.js |
| GET | `/api/resources` | any signed-in user | - | learning.js |
| POST | `/api/resources/:id/complete` | student | - | learning.js |
| PUT | `/api/resources/:id/progress` | student | zod | learning.js |
| DELETE | `/api/resources/:id/progress` | student | - | learning.js |
| POST | `/api/resources/:id/report` | student | zod | learning.js |
| GET | `/api/roadmaps` | any signed-in user | - | learning.js |
| GET | `/api/roadmaps/:skillKey` | any signed-in user | - | learning.js |
| PUT | `/api/roadmaps/:skillKey/topics/:topicKey` | student | zod | learning.js |
| GET | `/api/targets` | student | - | learning.js |
| GET | `/api/targets/:key` | student | - | learning.js |
| PUT | `/api/targets/:key/topics/:topicKey` | student | zod | learning.js |
| GET | `/api/mentors/:id` | student | - | learning.js |
| POST | `/api/me/evidence/:id/request-review` | student | zod | loop.js |
| GET | `/api/mentor/review-queue` | mentor | - | loop.js |
| GET | `/api/mentees/:studentId/review-pack` | mentor | - | loop.js |
| POST | `/api/mentees/:studentId/evidence/:evId/review` | mentor | zod | loop.js |
| POST | `/api/mentees/:studentId/advice` | mentor | zod | loop.js |
| GET | `/api/me/reviews` | student | - | loop.js |
| GET | `/api/me/loop` | student | - | loop.js |
| GET | `/api/me/gaps/:skillKey/mentors` | student | - | loop.js |
| PUT | `/api/me/outcome-sharing` | student | zod | loop.js |
| GET | `/api/me/outcome-tracker` | student | - | loop.js |
| GET | `/api/admin/impact` | admin | - | loop.js |
| GET | `/api/me/job-gaps` | student | - | loop.js |
| GET | `/api/me/mentor-profile` | mentor | - | mentoring.js |
| PUT | `/api/me/mentor-profile` | mentor | zod | mentoring.js |
| POST | `/api/requests` | student | zod | mentoring.js |
| GET | `/api/requests` | student, mentor | - | mentoring.js |
| POST | `/api/requests/:id/decision` | mentor | zod | mentoring.js |
| POST | `/api/sessions` | mentor | zod | mentoring.js |
| GET | `/api/sessions` | student, mentor | - | mentoring.js |
| POST | `/api/sessions/:id/complete` | mentor | zod | mentoring.js |
| GET | `/api/me/plan` | student | - | mentoring.js |
| PATCH | `/api/tasks/:id` | student, mentor | zod | mentoring.js |
| GET | `/api/requests/:id/messages` | any signed-in user | - | mentoring.js |
| POST | `/api/requests/:id/messages` | any signed-in user | zod | mentoring.js |
| POST | `/api/me/device-token` | any signed-in user | zod | mentoring.js |
| GET | `/api/notifications` | any signed-in user | - | mentoring.js |
| POST | `/api/notifications/read-all` | any signed-in user | - | mentoring.js |
| POST | `/api/notifications/:id/read` | any signed-in user | - | mentoring.js |
| POST | `/api/users/:id/block` | any signed-in user | - | mentoring.js |
| POST | `/api/me/cv` | student | zod | opportunities.js |
| POST | `/api/me/cv/check` | student | zod | opportunities.js |
| GET | `/api/mentees/:studentId/cv` | mentor | - | opportunities.js |
| GET | `/api/me/cv` | student | - | opportunities.js |
| POST | `/api/cv/:id/review` | mentor | zod | opportunities.js |
| POST | `/api/opportunities` | mentor, admin | zod | opportunities.js |
| GET | `/api/opportunities` | student, mentor, department, admin | - | opportunities.js |
| GET | `/api/opportunities/:id` | student, mentor, department, admin | - | opportunities.js |
| POST | `/api/opportunities/:id/apply` | student | zod | opportunities.js |
| GET | `/api/me/applications` | student | - | opportunities.js |
| POST | `/api/applications/:id/withdraw` | student | - | opportunities.js |
| POST | `/api/applications/:id/outcome` | student | zod | opportunities.js |
| GET | `/api/opportunities/:id/applications` | mentor, admin | - | opportunities.js |
| PATCH | `/api/applications/:id/stage` | mentor, admin | zod | opportunities.js |
| POST | `/api/reports` | student, mentor | zod | opportunities.js |
| GET | `/api/me/passport` | student | - | startup.js |
| PUT | `/api/me/passport` | student | zod | startup.js |
| POST | `/api/me/passport/rotate` | student | - | startup.js |
| GET | `/api/public/passport/:slug` | public | - | startup.js |
| GET | `/api/me/sprints` | student | - | startup.js |
| POST | `/api/me/sprints` | student | zod | startup.js |
| PATCH | `/api/me/sprints/:id/days/:n` | student | zod | startup.js |
| POST | `/api/me/sprints/:id/submit` | student | zod | startup.js |
| POST | `/api/me/sprints/:id/stop` | student | - | startup.js |
| GET | `/api/mentor/sprint-reviews` | mentor | - | startup.js |
| POST | `/api/mentor/sprints/:id/review` | mentor | zod | startup.js |
| GET | `/api/me/brief` | student | - | startup.js |
| GET | `/api/me/week-card` | student | - | startup.js |
| GET | `/api/employer/talent` | employer (verified org) | - | startup.js |
| POST | `/api/employer/talent/:talentId/invite` | employer (verified org) | zod | startup.js |
| GET | `/api/employer/invites` | employer (verified org) | - | startup.js |
| GET | `/api/me/invites` | student | - | startup.js |
| POST | `/api/me/invites/:id/respond` | student | zod | startup.js |

**Total endpoints found: 197** (plus `GET /health`, `GET /ready`, `GET /p/:slug` public passport page).


## Added or changed in this audit
| Endpoint | Change |
|---|---|
| `GET /ready` | New readiness probe (503 until MongoDB is connected). `/health` stays a liveness probe. |
| `POST /api/sessions` | Meeting link must normalise to https; start time must be in the future. |
| `POST /api/requests/:id/decision` | Decision is claimed atomically; a second concurrent decision gets 409. |
| `GET /api/notifications` | Adds `target`, `unreadCount`, `hasMore`, `?limit`, `?before`. |
| `POST /api/users/:id/block` | 404 when the user does not exist. |
| `POST /api/reports` | Target must exist; self-report refused. |
| `GET /api/admin/reports`, `POST /api/admin/reports/:id/resolve` | New safety-report queue (admin only, reporter hidden, audited). |
| `GET /api/admin/audit-logs` | Adds `?limit` and `?before` paging. |
