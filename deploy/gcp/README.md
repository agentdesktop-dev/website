# Agentdesktop production deployment on GCP

This directory creates a regional GKE cluster and installs Agentdesktop with an
in-cluster PostgreSQL database. DNS stays with your existing provider. The
workflow asks for the controller hostname before it creates infrastructure,
reserves a public IPv4 address, and prints the A and optional CNAME records to
create yourself.

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

From the website repository, point the build command at the current
Agentdesktop source tree:

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

Under **Enterprise applications**, enable **Assignment required** for the
Agentdesktop enrollment application and assign the pilot users who may enroll.
Individual user assignment is valid. This identity assignment is separate from
Intune app and script assignment, which uses Microsoft Entra groups.

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

The directory is ignored because the repository ignores PEM files. Back it up
to an approved secret-management workflow before removing local private keys.
Distribute `controller-ca.pem` to endpoints through MDM.

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
`ENABLE_GATEWAY_JWT=true` only when the policy configures an inference gateway
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
kubectl -n agentdesktop port-forward deployment/agentdesktop 8080:8080
```

Open <http://127.0.0.1:8080> while the port-forward is active.

If local port 8080 is already in use, choose another local port without changing
the Pod port:

```sh
kubectl -n agentdesktop port-forward deployment/agentdesktop 18080:8080
```

Then open <http://127.0.0.1:18080>.

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

Use a signed and notarized release PKG. Before upload, require these commands to
pass on macOS:

```sh
pkgutil --check-signature AgentDesktop.pkg
spctl --assess --type install --verbose=4 AgentDesktop.pkg
xcrun stapler validate AgentDesktop.pkg
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
[production deployment guide](../../docs/content/operations/production.md#deploy-through-microsoft-intune).

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
| `scripts/render-intune-bootstrap.sh` | Renders a tenant-specific Intune macOS bootstrap from hostname and public CA |
| `scripts/generate-pki.sh` | Optional private deployment PKI generator |
| `scripts/controller-post-renderer.sh` | Controller chart production overlay |
| `deploy.sh` | Infrastructure, image build, installation, validation, backup, and teardown commands |

The repository intentionally excludes local Terraform state and provider
downloads, `.env.production`, private PKI files, and `generated/` tenant
payloads. Back up Terraform state and private PKI through approved encrypted
systems; regenerate the Intune bootstrap from the committed renderer whenever
the hostname or controller CA changes.
