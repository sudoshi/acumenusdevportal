#!/usr/bin/env bash
set -euo pipefail

portal_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
public_root="${portal_root}/public"
host="${DEV_PORTAL_HOST:-dev.acumenus.net}"
ip="${DEV_PORTAL_IP:-127.0.0.1}"
base_url="https://${host}"
require_sso="${DEV_PORTAL_REQUIRE_SSO:-1}"

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'smoke failed: %s\n' "$*" >&2
  exit 1
}

repair_permissions() {
  find "${public_root}" -type d -exec chmod 0755 {} +
  find "${public_root}" -type f -exec chmod 0644 {} +
}

require_file() {
  local path="$1"
  [[ -f "${path}" ]] || fail "missing required file ${path}"
  [[ -r "${path}" ]] || fail "required file is not readable ${path}"
}

check_json() {
  local path="$1"
  local expression="$2"
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const expression = process.argv[2];
    const data = JSON.parse(fs.readFileSync(path, "utf8"));
    if (expression === "array" && !Array.isArray(data)) {
      throw new Error(`${path} is not a JSON array`);
    }
    if (expression === "screenshot-manifest" && (!data || !Array.isArray(data.entries))) {
      throw new Error(`${path} does not contain entries[]`);
    }
    if (expression === "reference-manifest" && (!data || !Array.isArray(data.entries) || !data.entries.length)) {
      throw new Error(`${path} does not contain populated reference entries[]`);
    }
    if (expression === "schemaspy-manifest" && (!data || !Array.isArray(data.schemas) || data.schemas.length < 3)) {
      throw new Error(`${path} does not contain populated schemas[]`);
    }
    if (expression === "build-info" && (!data || typeof data.generatedAt !== "string")) {
      throw new Error(`${path} does not contain generatedAt`);
    }
  ' "${path}" "${expression}" || fail "invalid JSON ${path}"
}

check_url() {
  local path="$1"
  local expected_type="$2"
  local tmp
  local meta
  local code
  local content_type

  tmp="$(mktemp)"
  meta="$(curl -k -sS --noproxy '*' --resolve "${host}:443:${ip}" -o "${tmp}" -w '%{http_code} %{content_type}' "${base_url}${path}")" || {
    rm -f "${tmp}"
    fail "curl failed for ${path}"
  }
  code="${meta%% *}"
  content_type="${meta#* }"

  if [[ "${code}" != "200" ]]; then
    rm -f "${tmp}"
    fail "${path} returned ${code}"
  fi

  if [[ -n "${expected_type}" && "${content_type}" != *"${expected_type}"* ]]; then
    rm -f "${tmp}"
    fail "${path} returned content type ${content_type}, expected ${expected_type}"
  fi

  rm -f "${tmp}"
  log "ok ${path} ${code} ${content_type}"
}

check_protected_url() {
  local path="$1"
  local tmp
  local meta
  local code
  local redirect_url

  tmp="$(mktemp)"
  meta="$(curl -k -sS --noproxy '*' --resolve "${host}:443:${ip}" -o "${tmp}" -w '%{http_code} %{redirect_url}' "${base_url}${path}")" || {
    rm -f "${tmp}"
    fail "curl failed for protected path ${path}"
  }
  code="${meta%% *}"
  redirect_url="${meta#* }"

  if [[ "${code}" != "302" && "${code}" != "303" ]]; then
    rm -f "${tmp}"
    fail "${path} returned ${code}; expected an Authentik redirect"
  fi

  if [[ "${redirect_url}" != https://auth.acumenus.net/application/o/authorize/* ]]; then
    rm -f "${tmp}"
    fail "${path} redirected to ${redirect_url}; expected Authentik authorize endpoint"
  fi

  rm -f "${tmp}"
  log "ok ${path} protected by Authentik (${code})"
}

repair_permissions

require_file "${public_root}/index.html"
require_file "${public_root}/assets/styles.css"
require_file "${public_root}/assets/schemaspy-portal.css"
require_file "${public_root}/assets/app.js"
require_file "${public_root}/build-info.json"
require_file "${public_root}/graphify/catalog.json"
require_file "${public_root}/screenshots/application-library/manifest.json"
require_file "${public_root}/reference/manifest.json"
require_file "${public_root}/schemaspy/manifest.json"
require_file "${public_root}/schemaspy/app/index.html"
require_file "${public_root}/schemaspy/app/analysis.html"
require_file "${public_root}/schemaspy/omop/index.html"
require_file "${public_root}/schemaspy/omop/analysis.html"
require_file "${public_root}/schemaspy/vocab/index.html"
require_file "${public_root}/schemaspy/vocab/analysis.html"

check_json "${public_root}/graphify/catalog.json" "array"
check_json "${public_root}/screenshots/application-library/manifest.json" "screenshot-manifest"
check_json "${public_root}/reference/manifest.json" "reference-manifest"
check_json "${public_root}/schemaspy/manifest.json" "schemaspy-manifest"
check_json "${public_root}/build-info.json" "build-info"

if [[ "${require_sso}" == "1" ]]; then
  check_protected_url "/"
  check_protected_url "/assets/app.js"
  check_protected_url "/graphify/catalog.json"
  check_protected_url "/screenshots/application-library/manifest.json"
  check_protected_url "/reference/manifest.json"
  check_protected_url "/schemaspy/manifest.json"
  check_protected_url "/graphify/"
  check_protected_url "/screenshots/application-library/"
  check_protected_url "/schemaspy/"
else
  check_url "/" "text/html"
  check_url "/assets/styles.css" "text/css"
  check_url "/assets/app.js" "javascript"
  check_url "/graphify/catalog.json" "application/json"
  check_url "/screenshots/application-library/manifest.json" "application/json"
  check_url "/reference/manifest.json" "application/json"
  check_url "/schemaspy/manifest.json" "application/json"
  check_url "/graphify/" "text/html"
  check_url "/screenshots/application-library/" "text/html"
  check_url "/schemaspy/" "text/html"
  check_url "/schemaspy/app/" "text/html"
  check_url "/schemaspy/app/analysis.html" "text/html"
  check_url "/schemaspy/omop/" "text/html"
  check_url "/schemaspy/omop/analysis.html" "text/html"
  check_url "/schemaspy/vocab/" "text/html"
  check_url "/schemaspy/vocab/analysis.html" "text/html"
fi

log "dev portal smoke checks passed for ${base_url}"
