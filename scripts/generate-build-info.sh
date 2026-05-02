#!/usr/bin/env bash
# Generate public/build-info.json with git provenance for the portal.
# - portal SHA + branch + dirty flag (this repo)
# - parthenon SHA + branch (the upstream content repo, optional)
# - timestamp + host
# Safe to run before the portal repo has any commits — fields fall back gracefully.
set -euo pipefail

portal_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
public_root="${portal_root}/public"
parthenon_root="${1:-${PARTHENON_ROOT:-/home/smudoshi/Github/Parthenon}}"

git_field() {
  local repo="$1"
  shift
  if [[ -d "${repo}/.git" ]] || git -C "${repo}" rev-parse --git-dir >/dev/null 2>&1; then
    git -C "${repo}" "$@" 2>/dev/null || printf ''
  else
    printf ''
  fi
}

git_dirty() {
  local repo="$1"
  if ! git -C "${repo}" rev-parse --git-dir >/dev/null 2>&1; then
    printf 'false'
    return
  fi
  if [[ -n "$(git -C "${repo}" status --porcelain 2>/dev/null)" ]]; then
    printf 'true'
  else
    printf 'false'
  fi
}

portal_sha="$(git_field "${portal_root}" rev-parse HEAD)"
portal_short="$(git_field "${portal_root}" rev-parse --short=12 HEAD)"
portal_branch="$(git_field "${portal_root}" rev-parse --abbrev-ref HEAD)"
portal_dirty="$(git_dirty "${portal_root}")"
portal_subject="$(git_field "${portal_root}" log -1 --pretty=%s)"
portal_committed_at="$(git_field "${portal_root}" log -1 --pretty=%cI)"

parthenon_sha="$(git_field "${parthenon_root}" rev-parse HEAD)"
parthenon_short="$(git_field "${parthenon_root}" rev-parse --short=12 HEAD)"
parthenon_branch="$(git_field "${parthenon_root}" rev-parse --abbrev-ref HEAD)"

generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
host="$(hostname -s 2>/dev/null || hostname)"

install -d -m 0755 "${public_root}"

# Use Node for JSON to keep escaping correct.
PORTAL_SHA="${portal_sha}" \
PORTAL_SHORT="${portal_short}" \
PORTAL_BRANCH="${portal_branch}" \
PORTAL_DIRTY="${portal_dirty}" \
PORTAL_SUBJECT="${portal_subject}" \
PORTAL_COMMITTED_AT="${portal_committed_at}" \
PARTHENON_SHA="${parthenon_sha}" \
PARTHENON_SHORT="${parthenon_short}" \
PARTHENON_BRANCH="${parthenon_branch}" \
GENERATED_AT="${generated_at}" \
HOST="${host}" \
node -e '
  const out = {
    generatedAt: process.env.GENERATED_AT,
    host: process.env.HOST,
    portal: {
      gitSha: process.env.PORTAL_SHA || null,
      gitShaShort: process.env.PORTAL_SHORT || null,
      gitBranch: process.env.PORTAL_BRANCH || null,
      gitDirty: process.env.PORTAL_DIRTY === "true",
      lastCommitSubject: process.env.PORTAL_SUBJECT || null,
      lastCommittedAt: process.env.PORTAL_COMMITTED_AT || null,
    },
    parthenon: {
      gitSha: process.env.PARTHENON_SHA || null,
      gitShaShort: process.env.PARTHENON_SHORT || null,
      gitBranch: process.env.PARTHENON_BRANCH || null,
    },
    // Top-level convenience fields used by the portal footer renderer.
    gitSha: process.env.PORTAL_SHA || process.env.PARTHENON_SHA || null,
    gitBranch: process.env.PORTAL_BRANCH || null,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
' > "${public_root}/build-info.json"

chmod 0644 "${public_root}/build-info.json"
printf 'wrote %s\n' "${public_root}/build-info.json"
