---
title: Quickstart
description: Install agentdesktop and choose a quickstart to configure your developer tools.
weight: 1
---

Start with [Build and install](build/) to install agentdesktop. Choose one quickstart to configure your developer tools:

- [Standalone](standalone/): configure Claude Code on one workstation with a local YAML file. This quickstart uses a local identity provider and agentgateway. Start here to try agentdesktop without a fleet controller.
- [Controller-managed](managed/): enroll your workstation with a local controller. Use the controller interface to inspect tool configuration and device status. This quickstart requires both `agentdesktop` and `agentdesktop-controller` from the source build.

Both quickstarts configure Claude Code to send model requests through agentgateway. The gateway runs as a separate service.
