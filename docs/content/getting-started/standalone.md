---
title: Self-managed
description: Run agentdesktop and agentgateway as separate processes on one Linux laptop.
weight: 1
---

In self-managed mode, agentdesktop and agentgateway run as separate processes on one laptop. The user owns the policy, credentials, and log retention.

The project does not yet publish a signed release. Review the current [phase status](https://github.com/agentdesktop-dev/agentdesktop/blob/main/docs/development/phase-status.md) before using agentdesktop with sensitive traffic.

## Prerequisites

- Linux with a current Rust toolchain for source builds.
- Podman 5+ or Docker for the deterministic smoke environment.
- Claude Code to test the current native application adapter.
- agentgateway configuration that you own and can protect with user-only file permissions.

This walkthrough uses Claude Code, the first persistent adapter. Codex, OpenClaw, other agents, MCP servers, tools, and skills require their corresponding adapters or capture profiles.

## Verify the source checkout

The test suite uses local fixtures and does not contact an AI provider.

```bash
git clone https://github.com/agentdesktop-dev/agentdesktop.git
cd agentdesktop
cargo test --all-targets
```

Run the agentdesktop and agentgateway smoke environment:

```bash
./scripts/container-up.sh smoke
./scripts/container-smoke.sh
./scripts/container-down.sh
```

## Local endpoints

The standard local setup uses three loopback-only endpoints:

| Endpoint | Default | Purpose |
| --- | --- | --- |
| Application path | `127.0.0.1:8080` | AI applications connect to agentdesktop |
| Status path | `127.0.0.1:8081` | agentdesktop health and privacy-safe status |
| agentgateway CONNECT path | `127.0.0.1:15008` | agentdesktop forwards to local agentgateway |

agentgateway stores provider credentials, evaluates policy, parses requests, and owns any inspection CA. agentdesktop forwards opaque bytes.

## Connect Claude Code

Once agentdesktop and agentgateway are ready, configure the native adapter:

```bash
cargo run -- connect-agents
```

The command asks for separate consent before changing Claude Code settings. It preserves unrelated settings and refuses to replace a conflicting provider or gateway configuration.

Launch `claude` normally after configuration. Configure a given application for either native routing or transparent capture.

## Check health

```bash
curl --fail http://127.0.0.1:8081/_agentdesktop/healthz
```

This endpoint checks whether agentdesktop can reach the agentgateway TCP endpoint. It does not validate policy, provider credentials, or provider availability.

## Security checklist

- Keep all agentdesktop and agentgateway listeners on loopback.
- Restrict agentgateway configuration and referenced secret files to the current user.
- Supply provider credentials only through an agentgateway-supported secret source.
- Confirm that stopping agentgateway makes selected requests fail without direct provider fallback.
- Define retention for both service logs and agentgateway audit data.
