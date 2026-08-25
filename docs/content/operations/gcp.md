---
title: Deploy on Google Cloud
description: Deploy agentdesktop on Google Kubernetes Engine, configure Microsoft Entra ID, and enroll a managed macOS pilot through Microsoft Intune.
weight: 2
---

Deploy agentdesktop into a new Google Cloud project, then enroll one managed
macOS pilot through Microsoft Entra ID and Intune. The downloadable GCP
deployment kit supplies the Terraform, Helm chart, and helper scripts.

The deployment creates:

- a private-node regional GKE cluster;
- an agentdesktop controller exposed through an L4 load balancer;
- a single PostgreSQL process on a retained regional persistent disk;
- daily PostgreSQL backups in a retention-protected GCS bucket;
- a single-tenant Entra public client for interactive enrollment; and
- an Intune-delivered macOS PKG and machine bootstrap.

This is a concrete implementation of the broader [production deployment](../production/)
guidance. Read its production boundaries before expanding beyond a pilot. In
particular, this template does not provide automatic PostgreSQL failover.

## Get the deployment kit

Download and extract the deployment kit directly from this website:

```sh
curl --fail --location \
  --output agentdesktop-gcp-deployment-kit.zip \
  https://agentdesktop.io/docs/downloads/agentdesktop-gcp-deployment-kit.zip

unzip agentdesktop-gcp-deployment-kit.zip
cd agentdesktop-gcp-deployment-kit
```

The deployment command builds the controller from an agentdesktop source
checkout. Obtain that source through your approved distribution channel and
place it beside the extracted directory as `agentdesktop`, or pass its location
with `AGENTDESKTOP_SOURCE_DIR` in step 2.

The included `deploy/gcp/README.md` is the operator reference for the kit's
commands and files.

The archive contains the GCP operator runbook, deployment command, Terraform
module and provider lock file, PostgreSQL Helm chart, helper scripts, initial
daemon policy, and local Kind deployment gate. It excludes local Terraform
state, `.env.production`, private PKI, provider downloads, and generated tenant
payloads. Recreate generated payloads from the included renderers and protect
state and private keys in approved encrypted systems.

Run the local deployment gate before creating cloud resources:

```sh
./deploy/kind/smoke-test.sh
```

The smoke test uses the same PostgreSQL chart and controller overlay in a
disposable Kind cluster. It verifies image availability, persistence, OIDC
startup, TLS, and application readiness.

## Prerequisites

Prepare an existing billing-enabled Google Cloud project and install:

- Google Cloud CLI;
- Terraform 1.8 or newer;
- `kubectl`;
- Helm;
- Docker with Buildx and AMD64/ARM64 emulation;
- OpenSSL 3;
- `curl`; and
- `jq`.

Authenticate the Google Cloud CLI and Terraform provider:

```sh
gcloud auth login
gcloud auth application-default login
```

The Google Cloud identity needs permission to enable project services and
administer GKE, Compute Engine networking, Artifact Registry, IAM service
accounts, Cloud Storage, and Secret Manager.

For the macOS endpoint portion, also prepare:

- a Microsoft Entra tenant;
- Microsoft Intune Plan 1 or a bundle that includes it;
- an Intune-licensed native work or school pilot user;
- an Apple MDM push certificate in Intune; and
- a signed and notarized agentdesktop PKG.

An Azure subscription does not include Intune. Confirm **Tenant administration
> Tenant status** in the Intune admin center shows Microsoft Intune as the MDM
authority and a nonzero license count before configuring endpoint delivery.

## 1. Create the GCP infrastructure

Run the interactive infrastructure command from the extracted deployment kit
root:

```sh
./deploy/gcp/deploy.sh infra
```

For unattended execution, provide all required values:

```sh
CONTROLLER_HOSTNAME=agentdesktop.example.com \
PROJECT_ID=my-production-project \
REGION=us-central1 \
ADMIN_CIDR=203.0.113.10/32 \
NONINTERACTIVE=true \
./deploy/gcp/deploy.sh infra
```

