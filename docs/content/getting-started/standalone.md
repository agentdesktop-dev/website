---
title: Standalone
description: Run agentdesktop from local YAML without a fleet controller.
weight: 1
---

In standalone mode, the agentdesktop daemon reads local YAML and reconciles developer-tool settings on one device. It does not enroll the device or connect to the fleet controller.

The repository's standalone example runs Dex and Agentgateway locally. Agentdesktop signs the user in through OIDC, configures Claude Code to use Agentgateway as its Anthropic base URL, and supplies the resulting access token through Claude's credential helper.

## Prerequisites

- Docker with Compose.
- Claude Code and `agentdesktop` on `PATH`.
- An Anthropic API key for the example Agentgateway upstream.
- Rust, pnpm, and the platform dependencies required by Tauri when building from source.

Download the current binary from [GitHub Releases](https://github.com/agentdesktop-dev/agentdesktop/releases), or build and install the workspace:

```sh
git clone https://github.com/agentdesktop-dev/agentdesktop.git
cd agentdesktop
make install
```

## Start the example services

From the repository root, start Dex and Agentgateway:

```sh
export ANTHROPIC_API_KEY=sk-ant-...
docker compose -f examples/standalone/compose.yaml up -d
```

## Preview the configuration

Run a dry-run before changing Claude Code settings:

```sh
agentdesktop daemon \
  --config examples/standalone/config.yaml \
  --user \
  --dry-run
```

The report shows each proposed update and conflict without writing files. In `--user` mode, Claude Code values are merged into `~/.claude/settings.json` while unrelated settings are preserved.

## Run the daemon

Start the daemon without `--dry-run` and leave it running:

```sh
agentdesktop daemon \
  --config examples/standalone/config.yaml \
  --user
```

In another terminal, verify the local daemon and discovery output:

```sh
agentdesktop status
agentdesktop discover
```

Launch `claude` normally. Claude Code connects directly to Agentgateway using the base URL written by agentdesktop. Its credential helper asks the daemon for the user's OIDC access token.

Claude Desktop managed configuration requires system mode. Uncomment its configuration in the example YAML, then run:

```sh
sudo "$(command -v agentdesktop)" daemon \
  --config examples/standalone/config.yaml
```

## Stop the example

```sh
docker compose -f examples/standalone/compose.yaml down
```

The checked-in configuration and identity provider are for local development. Use your own OIDC client, trusted HTTPS endpoints, gateway policy, and secret management for a real deployment.
