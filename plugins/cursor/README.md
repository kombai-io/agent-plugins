# Kombai for Cursor

This plugin's `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.1.4 skill`) and follows what it prints: Cursor designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@0.1.4 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

The plugin registers no MCP server: the skill opens the canvas in Cursor's browser panel or the user's browser. The CLI's canvas view is off for Cursor (`cli.view` in `kombai.package.json`) until Cursor shows MCP App views; the repository README's "The canvas view" says how to turn it on.

To try this plugin before marketplace submission, copy the `plugins/cursor` directory to `~/.cursor/plugins/local/kombai`. Keep its `.cursor-plugin/plugin.json`, `skills/`, `assets/`, and `LICENSE` together. Reload Cursor, then check Customize for the Kombai plugin and its `work-with-kombai` skill. Cursor ignores symlinks that point outside `~/.cursor/plugins/local`.

Alternatively, import the repository in Cursor Customize using **From GitHub Repository** and install the Kombai plugin. The repository's `.cursor-plugin/marketplace.json` points to `plugins/cursor`.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
