---
name: get-started-with-kombai
description: Kombai's onboarding in Claude Code. Checks the user is signed in to Kombai and shows prompts to try. Use right after the Kombai plugin is installed, and whenever the user asks to set Kombai up, get started with it, or see what to try. Not for design requests; those are work-with-kombai's.
---

**Claude Code only.** Kombai runs its CLI in a shell on the user's computer. If this chat is in Claude's chat (claude.ai, or the Chat tab of the Claude desktop or mobile app) rather than Claude Code, run nothing, not even in the chat's own code tool (it is not the user's computer), and do no design work: reply with only this, word for word, and add nothing else (no prompt to paste elsewhere, no other help): "Kombai's plugin works only in Claude Code, not in Claude's chat. Install it in Claude Code and ask there."

The user can run this as often as they like. Do each step without asking first, and do no design work here.

Getting started ends with a short message and then the prompts to try. Put each prompt in a code block of its own,
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

Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.3.1`.

1. Run `kombai whoami`. If the user isn't signed in, sign them in as
   `kombai skill sign-in` says.
2. End with "Kombai is ready. Ask for one of these here, or for anything else you want designed:" and the prompts.

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
