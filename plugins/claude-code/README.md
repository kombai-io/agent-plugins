# Kombai for Claude Code

Install the plugin from the marketplace in this workspace:

```sh
claude plugin marketplace add /absolute/path/to/agent-plugins
claude plugin install kombai@kombai
```

The plugin's `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@latest skill`) and follows what it prints: Claude Code designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@latest skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

The plugin ships no MCP server: Anthropic's plugin directory refuses a plugin with a local one (`cli.view` is off in `kombai.package.json`). Kombai's server, `kombai` (`npx -y @kombai/cli@latest mcp`), only adds Kombai's taste card, and only in Claude desktop's Code tab, which shows MCP App views: a taste run's design brief appears as a card in the chat. There the CLI's skill text has the agent run `npx -y @kombai/cli@latest mcp install claude-code` when the card's tool is missing, which adds the server to the user's own Claude Code config; new sessions get the card. Claude Code in a terminal shows none, so nothing adds it there. The CLI shows Claude Code no canvas view: the skill opens the canvas in the agent's browser panel or the user's browser. See the repository README's "The canvas view".

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
