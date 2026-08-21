#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd -- "$script_directory/../.." && pwd)"
gcp_directory="$repository_root/deploy/gcp"
agentdesktop_source="${AGENTDESKTOP_SOURCE:-$repository_root/../agentdesktop}"
cluster_name="${KIND_CLUSTER_NAME:-agentdesktop-smoke}"
kube_context="kind-$cluster_name"
namespace="agentdesktop"
node_image="${KIND_NODE_IMAGE:-kindest/node:v1.35.0}"
fleet_host_port="${KIND_FLEET_HOST_PORT:-18443}"
fleet_node_port="${KIND_FLEET_NODE_PORT:-30443}"
admin_host_port="${KIND_ADMIN_HOST_PORT:-18080}"
controller_image_repository="${CONTROLLER_IMAGE_REPOSITORY:-localhost/agentdesktop-controller}"
controller_image_tag="${CONTROLLER_IMAGE_TAG:-kind-smoke}"
controller_image="$controller_image_repository:$controller_image_tag"
postgres_source_image="docker.io/pgvector/pgvector:pg18-trixie"
postgres_image_repository="localhost/agentdesktop-postgres"
postgres_image_tag="kind-smoke"
postgres_image="$postgres_image_repository:$postgres_image_tag"
dex_source_image="ghcr.io/dexidp/dex:v2.45.1"
dex_image="localhost/agentdesktop-dex:kind-smoke"
keep_cluster="${KEEP_CLUSTER:-false}"
skip_controller_build="${SKIP_CONTROLLER_BUILD:-false}"
created_cluster=false
port_forward_pid=""
work_directory="$(mktemp -d)"

usage() {
  cat <<'EOF'
Usage: smoke-test.sh

Builds Agentdesktop from the adjacent source checkout, creates an isolated Kind
cluster, installs the GCP PostgreSQL chart with local overrides, and verifies
the controller end to end. The cluster is deleted on exit by default.

Useful overrides:
  AGENTDESKTOP_SOURCE=/path/to/agentdesktop
  KEEP_CLUSTER=true
  SKIP_CONTROLLER_BUILD=true
  KIND_FLEET_HOST_PORT=18443
  KIND_ADMIN_HOST_PORT=18080
EOF
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%s is required.\n' "$command_name" >&2
    exit 1
  fi
}

kubectl_smoke() {
  kubectl --context "$kube_context" "$@"
}

run_database_query() {
  local job_name="$1"
  local query="$2"
  local query_json
  query_json="$(printf '%s' "$query" | jq -Rs .)"

  cat >"$work_directory/$job_name.yaml" <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: $job_name
  namespace: $namespace
spec:
  backoffLimit: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: postgres-smoke-client
        app.kubernetes.io/instance: agentdesktop
    spec:
      restartPolicy: Never
      automountServiceAccountToken: false
      containers:
        - name: psql
          image: $postgres_image
          imagePullPolicy: Never
          command: ["/bin/sh", "-ec"]
          args:
            - psql -At -v ON_ERROR_STOP=1 -c "\$QUERY"
          env:
            - name: PGHOST
              value: postgres.agentdesktop.svc.cluster.local
            - name: PGPORT
              value: "5432"
            - name: PGUSER
              value: agentdesktop
            - name: PGDATABASE
              value: agentdesktop
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: agentdesktop-postgres
                  key: POSTGRES_PASSWORD
            - name: PGSSLMODE
              value: verify-full
            - name: PGSSLROOTCERT
              value: /etc/postgresql/ca/ca.crt
            - name: PGCONNECT_TIMEOUT
              value: "10"
            - name: QUERY
              value: $query_json
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
            readOnlyRootFilesystem: true
          volumeMounts:
            - name: postgres-ca
              mountPath: /etc/postgresql/ca
              readOnly: true
      volumes:
        - name: postgres-ca
          secret:
            secretName: agentdesktop-postgres-tls
            items:
              - key: ca.crt
                path: ca.crt
EOF
  kubectl_smoke apply -f "$work_directory/$job_name.yaml" >/dev/null
  kubectl_smoke -n "$namespace" wait --for=condition=complete "job/$job_name" --timeout=2m >/dev/null
  kubectl_smoke -n "$namespace" logs "job/$job_name" --container=psql
}

