---
name: get-started-with-kombai
description: Kombai's onboarding in Claude Code. Sets up Kombai's MCP server if this Claude Code doesn't have it yet (it shows Kombai's taste card in the Claude desktop app), checks the user is signed in, and shows prompts to try in a new session. Use right after the Kombai plugin is installed, and whenever the user asks to set Kombai up, get started with it, or see what to try. Not for design requests; those are work-with-kombai's.
---

The user can run this as often as they like. Do each step without asking first, and do no design work here.

The prompts to try, each the request a new session starts with (the same ones as Kombai's onboarding in Codex):

- Design a standout UI for my website
- Explore design directions on canvas
- Redesign this section for my app

First look among your tools for one whose name ends in `taste_card` (Claude may list Kombai's tools by name only).
Then follow one of the two paths below.

**If it is there**, Kombai's server is set up and this session has it:

1. Run `npx -y @kombai/cli@latest whoami`. If the user isn't signed in, sign them in as
   `npx -y @kombai/cli@latest skill sign-in` says.
2. Tell the user in one line that Kombai is ready, then end with **Try one:** and the prompts as a list.

**If it isn't there**, set Kombai's server up:

1. Run `npx -y @kombai/cli@latest mcp install claude-code`. It adds Kombai's MCP server to the user's own Claude Code
   config. It answers `added` or `replaced` (set up now) or `already` (set up before).
2. If it answered `claudeDesktop: false`, this is Claude Code in a terminal or an IDE, which shows no Kombai card:
   run step 3, tell the user in one line that Kombai is ready and that they can ask for a design right here, end
   with **Try one:** and the prompts as a list, and stop.
   If it answered `disabled: true` or `notStarting: true`, no session gets Kombai's card for now: run step 3, tell the
   user in one line why, as the answer says, and that designs work without the card, end with **Try one:** and the
   prompts as a list, and stop.
3. Run `npx -y @kombai/cli@latest whoami`. If the user isn't signed in, sign them in as
   `npx -y @kombai/cli@latest skill sign-in` says.
4. Tell the user in one line that Kombai is ready and that a new session shows Kombai's taste card, which this one
   can't: Claude Code gives a session only the MCP servers it had when it started. Then end with
   **Try one in a new session:** and the prompts as a list.

If the user asked for a design earlier in this session, carry on with it here instead of listing the prompts: the
canvas opens in the browser either way.

If a command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS
  (macOS: `brew install node`, or the LTS installer from https://nodejs.org; Windows: `winget install
  OpenJS.NodeJS.LTS`; Linux: nvm, then `nvm install --lts`), and wait; do not install Node yourself.
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Ask for network access the way your client does; Node is not
  missing.

If `mcp install claude-code` answers an error, tell the user what it says in one line.
