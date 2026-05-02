#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-/home/smudoshi/Github/Parthenon}"
portal_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${portal_root}/public/reference"

install -d -m 0755 "${target}"

"${portal_root}/scripts/generate-reference-manifest.js" "${repo_root}"

printf 'reference docs synced to %s\n' "${target}"
