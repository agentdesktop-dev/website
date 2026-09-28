---
title: Controller-managed
description: Enroll a workstation with a local controller and configure Claude Code to send model requests through agentgateway.
weight: 3
---

Use this quickstart to enroll your workstation with an agentdesktop controller. The local daemon receives tool configuration from the controller. You can inspect the device in the controller interface and send a model request through agentgateway.

All components run on your workstation for this quickstart. In production, the controller and inference gateway normally run on separate infrastructure. See [Production deployment](../../operations/production/) or [Deploy on Google Cloud](../../operations/gcp/) for deployment guidance.

## What you will run

| Component | Address | Purpose |
| --- | --- | --- |
| Dex | `127.0.0.1:5556` | Local OpenID Connect (OIDC) provider for enrollment |
| Controller fleet application programming interface (API) | `127.0.0.1:8443` | Device enrollment, configuration, and telemetry |
| Controller interface | `127.0.0.1:8080` | Fleet inventory and configuration status |
| agentgateway | `127.0.0.1:4000` | Authenticated model traffic |
| Device daemon | Local socket | Tool discovery, configuration, and credentials |

## Before you begin

- Docker with Compose. On Docker Desktop 4.34 or later, [enable host networking](https://docs.docker.com/engine/network/drivers/host/#docker-desktop) under **Settings > Resources > Network**. Select **Apply & restart**.
- Bash, OpenSSL, and curl.
- Claude Code and an Anthropic API key.
- A local clone of the agentdesktop repository.
- `agentdesktop` and `agentdesktop-controller` on `PATH`. Follow [Build and install](../build/) if needed.

Run all shell commands from the repository root in a macOS or Linux shell. Use separate terminals for the controller and device daemon. Both processes stay in the foreground.

## Step 1: Generate development keys

The controller configuration in `examples/claude/controller.yaml` requires keys and certificates for three purposes:

- Transport Layer Security (TLS) for controller connections.
- A certificate authority (CA) for device enrollment.
- JSON Web Token (JWT) signing for gateway authentication.

1. Generate the development keys and certificates:

   ```sh
   ./examples/claude/create-keys.sh
   ```

   Example output, after OpenSSL's key-generation progress:

   ```console
   Certificate request self-signature ok
   subject=CN=localhost
   Generated Agentdesktop development keys in /tmp/agentdesktop-keys
   ```

   The script writes five files under `/tmp/agentdesktop-keys`: two controller files, two device CA files, and one gateway JWT signing key. If any key files already exist, the script stops. Use these keys only for local development.

## Step 2: Start Dex

Use the local Dex service to sign in during device enrollment.

1. Start the Dex container:

   ```sh
   docker compose -f examples/claude/compose.yaml up -d dex
   ```

   Example output on the first run, after any image downloads:

   ```console
   [+] Running 2/2
   ✔ Network claude_default  Created
   ✔ Container claude-dex-1  Started
   ```

2. Verify that the Dex OIDC metadata is available:

   ```sh
   curl --fail --silent --show-error \
     --retry 10 --retry-all-errors --retry-delay 1 \
     http://127.0.0.1:5556/dex/.well-known/openid-configuration \
     > /dev/null && echo "Dex is ready"
   ```

   Expected output once Dex responds:

   ```console
   Dex is ready
   ```

## Step 3: Start the controller

The controller manages device enrollment and tool configuration. The controller executable also includes the fleet management interface.

1. In a new terminal, start the controller:

   ```sh
   agentdesktop-controller --config examples/claude/controller.yaml
   ```

   Keep the controller running in this terminal. The fleet listener address is `0.0.0.0:8443`. Local devices connect through `https://127.0.0.1:8443`.

2. In another terminal, verify the controller's admin API:

   ```sh
   curl --fail http://127.0.0.1:8080/api/v1/settings
   ```

   Expected output:

   ```json
   {"fleet_listen":"0.0.0.0:8443","admin_listen":"127.0.0.1:8080","oidc_enabled":true,"tls_enabled":true,"gateway_jwt_enabled":true}
   ```

   The controller interface is available at [http://127.0.0.1:8080](http://127.0.0.1:8080).

3. Verify that the public signing keys are available:

   ```sh
   curl --fail --silent --show-error \
     http://127.0.0.1:8080/.well-known/jwks.json \
     > /dev/null && echo "Controller JWKS is ready"
   ```

   Expected output:

   ```console
   Controller JWKS is ready
   ```

   The gateway needs these keys to validate credentials. The endpoint returns the keys as a JSON Web Key Set (JWKS).

## Step 4: Start agentgateway

The `network_mode: host` setting gives the gateway access to the controller's public signing keys at `http://127.0.0.1:8080/.well-known/jwks.json`. On Docker Desktop, complete the host networking setup in [Before you begin](#before-you-begin). Keep the controller running.

1. Set your Anthropic API key in the terminal for Compose. Replace `sk-ant-...` with your key:

   ```sh
   export ANTHROPIC_API_KEY='sk-ant-...'
   test -n "${ANTHROPIC_API_KEY:-}"
   ```

2. Start the gateway:

   ```sh
   docker compose -f examples/claude/compose.yaml up -d agentgateway
   ```

   Example output:

   ```console
   [+] Running 1/1
   ✔ Container claude-agentgateway-1  Started
   ```

3. Check that the gateway container stays running:

   ```sh
   docker compose -f examples/claude/compose.yaml ps --all agentgateway
   ```

   The container status should be `Up`. The Compose `Started` message confirms only that the container launched.

4. Verify that the gateway accepts connections:

   ```sh
   curl --fail --head --silent --show-error \
     --retry 10 --retry-all-errors --retry-delay 1 \
     http://127.0.0.1:4000/ \
     > /dev/null && echo "Agentgateway is ready"
   ```

   Expected output:

   ```console
   Agentgateway is ready
   ```

   The example's `agentgateway.yaml` defines the `HEAD /` route for this check.

### If the gateway exits with a JWKS error

The `failed to load JWKS` error can indicate that the gateway cannot reach the controller's signing keys.

1. Inspect the stopped container:

   ```sh
   docker compose -f examples/claude/compose.yaml ps --all agentgateway
   docker compose -f examples/claude/compose.yaml logs --tail 50 agentgateway
   ```

2. Repeat the [controller signing key check](#step-3-start-the-controller).

3. If the check succeeds on your workstation, verify the Docker Desktop host networking setting.

   Under **Settings > Resources > Network**, enable host networking. Select **Apply & restart**. Without host networking, the container cannot reach the controller through `127.0.0.1`.

4. With the controller running, restart the gateway from the terminal where you set the API key:

   ```sh
   docker compose -f examples/claude/compose.yaml up -d agentgateway
   ```

5. Repeat the [gateway status and connection checks](#step-4-start-agentgateway).

   Keep the example YAML unchanged for this Docker Desktop fix.

## Step 5: Start and enroll the device daemon

The example configuration includes Claude Desktop settings, which require system privileges. Run the daemon in system mode for this quickstart.

1. If another foreground agentdesktop daemon is running, stop that daemon with **Ctrl+C** in its terminal.

2. Start the device daemon:

   ```sh
   sudo "$(command -v agentdesktop)" daemon \
     --config examples/claude/agentdesktop.yaml
   ```

   Keep the daemon running in this terminal.

3. Sign in through the browser with the example Dex account:

   | Field | Value |
   | --- | --- |
   | Email | `admin@example.com` |
   | Password | `password` |

   After sign-in, the daemon submits a certificate signing request to the controller. The controller returns a client certificate. The private device key stays on your workstation.

## Step 6: Verify the managed device

Use the command-line tools and controller interface to inspect the enrolled device. A model request from Claude Code tests the gateway connection.

1. In another terminal, check that the local daemon responds:

   ```sh
   agentdesktop status
   ```

   Expected output:

   ```console
   ok
   ```

2. Inspect the daemon's startup configuration:

   ```sh
   agentdesktop config
   ```

   Example output:

   ```yaml
   controller:
     address: https://127.0.0.1:8443
     caCertificatePath: /tmp/agentdesktop-keys/device-ca.pem
     heartbeatInterval: 1m
   inventoryInterval: 15m
   ```

   This output shows the local startup configuration. The tool configuration comes from the controller. The controller interface shows whether the daemon applied that configuration.

3. List the discovered developer tools:

   ```sh
   agentdesktop discover
   ```

   Example output on macOS. Tools, versions, and paths vary by workstation:

   ```console
   claude-code     2.1.284   /Users/<user>/.local/bin/claude
   claude-desktop  2.9939.4  /Applications/Claude.app/Contents/MacOS/Claude
   codex          0.158.0   /Users/<user>/.local/bin/codex
   opencode       1.14.30   /Users/<user>/.opencode/bin/opencode
   vscode         1.136.1   /usr/local/bin/code
   cursor         3.22.7    /usr/local/bin/cursor
   ```

4. Open **Devices** in the [controller interface](http://127.0.0.1:8080).

   The page shows each device's connection status, discovered tools, and latest configuration result.

   {{< docs-screenshot src="images/controller-managed-devices.png" width="1280" height="430" alt="Controller Devices page with connection status, discovered tools, and configuration results." caption="The Devices page shows connection and configuration status across the fleet." >}}

5. Open your enrolled device.

   The details include the device identity, applied configuration revision, recent activity, and discovered tools.

   {{< docs-screenshot src="images/controller-managed-device.png" width="1180" height="867" alt="Device details with the applied configuration revision, recent activity, and discovered tools." caption="The device details show the daemon's latest report and configuration result." >}}

6. Optional: Open the desktop app to inspect the local daemon:

   ```sh
   agentdesktop
   ```

7. In a separate terminal, clear direct Anthropic credentials:

   ```sh
   unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN
   ```

8. Start Claude Code:

   ```sh
   claude
   ```

   The startup banner includes `Managed by Agentdesktop`. The daemon supplies a short-lived gateway JWT.

9. In Claude Code, run `/status` to verify the gateway settings:

   - Anthropic base URL: `http://localhost:4000/`.
   - Credential source: `apiKeyHelper`.

10. Send a short prompt, such as `Reply with hello.`

    A successful response confirms the request path through the gateway to Anthropic. The gateway validates the JWT before forwarding the request.

## Cleanup

Stopping the containers or deleting files in `/tmp` does not restore tool settings. This quickstart writes Claude Code settings to a system directory:

| Operating system | Claude Code managed file |
| --- | --- |
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.d/50-agentdesktop.json` |
| Linux | `/etc/claude-code/managed-settings.d/50-agentdesktop.json` |

1. Exit Claude Code and Claude Desktop.

2. Quit the agentdesktop app from its tray or menu bar menu.

3. In each process's terminal, press **Ctrl+C** to stop the daemon and controller.

   Keep both processes stopped during cleanup. A running daemon can reapply the controller's configuration.

4. Create a temporary configuration that contains only `{}`:

   ```sh
   printf '{}\n' > /tmp/agentdesktop-cleanup.yaml
   ```

   This empty configuration tells the daemon to stop managing tools.

5. Preview the cleanup in system mode:

   ```sh
   sudo "$(command -v agentdesktop)" daemon \
     --config /tmp/agentdesktop-cleanup.yaml \
     --dry-run
   ```

   The preview shows which managed files the cleanup removes. These files include Claude Code gateway settings and telemetry hooks, plus Claude Desktop settings and its credential helper. Files without agentdesktop ownership markers remain unchanged.

6. After you resolve any `CONFLICT` in the preview, apply the cleanup once:

   ```sh
   sudo "$(command -v agentdesktop)" daemon \
     --config /tmp/agentdesktop-cleanup.yaml \
     --once
   ```

   Expected output:

   ```console
   Reconciliation complete.
   ```

   This command removes system tool configuration that agentdesktop owns, without connecting to the controller. Your personal Claude Code settings remain unchanged. If you also ran the standalone quickstart, complete the [user-mode cleanup](../standalone/#cleanup) to restore `~/.claude/settings.json`.

7. Stop the Dex and agentgateway containers:

   ```sh
   docker compose -f examples/claude/compose.yaml down
   ```

   Example output:

   ```console
   [+] Running 3/3
   ✔ Container claude-agentgateway-1  Removed
   ✔ Container claude-dex-1           Removed
   ✔ Network claude_default          Removed
   ```

8. Remove the temporary cleanup configuration:

   ```sh
   rm -f /tmp/agentdesktop-cleanup.yaml
   ```

9. In your Claude Code terminal, clear the example's environment variables:

   ```sh
   unset ANTHROPIC_BASE_URL ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN \
     CLAUDE_CODE_API_KEY_HELPER_TTL_MS
   ```

10. Start Claude Code:

    ```sh
    claude
    ```

11. Sign in with `/login` or the sign-in prompt. If you normally use an API key, set your usual credential instead.

12. Run `/status` to verify your usual connection settings.

    The local gateway URL and agentdesktop credential helper should be absent. The startup banner should no longer include `Managed by Agentdesktop`. If these settings remain, check for configuration from the standalone quickstart.

Cleanup leaves the controller database and generated keys under `/tmp`. The daemon's identity metadata stays in `/var/lib/agentdesktop`. On Linux, secrets stay in files under that directory with access limited to the owner. On macOS, secrets stay in the operating system's credential store.

## Next steps

For a cluster deployment, follow the [Kubernetes controller example](https://github.com/agentdesktop-dev/agentdesktop/tree/main/examples/kubernetes). The example includes the controller Helm chart, development Dex and PostgreSQL dependencies, and a separate agentgateway configuration.
