#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-/home/smudoshi/Github/Parthenon}"
portal_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
public_root="${portal_root}/public"

install -d -m 0755 "${public_root}/graphify" "${public_root}/screenshots"

rsync -a --delete --chmod=D755,F644 --exclude 'cache/' \
  "${repo_root}/graphify-views/" \
  "${public_root}/graphify/"

rsync -a --delete --chmod=D755,F644 \
  "${repo_root}/e2e/screenshots/" \
  "${public_root}/screenshots/"

"${portal_root}/scripts/sync-reference.sh" "${repo_root}"

"${portal_root}/scripts/generate-build-info.sh" "${repo_root}"

find "${public_root}" -type d -exec chmod 0755 {} +
find "${public_root}" -type f -exec chmod 0644 {} +

printf 'portal assets synced under %s\n' "${public_root}"
