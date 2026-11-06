# Kombai for VS Code

This plugin is for GitHub Copilot's agent in VS Code, which installs agent plugins (VS Code 1.113 or later; `chat.plugins.enabled` is on by default in current versions).

Its `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.1.5 skill`) and follows what it prints: the agent designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@0.1.5 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

**Installed kombai in VS Code from this repository before this plugin existed (0.1.0)?** VS Code installed the Claude Code plugin (`plugins/claude-code`) then, and keeps loading it after updates. Run **Chat: Update Plugins**, uninstall every kombai entry in the Extensions view (`@agentPlugins`), then install kombai again. Installing it without uninstalling first adds a second copy that stays disabled, and turning that copy on switches the old one off only in the current workspace.

## Install

Add the marketplace and install the plugin, in one of these ways:

- Run **Chat: Install Plugin from Source** and enter `kombai-io/agent-plugins`. It adds the marketplace and installs **kombai** in one step.
- On VS Code 1.142 or later, run **Chat: Manage Plugin Marketplaces** → **Add Marketplace…** (1.144 or later: **Chat: Add Plugin Marketplace**) and enter `kombai-io/agent-plugins`. Then search `@agentPlugins` in the Extensions view (or run **Chat: Plugins**) and install **kombai**.
- Add `kombai-io/agent-plugins` to the `chat.plugins.marketplaces` setting, then install **kombai** from `@agentPlugins`. Add it to the list your settings already have: a list with only this entry replaces VS Code's default marketplaces. If you have never set it, start from the default VS Code shows for the setting, for example:

  ```json
  "chat.plugins.marketplaces": ["github/awesome-copilot#marketplace", "kombai-io/agent-plugins"]
  ```

  That is the default in recent versions; earlier ones also list `github/copilot-plugins`. The two commands above add to the existing list by themselves.

To try a local checkout (VS Code 1.128 or later), give **Chat: Install Plugin from Source** the absolute path to this `plugins/vscode` directory. VS Code uses the folder where it is rather than copying it (it adds the path to the `chat.pluginLocations` setting), so keep the folder in place; deleting or moving it removes the plugin. To remove it, delete its entry from `chat.pluginLocations`.

VS Code reads the repository's `.github/plugin/marketplace.json`, which points to `plugins/vscode`. It reads that file before `.claude-plugin/marketplace.json`, so new installs get this plugin and not the Claude Code one. GitHub Copilot CLI reads the same file first, so `copilot plugin install kombai@kombai` from this marketplace installs this plugin too.

VS Code caches the marketplace listing for up to 8 hours (on VS Code 1.133 or later, **Chat: Refresh Plugin Marketplaces** refreshes it). From VS Code 1.121, an installed copy updates on VS Code's daily plugin update check when extension auto-update (`extensions.autoUpdate`) is on. On any version, **Chat: Update Plugins** updates it right away.

## Using it

The agent picks a skill by its description. To call one directly, type `/kombai:work-with-kombai` or `/kombai:about-kombai` in chat.

A standalone skill with the same name replaces the plugin's in the agent's skill list, with no warning in chat: one in the workspace's `.agents/skills`, `.github/skills` or `.claude/skills`, or in `~/.agents/skills`, `~/.copilot/skills` or `~/.claude/skills`. Such copies come from `npx skills add` (the project's `.agents/skills`, or `~/.agents/skills` with `-g`) and from the Kombai desktop app's VS Code, Codex and Claude Code switches (`~/.copilot/skills`, `~/.agents/skills`, `~/.claude/skills`). They carry Codex's sandbox guidance instead of VS Code's, which matters when VS Code's terminal sandbox is on. Remove the `npx skills` copy, and turn the app's switch off rather than deleting its copy (the app writes it again at its next start); or type `/kombai:work-with-kombai`, which always loads this plugin's skill.

When VS Code's terminal sandbox is on (`chat.agent.sandbox.enabled`, or `chat.agent.sandbox.enabledWindows` on Windows; both are off by default), it blocks the network and writes outside the workspace, and the CLI needs both: it downloads from npm and writes `~/.kombai`. The skills therefore ask to run each Kombai command with `requestUnsandboxedExecution`. VS Code asks the user before running one outside the sandbox, unless the user's approval settings already approve it (an auto-approve permission level, or a matching terminal auto-approve rule). If `chat.agent.sandbox.allowUnsandboxedCommands` is off, VS Code cannot run commands outside the sandbox, and the skills ask the user to turn that setting on or the sandbox off.

The plugin registers no MCP server. VS Code shows MCP App views, but the CLI has no canvas view for VS Code yet, so `cli.view` is off in `kombai.package.json`; the repository README's "The canvas view" says how to turn it on. The skill opens the canvas in VS Code's Integrated Browser or the user's browser.

Signing in happens in a browser, and the agent shows a match code to compare. The agent opens Kombai's sign-in page in a VS Code Integrated Browser tab (VS Code asks first unless you have allowed the tool); sign in to Kombai there and approve. Tabs the agent opens don't share your own browser's sign-ins, so to use your browser instead, ask the agent for the link. Without that tab, the CLI opens the page in your browser.

Licensed under the [MIT License](LICENSE).
