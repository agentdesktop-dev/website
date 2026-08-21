---
title: MDM integrations
description: Map agentdesktop installation, bootstrap configuration, and remediation onto Microsoft Intune, Jamf Pro, Kandji, or Fleet.
weight: 2
---

Agentdesktop does not depend on a Microsoft Intune API or policy format. Intune is the detailed production walkthrough because it covers both macOS and Windows, but any endpoint-management platform can deploy agentdesktop if it satisfies the same machine-level contract.

These mappings assume your organization uses the signed endpoint installers from a reviewed Agentdesktop release, verifies their checksums and platform signatures, and validates them on representative devices before assignment. Do not substitute an unsigned local development package for a production rollout.

## Deployment contract

Keep the MDM payload small. It installs the application, writes the controller bootstrap and optional trust root, restarts the service only when configuration changes, and reports whether the service is healthy. Gateway settings and developer-tool policy still come from the agentdesktop controller.

| Requirement | macOS | Windows |
| --- | --- | --- |
| Installer | Signed and notarized PKG | Signed per-machine MSI |
| Install context | `root` | `SYSTEM` |
| Bootstrap | `/etc/agentdesktop/config.yaml`, `root:wheel`, mode `0600` | `%ProgramData%\AgentDesktop\config.yaml`, restricted to `SYSTEM` and Administrators |
| Private controller CA | Protected PEM file referenced by `controller.caCertificatePath` | Protected PEM file referenced with a forward-slash path in YAML |
| Restart | `launchctl kickstart -k system/dev.agentdesktop.daemon` | `Restart-Service AgentDesktop` |
| Local health detection | Package receipt, LaunchDaemon, and `agentdesktop status` | MSI version, Windows service, configuration hash, and `agentdesktop.exe status` |

The bootstrap and controller CA certificate are not secrets. Never distribute the device CA key, controller TLS key, gateway signing key, database URL, upstream provider credentials, or other secrets through an MDM payload.

These local checks prove that the package, service, and daemon API are present. They do not prove that the user completed enrollment, the controller is connected, or the remote configuration applied. Verify those states in the Agent Desktop UI and controller management UI during each rollout ring.

## Platform comparison

