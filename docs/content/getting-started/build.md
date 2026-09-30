---
title: Build and install
description: Install agentdesktop from a GitHub release or source code, then choose a quickstart.
weight: 1
---

Use this guide to install the tools that you need to run agentdesktop. The `agentdesktop` executable includes the desktop app, command-line tools, and device daemon. The separate `agentdesktop-controller` executable includes the fleet controller and its management interface.

Choose one installation method:

| Method | What you get | Use it for |
| --- | --- | --- |
| [Download from GitHub Releases](#download-from-github-releases) | `agentdesktop` | The standalone quickstart, or a device that connects to an existing controller |
| [Build from source](#build-from-source) | `agentdesktop` and `agentdesktop-controller` | Either quickstart, including running a controller locally |

After installation, you can launch the desktop app and run the command-line tools. Each quickstart explains how to run the daemon and configure your developer tools to use a gateway.

## Before you begin

On macOS, Linux, or Windows, install the tools for your chosen method:

- Git to clone the repository.
- `curl` or PowerShell to download a release.
- Rust, Node.js, Make, and Corepack to build from source. [Prepare your build environment](#prepare-your-build-environment) lists the required versions.
- Docker Desktop, or Docker Engine with Compose on Linux, for the quickstarts.

## Download from GitHub Releases

Download an `agentdesktop` executable from [GitHub Releases](https://github.com/agentdesktop-dev/agentdesktop/releases/latest). For the controller-managed quickstart, [build both executables from source](#build-from-source). For controller container images and Helm charts, see [Production deployment](../../operations/production/).

### macOS and Linux

1. Choose the asset for your operating system and processor. To check your processor type, run `uname -m`.

   | Workstation | `uname -m` | Asset |
   | --- | --- | --- |
   | macOS, Apple silicon | `arm64` | `agentdesktop-darwin-arm64` |
   | macOS, Intel | `x86_64` | `agentdesktop-darwin-amd64` |
   | Linux, ARM64 | `aarch64` | `agentdesktop-linux-arm64` |
   | Linux, Intel or AMD 64-bit | `x86_64` | `agentdesktop-linux-amd64` |

2. Download the binary. Replace the asset name in the first line with your choice from the table.

   ```sh
   AGENTDESKTOP_ASSET=agentdesktop-darwin-arm64
   curl --fail --location --output "$AGENTDESKTOP_ASSET" \
     "https://github.com/agentdesktop-dev/agentdesktop/releases/latest/download/$AGENTDESKTOP_ASSET"
   ```

3. Install the executable in your user binary directory.

   ```sh
   mkdir -p "$HOME/.local/bin"
   install -m 755 "$AGENTDESKTOP_ASSET" "$HOME/.local/bin/agentdesktop"
   ```

4. Add the installation directory to the current shell's `PATH`. For new terminals, add the same line to `~/.zshrc` for zsh or `~/.bashrc` for Bash.

   ```sh
   export PATH="$HOME/.local/bin:$PATH"
   ```

5. Verify the installation. On Linux, install any missing WebKitGTK 4.1 or desktop tray libraries from your distribution.

   ```sh
   command -v agentdesktop
   agentdesktop --help
   ```

   Example output on macOS (Linux paths normally start with `/home/yourname/`):

   ```console
   /Users/yourname/.local/bin/agentdesktop
   Agent Desktop UI, daemon, and command-line tools

   Usage: agentdesktop [OPTIONS] [COMMAND]
   ```

### Windows

1. In PowerShell, download the executable for your processor. Use `arm64` instead of `amd64` in the asset name for an ARM64 workstation.

   ```powershell
   $AgentdesktopAsset = "agentdesktop-windows-amd64.exe"
   $AgentdesktopBin = Join-Path $env:LOCALAPPDATA "agentdesktop\bin"
   New-Item -ItemType Directory -Force -Path $AgentdesktopBin | Out-Null
   Invoke-WebRequest `
     -Uri "https://github.com/agentdesktop-dev/agentdesktop/releases/latest/download/$AgentdesktopAsset" `
     -OutFile "$AgentdesktopBin\agentdesktop.exe"
   ```

2. Add the installation directory to the current session's `PATH`. For new terminals, add `%LOCALAPPDATA%\agentdesktop\bin` to your user **Path** through Windows **Environment Variables**.

   ```powershell
   $env:Path = "$AgentdesktopBin;$env:Path"
   ```

3. Verify the installation.

   ```powershell
   (Get-Command agentdesktop).Source
   agentdesktop --help
   ```

   Example output, abbreviated:

   ```console
   C:\Users\yourname\AppData\Local\agentdesktop\bin\agentdesktop.exe
   Agent Desktop UI, daemon, and command-line tools

   Usage: agentdesktop [OPTIONS] [COMMAND]
   ```

## Build from source

A source build produces two executables:

- `agentdesktop`: the desktop app, command-line tools, and device daemon that runs on each workstation.
- `agentdesktop-controller`: the fleet controller that manages devices and serves the fleet management interface.

For the quickstarts, use `make install` to build and install both executables. For development, use `make build` to create debug executables in the repository. Both commands include the desktop and controller interfaces.

The source build commands use a macOS or Linux shell.

### Prepare your build environment

1. Clone the source repository, or change to the root of your existing clone. Run all build commands from the repository root.

   ```sh
   git clone https://github.com/agentdesktop-dev/agentdesktop.git
   cd agentdesktop
   ```

2. Select Rust 1.98 and Node.js 26.8.1 from `rust-toolchain.toml` and `frontend/.nvmrc`. 
   * With [rustup](https://www.rust-lang.org/tools/install), Rust selection is automatic. 
   * If you use nvm, select Node.js with the following commands.

   ```sh
   nvm install "$(cat frontend/.nvmrc)"
   nvm use "$(cat frontend/.nvmrc)"
   ```

3. Install your operating system's build dependencies. The desktop app uses Tauri to connect its web interface to native desktop features.

   - **macOS**

     If you do not have Apple's Xcode command-line tools, install the tools and wait for installation to finish.

     ```sh
     xcode-select --install
     ```

   - **Linux**

     On Ubuntu, install the compiler tools and desktop libraries. For other distributions, see the [Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux).

     ```sh
     sudo apt-get update
     sudo apt-get install --yes --no-install-recommends \
       build-essential \
       pkg-config \
       libwebkit2gtk-4.1-dev \
       libxdo-dev \
       libssl-dev \
       libayatana-appindicator3-dev \
       librsvg2-dev
     ```

   - **Windows**

     Follow the [Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows) to install Microsoft C++ Build Tools and the Microsoft Edge WebView2 runtime. Select the **Desktop development with C++** workload. Windows builds also require a compatible shell and Make for this guide's commands.

4. Enable the pnpm version from `frontend/package.json` through [Corepack](https://github.com/nodejs/corepack#how-to-install). If `corepack` is missing, run `npm install --global corepack` first.

   ```sh
   corepack enable
   ```

### Build and install for the quickstarts

1. From the repository root, build and install both executables. This command builds both interfaces and installs the executables into Cargo's binary directory, normally `~/.cargo/bin`.

   ```sh
   make install
   ```

2. Confirm that your shell can find both executables.

   ```sh
   command -v agentdesktop
   command -v agentdesktop-controller
   ```

   Example output on macOS:

   ```console
   /Users/yourname/.cargo/bin/agentdesktop
   /Users/yourname/.cargo/bin/agentdesktop-controller
   ```

   If either path is missing or points to an older installation, put Cargo's binary directory first on `PATH` and repeat the check. Use your custom Cargo directory if applicable. For new terminals, add the `export` line to your shell's startup file.

   ```sh
   export PATH="$HOME/.cargo/bin:$PATH"
   ```

3. Confirm that both executables run.

   ```sh
   agentdesktop --help
   agentdesktop-controller --help
   ```

   The `agentdesktop` help starts with `Agent Desktop UI, daemon, and command-line tools`. The `agentdesktop-controller` help starts with this output:

   ```console
   Agentdesktop fleet controller

   Usage: agentdesktop-controller [OPTIONS]
   ```

### Build without installing

Use this option to create debug executables without installing them.

1. After you [prepare your build environment](#prepare-your-build-environment), build the executables in `target/debug/`.

   ```sh
   make build
   ```

2. Verify the executables from the repository root. Expect the help headings from [Build and install for the quickstarts](#build-and-install-for-the-quickstarts).

   ```sh
   ./target/debug/agentdesktop --help
   ./target/debug/agentdesktop-controller --help
   ```

3. To use these executables in a quickstart, add the build directory to `PATH` in each terminal, from the repository root.

   ```sh
   export PATH="$PWD/target/debug:$PATH"
   ```

## Next steps

You now have an installed or locally built `agentdesktop` executable. A source build also includes `agentdesktop-controller`. Each quickstart explains how to start the services and configure your developer tools.

Choose one quickstart to set up and run the services:

- [Standalone](../standalone/): configure one workstation with a local YAML file. Start with this quickstart to try agentdesktop with Claude Code.
- [Controller-managed](../managed/): enroll your workstation with a local controller. This quickstart requires both executables.

Both quickstarts use example files from the source repository. If you downloaded a release and need a repository clone, get the example files.

```sh
git clone https://github.com/agentdesktop-dev/agentdesktop.git
cd agentdesktop
```

If you built from source, use your existing clone. Run the quickstart commands from the repository root.

The desktop app opens when you run `agentdesktop` with no subcommand. Each quickstart includes a step to open the app and inspect the daemon. These installation methods do not create an application shortcut or a macOS `.app` bundle.

To change the desktop or controller interface itself, see [Develop the web interfaces](../../contributing/#develop-the-web-interfaces).
