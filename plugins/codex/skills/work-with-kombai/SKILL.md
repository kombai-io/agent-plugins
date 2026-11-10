---
name: work-with-kombai
description: Design UI with Kombai. Designs go on a Kombai canvas, which the Codex app shows beside the chat; design systems are .ds files in the Kombai account and need no canvas. Use when the user asks to work with Kombai, for a design, mockup, variants or a design system, or pastes a Kombai canvas link; not for ordinary coding.
---

**Needs a shell on the user's computer.** Kombai runs its CLI in a shell on the user's computer. Codex has one wherever it runs: the ChatGPT desktop app (its Work chats and Codex), the Codex CLI and the IDE extension, so carry on there, whatever the app is called. Only if this chat has no shell on the user's computer, as in ChatGPT on the web, whose code tool is a cloud sandbox, run nothing, not even in that code tool, and do no design work: reply with only this, word for word, and add nothing else (no prompt to paste elsewhere, no other help): "Kombai needs to run commands on your computer, and this chat can't. Ask in Codex or in a Work chat in the ChatGPT desktop app."

When running in Codex's sandbox, request approved execution outside it **before the first
command below** and for every later Kombai CLI command. Use
`sandbox_permissions: "require_escalated"` on the execution tool call. The commands need network
access and write `~/.kombai`; `npx` may contact the package registry before Kombai starts.
Do not try the restricted command first. If this chat cannot approve the required access,
explain the restriction and wait for the user to change its permissions; do not retry inside
the sandbox.

**First, before anything else, even `npx -y @kombai/cli@0.1.5 skill`:** in the Codex app, look for Kombai's
`canvas_app` tool. Codex lists no MCP tool up front, so search inside exec with
`ALL_TOOLS.filter((t) => t.name.endsWith('canvas_app'))`. If it doesn't exist, Kombai's view isn't set up in Codex
yet: set it up without asking, with `npx -y @kombai/cli@0.1.5 mcp install codex` (outside the sandbox, like every
Kombai command), tell the user in one line, then follow its `next`. When it answers `notStarting: true` (Kombai's
server isn't starting in Codex) or `codexApp: false` (this Codex isn't the app, so it shows no view), its `next` starts
no new task: follow it, and carry on in this task as it says. Otherwise it moves the work to a new task: one offer,
with a link that opens it with the request filled in, and on yes a new task that carries the request; the new task's
prompt starts with Kombai's mention. Then do no design work in this task: it can't show the canvas. Kombai's
plugin id in this Codex is `kombai@<marketplace>`, where `<marketplace>` is the folder after `plugins/cache/` in
this skill's own path: `~/.codex/plugins/cache/openai-curated-remote/kombai/…` gives `kombai@openai-curated-remote`.

Once `canvas_app` exists, it is the only way to show a canvas here: call it with the canvas id right after
`kombai canvas create`, before you write any design, or when you first use a canvas that isn't already open beside
the chat. No browser, no in-app browser, and no canvas link unless the user asks for one; show no link when the view
isn't there either.

Run `npx -y @kombai/cli@0.1.5 skill` and follow what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Request approved execution outside the sandbox as above; do not retry inside it. Node is not missing.
