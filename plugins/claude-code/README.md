# Kombai for Claude Code

Install the plugin from the marketplace in this workspace:

```sh
claude plugin marketplace add /absolute/path/to/agent-plugins
claude plugin install kombai@kombai
```

The plugin's `kombai-workflow` skill runs the Kombai CLI's team build (`npx -y @kombai-io/cli@next skill`) and follows what it prints: Claude Code designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later, and npm access to `@kombai-io` on GitHub Packages.

The plugin registers no MCP server: the skill opens the canvas in the user's browser. The CLI's canvas view is off for Claude Code (`cli.view` in `kombai.package.json`) until Claude Code shows MCP App views; the repository README's "The canvas view" says how to turn it on.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
