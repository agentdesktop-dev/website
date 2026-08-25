#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: render-intune-bootstrap.sh CONTROLLER_HOSTNAME CONTROLLER_CA [OUTPUT]

Renders an idempotent Intune macOS root script. The generated script writes the
agentdesktop bootstrap and public controller CA, restarts an installed daemon
when content changes, and adds the current console user to the local
agentdesktop group.
EOF
}

if (( $# < 2 || $# > 3 )); then
  usage >&2
  exit 2
fi

controller_hostname="$1"
controller_ca="$2"
output="${3:-./agentdesktop-bootstrap.sh}"

if [[ ! "$controller_hostname" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ || "$controller_hostname" != *.* || "$controller_hostname" == *..* ]]; then
  printf 'Invalid lowercase fully qualified hostname: %s\n' "$controller_hostname" >&2
  exit 1
fi

if [[ ! -s "$controller_ca" ]]; then
  printf 'Controller CA does not exist or is empty: %s\n' "$controller_ca" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  printf 'openssl is required.\n' >&2
  exit 1
fi

openssl x509 -in "$controller_ca" -noout >/dev/null
if ! openssl x509 -in "$controller_ca" -noout -text | grep -q 'CA:TRUE'; then
  printf 'Controller CA is not a CA certificate: %s\n' "$controller_ca" >&2
  exit 1
fi

output_directory="$(dirname -- "$output")"
mkdir -p "$output_directory"
temporary="$(mktemp "${output}.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
umask 077

cat >"$temporary" <<EOF
#!/bin/sh
set -eu

CONFIG_DIR=/etc/agentdesktop
CONFIG_PATH="\${CONFIG_DIR}/config.yaml"
CA_PATH="\${CONFIG_DIR}/controller-ca.pem"
changed=0

write_managed_file() {
  target="\$1"
  mode="\$2"
  temporary=\$(/usr/bin/mktemp "\${target}.XXXXXX")
  /bin/cat >"\${temporary}"

  if [ -f "\${target}" ] && /usr/bin/cmp -s "\${temporary}" "\${target}"; then
    /bin/rm -f "\${temporary}"
    /usr/sbin/chown root:wheel "\${target}"
    /bin/chmod "\${mode}" "\${target}"
    return
  fi

  /usr/sbin/chown root:wheel "\${temporary}"
  /bin/chmod "\${mode}" "\${temporary}"
  /bin/mv -f "\${temporary}" "\${target}"
  changed=1
}

/usr/bin/install -d -o root -g wheel -m 0755 "\${CONFIG_DIR}"

write_managed_file "\${CONFIG_PATH}" 0600 <<'YAML'
controller:
  address: https://${controller_hostname}
  caCertificatePath: /etc/agentdesktop/controller-ca.pem
  heartbeatInterval: 30s
YAML

write_managed_file "\${CA_PATH}" 0644 <<'PEM'
EOF

cat "$controller_ca" >>"$temporary"
printf '\n' >>"$temporary"

cat >>"$temporary" <<'EOF'
PEM

if [ "${changed}" -eq 1 ] &&
  /bin/launchctl print system/dev.agentdesktop.daemon >/dev/null 2>&1; then
  /bin/launchctl kickstart -k system/dev.agentdesktop.daemon
fi

console_user=$(/usr/bin/stat -f '%Su' /dev/console)
case "${console_user}" in
  "" | root | loginwindow | _mbsetupuser) ;;
  *)
    if ! /usr/sbin/dseditgroup -o checkmember -m "${console_user}" \
      agentdesktop 2>/dev/null | /usr/bin/grep -q 'yes'; then
      /usr/sbin/dseditgroup -o edit -a "${console_user}" -t user agentdesktop
    fi
    ;;
esac
EOF

chmod 0755 "$temporary"
mv -f "$temporary" "$output"
trap - EXIT
sh -n "$output"

printf 'Rendered Intune macOS bootstrap: %s\n' "$output"