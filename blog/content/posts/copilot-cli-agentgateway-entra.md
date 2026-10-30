---
title: Run GitHub Copilot CLI Through agentgateway, Signed In with Entra ID
slug: copilot-cli-agentgateway-entra
description: Copilot CLI with no personal token on the laptop and no hand-written config. agentdesktop writes Copilot CLI's provider file and runs a loopback proxy, the device signs in once with Entra ID, and agentgateway checks every request, routes it to Claude on Amazon Bedrock, and logs usage and cost per tool.
date: 2026-10-30T00:04:00Z
lastmod: 2026-10-30T00:04:00Z
draft: false
author: Sebastian Maniak
categories:
  - Engineering
tags:
  - agentdesktop
  - agentgateway
  - GitHub Copilot CLI
  - Entra ID
  - OIDC
  - Amazon Bedrock
series: agentgateway-integrations
seriesPart: 1
seriesLabel: "GitHub Copilot CLI, signed in with Entra ID"
stack:
  - Copilot CLI
  - agentdesktop
  - agentgateway
  - Amazon Bedrock
cover: /blog/images/agentgateway-series/copilot-cli-architecture.svg
coverAlt: Copilot CLI architecture with Entra ID, Dex, agentdesktop, agentgateway and Amazon Bedrock
---

GitHub Copilot CLI is a good terminal agent. Out of the box it signs in with your own GitHub account and talks to GitHub's models. That is fine for one person. It stops being fine when you want the same answers for every tool on every machine: who sent this, from which device, to which model, at what cost, and can I turn it off?

