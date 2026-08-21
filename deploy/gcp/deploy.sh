#!/usr/bin/env bash
set -euo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
terraform_directory="$script_directory/terraform"
state_file="$script_directory/.env.production"
namespace="agentdesktop"

usage() {
  cat <<'EOF'
Usage: deploy.sh COMMAND

Commands:
  infra       Create or update GCP infrastructure, then print DNS records.
  build       Build and push the local controller image for AMD64 and ARM64.
  install     Install PostgreSQL and the Agentdesktop controller.
  verify      Check workloads, the reserved address, and the TLS endpoint.
  backup      Start an on-demand PostgreSQL backup and wait for completion.
  destroy     Destroy this deployment's Terraform-owned GCP resources.

Configuration is accepted through environment variables. Missing required
values are prompted for unless NONINTERACTIVE=true. See deploy/gcp/README.md.
EOF
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%s is required.\n' "$command_name" >&2
    exit 1
  fi
}

prompt_value() {
  local variable_name="$1"
  local prompt="$2"
  local default_value="${3:-}"
  local current_value="${!variable_name:-}"

  if [[ -n "$current_value" ]]; then
    return
  fi
  if [[ "${NONINTERACTIVE:-false}" == "true" ]]; then
    printf '%s is required when NONINTERACTIVE=true.\n' "$variable_name" >&2
    exit 1
  fi

  if [[ -n "$default_value" ]]; then
    read -r -p "$prompt [$default_value]: " current_value
    current_value="${current_value:-$default_value}"
  else
    read -r -p "$prompt: " current_value
  fi
  if [[ -z "$current_value" ]]; then
    printf '%s is required.\n' "$variable_name" >&2
    exit 1
  fi
  printf -v "$variable_name" '%s' "$current_value"
}

load_state() {
  if [[ ! -f "$state_file" ]]; then
    printf 'Run %s infra first; %s does not exist.\n' "$0" "$state_file" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$state_file"
}

write_state_value() {
  local variable_name="$1"
  local value="$2"
  printf '%s=%q\n' "$variable_name" "$value"
}

yaml_quote() {
  printf '%s' "$1" | jq -Rs .
}

validate_hostname() {
  local hostname="$1"
  if [[ ! "$hostname" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ || "$hostname" != *.* || "$hostname" == *..* ]]; then
    printf 'Invalid lowercase fully qualified hostname: %s\n' "$hostname" >&2
    exit 1
  fi
}

configure_kubectl() {
  gcloud container clusters get-credentials "$CLUSTER_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --quiet >/dev/null
}

terraform_output() {
  terraform -chdir="$terraform_directory" output -raw "$1"
}

state_value() {
  local variable_name="$1"
  local value="$2"
  local temporary_file
  temporary_file="$(mktemp)"

  if [[ -f "$state_file" ]]; then
    grep -v "^${variable_name}=" "$state_file" >"$temporary_file" || true
  fi
  write_state_value "$variable_name" "$value" >>"$temporary_file"
  chmod 0600 "$temporary_file"
  mv "$temporary_file" "$state_file"
}

