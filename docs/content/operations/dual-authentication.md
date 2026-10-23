---
title: Gateway and subscription authentication
description: Configure separate gateway and provider credentials for VS Code Copilot Chat, Claude Code, Claude Desktop, OpenCode, and Codex, with deployment boundaries and validation requirements.
weight: 5
sidebar_toc: true
---

<!-- markdownlint-configure-file { "MD024": { "siblings_only": true } } -->

A developer may need to authenticate to the organization's gateway while using their own provider subscription or API key for inference. These are two separate credentials: the gateway validates the organization identity, and the upstream provider validates the subscription or API key.

Agentdesktop supports two ways to carry both: the local proxy separates credentials into two headers for client-owned authentication, while Claude and Codex use Agentdesktop-owned subscription OAuth and a composite credential helper. Choose the mechanism supported by your harness.

## Choose the harness integration

| Harness | Configuration | Credential handling |
| --- | --- | --- |
| VS Code Copilot Chat | `programs.vscode.copilotChat: githubModels` | Managed local proxy keeps the client's Copilot token separate from gateway identity. |
| Claude Code | `programs.claudeCode.auth: subscription` | Credential helper combines an Agentdesktop-managed Anthropic subscription token with gateway identity. |
| Claude Desktop | `programs.claudeDesktop.auth: subscription` | Same composite credential; managed Claude Desktop settings require system mode. |
| OpenCode | Manual OpenAI-compatible provider pointed at the local proxy | Separates a provider API key from gateway identity; not a subscription-login example or an end-to-end validated integration. |
| Codex | `programs.codex.auth: subscription` | Agentdesktop obtains and refreshes the ChatGPT subscription, then supplies a composite credential through the direct helper, like Claude. |

The managed Copilot CLI route sends only gateway identity; it does not pass through a GitHub Copilot subscription token. Selecting gateway models for VS Code likewise uses the gateway's upstream credentials, not the developer's Copilot subscription. OpenCode, Goose, and Grok do not have the Claude-style `auth: subscription` configuration. Do not infer subscription support from their ability to select a custom provider.

The Codex integration is tested with the real Codex 0.153.4 CLI, synthetic credentials, and a mock gateway. Actual paid-account access, token refresh against the provider, and provider terms still require validation before rollout. Upgrade both controller and daemon before distributing this new option.

## How the two credentials travel

| Connection | `Authorization` | `x-llm-token` |
| --- | --- | --- |
| Client to local proxy | Client's provider bearer token | Not required |
| Local proxy to gateway | Gateway identity token from OIDC or the controller | Client's provider token, without the `Bearer` prefix |
| Gateway to provider | Restored provider bearer token | Removed |

The local proxy obtains and refreshes the gateway credential. The client remains responsible for its provider login and token refresh. The gateway must validate the organization identity **before** replacing `Authorization` with the provider credential. Forward required provider headers as well; a bearer token alone may not be sufficient.

On the prefix-less, manually configured proxy route, `llmGateway.githubOAuth.source: request` enables this behavior. Despite the setting's name, this branch copies the incoming bearer token without performing GitHub login or checking that the token is GitHub-specific. Without it, that route discards the client's credential.

Claude and Codex instead use the same Agentdesktop subscription page, PKCE/callback infrastructure, secure storage abstraction, and credential-composition flow. Their provider adapters differ only where required by the provider's OAuth registration, token responses, and refresh protocol. Neither direct-helper integration requires the local LLM proxy.

## Local proxy prerequisites

- Run a per-user daemon. `daemon.llmProxy.listen` is rejected by a system daemon, including the Windows service installed by the MSI.
- Use HTTPS between the proxy, gateway, and upstream provider. Only the loopback connection in this example uses HTTP.
- Protect the per-device pairing value and client configuration from other users. Never log gateway or subscription tokens.
- Ensure the gateway targets the provider's subscription backend with the user's credential, rather than substituting an organization API key. Codex's example uses Agentgateway's LLM pipeline for this.
- Check the provider's subscription terms and your organization's credential-handling policy before deployment.

For a controller-managed device, keep startup settings under local `daemon` configuration, and put the `llmGateway` and `programs` settings in the effective controller-distributed policy. A standalone daemon reads all of them from its local YAML. Do not start a second daemon using an existing daemon's socket, state directory, or listen port.

## VS Code Copilot Chat

Use this managed integration to keep GitHub's models and the developer's existing Copilot sign-in while requiring gateway authentication.

### Configure the per-user daemon

The example uses a controller-enrolled, per-user daemon:

```yaml
daemon:
  user: true
  llmProxy:
    listen: 127.0.0.1:4010

llmGateway:
  url: https://gateway.example.com
  proxyUrl: https://gateway.example.com/copilot-proxy
  authentication:
    type: controllerJwt
    audience: agentgateway
    allowedClientIds: [vscode-copilot]

programs:
  vscode:
    copilotChat: githubModels
```

Keep any existing controller connection and enrollment settings. A standalone installation can use the OIDC authentication block shown in the Codex example instead. Do not configure `programs.vscode.models` together with `copilotChat: githubModels`.

Agentdesktop writes VS Code's Copilot API override with a pairing value in the local proxy URL. There is no manual pairing-header step for this integration, and `githubOAuth.source: request` is not needed: the managed route already selects passthrough behavior. VS Code remains responsible for its GitHub login and Copilot token refresh.

### Configure the gateway route

Configure the gateway to validate the organization JWT, restore `Authorization` from `x-llm-token`, remove that transport header, and forward the remaining path to the correct GitHub Copilot backend for the developer's plan. Support streaming and WebSocket upgrades. Copilot's credential-less `GET /_ping` has no provider token; do not require `x-llm-token` or apply the bearer-restoration transformation to that request. Gateway identity is still supplied by the proxy.

The [complete Copilot example](https://github.com/agentdesktop-dev/agentdesktop/tree/main/examples/copilot) includes an OIDC deployment and an Agentgateway passthrough route. Its example backend is for Copilot Business; select the backend appropriate to your deployment rather than assuming all plans use the same host.

## Claude Code

Claude subscription support uses the credential helper directly, not the loopback proxy. Agentdesktop offers a separate Anthropic subscription sign-in and combines that credential with the organization's identity. It does not automatically read or forward Claude Code's existing login session.

### Configure the per-user daemon

This standalone example runs Claude Code management as the current user:

```yaml
daemon:
  user: true

llmGateway:
  url: https://gateway.example.com/claude-subscription
  authentication:
    type: oidc
    issuer: https://login.example.com
    clientId: agentdesktop
    redirectUri: http://127.0.0.1:51327/callback

programs:
  claudeCode:
    auth: subscription
```

Start the daemon with `agentdesktop daemon --user --config ./agentdesktop.yaml`, complete organization sign-in, and connect the optional Anthropic subscription when prompted. You can retain `controllerJwt` authentication instead of OIDC on an enrolled daemon; authorize the `claude-code` client ID. Subscription sign-in requires the browser flow and cannot be combined with OIDC `deviceAuthorization`.

### Configure the gateway

When the user connects a subscription, the helper supplies a bearer credential shaped as:

```text
agentdesktop:<anthropic-subscription-token>:<gateway-identity-token>
```

The gateway must extract the identity component, validate it, then forward only the subscription component to Anthropic as `Authorization: Bearer <anthropic-subscription-token>`. This is not the `x-llm-token` proxy format. If the user skips subscription sign-in, the helper returns gateway identity alone; decide explicitly whether the gateway rejects that request or uses an organization-funded fallback. Do not silently treat the identity token as an Anthropic credential.

The [Claude subscription example](https://github.com/agentdesktop-dev/agentdesktop/tree/main/examples/claude-subscription) shows the composite-token extraction and upstream transformation. Its local gateway uses permissive JWT mode for demonstration; require successful identity validation and reject malformed composite credentials in production.

## Claude Desktop

Claude Desktop uses the same subscription setting and composite-token gateway contract as Claude Code. Unlike Claude Code's user configuration, its managed inference settings require a **system-mode daemon**. On Windows, Agentdesktop writes those settings to Claude Desktop's machine policy registry key. Do not add it to the per-user proxy configurations above.

### Configure the system daemon

In your existing system-mode configuration, keep the gateway authentication configured as above and add:

```yaml
programs:
  claudeDesktop:
    auth: subscription
```

With controller JWT authentication, authorize `claude-desktop`. Keep the installed credential helper available to the desktop client and validate sign-in and credential access under the actual desktop user's account before rollout. The presence of the configuration option does not certify every platform's managed-settings integration.

### Configure Windows policy and helper

On Windows, Agentdesktop writes Claude Desktop managed settings as flat `REG_SZ`
values under `HKLM\SOFTWARE\Policies\Claude`. String settings are stored as-is;
other values are JSON-encoded. Agentdesktop tracks the value names it owns and
leaves other policy values untouched. The `daemon.claudeDesktop.config` file path
is not the Windows managed-settings target.

The credential helper remains a file. Its default location is
`%ProgramData%\AgentDesktop\claude-desktop-credential-helper.cmd`; override it
in the system daemon's startup configuration only when the installed client
requires another accessible path:

```yaml
daemon:
  claudeDesktop:
    credentialHelper: 'C:\your-managed-location\credential-helper.cmd'
```

Test the installed Claude Desktop version's machine-policy behavior and
subscription sign-in under the actual desktop user's account before rollout.

## Manual OpenCode API-key example

OpenCode's [custom provider configuration](https://opencode.ai/docs/providers/#custom-provider) accepts a base URL, API key, and custom headers. You can use these to send a provider-owned API key through the local proxy while Agentdesktop supplies gateway identity. This example follows the documented configuration interfaces but has not been validated end to end with OpenCode.

### Configure the per-user daemon

For a controller-enrolled, per-user daemon, merge the following with your existing controller configuration, or substitute the OIDC block from the Codex example for standalone use:

```yaml
daemon:
  user: true
  llmProxy:
    listen: 127.0.0.1:4011
    clientId: opencode

llmGateway:
  url: https://gateway.example.com
  proxyUrl: https://gateway.example.com/openai-key
  authentication:
    type: controllerJwt
    audience: agentgateway
    allowedClientIds: [opencode]
  githubOAuth:
    source: request

programs:
  openCode:
    useLlmGateway: false
```

### Configure OpenCode

In your private, user-level OpenCode configuration, merge this custom provider and select it as the model:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "company-key/gpt-4.1",
  "provider": {
    "company-key": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Company API-key Proxy",
      "options": {
        "baseURL": "http://127.0.0.1:4011/v1",
        "apiKey": "{env:PROVIDER_API_KEY}",
        "headers": {
          "x-agentdesktop-pairing": "{env:AGENTDESKTOP_PAIRING}"
        }
      },
      "models": {
        "gpt-4.1": { "name": "GPT-4.1" }
      }
    }
  }
}
```

Supply `PROVIDER_API_KEY` and `AGENTDESKTOP_PAIRING` privately to the OpenCode process before starting it; do not put either value in a repository. The pairing value comes from this daemon's `llm-proxy-pairing` file, as described in the Codex example. The API key is the upstream provider's key, not a gateway JWT. `useLlmGateway: false` avoids selecting Agentdesktop's ordinary gateway-credential provider for this manual configuration.

### Configure the gateway route

For an OpenAI API key, configure the gateway to validate the gateway JWT, restore the bearer from `x-llm-token`, and map `/openai-key/v1/chat/completions` to `https://api.openai.com/v1/chat/completions`. Follow the [Copilot gateway example's header-restoration pattern](https://github.com/agentdesktop-dev/agentdesktop/blob/main/examples/copilot/agentgateway.yaml), reject missing provider credentials, and preserve streaming. Keep `/v1` in exactly one place in the final upstream path. For another OpenAI-compatible provider, use its documented endpoint and a model it actually serves.

