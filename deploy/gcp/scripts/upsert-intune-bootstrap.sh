#!/usr/bin/env bash
set -euo pipefail

display_name="agentdesktop bootstrap"
legacy_display_name="A${display_name:1}"
dry_run=false

usage() {
  cat <<'EOF'
Usage: upsert-intune-bootstrap.sh SCRIPT_FILE GROUP_ID [--display-name NAME] [--dry-run]

Creates or updates an Intune macOS shell script through Microsoft Graph beta and
assigns it to exactly one Microsoft Entra group. The command intentionally does
not create or upload the macOS PKG app; Intune package content upload uses a
separate encrypted SAS/commit protocol and remains a portal workflow.

GROUP_ID is the Object ID of the Intune deployment security group, not the
Application (client) ID or Enterprise Application object ID.

The Azure CLI session needs the admin-consented delegated Microsoft Graph
permission DeviceManagementScripts.ReadWrite.All and an active Intune license.
EOF
}

if (( $# < 2 )); then
  usage >&2
  exit 2
fi

script_file="$1"
group_id="$2"
shift 2

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

for command_name in az base64 jq; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%s is required.\n' "$command_name" >&2
    exit 1
  fi
done

if [[ ! -s "$script_file" ]]; then
  printf 'Script does not exist or is empty: %s\n' "$script_file" >&2
  exit 1
fi
if (( $(wc -c <"$script_file") >= 1048576 )); then
  printf 'Intune macOS shell scripts must be smaller than 1 MB.\n' >&2
  exit 1
fi
if ! head -n 1 "$script_file" | grep -q '^#!'; then
  printf 'Intune script must start with a shebang.\n' >&2
  exit 1
fi
if [[ ! "$group_id" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  printf 'GROUP_ID must be the Object ID of a Microsoft Entra security group.\n' >&2
  exit 1
fi

script_content="$(base64 <"$script_file" | tr -d '\r\n')"
script_body="$(jq -n \
  --arg displayName "$display_name" \
  --arg description "Writes the agentdesktop controller bootstrap and public trust root." \
  --arg scriptContent "$script_content" \
  --arg fileName "$(basename "$script_file")" \
  '{
    "@odata.type": "#microsoft.graph.deviceShellScript",
    executionFrequency: "P1D",
    retryCount: 3,
    blockExecutionNotifications: true,
    displayName: $displayName,
    description: $description,
    scriptContent: $scriptContent,
    runAsAccount: "system",
    fileName: $fileName
  }')"
assignment_body="$(jq -n \
  --arg groupId "$group_id" \
  '{
    deviceManagementScriptGroupAssignments: [{
      "@odata.type": "#microsoft.graph.deviceManagementScriptGroupAssignment",
      targetGroupId: $groupId
    }],
    deviceManagementScriptAssignments: []
  }')"

if [[ "$dry_run" == "true" ]]; then
  jq -n \
    --arg endpoint "https://graph.microsoft.com/beta/deviceManagement/deviceShellScripts" \
    --arg displayName "$display_name" \
    --arg groupId "$group_id" \
    --arg fileName "$(basename "$script_file")" \
    --argjson scriptBytes "$(wc -c <"$script_file")" \
    '{endpoint:$endpoint,displayName:$displayName,groupId:$groupId,fileName:$fileName,scriptBytes:$scriptBytes,executionFrequency:"P1D",retryCount:3,runAsAccount:"system"}'
  exit 0
fi

graph_base="https://graph.microsoft.com/beta"
if ! subscribed_skus="$(az rest \
  --method GET \
  --url 'https://graph.microsoft.com/v1.0/subscribedSkus?$select=skuPartNumber,capabilityStatus,servicePlans' \
  --output json 2>/dev/null)"; then
  printf 'Azure CLI could not read tenant subscriptions from Microsoft Graph. Reauthenticate to the target tenant.\n' >&2
  exit 1
fi
if ! jq -e '
  any(.value[];
    .capabilityStatus == "Enabled" and
    any(.servicePlans[];
      (.servicePlanName | ascii_upcase | contains("INTUNE")) and
      .provisioningStatus == "Success"
    )
  )
' <<<"$subscribed_skus" >/dev/null; then
  cat >&2 <<'EOF'
This Microsoft Entra tenant has no active Microsoft Intune service plan. The
Intune Graph API returns "Request not applicable to target tenant" until you add
an Intune Plan 1 license or trial, initialize the Intune MDM authority, and
license the enrolling user or device.
EOF
  exit 1
fi

graph_error="$(mktemp)"
trap 'rm -f "$graph_error"' EXIT
if ! scripts="$(az rest \
  --method GET \
  --url "${graph_base}/deviceManagement/deviceShellScripts?\$select=id,displayName" \
  --output json 2>"$graph_error")"; then
  cat "$graph_error" >&2
  if grep -qi 'Request not applicable to target tenant' "$graph_error"; then
    cat >&2 <<'EOF'
The tenant has an Intune service plan, but Intune is not ready for API access.
Open https://intune.microsoft.com, set the MDM authority to Microsoft Intune,
and wait for tenant provisioning to finish before retrying.
EOF
  elif grep -Eqi '403|Forbidden|Authorization_RequestDenied|Insufficient privileges' "$graph_error"; then
    cat >&2 <<'EOF'
Azure CLI could not access Intune through Microsoft Graph. Sign in to the target
tenant with an administrator identity and obtain admin consent for the delegated
permission DeviceManagementScripts.ReadWrite.All, then retry.
EOF
  else
    cat >&2 <<'EOF'
Azure CLI could not access the Intune deviceShellScript API. Verify tenant
provisioning, the Intune Administrator role, and the admin-consented delegated
permission DeviceManagementScripts.ReadWrite.All. This script uses Graph beta
because the macOS deviceShellScript API is not available in v1.0.
EOF
  fi
  exit 1
fi

matches="$(jq --arg name "$display_name" '[.value[] | select(.displayName == $name)]' <<<"$scripts")"
match_count="$(jq 'length' <<<"$matches")"

if (( match_count == 0 )) && [[ "$display_name" == "agentdesktop bootstrap" ]]; then
  legacy_matches="$(jq --arg name "$legacy_display_name" '[.value[] | select(.displayName == $name)]' <<<"$scripts")"
  legacy_match_count="$(jq 'length' <<<"$legacy_matches")"
  if (( legacy_match_count > 1 )); then
    printf 'More than one Intune shell script has legacy display name %q; refusing an ambiguous update.\n' "$legacy_display_name" >&2
    exit 1
  fi
  if (( legacy_match_count == 1 )); then
    matches="$legacy_matches"
    match_count=1
  fi
fi
if (( match_count > 1 )); then
  printf 'More than one Intune shell script has display name %q; refusing an ambiguous update.\n' "$display_name" >&2
  exit 1
fi

if (( match_count == 0 )); then
  created="$(az rest \
    --method POST \
    --url "${graph_base}/deviceManagement/deviceShellScripts" \
    --body "$script_body" \
    --output json)"
  script_id="$(jq -er .id <<<"$created")"
else
  script_id="$(jq -r '.[0].id' <<<"$matches")"
  az rest \
    --method PATCH \
    --url "${graph_base}/deviceManagement/deviceShellScripts/${script_id}" \
    --body "$script_body" \
    --output none
fi

# The assign action replaces this script's assignment set; this command owns it.
az rest \
  --method POST \
  --url "${graph_base}/deviceManagement/deviceShellScripts/${script_id}/assign" \
  --body "$assignment_body" \
  --output none

printf 'Created or updated Intune macOS shell script %s and assigned group %s.\n' \
  "$script_id" "$group_id"