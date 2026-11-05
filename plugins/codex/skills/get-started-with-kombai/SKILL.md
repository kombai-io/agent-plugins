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

Kombai's plugin id in this Codex is `kombai@kombai`.

First look for Kombai's `starters_card` tool in this chat: in exec,
`ALL_TOOLS.filter((t) => t.name.startsWith('mcp__kombai'))`. Then follow one of the two paths below.

**If `starters_card` is there**, Kombai's view is set up and this chat has it:

1. Run `npx -y @kombai/cli@latest whoami`. If the user isn't signed in, sign them in as
   `npx -y @kombai/cli@latest skill sign-in` says.
2. Call `starters_card` with `plugin` set to Kombai's plugin id above. It shows prompts to try, each with a Try
   button that opens a new chat with the prompt filled in.
3. End your turn with one line, such as "Pick one to try." Don't list the prompts in text.

**If it isn't there**, set Kombai's view up:

1. Run `npx -y @kombai/cli@latest mcp install codex`. It adds Kombai's canvas view to Codex: Kombai's MCP server, in
   the user's own Codex config. It answers `added` or `replaced` (set up now) or `already` (set up before).
2. Run `npx -y @kombai/cli@latest whoami`. If the user isn't signed in, sign them in as
   `npx -y @kombai/cli@latest skill sign-in` says.
3. Tell the user in one line that Kombai is ready and that a new chat shows its canvas beside the chat. This chat
   can't, because Codex gives a chat only the MCP servers it had when it started. Then end your reply with this list,
   copied exactly, links unchanged. Each link opens a new chat with Kombai mentioned and its prompt filled in:

   **Try one in a new chat:**
   - [Design a landing page for a coffee brand](codex://threads/new?prompt=%5B%40Kombai%5D%28plugin%3A%2F%2Fkombai%40kombai%29%20design%20a%20landing%20page%20for%20a%20specialty%20coffee%20brand)
   - [Explore three directions for a pricing page](codex://threads/new?prompt=%5B%40Kombai%5D%28plugin%3A%2F%2Fkombai%40kombai%29%20explore%20three%20design%20directions%20for%20a%20SaaS%20pricing%20page)
   - [Redesign a screen in this project](codex://threads/new?prompt=%5B%40Kombai%5D%28plugin%3A%2F%2Fkombai%40kombai%29%20redesign%20the%20main%20screen%20of%20this%20project)

   If the user asked for a design earlier in this chat, follow the install's `next` to move it to a new task instead
   of showing the list.

If a command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS
  (macOS: `brew install node`, or the LTS installer from https://nodejs.org; Windows: `winget install
  OpenJS.NodeJS.LTS`; Linux: nvm, then `nvm install --lts`), and wait; do not install Node yourself.
- **The network is blocked** (a sandboxed shell). Request approved execution outside the sandbox as above; do not
  retry inside it.

If `mcp install codex` answers an error, tell the user what it says in one line.