### Validate before rollout

This uses API-key billing, not a ChatGPT or Copilot subscription. It does not redirect OpenCode's OAuth plugins, refresh a provider API key, or establish that a plugin honors a custom base URL. Validate missing pairing, invalid gateway identity, invalid provider key, successful streaming, and proxy-unavailable failure before rollout. The manual provider is not managed by `llmGateway.whenProxyUnavailable`.

## Codex ChatGPT subscriptions

### Configure the daemon

This standalone example uses OIDC for gateway authentication. Replace the URLs, issuer, and client ID with your deployment's values. Register the loopback redirect URI with the identity provider, and configure it to issue access tokens accepted by your gateway.

```yaml
daemon:
  user: true

llmGateway:
  url: https://gateway.example.com/v1
  authentication:
    type: oidc
    issuer: https://login.example.com
    clientId: agentdesktop
    redirectUri: http://127.0.0.1:51327/callback

programs:
  codex:
    auth: subscription
```

Start the daemon with your configuration:

```sh
agentdesktop daemon --user --config ./agentdesktop.yaml
```

Agentdesktop generates a Responses provider pointed directly at `llmGateway.url`, with `requires_openai_auth = false` and an Agentdesktop credential command. The helper supplies both credentials, as it does for Claude. Neither `daemon.llmProxy.listen`, `proxyUrl`, `githubOAuth`, nor a pairing header is required. System mode uses the same helper contract, with credentials belonging to the daemon's account.

If you already use `controllerJwt`, retain that authentication configuration rather than adding the OIDC block above, and allow `codex` in the controller's `allowedClientIds`. The per-user daemon must be enrolled separately as appropriate for your deployment; it does not inherit a system service's enrollment automatically.

