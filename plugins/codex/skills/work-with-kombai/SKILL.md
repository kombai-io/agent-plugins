---
name: work-with-kombai
description: Design UI with Kombai. Designs go on a Kombai canvas, which the Codex app shows beside the chat; design systems are .ds files in the Kombai account and need no canvas. Use when the user asks to work with Kombai, for a design, mockup, variants or a design system, or pastes a Kombai canvas link; not for ordinary coding.
---

When running in Codex's sandbox, request approved execution outside it **before the first
command below** and for every later Kombai CLI command. Use
`sandbox_permissions: "require_escalated"` on the execution tool call. The commands need network
access and write `~/.kombai`; `npx` may contact the package registry before Kombai starts.
Do not try the restricted command first. If this chat cannot approve the required access,
explain the restriction and wait for the user to change its permissions; do not retry inside
the sandbox.

In the Codex app, Kombai's view shows the canvas beside the chat: Kombai's `canvas_app` tool. Codex lists
no MCP tool up front, so find it inside exec with `ALL_TOOLS.filter((t) => t.name.endsWith('canvas_app'))`. Look for
it first, before any other Kombai command. Call it with the canvas id right after `kombai canvas create`, before
you write any design, or when you first use a canvas that isn't already open beside the chat. It is the only way to show a canvas here: no browser, no in-app browser,
and no canvas link unless the user asks for one. If no `canvas_app` tool exists, Kombai's view isn't set up in Codex
yet: before any design work, set it up without asking, with `npx -y @kombai/cli@latest mcp install codex`
(outside the sandbox, like every Kombai command), tell the user in one line, and continue in a new task, as
`npx -y @kombai/cli@latest skill opening` says. Show no link instead.

Run `npx -y @kombai/cli@latest skill` and follow what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Request approved execution outside the sandbox as above; do not retry inside it. Node is not missing.
