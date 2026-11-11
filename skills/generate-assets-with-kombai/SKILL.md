---
name: generate-assets-with-kombai
description: Generate an AI image or video with Kombai and get a hosted https link to put in the code — hero art, an illustration, a texture, a background video. Use it only when the user asks for Kombai to make the image or video (names Kombai or picks this skill), or to make the videos a Kombai taste run left as prompts once the user asked for AI video. Never on your own — an image request that does not name Kombai is not for this skill (use the host's own image tool, if it has one); not for stock photos or for designing a whole UI (that is work-with-kombai).
---

When running in Codex's sandbox, first read `codex-access.md` beside this file and do what it says
**before the first command below**: it says how to get network access without trying the restricted
command first. Elsewhere, skip it.

Run `npx -y @kombai/cli@0.1.5 skill assets` and follow what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). Ask for network access the way your client does; Node is not missing.
