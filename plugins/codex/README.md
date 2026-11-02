# Kombai for Codex

This plugin's `kombai-workflow` skill runs the Kombai CLI's team build (`npx -y @kombai-io/cli@next skill`) and follows what it prints: Codex designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later, and npm access to `@kombai-io` on GitHub Packages.

`.mcp.json` registers one server, `kombai-cli` (`npx -y @kombai-io/cli@next mcp`), which shows the hosted canvas beside the Codex desktop chat. Codex in a terminal gets no view; the skill opens the canvas in the browser instead. This is the plugin's `cli.view` in `kombai.package.json`; see the repository README's "The canvas view".

For local development, point Codex at this package's marketplace root, then install its plugin:

```sh
codex plugin marketplace add /absolute/path/to/agent-plugins --json
codex plugin add kombai@kombai --json
```

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare. The plugin never requests credentials in chat or stores them in MCP arguments.

The skill is [`skills/kombai-workflow/SKILL.md`](skills/kombai-workflow/SKILL.md).

Licensed under the [MIT License](LICENSE).