Set optional controller aliases before running `infra`:

```sh
export CONTROLLER_DNS_ALIASES_JSON='["fleet.example.com"]'
```

Terraform creates the network, private-node GKE cluster, external controller
address, private Artifact Registry, backup bucket, Workload Identity binding,
and empty Secret Manager containers. It does not create the Google Cloud
project, billing account, DNS zone, or identity-provider application.

The command prints the DNS records to create with the current provider:

- Create an A record from the controller hostname to the reserved IPv4 address.
- Create each optional alias as a CNAME to the controller hostname.
- Wait until authoritative DNS returns the reserved address.

For Cloudflare, use **DNS only**. Its normal proxy terminates TLS, but the fleet
API requires end-to-end HTTP/2 and client-certificate delivery to the
controller.

The command writes non-secret deployment coordinates to the ignored
`deploy/gcp/.env.production` file. Configure a locked, encrypted remote
Terraform backend before the first apply in a team-operated environment.

## 2. Build and push the controller

Point the deployment at the adjacent agentdesktop source checkout:

```sh
AGENTDESKTOP_SOURCE_DIR=../agentdesktop \
./deploy/gcp/deploy.sh build
```

The command builds `linux/amd64` and `linux/arm64` images from the same source
snapshot, pushes one multi-platform manifest to the private Artifact Registry,
verifies both platforms, and records the immutable tag and digest. It does not
install a Helm release.

## 3. Create the Entra enrollment application

Sign in to the Entra tenant that contains the users who will enroll:

```sh
az login --tenant TENANT_ID
./deploy/gcp/scripts/create-entra-app.sh
```

The helper creates or updates a single-tenant public client with:

- loopback redirect URI `http://127.0.0.1:51327/callback`;
- Authorization Code flow with PKCE;
- delegated scopes `openid`, `profile`, `email`, and `offline_access`;
- no client secret; and
- **Assignment required** on the Enterprise Application.

Copy the two `export OIDC_...` lines printed by the helper into the shell that
will run the install command. Running a script cannot export values back into
its parent shell.

A Global Administrator must grant tenant-wide consent for the four declared
scopes:

```sh
az ad app permission admin-consent --id "$OIDC_CLIENT_ID"
```

The equivalent portal action is **App registrations > agentdesktop enrollment
> API permissions > Grant admin consent**. Without this grant, Entra reports
that agentdesktop needs permission that only an administrator can grant.

Next open **Enterprise applications > agentdesktop enrollment > Users and
groups** and assign each pilot user or an approved group. This assignment
controls who may enroll. It is separate from the Intune device group used to
deliver software.

### Verify the tenant and client together

Do not continue with an issuer copied from one tenant and a client ID created in
another. Check all three values in the same Azure CLI session:

```sh
TENANT_ID="$(az account show --query tenantId --output tsv)"

test "$OIDC_ISSUER" = \
  "https://login.microsoftonline.com/${TENANT_ID}/v2.0"

az ad app show \
  --id "$OIDC_CLIENT_ID" \
  --query '{appId:appId,displayName:displayName,signInAudience:signInAudience}' \
  --output table
```

The test must succeed and `az ad app show` must return `agentdesktop enrollment`.
An Entra **App launch failed** page naming another app ID means the controller
was installed with stale OIDC values.

## 4. Generate the deployment PKI

For a private controller trust root, generate the controller, device, and
PostgreSQL identities locally:

```sh
CONTROLLER_DNS_ALIASES=fleet.example.com \
./deploy/gcp/scripts/generate-pki.sh \
  agentdesktop.example.com \
  ./deploy/gcp/agentdesktop-pki
```

Omit `CONTROLLER_DNS_ALIASES` when no aliases are used. Every hostname used by a
daemon must be present in the controller certificate SAN.

The PKI directory is ignored by Git. Back it up to an approved encrypted
secret-management workflow before deleting any local private keys. Only the
public `controller-ca.pem` is distributed to endpoints.

