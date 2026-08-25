#!/usr/bin/env bash
set -euo pipefail

display_name="agentdesktop enrollment"
legacy_display_name="A${display_name:1}"
redirect_uri="http://127.0.0.1:51327/callback"
dry_run=false
required_resource_accesses='[{"resourceAppId":"00000003-0000-0000-c000-000000000000","resourceAccess":[{"id":"37f7f235-527c-4136-accd-4a02d197296e","type":"Scope"},{"id":"14dad69e-099b-42c9-810b-d002981feec1","type":"Scope"},{"id":"64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0","type":"Scope"},{"id":"7427e0e9-2fba-42fe-b0c0-848c9e6a8182","type":"Scope"}]}]'

usage() {
  cat <<'EOF'
Usage: create-entra-app.sh [--display-name NAME] [--dry-run]

Creates or updates the single-tenant agentdesktop public-client application and
its Enterprise Application using GA Azure CLI commands. No client secret is
created. Enterprise Application user/group assignments remain an administrator
decision in Microsoft Entra.
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --display-name)
      if (( $# < 2 )); then
        printf '%s requires a value.\n' "$1" >&2
        exit 2
      fi
      display_name="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$display_name" ]]; then
  printf 'Display name cannot be empty.\n' >&2
  exit 1
fi

for command_name in az curl jq; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%s is required.\n' "$command_name" >&2
    exit 1
  fi
done

if [[ "$dry_run" == "true" ]]; then
  cat <<EOF
az ad app create \\
  --display-name $(printf '%q' "$display_name") \\
  --sign-in-audience AzureADMyOrg \\
  --is-fallback-public-client true \\
  --public-client-redirect-uris $(printf '%q' "$redirect_uri") \\
  --required-resource-accesses $(printf '%q' "$required_resource_accesses") \\
  --enable-access-token-issuance false \\
  --enable-id-token-issuance false
az ad sp create --id APPLICATION_CLIENT_ID
az ad sp update --id APPLICATION_CLIENT_ID \\
  --set appRoleAssignmentRequired=true
EOF
  exit 0
fi

tenant_id="$(az account show --query tenantId --output tsv)"
if [[ ! "$tenant_id" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  printf 'Azure CLI is not signed into a Microsoft Entra tenant. Run az login --tenant TENANT_ID.\n' >&2
  exit 1
fi

applications="$(az ad app list --display-name "$display_name" --all --output json)"
matches="$(jq --arg name "$display_name" '[.[] | select(.displayName == $name)]' <<<"$applications")"
match_count="$(jq 'length' <<<"$matches")"

if (( match_count == 0 )) && [[ "$display_name" == "agentdesktop enrollment" ]]; then
  legacy_applications="$(az ad app list --display-name "$legacy_display_name" --all --output json)"
  legacy_matches="$(jq --arg name "$legacy_display_name" '[.[] | select(.displayName == $name)]' <<<"$legacy_applications")"
  legacy_match_count="$(jq 'length' <<<"$legacy_matches")"
  if (( legacy_match_count > 1 )); then
    printf 'More than one Entra application has legacy display name %q; refusing an ambiguous update.\n' "$legacy_display_name" >&2
    exit 1
  fi
  if (( legacy_match_count == 1 )); then
    matches="$legacy_matches"
    match_count=1
  fi
fi

if (( match_count > 1 )); then
  printf 'More than one Entra application has display name %q; refusing an ambiguous update.\n' "$display_name" >&2
  exit 1
fi

if (( match_count == 0 )); then
  application="$(az ad app create \
    --display-name "$display_name" \
    --sign-in-audience AzureADMyOrg \
    --is-fallback-public-client true \
    --public-client-redirect-uris "$redirect_uri" \
    --required-resource-accesses "$required_resource_accesses" \
    --enable-access-token-issuance false \
    --enable-id-token-issuance false \
    --output json)"
else
  application="$(jq '.[0]' <<<"$matches")"
  app_id="$(jq -r .appId <<<"$application")"
  az ad app update \
    --id "$app_id" \
    --display-name "$display_name" \
    --sign-in-audience AzureADMyOrg \
    --is-fallback-public-client true \
    --public-client-redirect-uris "$redirect_uri" \
    --required-resource-accesses "$required_resource_accesses" \
    --enable-access-token-issuance false \
    --enable-id-token-issuance false \
    --output none
  application="$(az ad app show --id "$app_id" --output json)"
fi

app_id="$(jq -r .appId <<<"$application")"
if ! service_principal="$(az ad sp show --id "$app_id" --output json 2>/dev/null)"; then
  service_principal="$(az ad sp create --id "$app_id" --output json)"
fi
service_principal_id="$(jq -r .id <<<"$service_principal")"

az ad sp update \
  --id "$service_principal_id" \
  --set appRoleAssignmentRequired=true \
  --output none

discovery_url="https://login.microsoftonline.com/${tenant_id}/v2.0/.well-known/openid-configuration"
oidc_issuer="$(curl --fail --silent --show-error "$discovery_url" | jq -er .issuer)"

cat <<EOF
Created or updated Microsoft Entra application:
  Display name: ${display_name}
  Application (client) ID: ${app_id}
  Enterprise Application object ID: ${service_principal_id}
  Redirect URI: ${redirect_uri}
  Delegated scopes: openid profile email offline_access
  Assignment required: true

export OIDC_ISSUER=$(printf '%q' "$oidc_issuer")
export OIDC_CLIENT_ID=$(printf '%q' "$app_id")

Before enrollment, a Global Administrator must grant tenant-wide consent for
these scopes and an administrator must assign each allowed user or group to the
Enterprise Application:

  az ad app permission admin-consent --id ${app_id}

Portal: Microsoft Entra admin center > Enterprise applications >
        ${display_name} > Users and groups
EOF