run_infra() {
  require_command curl
  require_command gcloud
  require_command jq
  require_command terraform

  prompt_value CONTROLLER_HOSTNAME "Controller hostname (for example, agentdesktop.example.com)"
  validate_hostname "$CONTROLLER_HOSTNAME"

  local configured_project
  configured_project="$(gcloud config get-value project 2>/dev/null || true)"
  if [[ "$configured_project" == "(unset)" ]]; then
    configured_project=""
  fi
  prompt_value PROJECT_ID "Existing Google Cloud project ID" "$configured_project"
  prompt_value REGION "Google Cloud region" "us-central1"
  local detected_admin_cidr
  detected_admin_cidr="$(curl -4 --fail --silent --show-error --max-time 10 https://api.ipify.org)/32"
  prompt_value ADMIN_CIDR "Administrator public CIDR allowed to reach the GKE API" "$detected_admin_cidr"
  if [[ ! "$ADMIN_CIDR" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]]; then
    printf 'ADMIN_CIDR must be an IPv4 CIDR.\n' >&2
    exit 1
  fi

  local dns_aliases_json="${CONTROLLER_DNS_ALIASES_JSON:-[]}"
  jq -e 'type == "array" and all(.[]; type == "string")' >/dev/null \
    <<<"$dns_aliases_json"

  gcloud auth application-default print-access-token >/dev/null
  gcloud auth print-access-token >/dev/null

  terraform -chdir="$terraform_directory" init
  TF_VAR_project_id="$PROJECT_ID" \
  TF_VAR_region="$REGION" \
  TF_VAR_controller_hostname="$CONTROLLER_HOSTNAME" \
  TF_VAR_controller_dns_aliases="$dns_aliases_json" \
  TF_VAR_admin_cidr_blocks="[{\"cidr_block\":\"$ADMIN_CIDR\",\"display_name\":\"deployment-admin\"}]" \
    terraform -chdir="$terraform_directory" apply

  CLUSTER_NAME="$(terraform_output cluster_name)"
  CONTROLLER_IPV4_ADDRESS="$(terraform_output controller_ipv4_address)"
  CONTROLLER_ADDRESS_RESOURCE_NAME="$(terraform_output controller_address_resource_name)"
  POSTGRES_BACKUP_BUCKET="$(terraform_output postgres_backup_bucket)"
  POSTGRES_BACKUP_SERVICE_ACCOUNT="$(terraform_output postgres_backup_service_account)"
  CONTROLLER_IMAGE_REPOSITORY="$(terraform_output controller_image_repository)"

  umask 077
  {
    write_state_value PROJECT_ID "$PROJECT_ID"
    write_state_value REGION "$REGION"
    write_state_value CLUSTER_NAME "$CLUSTER_NAME"
    write_state_value CONTROLLER_HOSTNAME "$CONTROLLER_HOSTNAME"
    write_state_value CONTROLLER_DNS_ALIASES_JSON "$dns_aliases_json"
    write_state_value CONTROLLER_IPV4_ADDRESS "$CONTROLLER_IPV4_ADDRESS"
    write_state_value CONTROLLER_ADDRESS_RESOURCE_NAME "$CONTROLLER_ADDRESS_RESOURCE_NAME"
    write_state_value POSTGRES_BACKUP_BUCKET "$POSTGRES_BACKUP_BUCKET"
    write_state_value POSTGRES_BACKUP_SERVICE_ACCOUNT "$POSTGRES_BACKUP_SERVICE_ACCOUNT"
    write_state_value CONTROLLER_IMAGE_REPOSITORY "$CONTROLLER_IMAGE_REPOSITORY"
  } >"$state_file"

  configure_kubectl
  kubectl wait --for=condition=Ready nodes --all --timeout=15m >/dev/null

  printf '\nCreate these records with your existing DNS provider:\n'
  terraform -chdir="$terraform_directory" output -json dns_records | jq .
  printf '\nNo Cloud DNS zone was created or modified. Build and push the local controller image next:\n'
  printf '  AGENTDESKTOP_SOURCE_DIR=/path/to/agentdesktop %s build\n' "$0"
}

