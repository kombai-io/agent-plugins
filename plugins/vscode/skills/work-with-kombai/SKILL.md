---
name: work-with-kombai
description: Design UI with Kombai. Designs go on a Kombai canvas; design systems are .ds files in the Kombai account and need no canvas. Use when the user asks to work with Kombai, for a design, mockup, variants or a design system, or pastes a Kombai canvas link; not for ordinary coding.
---

When VS Code runs terminal commands in its sandbox, set `requestUnsandboxedExecution: true` and
`requestUnsandboxedExecutionReason: "Kombai needs network access and writes ~/.kombai"` on the
terminal tool call **for the first command below** and for every later Kombai CLI command. `npx` may
contact the package registry before Kombai starts. Do not try the sandboxed command first, and do
not use `requestAllowNetwork` for Kombai commands, even if VS Code suggests it: the sandbox keeps
the npm cache (`~/.npm`) and `~/.kombai` unwritable, so they still fail. If the terminal tool has no
`requestUnsandboxedExecution` (VS Code says `chat.agent.sandbox.allowUnsandboxedCommands` turns it
off), or the user declines, do not retry inside the sandbox: explain that every Kombai command has
to run outside it, ask the user to turn on `chat.agent.sandbox.allowUnsandboxedCommands` or to turn
off the terminal sandbox, if their organization allows it, and wait. In GitHub Copilot CLI, which
installs this same plugin, run the command in its sandbox first; if the sandbox blocks it, ask for
the bypass Copilot CLI offers.

Run `npx -y @kombai/cli@0.1.4 skill` and follow what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed terminal; in VS Code, npm `E403 403 Forbidden` from registry.npmjs.org, or npm `EPERM` with advice to `sudo chown` its cache). The command ran inside the sandbox. In VS Code, retry it once with `requestUnsandboxedExecution: true` as above, never with `requestAllowNetwork`; in GitHub Copilot CLI, retry it with the sandbox bypass it offers. Do not pass on npm's `sudo chown` advice; the cache is not root-owned. Node is not missing.
