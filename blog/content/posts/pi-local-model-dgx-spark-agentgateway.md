---
title: "Govern a Local Model Like a Cloud One: Pi on a DGX Spark Through agentgateway"
slug: pi-local-model-dgx-spark-agentgateway
description: The Pi coding agent on Qwen, served by vLLM on a DGX Spark. The model is local, but Pi still goes through agentgateway with a five-minute token. agentdesktop writes Pi's config into the user's home, Pi fetches its token with a shell command, and every prompt is logged with the user and the tool.
date: 2026-10-30T00:01:00Z
lastmod: 2026-10-30T00:01:00Z
draft: false
author: Sebastian Maniak
categories:
  - Engineering
tags:
  - agentdesktop
  - agentgateway
  - Pi
  - local models
  - vLLM
  - DGX Spark
series: agentgateway-integrations
seriesPart: 4
seriesLabel: "Pi on a local model (DGX Spark)"
stack:
  - Pi
  - agentdesktop
  - agentgateway
  - vLLM on DGX Spark
cover: /blog/images/agentgateway-series/pi-architecture.svg
coverAlt: Pi architecture with agentdesktop, agentgateway and a DGX Spark running vLLM
---

When the model runs on your own GPU, it's tempting to skip the gateway. The model is on the LAN and costs nothing per token, so why bother?

Because "local" isn't the same as "governed". Without a gateway, nobody knows which user ran which prompt. You can't turn one device off without turning the model off for everyone. And the model endpoint takes requests from anything that can reach it.

This post runs the [Pi](https://pi.dev) coding agent on `qwen3.8-flash-next`, served by vLLM on a DGX Spark. The setup is the same as for the cloud tools: [agentdesktop](https://github.com/agentdesktop-dev/agentdesktop) writes Pi's config, the device signs in with Entra ID, and [agentgateway](https://agentgateway.dev) checks every request before it reaches the Spark.

The sign-in side (Entra ID, Dex and the fleet controller) is the same as in [the Copilot CLI post]({{< relref "copilot-cli-agentgateway-entra.md" >}}), so I won't repeat it here. This post covers the local model.

{{< series title="Every AI tool through one gateway" >}}

## Architecture

{{< diagram src="images/agentgateway-series/pi-architecture.svg" alt="On the desktop, Pi reads its config from ~/.pi/agent, which the root agentdesktop daemon writes as the user. Pi runs an agentdesktop credential command to get a token from the daemon, which gets policy and tokens from the fleet controller. Pi sends requests with that bearer token to agentgateway, which verifies them against the controller's JWKS and forwards them to vLLM on the DGX Spark. The Spark is reachable only through the gateway." caption="Same identity, same token, same gateway check as the cloud tools. Only the provider on the right is different." >}}

{{< callout type="summary" title="Three things to notice" >}}
1. **Pi never holds a key.** Its API key is a *command*. Pi runs it before each request, and the command asks the local daemon for a token.
2. **The Spark is only reachable through the gateway.** Pi's base URL is the gateway on loopback, `http://127.0.0.1:4002/v1`, not the Spark.
3. **The daemon runs as root, but Pi's files belong to the user.** Pi only reads config from `~/.pi/agent`, so the daemon writes those files *as the user*.
{{< /callout >}}

## 1. The model behind agentgateway

vLLM speaks the OpenAI Chat Completions API. In agentgateway that's a `custom` provider with the `completions` format:

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
    - name: qwen3.8-flash-next
      provider:
        custom:
          formats:
            - type: completions
      params:
        model: qwen3.8-flash-next
        baseUrl: http://<spark-host>:30800/spark
```

That's the whole route. The same `jwtAuth` block protects the cloud models on this gateway, so the local model gets exactly the same check.

## 2. Policy: turn Pi on, pick the model

The fleet controller pushes this to every device:

```yaml
llmGateway:
  url: http://127.0.0.1:4002
  authentication:
    type: controllerJwt
    audience: agentgateway
    allowedClientIds: [claude-code, codex, opencode, pi]

programs:
  pi:
    useLlmGateway: true
    api: openai-completions
    model: qwen3.8-flash-next
    models:
      qwen3.8-flash-next:
        name: Qwen 3.8 Flash Next (DGX Spark)
        reasoning: true
        contextWindow: 131072
        maxTokens: 16384
```

`pi` has to be in `allowedClientIds`. The token the daemon issues names the tool, and the gateway logs it as `llm.client="pi"`.

## 3. A root daemon writing a user's files

Pi has no system-wide config, only `~/.pi/agent`. Upstream, a root daemon used to skip Pi as "user mode only". My desktop needs a root daemon, because Claude Desktop, Codex and Grok read system-wide managed config. [agentdesktop#196](https://github.com/agentdesktop-dev/agentdesktop/pull/196) closes the gap: name the user's files and the system daemon manages them.

```yaml
daemon:
  pi:
    models: /home/agent/.pi/agent/models.json
    settings: /home/agent/.pi/agent/settings.json
```

Both paths are required. The daemon hands everything it creates to the owner of the nearest existing directory, which is the user. If any part of the path is a symlink the user owns, the daemon refuses to write, so a link in your home can't redirect a root write.

```console
$ stat -c '%U:%G %a %n' ~/.pi/agent/models.json ~/.pi/agent/settings.json
agent:agent 600 /home/agent/.pi/agent/models.json
agent:agent 644 /home/agent/.pi/agent/settings.json
```

## 4. What Pi ends up with

`models.json` gets an `agentdesktop` provider. The API key starts with `!`, which tells Pi to run it as a command:

```json
{
  "providers": {
    "agentdesktop": {
      "api": "openai-completions",
      "apiKey": "!'/usr/local/bin/agentdesktop' '--socket' '/run/agentdesktop/agentdesktop.sock' 'credential' '--client-id' 'pi'",
      "authHeader": true,
      "baseUrl": "http://127.0.0.1:4002/v1",
      "models": [
        { "id": "qwen3.8-flash-next", "name": "Qwen 3.8 Flash Next (DGX Spark)",
          "reasoning": true, "contextWindow": 131072, "maxTokens": 16384 }
      ]
    },
    "dgx-spark": { "...": "a provider I added by hand, left alone" }
  }
}
```

And `settings.json` makes it the default:

```json
{ "defaultProvider": "agentdesktop", "defaultModel": "qwen3.8-flash-next" }
```

{{< callout type="tip" title="Merged, not replaced" >}}
My own `dgx-spark` provider is still there. agentdesktop tracks which entries it owns in a sidecar file and only touches those. Take Pi out of the policy and agentdesktop removes its own entries and leaves yours.
{{< /callout >}}

## 5. Using it

```bash
pi                      # interactive, on the managed model
pi -p "Explain what this repo's Makefile does"
```

There's nothing to configure and nothing to rotate.

## Checking that it works

```bash
# The command Pi runs, by hand: prints a short-lived JWT
agentdesktop --socket /run/agentdesktop/agentdesktop.sock credential --client-id pi

# Without a token the gateway refuses the local model too
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4002/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"qwen3.8-flash-next","messages":[{"role":"user","content":"hi"}]}'   # 401

