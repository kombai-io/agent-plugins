---
name: about-kombai
description: Answer the user's questions about Kombai itself (what it is, which agents it works with, accounts and guest mode, credits and plans, where designs and data live, sharing, privacy, updates and support). Use when the user asks about Kombai rather than for design work.
---

**Claude Code only.** Kombai runs its CLI in a shell on the user's computer. If this chat is in Claude's chat (claude.ai, or the Chat tab of the Claude desktop or mobile app) rather than Claude Code, run nothing, not even in the chat's own code tool (it is not the user's computer), and do no design work: reply with only this, word for word, and add nothing else (no prompt to paste elsewhere, no other help): "Kombai's plugin works only in Claude Code, not in Claude's chat. Install it in Claude Code and ask there."

Run `npx -y @kombai/cli@0.1.5 skill faq` and answer from what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Ask for network access the way your client does; Node is not missing.
