---
title: Contributing
description: Build the Rust workspace and frontends, run CI checks, and find each component.
weight: 2
---

agentdesktop is a Rust workspace with React and TypeScript frontends for the desktop app and controller. The controller handles enrollment directly; there is no separate enrollment service.

## Local setup and tests

Install the Rust toolchain selected by `rust-toolchain.toml`, the Node version in `frontend/.nvmrc`, pnpm, and the Tauri dependencies for your platform. On Linux, the CI workflow lists the required WebKitGTK, AppIndicator, SSL, Xdo, and SVG development packages.

```sh
git clone https://github.com/agentdesktop-dev/agentdesktop.git
cd agentdesktop
corepack enable
make test
make check
```

`make test` builds the frontends and runs `cargo test --workspace`. `make check` runs Rust formatting and Clippy with warnings denied, then checks all frontend packages.

When changing configuration types, regenerate and verify the checked-in schemas:

```sh
make generate-schema
git diff --exit-code -- schema
```

## Code map

| Area | Starting point |
| --- | --- |
| Device daemon, discovery, reconciliation, and OIDC | `crates/agent/` |
| Desktop app and command-line entry point | `crates/agentdesktop/` |
| Fleet controller, enrollment, storage, and admin API | `crates/controller/` |
| Shared configuration and data models | `crates/core/` |
| Fleet gRPC contract | `crates/proto/` |
| Desktop and controller frontends | `frontend/` |
| Local and Kubernetes scenarios | `examples/` |
| Controller Helm chart | `deploy/helm/agentdesktop-controller/` |
| Generated configuration reference | `schema/` |

## Before opening a PR

Keep changes within the owning crate or frontend package. Read the nearest test before changing behavior and add a regression test for an escaped defect.

Agentdesktop owns discovery, configuration reconciliation, enrollment, gateway credential delivery, and selected telemetry. Inference-gateway routing and provider policy remain in the configured gateway.