### Sign in through Agentdesktop

Complete organization sign-in and continue to the optional ChatGPT subscription step in Agentdesktop's browser page. A separate `codex login` is not required. Agentdesktop stores the access and refresh tokens securely, handles refresh rotation, and requests sign-in again when refresh is rejected. The shared page uses port 51327; OpenAI's registered callback uses `http://localhost:1455/auth/callback`.

In user mode Agentdesktop manages `~/.codex/config.toml`. If a personal file already exists without Agentdesktop's ownership header, reconciliation reports a conflict instead of overwriting it. Migrate needed settings into `programs.codex.managedConfig` and resolve that conflict before testing. Keep Codex's separate login file intact.

The generated Codex configuration contains a helper command, not the subscription token. For a manual proxy client such as OpenCode, pairing still comes from `llm-proxy-pairing` in the daemon's state directory: `$XDG_STATE_HOME/agentdesktop` or `~/.local/state/agentdesktop` by default, using `HOME` or `USERPROFILE` on Windows. `daemon.stateDir` overrides it. Protect credential-bearing files with user-only permissions or Windows ACLs.

Do not point `daemon.codex.config` at `requirements.toml`. Requirements are Codex's separate policy format; changing the destination filename does not convert Agentdesktop's generated configuration into requirements.

Codex appends `/responses` to the generated gateway base URL. Do not add `/v1` unless the gateway deliberately expects and rewrites it. The helper carries the ChatGPT account ID in an optional fourth field while preserving Claude's existing identity position:

```text
agentdesktop:<provider-access-token>:<gateway-identity-token>:<chatgpt-account-id>
```

### Configure the LLM provider

Use Agentgateway's `llm` configuration, not a raw `routes` backend or opaque passthrough. Require a valid four-field composite credential and validate the third field as the gateway JWT using your issuer, audience, and signing keys. Configure the OpenAI model provider with `params.baseUrl: https://chatgpt.com/backend-api/codex`. The normal Responses endpoint then maps as follows:

```text
Incoming: /v1/responses
Upstream: https://chatgpt.com/backend-api/codex/responses
```

This is the ChatGPT Codex subscription backend, not the API-key endpoint at `api.openai.com/v1`. After validating identity, restore `ChatGPT-Account-Id` from the fourth field and `Authorization` from the second field in one header-replacement expression. Preserve other headers and streaming responses. Model routing, LLM policies, and token-usage processing stay active.

The [complete Codex subscription example](https://github.com/agentdesktop-dev/agentdesktop/tree/main/examples/codex-subscription) pins Agentgateway 1.6.0 and includes daemon YAML, Dex, and an LLM model with strict identity validation and atomic header restoration. Its dedicated listener marks access logs as subscription-billed; retain that label when configuring OTLP usage export. Reject missing or malformed composites before forwarding. Never forward the gateway JWT as the provider credential or accept an arbitrary caller-selected upstream host. Skipping subscription sign-in returns identity alone; the example rejects that request instead of using a paid fallback.

### Validate before rollout

Use a disposable user profile and test with the actual Codex, Agentdesktop, and gateway versions you intend to deploy:

1. Confirm Agentdesktop's organization and ChatGPT sign-in steps complete, and Codex uses the generated helper without a native ChatGPT login.
2. Confirm malformed composites and skipped subscriptions are rejected by the LLM authentication policy.
3. Confirm the gateway rejects a missing or invalid gateway credential before any upstream forwarding.
4. Confirm a valid ChatGPT login can complete a streamed Codex request through the gateway, while an invalid provider credential is rejected upstream. Inspect only header presence and routing metadata, never token values.
5. Confirm the account-identification headers, request path, subscription billing, and both credential-refresh flows behave as expected.
6. Stop the daemon and confirm the helper fails rather than bypassing the gateway. The local proxy and `llmGateway.whenProxyUnavailable` are not involved in this mode.

The native test uses Codex 0.153.4 with synthetic credentials in Agentdesktop's store, no native Codex login file, and no proxy. The example's real Agentgateway LLM pipeline was separately checked for model mapping, Responses-field preservation, streaming, provider/account headers, and token metrics reporting 10 input and 5 output tokens. Provider tests cover PKCE, the shared callback page, refresh rotation, account consistency, and redacted failures. Live paid-account access and OpenAI's provider-controlled OAuth registration still need validation. With controller JWT authentication, subscription billing is marked only when a subscription is actually composed with the identity.