# The gateway logged Pi by name
docker logs agentgateway 2>&1 | grep 'llm.client="pi"' | tail -1
```

## What it costs when the GPU is yours

agentgateway prices requests from its model catalog. A model you serve yourself isn't in the catalog, so the cost column stays empty for Pi, while tokens, latency and time to first token are all recorded. If you want a number, for power or for the hardware, add your own rates to the catalog in dollars per million tokens. The provider is `custom`, as the request log names it:

```yaml
config:
  modelCatalog:
    - inline:
        providers:
          custom:
            models:
              qwen3.8-flash-next:
                rates: { input: "0.05", output: "0.20" }
```

I haven't priced my Spark yet. Even without prices, the analytics already show which users and tools keep it busy.

## Gotchas

{{< gotcha title="`Pi requires user mode (--user); skipped in system mode`" >}}
This is a system daemon without #196, or with only one of the two `daemon.pi` paths. Set both.
{{< /gotcha >}}

{{< gotcha title="Files that Pi can't read" >}}
If root writes `models.json` as `root:root 0600`, Pi can't read it and the managed provider is missing. With #196 the files belong to the user. If you write them some other way, check the owner.
{{< /gotcha >}}

{{< gotcha title="Empty answers with a small `max_tokens`" >}}
`qwen3.8-flash-next` is a reasoning model. With `max_tokens: 20` it spends them all thinking and returns no content. That's not a gateway error; give it room.
{{< /gotcha >}}

{{< gotcha title="The gateway's `baseUrl` path" >}}
Get the upstream path right, or every request returns a 404 from the model server. My Spark sits behind another gateway under `/spark`. agentgateway appends the API path itself.
{{< /gotcha >}}

{{< gotcha title="Pi still talks to the Spark directly" >}}
Check `defaultProvider`. The managed `settings.json` sets it to `agentdesktop`. A hand-added provider that points straight at the Spark bypasses the gateway, so remove it or leave it unused.
{{< /gotcha >}}

## Wrap-up

The model is on my desk, but Pi is governed like any cloud tool. It needs a signed-in device and a token that lives five minutes, and every prompt is logged with who sent it. Turning off one device takes one click in the controller, and the Spark keeps serving everyone else.

That's the series: four tools, three providers, one gateway. Start from [part 1]({{< relref "copilot-cli-agentgateway-entra.md" >}}) if you're setting this up from scratch.
