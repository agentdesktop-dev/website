---
title: Standalone
description: Configure Claude Code on one workstation and send model requests through agentgateway without a fleet controller.
weight: 2
---

Use this quickstart to configure Claude Code with a local YAML file. You can inspect the configuration in the desktop app and send a model request through agentgateway. You do not need a fleet controller.

The example runs Dex and agentgateway in Docker. Use the test account in Dex to sign in. The local agentdesktop daemon supplies gateway credentials to Claude Code. The gateway forwards authenticated model requests to Anthropic.

## Before you begin

Use a macOS or Linux shell. Run the commands from your existing `agentdesktop` repository root. For installation or a repository clone, follow [Build and install](../build/).

1. Start Docker Desktop. On Linux, you can use a running Docker Engine instead.

2. Verify that the tools and example files are available:

   ```sh
   command -v agentdesktop
   command -v claude
   docker compose version
   docker info > /dev/null && echo "Docker is running"
   test -f examples/standalone/config.yaml \
     && test -f examples/standalone/compose.yaml \
     && echo "Standalone example files found"
   ```

   The first two commands print executable paths. Continue after Compose prints its version and both confirmation messages appear.

3. Set your Anthropic application programming interface (API) key in this terminal. Replace `sk-ant-...` with your key:

   ```sh
   export ANTHROPIC_API_KEY='sk-ant-...'
   ```

   The Compose configuration passes this key to agentgateway for requests to Anthropic. The daemon supplies a separate gateway credential for Claude Code. Keep this terminal open for the Compose commands.

4. Create a working copy of the agentdesktop configuration for Claude Code:

   ```sh
   cp examples/standalone/config.yaml /tmp/agentdesktop-standalone.yaml
   ```

   This YAML file defines the settings to manage in Claude Code's `~/.claude/settings.json` file. The active tool configuration is:

   ```yaml
   programs:
     claudeCode:
       useLlmGateway: true
       companyAnnouncements: ["Using the local Agentgateway through Agentdesktop"]
   ```

   The `--user` option limits configuration changes to your current user. Claude Desktop configuration requires system privileges. Leave the `claudeDesktop` block commented out.

## Start the example services

The local Dex service handles sign-in. The gateway uses that identity to authenticate model requests.

1. Start Dex and agentgateway in the terminal where you set the API key:

   ```sh
   docker compose -f examples/standalone/compose.yaml up -d
   ```

   Example output on the first run, after any image downloads:

   ```console
   ✔ Network standalone_default           Created
   ✔ Container standalone-dex-1           Started
   ✔ Container standalone-agentgateway-1  Started
   ```

   The Dex endpoint is `127.0.0.1:5557`. The gateway endpoint is `127.0.0.1:4001`. The Compose command starts both containers.