To use a publicly issued controller certificate, replace `controller.pem` and
`controller-key.pem` with the public chain and matching unencrypted key. Keep
the generated private device and PostgreSQL CAs.

## 5. Install PostgreSQL and the controller

Start with the committed empty policy so enrollment can be validated before
developer-tool settings are managed:

```sh
export PKI_DIRECTORY=./deploy/gcp/agentdesktop-pki
export DAEMON_CONFIG_FILE=./deploy/gcp/daemon.empty.yaml

./deploy/gcp/deploy.sh install
```

The shell must still contain the exact `OIDC_ISSUER` and `OIDC_CLIENT_ID`
exports printed in step 3. For unattended execution, make every value explicit:

```sh
OIDC_ISSUER="https://login.microsoftonline.com/TENANT_ID/v2.0" \
OIDC_CLIENT_ID="APPLICATION_CLIENT_ID" \
PKI_DIRECTORY=./deploy/gcp/agentdesktop-pki \
DAEMON_CONFIG_FILE=./deploy/gcp/daemon.empty.yaml \
NONINTERACTIVE=true \
./deploy/gcp/deploy.sh install
```

The command validates OIDC discovery and the PKI, stores source values in
Secret Manager, creates Kubernetes Secrets, installs PostgreSQL, and installs
the controller with the recorded image. Existing secret values are not replaced
unless `ALLOW_SECRET_ROTATION=true` is set for a planned rotation.

Gateway JWT issuance is disabled by default. Set `ENABLE_GATEWAY_JWT=true` only
after the distributed daemon policy configures an inference gateway that uses
controller-issued credentials. Increase `DAEMON_CONFIG_REVISION` whenever that
policy changes.

### Verify the deployed OIDC identity

Before enrolling a device, confirm the controller received the same issuer and
client ID verified in step 3:

```sh
kubectl -n agentdesktop get secret agentdesktop-controller-config \
  -o jsonpath='{.data.controller\.yaml}' |
  base64 --decode |
  awk '/^oidc:/{show=1} show{print} show && /^$/{exit}'
```

If either value is stale, rerun `deploy.sh install` with the correct explicit
OIDC values. This performs a brief controller rollout while preserving the
database, PKI, DNS address, and recorded image.

## 6. Verify the deployment

After DNS propagation, run the supported deployment check:

```sh
./deploy/gcp/deploy.sh verify
```

It checks both rollouts, the reserved Service address, certificate hostname,
and HTTP/2 ALPN negotiation.

The management UI remains loopback-only. Start the reconnecting port-forward
helper:

```sh
./deploy/gcp/scripts/port-forward-admin.sh
```

