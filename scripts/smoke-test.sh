#!/usr/bin/env bash
# User-journey smoke test: health -> version -> sign up -> session -> patient API -> logout.
# Usage: scripts/smoke-test.sh [base_url]
set -euo pipefail
BASE="${1:-http://localhost:8080}"
JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
EMAIL="smoke-$(date +%s)-$RANDOM@example.test"

check() { # name, expected status, curl args...
  local name=$1 want=$2; shift 2
  local got; got=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" "$@")
  if [[ "$got" == "$want" ]]; then echo "PASS $name ($got)"; else echo "FAIL $name (got $got, want $want)"; exit 1; fi
}

echo "Target: $BASE  version: $(curl -s "$BASE/api/version")"
check "liveness"              200 "$BASE/api/health"
check "readiness (database)"  200 "$BASE/api/ready"
check "sample dashboard"      200 "$BASE/dashboard"
check "sign up patient"       200 -X POST "$BASE/api/auth/signup" -H 'content-type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"smoke-pass-123\",\"role\":\"PATIENT\"}"
check "session is valid"      200 "$BASE/api/auth/me"
check "patient report list"   200 "$BASE/api/patient/reports"
check "doctor-only API denied" 403 "$BASE/api/doctor/reports"
check "logout"                200 -X POST "$BASE/api/auth/logout"
echo "Smoke test passed"
