# Kombai for VS Code

This plugin is for GitHub Copilot's agent in VS Code, which installs agent plugins (VS Code 1.110 or later; `chat.plugins.enabled` is on by default in current versions).

Its `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@latest skill`) and follows what it prints: the agent designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@latest skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

## Install

Add the marketplace, then install the plugin:

1. Run **Chat: Manage Plugin Marketplaces** and add `kombai-io/agent-plugins`, or add it to the `chat.plugins.marketplaces` setting:

   ```json
   "chat.plugins.marketplaces": ["kombai-io/agent-plugins"]
   ```

2. Search `@agentPlugins` in the Extensions view (or run **Chat: Plugins**) and install **kombai**.

**Chat: Install Plugin from Source** with `kombai-io/agent-plugins` does both in one step. To try a local checkout, give the same command the absolute path to this `plugins/vscode` directory.

VS Code reads the repository's `.github/plugin/marketplace.json`, which points to `plugins/vscode`. It reads that file before `.claude-plugin/marketplace.json`, so VS Code users get this plugin and not the Claude Code one. VS Code caches a GitHub marketplace for up to 8 hours, so a new version can take that long to appear.

## Using it

The agent picks a skill by its description. To call one directly, type `/kombai:work-with-kombai` or `/kombai:about-kombai` in chat.

When VS Code's terminal sandbox is on (`chat.agent.sandbox.enabled`), it blocks the network and writes outside the workspace, and the CLI needs both: it downloads from npm and writes `~/.kombai`. The skills therefore ask to run each Kombai command with `requestUnsandboxedExecution`, and VS Code asks the user before it runs one outside the sandbox.

The plugin registers no MCP server. VS Code shows MCP App views, but the CLI has no canvas view for VS Code yet, so `cli.view` is off in `kombai.package.json`; the repository README's "The canvas view" says how to turn it on. The skill opens the canvas in VS Code's Integrated Browser or the user's browser.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
