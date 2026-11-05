---
name: about-kombai
description: Answer the user's questions about Kombai itself (what it is, which agents it works with, accounts and guest mode, credits and plans, where designs and data live, sharing, privacy, updates and support). Use when the user asks about Kombai rather than for design work.
---

Gemini CLI's sandbox (on when `$SANDBOX` is set) blocks writes outside the project, and some sandbox
profiles block the network; Kombai needs the network and writes `~/.kombai`. If a Kombai command
fails with a permission or network error while `$SANDBOX` is set, do not retry inside the sandbox:
tell the user Kombai needs network access and write access to `~/.kombai`, and ask them to restart
Gemini CLI without the sandbox, as `GEMINI_SANDBOX=false gemini` and without `-s` (this also
overrides `tools.sandbox` in their settings.json; in PowerShell, set `$env:GEMINI_SANDBOX = "false"`
first), or to run the command in their own terminal.

If run_shell_command has an `additional_permissions` parameter (Gemini CLI's per-command tool
sandboxing, `security.toolSandboxing`), pass it on the first Kombai command, with `network: true`
and `fileSystem.write` set to the absolute paths of `~/.kombai` and `~/.npm`, and ask the user to
allow it for the session; later Kombai commands then run with it, so do not pass it again. If the
user declines, stop and explain that Kombai needs it. If there is no such parameter and `$SANDBOX`
is empty, Kombai is not sandboxed: report a permission or network error as it is.

Run `npx -y @kombai/cli@0.1.3 skill faq` and answer from what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). If `$SANDBOX` is set, ask the user to restart Gemini CLI without the sandbox as above; with tool sandboxing, pass `additional_permissions` as above. Do not retry inside the sandbox otherwise. Node is not missing.
