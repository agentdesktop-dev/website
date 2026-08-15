---
title: Quickstart
description: Choose local YAML for one device or a controller for fleet management.
weight: 1
---

agentdesktop supports two configuration modes:

1. **Standalone** reads desired configuration from local YAML. It creates no controller-managed device identity and can use OIDC to authenticate the user directly to an inference gateway.
2. **Controller-managed** enrolls the user and device, receives versioned configuration from the controller, and can request short-lived controller-signed gateway JWTs.

Both modes reconcile the supported developer tool's own configuration. The inference gateway is a separate service; the source repository includes local and Kubernetes Agentgateway examples.
