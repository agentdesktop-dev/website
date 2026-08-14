---
title: Quickstart
description: Choose a self-managed local agentgateway or an organization-managed remote agentgateway.
weight: 1
---

agentdesktop supports two deployment modes and two traffic paths:

1. **Deployment mode** decides whether agentgateway runs locally or remotely.
2. **Traffic path** decides whether an agent or client uses a native loopback endpoint or process-scoped capture.

Use native forwarding when an agent accepts a custom gateway or base URL. Use process-scoped capture for supported agents that cannot be configured directly.
