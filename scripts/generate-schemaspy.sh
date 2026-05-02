#!/usr/bin/env bash
set -euo pipefail

portal_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
public_root="${portal_root}/public"
schemaspy_root="${public_root}/schemaspy"
tools_root="${portal_root}/tools/schemaspy"

schemaspy_version="${SCHEMASPY_VERSION:-7.0.2}"
jdbc_version="${POSTGRES_JDBC_VERSION:-42.7.11}"

schemaspy_jar="${SCHEMASPY_JAR:-${tools_root}/schemaspy-app.jar}"
jdbc_jar="${POSTGRES_JDBC_JAR:-${tools_root}/postgresql.jar}"

db_host="${SCHEMASPY_DB_HOST:-127.0.0.1}"
db_port="${SCHEMASPY_DB_PORT:-5432}"
db_name="${SCHEMASPY_DB_NAME:-parthenon}"
db_user="${SCHEMASPY_DB_USER:-smudoshi}"
db_password="${SCHEMASPY_DB_PASSWORD:-${PGPASSWORD:-}}"
schema_list="${SCHEMASPY_SCHEMAS:-app omop vocab}"
schema_list="${schema_list//,/ }"

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'schemaspy generation failed: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

download_if_missing() {
  local target="$1"
  local url="$2"

  if [[ -s "${target}" ]]; then
    return
  fi

  mkdir -p "$(dirname "${target}")"
  log "Downloading ${url}"
  curl -fL --retry 3 --retry-delay 2 -o "${target}" "${url}"
}

require_command java
require_command dot
require_command psql
require_command node
require_command curl

[[ -n "${db_password}" ]] || fail "set SCHEMASPY_DB_PASSWORD or PGPASSWORD"

download_if_missing \
  "${schemaspy_jar}" \
  "https://github.com/schemaspy/schemaspy/releases/download/v${schemaspy_version}/schemaspy-app.jar"

download_if_missing \
  "${jdbc_jar}" \
  "https://repo1.maven.org/maven2/org/postgresql/postgresql/${jdbc_version}/postgresql-${jdbc_version}.jar"

chmod 0644 "${schemaspy_jar}" "${jdbc_jar}"
mkdir -p "${schemaspy_root}"

IFS=' ' read -r -a schemas <<< "${schema_list}"
[[ "${#schemas[@]}" -gt 0 ]] || fail "no schemas requested"

export PGPASSWORD="${db_password}"
for schema in "${schemas[@]}"; do
  [[ -n "${schema}" ]] || continue
  output="${schemaspy_root}/${schema}"
  case "${output}" in
    "${schemaspy_root}"/*) ;;
    *) fail "refusing to write outside ${schemaspy_root}: ${output}" ;;
  esac

  log "Generating SchemaSpy report for ${db_name}.${schema}"
  rm -rf "${output:?}"
  mkdir -p "${output}"

  java -jar "${schemaspy_jar}" \
    -t pgsql11 \
    -dp "${jdbc_jar}" \
    -host "${db_host}" \
    -port "${db_port}" \
    -db "${db_name}" \
    -s "${schema}" \
    -u "${db_user}" \
    -p "${db_password}" \
    -o "${output}" \
    -norows \
    -imageformat svg \
    -desc "Parthenon ${schema} schema metadata analysis"
done

SCHEMASPY_SCHEMAS="${schema_list}" \
SCHEMASPY_DB_HOST="${db_host}" \
SCHEMASPY_DB_PORT="${db_port}" \
SCHEMASPY_DB_NAME="${db_name}" \
SCHEMASPY_DB_USER="${db_user}" \
SCHEMASPY_DB_PASSWORD="${db_password}" \
  node "${portal_root}/scripts/generate-schemaspy-manifest.js"

find "${schemaspy_root}" -type d -exec chmod 0755 {} +
find "${schemaspy_root}" -type f -exec chmod 0644 {} +

log "SchemaSpy reports are available under ${schemaspy_root}"
