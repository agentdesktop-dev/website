---
title: Organization-managed
description: Enroll an organizational user and device, then route to a remote agentgateway with short-lived mTLS identity.
weight: 2
---

In managed mode, the organization runs agentgateway remotely. OAuth authenticates enrollment and certificate recovery. Application traffic uses a short-lived mTLS certificate that identifies the organization, user, and device.

agentgateway does not yet consume published revocation state, so a revoked certificate remains valid until it expires. Signed distribution and cross-platform capture are also incomplete.

## Prerequisites

A managed deployment requires:

- An HTTPS OAuth issuer supporting Authorization Code with PKCE `S256`.
- A public OAuth client, expected audience, and user enrollment scope.
- An HTTPS enrollment authority trusted by the laptop.
- An HTTPS agentgateway CONNECT origin trusted by the laptop.
- An administrator workflow for approving device enrollment.

Configure the OAuth issuer, enrollment authority, and agentgateway origin as separate HTTPS endpoints. Validate the OAuth issuer and each service certificate independently, even when one organization operates all three.

## Check credential storage

Check local credential storage before opening a browser login:

```bash
cargo run -- identity storage-check
```

On Linux, `auto` uses Secret Service when its write/read/delete preflight succeeds and otherwise selects an owner-only protected file. Runtime does not silently switch stores after selection.

## Sign in

```bash
cargo run -- identity login \
  --issuer https://identity.example/ \
  --client-id agentdesktop \
  --audience https://gateway.example \
  --scope agentgateway.invoke \
  --gateway-origin https://gateway.example
```

agentdesktop opens the system browser, uses Authorization Code with PKCE, and validates the token issuer, audience, expiry, scope, signature, and subject.

## Enroll the device

Create a protected P-256 device key and submit its certificate signing request:

```bash
cargo run -- identity enroll-request \
  --issuer https://identity.example/ \
  --enrollment-url https://enrollment.example/ \
  --gateway-origin https://gateway.example
```

After an administrator approves the pending request, retrieve the certificate:

```bash
cargo run -- identity enroll-status \
  --issuer https://identity.example/ \
  --enrollment-url https://enrollment.example/ \
  --gateway-origin https://gateway.example
```

The private key never leaves agentdesktop storage. The authority constructs certificate identity from its own organization, user, and device records rather than trusting CSR identity fields.

## Attribute agent activity

The managed certificate identifies the organization, user, and device. agentdesktop combines that identity with the discovered agent instance and its process or adapter context. Audit records identify the agent and device behind each request to a model, MCP server, tool, or skill.

agentdesktop ignores agent-supplied identity headers. It rejects a flow when it cannot identify the local source.

## Start managed forwarding

```bash
cargo run -- serve \
  --mode managed \
  --listen 127.0.0.1:8080 \
  --status-listen 127.0.0.1:8081 \
  --upstream https://gateway.example \
  --native-target native.agentdesktop.internal:4000 \
  --identity-issuer https://identity.example/ \
  --enrollment-url https://enrollment.example/
```

Startup requires protected storage, the matching OAuth session, and an approved device certificate. A failed managed route closes the agent flow rather than connecting directly to a provider.

## Validate status

```bash
curl --fail http://127.0.0.1:8081/_agentdesktop/healthz
curl --fail http://127.0.0.1:8081/_agentdesktop/status
```

The status API does not expose Gateway addresses, identity claims, credentials, application traffic, or policy.
