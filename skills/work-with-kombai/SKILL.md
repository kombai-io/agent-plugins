---
name: work-with-kombai
description: Design UI with Kombai. Designs go on a Kombai canvas; design systems are .ds files in the Kombai account and need no canvas. Use when the user asks to work with Kombai, for a design, mockup, variants or a design system, or pastes a Kombai canvas link; not for ordinary coding.
---

When running in Codex's sandbox, get access outside it **before the first command below**; do not try the
restricted command first. The commands need network access and write `~/.kombai` and npm's cache (`~/.npm`);
`npx` may contact the package registry before Kombai starts.

- If this chat can approve sandbox escalations, use `sandbox_permissions: "require_escalated"` on the
  execution tool call for the first command and every later Kombai CLI command.
- If it can't but has the `request_permissions` tool (as a ChatGPT or Codex app chat with no project picked
  does), call that once per turn before the first Kombai command, asking for network access and write access to
  those paths, then run the commands without escalation.
- If neither is available, or the user declines, run nothing and do not retry inside the sandbox. Tell the
  user only this, in one or two lines: Kombai needs network access to start, and they can allow it by choosing
  **Approve for me** in the permissions menu under the message box (in Codex in a terminal, by allowing network
  access in its approval settings), then sending their message again.

Run `npx -y @kombai/cli@0.1.5 skill` and follow what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Ask for network access the way your client does; Node is not missing.
