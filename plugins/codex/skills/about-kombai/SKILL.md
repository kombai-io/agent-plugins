---
name: about-kombai
description: Answer the user's questions about Kombai itself (what it is, which agents it works with, accounts and guest mode, credits and plans, where designs and data live, sharing, privacy, updates and support). Use when the user asks about Kombai rather than for design work.
---

When running in Codex's sandbox, request approved execution outside it **before the first
command below** and for every later Kombai CLI command. Use
`sandbox_permissions: "require_escalated"` on the execution tool call. The commands need network
access and write `~/.kombai`; `npx` may contact the package registry before Kombai starts.
Do not try the restricted command first. If this chat cannot approve the required access,
explain the restriction and wait for the user to change its permissions; do not retry inside
the sandbox.

Run `npx -y @kombai/cli@0.1.4 skill faq` and answer from what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Request approved execution outside the sandbox as above; do not retry inside it. Node is not missing.
