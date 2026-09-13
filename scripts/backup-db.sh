#!/usr/bin/env bash
#
# Full backup of the Ageless by Tulee Supabase database.
#
#   bash scripts/backup-db.sh
#
# The project is on the Supabase FREE plan, which has NO automatic backups at all
# (Pro is the first tier with daily backups). This script is the backup.
#
# WHY NOT `supabase db dump`
# The Supabase CLI runs pg_dump inside a Docker container, and there is no flag to
# skip it. This machine has no Docker. So we call pg_dump directly, which also
# removes the Docker dependency permanently. Binaries live in tools/pgsql/bin
# (gitignored, portable, no installer) - see backup-setup-plan.md.
#
# WHY auth IS A SEPARATE DUMP, AND WHY IT MATTERS MOST
# A public-schema-only backup looks complete but contains ZERO member accounts.
# Restoring it would leave access_entitlements rows pointing at users that no
# longer exist, so paying members lose their logins with nothing visibly broken
# to explain why. auth.sql is the whole reason this script exists.
#
# WHAT IS COVERED
#   public              the application tables
#   private             structure only - see LIVE CREDENTIALS below
#   supabase_migrations the migration ledger, so a restored project does not try
#                       to re-apply every migration from scratch
#   auth                ONLY users, identities and mfa_factors (data only; the
#                       schema itself is created by Supabase on provisioning)
# Not covered, deliberately: storage, realtime, vault, net, cron and graphql are
# Supabase-managed. The two cron JOBS are recreated by the migrations in
# supabase/migrations, so they come back with the schema.
#
# LIVE CREDENTIALS ARE EXCLUDED ON PURPOSE
# A backup is a file that gets copied around, so it should not carry credentials
# that work right now. Excluded, with what to do on restore:
#
#   auth.refresh_tokens,   live bearer credentials - a leaked dump would let
#   auth.sessions,         someone log straight in as a member. Members simply
#   auth.one_time_tokens   log in again after a restore; resend any invite.
#   public.pathao_tokens   live Pathao API access/refresh tokens. The code
#                          re-fetches them from PATHAO_CLIENT_ID/SECRET, which
#                          live in Edge Function secrets, not the database.
#   private.app_secrets    pathao_batch_secret, in plaintext. Re-insert one row
#                          and set the matching Edge Function secret.
#
# auth.users password hashes ARE kept: they are bcrypt, not directly usable, and
# they are the member accounts - a backup without them is not a backup. The auth
# list is a WHITELIST rather than an exclude-list, so a future Supabase release
# that adds a new token table cannot silently start leaking into the dump.
#
# THE PASSWORD
# Supabase Dashboard > Connect (or /settings/database) - NOT your API keys. It is
# prompted for, never stored, never echoed, and never passed as a command-line
# argument (which would be visible to other processes). Export PGPASSWORD
# beforehand for an unattended run; do not put it anywhere git can see.
#
# THE OUTPUT IS SENSITIVE
# Even with live credentials excluded, dumps still contain customer emails,
# phone numbers, addresses, payment records and bcrypt password hashes.
# backups/ is gitignored. Keep copies off this machine too - a backup that only
# exists on the laptop it backs up is not a backup.
#
# TO RESTORE (into a fresh project), apply in this order:
#   roles.sql  ->  schema.sql  ->  auth.sql  ->  data.sql
# auth before data, so the users that entitlements reference already exist.
# Load the two data files with triggers suppressed, or the pricing and
# entitlement triggers will fire and rewrite the rows you are restoring:
#   psql "$URL" -c 'SET session_replication_role = replica;' -f data.sql

set -euo pipefail

PROJECT_REF="osbaarjfafflzoftojbd"
SCHEMAS=(public private supabase_migrations)

cd "$(dirname "$0")/.."

# ---------------------------------------------------------------- pg_dump ----
PGBIN="tools/pgsql/bin"
if [ -x "${PGBIN}/pg_dump.exe" ]; then
  PG_DUMP="${PGBIN}/pg_dump.exe"; PG_DUMPALL="${PGBIN}/pg_dumpall.exe"
elif command -v pg_dump >/dev/null 2>&1; then
  PG_DUMP="pg_dump"; PG_DUMPALL="pg_dumpall"
else
  echo "pg_dump not found." >&2
  echo "Expected ${PGBIN}/pg_dump.exe - see backup-setup-plan.md to set it up." >&2
  exit 1
fi

# pg_dump must be the same version as the server or newer. Warn rather than fail:
# a mismatch usually still works, and refusing to back up is the worse outcome.
SERVER_VER="$(cat supabase/.temp/postgres-version 2>/dev/null || echo unknown)"
DUMP_VER="$("$PG_DUMP" --version | grep -oE '[0-9]+\.[0-9]+' | head -1)"
echo "pg_dump ${DUMP_VER}  ->  server ${SERVER_VER}"

# ------------------------------------------------------------- connection ----
# Use the SESSION pooler, not db.<ref>.supabase.co: direct connections are
# IPv6-only on the free plan. Port 5432 on the pooler is session mode, which
# pg_dump requires - 6543 is transaction mode and will not work.
# The CLI wrote the correct URL at link time; read it rather than hardcoding, so
# a Supabase-side change does not silently break this.
POOLER_FILE="supabase/.temp/pooler-url"
if [ -f "$POOLER_FILE" ]; then
  RAW="$(tr -d '[:space:]' < "$POOLER_FILE")"
  DB_USER="$(sed -E 's#^[a-z]+://([^:@]+).*#\1#' <<<"$RAW")"
  DB_HOST="$(sed -E 's#^[a-z]+://[^@]+@([^:/]+).*#\1#' <<<"$RAW")"
  DB_PORT="$(sed -E 's#.*@[^:/]+:([0-9]+)/.*#\1#' <<<"$RAW")"
  DB_NAME="$(sed -E 's#.*/([^/?]+)$#\1#' <<<"$RAW")"
