#!/usr/bin/env bash
# Install + enable the periodic portal-refresh timer.
# Idempotent: copies unit files into /etc/systemd/system, reloads, enables, starts.
set -euo pipefail

systemd_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target_dir="/etc/systemd/system"
service="dev-portal-refresh.service"
timer="dev-portal-refresh.timer"

if [[ ! -f "${systemd_dir}/${service}" ]] || [[ ! -f "${systemd_dir}/${timer}" ]]; then
  printf 'install: missing unit files in %s\n' "${systemd_dir}" >&2
  exit 1
fi

# Use sudo -A (askpass) per project convention.
SUDO="${SUDO:-sudo -A}"

${SUDO} install -m 0644 "${systemd_dir}/${service}" "${target_dir}/${service}"
${SUDO} install -m 0644 "${systemd_dir}/${timer}" "${target_dir}/${timer}"
${SUDO} systemctl daemon-reload
${SUDO} systemctl enable --now "${timer}"

printf '\ninstalled %s\n' "${target_dir}/${service}"
printf 'installed %s\n' "${target_dir}/${timer}"
printf '\nstatus:\n'
${SUDO} systemctl status --no-pager "${timer}" || true
printf '\nnext run:\n'
${SUDO} systemctl list-timers --no-pager "${timer}" || true
