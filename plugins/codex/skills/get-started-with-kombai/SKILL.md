---
name: get-started-with-kombai
description: Kombai's onboarding in Codex. Sets Kombai's canvas view up if this Codex doesn't have it yet, checks the user is signed in, and shows prompts to try in a new chat. Run by the plugin's setup and by Codex's Try now after an install, and whenever the user asks to set Kombai up, get started with it, or see what to try. Not for design requests; those are work-with-kombai's.
---

**Needs a shell on the user's computer.** Kombai runs its CLI in a shell on the user's computer. Codex has one wherever it runs: the ChatGPT desktop app (its Work chats and Codex), the Codex CLI and the IDE extension, so carry on there, whatever the app is called. Only if this chat has no shell on the user's computer, as in ChatGPT on the web, whose code tool is a cloud sandbox, run nothing, not even in that code tool, and do no design work: reply with only this, word for word, and add nothing else (no prompt to paste elsewhere, no other help): "Kombai needs to run commands on your computer, and this chat can't. Ask in Codex or in a Work chat in the ChatGPT desktop app."

When running in Codex's sandbox, get access outside it **before the first Kombai command**; do not try the
restricted command first. The commands need network access and write `~/.kombai`, npm's configured cache and
the directory containing Codex's `config.toml` (`$CODEX_HOME`, else `~/.codex`; if the file is a symlink,
resolve it and use its target's directory). The CLI saves through a temporary sibling of that target;
`npx` may contact the package registry before Kombai starts.

Before requesting access, resolve npm's cache with the local config read `npm config get cache`
(`npm.cmd config get cache` on Windows), from the workspace root when in an npm workspace. Request the
returned directory, including any configured override; do not assume it is `~/.npm`.

- If this chat can approve sandbox escalations, use `sandbox_permissions: "require_escalated"` on the
  execution tool call for the first command and every later Kombai CLI command.
- If it can't but has the `request_permissions` tool (as a ChatGPT or Codex app chat with no project picked
  does), get the access through that, asking for network access and write access to those paths, then run the
  commands without escalation. Its grant can end with the reply, so before the first Kombai command or
  design-file write of each reply, run `echo network_off=${CODEX_SANDBOX_NETWORK_DISABLED:-0}` on its own: if
  it prints `network_off=1`, call `request_permissions` first; if `network_off=0`, the earlier grant still
  holds, so don't ask again. No output alone does not mean the network was off: if execution returns a
  running session, poll it instead of rerunning the command. If a Kombai command exits with no output, check the
  same way: only if it prints `network_off=1` did it never start, so ask and run it again. Retry only a
  confirmed sandbox denial before any write was sent; for an unknown write outcome, inspect state first. If a later reply in the chat has
  to call `request_permissions` again (asking twice in one reply doesn't count), once that reply's Kombai work
  is done, call Kombai's `access_card` tool with reason `granted` where it is there (in Codex, find it in
  `ALL_TOOLS`), once per chat: it shows the user how to stop this prompt on every message, with a Continue
  button.
- Before any later command needs another write path, request the missing access first. Every
  `mcp install codex`, including an existing view's upgrade or setup from the standalone skill, needs the
  directory containing `config.toml` under `$CODEX_HOME` (else `~/.codex`), following a config symlink to
  its target's directory. The CLI creates a temporary sibling there before replacing the config.
- If neither is available, or the user declines, run nothing and do not retry inside the sandbox. Where
  Kombai's `access_card` tool is there, call it with reason `blocked` (it shows how to allow Kombai, with a
  Continue button that sends "Continue" here) and end your turn with one line. Otherwise tell the user only
  this, in one or two lines: Kombai needs network access to start, and they can allow it by choosing **Approve
  for me** in the permissions menu under the message box (in Codex in a terminal, by allowing network access
  in its approval settings), then sending their message again.

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
- **The network is blocked** (a sandboxed shell). Get access as above; do not retry inside the
  sandbox without it.

If `mcp install codex` answers an error, tell the user what it says in one line.