run_build() {
  require_command docker
  require_command gcloud
  require_command git
  require_command jq
  require_command kubectl
  load_state

  local default_source_directory
  default_source_directory="$(cd "$script_directory/../../.." && pwd)/agentdesktop"
  prompt_value AGENTDESKTOP_SOURCE_DIR "Agentdesktop source directory" "$default_source_directory"
  if [[ ! -f "$AGENTDESKTOP_SOURCE_DIR/Dockerfile" || ! -f "$AGENTDESKTOP_SOURCE_DIR/Cargo.toml" ]]; then
    printf 'AGENTDESKTOP_SOURCE_DIR is not an Agentdesktop source tree: %s\n' "$AGENTDESKTOP_SOURCE_DIR" >&2
    exit 1
  fi

  configure_kubectl
  kubectl wait --for=condition=Ready nodes --all --timeout=15m >/dev/null

  local source_revision
  local source_suffix
  source_revision="$(git -C "$AGENTDESKTOP_SOURCE_DIR" rev-parse --short=12 HEAD)"
  if [[ -n "$(git -C "$AGENTDESKTOP_SOURCE_DIR" status --porcelain)" ]]; then
    source_suffix="dirty-$(date -u +%Y%m%d%H%M%S)"
  else
    source_suffix="clean"
  fi
  CONTROLLER_IMAGE_TAG="local-${source_revision}-${source_suffix}"
  CONTROLLER_IMAGE="${CONTROLLER_IMAGE_REPOSITORY}:${CONTROLLER_IMAGE_TAG}"

  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

  local builder_name="agentdesktop-multi"
  if ! docker buildx inspect "$builder_name" >/dev/null 2>&1; then
    docker buildx create --name "$builder_name" --driver docker-container >/dev/null
  fi
  docker buildx inspect "$builder_name" --bootstrap >/dev/null
  docker buildx build \
    --builder "$builder_name" \
    --platform linux/amd64,linux/arm64 \
    --provenance=false \
    --push \
    --tag "$CONTROLLER_IMAGE" \
    "$AGENTDESKTOP_SOURCE_DIR"

  local image_inspection
  image_inspection="$(docker buildx imagetools inspect "$CONTROLLER_IMAGE")"
  grep -q 'linux/amd64' <<<"$image_inspection" || {
    printf 'Pushed image is missing linux/amd64.\n' >&2
    exit 1
  }
  grep -q 'linux/arm64' <<<"$image_inspection" || {
    printf 'Pushed image is missing linux/arm64.\n' >&2
    exit 1
  }
  CONTROLLER_IMAGE_DIGEST="$(sed -n 's/^Digest:[[:space:]]*//p' <<<"$image_inspection" | head -n 1)"
  if [[ ! "$CONTROLLER_IMAGE_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]]; then
    printf 'Could not determine the pushed multi-platform image digest.\n' >&2
    exit 1
  fi

  state_value AGENTDESKTOP_SOURCE_DIR "$AGENTDESKTOP_SOURCE_DIR"
  state_value CONTROLLER_IMAGE_TAG "$CONTROLLER_IMAGE_TAG"
  state_value CONTROLLER_IMAGE_DIGEST "$CONTROLLER_IMAGE_DIGEST"

  printf '\nPushed %s\n' "$CONTROLLER_IMAGE"
  printf 'Manifest digest: %s\n' "$CONTROLLER_IMAGE_DIGEST"
  printf 'Platforms: linux/amd64, linux/arm64\n'
  printf 'Register the OIDC client and prepare PKI/policy, then run %s install.\n' "$0"
}

secret_name() {
  local key="$1"
  jq -er --arg key "$key" '.[$key]' <<<"$SECRET_NAMES_JSON"
}

secret_has_enabled_version() {
  local secret_id="$1"
  [[ -n "$(gcloud secrets versions list "$secret_id" \
    --project "$PROJECT_ID" \
    --filter='state=ENABLED' \
    --limit=1 \
    --format='value(name)' 2>/dev/null)" ]]
}

store_secret_file() {
  local secret_key="$1"
  local source_file="$2"
  local required_file="${3:-true}"
  local secret_id

  if [[ ! -f "$source_file" ]]; then
    if [[ "$required_file" == "true" ]]; then
      printf 'Required secret source does not exist: %s\n' "$source_file" >&2
      exit 1
    fi
    return
  fi

  secret_id="$(secret_name "$secret_key")"
  if secret_has_enabled_version "$secret_id"; then
    local current_file="$work_directory/current-$secret_key"
    gcloud secrets versions access latest \
      --secret "$secret_id" \
      --project "$PROJECT_ID" >"$current_file"
    if cmp -s "$source_file" "$current_file"; then
      return
    fi
    if [[ "${ALLOW_SECRET_ROTATION:-false}" != "true" ]]; then
      printf '%s differs from the active Secret Manager value. Set ALLOW_SECRET_ROTATION=true only for a planned rotation.\n' "$source_file" >&2
      exit 1
    fi
  fi

  gcloud secrets versions add "$secret_id" \
    --project "$PROJECT_ID" \
    --data-file "$source_file" >/dev/null
}

get_or_create_postgres_password() {
  local secret_id
  local password_file="$work_directory/postgres-password"
  secret_id="$(secret_name postgres-password)"

  if secret_has_enabled_version "$secret_id"; then
    gcloud secrets versions access latest \
      --secret "$secret_id" \
      --project "$PROJECT_ID"
    return
  fi

  openssl rand -hex 32 >"$password_file"
  gcloud secrets versions add "$secret_id" \
    --project "$PROJECT_ID" \
    --data-file "$password_file" >/dev/null
  tr -d '\n' <"$password_file"
}

validate_oidc() {
  local discovery_file="$work_directory/openid-configuration.json"
  curl --fail --silent --show-error --location \
    "${OIDC_ISSUER%/}/.well-known/openid-configuration" \
    --output "$discovery_file"
  jq -e --arg issuer "$OIDC_ISSUER" '
    .issuer == $issuer and
    (.authorization_endpoint | type == "string") and
    (.token_endpoint | type == "string") and
    (.jwks_uri | type == "string") and
    (.userinfo_endpoint | type == "string")
  ' "$discovery_file" >/dev/null || {
    printf 'OIDC discovery is missing a required endpoint or its issuer does not exactly match %s.\n' "$OIDC_ISSUER" >&2
    exit 1
  }
}

validate_pki() {
  local required_files=(
    controller.pem
    controller-key.pem
    device-ca.pem
    device-ca-key.pem
    postgres-ca.pem
    postgres.pem
    postgres-key.pem
  )
  local file_name
  for file_name in "${required_files[@]}"; do
    if [[ ! -s "$PKI_DIRECTORY/$file_name" ]]; then
      printf 'Required PKI file is missing or empty: %s/%s\n' "$PKI_DIRECTORY" "$file_name" >&2
      exit 1
    fi
  done

  openssl x509 -in "$PKI_DIRECTORY/controller.pem" -noout -checkhost "$CONTROLLER_HOSTNAME" >/dev/null
  local controller_alias
  while IFS= read -r controller_alias; do
    openssl x509 -in "$PKI_DIRECTORY/controller.pem" -noout -checkhost "$controller_alias" >/dev/null
  done < <(jq -r '.[]' <<<"${CONTROLLER_DNS_ALIASES_JSON:-[]}")
  openssl x509 -in "$PKI_DIRECTORY/postgres.pem" -noout -checkhost postgres.agentdesktop.svc.cluster.local >/dev/null
  openssl verify -CAfile "$PKI_DIRECTORY/postgres-ca.pem" "$PKI_DIRECTORY/postgres.pem" >/dev/null

  local certificate_name
  local certificate_key
  local private_key
  for certificate_name in controller device-ca postgres; do
    certificate_key="$(openssl x509 -in "$PKI_DIRECTORY/$certificate_name.pem" -pubkey -noout | openssl sha256)"
    private_key="$(openssl pkey -in "$PKI_DIRECTORY/$certificate_name-key.pem" -pubout | openssl sha256)"
    if [[ "$certificate_key" != "$private_key" ]]; then
      printf '%s.pem does not match %s-key.pem.\n' "$certificate_name" "$certificate_name" >&2
      exit 1
    fi
  done
  if [[ "$ENABLE_GATEWAY_JWT" == "true" ]]; then
    openssl pkey -in "$PKI_DIRECTORY/gateway-jwt-key.pem" -noout >/dev/null
  fi
}

apply_kubernetes_secrets() {
  local password_file="$work_directory/kubernetes-postgres-password"
  printf '%s' "$POSTGRES_PASSWORD" >"$password_file"

  kubectl create namespace "$namespace" \
    --dry-run=client \
    --output=yaml | kubectl apply -f - >/dev/null

  kubectl -n "$namespace" create secret generic agentdesktop-postgres \
    --from-file="POSTGRES_PASSWORD=$password_file" \
    --dry-run=client \
    --output=yaml | kubectl apply -f - >/dev/null

  kubectl -n "$namespace" create secret generic agentdesktop-postgres-tls \
    --from-file="ca.crt=$PKI_DIRECTORY/postgres-ca.pem" \
    --from-file="tls.crt=$PKI_DIRECTORY/postgres.pem" \
    --from-file="tls.key=$PKI_DIRECTORY/postgres-key.pem" \
    --dry-run=client \
    --output=yaml | kubectl apply -f - >/dev/null

  local controller_secret_arguments=(
    -n "$namespace" create secret generic agentdesktop-controller-tls
    --from-file="controller.pem=$PKI_DIRECTORY/controller.pem"
    --from-file="controller-key.pem=$PKI_DIRECTORY/controller-key.pem"
    --from-file="device-ca.pem=$PKI_DIRECTORY/device-ca.pem"
    --from-file="device-ca-key.pem=$PKI_DIRECTORY/device-ca-key.pem"
    --from-file="postgres-ca.pem=$PKI_DIRECTORY/postgres-ca.pem"
  )
  if [[ -f "$PKI_DIRECTORY/controller-ca.pem" ]]; then
    controller_secret_arguments+=(--from-file="controller-ca.pem=$PKI_DIRECTORY/controller-ca.pem")
  fi
  if [[ "$ENABLE_GATEWAY_JWT" == "true" ]]; then
    controller_secret_arguments+=(--from-file="gateway-jwt-key.pem=$PKI_DIRECTORY/gateway-jwt-key.pem")
  fi
  kubectl "${controller_secret_arguments[@]}" \
    --dry-run=client \
    --output=yaml | kubectl apply -f - >/dev/null
}

install_postgres() {
  local values_file="$work_directory/postgres-values.yaml"
  cat >"$values_file" <<EOF
backup:
  bucket: $(yaml_quote "$POSTGRES_BACKUP_BUCKET")
  serviceAccount:
    annotations:
      iam.gke.io/gcp-service-account: $(yaml_quote "$POSTGRES_BACKUP_SERVICE_ACCOUNT")
EOF

  helm upgrade --install postgres "$script_directory/helm/postgresql" \
    --namespace "$namespace" \
    --values "$values_file" \
    --atomic \
    --timeout 15m
  kubectl -n "$namespace" rollout status deployment/postgres --timeout=10m
}

create_controller_config() {
  local database_url
  local controller_config="$work_directory/controller.yaml"
  database_url="postgresql://agentdesktop:${POSTGRES_PASSWORD}@postgres.agentdesktop.svc.cluster.local:5432/agentdesktop?sslmode=verify-full&sslrootcert=/etc/agentdesktop/tls/postgres-ca.pem"

  cat >"$controller_config" <<EOF
fleetListen: 0.0.0.0:8443
adminListen: 127.0.0.1:8080
databaseUrl: $(yaml_quote "$database_url")
tls: /etc/agentdesktop/tls
allowInsecureDev: false

oidc:
  issuer: $(yaml_quote "$OIDC_ISSUER")
  clientId: $(yaml_quote "$OIDC_CLIENT_ID")
  redirectUri: http://127.0.0.1:51327/callback
EOF

  if [[ "$ENABLE_GATEWAY_JWT" == "true" ]]; then
    cat >>"$controller_config" <<EOF

gatewayJwt:
  privateKey: /etc/agentdesktop/tls/gateway-jwt-key.pem
  issuer: $(yaml_quote "$GATEWAY_JWT_ISSUER")
  keyId: $(yaml_quote "$GATEWAY_JWT_KEY_ID")
  lifetime: 5m
EOF
  fi

  cat >>"$controller_config" <<EOF

daemonConfig:
  path: /etc/agentdesktop/config/daemon.yaml
  revision: $DAEMON_CONFIG_REVISION
EOF

  kubectl -n "$namespace" create secret generic agentdesktop-controller-config \
    --from-file="controller.yaml=$controller_config" \
    --from-file="daemon.yaml=$DAEMON_CONFIG_FILE" \
    --dry-run=client \
    --output=yaml | kubectl apply -f - >/dev/null
}

install_controller() {
  export CONTROLLER_PLATFORM=gke
  export CONTROLLER_ADDRESS_RESOURCE_NAME
  export CONTROLLER_IPV4_ADDRESS
  export CONTROLLER_CONFIG_SECRET_NAME=agentdesktop-controller-config
  export CONTROLLER_RELEASE_NAME=agentdesktop

  local controller_chart="$AGENTDESKTOP_SOURCE_DIR/deploy/helm/agentdesktop-controller"
  if [[ ! -f "$controller_chart/Chart.yaml" ]]; then
    printf 'Controller chart does not exist: %s\n' "$controller_chart" >&2
    exit 1
  fi

  helm upgrade --install agentdesktop \
    "$controller_chart" \
    --namespace "$namespace" \
    --set replicaCount=1 \
    --set-string "image.repository=$CONTROLLER_IMAGE_REPOSITORY" \
    --set-string "image.tag=$CONTROLLER_IMAGE_TAG" \
    --set-string existingConfigSecret=agentdesktop-controller-config \
    --set-string tlsSecretName=agentdesktop-controller-tls \
    --set service.type=LoadBalancer \
    --set service.port=443 \
    --set resources.requests.cpu=250m \
    --set resources.requests.memory=256Mi \
    --set resources.limits.cpu=1 \
    --set resources.limits.memory=512Mi \
    --post-renderer "$script_directory/scripts/controller-post-renderer.sh" \
    --atomic \
    --timeout 15m

  kubectl -n "$namespace" rollout restart deployment/agentdesktop >/dev/null
  kubectl -n "$namespace" rollout status deployment/agentdesktop --timeout=10m
}

run_install() {
  require_command curl
  require_command docker
  require_command gcloud
  require_command helm
  require_command jq
  require_command kubectl
  require_command openssl
  require_command terraform
  load_state
  validate_hostname "$CONTROLLER_HOSTNAME"

  if [[ -z "${AGENTDESKTOP_SOURCE_DIR:-}" || -z "${CONTROLLER_IMAGE_TAG:-}" || -z "${CONTROLLER_IMAGE_DIGEST:-}" ]]; then
    printf 'No locally built controller image is recorded. Run %s build first.\n' "$0" >&2
    exit 1
  fi

  local controller_image="${CONTROLLER_IMAGE_REPOSITORY}:${CONTROLLER_IMAGE_TAG}"
  local image_inspection
  image_inspection="$(docker buildx imagetools inspect "$controller_image")"
  grep -q 'linux/amd64' <<<"$image_inspection" || {
    printf 'Recorded controller image is missing linux/amd64: %s\n' "$controller_image" >&2
    exit 1
  }
  grep -q 'linux/arm64' <<<"$image_inspection" || {
    printf 'Recorded controller image is missing linux/arm64: %s\n' "$controller_image" >&2
    exit 1
  }
  grep -q "^Digest:[[:space:]]*${CONTROLLER_IMAGE_DIGEST}$" <<<"$image_inspection" || {
    printf 'Recorded controller image digest no longer matches %s.\n' "$controller_image" >&2
    exit 1
  }

  prompt_value OIDC_ISSUER "OIDC issuer URL"
  prompt_value OIDC_CLIENT_ID "OIDC public native client ID"
  prompt_value PKI_DIRECTORY "Directory containing the deployment PKI files" "$script_directory/agentdesktop-pki"
  prompt_value DAEMON_CONFIG_FILE "Validated daemon policy YAML file"

  if [[ ! -s "$DAEMON_CONFIG_FILE" ]]; then
    printf 'Daemon policy does not exist or is empty: %s\n' "$DAEMON_CONFIG_FILE" >&2
    exit 1
  fi

  ENABLE_GATEWAY_JWT="${ENABLE_GATEWAY_JWT:-false}"
  GATEWAY_JWT_ISSUER="${GATEWAY_JWT_ISSUER:-agentdesktop-controller}"
  GATEWAY_JWT_KEY_ID="${GATEWAY_JWT_KEY_ID:-agentdesktop-$(date -u +%Y%m)}"
  DAEMON_CONFIG_REVISION="${DAEMON_CONFIG_REVISION:-1}"
  if [[ "$ENABLE_GATEWAY_JWT" != "true" && "$ENABLE_GATEWAY_JWT" != "false" ]]; then
    printf 'ENABLE_GATEWAY_JWT must be true or false.\n' >&2
    exit 1
  fi
  if [[ ! "$DAEMON_CONFIG_REVISION" =~ ^[1-9][0-9]*$ ]]; then
    printf 'DAEMON_CONFIG_REVISION must be a positive integer.\n' >&2
    exit 1
  fi
  if [[ "$ENABLE_GATEWAY_JWT" == "true" && ! -s "$PKI_DIRECTORY/gateway-jwt-key.pem" ]]; then
    printf 'Gateway JWT issuance is enabled but %s/gateway-jwt-key.pem is missing.\n' "$PKI_DIRECTORY" >&2
    exit 1
  fi

  work_directory="$(mktemp -d)"
  trap 'rm -rf "$work_directory"' EXIT

  validate_oidc
  validate_pki
  configure_kubectl
  SECRET_NAMES_JSON="$(terraform -chdir="$terraform_directory" output -json secret_names)"

  store_secret_file controller-ca-key "$PKI_DIRECTORY/controller-ca-key.pem" false
  store_secret_file controller-ca "$PKI_DIRECTORY/controller-ca.pem" false
  store_secret_file controller-key "$PKI_DIRECTORY/controller-key.pem"
  store_secret_file controller-certificate "$PKI_DIRECTORY/controller.pem"
  store_secret_file device-ca-key "$PKI_DIRECTORY/device-ca-key.pem"
  store_secret_file device-ca "$PKI_DIRECTORY/device-ca.pem"
  store_secret_file postgres-ca-key "$PKI_DIRECTORY/postgres-ca-key.pem" false
  store_secret_file postgres-ca "$PKI_DIRECTORY/postgres-ca.pem"
  store_secret_file postgres-key "$PKI_DIRECTORY/postgres-key.pem"
  store_secret_file postgres-certificate "$PKI_DIRECTORY/postgres.pem"
  if [[ "$ENABLE_GATEWAY_JWT" == "true" ]]; then
    store_secret_file gateway-jwt-key "$PKI_DIRECTORY/gateway-jwt-key.pem"
  fi

  POSTGRES_PASSWORD="$(get_or_create_postgres_password)"
  apply_kubernetes_secrets
  install_postgres
  create_controller_config
  install_controller

  printf '\nDeployment complete. Confirm this DNS record exists:\n'
  printf '  A  %s  %s\n' "$CONTROLLER_HOSTNAME" "$CONTROLLER_IPV4_ADDRESS"
  printf 'OIDC redirect URI: http://127.0.0.1:51327/callback\n'
  printf 'Run %s verify after DNS has propagated.\n' "$0"
}

run_verify() {
  require_command gcloud
  require_command jq
  require_command kubectl
  require_command openssl
  require_command terraform
  load_state
  configure_kubectl

  kubectl -n "$namespace" rollout status deployment/postgres --timeout=5m
  kubectl -n "$namespace" rollout status deployment/agentdesktop --timeout=5m

  local service_ip
  service_ip="$(kubectl -n "$namespace" get service agentdesktop -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  if [[ "$service_ip" != "$CONTROLLER_IPV4_ADDRESS" ]]; then
    printf 'Controller Service address %s does not match reserved address %s.\n' "$service_ip" "$CONTROLLER_IPV4_ADDRESS" >&2
    exit 1
  fi

  local openssl_arguments=(
    s_client
    -connect "$CONTROLLER_HOSTNAME:443"
    -servername "$CONTROLLER_HOSTNAME"
    -verify_hostname "$CONTROLLER_HOSTNAME"
    -verify_return_error
    -alpn h2
  )
  local ca_file
  ca_file="$(mktemp)"
  local controller_ca_secret
  controller_ca_secret="$(terraform -chdir="$terraform_directory" output -json secret_names | jq -r '."controller-ca"')"
  if secret_has_enabled_version "$controller_ca_secret"; then
    gcloud secrets versions access latest \
      --secret "$controller_ca_secret" \
      --project "$PROJECT_ID" >"$ca_file"
    chmod 0600 "$ca_file"
    trap "rm -f -- $(printf '%q' "$ca_file")" EXIT
    openssl_arguments+=( -CAfile "$ca_file" )
  else
    rm -f "$ca_file"
  fi

  local tls_output
  tls_output="$(openssl "${openssl_arguments[@]}" </dev/null 2>&1)"
  grep -q 'Verify return code: 0 (ok)' <<<"$tls_output"
  grep -q 'ALPN protocol: h2' <<<"$tls_output"

  kubectl -n "$namespace" get deployment,service,cronjob,pvc
  printf 'Verified workloads, reserved IPv4 address, certificate hostname, and HTTP/2 negotiation.\n'
}

run_backup() {
  require_command gcloud
  require_command kubectl
  load_state
  configure_kubectl

  local job_name
  job_name="postgres-backup-manual-$(date -u +%Y%m%d%H%M%S)"
  kubectl -n "$namespace" create job "$job_name" --from=cronjob/postgres-backup
  kubectl -n "$namespace" wait --for=condition=complete "job/$job_name" --timeout=30m
  kubectl -n "$namespace" logs "job/$job_name" --container=upload
}

run_destroy() {
  require_command jq
  require_command terraform
  load_state

  local admin_cidr_blocks
  admin_cidr_blocks="$(terraform -chdir="$terraform_directory" show -json | jq -c '
    .values.root_module.resources[]
    | select(.address == "google_container_cluster.production")
    | .values.master_authorized_networks_config[0].cidr_blocks
  ')"

  TF_VAR_project_id="$PROJECT_ID" \
  TF_VAR_region="$REGION" \
  TF_VAR_controller_hostname="$CONTROLLER_HOSTNAME" \
  TF_VAR_controller_dns_aliases="${CONTROLLER_DNS_ALIASES_JSON:-[]}" \
  TF_VAR_admin_cidr_blocks="$admin_cidr_blocks" \
    terraform -chdir="$terraform_directory" apply \
      -target=google_container_cluster.production \
      -var='deletion_protection=false' \
      -auto-approve

  TF_VAR_project_id="$PROJECT_ID" \
  TF_VAR_region="$REGION" \
  TF_VAR_controller_hostname="$CONTROLLER_HOSTNAME" \
  TF_VAR_controller_dns_aliases="${CONTROLLER_DNS_ALIASES_JSON:-[]}" \
  TF_VAR_admin_cidr_blocks="$admin_cidr_blocks" \
    terraform -chdir="$terraform_directory" destroy \
      -var='deletion_protection=false' \
      -auto-approve

  rm -f "$state_file"
}

case "${1:-}" in
  infra)
    run_infra
    ;;
  build)
    run_build
    ;;
  install)
    run_install
    ;;
  verify)
    run_verify
    ;;
  backup)
    run_backup
    ;;
  destroy)
    run_destroy
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac