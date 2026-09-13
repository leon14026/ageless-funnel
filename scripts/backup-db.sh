#!/usr/bin/env bash
#
# Full backup of the Ageless by Tulee Supabase database.
#
#   bash scripts/backup-db.sh
#
# The project is on the Supabase FREE plan, which has NO automatic backups at all
# (Pro is the first tier with daily backups). This script is the backup.
#
# WHY FOUR DUMPS, AND WHY auth MATTERS
# `supabase db dump` EXCLUDES the auth schema by default. A dump without it looks
# complete but contains zero member accounts: restoring it would leave
# access_entitlements rows pointing at users that no longer exist, so your paying
# members would lose their logins with nothing obviously broken to explain why.
# auth.sql is the whole reason this script exists rather than a single command.
#
# THE PASSWORD
# The Supabase CLI asks for the database password (Dashboard > Project Settings >
# Database - not your API keys). It is never stored here. For an unattended run,
# export SUPABASE_DB_PASSWORD in your shell first; do not put it in a file that
# git can see.
#
# THE OUTPUT IS SENSITIVE
# Dumps contain customer emails, phone numbers, addresses and payment records.
# backups/ is gitignored. Keep copies off this machine too - a backup that only
# exists on the laptop it backs up is not a backup.
#
# TO RESTORE (into a fresh project), apply in this order:
#   roles.sql  ->  schema.sql  ->  auth.sql  ->  data.sql
# auth before data, so the users that entitlements reference already exist.

set -euo pipefail

PROJECT_REF="osbaarjfafflzoftojbd"

cd "$(dirname "$0")/.."
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="backups/${STAMP}"
mkdir -p "$OUT"

SUPABASE="npx --yes supabase"

echo "Backing up ${PROJECT_REF} -> ${OUT}"
echo

if [ ! -f "supabase/.temp/project-ref" ]; then
  echo "Project not linked yet. Running link (one time)..."
  $SUPABASE link --project-ref "$PROJECT_REF"
  echo
fi

dump() {
  local label="$1"; local file="$2"; shift 2
  printf '  %-22s' "$label"
  if $SUPABASE db dump --linked -f "${OUT}/${file}" "$@" >/dev/null 2>"${OUT}/.err"; then
    printf 'ok  (%s)\n' "$(wc -c <"${OUT}/${file}" | tr -d ' ') bytes"
  else
    printf 'FAILED\n\n'
    cat "${OUT}/.err" >&2
    exit 1
  fi
}

dump "roles"          roles.sql  --role-only
dump "schema"         schema.sql
dump "public data"    data.sql   --data-only
dump "auth (accounts)" auth.sql  --schema auth --data-only

rm -f "${OUT}/.err"
echo

# A dump that ran without error can still be hollow. Check the things whose loss
# would be silent and unrecoverable, rather than trusting the exit codes above.
echo "Verifying:"
fail=0

users=$(grep -c "INSERT INTO \"\?auth\"\?\.\"\?users\|COPY auth\.users" "${OUT}/auth.sql" 2>/dev/null || true)
if [ "${users:-0}" -eq 0 ]; then
  echo "  auth.sql            NO USER DATA - members would not survive a restore"
  fail=1
else
  echo "  auth.sql            contains auth.users"
fi

for t in access_entitlements preorders bkash_payments orders; do
  if grep -q "$t" "${OUT}/data.sql" 2>/dev/null; then
    echo "  data.sql            contains ${t}"
  else
    echo "  data.sql            MISSING ${t}"
    fail=1
  fi
done

if grep -q "CREATE TABLE" "${OUT}/schema.sql" 2>/dev/null; then
  echo "  schema.sql          contains table definitions"
else
  echo "  schema.sql          NO TABLE DEFINITIONS"
  fail=1
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "Backup is INCOMPLETE. Do not rely on it."
  exit 1
fi

echo "Backup complete: ${OUT}"
du -sh "$OUT" 2>/dev/null | awk '{print "Total: " $1}'
echo
echo "Now copy ${OUT} somewhere off this machine."
