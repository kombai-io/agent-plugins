# Kombai for Claude Code

Install the plugin from the marketplace in this workspace:

```sh
claude plugin marketplace add /absolute/path/to/agent-plugins
claude plugin install kombai@kombai
```

The plugin's `work-with-kombai` skill runs the Kombai CLI's team build (`npx -y @kombai/cli@latest skill`) and follows what it prints: Claude Code designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later, and it installs from npm as `@kombai/cli`.

`.mcp.json` registers one server, `Kombai` (`npx -y @kombai/cli@latest mcp`), for Kombai's taste card: in Claude desktop's Code tab, which shows MCP App views, a taste run's design brief appears as a card in the chat. Claude Code in a terminal shows none, so the server lists nothing there. The CLI shows Claude Code no canvas view: the skill opens the canvas in the user's browser. This is the plugin's `cli.view` in `kombai.package.json`; see the repository README's "The canvas view".

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
