# agentdesktop production deployment on GCP

This directory creates a regional GKE cluster and installs agentdesktop with an
in-cluster PostgreSQL database. DNS stays with your existing provider. The
workflow asks for the controller hostname before it creates infrastructure,
reserves a public IPv4 address, and prints the A and optional CNAME records to
create yourself.

For a start-to-finish path from a new Google Cloud project through Entra,
Intune, and one enrolled pilot Mac, follow the published
[Deploy on Google Cloud walkthrough](https://agentdesktop.dev/docs/operations/gcp/).
This README remains the source-tree operator reference for the commands and
files in this directory.

Before applying Terraform, run the [local Kind smoke test](../kind/). It uses
the same PostgreSQL chart and controller overlay with local-only platform
overrides, and verifies image availability, persistence, OIDC startup, TLS, and
application readiness in a disposable cluster.

## PostgreSQL choice

The database workload follows the PostgreSQL implementation shipped by
[kagent](https://github.com/kagent-dev/kagent/tree/main/helm/kagent):

- one Kubernetes `Deployment` with the `Recreate` strategy;
- a `ReadWriteOnce` PVC mounted at `/var/lib/postgresql/data`;
- `PGDATA=/var/lib/postgresql/data/pgdata`;
- `pg_isready` startup, readiness, and liveness probes;
- UID and GID 999; and
- `pgvector/pgvector:pg18-trixie`, the image selected by kagent's install path.

Kagent labels its bundled database as development-only. This deployment keeps
the same simple database model but adds non-default credentials, TLS, a
regional persistent disk, resource limits, a NetworkPolicy, Secret Manager,
and daily `pg_dump` backups to a protected GCS bucket.

It is still a single PostgreSQL process. A Pod or node restart causes a database
outage while Kubernetes reattaches the disk, and there is no automatic
PostgreSQL failover. Use a managed or operator-managed PostgreSQL service when
your recovery-time objective requires database-level high availability.

## What Terraform creates

- A custom VPC, subnet, secondary Pod and Service ranges, Cloud Router, and NAT.
- A private-node regional GKE cluster and autoscaling worker pool.
- A reserved regional external IPv4 address for the controller's L4 Service.
- A private regional Artifact Registry for locally built controller images.
- A versioned, retention-protected GCS PostgreSQL backup bucket.
- Workload Identity scoped to the PostgreSQL backup CronJob.
- Empty Secret Manager containers for database credentials and PKI material.

Terraform does not create a Google Cloud project, configure billing, manage a
DNS zone, or create an application in your identity provider. Those resources
belong to separate administrative boundaries.

## Prerequisites

Prepare an existing, billing-enabled Google Cloud project and install:

- Google Cloud CLI
- Terraform 1.8 or newer
- `kubectl`
- Helm
- Docker with Buildx and AMD64/ARM64 emulation
- OpenSSL 3
- `curl`
- `jq`

Authenticate both the CLI and Terraform provider:

```sh
gcloud auth login
gcloud auth application-default login
```

The caller needs permission to enable project services and administer GKE,
Compute Engine networking, Artifact Registry, IAM service accounts, Cloud
Storage, and Secret Manager in the selected project.

## 1. Create infrastructure and obtain DNS records

Run the interactive command. The controller hostname is its first question:

```sh
./deploy/gcp/deploy.sh infra
```

For unattended execution, provide the same values as environment variables:

```sh
CONTROLLER_HOSTNAME=agentdesktop.example.com \
PROJECT_ID=my-production-project \
REGION=us-central1 \
ADMIN_CIDR=203.0.113.10/32 \
NONINTERACTIVE=true \
./deploy/gcp/deploy.sh infra
```

Optional aliases are a JSON list:

```sh
export CONTROLLER_DNS_ALIASES_JSON='["fleet.example.com"]'
```

Terraform prints an A record for the controller hostname and a CNAME record for
each alias. Create those records in the current DNS provider. A CNAME target is
the controller hostname, never the IPv4 address. Wait for the A record to
resolve to Terraform's `controller_ipv4_address` output.

When the DNS provider is Cloudflare, set **Proxy status** to **DNS only** (gray
cloud). The normal Cloudflare proxy terminates TLS, but the fleet API requires
the controller to receive end-to-end TLS, HTTP/2, and endpoint client
certificates. An authoritative lookup must return the reserved GCP address, not
Cloudflare's `188.114.x.x` proxy addresses.

Non-secret deployment coordinates are written to the ignored
`deploy/gcp/.env.production` file. Terraform state remains local unless you
configure a remote backend before the first apply. Use a locked, encrypted
remote backend for a team-operated environment.

The command waits for every GKE node to report Ready before it returns.

## 2. Build and push the controller image

GKE cannot import an image from a workstation Docker daemon like Kind can. Push
the image to the private Artifact Registry created by Terraform instead. The
controller image embeds the management UI, so this is the only project image
that must be built.

From the extracted deployment kit root, point the build command at the current
agentdesktop source tree:

```sh
AGENTDESKTOP_SOURCE_DIR=../agentdesktop \
./deploy/gcp/deploy.sh build
```

The command waits for the GKE nodes again, builds `linux/amd64` and
`linux/arm64` from the same source snapshot, pushes one multi-platform manifest,
verifies both platforms, and records its immutable tag and digest. Dirty source
trees receive a timestamped tag so a later build cannot silently replace the
image selected for installation.

No Helm release or Kubernetes application resource is created by `infra` or
`build`.

## 3. Register the OIDC client

Create a public native application in the chosen identity provider:

- Authorization Code flow with PKCE `S256`
- redirect URI `http://127.0.0.1:51327/callback`
- scopes `openid`, `profile`, `email`, and `offline_access`
- ID tokens, refresh tokens, and UserInfo enabled
- no client secret

The install command fetches the discovery document and rejects an issuer that
does not exactly match its `issuer` field or omits the authorization, token,
JWKS, or UserInfo endpoint.

For Microsoft Entra ID, create a single-tenant app registration and edit its
current Microsoft Graph manifest. Set the existing fields as follows:

```json
"isFallbackPublicClient": true,
"publicClient": {
   "redirectUris": [
      "http://127.0.0.1:51327/callback"
   ]
}
```

Do not add the legacy Azure AD Graph properties `allowPublicClient` or
`replyUrlsWithType`; the current manifest editor rejects them. Leave
`web.implicitGrantSettings` disabled and do not create a client secret.

Use the canonical issuer returned by discovery. Entra may accept a tenant
domain in the discovery URL but return a tenant GUID in `issuer`:

```sh
curl --fail --silent --show-error \
   "https://login.microsoftonline.com/TENANT_ID_OR_DOMAIN/v2.0/.well-known/openid-configuration" |
   jq -r .issuer
```

Pass that output unchanged as `OIDC_ISSUER` and use the app registration's
Application (client) ID as `OIDC_CLIENT_ID`.

The issuer and client must belong to the same tenant. Verify both in the Azure
CLI session used to create the application:

```sh
TENANT_ID="$(az account show --query tenantId --output tsv)"

test "$OIDC_ISSUER" = \
   "https://login.microsoftonline.com/${TENANT_ID}/v2.0"

az ad app show \
   --id "$OIDC_CLIENT_ID" \
   --query '{appId:appId,displayName:displayName,signInAudience:signInAudience}' \
   --output table
```

The test must succeed and the application query must return the enrollment app.
Do not install the controller with an issuer copied from one tenant and a client
ID created in another.

Alternatively, create or converge the single-tenant registration and Enterprise
Application with GA Azure CLI commands:

```sh
az login --tenant TENANT_ID
./deploy/gcp/scripts/create-entra-app.sh
```

The helper creates no secret, declares only the `openid`, `profile`, `email`,
and `offline_access` delegated scopes, enables Assignment required, and prints
the exact `OIDC_ISSUER` and `OIDC_CLIENT_ID` exports. Run it with `--dry-run` to
inspect the commands without making changes.

Because Assignment required is enabled, a Global Administrator must grant
tenant-wide consent before anyone can enroll:

```sh
az ad app permission admin-consent --id OIDC_CLIENT_ID
```

The command grants only the four delegated scopes declared by the helper. The
same action is available under **App registrations > agentdesktop enrollment >
API permissions > Grant admin consent**. Without it, Entra reports that
agentdesktop needs permission that only an administrator can grant.

Under **Enterprise applications**, enable **Assignment required** for the
agentdesktop enrollment application and assign the pilot users who may enroll.
Individual user assignment is valid. An assigned user who still receives an
`AADSTS50105` error should sign out and start enrollment again after the
assignment propagates. This identity assignment is separate from Intune app and
script assignment, which uses Microsoft Entra groups.

## 4. Prepare certificates

For a private controller trust root distributed through MDM, generate all
required identities locally:

```sh
CONTROLLER_DNS_ALIASES=fleet.example.com \
./deploy/gcp/scripts/generate-pki.sh \
  agentdesktop.example.com \
  ./deploy/gcp/agentdesktop-pki
```

Omit `CONTROLLER_DNS_ALIASES` when no CNAME aliases were requested. Every
hostname used by a daemon must be present in the certificate SAN.

The generated directory is not part of the deployment kit. Back it up to an
approved secret-management workflow before removing local private keys. Do not
redistribute it with the kit. Distribute only `controller-ca.pem` to endpoints
through MDM.

To use a publicly issued controller certificate, create a directory with the
same filenames and replace `controller.pem` and `controller-key.pem` with the
public certificate chain and matching unencrypted key. Keep the generated,
private device and PostgreSQL CAs. `controller-ca.pem` and
`controller-ca-key.pem` are optional for a public certificate.

## 5. Install PostgreSQL and the controller

Prepare and validate the policy that the controller will distribute as
`daemon.yaml`. Then run:

```sh
OIDC_ISSUER=https://login.example.com \
OIDC_CLIENT_ID=agentdesktop \
PKI_DIRECTORY=./deploy/gcp/agentdesktop-pki \
DAEMON_CONFIG_FILE=./deploy/gcp/daemon.empty.yaml \
./deploy/gcp/deploy.sh install
```

The included empty policy lets you validate enrollment before managing any
developer tools. Gateway JWT issuance is disabled by default; set
`ENABLE_GATEWAY_JWT=true` only when the policy configures an `llmGateway`
that uses controller-issued credentials. `DAEMON_CONFIG_REVISION` defaults to 1
and must increase whenever the distributed policy changes.

The command refuses to start unless the previously recorded registry image
still has the expected digest and both architectures. It then:

1. validates OIDC discovery, certificate hostnames, and key pairs;
2. stores new source values in Secret Manager without putting them in Terraform
   state;
3. refuses an unplanned secret replacement unless
   `ALLOW_SECRET_ROTATION=true`;
4. creates the Kubernetes Secrets;
5. installs PostgreSQL and waits for it to become ready; and
6. installs the controller chart from the same local source tree through the
   production post-renderer, overriding it with the recorded registry image.

The post-renderer removes the chart's one-file Secret projection so both
`controller.yaml` and `daemon.yaml` are mounted. It also selects the reserved
GKE address, enables the backend-service L4 load balancer, adds TCP startup and
readiness probes, disables the unused service-account token, and changes
controller upgrades to `Recreate`.

Before enrolling a device, confirm the deployed controller contains the same
issuer and client ID verified above:

```sh
kubectl -n agentdesktop get secret agentdesktop-controller-config \
   -o jsonpath='{.data.controller\.yaml}' |
   base64 --decode |
   awk '/^oidc:/{show=1} show{print} show && /^$/{exit}'
```

If either value is stale, rerun `deploy.sh install` with the correct explicit
`OIDC_ISSUER` and `OIDC_CLIENT_ID`. The command briefly rolls the controller
while preserving PostgreSQL, PKI, DNS, and the recorded image.

## 6. Verify

After DNS propagation:

```sh
./deploy/gcp/deploy.sh verify
```

This checks both rollouts, confirms that the Service received the reserved
IPv4 address, and verifies the certificate hostname and HTTP/2 ALPN. For a
private controller CA, it reads only the public CA certificate from Secret
Manager for the check.

The management UI remains loopback-only:

```sh
./deploy/gcp/scripts/port-forward-admin.sh
```

Open <http://127.0.0.1:18080> while the helper is active. It re-resolves the
Ready controller Pod and reconnects when GKE closes a long-lived streaming
session or a rollout replaces the Pod. Press `Ctrl-C` to stop it.

To choose a different local port, pass it as the only argument:

```sh
./deploy/gcp/scripts/port-forward-admin.sh 28080
```

Then open <http://127.0.0.1:28080>. The helper always binds only to IPv4
loopback and forwards to Pod port 8080.

The public hostname exposes the TLS fleet API, not the management UI. Opening
its root URL in a browser is therefore not an application-UI health check. The
origin intentionally listens on HTTPS port 443, not HTTP port 80, and an HTTPS
request to `/` returning `404` proves the fleet endpoint answered. A browser
does not trust a private controller CA until that public CA is installed in the
browser or operating-system trust store.

## 7. Prepare the Intune macOS payload

Microsoft Entra authenticates enrollment; Microsoft Intune deploys the endpoint
package and bootstrap. Administrators use
[intune.microsoft.com](https://intune.microsoft.com) in a browser. A manually
enrolled pilot Mac installs
[Microsoft Company Portal](https://go.microsoft.com/fwlink/?linkid=853070).

Before enrolling or targeting a Mac:

1. Confirm the tenant has an Intune subscription, the pilot user has an Intune
   license, and the operator has the **Intune Administrator** role.
2. Configure the Apple MDM push certificate under **Devices > Enrollment >
   Apple**.
3. Enroll the pilot Mac with Company Portal and confirm it appears under
   **Devices > All devices**.
4. Add the Mac to an assigned device security group such as
   `AgentDesktop-Pilot-macOS`. Intune app and script assignments use groups (or
   broad All users/devices targets), even if Entra Enterprise Application access
   was assigned directly to an individual user.

An Azure subscription does not include Intune. If Graph reports `Request not
applicable to target tenant`, add Microsoft Intune Plan 1 or its trial to this
same Entra tenant, set the MDM authority to Microsoft Intune under **Tenant
administration > Tenant status**, and assign an Intune license to the enrolling
pilot user or an eligible device-only license. A later `403 Forbidden` indicates
that the Azure CLI identity still lacks the Intune role or admin-consented Graph
permission.

Use a native work or school account in the tenant for the licensed pilot, not a
personal Microsoft account represented by an external `#EXT#` identity. Create
the user in the Microsoft Entra admin center and set its **Usage location**.
Then use **Billing > Purchase services** in the Microsoft 365 admin center to
add Intune Plan 1 or its trial and **Users > Active users > Licenses and apps**
to assign the seat. Grant **Intune Administrator** for ongoing setup and remove
any temporary Global Administrator access after activation.

Render the exact root script to upload to Intune:

```sh
source deploy/gcp/.env.production

./deploy/gcp/scripts/render-intune-bootstrap.sh \
  "${CONTROLLER_HOSTNAME}" \
  deploy/gcp/agentdesktop-pki/controller-ca.pem \
  deploy/gcp/generated/agentdesktop-bootstrap.sh
```

The generated script writes `/etc/agentdesktop/config.yaml` with mode `0600`,
installs the public controller CA, restarts an existing LaunchDaemon only when
content changes, and adds the current console user to the local `agentdesktop`
group. It is safe to assign before or after the PKG.

The renderer above is macOS-only. To prepare the equivalent Windows bootstrap,
generate `config.yaml` and copy the public controller CA:

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

The generated directory is ignored by Git. Copy only `config.yaml` and
`controller-ca.pem` to the Windows packaging host; do not copy private keys.
Follow the [Microsoft Intune Windows
runbook](../../docs/content/operations/intune.md#deploy-windows) to add the
signed MSI and `install.ps1`, convert the source folder to `.intunewin`, upload
`detect.ps1`, and assign the pilot group.

### Build, sign, and notarize the PKG

The checks below verify a release package; they do not sign an unsigned local
build. Production distribution requires membership in the Apple Developer
Program and two certificates, with their private keys, installed in a keychain:

- **Developer ID Application** signs `agentdesktop.app`.
- **Developer ID Installer** signs the outer PKG.

Confirm that macOS can find both identities:

```sh
security find-identity -v -p codesigning | grep "Developer ID Application"
security find-identity -v -p basic | grep "Developer ID Installer"
```

From the agentdesktop source repository, build with the dedicated PKG command,
not the generic `dist` command. Replace the example identity names with the
exact values printed above:

```sh
cd frontend
pnpm install --frozen-lockfile

export APPLE_SIGNING_IDENTITY="Developer ID Application: Example, Inc. (TEAMID)"
export APPLE_INSTALLER_SIGNING_IDENTITY="Developer ID Installer: Example, Inc. (TEAMID)"

pnpm --filter @agentdesktop/desktop-web dist:mac
```

The command prints the generated path below `target/release/bundle/pkg`. When
the installer identity is in a non-default keychain, also set
`APPLE_INSTALLER_KEYCHAIN` to that keychain path before building.

Assign the printed path to `PKG`, then submit the signed package to Apple's
notary service and staple the accepted ticket. Create the `agentdesktop-notary`
keychain profile once with `xcrun notarytool store-credentials` if it does not
already exist:

```sh
PKG="/absolute/path/printed/by-the-build/Agent Desktop_VERSION_ARCH.pkg"

xcrun notarytool submit "$PKG" \
   --keychain-profile agentdesktop-notary \
   --wait
xcrun stapler staple "$PKG"
```

Before upload, require all three release checks to pass on macOS. A `Status: no
signature` result means the package was built without
`APPLE_INSTALLER_SIGNING_IDENTITY` and must be rebuilt after both signing
identities are available:

```sh
pkgutil --check-signature "$PKG"
spctl --assess --type install --verbose=4 "$PKG"
xcrun stapler validate "$PKG"
```

In Intune:

1. Go to **Apps > All Apps > Create > macOS app (PKG)**, upload the package,
   retain only bundle ID `dev.agentdesktop.tray` in detection, and assign it as
   **Required** to the pilot device group.
2. Go to **Devices > By platform > macOS > Manage devices > Scripts > Add**,
   upload `deploy/gcp/generated/agentdesktop-bootstrap.sh`, run it as root, set
   daily frequency and three retries, and assign the same group.
3. Select the pilot Mac under **Devices > All devices** and choose **Sync**. In
   Company Portal on the Mac, select the device and choose **Check settings**.

The full enrollment, Automated Device Enrollment, monitoring, and offboarding
instructions are in the
[Microsoft Intune runbook](../../docs/content/operations/intune.md).

## Backups

The `postgres-backup` CronJob runs daily at 03:17 UTC. A PostgreSQL 18 init
container creates a compressed custom-format dump over verified TLS, and a
Google Cloud CLI container uploads the dump and SHA-256 file using Workload
Identity. No static Google credential is stored in Kubernetes.

Start and observe an on-demand backup:

```sh
./deploy/gcp/deploy.sh backup
```

List available objects:

```sh
gcloud storage ls --recursive \
  "gs://$(terraform -chdir=deploy/gcp/terraform output -raw postgres_backup_bucket)/daily/"
```

Restoration is intentionally not automatic. Scale the controller to zero,
suspend the backup CronJob, restore a reviewed dump with PostgreSQL 18
`pg_restore --clean --if-exists --exit-on-error`, restart the controller, and
run the verification command. Test that procedure in an isolated cluster before
enrolling production endpoints.

## Destroy

To remove only the resources owned by this Terraform state, including the
protected GKE cluster and private image registry:

```sh
./deploy/gcp/deploy.sh destroy
```

The command first disables cluster deletion protection, then destroys the full
stack and removes the generated deployment-coordinate file. It does not touch
other clusters or Artifact Registry repositories in the Google Cloud project.

## Troubleshooting enrollment

| Symptom | Check |
| --- | --- |
| agentdesktop needs permission only an administrator can grant | Grant tenant-wide consent for the four declared delegated scopes. |
| `AADSTS50105` | Assign the user or an approved group to the agentdesktop Enterprise Application. |
| **App launch failed** names an unexpected app ID | Compare that ID with the live controller Secret. Rerun `deploy.sh install` with the current tenant issuer and client ID. |
| The named app ID does not exist | Authenticate Azure CLI to the issuer's tenant and verify the client was created there. |
| Enrollment page expired | Restart the endpoint daemon to create another 10-minute enrollment attempt. |

## Files

| Path | Purpose |
| --- | --- |
| `terraform/versions.tf` | Terraform and Google provider requirements |
| `terraform/variables.tf` | Validated project, region, DNS, cluster, and retention inputs |
| `terraform/main.tf` | GCP APIs, network, GKE, image registry, address, backup bucket, IAM, and Secret Manager |
| `terraform/outputs.tf` | Cluster, DNS, image, backup, and Secret Manager handoff values |
| `terraform/terraform.tfvars.example` | Example non-secret Terraform input values |
| `terraform/.terraform.lock.hcl` | Reviewed provider dependency lock |
| `helm/postgresql/` | kagent-aligned PostgreSQL workload and backup CronJob |
| `daemon.empty.yaml` | Empty initial policy for enrollment-only validation |
| `scripts/create-entra-app.sh` | Creates or converges the Entra public-client app with GA Azure CLI commands |
| `scripts/upsert-intune-bootstrap.sh` | Creates or updates the Intune macOS bootstrap through Microsoft Graph beta |
| `scripts/render-intune-bootstrap.sh` | Renders a tenant-specific Intune macOS bootstrap from hostname and public CA |
| `scripts/port-forward-admin.sh` | Reconnects a loopback-only management UI port-forward across controller rollouts |
| `scripts/generate-pki.sh` | Optional private deployment PKI generator |
| `scripts/controller-post-renderer.sh` | Controller chart production overlay |
| `deploy.sh` | Infrastructure, image build, installation, validation, backup, and teardown commands |

The downloadable kit intentionally excludes local Terraform state and provider
downloads, `.env.production`, private PKI files, and `generated/` tenant
payloads. Back up Terraform state and private PKI through approved encrypted
systems; regenerate the Intune bootstrap from the included renderer whenever
the hostname or controller CA changes.