2. Wait for both services to respond before starting the daemon:

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

   The `HEAD /` check confirms that the gateway accepts connections. The [Claude Code test](#use-claude-code-through-agentgateway) verifies authenticated model requests.

### If agentgateway does not stay running

1. Check the container state and startup logs:

   ```sh
   docker compose -f examples/standalone/compose.yaml ps --all
   docker compose -f examples/standalone/compose.yaml logs --tail 50 agentgateway dex
   ```

   Both services should have an `Up` status. The Compose file starts Dex first, but [startup order does not guarantee readiness](https://docs.docker.com/compose/how-tos/startup-order/).

2. If the logs report that Dex was unavailable, repeat the [service checks](#start-the-example-services) until Dex responds.

   If the logs report a missing API key, repeat the [API key step](#before-you-begin) in your Compose terminal.

3. In your Compose terminal, restart the gateway:

   ```sh
   docker compose -f examples/standalone/compose.yaml up -d agentgateway
   ```

4. Repeat the [gateway check](#start-the-example-services) before you continue.

## Preview the configuration

Use a dry run to inspect the proposed changes without writing files.

1. Preview the Claude Code settings:

   ```sh
   agentdesktop daemon \
     --config /tmp/agentdesktop-standalone.yaml \
     --user \
     --dry-run
   ```

   Example output on macOS, abbreviated to show the settings that this example adds:

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

   Paths and change counts depend on your workstation.

2. Review the proposed settings:

   | Setting | Purpose |
   | --- | --- |
   | `ANTHROPIC_BASE_URL` | Sets the local gateway address for model requests. |
   | `apiKeyHelper` | Gets a credential from the daemon. |
   | `companyAnnouncements` | Sets the message in the Claude Code startup banner. |

   When the daemon starts, the configuration merges into `~/.claude/settings.json`. Unrelated settings remain unchanged. Resolve any reported conflicts before you start the daemon.

## Run the daemon and sign in

The daemon needs your identity to supply gateway credentials. The example uses your local Dex service for sign-in.

1. Start the daemon without `--dry-run`:

   ```sh
   agentdesktop daemon \
     --config /tmp/agentdesktop-standalone.yaml \
     --user
   ```

   Keep the daemon running in this terminal.

2. If the **Connect Agentdesktop** page opens, click **Continue to sign in** under **Organization sign-in**.

   With a valid sign-in, the daemon can skip the browser flow. Continue to the status check in step 5.

   {{< docs-screenshot src="images/agentdesktop-connect-login.png" width="760" height="780" alt="Connect Agentdesktop page with required Organization sign-in and a Continue to sign in button." caption="Start the sign-in flow for your local workstation." >}}

3. Sign in with the example Dex account:

   | Field | Value |
   | --- | --- |
   | Email | `admin@example.com` |
   | Password | `password` |

4. When **Agentdesktop connected** appears, close the browser tab. Keep the daemon running in your terminal.

   {{< docs-screenshot src="images/agentdesktop-connect-success.png" width="760" height="780" alt="Agentdesktop connected page with Organization sign-in complete." caption="After sign-in, you can close the browser tab." >}}

5. In another terminal, verify that the daemon responds:

   ```sh
   agentdesktop status
   ```

   Expected output:

   ```console
   ok
   ```

6. List the discovered developer tools:

   ```sh
   agentdesktop discover
   ```

   Example output, which varies with your installed tools:

   ```console
   codex          unknown version  /opt/homebrew/bin/codex
   claude-code    2.1.283           /Users/<user>/.local/bin/claude
   claude-desktop 1.25927.0         /Applications/Claude.app/Contents/MacOS/Claude
   vscode         1.131.0           /opt/homebrew/bin/code
   ```

   The results can include Claude Desktop. This quickstart configures only Claude Code.

## Open the agentdesktop app

Use the app to inspect the daemon, large language model (LLM) gateway, and discovered tools.

1. With the daemon still running, open the desktop app in another terminal:

   ```sh
   agentdesktop
   ```

2. On **Status**, verify the connection status:

   - **Local daemon**: **Running**.
   - **LLM gateway**: **Configured**.

   The number of discovered tools depends on your workstation.

   {{< docs-screenshot src="images/agentdesktop-landing.png" width="2104" height="1584" alt="Agent Desktop Status page showing a running local daemon, a configured LLM gateway, and discovered tools." caption="The Status page summarizes the local daemon, gateway configuration, and tool inventory." >}}

3. Expand **Runtime** with the **View** button.

   The **Mode** value should be **Standalone**. The desktop and daemon versions should match.

   {{< docs-screenshot src="images/desktop-standalone-runtime.png" width="820" height="316" alt="Expanded Runtime panel with standalone mode on macOS and matching desktop and daemon versions." caption="The Runtime panel shows the local standalone configuration." >}}

4. Open **Tools** to inspect the local inventory.

   The inventory includes developer tools, Model Context Protocol (MCP) servers, skills, and local models. The `agentdesktop discover` command reports the same inventory.

## Use Claude Code through agentgateway

The gateway container keeps the Anthropic API key from your Compose terminal. In a separate terminal, use the daemon's credential helper for Claude Code.

1. Clear direct Anthropic credentials from the new terminal:

   ```sh
   unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN
   ```

2. Start Claude Code:

   ```sh
   claude
   ```

   The startup banner includes the announcement from your YAML configuration:

   ```console
   Claude Code v2.1.283
   Sonnet 5 with high effort · API Usage Billing

   ▎ Using the local Agentgateway through Agentdesktop
   ```

3. In Claude Code, run `/status` to verify the gateway settings:

   - Anthropic base URL: `http://127.0.0.1:4001/`.
   - Credential source: `apiKeyHelper`.

   See Claude Code's [gateway verification guidance](https://code.claude.com/docs/en/llm-gateway-connect#check-for-an-existing-configuration) for details.

4. Send a short prompt, such as `Reply with hello.`

   A successful response confirms the request path through the gateway to Anthropic. The request uses the daemon's gateway credential and your Anthropic API key.

## Cleanup

Deleting the files in `/tmp` does not restore `~/.claude/settings.json`. An empty configuration removes the settings managed by agentdesktop. Use `--user` for cleanup to match the mode that you used for the quickstart.

1. Exit Claude Code.

2. Quit the agentdesktop app from its tray or menu bar menu.

3. In the daemon terminal, press **Ctrl+C** to stop the daemon.

   Keep the daemon stopped during cleanup. A running daemon can reapply the gateway configuration.

4. Create a temporary configuration that contains only `{}`:

   ```sh
   printf '{}\n' > /tmp/agentdesktop-cleanup.yaml
   ```

   This empty configuration tells the daemon to stop managing tools.

5. Preview the cleanup:

   ```sh
   agentdesktop daemon \
     --config /tmp/agentdesktop-cleanup.yaml \
     --user \
     --dry-run
   ```

   The preview shows changes to `apiKeyHelper`, gateway-related `env` values, and the announcement in `~/.claude/settings.json`. Cleanup uses saved history to restore previous values and preserve unrelated settings. If the quickstart created the settings file, cleanup can remove that file when no other settings remain.

   Cleanup needs the saved history beside your settings file. If you deleted that history, use your previous configuration to restore the affected settings. Deleting the entire settings file also removes your personal preferences.

6. After you resolve any `CONFLICT` in the preview, apply the cleanup once:

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

7. From the repository root, stop the containers:

   ```sh
   docker compose -f examples/standalone/compose.yaml down
   ```

   Example Compose output:

   ```console
   [+] Running 3/3
   ✔ Container standalone-agentgateway-1  Removed
   ✔ Container standalone-dex-1           Removed
   ✔ Network standalone_default           Removed
   ```

8. Remove the temporary configuration files:

   ```sh
   rm -f /tmp/agentdesktop-standalone.yaml /tmp/agentdesktop-cleanup.yaml
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

    The local gateway URL and agentdesktop credential helper should be absent. The startup banner should no longer include the local gateway announcement. If you also ran the controller-managed quickstart, complete the [system-mode cleanup](../managed/#cleanup).

## Next steps

- Try the [controller-managed quickstart](../managed/) to enroll your workstation and manage its configuration through a fleet controller.
- To configure Claude Desktop, follow the [Claude Desktop example](https://github.com/agentdesktop-dev/agentdesktop/tree/main/examples/standalone#claude-desktop). That example requires system mode.
- To change either interface, see [Develop the web interfaces](../../contributing/#develop-the-web-interfaces).
- For a production deployment, use your own OpenID Connect (OIDC) client, trusted HTTPS endpoints, gateway policy, and secret management. See [Production deployment](../../operations/production/).
