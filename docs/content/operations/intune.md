---
title: Deploy through Microsoft Intune
description: Deploy agentdesktop to managed macOS and Windows devices with Microsoft Intune packages, bootstrap configuration, enrollment, and health checks.
weight: 3
---

Microsoft Intune installs agentdesktop in the machine context, writes the
controller bootstrap, and reports installation status for macOS and Windows.
Complete the controller, OIDC, certificate, and policy setup in [Production
deployment](../production/) before assigning endpoint packages.

Microsoft Entra ID authorizes users to enroll. Intune manages the endpoint and
delivers its software and bootstrap configuration. Configure both systems for
each pilot user and device.

| Platform | Application | Bootstrap files |
| --- | --- | --- |
| macOS | Required unmanaged macOS PKG app | Idempotent root shell script |
| Windows | Required Windows app (Win32) | Files bundled with the MSI inside one `.intunewin` package |

Download the macOS PKG and Windows MSI for the same reviewed release as the
controller. Verify their published checksums and platform signatures before
uploading them. Building or signing endpoint installers is outside this
deployment workflow.

For Jamf Pro, Kandji, or Fleet, use the [MDM integrations](../mdm-integrations/)
mappings.

The bootstrap and controller CA certificate are public configuration and trust
material. Never put the device CA key, controller TLS key, gateway signing key,
database URL, provider credentials, or any other secret in Intune scripts or
app content.

## Prepare the Intune tenant

Confirm that:

- the tenant has an Intune subscription and reports Microsoft Intune as its MDM
  authority under **Tenant administration > Tenant status**;
- the pilot user has an Intune license and is a native work or school account
  in the same Entra tenant used for agentdesktop enrollment; and
- the operator has the **Intune Administrator** role.

