# Kombai for Codex

This plugin's `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@latest skill`) and follows what it prints: Codex designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@latest skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

The skill requests approved execution outside Codex's sandbox before this first `npx` call
and for later Kombai CLI commands, using the execution tool's
`sandbox_permissions: "require_escalated"` setting. npm may need network access before Kombai
starts, and the CLI writes `~/.kombai`. Update the installed plugin to receive this bootstrap
guidance; updating only the CLI does not change the installed skill.

The plugin ships skills only (`cli.view` is off in `kombai.package.json`, and `requires_local_executor` is set in the manifest): OpenAI's plugin directory drops a plugin's local MCP config. Kombai's canvas view is the Kombai CLI's MCP server, `kombai` (`npx -y @kombai/cli@latest mcp`), in the user's own Codex config. The first time the `work-with-kombai` skill finds no `canvas_app` tool, it asks the user, runs `npx -y @kombai/cli@latest mcp install codex` to add that server to `config.toml` (`$CODEX_HOME`, else `~/.codex`), and continues in a new task, since a running task never picks up a new MCP server. `npx -y @kombai/cli@latest mcp uninstall codex` takes the entry out again; uninstalling the plugin leaves it in place. In the Codex desktop app the view is the only way the skill shows a canvas: never a browser or a link. Codex in a terminal gets no view; the skill opens the canvas in the browser instead.

For local development, point Codex at this package's marketplace root, then install its plugin:

```sh
codex plugin marketplace add /absolute/path/to/agent-plugins --json
codex plugin add kombai@kombai --json
```

To install a packaged build, unzip `kombai-codex-plugin-0.4.2.zip` into a directory you will keep.
The extracted root contains `.agents/plugins/marketplace.json`, which points to the bundled
`plugins/codex` directory. Register the extracted root, then install the plugin:

```sh
codex plugin marketplace add /absolute/path/to/kombai-codex-plugin-0.4.2 --json
codex plugin add kombai@kombai --json
```

Start a new Codex chat after installation. Versions through 0.3.4 packaged only the plugin
payload and cannot be registered directly as a marketplace; use a 0.3.5 or later ZIP.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare. The plugin never requests credentials in chat or stores them in MCP arguments.

The skills are [`skills/work-with-kombai/SKILL.md`](skills/work-with-kombai/SKILL.md) and [`skills/about-kombai/SKILL.md`](skills/about-kombai/SKILL.md).

Licensed under the [MIT License](LICENSE).
