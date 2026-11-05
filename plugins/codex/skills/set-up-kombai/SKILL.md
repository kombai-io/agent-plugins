---
name: set-up-kombai
description: Set Kombai up in Codex right after the plugin is installed, so new chats show Kombai's canvas beside the chat. Run by the plugin's setup; not for design work.
---

When running in Codex's sandbox, request approved execution outside it **before the first
command below** and for every later Kombai CLI command. Use
`sandbox_permissions: "require_escalated"` on the execution tool call. The commands need network
access and write `~/.kombai` and Codex's `config.toml`; `npx` may contact the package registry before Kombai
starts. Do not try the restricted command first. If this chat cannot approve the required access,
explain the restriction and wait for the user to change its permissions; do not retry inside
the sandbox.

Set Kombai up now, without asking the user first:

1. Run `npx -y @kombai/cli@latest mcp install codex`. It adds Kombai's canvas view to Codex: Kombai's MCP server, in
   the user's own Codex config. It answers `added` or `replaced` (set up now) or `already` (set up before).
2. Run `npx -y @kombai/cli@latest whoami`. If the user isn't signed in, sign them in as
   `npx -y @kombai/cli@latest skill sign-in` says.
3. Tell the user in one or two lines that Kombai is ready: a new chat shows the canvas beside it, so they start one
   and ask for a design. This chat can't show the canvas, because Codex gives a chat only the MCP servers it had when
   it started. If the user asked for a design earlier in this chat, follow the install's `next` to move it to a new
   task instead.

Do no design work here.

If a command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS
  (macOS: `brew install node`, or the LTS installer from https://nodejs.org; Windows: `winget install
  OpenJS.NodeJS.LTS`; Linux: nvm, then `nvm install --lts`), and wait; do not install Node yourself.
- **The network is blocked** (a sandboxed shell). Request approved execution outside the sandbox as above; do not
  retry inside it.

If `mcp install codex` answers an error, tell the user what it says in one line.
