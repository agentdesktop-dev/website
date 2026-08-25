#!/usr/bin/env bash
set -uo pipefail

namespace="${AGENTDESKTOP_NAMESPACE:-agentdesktop}"
deployment="${AGENTDESKTOP_DEPLOYMENT:-agentdesktop}"
local_port="${1:-18080}"
remote_port=8080
retry_delay_seconds=2

usage() {
  cat <<'EOF'
Usage: port-forward-admin.sh [LOCAL_PORT]

Forwards the production controller management UI to 127.0.0.1:LOCAL_PORT.
The default local port is 18080. The helper reconnects when Kubernetes closes
the streaming session and re-resolves the Ready controller pod after rollouts.
Press Ctrl-C to stop.
EOF
}

if (( $# > 1 )); then
  usage >&2
  exit 2
fi
if [[ "$local_port" == "-h" || "$local_port" == "--help" ]]; then
  usage
  exit 0
fi
if [[ ! "$local_port" =~ ^[0-9]+$ ]] ||
  (( 10#$local_port < 1 || 10#$local_port > 65535 )); then
  printf 'LOCAL_PORT must be an integer from 1 through 65535.\n' >&2
  exit 2
fi

for command_name in jq kubectl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%s is required.\n' "$command_name" >&2
    exit 1
  fi
done

resolve_ready_pod() {
  local deployment_json pods_json selector

  deployment_json="$(kubectl -n "$namespace" get deployment "$deployment" -o json)" || return
  selector="$(jq -er '
    .spec.selector.matchLabels
    | to_entries
    | map("\(.key)=\(.value)")
    | join(",")
    | select(length > 0)
  ' <<<"$deployment_json")" || return
  pods_json="$(kubectl -n "$namespace" get pods \
    --field-selector status.phase=Running \
    --selector "$selector" \
    -o json)" || return
  jq -er '
    [
      .items[]
      | select(any(.status.conditions[]?; .type == "Ready" and .status == "True"))
    ]
    | sort_by(.metadata.creationTimestamp)
    | last
    | .metadata.name
    | select(length > 0)
  ' <<<"$pods_json"
}

trap 'printf "\nPort-forward stopped.\n"; exit 0' INT TERM HUP

printf 'Production management UI: http://127.0.0.1:%s/\n' "$local_port"
while true; do
  if pod="$(resolve_ready_pod)"; then
    printf 'Forwarding Ready pod %s (press Ctrl-C to stop).\n' "$pod"
    kubectl -n "$namespace" port-forward \
      --address 127.0.0.1 \
      "pod/${pod}" \
      "${local_port}:${remote_port}"
    exit_code=$?
    printf 'Port-forward ended with exit code %d; reconnecting in %d seconds.\n' \
      "$exit_code" "$retry_delay_seconds" >&2
  else
    printf 'No Ready pod found for deployment %s/%s; retrying in %d seconds.\n' \
      "$namespace" "$deployment" "$retry_delay_seconds" >&2
  fi
  sleep "$retry_delay_seconds"
done