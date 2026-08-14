---
title: agentdesktop documentation
description: Learn what agentdesktop runs on the device and choose a deployment mode.
---

## Project overview

agentdesktop runs on employee devices. It discovers Claude Code, Codex, OpenClaw, and other agents, along with their MCP servers, tools, skills, and configuration. It ties agent activity to a user and device, then forwards the traffic to agentgateway.

It discovers and inventories:

- Coding agents, desktop agents, local runtimes, and selected processes.
- MCP servers, exposed tools, and agent connections to them.
- Skill sources and agent configuration.

Each agent and resource receives a stable identity tied to its device and configuration. Policy and audit records identify the agent, device, model, MCP server, tool, or skill involved in an action. agentdesktop rejects a flow when it cannot identify the source.

## Components

agentdesktop handles discovery, device identity, process attribution, and forwarding. agentgateway evaluates policy, inspects traffic, stores provider credentials, and records request-level audit data.

| Component | Owns |
| --- | --- |
| agentdesktop | Loopback listeners, application adapters, process scopes, OS capture, enrollment, device identity, tunnel lifecycle, and fail-closed behavior |
| agentgateway | AI policy, HTTP parsing, TLS inspection, provider credentials, upstream routing, and request-level audit data |
| Identity and enrollment services | Organizational login, device approval, certificate issuance, renewal, and revocation records |
| Deployment systems | Installation and bootstrap configuration in managed deployments |