print_diagnostics() {
  if ! kind get clusters 2>/dev/null | grep -qx "$cluster_name"; then
    return
  fi

  printf '\nKind smoke-test diagnostics\n' >&2
  kubectl_smoke -n "$namespace" get pods,deployments,services,pvc,jobs,cronjobs -o wide >&2 || true
  printf '\nRecent events\n' >&2
  kubectl_smoke -n "$namespace" get events --sort-by=.lastTimestamp >&2 || true
  printf '\nPod descriptions\n' >&2
  kubectl_smoke -n "$namespace" describe pods >&2 || true
  printf '\nCurrent logs\n' >&2
  local pod
  while IFS= read -r pod; do
    kubectl_smoke -n "$namespace" logs "$pod" --all-containers --prefix >&2 || true
    kubectl_smoke -n "$namespace" logs "$pod" --all-containers --prefix --previous >&2 || true
  done < <(kubectl_smoke -n "$namespace" get pods -o name 2>/dev/null || true)
}

cleanup() {
  local exit_code=$?
  trap - EXIT

  if [[ -n "$port_forward_pid" ]]; then
    kill "$port_forward_pid" >/dev/null 2>&1 || true
    wait "$port_forward_pid" 2>/dev/null || true
  fi
  if (( exit_code != 0 )); then
    print_diagnostics
  fi
  if [[ "$created_cluster" == "true" && "$keep_cluster" != "true" ]]; then
    kind delete cluster --name "$cluster_name" >/dev/null 2>&1 || true
  elif [[ "$created_cluster" == "true" ]]; then
    printf 'Kind cluster retained: %s (context %s)\n' "$cluster_name" "$kube_context"
  fi
  rm -rf "$work_directory"
  exit "$exit_code"
}
trap cleanup EXIT

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
  usage
  exit 0
