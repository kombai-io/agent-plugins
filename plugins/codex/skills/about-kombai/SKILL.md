---
name: about-kombai
description: Answer the user's questions about Kombai itself (what it is, which agents it works with, accounts and guest mode, credits and plans, where designs and data live, sharing, privacy, updates and support). Use when the user asks about Kombai rather than for design work.
---

**Codex only.** Kombai runs its CLI in a shell on the user's computer. If this chat is in ChatGPT's Chat or Work (chatgpt.com, or the Chat or Work tab of the ChatGPT desktop app) rather than Codex, run nothing, not even in the chat's own code tool, and do no design work: reply with only this, word for word, and add nothing else (no prompt to paste elsewhere, no other help): "Kombai's plugin works only in Codex, not in ChatGPT's Chat or Work. Switch to Codex and ask there."

When running in Codex's sandbox, run every Kombai command outside it **from the first try**: use
`sandbox_permissions: "require_escalated"` on the execution tool call for the first command and every later Kombai
CLI command, and do not try the restricted command first. The commands need network access and write `~/.kombai`,
npm's cache and, for `mcp install codex`, Codex's config folder; `npx` may contact the package registry before
Kombai starts. Retry only a confirmed sandbox denial before any write was sent; for an unknown write outcome, inspect
state first. If this chat is in ChatGPT's Chat or Work, run nothing and reply only that Kombai's plugin works only
in Codex, not in ChatGPT's Chat or Work, and to switch to Codex and ask there. Otherwise, if this chat can't run a command outside the sandbox, or the user declines, run nothing and do not retry
inside the sandbox. Reply with only this, word for word:

> Kombai needs to run outside Codex's sandbox to design, and this Codex session blocks it. Fix it one of these ways, then send your message again:
> - In the Codex app: approve Kombai when Codex asks (if the chat never asks, pick a project for it), or pick **Full access** in the permissions menu under the message box.
> - In Codex in a terminal: start it with `codex --sandbox danger-full-access`, or run your request with `codex exec -s danger-full-access "<your request>"`.
>
> Kombai doesn't run in ChatGPT's Chat or Work tabs.

Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.2.0`.

Run `kombai skill faq` and answer from what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Get access as above; do not retry inside the sandbox without it. Node is not missing.
