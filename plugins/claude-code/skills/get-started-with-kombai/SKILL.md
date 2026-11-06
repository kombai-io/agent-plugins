---
name: get-started-with-kombai
description: Kombai's onboarding in Claude Code. Sets up Kombai's MCP server if this Claude Code doesn't have it yet (it shows Kombai's design-brief cards in the Claude desktop app), checks the user is signed in, and shows prompts to try. Use right after the Kombai plugin is installed, and whenever the user asks to set Kombai up, get started with it, or see what to try. Not for design requests; those are work-with-kombai's.
---

The user can run this as often as they like. Do each step without asking first, and do no design work here.

Every path below ends with a short message and then the prompts to try. Put each prompt in a code block of its own,
word for word, so the user can copy it (Claude shows a Copy button on a code block). Each starts with
`/kombai:work-with-kombai`, which runs Kombai's skill from the first message of the session it is pasted into. They are
the same three as Kombai's onboarding in Codex:

```
/kombai:work-with-kombai Design a standout UI for my website
```

```
/kombai:work-with-kombai Explore design directions on canvas
```

```
/kombai:work-with-kombai Redesign this section for my app
```

Show no link: Claude's chat opens none to a new session.

First look among your tools for one whose name ends in `taste_card` (Claude may list Kombai's tools by name only).
Then follow one of the two paths below.

**If it is there**, Kombai's server is set up and this session has it:

1. Run `npx -y @kombai/cli@latest whoami`. If the user isn't signed in, sign them in as
   `npx -y @kombai/cli@latest skill sign-in` says.
2. End with "Kombai is ready. Ask for one of these here, or for anything else you want designed:" and the prompts.

**If it isn't there**, set Kombai's server up:

1. Run `npx -y @kombai/cli@latest mcp install claude-code`. It adds Kombai's MCP server to the user's own Claude Code
   config. It answers `added` or `replaced` (set up now) or `already` (set up before).
2. If it answered `claudeDesktop: false`, this is Claude Code in a terminal or an IDE, which shows no Kombai card:
   run step 3, end with "Kombai is ready. Ask for a design right here, for example:" and the prompts, and stop.
   If it answered `disabled: true`, Kombai's server is turned off in this folder (`/mcp disable`): run step 3, end
   with "Kombai is ready, but its design-brief cards are turned off in this folder; `/mcp enable kombai` turns them
   back on. Ask for a design right here, for example:" and the prompts, and stop.
   If it answered `notStarting: true`, Claude couldn't start Kombai's server: run step 3, end with "Kombai is ready,
   but Claude couldn't start its design-brief cards: <why, in a few words, from the answer>; a new session in a
   minute or two may get them. Ask for a design right here, for example:" and the prompts, and stop.
3. Run `npx -y @kombai/cli@latest whoami`. If the user isn't signed in, sign them in as
   `npx -y @kombai/cli@latest skill sign-in` says.
4. End with "Kombai is ready. Start a new session in this folder to use it: new sessions show Kombai's design-brief
   cards, which this one can't load. Copy a prompt to begin:" and the prompts. (Claude Code gives a session only the
   MCP servers it had when it started.)

If the user asked for a design earlier in this session, carry on with it here instead of listing the prompts: the
canvas opens in the browser either way.

If a command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS
  (macOS: `brew install node`, or the LTS installer from https://nodejs.org; Windows: `winget install
  OpenJS.NodeJS.LTS`; Linux: nvm, then `nvm install --lts`), and wait; do not install Node yourself.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`.
  If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node`
  (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Ask for network access the way your client does; Node is not
  missing.

If `mcp install claude-code` answers any other error: when its `next` is the same command (Claude Code was writing
its config), run it once more. Otherwise tell the user in one line what it says, run step 3, and end as the
`claudeDesktop: false` path does: designs work without the card.
