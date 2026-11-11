---
name: generate-assets-with-kombai
description: Generate an AI image or video with Kombai — an illustration, hero art, a texture, a looping background — and get a public link to use in a design or the repo. Use when the user asks for an AI-generated image or video, or to make the videos a Kombai taste run left as prompts; not for stock photos or for designing a whole UI (that is work-with-kombai).
---

When Antigravity runs terminal commands in its sandbox, request to run the first command below
outside the sandbox **from the first try**, and the same for every later Kombai CLI command: the
sandbox has no network, and Kombai writes `~/.kombai`. `npx` may contact the package registry before
Kombai starts. Do not try the sandboxed command first. If the request is refused, or this session
cannot ask (a headless `agy -p` run), do not retry inside the sandbox: explain the restriction and
ask the user to allow Kombai's commands with the Allow rules
`command(regex:npx(.cmd)? -y @kombai/cli@[a-z0-9.-]+ .*)` and `command(kombai)` (`unsandboxed(...)`
on business and enterprise accounts) in Antigravity's permission settings; for agy, with
`/permissions` or under `permissions.allow` in `~/.gemini/antigravity-cli/settings.json`. The
`regex:` rule matches every Kombai CLI version, so it keeps working when Kombai updates, and covers
Windows, where commands run as `npx.cmd`. Answering the approval prompt with "always allow" covers
only the Kombai version this skill runs now.

Run `npx -y @kombai/cli@0.1.5 skill assets` and follow what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (Antigravity's sandbox). Request to run the command outside the sandbox as above; do not retry inside it. Node is not missing.
