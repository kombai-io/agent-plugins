---
name: kombai-workflow
description: Set up or repair Claude Code's connection to the installed Kombai desktop app for UI design and implementation work. Use when the user asks to work with Kombai, especially when its local MCP tools are missing; do not activate for ordinary coding without Kombai.
---

# Work with Kombai

Kombai's installed desktop app owns the local `kombai` MCP server. This plugin supplies setup and recovery instructions. The app may open for a tool call, but it runs normally, not headlessly. Use Kombai tools already available in this Claude Code session when possible.

## Recover a missing connection

If the `kombai` MCP tools are unavailable, inspect `claude mcp get kombai` and check whether the Kombai desktop app is installed. The MCP entry and the app installation are separate. Resolve the actual installed executable from the installation or operating-system app metadata; do not guess a path, use a source checkout, or invent a localhost port.

Identify which Kombai build the user requested before choosing an executable. For Kombai Dev or another non-production build, check that build's installation and the MCP entry's executable and gateway paths. The user-level `kombai` entry is shared across app builds, so another build can replace it; verify the entry before work with the requested build.

- If the requested build is absent, explain that it must be installed first. For Kombai Dev or another non-production build, use the build supplied by the user or their team. For an ordinary Kombai request, show the official download page: https://agent.kombai.com/download. Never download or execute an installer without the user's instruction. After installation, check again and continue registration.
- If the requested build is installed but its MCP entry is missing or stale, run that build's executable with `mcp install claude-code`. This registration command exits without opening a Kombai window. If you cannot verify the executable path, ask the user to turn on Claude Code in that build's MCP settings. If the installed build lacks the command, ask the user to update it or use those settings. Do not run an executable from this plugin package.
- Verify with `claude mcp get kombai`. Claude Code may start Kombai normally while checking the server's health. If this session cannot use newly registered MCP tools, ask the user to start a new Claude Code session. Do not repeatedly edit Claude's configuration to hot-load the server.

## Continue in Kombai

After the MCP is connected, use the matching task skill installed by the Kombai app, such as `/design-with-kombai`, `/code-with-kombai`, or `/describe-kombai-canvas`. Those skills describe how to perform each task. The MCP server's instructions describe tool arguments, status polling, and retries; follow them rather than duplicating them here.

Do not perform sign-in or sign-up on the user's behalf unless they explicitly ask you to. If Kombai reports `not_signed_in` and the user has not explicitly asked you to handle sign-in, ask them to open the Kombai app and sign in there. Do not request credentials in Claude Code or pass them through MCP. Handle credit or account refusals in Kombai. If the user needs to answer a question during a Kombai run, direct them to the app.
