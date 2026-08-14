---
title: Contributing
description: Build agentdesktop, run the test suite, and find the code for each component.
weight: 2
---

agentdesktop is primarily Rust. The optional enrollment service is written in Go. Run the local tests before setting up a VM or identity provider.

## Local setup and tests

1. Read the [repository README](https://github.com/agentdesktop-dev/agentdesktop) and the architecture boundary in `AGENTS.md`.
2. Install the Rust toolchain selected by `rust-toolchain.toml`.
3. Run the complete local suite.
4. Trace one native flow through the service and HBONE modules.
5. Run the container smoke environment.

```bash
git clone https://github.com/agentdesktop-dev/agentdesktop.git
cd agentdesktop
cargo test --all-targets
cargo run -- --help
```

## Run the container smoke test

```bash
./scripts/container-up.sh smoke
./scripts/container-smoke.sh
./scripts/container-down.sh
```

The fixtures use local test data and do not contact an AI provider.

## Code map

| Area | Starting point |
| --- | --- |
| Runtime orchestration | `src/service.rs` |
| HTTP/2 CONNECT pool | `src/service/hbone.rs` |
| Opaque stream relay | `src/service/forwarder.rs` |
| Claude adapter | `src/apps/claude.rs` |
| Linux process scope | `src/launch.rs` |
| Platform integrations | `src/platform/` |
| Enrollment authority | `control-plane/` |

## Before opening a PR

Keep each change within one ownership area: identity, capture, telemetry, installation, or control plane. Read the nearest test before changing behavior, and add a regression test for an escaped defect.

Keep policy in agentgateway. agentdesktop handles discovery, identity, and forwarding.
