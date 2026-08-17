---
title: Build and install
description: Build the device app, command-line client, controller, and embedded web interfaces from source.
weight: 1
---

The local quickstarts use configuration and Compose files from the source repository. Complete this page once, then run either the [standalone](../standalone/) or [controller-managed](../managed/) quickstart from the repository root.

GitHub Releases contain the `agentdesktop` device binary. The local controller quickstart also needs `agentdesktop-controller`, so it builds both binaries from source. Production controller deployments can instead use the published controller image and Helm chart.

## Prerequisites

Install:

- Git and Make.
- The Rust toolchain selected by `rust-toolchain.toml`.
- Node.js 24 and Corepack. The exact Node version is in `frontend/.nvmrc`.
- The [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system.

On macOS, install the Xcode command-line tools if they are not already present:

```sh
xcode-select --install
```

On Ubuntu, install the same desktop libraries used in CI:

```sh
sudo apt-get update
sudo apt-get install --yes --no-install-recommends \
  libwebkit2gtk-4.1-dev \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

## Build and install both binaries

```sh
git clone https://github.com/agentdesktop-dev/agentdesktop.git
cd agentdesktop
corepack enable
make install
```

`make install` installs the frontend workspace, builds the controller and desktop web interfaces, and installs both Rust binaries into Cargo's binary directory. Confirm that your shell can find them:

```sh
command -v agentdesktop
command -v agentdesktop-controller
```

If either command prints nothing, add Cargo's binary directory to `PATH`:

```sh
export PATH="$HOME/.cargo/bin:$PATH"
```

To build without installing, run `make build`. The debug binaries are written to `target/debug/`.

## Develop the web interfaces

The production controller binary embeds the built controller UI and serves it on its admin address. A separate frontend process is only needed while changing UI code.

From `frontend/`, start the controller UI on port 1421:

```sh
pnpm dev:controller
```

It proxies `/api` to a controller running on `127.0.0.1:8080`. To develop the Tauri desktop UI, run this in a separate terminal:

```sh
pnpm dev:desktop
```