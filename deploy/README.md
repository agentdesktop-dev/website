# Deployment assets

This directory contains the executable infrastructure and validation paths that
support the public [production deployment guide](../docs/content/operations/production.md).

## GCP production

[gcp/README.md](gcp/README.md) is the source-of-truth runbook for a GCP
deployment. It covers:

1. Terraform provisioning for networking, regional GKE, Artifact Registry,
   static IP, PostgreSQL backups, IAM, and Secret Manager.
2. Provider-neutral DNS, including Cloudflare **DNS only** configuration.
3. Local AMD64/ARM64 controller image build and Artifact Registry publication.
4. Current Microsoft Entra public-client registration through the portal or GA
   Azure CLI, plus exact issuer discovery.
5. Private deployment PKI, PostgreSQL, controller installation, and live
   verification.
6. Intune macOS package assignment, generated bootstrap delivery, and optional
   Azure CLI/Graph beta shell-script automation.
7. Backups and Terraform-owned teardown.

Start with:

```sh
./deploy/kind/smoke-test.sh
./deploy/gcp/deploy.sh infra
```

Do not commit generated Terraform state, `.env.production`, private PKI, or
tenant-specific MDM payloads. The committed renderers and examples recreate
those outputs from approved inputs.

## Local validation

[kind/README.md](kind/README.md) documents the disposable Kind smoke test. It
uses the same PostgreSQL chart and controller post-renderer as GCP while keeping
all resources isolated from the current kubectl context.
