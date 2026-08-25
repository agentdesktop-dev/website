---
title: Quickstart
description: Build agentdesktop and choose standalone local YAML or a controller-managed deployment for AI developer tool configuration.
weight: 1
---

Start with [Build and install](build/) when working from source. The quickstarts then cover two configuration modes:

1. **Standalone** reads desired configuration from local YAML. It creates no controller-managed device identity and can use OIDC to authenticate the user directly to an inference gateway.
2. **Controller-managed** enrolls the user and device, receives versioned configuration from the controller, and can request short-lived controller-signed gateway JWTs.

Both modes reconcile the supported developer tool's own configuration. The inference gateway is a separate service; the source repository includes local and Kubernetes agentgateway examples.
