#!/usr/bin/env bash
# MentorLink BD: route smoke test (no frontend needed)
# Usage: bash scripts/smoke-test.sh
#        BASE_URL=http://localhost:4000 bash scripts/smoke-test.sh
# Requires: server running, seed:demo done, FIREBASE_WEB_API_KEY in .env

BASE_URL="${BASE_URL:-http://localhost:4000}"
DOMAIN="demo.mentorlink.bd"
PASS=0
FAIL=0

# check "label" EXPECTED_STATUS METHOD PATH [TOKEN] [JSON_BODY]
check() {
  local label="$1" expected="$2" method="$3" path="$4" token="$5" body="$6"
  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" "$BASE_URL$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  local got
  got=$(curl "${args[@]}")
  if [ "$got" = "$expected" ]; then
    printf 'PASS  %-55s (expected %s, got %s)\n' "$label" "$expected" "$got"
    PASS=$((PASS + 1))
  else
    printf 'FAIL  %-55s (expected %s, got %s)\n' "$label" "$expected" "$got"
    FAIL=$((FAIL + 1))
  fi
}

get_token() {
  npm run -s token -- "$1@$DOMAIN" "$2" 2>/dev/null
}

echo "== Signing in demo users =="
STUDENT=$(get_token student.edu 'Demo@12345')
MENTOR=$(get_token mentor1 'Demo@12345')
DEPT=$(get_token dept 'Demo@12345')
ADMIN=$(get_token admin 'Admin@12345')

for pair in "student:$STUDENT" "mentor:$MENTOR" "dept:$DEPT" "admin:$ADMIN"; do
  if [ -z "${pair#*:}" ]; then
    echo "ERROR: could not get a token for ${pair%%:*}. Check seed:demo and FIREBASE_WEB_API_KEY."
    exit 2
  fi
done

echo
echo "== Public and unauthenticated =="
check "GET /health"                           200 GET /health
check "GET /api/universities"                 200 GET /api/universities
check "GET /api/me (no token)"                401 GET /api/me
check "GET /api/matches (no token)"           401 GET /api/matches
check "GET /api/admin/summary (no token)"     401 GET /api/admin/summary

echo
echo "== Student: allowed =="
for p in /api/me /api/directory/map /api/skills /api/roles /api/me/goal \
         /api/me/evidence /api/me/readiness /api/matches /api/plan \
         /api/requests /api/sessions /api/chats /api/notifications \
         /api/cv /api/opportunities /api/applications /api/blocks \
         /api/me/consents; do
  check "student -> GET $p" 200 GET "$p" "$STUDENT"
done
check "student -> PATCH /api/me/privacy (hide)" 200 PATCH /api/me/privacy "$STUDENT" '{"showInDirectory":false}'

echo
echo "== Student: must be rejected =="
check "student -> PATCH privacy with latitude (guard)" 400 PATCH /api/me/privacy "$STUDENT" '{"showInDirectory":true,"latitude":22.3}'
check "student -> POST /api/admin/universities"        403 POST  /api/admin/universities "$STUDENT" '{}'
check "student -> GET /api/admin/summary"              403 GET   /api/admin/summary "$STUDENT"
check "student -> GET /api/mentor/impact"              403 GET   /api/mentor/impact "$STUDENT"
check "student -> GET /api/department/overview"        403 GET   /api/department/overview "$STUDENT"
check "student -> GET /api/me/mentor-profile"          403 GET   /api/me/mentor-profile "$STUDENT"

echo
echo "== Mentor: allowed =="
for p in /api/me /api/directory/map /api/skills /api/me/mentor-profile \
         /api/requests /api/sessions /api/chats /api/notifications \
         /api/opportunities /api/opportunities/mine /api/mentor/impact \
         /api/blocks; do
  check "mentor -> GET $p" 200 GET "$p" "$MENTOR"
done

echo
echo "== Mentor: must be rejected =="
check "mentor -> GET /api/matches"           403 GET /api/matches "$MENTOR"
check "mentor -> GET /api/me/readiness"      403 GET /api/me/readiness "$MENTOR"
check "mentor -> GET /api/admin/summary"     403 GET /api/admin/summary "$MENTOR"

echo
echo "== Department =="
check "dept -> GET /api/me"                       200 GET /api/me "$DEPT"
check "dept -> GET /api/directory/map"            200 GET /api/directory/map "$DEPT"
check "dept -> GET /api/department/overview"      200 GET /api/department/overview "$DEPT"
check "dept -> GET /api/department/affiliations"  200 GET /api/department/affiliations "$DEPT"
check "dept -> GET /api/admin/summary"            403 GET /api/admin/summary "$DEPT"

echo
echo "== Admin =="
for p in /api/me /api/admin/summary /api/admin/role-requests /api/admin/users \
         /api/admin/opportunities /api/admin/reports /api/admin/audit \
         /api/admin/fairness /api/opportunities; do
  check "admin -> GET $p" 200 GET "$p" "$ADMIN"
done

echo
echo "Summary: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
