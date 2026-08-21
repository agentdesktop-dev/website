#!/usr/bin/env bash
set -euo pipefail

controller_name="${CONTROLLER_RELEASE_NAME:-agentdesktop}"
config_secret_name="${CONTROLLER_CONFIG_SECRET_NAME:-agentdesktop-controller-config}"
controller_platform="${CONTROLLER_PLATFORM:-gke}"

if [[ "$controller_platform" != "gke" && "$controller_platform" != "kind" ]]; then
  printf 'CONTROLLER_PLATFORM must be gke or kind.\n' >&2
  exit 1
fi

if [[ "$controller_platform" == "gke" ]]; then
  : "${CONTROLLER_ADDRESS_RESOURCE_NAME:?Set CONTROLLER_ADDRESS_RESOURCE_NAME to the Terraform output.}"
  : "${CONTROLLER_IPV4_ADDRESS:?Set CONTROLLER_IPV4_ADDRESS to the Terraform output.}"
else
  kind_node_port="${CONTROLLER_KIND_NODE_PORT:-30443}"
fi

if [[ ! "$controller_name" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]]; then
  printf 'Invalid controller release name: %s\n' "$controller_name" >&2
  exit 1
fi

if [[ ! "$config_secret_name" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]]; then
  printf 'Invalid controller config Secret name: %s\n' "$config_secret_name" >&2
  exit 1
fi

if [[ "$controller_platform" == "gke" ]]; then
  if [[ ! "$CONTROLLER_ADDRESS_RESOURCE_NAME" =~ ^[a-z]([-a-z0-9]*[a-z0-9])?$ ]]; then
    printf 'Invalid Compute address resource name: %s\n' "$CONTROLLER_ADDRESS_RESOURCE_NAME" >&2
    exit 1
  fi

  if [[ ! "$CONTROLLER_IPV4_ADDRESS" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    printf 'Invalid controller IPv4 address: %s\n' "$CONTROLLER_IPV4_ADDRESS" >&2
    exit 1
  fi
elif [[ ! "$kind_node_port" =~ ^3[0-2][0-9]{3}$ ]]; then
  printf 'CONTROLLER_KIND_NODE_PORT must be between 30000 and 32999.\n' >&2
  exit 1
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

cat >"$workdir/resources.yaml"
cat >"$workdir/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - resources.yaml
patches:
  - target:
      group: apps
      version: v1
      kind: Deployment
      name: ${controller_name}
    patch: |-
      - op: replace
        path: /spec/template/spec/volumes/0/secret
        value:
          secretName: ${config_secret_name}
      - op: add
        path: /spec/strategy
        value:
          type: Recreate
      - op: add
        path: /spec/template/spec/automountServiceAccountToken
        value: false
      - op: add
        path: /spec/template/spec/containers/0/startupProbe
        value:
          tcpSocket:
            port: fleet
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 30
      - op: add
        path: /spec/template/spec/containers/0/readinessProbe
        value:
          tcpSocket:
            port: fleet
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
EOF

if [[ "$controller_platform" == "gke" ]]; then
  cat >>"$workdir/kustomization.yaml" <<EOF
  - target:
      version: v1
      kind: Service
      name: ${controller_name}
    patch: |-
      - op: add
        path: /metadata/annotations
        value:
          cloud.google.com/l4-rbs: "enabled"
          networking.gke.io/load-balancer-ip-addresses: ${CONTROLLER_ADDRESS_RESOURCE_NAME}
      - op: add
        path: /spec/loadBalancerIP
        value: ${CONTROLLER_IPV4_ADDRESS}
      - op: add
        path: /spec/externalTrafficPolicy
        value: Local
EOF
else
  cat >>"$workdir/kustomization.yaml" <<EOF
  - target:
      version: v1
      kind: Service
      name: ${controller_name}
    patch: |-
      - op: replace
        path: /spec/type
        value: NodePort
      - op: add
        path: /spec/ports/0/nodePort
        value: ${kind_node_port}
EOF
fi

kubectl kustomize "$workdir"