---
title: Standalone
description: Configure Claude Code on one workstation and send model requests through agentgateway without a fleet controller.
weight: 2
---

Use this quickstart to configure Claude Code with a local YAML file. You can inspect the configuration in the desktop app and send a model request through agentgateway. You do not need a fleet controller.

The example runs Dex and agentgateway in Docker. Use the test account in Dex to sign in. The local agentdesktop daemon supplies gateway credentials to Claude Code. The gateway forwards authenticated model requests to Anthropic.

## Before you begin

Run these commands from your `agentdesktop` repository root on macOS or Linux. For setup, see [Build and install](../build/).

1. With Docker running, verify your tools and example files.

   ```sh
   command -v agentdesktop
   command -v claude
   docker compose version
   docker info > /dev/null && echo "Docker is running"
   test -f examples/standalone/config.yaml \
     && test -f examples/standalone/compose.yaml \
     && echo "Standalone example files found"
   ```

2. Set your Anthropic API key, replacing `sk-ant-...` with your key. Keep this terminal open for Docker Compose.

   ```sh
   export ANTHROPIC_API_KEY='sk-ant-...'
   ```

3. Copy the example configuration. The example configures Claude Code in `--user` mode. Leave the Claude Desktop block commented out.

   ```sh
   cp examples/standalone/config.yaml /tmp/agentdesktop-standalone.yaml
   ```

## Step 1: Start the example services

The local Dex service handles sign-in. The gateway uses that identity to authenticate model requests.

1. Start Dex and agentgateway in the terminal where you set the API key. Dex uses `127.0.0.1:5557`, and the gateway uses `127.0.0.1:4001`.

   ```sh
   docker compose -f examples/standalone/compose.yaml up -d
   ```

   Example output on the first run, after any image downloads:

   ```console
   ✔ Network standalone_default           Created
   ✔ Container standalone-dex-1           Started
   ✔ Container standalone-agentgateway-1  Started
   ```

2. Wait for both services to respond before starting the daemon. The gateway's `HEAD /` check tests connectivity. The [Claude Code test](#step-5-use-claude-code-through-agentgateway) verifies authenticated requests.

   ```sh
   curl --fail --silent --show-error \
     --retry 10 --retry-all-errors --retry-delay 1 \
     http://127.0.0.1:5557/dex/.well-known/openid-configuration \
     > /dev/null && echo "Dex is ready"

   curl --fail --head --silent --show-error \
     --retry 10 --retry-all-errors --retry-delay 1 \
     http://127.0.0.1:4001/ \
     > /dev/null && echo "Agentgateway is ready"
   ```

   Expected output once both are ready:

   ```console
   Dex is ready
   Agentgateway is ready
   ```

<!-- Troubleshooting
### If agentgateway does not stay running

