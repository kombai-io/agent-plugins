---
name: kombai-workflow
description: Set up or repair Codex's connection to the installed Kombai desktop app for UI design and implementation work. Use when the user asks to work with Kombai, especially when its local MCP tools are missing; do not activate for ordinary coding without Kombai.
---

# Work with Kombai

Kombai's installed desktop app owns the local `kombai` MCP server. This plugin supplies instructions only. The app may open in the background for a tool call, but it runs normally, not headlessly. Use the Kombai tools already available to the current Codex task when possible.

## Recover a missing connection

If the `kombai` MCP tools are unavailable, inspect `codex mcp get kombai --json` and check whether the Kombai desktop app is installed. An MCP entry in Codex is separate from the app installation. Resolve an installed app's executable from the actual installation or operating-system app metadata; do not guess a path, use a source checkout, or invent a localhost port.

Identify which Kombai build the user requested before choosing an executable. If they request Kombai Dev or another non-production build, check that build's installation and the MCP entry's executable and gateway paths. Never substitute an installed production build. The `kombai` entry is shared across app builds, so another build can replace it; verify the entry again before beginning work with the requested build.

- If the requested build is absent, explain that it must be installed first. For Kombai Dev or another non-production build, use the build supplied by the user or their team; the public production download link is not a substitute. For an ordinary Kombai request, show the official download page: https://agent.kombai.com/download. Never download or execute an installer without the user's instruction. After the user installs the requested build, check again and continue registration.
- If the requested build is installed but its MCP entry is missing or stale, run that build's executable with `mcp install codex`. This registration command exits without opening a Kombai window. If you cannot verify the executable path, ask the user to turn on Codex in that build's MCP settings. If the installed build lacks the command, ask the user to update it or use those settings. Do not attempt to run an executable from this plugin package.
- Verify the result with `codex mcp get kombai --json`. If the current task cannot use the newly registered MCP tools, tell the user to start one new Codex task. Do not repeatedly edit Codex configuration in an attempt to hot-load the server.

## Continue in Kombai

After the MCP is connected, use the matching task-specific skill installed by the Kombai app, such as `design-with-kombai`, `code-with-kombai`, or `describe-kombai-canvas`. Those skills describe how to perform each task. The MCP server's own instructions describe its tool arguments, status polling, and retry behavior; follow those rather than duplicating them here.

Do not perform sign-in or sign-up on the user's behalf unless they explicitly ask you to. If Kombai reports `not_signed_in` and the user has not explicitly asked you to handle sign-in, ask them to open the Kombai app and sign in there. Do not request credentials in Codex or pass them through MCP. Handle credit or account refusals in the Kombai app. If the user needs to answer a question during a Kombai run, direct them to the app.
