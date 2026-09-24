# Kombai for Cursor

This plugin adds setup and recovery instructions for using the installed Kombai desktop app from Cursor. It does not bundle the Kombai MCP server. The app owns the user-level `kombai` MCP entry and installs the task skills when you enable Cursor in its MCP settings or run the installed app executable with `mcp install cursor`.

To try this plugin before marketplace submission, copy the `plugins/cursor` directory to `~/.cursor/plugins/local/kombai`. Keep its `.cursor-plugin/plugin.json`, `skills/`, `assets/`, and `LICENSE` together. Reload Cursor, then check Customize for the Kombai plugin and its `kombai-workflow` skill. Cursor ignores symlinks that point outside `~/.cursor/plugins/local`.

Alternatively, import the repository in Cursor Customize using **From GitHub Repository** and install the Kombai plugin. The repository's `.cursor-plugin/marketplace.json` points to `plugins/cursor`.

If Kombai Dev is requested, register the MCP with the installed Dev executable. The single user-level `kombai` entry may be replaced by another Kombai build; inspect Cursor's MCP settings or `~/.cursor/mcp.json` before testing. Reload Cursor or start a new session after registration if the tools were not available in the current session. Complete authentication in the Kombai app.

Licensed under the [MIT License](LICENSE).
