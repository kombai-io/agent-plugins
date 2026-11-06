---
name: get-started-with-kombai
description: Kombai's onboarding in Codex. Sets Kombai's canvas view up if this Codex doesn't have it yet, checks the user is signed in, and shows prompts to try in a new chat. Run by the plugin's setup and by Codex's Try now after an install, and whenever the user asks to set Kombai up, get started with it, or see what to try. Not for design requests; those are work-with-kombai's.
---

When running in Codex's sandbox, request approved execution outside it **before the first
command below** and for every later Kombai CLI command. Use
`sandbox_permissions: "require_escalated"` on the execution tool call. The commands need network
access and write `~/.kombai` and Codex's `config.toml`; `npx` may contact the package registry before Kombai
starts. Do not try the restricted command first. If this chat cannot approve the required access,
explain the restriction and wait for the user to change its permissions; do not retry inside
the sandbox.

The user can run this as often as they like. Do each step without asking first, and do no design work here.

Kombai's plugin id in this Codex is `kombai@<marketplace>`, where `<marketplace>` is the folder after
`plugins/cache/` in this skill's own path: `~/.codex/plugins/cache/openai-curated-remote/kombai/…` gives
`kombai@openai-curated-remote`.

The prompts to try, each the request a new chat starts with (the same ones as the CLI's starters card):

- Design a standout UI for my website
- Explore design directions on canvas
- Redesign this section for my app

To show them as links, build each in exec as `codex://threads/new?prompt=` followed by
`encodeURIComponent('[@Kombai](plugin://<id>) ' + prompt)` with Kombai's plugin id, then `(` and `)` as `%28` and
`%29`. End your reply with **Try one in a new chat:** and the links as a list, each `[@Kombai <prompt>](link)`, so a
link reads as what it puts in the new chat's message box, unsent, with Kombai mentioned. Give a link no other title.

First look for Kombai's tools in this chat: in exec, `ALL_TOOLS.filter((t) => t.name.startsWith('mcp__kombai'))`.
Then follow one of the two paths below.

**If `canvas_app` is there**, Kombai's view is set up and this chat has it:

1. Run `npx -y @kombai/cli@0.1.5 whoami`. If the user isn't signed in, sign them in as
   `npx -y @kombai/cli@0.1.5 skill sign-in` says.
2. If `starters_card` is there too, call it with `plugin` set to Kombai's plugin id, and end your turn with one
   line, such as "Pick one to try." Don't list the prompts in text. If it isn't (an older Kombai CLI), show the
   prompts as links instead.

**If it isn't there**, set Kombai's view up:

1. Run `npx -y @kombai/cli@0.1.5 mcp install codex`. It adds Kombai's canvas view to Codex: Kombai's MCP server, in
   the user's own Codex config. It answers `added` or `replaced` (set up now) or `already` (set up before).
2. If it answered with `disabled: true`, Kombai's view is turned off in the user's Codex config (`enabled = false`),
   so no chat gets it: tell the user the canvas can't be shown until they turn it back on, show no links, and stop.
   If it answered `notStarting: true`, Kombai's server isn't starting in Codex, so no chat gets the view either: tell
   the user the canvas can't be shown and why that may be (the answer says), show no links, and stop.
   If it answered `codexApp: false`, this is Codex in a terminal or an IDE, which shows no canvas view and can't open
   a link to a new chat: run step 3, tell the user Kombai is ready and that they can ask for a design right here, list
   the prompts as plain text, not links, and stop.
3. Run `npx -y @kombai/cli@0.1.5 whoami`. If the user isn't signed in, sign them in as
   `npx -y @kombai/cli@0.1.5 skill sign-in` says.
4. Tell the user in one line that Kombai is ready and that a new chat shows its canvas beside the chat. This chat
   can't, because Codex gives a chat only the MCP servers it had when it started. Then show the prompts as links.

   If the user asked for a design earlier in this chat, follow the install's `next` to move it to a new task instead
   of showing the links.

If a command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS
  (macOS: `brew install node`, or the LTS installer from https://nodejs.org; Windows: `winget install
  OpenJS.NodeJS.LTS`; Linux: nvm, then `nvm install --lts`), and wait; do not install Node yourself.
- **The network is blocked** (a sandboxed shell). Request approved execution outside the sandbox as above; do not
  retry inside it.

If `mcp install codex` answers an error, tell the user what it says in one line.
