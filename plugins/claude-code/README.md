# Kombai for Claude Code

Install the plugin from the marketplace in this workspace:

```sh
claude plugin marketplace add /absolute/path/to/agent-plugins
claude plugin install kombai@kombai
```

The plugin's `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@latest skill`) and follows what it prints: Claude Code designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@latest skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

After installing, run `/kombai:get-started-with-kombai`, or ask Claude to get started with Kombai. That skill sets up Kombai's MCP server in your Claude Code config, checks you're signed in, and lists prompts to try. Start your first design in a new session: Claude Code gives a session only the MCP servers it had when it started, so a new one has Kombai's taste card from its first message. Claude Code has no manifest key that runs a skill after an install, so this step is yours to run.

The plugin ships no MCP server: Anthropic's plugin directory refuses a plugin with a local one (`cli.view` is off in `kombai.package.json`). Kombai's server, `kombai` (`npx -y @kombai/cli@latest mcp`), only adds Kombai's taste card, and only in Claude desktop's Code tab, which shows MCP App views: a taste run's design brief appears as a card in the chat. The get-started skill adds it with `npx -y @kombai/cli@latest mcp install claude-code`, and if you skipped that, the CLI's skill text has the agent run the same command in the Claude desktop app when the card's tool is missing; new sessions get the card. Claude Code in a terminal shows none, though once the server is in your config, every Claude Code session that reads it starts it too (it lists no tools there). `npx -y @kombai/cli@latest mcp uninstall claude-code` takes the entry out again; uninstalling the plugin leaves it in place. The CLI shows Claude Code no canvas view: the skill opens the canvas in the agent's browser panel or the user's browser. See the repository README's "The canvas view".

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