Open [http://127.0.0.1:18080](http://127.0.0.1:18080). Pass another local port
as the helper's only argument when needed. The public controller hostname serves
the fleet API, not the management UI; an HTTPS request to `/` may correctly
return `404`.

## 7. Prepare the macOS payload

Use a signed and notarized release PKG. A local package built with no Apple
identities is useful for development but is not a production Intune artifact.

If building from source, install both **Developer ID Application** and
**Developer ID Installer** certificates, including their private keys, and
confirm macOS can find them:

```sh
security find-identity -v -p codesigning | grep "Developer ID Application"
security find-identity -v -p basic | grep "Developer ID Installer"
```

Build with the dedicated PKG command from the agentdesktop source repository:

```sh
cd ../agentdesktop/frontend
pnpm install --frozen-lockfile

export APPLE_SIGNING_IDENTITY="Developer ID Application: Example, Inc. (TEAMID)"
export APPLE_INSTALLER_SIGNING_IDENTITY="Developer ID Installer: Example, Inc. (TEAMID)"

pnpm --filter @agentdesktop/desktop-web dist:mac
cd ../../agentdesktop-website
```

Assign the printed package path to `PKG`, submit it to the Apple notary service,
and staple the accepted ticket:

```sh
PKG="/absolute/path/printed/by-the-build/Agent Desktop_VERSION_ARCH.pkg"

xcrun notarytool submit "$PKG" \
  --keychain-profile agentdesktop-notary \
  --wait
xcrun stapler staple "$PKG"
```

Require every release check to pass:

```sh
pkgutil --check-signature "$PKG"
spctl --assess --type install --verbose=4 "$PKG"
xcrun stapler validate "$PKG"
```

`Status: no signature` means the package was built without
`APPLE_INSTALLER_SIGNING_IDENTITY`. Rebuild after both signing identities are
available; signing only the outer package later does not repair an improperly
signed nested application.

Render the tenant-specific root bootstrap from the controller hostname and
public controller CA:

```sh
source deploy/gcp/.env.production

./deploy/gcp/scripts/render-intune-bootstrap.sh \
  "${CONTROLLER_HOSTNAME}" \
  deploy/gcp/agentdesktop-pki/controller-ca.pem \
  deploy/gcp/generated/agentdesktop-bootstrap.sh
```

The generated script writes `/etc/agentdesktop/config.yaml`, installs the public
controller CA, restarts an existing daemon only when content changes, and adds
the current console user to the local `agentdesktop` group.

## 8. Assign the pilot in Intune

Complete [Prepare the Intune tenant](../intune/#prepare-the-intune-tenant) and
[Deploy macOS](../intune/#deploy-macos) with these deployment values:

- signed package: `$PKG` from step 7;
- bootstrap script: `deploy/gcp/generated/agentdesktop-bootstrap.sh`;
- pilot device group: `AgentDesktop-Pilot-macOS`; and
- enrollment Enterprise Application: the app created in step 3.

Assign the pilot user to the Enterprise Application and the pilot Mac to the
Intune device group. Both assignments are required.

To manage the bootstrap through Microsoft Graph beta, follow [Automate the
bootstrap with Microsoft Graph](../intune/#automate-the-bootstrap-with-microsoft-graph)
using the helper included in the deployment kit. The signed PKG remains a portal
upload.

## 9. Enroll and validate the pilot

Once both Intune assignments report success, follow [Enrollment
timing](../intune/#enrollment-timing) to complete the Entra flow with the
assigned pilot account.

Then validate locally:

```sh
pkgutil --pkg-info dev.agentdesktop.installer
launchctl print system/dev.agentdesktop.daemon
"/Applications/agentdesktop.app/Contents/MacOS/agentdesktop" status
```

In the controller UI, confirm the expected user, hostname, operating system,
architecture, agent version, and **Applied** configuration revision.

### Enrollment troubleshooting

| Symptom | Check |
| --- | --- |
| agentdesktop needs permission only an admin can grant | Grant tenant-wide consent for the four declared scopes. |
| `AADSTS50105` | Assign the user or an approved group to the agentdesktop Enterprise Application. |
| **App launch failed** names an unexpected app ID | Compare the browser's app ID with the live controller Secret and rerun `deploy.sh install` with the current tenant issuer and client ID. |
| The app ID does not exist | Authenticate Azure CLI to the issuer's tenant and verify that the client ID was created there. |
| Enrollment page expired | Restart the machine daemon to create a new 10-minute attempt. |
| TLS or trust failure | Check DNS, certificate SANs, full chain, endpoint clock, and the deployed `controller-ca.pem`. |

## Back up and remove the deployment

Start and observe an on-demand database backup:

```sh
./deploy/gcp/deploy.sh backup
```

List retained backup objects:

```sh
gcloud storage ls --recursive \
  "gs://$(terraform -chdir=deploy/gcp/terraform output -raw postgres_backup_bucket)/daily/"
```

Test restoration in an isolated cluster before depending on it. Restoration is
not automatic and must use PostgreSQL 18 `pg_restore` while the controller and
scheduled backup are stopped.

Destroy only resources owned by this Terraform state:

```sh
./deploy/gcp/deploy.sh destroy
```

The command disables cluster deletion protection, destroys the stack, and
removes `.env.production`. It does not delete unrelated project resources or
identity-provider configuration.
