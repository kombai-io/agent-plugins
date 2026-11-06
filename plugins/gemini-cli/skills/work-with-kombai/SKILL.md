---
name: work-with-kombai
description: Design UI with Kombai. Designs go on a Kombai canvas; design systems are .ds files in the Kombai account and need no canvas. Use when the user asks to work with Kombai, for a design, mockup, variants or a design system, or pastes a Kombai canvas link; not for ordinary coding.
---

Gemini CLI's sandbox (on when `$SANDBOX` is set) keeps Kombai from writing your `~/.kombai` (its
strict profiles and its Docker or Podman containers keep Kombai from reading it too), and some
sandbox profiles also block the network. Signing in, guest mode and canvases cannot work there, and
sign-in and guest mode fail only after Kombai's server has acted. So before the first command below,
run `echo "$SANDBOX"`. If it prints anything, run no Kombai command: tell the user Kombai needs read
and write access to `~/.kombai` and network access, and ask them to restart Gemini CLI without the
sandbox, as `GEMINI_SANDBOX=false gemini` and without `-s` (this also overrides `tools.sandbox` in
their settings.json; in PowerShell, set `$env:GEMINI_SANDBOX = "false"` first), or to run Kombai in
their own terminal.

If run_shell_command has an `additional_permissions` parameter (Gemini CLI's per-command tool
sandboxing, `security.toolSandboxing`), pass it on the first Kombai command, with `network: true`
and `fileSystem.write` set to the absolute paths of `~/.kombai` and `~/.npm`, and ask the user to
allow it for the session; later Kombai commands then run with it, so do not pass it again. If the
user declines, stop and explain that Kombai needs it. If there is no such parameter and `$SANDBOX`
is empty, Kombai is not sandboxed: report a permission or network error as it is.

Run `npx -y @kombai/cli@0.1.5 skill` and follow what it prints; it is this skill's full text.

If that command fails before it prints anything:

- **`npx` or `node` not found.** Kombai needs Node.js 20 or later. Tell the user, give them the steps for their OS, and wait; do not install Node yourself.
  - macOS: `brew install node` if Homebrew is installed, otherwise the LTS installer from https://nodejs.org.
  - Windows: `winget install OpenJS.NodeJS.LTS`, otherwise the LTS .msi from https://nodejs.org.
  - Linux: nvm (https://github.com/nvm-sh/nvm), then `nvm install --lts`. The distro's package is often older than 20.

  When they say it is installed, run the command again. If `node` is still not found, ask them to restart this agent or its editor, so it picks up the new PATH; do not ask them to install again.
- **`CLI_NODE_TOO_OLD`.** The same steps upgrade Node; with nvm, `nvm install --lts` then `nvm alias default lts/*`. If the error comes back after an upgrade, an older `node` is first on PATH: show the user `which -a node` (`where node` on Windows).
- **Windows PowerShell says running scripts is disabled.** Run `npx.cmd` in place of `npx`.
- **The network is blocked** (a sandboxed shell). If `$SANDBOX` is set, ask the user to restart Gemini CLI without the sandbox as above; with tool sandboxing, pass `additional_permissions` as above. Do not retry inside the sandbox otherwise. Node is not missing.
