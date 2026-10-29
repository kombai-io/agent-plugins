---
name: kombai-workflow
description: Set up or repair your coding agent's connection to the installed Kombai desktop app for UI design and implementation work. Use when the user asks to work with Kombai, especially when its local MCP tools are missing; do not activate for ordinary coding without Kombai.
---

# Work with Kombai

Kombai's installed desktop app owns the local `kombai` MCP server. This skill supplies setup and recovery instructions. The app may open for a tool call, but it runs normally, not headlessly. Use Kombai tools already available in the current agent session when possible.

## Recover a missing connection

If the `kombai` MCP tools are unavailable, inspect the current agent's MCP settings and check whether the Kombai desktop app is installed. The MCP entry and the app installation are separate. Resolve the installed executable from the installation or operating-system app metadata; do not guess a path, use a source checkout, or invent a localhost port.

Identify which Kombai build the user requested before choosing an executable. For Kombai Dev or another non-production build, check that build's installation and the MCP entry's executable and gateway paths. Never substitute an installed production build. The user-level `kombai` entry is shared across app builds, so another build can replace it; verify the entry before work with the requested build.

- If the requested build is absent, explain that it must be installed first. For Kombai Dev or another non-production build, use the build supplied by the user or their team. For an ordinary Kombai request, show the official download page: https://agent.kombai.com/download. Never download or execute an installer without the user's instruction. After installation, check again and continue registration.
- If the requested build is installed but its MCP entry is missing or stale, use that build's MCP settings to enable the current agent. If using command-line registration, first verify the installed build's supported client identifiers and command syntax; do not assume that the agent's display name is a valid client identifier. Run registration only through the installed app's executable, never through this skill package. If the current agent is not supported by the installed build, explain the limitation rather than inventing a registration command or configuration.
- Verify that the current agent's MCP settings contain the `kombai` entry for the requested build. If this session cannot use newly registered MCP tools, ask the user to reload the agent or start a new session as appropriate for that host. Do not repeatedly edit configuration to hot-load the server.

## Continue in Kombai

After the MCP is connected, use the matching task skill installed by the Kombai app, when available, such as `design-with-kombai`, `code-with-kombai`, or `describe-kombai-canvas`. Those skills describe how to perform each task. The MCP server's instructions describe tool arguments, status polling, and retries; follow them rather than duplicating them here. If task skills are unavailable, use the connected server's instructions and available tools; do not assume a host-specific skill invocation syntax.

Do not perform sign-in or sign-up on the user's behalf unless they explicitly ask you to. If Kombai reports `not_signed_in` and the user has not explicitly asked you to handle sign-in, ask them to open the Kombai app and sign in there. Do not request credentials in the agent chat or pass them through MCP. Handle credit or account refusals in Kombai. If the user needs to answer a question during a Kombai run, direct them to the app.
