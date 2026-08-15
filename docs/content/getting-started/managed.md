---
title: Controller-managed
description: Enroll a device, distribute configuration, and issue short-lived inference-gateway credentials.
weight: 2
---

In managed mode, the daemon enrolls with the agentdesktop controller and receives desired configuration from it. The controller provides a fleet management UI, stores inventory and selected telemetry, and can issue short-lived JWTs for an inference gateway such as Agentgateway.

The device certificate authenticates the daemon to the controller. Developer tools do not use that certificate for model traffic; they connect directly to the configured inference gateway and obtain a gateway credential through agentdesktop.

## Prerequisites

The repository includes a complete local scenario using Dex, the controller, Claude Code, and Agentgateway. It requires:

- Docker with Compose.
- `agentdesktop` and `agentdesktop-controller` on `PATH`.
- OpenSSL and an Anthropic API key.
- Development TLS and JWT keys generated as described in the [local scenario](https://github.com/agentdesktop-dev/agentdesktop/tree/main/examples/claude).

Build both binaries from source with `make install`, or download the device binary from [GitHub Releases](https://github.com/agentdesktop-dev/agentdesktop/releases).

## Start the local controller scenario

After generating the example key material, start Dex:

```sh
docker compose -f examples/claude/compose.yaml up -d dex
```

Start the controller in another terminal:

```sh
agentdesktop-controller --config examples/claude/controller.yaml
```

Start Agentgateway after supplying its upstream credential:

```sh
export ANTHROPIC_API_KEY=sk-ant-...
docker compose -f examples/claude/compose.yaml up -d agentgateway
```

Start the device daemon:

```sh
sudo "$(command -v agentdesktop)" daemon \
  --config examples/claude/agentdesktop.yaml
```

The browser opens for OIDC sign-in. For the checked-in Dex example, use `admin@example.com` and `password`.

## Enrollment and credentials

During enrollment, the daemon generates its private key locally and sends a certificate signing request with the OIDC identity token. The controller returns a client certificate, which the daemon uses for mTLS on the fleet API. The private key stays on the device.

When a configured tool requests an inference-gateway credential, the daemon asks the controller for a short-lived JWT. The controller restricts requests to configured client IDs and sets the configured issuer and audience. The Agentgateway example validates that JWT before forwarding a model request.

## Inspect the device and fleet

Open the controller UI at [http://127.0.0.1:8080](http://127.0.0.1:8080). Open the local desktop app with:

```sh
agentdesktop
```

The command-line client can also query the daemon:

```sh
agentdesktop status
agentdesktop config
agentdesktop discover
```

For a cluster deployment, follow the [Kubernetes controller example](https://github.com/agentdesktop-dev/agentdesktop/tree/main/examples/kubernetes). It installs the controller Helm chart with development Dex and PostgreSQL dependencies and configures Agentgateway separately.