fi
if (( $# != 0 )); then
  usage >&2
  exit 2
fi

for command_name in curl docker helm jq kind kubectl openssl; do
  require_command "$command_name"
done

if [[ "$keep_cluster" != "true" && "$keep_cluster" != "false" ]]; then
  printf 'KEEP_CLUSTER must be true or false.\n' >&2
  exit 1
fi
if [[ "$skip_controller_build" != "true" && "$skip_controller_build" != "false" ]]; then
  printf 'SKIP_CONTROLLER_BUILD must be true or false.\n' >&2
  exit 1
fi
if [[ ! "$fleet_host_port" =~ ^[0-9]+$ || ! "$fleet_node_port" =~ ^3[0-2][0-9]{3}$ || ! "$admin_host_port" =~ ^[0-9]+$ ]]; then
  printf 'Kind host ports must be numeric and KIND_FLEET_NODE_PORT must be between 30000 and 32999.\n' >&2
  exit 1
fi
if [[ ! -f "$agentdesktop_source/Dockerfile" || ! -f "$agentdesktop_source/deploy/helm/agentdesktop-controller/Chart.yaml" ]]; then
  printf 'Agentdesktop source checkout not found at %s. Set AGENTDESKTOP_SOURCE.\n' "$agentdesktop_source" >&2
  exit 1
fi
if kind get clusters 2>/dev/null | grep -qx "$cluster_name"; then
  printf 'Kind cluster %s already exists. Delete it or set KIND_CLUSTER_NAME to another dedicated name.\n' "$cluster_name" >&2
  exit 1
fi

printf 'Smoke-test source: %s (%s)\n' \
  "$agentdesktop_source" \
  "$(git -C "$agentdesktop_source" rev-parse --short HEAD 2>/dev/null || printf unknown)"

if [[ "$skip_controller_build" != "true" ]]; then
  printf '\nBuilding controller image %s\n' "$controller_image"
  docker build \
    --provenance=false \
    --tag "$controller_image" \
    --label "dev.agentdesktop.smoke.source-revision=$(git -C "$agentdesktop_source" rev-parse HEAD 2>/dev/null || printf unknown)" \
    "$agentdesktop_source"
elif ! docker image inspect "$controller_image" >/dev/null 2>&1; then
  printf 'SKIP_CONTROLLER_BUILD=true but %s is not present locally.\n' "$controller_image" >&2
  exit 1
fi

for dependency_image in "$node_image" "$postgres_source_image" "$dex_source_image"; do
  if ! docker image inspect "$dependency_image" >/dev/null 2>&1; then
    docker pull "$dependency_image"
  fi
done

printf 'Normalizing third-party images for Kind import\n'
printf 'FROM %s\n' "$postgres_source_image" | docker build \
  --provenance=false \
  --tag "$postgres_image" \
  -
printf 'FROM %s\n' "$dex_source_image" | docker build \
  --provenance=false \
  --tag "$dex_image" \
  -

cat >"$work_directory/kind.yaml" <<EOF
apiVersion: kind.x-k8s.io/v1alpha4
kind: Cluster
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: $fleet_node_port
        hostPort: $fleet_host_port
        listenAddress: 127.0.0.1
        protocol: TCP
EOF

printf '\nCreating isolated Kind cluster %s\n' "$cluster_name"
kind create cluster \
  --name "$cluster_name" \
  --image "$node_image" \
  --config "$work_directory/kind.yaml" \
  --wait 5m
created_cluster=true

for workload_image in "$controller_image" "$postgres_image" "$dex_image"; do
  printf 'Loading %s into Kind\n' "$workload_image"
  kind load docker-image --name "$cluster_name" "$workload_image"
done

kubectl_smoke create namespace "$namespace"

pki_directory="$work_directory/pki"
"$gcp_directory/scripts/generate-pki.sh" agentdesktop.local "$pki_directory" >/dev/null
postgres_password="$(openssl rand -hex 32)"
printf '%s' "$postgres_password" >"$work_directory/postgres-password"

kubectl_smoke -n "$namespace" create secret generic agentdesktop-postgres \
  --from-file="POSTGRES_PASSWORD=$work_directory/postgres-password"
kubectl_smoke -n "$namespace" create secret generic agentdesktop-postgres-tls \
  --from-file="ca.crt=$pki_directory/postgres-ca.pem" \
  --from-file="tls.crt=$pki_directory/postgres.pem" \
  --from-file="tls.key=$pki_directory/postgres-key.pem"

printf '\nInstalling PostgreSQL with local-path persistence\n'
helm upgrade --install postgres "$gcp_directory/helm/postgresql" \
  --kube-context "$kube_context" \
  --namespace "$namespace" \
  --set-string image.repository="$postgres_image_repository" \
  --set-string image.tag="$postgres_image_tag" \
  --set image.pullPolicy=Never \
  --set storage.createStorageClass=false \
  --set storage.storageClassName=standard \
  --set storage.size=1Gi \
  --set backup.enabled=false \
  --set resources.requests.cpu=100m \
  --set resources.requests.memory=256Mi \
  --set resources.limits.cpu=1 \
  --set resources.limits.memory=1Gi \
  --atomic \
  --timeout 10m
kubectl_smoke -n "$namespace" rollout status deployment/postgres --timeout=5m

database_tls_result="$(run_database_query postgres-tls-check 'SHOW ssl')"
if [[ "$database_tls_result" != "on" ]]; then
  printf 'PostgreSQL did not report verified TLS: %s\n' "$database_tls_result" >&2
  exit 1
fi

run_database_query postgres-persistence-seed \
  'CREATE TABLE smoke_persistence (id integer PRIMARY KEY); INSERT INTO smoke_persistence VALUES (1) ON CONFLICT DO NOTHING' \
  >/dev/null
kubectl_smoke -n "$namespace" delete pod \
  -l app.kubernetes.io/name=agentdesktop-postgresql,app.kubernetes.io/instance=postgres \
  --wait=true >/dev/null
kubectl_smoke -n "$namespace" rollout status deployment/postgres --timeout=5m
persistence_count="$(run_database_query postgres-persistence-check 'SELECT count(*) FROM smoke_persistence')"
if [[ "$persistence_count" != "1" ]]; then
  printf 'PostgreSQL data did not survive Pod replacement.\n' >&2
  exit 1
fi

cat >"$work_directory/dex.yaml" <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: dex
  namespace: $namespace
data:
  config.yaml: |
    issuer: http://dex.$namespace.svc.cluster.local:5556/dex
    storage:
      type: memory
    web:
      http: 0.0.0.0:5556
    oauth2:
      skipApprovalScreen: true
    staticClients:
      - id: agentdesktop-kind
        name: Agentdesktop Kind smoke test
        public: true
        redirectURIs:
          - http://127.0.0.1:51327/callback
    enablePasswordDB: true
    staticPasswords:
      - email: smoke@example.com
        username: smoke
        userID: smoke-user
        hash: \$2y\$10\$cA5xff5AaaAoxB8VZjwXUeXZIlH8V0sLf/JkIBXHip6gnQsyKJiHW
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dex
  namespace: $namespace
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: dex
  template:
    metadata:
      labels:
        app.kubernetes.io/name: dex
    spec:
      automountServiceAccountToken: false
      containers:
        - name: dex
          image: $dex_image
          imagePullPolicy: Never
          args: ["dex", "serve", "/etc/dex/config.yaml"]
          ports:
            - name: http
              containerPort: 5556
          readinessProbe:
            httpGet:
              path: /dex/.well-known/openid-configuration
              port: http
            periodSeconds: 2
            failureThreshold: 30
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
          volumeMounts:
            - name: config
              mountPath: /etc/dex
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: dex
---
apiVersion: v1
kind: Service
metadata:
  name: dex
  namespace: $namespace
spec:
  selector:
    app.kubernetes.io/name: dex
  ports:
    - name: http
      port: 5556
      targetPort: http
EOF
kubectl_smoke apply -f "$work_directory/dex.yaml" >/dev/null
kubectl_smoke -n "$namespace" rollout status deployment/dex --timeout=5m

cat >"$work_directory/controller.yaml" <<EOF
fleetListen: 0.0.0.0:8443
adminListen: 127.0.0.1:8080
databaseUrl: postgresql://agentdesktop:$postgres_password@postgres.agentdesktop.svc.cluster.local:5432/agentdesktop?sslmode=verify-full&sslrootcert=/etc/agentdesktop/tls/postgres-ca.pem
tls: /etc/agentdesktop/tls
allowInsecureDev: true
oidc:
  issuer: http://dex.$namespace.svc.cluster.local:5556/dex
  clientId: agentdesktop-kind
  redirectUri: http://127.0.0.1:51327/callback
daemonConfig:
  path: /etc/agentdesktop/config/daemon.yaml
  revision: 1
EOF
printf '{}\n' >"$work_directory/daemon.yaml"

kubectl_smoke -n "$namespace" create secret generic agentdesktop-controller-config \
  --from-file="controller.yaml=$work_directory/controller.yaml" \
  --from-file="daemon.yaml=$work_directory/daemon.yaml"
kubectl_smoke -n "$namespace" create secret generic agentdesktop-controller-tls \
  --from-file="controller.pem=$pki_directory/controller.pem" \
  --from-file="controller-key.pem=$pki_directory/controller-key.pem" \
  --from-file="device-ca.pem=$pki_directory/device-ca.pem" \
  --from-file="device-ca-key.pem=$pki_directory/device-ca-key.pem" \
  --from-file="postgres-ca.pem=$pki_directory/postgres-ca.pem"

printf '\nInstalling Agentdesktop controller\n'
CONTROLLER_PLATFORM=kind \
CONTROLLER_KIND_NODE_PORT="$fleet_node_port" \
CONTROLLER_RELEASE_NAME=agentdesktop \
CONTROLLER_CONFIG_SECRET_NAME=agentdesktop-controller-config \
helm upgrade --install agentdesktop \
  "$agentdesktop_source/deploy/helm/agentdesktop-controller" \
  --kube-context "$kube_context" \
  --namespace "$namespace" \
  --set-string image.repository="$controller_image_repository" \
  --set-string image.tag="$controller_image_tag" \
  --set image.pullPolicy=Never \
  --set-string existingConfigSecret=agentdesktop-controller-config \
  --set-string tlsSecretName=agentdesktop-controller-tls \
  --set service.type=ClusterIP \
  --set service.port=443 \
  --set resources.requests.cpu=100m \
  --set resources.requests.memory=128Mi \
  --set resources.limits.cpu=1 \
  --set resources.limits.memory=512Mi \
  --post-renderer "$gcp_directory/scripts/controller-post-renderer.sh" \
  --atomic \
  --timeout 10m
kubectl_smoke -n "$namespace" rollout status deployment/agentdesktop --timeout=5m

kubectl_smoke -n "$namespace" get pods -o json | jq -e '
  all(.items[];
    if .status.phase == "Succeeded" then
      all(.status.containerStatuses[]?;
        .state.terminated.exitCode == 0
      )
    else
      .status.phase == "Running" and
      all(.status.containerStatuses[]?;
        .ready == true and .state.waiting == null
      )
    end
  )
' >/dev/null
kubectl_smoke -n "$namespace" get deployment agentdesktop -o json | jq -e '
  .spec.template.spec.volumes[] |
  select(.name == "config") |
  .secret.secretName == "agentdesktop-controller-config" and
  (.secret | has("items") | not)
' >/dev/null

controller_logs="$(kubectl_smoke -n "$namespace" logs deployment/agentdesktop)"
grep -q 'OIDC enrollment enabled' <<<"$controller_logs"
grep -q 'fleet controller listening' <<<"$controller_logs"

tls_output="$(openssl s_client \
  -connect "127.0.0.1:$fleet_host_port" \
  -servername agentdesktop.local \
  -verify_hostname agentdesktop.local \
  -verify_return_error \
  -CAfile "$pki_directory/controller-ca.pem" \
  -alpn h2 </dev/null 2>&1)"
grep -q 'Verify return code: 0 (ok)' <<<"$tls_output"
grep -q 'ALPN protocol: h2' <<<"$tls_output"

kubectl_smoke -n "$namespace" port-forward deployment/agentdesktop "$admin_host_port:8080" \
  >"$work_directory/port-forward.log" 2>&1 &
port_forward_pid=$!
settings="$(curl \
  --fail \
  --silent \
  --retry 20 \
  --retry-connrefused \
  --retry-delay 1 \
  "http://127.0.0.1:$admin_host_port/api/v1/settings" \
  2>>"$work_directory/port-forward.log")"
jq -e '
  .fleet_listen == "0.0.0.0:8443" and
  .admin_listen == "127.0.0.1:8080" and
  .oidc_enabled == true and
  .tls_enabled == true
' <<<"$settings" >/dev/null

printf '\nKind smoke test passed\n'
printf '  controller image: %s\n' "$controller_image"
printf '  PostgreSQL TLS: verified\n'
printf '  PostgreSQL PVC persistence: verified\n'
printf '  OIDC discovery: verified through controller startup\n'
printf '  fleet TLS and HTTP/2: https://agentdesktop.local:%s\n' "$fleet_host_port"
printf '  loopback admin API: verified through kubectl port-forward\n'