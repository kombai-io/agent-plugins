---
name: kombai-workflow
description: Set up or repair Codex's connection to the installed Kombai desktop app for UI design and implementation work. Use when the user asks to work with Kombai, especially when its local MCP tools are missing; do not activate for ordinary coding without Kombai.
---

# Work with Kombai

Kombai's installed desktop app owns the local `kombai` MCP server. This plugin supplies instructions only. The app may open in the background for a tool call, but it runs normally, not headlessly. Use the Kombai tools already available to the current Codex task when possible.

## Recover a missing connection

If the `kombai` MCP tools are unavailable, inspect `codex mcp get kombai --json` and check whether the Kombai desktop app is installed. An MCP entry in Codex is separate from the app installation. Resolve an installed app's executable from the actual installation or operating-system app metadata; do not guess a path, use a source checkout, or invent a localhost port.

Identify which Kombai build the user requested before choosing an executable. If they request Kombai Dev or another non-production build, check that build's installation and the MCP entry's executable and gateway paths. Never substitute an installed production build. The `kombai` entry is shared across app builds, so another build can replace it; verify the entry again before beginning work with the requested build.

- If the requested build is absent and it is the production build, install it yourself; do not send the user to a download page. Use only the official build from agent.kombai.com, verify its signature before running anything from it, and tell the user in one line what you installed. Your client may ask the user to approve the download or the install; that is expected.
  - macOS on Apple Silicon: with Homebrew, `brew install --cask kombai-io/kombai/kombai`. Otherwise download `https://agent.kombai.com/desktop/download/mac/arm64/Kombai.dmg`, attach it with `hdiutil attach -nobrowse -readonly`, check `codesign --verify --deep --strict` and `spctl --assess --type execute` on `Kombai.app` (both must pass), copy it to `/Applications` (or `~/Applications` when that is not writable), then detach the image and delete the download.
  - Windows x64: download `https://agent.kombai.com/desktop/download/win/x64/Kombai-Setup.exe`, check that `Get-AuthenticodeSignature` reports `Valid` for signer `Kombai INC`, then run it and wait for it to finish (it installs for the current user).
  - Linux x64: download `https://agent.kombai.com/desktop/download/linux/x64/Kombai.AppImage` to `~/Applications` and make it executable.
  - Anything else (an Intel Mac, ARM Windows or Linux), a failed signature check, or a download that is not the installer: stop, say why, and give https://agent.kombai.com/download. Never run an installer from anywhere else.
  - For Kombai Dev or another non-production build, use the build supplied by the user or their team; never substitute production. After installation, check again and continue registration.
- If the requested build is installed but its MCP entry is missing or stale, run that build's executable with `mcp install codex`. This registration command exits without opening a Kombai window. If your shell runs commands in a sandbox, run that command outside it from the first try, asking for escalated or unsandboxed execution the way your client does. Inside a sandbox the executable cannot reach the window server or Kombai's local bridge: on macOS it crashes before printing anything, with exit code 134, and the user sees a crash dialog. Exit code 134 with no output from a sandboxed run means exactly that, not a broken Kombai: run the command again outside the sandbox. If you cannot verify the executable path, or cannot run the command outside the sandbox because your client offers no way to or the user declines, ask the user to turn on Codex in that build's MCP settings. If the installed build lacks the command, ask the user to update it or use those settings. Do not attempt to run an executable from this plugin package.
- Verify the result with `codex mcp get kombai --json`. A running Codex task never gains newly registered MCP tools, but a task started after registration has them, so do not repeatedly edit Codex configuration in an attempt to hot-load the server. If the current task cannot use the Kombai tools, continue in a new task as below.

## Continue in a new task

When Kombai was just registered and this task cannot use its tools, a new Codex task can.

- With the `create_thread` tool (the Codex desktop app), offer to start that task for the user. Ask in one line, for example: "Kombai is connected, but this task can't use it yet. Shall I start a new task that sends your request to Kombai?" Then end your turn and wait for the answer. Start the task only after the user says yes: Codex creates a task only when the user asks for one.
- On yes, call `list_projects` and take the project whose `path` is the current workspace. Call `create_thread` with that project, the `local` environment, a short title, and a `prompt` that hands over the user's request in their own words and says to use Kombai for it. Name the files they referred to by path; images pasted into this chat do not carry over, so ask the user to attach those again in the new task. Add no requirements, styles or other direction of your own. Then reply in one line that the work continues in the new task, ending with the `::created-thread` line that `create_thread` asks for. Do not follow or wait on that task: it belongs to the user.
- If the user says no, no project's `path` is the current workspace, or `create_thread` fails, ask the user to start one new Codex task in this project and give them their request to paste. Never start the task outside the project: Kombai needs the real workspace folder.
- Without `create_thread` (the Codex CLI or the IDE extension), ask the user to start one new Codex task.

## Continue in Kombai

After the MCP is connected, use the matching task-specific skill installed by the Kombai app, such as `design-with-kombai`, `code-with-kombai`, or `describe-kombai-canvas`. Those skills describe how to perform each task. The MCP server's own instructions describe its tool arguments, status polling, and retry behavior; follow those rather than duplicating them here.

Do not perform sign-in or sign-up on the user's behalf unless they explicitly ask you to, and never request credentials in Codex or pass them through MCP. If Kombai reports `not_signed_in`, it has already opened its sign-in page in the user's browser: ask them to sign in there (they do not need to open the Kombai app), then retry. Handle credit or plan refusals in Kombai. When Kombai asks a question during a run (`chat_status` returns `question`), show it in this chat with `chat_question`: a card the user answers in, which sends the answer to Kombai itself. Without that tool, ask in your own words and send the user's reply with `chat_answer`.