An Azure subscription such as Visual Studio does not include Microsoft Intune.
If Microsoft Graph returns `Request not applicable to target tenant`, add
Microsoft Intune Plan 1 or a Microsoft 365 bundle that includes it, or start the
[30-day Intune Plan 1
trial](https://go.microsoft.com/fwlink/?linkid=2019088). Confirm a nonzero
license count under **Tenant administration > Tenant status** and assign a seat
to the pilot user or use an eligible device-only license.

Do not use a personal Microsoft account invited into the tenant as the licensed
enrollment account. It can appear as a member while retaining an external
`#EXT#` identity. Create a cloud user under **Identity > Users > All users > New
user > Create new user** in the [Microsoft Entra admin
center](https://entra.microsoft.com), set **Usage location**, and grant only the
role needed to activate the subscription. Assign its Intune license under
**Users > Active users > Licenses and apps** in the [Microsoft 365 admin
center](https://admin.microsoft.com). Remove any temporary Global Administrator
access after setup.

Prepare these Microsoft Entra device groups before uploading packages:

- `AgentDesktop-Pilot-macOS`
- `AgentDesktop-Pilot-Windows`
- one macOS and one Windows group for each later rollout ring

Assign applications and scripts to device groups so installation runs in the
machine context and remains predictable on shared devices. Enterprise
Application assignments authorize enrollment users; Intune device groups target
software and scripts. Do not use **All devices** as a shortcut for a package
that has not passed the pilot.

### Enroll macOS devices

Configure the Apple MDM push certificate under **Devices > Enrollment > Apple**
and renew it with the same Apple ID before it expires.

For a manually enrolled pilot Mac that is not yet in Apple Business Manager:

1. Download and install [Microsoft Company Portal for
   macOS](https://go.microsoft.com/fwlink/?linkid=853070).
2. Sign in with the licensed pilot user's Entra account and complete the
   management-profile prompts in macOS System Settings.
3. Confirm the Mac appears under **Devices > All devices** and add it to
   `AgentDesktop-Pilot-macOS`.
4. Confirm `/Library/Intune/Microsoft Intune Agent.app` is installed before
   expecting shell-script or unmanaged-PKG delivery.

For corporate Macs, configure [Apple Automated Device
Enrollment](https://learn.microsoft.com/en-us/intune/device-enrollment/apple/setup-automated-macos):

1. Add the Apple MDM push certificate and Apple Business Manager
   enrollment-program token in Intune.
2. Go to **Devices > Device onboarding > Enrollment > macOS > Enrollment
   program tokens**.
3. Create a policy with **User affinity**, **Setup Assistant with modern
   authentication**, **Await final configuration**, and **Locked enrollment**.
4. Assign Company Portal and the enrollment policy to the pilot devices.
5. Verify `/Library/Intune/Microsoft Intune Agent.app` is installed.

### Enroll Windows devices

For corporate Windows devices, enable [automatic MDM
enrollment](https://learn.microsoft.com/en-us/intune/device-enrollment/windows/enable-automatic-mdm):

1. Confirm the tenant has Intune and Microsoft Entra ID P1 or P2 licensing.
2. Go to **Devices > Device onboarding > Enrollment > Windows > Automatic
   Enrollment**.
3. Set **MDM user scope** to the pilot users, then expand it with the rollout.
4. Enroll organization-owned devices through Windows Autopilot or Microsoft
   Entra join.

The Intune Management Extension installs automatically when a Win32 app is
assigned. Intune delivery is asynchronous. During a pilot, force **Sync** from
the device record or **Check status** in Company Portal, but allow for normal
agent check-in delays.

## Create the endpoint bootstrap

The endpoint bootstrap contains only the controller connection. The controller
continues to distribute gateway and developer-tool policy.

Use this file when the controller certificate chains to a root already trusted
by the operating system:

```yaml
controller:
  address: https://agentdesktop.example.com
  heartbeatInterval: 30s
```

For a private controller CA, macOS uses:

```yaml
controller:
  address: https://agentdesktop.example.com
  caCertificatePath: /etc/agentdesktop/controller-ca.pem
  heartbeatInterval: 30s
```

Windows uses `C:/ProgramData/AgentDesktop/controller-ca.pem` for the private CA
path. The controller address must use HTTPS.

## Deploy macOS

The Agent Desktop PKG installs:

- `/Applications/agentdesktop.app`;
- the `dev.agentdesktop.daemon` system LaunchDaemon;
- `/etc/agentdesktop/config.yaml` when it does not already exist; and
- private state under `/var/lib/agentdesktop`.

Before upload, require all three local checks to pass:

```sh
pkgutil --check-signature AgentDesktop.pkg
spctl --assess --type install --verbose=4 AgentDesktop.pkg
xcrun stapler validate AgentDesktop.pkg
```

The package must have a trusted **Developer ID Installer** signature, pass
Gatekeeper assessment, and contain a valid notarization ticket. Intune may
accept an unsigned unmanaged PKG, but production deployments still require a
signed and notarized package.

Upload the package with Microsoft's [unmanaged macOS PKG app
workflow](https://learn.microsoft.com/en-us/intune/app-management/deployment/add-unmanaged-pkg-macos):

1. Go to **Apps > All Apps > Create**.
2. Select **macOS app (PKG)** and upload the approved package. It must be smaller
   than 8 GB and install successfully with macOS `installer` before upload.
3. Set the minimum operating system to macOS 12 or later.
4. Under detection rules, retain only bundle ID `dev.agentdesktop.tray` and the
   release's bundle version. Set **Ignore app version** to **No**.
5. Assign the app as **Required** to `AgentDesktop-Pilot-macOS`.

Intune's unmanaged macOS PKG type has no **Uninstall** assignment. Use a
dedicated offboarding script before retiring a Mac from Intune.

### Render the macOS bootstrap

The GCP deployment kit renders an environment-specific root script from the
controller hostname and public controller CA:

```sh
source deploy/gcp/.env.production

./deploy/gcp/scripts/render-intune-bootstrap.sh \
  "${CONTROLLER_HOSTNAME}" \
  deploy/gcp/agentdesktop-pki/controller-ca.pem \
  deploy/gcp/generated/agentdesktop-bootstrap.sh
```

Upload the generated `agentdesktop-bootstrap.sh` to Intune. The public
controller CA is trust material; do not substitute the device CA or any private
key.

For a manual workflow, create `agentdesktop-bootstrap.sh` with the following
contents. Replace the controller address and complete PEM block. When using
public trust, remove `caCertificatePath`, `CA_PATH`, and the second
`write_managed_file` call.

```sh
#!/bin/sh
set -eu

CONFIG_DIR=/etc/agentdesktop
CONFIG_PATH="${CONFIG_DIR}/config.yaml"
CA_PATH="${CONFIG_DIR}/controller-ca.pem"
changed=0

write_managed_file() {
  target="$1"
  mode="$2"
  temporary=$(/usr/bin/mktemp "${target}.XXXXXX")
  /bin/cat > "${temporary}"

  if [ -f "${target}" ] && /usr/bin/cmp -s "${temporary}" "${target}"; then
    /bin/rm -f "${temporary}"
    /usr/sbin/chown root:wheel "${target}"
    /bin/chmod "${mode}" "${target}"
    return
  fi

  /usr/sbin/chown root:wheel "${temporary}"
  /bin/chmod "${mode}" "${temporary}"
  /bin/mv -f "${temporary}" "${target}"
  changed=1
}

/usr/bin/install -d -o root -g wheel -m 0755 "${CONFIG_DIR}"

write_managed_file "${CONFIG_PATH}" 0600 <<'YAML'
controller:
  address: https://agentdesktop.example.com
  caCertificatePath: /etc/agentdesktop/controller-ca.pem
  heartbeatInterval: 30s
YAML

write_managed_file "${CA_PATH}" 0644 <<'PEM'
-----BEGIN CERTIFICATE-----
REPLACE_WITH_THE_COMPLETE_CONTROLLER_CA_CERTIFICATE
-----END CERTIFICATE-----
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
```

Upload it with Intune's [macOS shell-script
workflow](https://learn.microsoft.com/en-us/intune/device-management/tools/run-shell-scripts-macos):

1. Go to **Devices > By platform > macOS > Manage devices > Scripts > Add**.
2. Upload `agentdesktop-bootstrap.sh`.
3. Set **Run script as signed-in user** to **No**.
4. Set **Hide script notifications** according to support policy, **Script
   frequency** to **Every 1 day**, and retries to **3**.
5. Assign the script to `AgentDesktop-Pilot-macOS`.

Select the Mac under **Devices > All devices** and choose **Sync**. On the Mac,
open Company Portal, select the device, and choose **Check settings**.

### Automate the bootstrap with Microsoft Graph

Azure CLI has no first-class `az intune app create` command. The deployment kit
can create or update the bootstrap shell script with `az rest` against Microsoft
Graph beta. The signed PKG remains a portal upload because package delivery
requires client-side encryption, a service-provided Azure Storage SAS URI,
binary upload, encryption metadata, and publishing-state polling.

Render the script and obtain the pilot security group's Entra **Object ID**.
`GROUP_ID` is not the enrollment application's client ID or Enterprise
Application object ID.

```sh
source deploy/gcp/.env.production

./deploy/gcp/scripts/render-intune-bootstrap.sh \
  "${CONTROLLER_HOSTNAME}" \
  deploy/gcp/agentdesktop-pki/controller-ca.pem \
  deploy/gcp/generated/agentdesktop-bootstrap.sh

# Create the deployment group once:
GROUP_ID="$(az ad group create \
  --display-name AgentDesktop-Pilot-macOS \
  --mail-nickname agentdesktop-pilot-macos \
  --query id --output tsv)"

# On later runs, retrieve its existing Object ID:
# GROUP_ID="$(az ad group show \
#   --group AgentDesktop-Pilot-macOS \
#   --query id --output tsv)"
```

The signed-in Azure CLI identity needs the Intune Administrator role, an active
Intune license, and admin-consented delegated Microsoft Graph permission
`DeviceManagementScripts.ReadWrite.All`. If necessary, clear the old login and
request that scope interactively:

```sh
az logout
az login \
  --tenant TENANT_ID \
  --scope "https://graph.microsoft.com/DeviceManagementScripts.ReadWrite.All"
```

`Request not applicable to target tenant` means Intune is not licensed or
initialized. A `403 Forbidden` or `Authorization_RequestDenied` response after
activation means the Graph permission or administrator role is missing.

Inspect and apply the script:

```sh
./deploy/gcp/scripts/upsert-intune-bootstrap.sh \
  deploy/gcp/generated/agentdesktop-bootstrap.sh \
  "${GROUP_ID}" \
  --dry-run

./deploy/gcp/scripts/upsert-intune-bootstrap.sh \
  deploy/gcp/generated/agentdesktop-bootstrap.sh \
  "${GROUP_ID}"
```

The helper:

- uses the Graph beta `deviceShellScript` API;
- runs the script as `system`;
- sets daily execution and three retries; and
- owns one group assignment for the `agentdesktop bootstrap` script.

Review the helper whenever Microsoft changes the beta API. Assign the pilot
user to the agentdesktop Enterprise Application and the pilot device to the
Intune group.

The script can arrive before or after the PKG. It restarts the daemon only when
file content changes, and the PKG preserves a configuration that arrived first.
Intune macOS shell scripts require macOS 12 or later, the Intune management
agent, and direct internet connectivity; Microsoft does not support this script
channel through a proxy.

The PKG creates the local `agentdesktop` group and adds existing local users.
The daily bootstrap also adds the current console user. The user may need to
sign out and back in before existing processes receive new group membership.

Verify the pilot Mac locally and in Intune's app and script status reports:

```sh
pkgutil --pkg-info dev.agentdesktop.installer
launchctl print system/dev.agentdesktop.daemon
"/Applications/agentdesktop.app/Contents/MacOS/agentdesktop" status
```

## Deploy Windows

Deliver the signed MSI, bootstrap, optional controller CA, and installation
logic as one [Windows app
(Win32)](https://learn.microsoft.com/en-us/intune/app-management/deployment/add-win32).
Do not mix a line-of-business MSI assignment with Win32 packages during Windows
Autopilot enrollment.

The GCP `render-intune-bootstrap.sh` helper generates a macOS shell script; it
does not generate the Windows `config.yaml`. From the extracted deployment kit
root, create the equivalent Windows bootstrap from `.env.production`:

```sh
source deploy/gcp/.env.production

WINDOWS_INTUNE_DIR=deploy/gcp/generated/windows-intune
mkdir -p "${WINDOWS_INTUNE_DIR}"

cat >"${WINDOWS_INTUNE_DIR}/config.yaml" <<EOF
controller:
  address: https://${CONTROLLER_HOSTNAME}
  caCertificatePath: C:/ProgramData/AgentDesktop/controller-ca.pem
  heartbeatInterval: 30s
EOF

cp deploy/gcp/agentdesktop-pki/controller-ca.pem \
  "${WINDOWS_INTUNE_DIR}/controller-ca.pem"
```

The generated directory is ignored by Git. Copy only `config.yaml` and the
public `controller-ca.pem` to the Windows packaging host. Do not copy any
`*-key.pem` file. When the controller uses a publicly trusted certificate,
remove `caCertificatePath` from `config.yaml` and omit `controller-ca.pem`.

On a Windows packaging host, create this directory:

```text
C:\Intune\AgentDesktop\
  agentdesktop.msi
  config.yaml
  controller-ca.pem
  install.ps1
```

Omit `controller-ca.pem` when using public trust, and remove
`caCertificatePath` from `config.yaml`. Save `config.yaml` as UTF-8 without a
BOM.

Create `install.ps1`:

```powershell
$ErrorActionPreference = "Stop"
$releaseVersion = "0.1.0"
$msi = Join-Path $PSScriptRoot "agentdesktop.msi"
$configSource = Join-Path $PSScriptRoot "config.yaml"
$caSource = Join-Path $PSScriptRoot "controller-ca.pem"
$root = Join-Path $env:ProgramData "AgentDesktop"
$configDestination = Join-Path $root "config.yaml"
$caDestination = Join-Path $root "controller-ca.pem"
$stateKey = "HKLM:\SOFTWARE\AgentDesktop\Intune"

$signature = Get-AuthenticodeSignature $msi
if ($signature.Status -ne "Valid") {
  throw "Agent Desktop MSI signature is $($signature.Status)"
}

$process = Start-Process msiexec.exe -ArgumentList @(
  "/i", "`"$msi`"", "/qn", "/norestart"
) -Wait -PassThru
if ($process.ExitCode -notin @(0, 3010)) {
  throw "Agent Desktop MSI failed with exit code $($process.ExitCode)"
}

New-Item -ItemType Directory -Path $root -Force | Out-Null
Copy-Item $configSource $configDestination -Force
if (Test-Path $caSource) {
  Copy-Item $caSource $caDestination -Force
} elseif (Test-Path $caDestination) {
  Remove-Item $caDestination -Force
}

& icacls.exe $root /inheritance:r /grant:r `
  "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" `
  /T /C | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Could not restrict $root"
}

Restart-Service AgentDesktop
$service = Get-Service AgentDesktop
$service.WaitForStatus("Running", [TimeSpan]::FromSeconds(30))

$executable = Join-Path $env:ProgramFiles "Agent Desktop\agentdesktop.exe"
& $executable status | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Agent Desktop service is not reachable"
}

New-Item -Path $stateKey -Force | Out-Null
New-ItemProperty -Path $stateKey -Name ReleaseVersion `
  -Value $releaseVersion -PropertyType String -Force | Out-Null
New-ItemProperty -Path $stateKey -Name ConfigSha256 `
  -Value (Get-FileHash $configDestination -Algorithm SHA256).Hash `
  -PropertyType String -Force | Out-Null
$caHash = if (Test-Path $caDestination) {
  (Get-FileHash $caDestination -Algorithm SHA256).Hash
} else {
  ""
}
New-ItemProperty -Path $stateKey -Name CaSha256 `
  -Value $caHash -PropertyType String -Force | Out-Null
```

Update `$releaseVersion` for every release. The script validates the MSI
signature, installs as `SYSTEM`, writes the bootstrap files, restricts their
ACL, restarts the service, verifies the local API, and records file hashes for
detection.

### Convert the folder to `.intunewin`

Download `IntuneWinAppUtil.exe` from Microsoft's [Win32 Content Prep Tool
repository](https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool) and
place it outside `C:\Intune\AgentDesktop`. Keep the output directory outside the
source directory too, or a later conversion can package its previous output.

After signing `agentdesktop.msi` and adding all four source files, run:

```powershell
New-Item -ItemType Directory -Force C:\Intune\Output | Out-Null

& "C:\Tools\IntuneWinAppUtil.exe" `
  -c "C:\Intune\AgentDesktop" `
  -s "install.ps1" `
  -o "C:\Intune\Output" `
  -q
```

The command creates `C:\Intune\Output\install.intunewin`. Upload that file as
the **Windows app (Win32)** package. `detect.ps1` is not part of the source
folder; create it separately and upload it under the app's custom detection
rules.

Create `detect.ps1` separately and save it as UTF-8 with a BOM:

```powershell
$expectedVersion = "0.1.0"

try {
  $root = Join-Path $env:ProgramData "AgentDesktop"
  $state = Get-ItemProperty `
    "HKLM:\SOFTWARE\AgentDesktop\Intune" -ErrorAction Stop
  $config = Join-Path $root "config.yaml"
  $ca = Join-Path $root "controller-ca.pem"
  $executable = Join-Path $env:ProgramFiles "Agent Desktop\agentdesktop.exe"
  $service = Get-Service AgentDesktop -ErrorAction Stop

  if (-not (Test-Path $executable) -or
      -not (Test-Path $config) -or
      $state.ReleaseVersion -ne $expectedVersion -or
      $service.Status -ne "Running" -or
      (Get-FileHash $config -Algorithm SHA256).Hash -ne $state.ConfigSha256) {
    exit 1
  }
  if ($state.CaSha256 -and
      (-not (Test-Path $ca) -or
       (Get-FileHash $ca -Algorithm SHA256).Hash -ne $state.CaSha256)) {
    exit 1
  }

  Write-Output "Agent Desktop $($state.ReleaseVersion) is installed"
  exit 0
} catch {
  exit 1
}
```

Set `$expectedVersion` to the same value as `$releaseVersion` whenever a new app
version is created.

Add the package to Intune:

1. Go to **Apps > All Apps > Create > Windows app (Win32)** and upload
  `install.intunewin`.
2. On **Program**, enter these exact values:

  | Field | Value |
  | --- | --- |
  | Install command | `%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\install.ps1` |
  | Uninstall command | `msiexec.exe /x ".\agentdesktop.msi" /qn /norestart` |
  | Install behavior | **System** |
  | Device restart behavior | **No specific action** |

  Use `install.ps1` rather than `msiexec.exe /i` as the install command. The
  wrapper also writes `config.yaml` and the optional CA, restricts their ACLs,
  restarts the service, and verifies the local daemon API.
3. Keep return code `0` mapped to **Success** and map `3010` to **Soft reboot**.
  `install.ps1` treats both values as a successful MSI installation and exits
  successfully after configuration and health checks complete.
4. On **Requirements**, select the package's matching x64 or ARM64 architecture
  and supported minimum Windows version.
5. On **Detection rules**, choose **Use a custom detection script**, upload
  `detect.ps1`, set **Run script as 32-bit process on 64-bit clients** to
  **No**, and configure signature enforcement according to your PowerShell
  policy.
6. On **Assignments**, assign the app as **Required** to
  `AgentDesktop-Pilot-Windows`.

Build separate Win32 apps for x64 and ARM64. For an upgrade, create a new
versioned app and supersede the old one with **Uninstall previous version** set
to **No**, allowing the MSI's stable upgrade code to perform the upgrade. An
Intune **Uninstall** assignment removes the MSI payload but does not complete
device offboarding; follow the cleanup procedure in [Production
deployment](../production/#device-removal-and-offboarding).

## Enrollment timing

The installer starts the machine daemon immediately, but an enrollment attempt
begins only when the bootstrap contains a controller. The macOS PKG and
idempotent script can arrive in either order. On Windows, `install.ps1` installs
the MSI, writes the files, and restarts the service as one reported operation.

The daemon creates a 10-minute enrollment attempt when it starts with a
controller configured. Wait for both macOS assignments, or the Windows Win32
app, to report success before notifying the user. **Enroll device** opens the
authorization URL already held by the daemon; it does not create a new attempt.

If the attempt expires, restart the service immediately before the user opens
Agent Desktop:

```sh
# macOS
launchctl kickstart -k system/dev.agentdesktop.daemon
```

```powershell
# Windows
Restart-Service AgentDesktop
```

The user then opens Agent Desktop, selects **Enroll device**, and completes the
OIDC flow in the default browser.

agentdesktop stores device metadata under the machine state directory. The
private device key and OAuth tokens use the operating-system credential store
on macOS and Windows. On Linux they are owner-only files under the state
directory.

Continue with [Validate a pilot endpoint](../production/#8-validate-a-pilot-endpoint).
