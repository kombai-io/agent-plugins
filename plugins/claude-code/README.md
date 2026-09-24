# Kombai for Claude Code

Install the plugin from the marketplace in this workspace:

```sh
claude plugin marketplace add /absolute/path/to/agent-plugins
claude plugin install kombai@kombai
```

The plugin provides setup and recovery instructions. It does not include the Kombai MCP server. Install the Kombai desktop app and run its executable with `mcp install claude-code`, or enable Claude Code in the app's MCP settings. The app writes the user-level `kombai` MCP entry and installs its eight task skills. Verify registration with `claude mcp get kombai`; start a new Claude Code session if the tools do not appear in the current one.

For Kombai Dev, use the installed Dev executable. The user-level MCP entry can point to only one Kombai build at a time, so repeat registration when switching builds.

Authentication is completed in the Kombai app.

Licensed under the [MIT License](LICENSE).