else
  echo "No ${POOLER_FILE}. Run: npx supabase link --project-ref ${PROJECT_REF}" >&2
  exit 1
fi
[ -n "${DB_PORT:-}" ] || DB_PORT=5432
[ -n "${DB_NAME:-}" ] || DB_NAME=postgres

echo "Connecting as ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

if [ -z "${PGPASSWORD:-}" ]; then
  PGPASSWORD="${SUPABASE_DB_PASSWORD:-}"
fi
if [ -z "${PGPASSWORD:-}" ]; then
  # Prompted, not passed as an argument: command lines are visible to other
  # processes, environment variables of a running process are not.
  printf 'Database password: ' >&2
  read -rs PGPASSWORD
  printf '\n' >&2
fi
export PGPASSWORD
export PGSSLMODE=require
export PGCONNECT_TIMEOUT=20

STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="backups/${STAMP}"
mkdir -p "$OUT"
echo "Backing up ${PROJECT_REF} -> ${OUT}"
echo

CONN=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME")
SCHEMA_ARGS=(); for s in "${SCHEMAS[@]}"; do SCHEMA_ARGS+=(-n "$s"); done

# ------------------------------------------------------------------ dumps ----
# NOTE: privileges are deliberately NOT excluded. The column-level REVOKEs on
# orders (gateway_meta, risk_level, card_no, ...) are a security control, and
# --no-privileges would quietly drop them from the restored database.
dump() {
  local label="$1" file="$2" optional="$3"; shift 3
  printf '  %-22s' "$label"
  if "$@" -f "${OUT}/${file}" 2>"${OUT}/.err"; then
    printf 'ok  (%s bytes)\n' "$(wc -c <"${OUT}/${file}" | tr -d ' ')"
  elif [ "$optional" = optional ]; then
    printf 'skipped (not permitted on hosted Supabase - not needed for restore)\n'
    rm -f "${OUT}/${file}"
  else
    printf 'FAILED\n\n'; cat "${OUT}/.err" >&2; exit 1
  fi
}

# Roles are managed by Supabase and a new project provisions its own, so this is
# best-effort and must never block the three dumps that matter.
# Tables whose rows are live credentials. Structure is kept, contents are not.
NO_DATA=(--exclude-table-data=public.pathao_tokens
         --exclude-table-data=private.app_secrets)

# Whitelist, not a blacklist: only these auth tables are the accounts themselves.
# Everything else in auth is sessions, refresh tokens and one-time tokens.
AUTH_TABLES=(-t auth.users -t auth.identities -t auth.mfa_factors)

dump "roles"           roles.sql  optional "$PG_DUMPALL" "${CONN[@]}" --roles-only
dump "schema"          schema.sql required "$PG_DUMP" "${CONN[@]}" --schema-only "${SCHEMA_ARGS[@]}"
dump "app data"        data.sql   required "$PG_DUMP" "${CONN[@]}" --data-only  "${SCHEMA_ARGS[@]}" "${NO_DATA[@]}"
dump "auth (accounts)" auth.sql   required "$PG_DUMP" "${CONN[@]}" --data-only "${AUTH_TABLES[@]}"

rm -f "${OUT}/.err"
echo

# --------------------------------------------------------------- verify ------
# A dump can succeed and still be hollow, so count actual rows inside the COPY
# blocks rather than trusting exit codes or the mere presence of a table name.
rows() {  # rows <file> <schema.table>
  awk -v t="COPY $2 " '
    index($0, t) == 1 { inblock = 1; next }
    inblock && $0 == "\\." { inblock = 0 }
    inblock { n++ }
    END { print n + 0 }' "$1" 2>/dev/null || echo 0
}

echo "Verifying:"
fail=0

u=$(rows "${OUT}/auth.sql" "auth.users")
if [ "$u" -gt 0 ]; then
  echo "  auth.users              ${u} accounts"
else
  echo "  auth.users              NO ACCOUNTS - members would not survive a restore"
  fail=1
fi

for t in access_entitlements preorders bkash_payments orders discount_codes; do
  n=$(rows "${OUT}/data.sql" "public.${t}")
  printf '  public.%-17s %s rows\n' "$t" "$n"
done

e=$(rows "${OUT}/data.sql" "public.access_entitlements")
[ "$e" -gt 0 ] || { echo "  access_entitlements is EMPTY - paid access would be lost"; fail=1; }

i=$(rows "${OUT}/auth.sql" "auth.identities")
echo "  auth.identities         ${i} rows"

# Guard the exclusions. If a future edit or a Supabase change lets live
# credentials back into the dump, fail here rather than shipping the file.
echo
echo "Checking no live credentials leaked in:"
for pair in "auth.sql:auth.refresh_tokens" "auth.sql:auth.sessions" \
            "auth.sql:auth.one_time_tokens" "auth.sql:auth.flow_state" \
            "data.sql:public.pathao_tokens" "data.sql:private.app_secrets"; do
  f="${pair%%:*}"; t="${pair#*:}"
  n=$(rows "${OUT}/${f}" "$t")
  if [ "$n" -gt 0 ]; then
    echo "  LEAK: ${t} has ${n} rows in ${f}"
    fail=1
  fi
done
[ "$fail" -eq 0 ] && echo "  clean - no session, refresh, one-time or API tokens in the dump"

if grep -q "CREATE POLICY" "${OUT}/schema.sql" 2>/dev/null; then
  echo "  schema.sql              includes RLS policies"
else
  echo "  schema.sql              NO RLS POLICIES - restoring this would expose every table"
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
