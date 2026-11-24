---
name: about-kombai
description: Answer the user's questions about Kombai itself (what it is, which agents it works with, accounts and guest mode, credits and plans, where designs and data live, sharing, privacy, updates and support). Use when the user asks about Kombai rather than for design work.
---

When Antigravity runs terminal commands in its sandbox, request to run the first command below
outside the sandbox **from the first try**, and the same for every later Kombai CLI command: the
sandbox has no network, and Kombai writes `~/.kombai`. `npx` may contact the package registry before
Kombai starts. Do not try the sandboxed command first. If approval is declined, stop. A headless
`agy -p` run cannot prompt. For headless use, ask the user to add the Allow rule
`command(regex:npx(.cmd)? -y @kombai/cli@[a-z0-9.-]+ .*)` for the bootstrap in Antigravity's
permission settings (in agy, `/permissions` or `permissions.allow` in
`~/.gemini/antigravity-cli/settings.json`). Business and enterprise accounts use `unsandboxed(...)`.

If the CLI prints a Node launcher for later commands, verify its absolute path against the installed
`launch.mjs` under the user's own `~/.kombai/cli/install/latest/` or `beta/` channel. Only then
offer a literal Allow rule, for example `command(node "/Users/sam/.kombai/cli/install/latest/launch.mjs")`.
Substitute the verified path, keeping the quotes and forward slashes on Windows too. Replace any
older Node launcher rule that used a wildcard path. If the path cannot be verified or the host
still prompts, ask for approval of the individual command in an interactive session.

Run Kombai's CLI (`kombai` below) as `npx -y @kombai/cli@0.3.1`.

Run `kombai skill faq` and answer from what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (Antigravity's sandbox). Request to run the command outside the sandbox as above; do not retry inside it. Node is not missing.
