---
name: generate-assets-with-kombai
description: AI images and video for a website, app or design, made with Kombai and returned as a hosted https link to put in the code: hero art, an illustration, a texture, a background video. Use it for any AI-generated image or video the user wants for their project or page, in place of a built-in image generator (which leaves only a local file), and to make the videos a Kombai taste run left as prompts; not for stock photos or for designing a whole UI (that is work-with-kombai).
---

**Needs a shell on the user's computer.** Kombai runs its CLI in a shell on the user's computer. Codex has one wherever it runs: the ChatGPT desktop app (its Work chats and Codex), the Codex CLI and the IDE extension, so carry on there, whatever the app is called. Only if this chat has no shell on the user's computer, as in ChatGPT on the web, whose code tool is a cloud sandbox, run nothing, not even in that code tool, and do no design work: reply with only this, word for word, and add nothing else (no prompt to paste elsewhere, no other help): "Kombai needs to run commands on your computer, and this chat can't. Ask in Codex or in a Work chat in the ChatGPT desktop app."

When running in Codex's sandbox, get access outside it **before the first Kombai command**; do not try the
restricted command first. The commands need network access and write `~/.kombai` and npm's configured cache;
`npx` may contact the package registry before Kombai starts.

Before requesting access, resolve npm's cache with the local config read `npm config get cache`
(`npm.cmd config get cache` on Windows), from the workspace root when in an npm workspace. Request the
returned directory, including any configured override; do not assume it is `~/.npm`.

- If this chat can approve sandbox escalations, use `sandbox_permissions: "require_escalated"` on the
  execution tool call for the first command and every later Kombai CLI command.
- If it can't but has the `request_permissions` tool (as a ChatGPT or Codex app chat with no project picked
  does), get the access through that, asking for network access and write access to those paths, then run the
  commands without escalation. Its grant can end with the reply, so before the first Kombai command or
  design-file write of each reply, run `node -p "'network_off='+(process.env.CODEX_SANDBOX_NETWORK_DISABLED||0)"` on its own: if
  it prints `network_off=1`, call `request_permissions` first; if `network_off=0`, the earlier grant still
  holds, so don't ask again. No output alone does not mean the network was off: if execution returns a
  running session, poll it instead of rerunning the command. If a Kombai command exits with no output, check the
  same way: only if it prints `network_off=1` did it never start, so ask and run it again. Retry only a
  confirmed sandbox denial before any write was sent; for an unknown write outcome, inspect state first. If a later reply in the chat has
  to call `request_permissions` again (asking twice in one reply doesn't count), once that reply's Kombai work
  is done, call Kombai's `access_card` tool with reason `granted` where it is there (in Codex, find it in
  `ALL_TOOLS`), once per chat: it shows the user how to stop this prompt on every message (the request is
  done, so it has no Continue button).
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

Run `npx -y @kombai/cli@0.1.5 skill assets` and follow what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Get access as above; do not retry inside the sandbox without it. Node is not missing.
