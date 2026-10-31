---
name: kombai-workflow
description: Set up or repair your coding agent's connection to the installed Kombai desktop app for UI design and implementation work. Use when the user asks to work with Kombai, especially when its local MCP tools are missing; do not activate for ordinary coding without Kombai.
---

# Work with Kombai

Kombai's installed desktop app owns the local `kombai` MCP server. This skill supplies setup and recovery instructions. The app may open for a tool call, but it runs normally, not headlessly. Use Kombai tools already available in the current agent session when possible.

## Recover a missing connection

If the `kombai` MCP tools are unavailable, inspect the current agent's MCP settings and check whether the Kombai desktop app is installed. The MCP entry and the app installation are separate. Resolve the installed executable from the installation or operating-system app metadata; do not guess a path, use a source checkout, or invent a localhost port.

Identify which Kombai build the user requested before choosing an executable. For Kombai Dev or another non-production build, check that build's installation and the MCP entry's executable and gateway paths. The user-level `kombai` entry is shared across app builds, so another build can replace it; verify the entry before work with the requested build.

- If the requested build is absent and it is the production build, install it yourself; do not send the user to a download page. Use only the official build from agent.kombai.com, verify its signature before running anything from it, and tell the user in one line what you installed. Your client may ask the user to approve the download or the install; that is expected.
  - macOS on Apple Silicon: with Homebrew, `brew install --cask kombai-io/kombai/kombai`. Otherwise download `https://agent.kombai.com/desktop/download/mac/arm64/Kombai.dmg`, attach it with `hdiutil attach -nobrowse -readonly`, check `codesign --verify --deep --strict` and `spctl --assess --type execute` on `Kombai.app` (both must pass), copy it to `/Applications` (or `~/Applications` when that is not writable), then detach the image and delete the download.
  - Windows x64: download `https://agent.kombai.com/desktop/download/win/x64/Kombai-Setup.exe`, check that `Get-AuthenticodeSignature` reports `Valid` for signer `Kombai INC`, then run it and wait for it to finish (it installs for the current user).
  - Linux x64: download `https://agent.kombai.com/desktop/download/linux/x64/Kombai.AppImage` to `~/Applications` and make it executable.
  - Anything else (an Intel Mac, ARM Windows or Linux), a failed signature check, or a download that is not the installer: stop, say why, and give https://agent.kombai.com/download. Never run an installer from anywhere else.
  - For Kombai Dev or another non-production build, use the build supplied by the user or their team; never substitute production. After installation, check again and continue registration.
- If the requested build is installed but its MCP entry is missing or stale, enable the current agent in that build's MCP settings. For command-line registration, use the installed app executable's `help --json` to check the supported `mcp install` client identifiers and syntax. Run registration through that executable. If your shell runs commands in a sandbox, run `help --json` and `mcp install` outside it from the first try, asking for escalated or unsandboxed execution the way your client does. Inside a sandbox the executable cannot reach the window server or Kombai's local bridge: on macOS it crashes before printing anything, with exit code 134, and the user sees a crash dialog. Exit code 134 with no output from a sandboxed run means exactly that, not a broken Kombai: run the command again outside the sandbox. If you cannot run them outside the sandbox, because your client offers no way to or the user declines, ask the user to enable the current agent in that build's MCP settings. If the agent is not listed or detected, use the app's **Configure manually** section for its MCP configuration and task skills; follow the current agent's configuration format rather than inventing commands or paths.
- Verify that the current agent's MCP settings contain the `kombai` entry for the requested build. If this session cannot use newly registered MCP tools, ask the user to reload the agent or start a new session as appropriate for that host. Do not repeatedly edit configuration to hot-load the server.

## Continue in Kombai

After the MCP is connected, use the matching task skill installed by the Kombai app, such as `design-with-kombai`, `code-with-kombai`, or `describe-kombai-canvas`. Those skills describe how to perform each task. The MCP server's instructions describe tool arguments, status polling, and retries; follow them rather than duplicating them here.

Do not perform sign-in or sign-up on the user's behalf unless they explicitly ask you to, and never request credentials in the agent chat or pass them through MCP. If Kombai reports `not_signed_in`, it has already opened its sign-in page in the user's browser: ask them to sign in there (they do not need to open the Kombai app), then retry. Handle credit or plan refusals in Kombai. When Kombai asks a question during a run (`chat_status` returns `question`), ask it in this chat: if the `chat_question` tool is available, use it to show a card the user answers in, which sends the answer to Kombai itself; otherwise ask in your own words and send the user's reply with `chat_answer`.