I already run Claude Code, Codex, Claude Desktop, Grok Build, OpenCode and Pi this way: [agentdesktop](https://github.com/agentdesktop-dev/agentdesktop) configures each tool, and every request goes through [agentgateway](https://agentgateway.dev). Copilot CLI was the odd one out. This post shows how I brought it in, with Entra ID as the sign-in.

{{< series title="Every AI tool through one gateway" >}}

{{< callout type="summary" title="What you end up with" >}}
- **No GitHub sign-in and no model key on the desktop.** Copilot CLI uses a provider file that agentdesktop writes. The only secret in it is a local pairing code that is useless off the machine.
- **One sign-in, with Entra ID.** The device enrols once through Dex, which hands the login to Microsoft Entra ID.
- **Short-lived gateway tokens.** The fleet controller signs a five-minute JWT for each tool. agentgateway accepts nothing else.
- **One place for policy, logs and cost.** agentgateway logs every request with the tool's client ID (`copilot-cli`) and the user, and its UI (also behind Entra) shows logs, analytics and cost.
{{< /callout >}}

## Architecture

The setup has five parts, and only agentgateway talks to a model provider.

{{< diagram src="images/agentgateway-series/copilot-cli-architecture.svg" alt="Copilot CLI reads a providers file written by the agentdesktop daemon and sends requests through a loopback proxy. The proxy enrols once through Dex and Entra ID, receives policy and five-minute JWTs from the fleet controller, and forwards requests to agentgateway, which holds the Bedrock API key, logs every call to Postgres and serves a UI behind Entra login." caption="The desktop holds no provider credential. agentgateway is the only component that can reach a model, and it records every call it forwards." >}}

| Piece | Job |
|---|---|
| **Entra ID** | Who you are. Two app registrations: one for Dex (device sign-in), one for the agentgateway UI. |
| **Dex** | The OIDC issuer that agentdesktop and the controller trust. An Entra connector sits next to a local password login, which stays for automation and headless devices. |
| **Fleet controller** | Enrols devices, pushes the policy (which tools, which models, which gateway), and signs short-lived gateway JWTs. |
| **agentdesktop daemon** | Runs on the desktop as root. It writes each tool's config and, for Copilot CLI, runs a loopback proxy that adds the gateway JWT. |
| **agentgateway** | Checks the JWT, routes by model name, holds the provider credential, logs and prices every request. |

## What one request looks like

{{< diagram src="images/agentgateway-series/copilot-cli-request-flow.svg" alt="Sequence diagram: Copilot CLI posts to the agentdesktop proxy with a pairing header; the proxy checks the pairing code, loopback host and missing Origin header, fetches a five-minute JWT from the fleet controller, and forwards the request to agentgateway with a bearer token. agentgateway verifies the token, calls Bedrock, returns the reply and reports usage to the controller." caption="Steps 5 to 7 are the only hops that leave the machine, and the provider credential is used only in step 7." >}}

The pairing code never leaves the desktop. The proxy strips it, along with any `Authorization` header the tool sent, before it calls the gateway.

## 1. Entra ID: two app registrations

Both are single-tenant **Web** apps with a client secret. The secrets live in Vault, never in git.

| App | Redirect URI | Used by |
|---|---|---|
| `goose-agentdesk-dex` | `http://localhost:5556/dex/callback` | Dex's Entra connector (device sign-in) |
| `goose-agentdesk-gateway-ui` | `http://localhost:15102/oauth/callback` | agentgateway UI login |

Two settings matter:

- **Require assignment.** Under Enterprise applications → the app → Properties, turn on *Assignment required*, then add the users who may sign in. Everyone else gets a clean "not assigned" error from Microsoft.
- **Consent.** The apps need `openid`, `profile`, `email`, `offline_access` and `User.Read`. If your tenant blocks user consent, an admin grants it once, or each assigned user consents for themselves.

```bash
az ad app create --display-name goose-agentdesk-dex \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris http://localhost:5556/dex/callback
az ad sp update --id <service-principal-id> --set appRoleAssignmentRequired=true
```

{{< callout type="warning" title="Plain HTTP is only accepted on localhost" >}}
Entra will let you *register* `http://192.168.1.20:5556/dex/callback`, then refuse it at sign-in with `AADSTS500117`. That's why Dex's issuer below is `localhost`.
{{< /callout >}}

## 2. Dex with an Entra connector

Dex stays the issuer that agentdesktop and the controller trust. Entra becomes one of its login options.

```yaml
issuer: http://localhost:5556/dex
connectors:
  - type: oidc
    id: entra
    name: Microsoft Entra ID
    config:
      issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
      clientID: <dex-app-client-id>
      clientSecret: "<from-vault>"
      redirectURI: http://localhost:5556/dex/callback
      scopes: [openid, profile, email]
      # Entra sends no email_verified claim; use the UPN as the email.
      insecureSkipEmailVerified: true
      claimMapping:
        email: preferred_username
      # Dex sends prompt=consent by default, which forces a consent screen on
      # every login ("Need admin approval" when user consent is restricted).
      promptType: ""
enablePasswordDB: true   # local login for automation and headless devices
```

Dex has to be on `localhost` for every device that signs in. Other machines reach it through a small forwarder to the desktop that runs it:

```bash
socat TCP-LISTEN:5556,bind=127.0.0.1,fork TCP:<desktop-ip>:5556
```

On the desktop, signing in with Microsoft is one action: sign the daemon out, then open the sign-in URL with `connector_id=entra`. I put that behind a desktop icon called **Sign in with Microsoft**.

## 3. The fleet controller and its policy

The controller trusts Dex for enrolment and signs gateway tokens. The policy it pushes to every device is where Copilot CLI is turned on:

```yaml
llmGateway:
  url: http://127.0.0.1:4002
  authentication:
    type: controllerJwt
    audience: agentgateway
    allowedClientIds: [claude-code, codex, copilot-cli, vscode-copilot]

programs:
  copilot:
    useLlmGateway: true
    models:
      claude-sonnet-5-5:
        provider: agentdesktop-anthropic
```

`provider: agentdesktop-anthropic` sends this model through the proxy's Anthropic route. In Copilot CLI it shows up as `agentdesktop-anthropic/claude-sonnet-5-5`.

## 4. The agentdesktop daemon on the desktop

On my desktop, one daemon runs as root and manages every tool. That matters: Claude Desktop, Codex and Grok read system-wide managed config, so they need the system daemon.

Copilot CLI's file, though, lives in the user's home. Upstream, both that file and the loopback proxy were user-mode only. Two small upstream changes close that gap:

- [agentdesktop#196](https://github.com/agentdesktop-dev/agentdesktop/pull/196) lets the system daemon manage Pi for one named user.
- [agentdesktop#216](https://github.com/agentdesktop-dev/agentdesktop/pull/216) does the same for Copilot CLI and VS Code, and runs the proxy for that user.

With both, the daemon config is just paths:

```yaml
daemon:
  copilot:
    config: /home/agent/.copilot/providers.json
  llmProxy:
    listen: 127.0.0.1:18095
```

The daemon writes `providers.json` as the user, mode 0600, with two providers pointed at the proxy:

```json
{
  "providers": [
    { "name": "agentdesktop", "type": "openai",
      "baseUrl": "http://127.0.0.1:18095/copilot-cli/v1",
      "headers": { "x-agentdesktop-pairing": "<pairing>" } },
    { "name": "agentdesktop-anthropic", "type": "anthropic",
      "baseUrl": "http://127.0.0.1:18095/copilot-cli",
      "headers": { "x-agentdesktop-pairing": "<pairing>" } }
  ],
  "models": [
    { "provider": "agentdesktop-anthropic", "id": "claude-sonnet-5-5" }
  ]
}
```

{{< callout type="tip" title="One user, no system-wide tools?" >}}
You don't need the upstream changes. Run the daemon with `--user` and it manages Copilot CLI and the proxy on its own.
{{< /callout >}}

## 5. agentgateway

The gateway accepts only the controller's tokens, and holds the Bedrock credential:

```yaml
llm:
  gateways: gateway
  policies:
    jwtAuth:
      mode: strict
      issuer: agentdesktop-controller
      audiences: [agentgateway]
      jwks:
        url: http://127.0.0.1:8080/.well-known/jwks.json
  models:
    - name: claude-sonnet-5-5
      provider: bedrock
      params:
        model: us.anthropic.claude-sonnet-5-5
        awsRegion: us-east-1
        apiKey: "$BEDROCK_API_KEY"   # Bedrock API key, sent as a bearer token
```

The UI and its data need four more settings:

```yaml
config:
  database:
    url: $AGW_DB_URL               # Postgres: request log for Logs, Analytics, Costs
  modelCatalog:
    - file: /var/lib/agentgateway/catalog/base-costs.json
  standardAttributes:
    user: jwt.email
    group: jwt.client_id           # analytics grouped by tool

frontendPolicies:
  accessLog:
    database:
      llm: full                    # keep prompts and completions in the log

ui:
  gateways: ui                     # its own loopback listener
  policies:
    oidc:
      issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
      clientId: <ui-app-client-id>
      clientSecret: $ENTRA_UI_CLIENT_SECRET
      redirectURI: http://localhost:15102/oauth/callback
      scopes: [profile, email]
```

{{< callout type="warning" title="Set OIDC_COOKIE_SECRET" >}}
The UI login needs `OIDC_COOKIE_SECRET`, a 64-character hex key (`openssl rand -hex 32`). Without it the gateway exits at startup.
{{< /callout >}}

## Using it

```bash
copilot --model agentdesktop-anthropic/claude-sonnet-5-5

# In scripts: -s prints only the answer, no stats block
copilot -s -p "Summarize the last commit" --model agentdesktop-anthropic/claude-sonnet-5-5
```

There is no `/login` step. If agentdesktop isn't running or the device isn't enrolled, the request fails instead of quietly falling back to GitHub.

## Checking that it works

```bash
# agentdesktop manages it
agentdesktop programs | grep copilot          # copilot  managed

# The file belongs to the user and is owner-only
stat -c '%U %a' ~/.copilot/providers.json     # agent 600

# The proxy refuses anyone without the pairing code
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST http://127.0.0.1:18095/copilot-cli/v1/chat/completions -d '{}'   # 403

# The gateway saw the tool
docker logs agentgateway 2>&1 | grep 'llm.client="copilot-cli"'
```

In the agentgateway UI, **Analytics** grouped by *group* shows Copilot CLI next to Claude Code, Codex and the rest, with tokens and cost.

## The security model

{{< callout type="note" title="Four layers, briefly" >}}
- **On the desktop:** the proxy needs a 256-bit pairing code, compares it in constant time, and accepts only loopback requests without an `Origin` header (no browser pages, no DNS rebinding). The code is in files only the user can read, and the daemon's state directory is root-only.
- **Single-user machines only:** the pairing code unlocks the device's gateway access, so this setup is for single-user machines. Upstream says so too.
- **Root writing in a user's home:** the daemon refuses to write through a symlink the user owns, and changes ownership with `lchown`. A user can't steer root's writes outside their profile by planting a link.
- **Tokens:** gateway tokens live five minutes and name the tool, the user and the device. Revoking a device in the controller stops all of its tools.
{{< /callout >}}

## Gotchas

{{< gotcha title="`AADSTS500117: The reply uri specified in the request isn't using a secure scheme`" >}}
Entra registered an `http://<lan-ip>` redirect, then refused it at sign-in. Plain HTTP is only allowed on `localhost`. Make Dex's issuer `localhost` and forward the port on other machines.
{{< /gotcha >}}

{{< gotcha title=`"Need admin approval" even after consent` >}}
Dex sends `prompt=consent` by default. Set `promptType: ""` on the connector. If the tenant blocks user consent, grant it once, for the tenant or per user.
{{< /gotcha >}}

{{< gotcha title="GPT-5.5 fails with `Function tools with reasoning_effort are not supported … in /v1/chat/completions`" >}}
Copilot CLI's OpenAI-type provider uses Chat Completions and sends tools with `reasoning_effort`. OpenAI only allows that combination on the Responses API. Use Claude through the Anthropic-type provider for Copilot CLI. VS Code Copilot Chat doesn't hit this and works with GPT-5.5.
{{< /gotcha >}}

{{< gotcha title="`GitHub Copilot CLI requires user mode (--user); skipped in system mode`" >}}
The daemon runs as root without the upstream changes above. Either run a user daemon, or build from them and set `daemon.copilot.config`.
{{< /gotcha >}}

{{< gotcha title="Two devices, one Dex user" >}}
Dex keeps one refresh token per user and client. If two devices enrol as the same user, the second one silently revokes the first, which drops out at its next refresh a day later. Give every device its own user.
{{< /gotcha >}}

{{< gotcha title="Script output ends with a stats block" >}}
Pass `-s` to get only the answer.
{{< /gotcha >}}

## Wrap-up

Copilot CLI now works like the other agents: agentdesktop configures it, Entra decides who may use it, and agentgateway decides where it goes and records what it cost. There is no GitHub token, no model key and nothing hand-edited on the desktop.

Next in the series: [Claude Code on Amazon Bedrock with short-lived credentials]({{< relref "claude-code-bedrock-short-lived-credentials.md" >}}).
