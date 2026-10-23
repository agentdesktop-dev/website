---
title: Quickstart
description: Install agentdesktop and choose a quickstart to configure your developer tools.
weight: 1
---

Start with [Build and install](build/) to install agentdesktop. Then choose one quickstart to configure your developer tools. To try agentdesktop without a fleet controller, start with the [standalone](standalone/) quickstart. The [controller-managed](managed/) quickstart requires both `agentdesktop` and `agentdesktop-controller` from a source build.

Standalone reads local YAML and can authenticate directly to an inference gateway with OIDC. Controller-managed mode enrolls the user and device, receives versioned configuration, and can request short-lived controller-signed gateway JWTs. Both quickstarts configure Claude Code to send model requests through agentgateway, which runs as a separate service. Other integrations may require user or system mode as described in their guides.
