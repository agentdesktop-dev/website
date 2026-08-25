#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: generate-pki.sh CONTROLLER_HOSTNAME [OUTPUT_DIRECTORY]

Creates a private controller CA, device issuing CA, PostgreSQL CA/server
certificate, and gateway JWT key. Existing files are never overwritten.
Set CONTROLLER_DNS_ALIASES to a comma-separated list to add CNAME aliases to
the controller certificate's subject alternative names.
EOF
}

if (( $# < 1 || $# > 2 )); then
  usage >&2
  exit 2
fi

controller_hostname="$1"
output_directory="${2:-./agentdesktop-pki}"

if [[ ! "$controller_hostname" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ || "$controller_hostname" != *.* || "$controller_hostname" == *..* ]]; then
  printf 'Invalid controller hostname: %s\n' "$controller_hostname" >&2
  exit 1
fi

controller_subject_alt_names="DNS:$controller_hostname"
if [[ -n "${CONTROLLER_DNS_ALIASES:-}" ]]; then
  IFS=',' read -r -a controller_aliases <<<"$CONTROLLER_DNS_ALIASES"
  for controller_alias in "${controller_aliases[@]}"; do
    if [[ ! "$controller_alias" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ || "$controller_alias" != *.* || "$controller_alias" == *..* ]]; then
      printf 'Invalid controller DNS alias: %s\n' "$controller_alias" >&2
      exit 1
    fi
    controller_subject_alt_names+=",DNS:$controller_alias"
  done
fi

if ! command -v openssl >/dev/null 2>&1; then
  printf 'openssl is required.\n' >&2
  exit 1
fi

artifacts=(
  controller-ca-key.pem
  controller-ca.pem
  controller-key.pem
  controller.pem
  device-ca-key.pem
  device-ca.pem
  postgres-ca-key.pem
  postgres-ca.pem
  postgres-key.pem
  postgres.pem
  gateway-jwt-key.pem
)

mkdir -p "$output_directory"
for artifact in "${artifacts[@]}"; do
  if [[ -e "$output_directory/$artifact" ]]; then
    printf 'Refusing to overwrite %s\n' "$output_directory/$artifact" >&2
    exit 1
  fi
done

umask 077
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

create_ca() {
  local common_name="$1"
  local key_file="$2"
  local certificate_file="$3"

  openssl genpkey \
    -algorithm RSA \
    -pkeyopt rsa_keygen_bits:3072 \
    -out "$key_file" >/dev/null 2>&1
  openssl req \
    -x509 \
    -new \
    -sha256 \
    -days 3650 \
    -key "$key_file" \
    -subj "/CN=$common_name" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "subjectKeyIdentifier=hash" \
    -out "$certificate_file" >/dev/null 2>&1
}

create_server_certificate() {
  local common_name="$1"
  local subject_alt_names="$2"
  local ca_key_file="$3"
  local ca_certificate_file="$4"
  local key_file="$5"
  local certificate_file="$6"
  local prefix="$7"

  openssl genpkey \
    -algorithm RSA \
    -pkeyopt rsa_keygen_bits:3072 \
    -out "$key_file" >/dev/null 2>&1
  openssl req \
    -new \
    -sha256 \
    -key "$key_file" \
    -subj "/CN=$common_name" \
    -out "$workdir/$prefix.csr" >/dev/null 2>&1
  cat >"$workdir/$prefix.ext" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=${subject_alt_names}
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF
  openssl x509 \
    -req \
    -sha256 \
    -days 397 \
    -in "$workdir/$prefix.csr" \
    -CA "$ca_certificate_file" \
    -CAkey "$ca_key_file" \
    -CAcreateserial \
    -extfile "$workdir/$prefix.ext" \
    -out "$certificate_file" >/dev/null 2>&1
}

controller_ca_key="$output_directory/controller-ca-key.pem"
controller_ca_certificate="$output_directory/controller-ca.pem"
controller_key="$output_directory/controller-key.pem"
controller_leaf="$workdir/controller-leaf.pem"

create_ca "agentdesktop Controller CA" "$controller_ca_key" "$controller_ca_certificate"
create_server_certificate \
  "$controller_hostname" \
  "$controller_subject_alt_names" \
  "$controller_ca_key" \
  "$controller_ca_certificate" \
  "$controller_key" \
  "$controller_leaf" \
  controller
cat "$controller_leaf" "$controller_ca_certificate" >"$output_directory/controller.pem"

create_ca \
  "agentdesktop Device Issuing CA" \
  "$output_directory/device-ca-key.pem" \
  "$output_directory/device-ca.pem"

postgres_ca_key="$output_directory/postgres-ca-key.pem"
postgres_ca_certificate="$output_directory/postgres-ca.pem"
create_ca "agentdesktop PostgreSQL CA" "$postgres_ca_key" "$postgres_ca_certificate"
create_server_certificate \
  "postgres.agentdesktop.svc.cluster.local" \
  "DNS:postgres,DNS:postgres.agentdesktop,DNS:postgres.agentdesktop.svc,DNS:postgres.agentdesktop.svc.cluster.local" \
  "$postgres_ca_key" \
  "$postgres_ca_certificate" \
  "$output_directory/postgres-key.pem" \
  "$output_directory/postgres.pem" \
  postgres

openssl genpkey \
  -algorithm RSA \
  -pkeyopt rsa_keygen_bits:3072 \
  -out "$output_directory/gateway-jwt-key.pem" >/dev/null 2>&1

chmod 0600 "$output_directory"/*-key.pem
chmod 0644 "$output_directory"/*.pem
chmod 0600 "$output_directory"/*-key.pem

openssl verify -CAfile "$controller_ca_certificate" "$controller_leaf" >/dev/null
openssl x509 -in "$controller_leaf" -noout -checkhost "$controller_hostname" >/dev/null
if [[ -n "${CONTROLLER_DNS_ALIASES:-}" ]]; then
  for controller_alias in "${controller_aliases[@]}"; do
    openssl x509 -in "$controller_leaf" -noout -checkhost "$controller_alias" >/dev/null
  done
fi
openssl verify -CAfile "$postgres_ca_certificate" "$output_directory/postgres.pem" >/dev/null
openssl x509 -in "$output_directory/postgres.pem" -noout -checkhost postgres.agentdesktop.svc.cluster.local >/dev/null
openssl x509 -in "$output_directory/device-ca.pem" -noout -purpose | grep -q 'SSL client CA : Yes'

printf 'Created private deployment PKI in %s\n' "$output_directory"
printf 'Distribute %s/controller-ca.pem through MDM as the controller trust root.\n' "$output_directory"