1. Check the container state and startup logs. Both services should have an `Up` status. The Compose file starts Dex first, but [startup order does not guarantee readiness](https://docs.docker.com/compose/how-tos/startup-order/).

   ```sh
   docker compose -f examples/standalone/compose.yaml ps --all
   docker compose -f examples/standalone/compose.yaml logs --tail 50 agentgateway dex
   ```

2. If the logs report that Dex was unavailable, repeat the [service checks](#step-1-start-the-example-services) until Dex responds. For a missing API key, repeat the [API key step](#before-you-begin) in your Compose terminal.

3. In your Compose terminal, restart the gateway.

   ```sh
   docker compose -f examples/standalone/compose.yaml up -d agentgateway
   ```

4. Repeat the [gateway check](#step-1-start-the-example-services) before you continue.

-->

## Step 2: Preview the configuration

Use a dry run to inspect the proposed changes without writing files.

1. Preview the Claude Code settings.

   ```sh
   agentdesktop daemon \
     --config /tmp/agentdesktop-standalone.yaml \
     --user \
     --dry-run
   ```

   Example output on macOS (paths and change counts vary):

   ```diff
   Dry run — no files will be changed

   UPDATE  Claude Code settings
           /Users/<user>/.claude/settings.json
   --- current
   +++ proposed
   @@ ... @@
    {
   +  "apiKeyHelper": "'/Users/<user>/.cargo/bin/agentdesktop' '--socket' '/Users/<user>/.local/state/agentdesktop/agentdesktop.sock' 'credential' '--client-id' 'claude-code'",
   +  "companyAnnouncements": [
   +    "Using the local Agentgateway through Agentdesktop"
   +  ],
   +  "env": {
   +    "ANTHROPIC_BASE_URL": "http://127.0.0.1:4001/",
   +    "CLAUDE_CODE_API_KEY_HELPER_TTL_MS": "60000"
   +  },
    ...

   Summary: 1 change, 6 unchanged
   ```

2. Review the proposed settings and resolve any conflicts. When the daemon starts, these values merge into `~/.claude/settings.json` without changing unrelated settings.

   | Setting | Purpose |
   | --- | --- |
   | `ANTHROPIC_BASE_URL` | Sets the local gateway address for model requests. |
   | `apiKeyHelper` | Gets a credential from the daemon. |
   | `companyAnnouncements` | Sets the message in the Claude Code startup banner. |

## Step 3: Run the daemon and sign in

The daemon needs your identity to supply gateway credentials. The example uses your local Dex service for sign-in.

1. Start the daemon without `--dry-run` and leave the daemon running in this terminal.

   ```sh
   agentdesktop daemon \
     --config /tmp/agentdesktop-standalone.yaml \
     --user
   ```

2. If the **Connect Agentdesktop** page opens, click **Continue to sign in** under **Organization sign-in**. If you are already signed in, continue to step 5.

   {{< docs-screenshot src="images/agentdesktop-connect-login.png" width="760" height="780" compact=true alt="Connect Agentdesktop page with required Organization sign-in and a Continue to sign in button." caption="Start the sign-in flow for your local workstation." >}}

3. Sign in with the example Dex account.

   | Field | Value |
   | --- | --- |
   | Email | `admin@example.com` |
   | Password | `password` |

4. When **Agentdesktop connected** appears, close the browser tab. Keep the daemon running in your terminal.

   {{< docs-screenshot src="images/agentdesktop-connect-success.png" width="760" height="780" compact=true alt="Agentdesktop connected page with Organization sign-in complete." caption="After sign-in, you can close the browser tab." >}}

5. In another terminal, verify that the daemon responds with `ok`.

   ```sh
   agentdesktop status
   ```

6. List the discovered developer tools. The results can include Claude Desktop. This quickstart configures only Claude Code.

   ```sh
   agentdesktop discover
   ```

   Example output:

   ```console
   codex          unknown version  /opt/homebrew/bin/codex
   claude-code    2.1.283           /Users/<user>/.local/bin/claude
   claude-desktop 1.25927.0         /Applications/Claude.app/Contents/MacOS/Claude
   vscode         1.131.0           /opt/homebrew/bin/code
   ```

## Step 4: Open the agentdesktop app

Use the app to inspect the daemon, large language model (LLM) gateway, and discovered tools.

1. With the daemon still running, open the desktop app in another terminal.

   ```sh
   agentdesktop
   ```

2. On **Status**, verify the connection status. The number of discovered tools depends on your workstation.

   - **Local daemon**: **Running**.
   - **LLM gateway**: **Configured**.

   {{< docs-screenshot src="images/agentdesktop-landing.png" width="2104" height="1584" contained=true alt="Agent Desktop Status page showing a running local daemon, a configured LLM gateway, and discovered tools." caption="The Status page summarizes the local daemon, gateway configuration, and tool inventory." >}}

3. Expand **Runtime** with the **View** button. Expect **Mode** to show **Standalone** and the desktop and daemon versions to match.

   {{< docs-screenshot src="images/desktop-standalone-runtime.png" width="820" height="316" contained=true alt="Expanded Runtime panel with standalone mode on macOS and matching desktop and daemon versions." caption="The Runtime panel shows the local standalone configuration." >}}

4. Open **Tools** to inspect developer tools, Model Context Protocol (MCP) servers, skills, and local models. The `agentdesktop discover` command reports the same inventory.

## Step 5: Use Claude Code through agentgateway

The gateway container keeps the Anthropic API key from your Compose terminal. In a separate terminal, use the daemon's credential helper for Claude Code.

1. Clear direct Anthropic credentials from the new terminal.

   ```sh
   unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN
   ```

2. Start Claude Code and look for the announcement from your YAML configuration in the startup banner.

   ```sh
   claude
   ```

   Example output:

   ```console
   Claude Code v2.1.283
   Sonnet 5 with high effort · API Usage Billing

   ▎ Using the local Agentgateway through Agentdesktop
   ```

3. In Claude Code, run `/status` to verify the gateway settings. See the [gateway verification guidance](https://code.claude.com/docs/en/llm-gateway-connect#check-for-an-existing-configuration) for details.

   - Anthropic base URL: `http://127.0.0.1:4001/`.
   - Credential source: `apiKeyHelper`.

4. Send a short prompt, such as `Reply with hello.` A successful response confirms the request path through the gateway to Anthropic.

## Cleanup

Deleting files in `/tmp` does not restore Claude Code settings. Use an empty configuration with `--user` to undo the quickstart changes.

1. Quit Claude Code and the agentdesktop app. Stop the daemon with **Ctrl+C** so it cannot reapply settings during cleanup.

2. Preview cleanup with an empty configuration. The preview shows how cleanup restores previous settings and preserves unrelated preferences. A settings file created by the quickstart can be removed if no other settings remain.

   If you deleted the history beside `~/.claude/settings.json`, restore the affected values from your previous configuration. Keep your personal settings file.

   ```sh
   printf '{}\n' > /tmp/agentdesktop-cleanup.yaml
   agentdesktop daemon \
     --config /tmp/agentdesktop-cleanup.yaml \
     --user \
     --dry-run
   ```

3. Resolve any `CONFLICT` in the preview, then apply cleanup.

   ```sh
   agentdesktop daemon \
     --config /tmp/agentdesktop-cleanup.yaml \
     --user \
     --once
   ```

   Expected output:

   ```console
   Reconciliation complete.
   ```

4. From the repository root, stop the containers and remove the temporary files.

   ```sh
   docker compose -f examples/standalone/compose.yaml down
   rm -f /tmp/agentdesktop-standalone.yaml /tmp/agentdesktop-cleanup.yaml
   ```

   Example Compose output:

   ```console
   [+] Running 3/3
   ✔ Container standalone-agentgateway-1  Removed
   ✔ Container standalone-dex-1           Removed
   ✔ Network standalone_default           Removed
   ```

5. Clear the example's environment variables and restart Claude Code. Sign in with `/login`, or set your usual API key.

   ```sh
   unset ANTHROPIC_BASE_URL ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN \
     CLAUDE_CODE_API_KEY_HELPER_TTL_MS
   claude
   ```

6. Run `/status` to confirm that the local gateway URL and agentdesktop credential helper are gone. The startup banner should no longer show the gateway announcement. If you also ran the controller-managed quickstart, complete the [system-mode cleanup](../managed/#cleanup).

## Next steps

- Try the [controller-managed quickstart](../managed/) to enroll your workstation and manage its configuration through a fleet controller.
- To configure Claude Desktop, follow the [Claude Desktop example](https://github.com/agentdesktop-dev/agentdesktop/tree/main/examples/standalone#claude-desktop). That example requires system mode.
- To change either interface, see [Develop the web interfaces](../../contributing/#develop-the-web-interfaces).
- For a production deployment, use your own OpenID Connect (OIDC) client, trusted HTTPS endpoints, gateway policy, and secret management. See [Production deployment](../../operations/production/).
