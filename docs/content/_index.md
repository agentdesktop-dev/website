---
title: agentdesktop documentation
description: Deploy and manage agentdesktop across Linux, macOS, and Windows. Configure AI developer tools, MCP servers, skills, MDM enrollment, and inference gateways.
---

## Project overview

agentdesktop is an open-source control plane for AI developer tools. A daemon on each device discovers installed tools and reconciles their configuration. It can read desired configuration from a local YAML file or receive it from the agentdesktop controller.

agentdesktop can:

- Report installed developer tools and versions.
- Inventory configured MCP servers and agent skills.
- Reconcile managed settings and a shared inference gateway.
- Report each managed program's configuration outcome to the controller.
- Enroll a device and associate it with the signed-in user.
- Supply short-lived gateway credentials to configured tools.
- Optionally re-apply configuration on a local interval to repair drift.
- Report selected session and tool-use events when telemetry is enabled.

## Supported tools

| Tool | Discovery | Managed configuration | MCP and skills |
| --- | --- | --- | --- |
| Claude Code | Yes | Yes | MCP and skills |
| Claude Desktop | Yes | Yes | MCP; skills partial |
| Codex | Yes | Yes | MCP and skills |
| GitHub Copilot CLI | Yes | Yes | Not yet |
| OpenCode | Yes | Yes | MCP and skills partial |
| VS Code Copilot Chat | Yes | Yes: own models or GitHub models through the gateway | MCP and skills |
| Cursor | Yes | Partial | MCP and skills |
| Grok Build | Yes | Yes | MCP and skills |
| Pi | Yes | Yes | MCP and skills |

Agentdesktop also discovers local models from Ollama. `Partial` indicates gaps in the managed configuration or inventory support.

The `main` branch can include features newer than the latest release. Check the release notes and confirm both daemon and controller versions before rolling out a newly added integration.

The project targets Linux, macOS, and Windows. Some managed settings require a specific daemon scope: Pi, GitHub Copilot CLI, and VS Code Copilot Chat require user mode; Claude Desktop and Grok Build require system mode.

## Data boundaries

Discovery is designed to avoid collecting secrets. MCP command arguments, environment variables, and HTTP headers are omitted. Skill bodies are omitted; agentdesktop records their path and YAML front matter.

Telemetry is off until event names are configured. Current hooks can report new Claude sessions and tool use. Tool input is collected only when `tool.use.input` is selected, and hook failures do not block the developer tool.

## Components

| Component | Owns |
| --- | --- |
| Device daemon | Discovery, local API, configuration reconciliation, enrollment, gateway credential helpers, and telemetry collection |
| Desktop app | Local daemon status, configuration state, and enrollment status |
| Controller | OIDC enrollment, device certificates, configuration distribution, inventory, telemetry, gateway JWTs, and the fleet management UI |
| Inference gateway | External model endpoint configured in developer tools; Agentgateway is used by the repository examples |

Most developer tools connect directly to the configured inference gateway. GitHub Copilot CLI and VS Code Copilot Chat use the optional daemon loopback proxy, which forwards their requests to the gateway with the device user's gateway credentials. The controller does not proxy model traffic.
