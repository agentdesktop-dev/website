---
title: Contributing
description: Build and test the agentdesktop Rust workspace and frontends, and find the components that own discovery, enrollment, and fleet management.
weight: 40
---

agentdesktop is a Rust workspace with React and TypeScript frontends for the desktop app and controller. The controller handles enrollment directly; there is no separate enrollment service.

## Local setup and tests

Follow [Prepare your build environment](../getting-started/build/#prepare-your-build-environment) to clone the repository and install the toolchains and platform dependencies. From the repository root, run:

```sh
make test
make check
```

`make test` builds the frontends and runs `cargo test --workspace`. `make check` runs Rust formatting and Clippy with warnings denied, then checks all frontend packages.

When changing configuration types, regenerate and verify the checked-in schemas:

```sh
make generate-schema
git diff --exit-code -- schema
```

## Develop the web interfaces

Use these development servers when changing frontend code. For normal use, the desktop interface is included in `agentdesktop`, and `agentdesktop-controller` serves its embedded fleet UI. Neither quickstart needs a separate frontend process.

First, complete the [standalone](../getting-started/standalone/) or [controller-managed](../getting-started/managed/) quickstart so there is a running daemon or controller to inspect. Install frontend dependencies from the repository root:

```sh
cd frontend
pnpm install --frozen-lockfile
```

For controller UI development, leave the controller running on `127.0.0.1:8080` and start the frontend from `frontend/`:

```sh
pnpm dev:controller
```

Open [http://127.0.0.1:1421](http://127.0.0.1:1421). The development server proxies `/api` requests to the controller on port 8080.

For desktop UI development, run this from `frontend/` in a separate terminal:

```sh
pnpm dev:desktop
```

This starts the Tauri desktop app with frontend reloading. Tauri provides the native window and tray integration for the web interface; the app connects to the local device daemon.

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

agentdesktop owns discovery, configuration reconciliation, enrollment, gateway credential delivery, and selected telemetry. Inference-gateway routing and provider policy remain in the configured gateway.