| Platform | Endpoint coverage | Agentdesktop mapping | Important boundary |
| --- | --- | --- | --- |
| [Microsoft Intune](../production/#deploy-through-microsoft-intune) | macOS and Windows | macOS PKG plus root script; Windows Win32 app containing the MSI and bootstrap | Full walkthrough is included in this documentation. |
| [Jamf Pro](https://www.jamf.com/resources/product-documentation/jamf-pro-administrators-guide/) | Apple devices | Package and policy for the PKG; script payload for bootstrap, CA, restart, and inventory result | Use another platform for Windows endpoints. |
| [Kandji](https://support.kandji.io/kb/custom-apps-overview) | Apple devices | Custom App for the PKG; Custom Script for bootstrap and remediation | Custom scripts always run as root; no Windows endpoint path. |
| [Fleet](https://fleetdm.com/guides/deploy-software-packages) | macOS, Windows, and Linux hosts | Custom packages, post-install scripts, policy checks, labels, API, or GitOps | Software deployment and automatic enrollment features described here require Fleet Premium. |

Use separate pilot and rollout groups in every platform. Scope x64 and ARM64 packages so a device can match only one architecture-specific installer.

## Jamf Pro

Jamf Pro is a natural fit for organizations that already manage Macs with Apple Business Manager and Jamf.

1. Upload the signed and notarized Agent Desktop PKG as a Jamf package.
2. Add the PKG to a computer policy scoped first to a static or smart pilot group.
3. Add an idempotent script payload that writes `/etc/agentdesktop/config.yaml` and the optional controller CA, fixes owner and mode, and restarts `dev.agentdesktop.daemon` only when content changes.
4. Add a scripted extension attribute that checks the package receipt, LaunchDaemon, and local status command. Update inventory after the policy runs.
5. Build a smart group from that extension-attribute value for local compliance reporting. Its result is only as current as the last inventory update.
6. Expand policy scope only after the Agent Desktop and controller UIs also show healthy enrollment and applied configuration for the pilot.

The PKG preserves a bootstrap file that arrives first, so package and bootstrap delivery do not need a fragile ordering dependency. Adapt the macOS script from the [Intune walkthrough](../production/#deploy-macos-through-intune); only the assignment and reporting mechanism changes.

Jamf Pro is Apple-focused. A mixed Jamf and Windows environment still needs Intune, Fleet, Workspace ONE, or another Windows-capable endpoint platform for the MSI.

## Kandji

Kandji provides two useful enforcement surfaces for Agent Desktop:

1. Create a **Custom App** with the signed PKG and assign it to a pilot Blueprint.
2. Select **Audit and enforce** and use an audit script to check the package version and local daemon health. A failed audit prompts Kandji to reinstall the Custom App.
3. Create a separate **Custom Script** for bootstrap configuration. Kandji custom scripts run as root and can run once, every check-in, daily, or from Self Service.
4. Use the script's audit and remediation fields so an incorrect configuration hash triggers a rewrite and daemon restart, while a current file exits without changing the device.
5. Select **Run every 15 min** or **Run daily** when ongoing drift remediation is required. **Install once per device** does not continue checking after a successful run.
6. Monitor **Remediated** and **Alert** Custom Script states, plus Custom App status, before assigning the Library Items to later Blueprints.

Kandji supports PKG pre-install and post-install scripts, but keeping tenant bootstrap in a separate Custom Script lets operators rotate the controller URL or private CA without rebuilding the application item. See Kandji's [Custom Scripts overview](https://support.kandji.io/kb/custom-scripts-overview) for root execution, frequencies, remediation, and status behavior.

Kandji manages Apple devices. It is not a replacement for the Windows Win32 deployment path in the production walkthrough.

## Fleet

Fleet is the closest alternative for organizations that prefer API- and GitOps-driven endpoint operations across several operating systems.

1. Add the macOS PKG and Windows MSI as [custom packages](https://fleetdm.com/guides/deploy-software-packages) in the target fleet.
2. Use package targets or labels to separate macOS Intel, macOS Apple silicon, Windows x64, and Windows ARM64.
3. Put bootstrap installation, ACL or mode enforcement, and service restart in each package's post-install script. Treat any nonzero post-install result as destructive: Fleet marks installation failed and attempts to uninstall the software. Keep controller-dependent health checks in a separate policy so a transient network failure cannot trigger rollback.
4. Detect installation with an osquery policy that checks package metadata, expected version, configuration hash, and running service.
5. Attach the package to a policy automation for required installation, or expose it through Fleet's software library for a controlled pilot.
6. Manage package definitions and policy automation through Fleet's REST API or GitOps when those workflows are already part of platform operations.

Before uploading packages, enable scripts in `fleetd` with `--enable-scripts`; Fleet MDM enables them automatically on managed Macs. A self-hosted Fleet deployment also needs S3-compatible installer storage, and Fleet recommends at least five-minute load-balancer timeouts for package upload endpoints.

Fleet supports Agent Desktop's relevant `.pkg`, `.msi`, `.sh`, and `.ps1` artifacts, along with `.exe`, `.deb`, `.rpm`, `.ipa`, `.tar.gz`, and `.py` packages. Script-only packages are useful for manual bootstrap repair, but Fleet does not automatically install script-only packages; use [policy automation to run a script](https://fleetdm.com/guides/policy-automation-run-script) when automatic remediation is required.

By default, software policy automation triggers on the first failure or a pass-to-fail transition and stops after three installation attempts. It does not continuously retrigger while a policy remains failed. Continuous fail-to-fail automation requires `continuous_automations_enabled`, a Fleet Premium feature, and must be guarded against retry loops.

Fleet can provide [Apple MDM](https://fleetdm.com/guides/apple-mdm-setup) and [Windows MDM](https://fleetdm.com/guides/windows-mdm-setup). Apple Business automatic enrollment, automatic Windows enrollment, and software deployment are Fleet Premium capabilities. Fleet documents an Enterprise Mobility + Security E3 license for the administrator configuring Windows automatic enrollment and at least Microsoft Entra ID P1 for each enrolling user; Microsoft 365 E3 or E5 satisfies the user requirement.

Fleet labels do not apply during setup experience: when several packages represent the same software, Fleet installs the package added first. Avoid architecture-specific setup-experience installation unless the first package is valid for every target; otherwise install after enrollment when label targeting applies.

Fleet can target Linux hosts, but the agentdesktop repository does not yet include a production Linux package or systemd unit. Build and support that packaging layer before presenting Linux deployment as production-ready.

## Choosing a platform

- Use **Intune** when Microsoft Entra, Windows Autopilot, and a mixed macOS/Windows fleet already define endpoint operations.
- Use **Jamf Pro** or **Kandji** when the managed fleet is Apple-only or those products already own Mac provisioning.
- Use **Fleet** when cross-platform inventory, API or GitOps workflows, and Fleet Premium are acceptable operational dependencies.

Workspace ONE UEM, JumpCloud, and Mosyle can likely satisfy the same package-and-script contract, but this documentation does not yet provide tested mappings for them. Validate installer context, file permissions, restart behavior, architecture targeting, and detection semantics before publishing a copy-paste runbook.
