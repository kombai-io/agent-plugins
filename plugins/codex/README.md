# Kombai for Codex

This plugin's `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.1.3 skill`) and follows what it prints: Codex designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@0.1.3 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

The skill requests approved execution outside Codex's sandbox before this first `npx` call
and for later Kombai CLI commands, using the execution tool's
`sandbox_permissions: "require_escalated"` setting. npm may need network access before Kombai
starts, and the CLI writes `~/.kombai`. Update the installed plugin to receive this bootstrap
guidance; updating only the CLI does not change the installed skill.

In Codex desktop, the plugin can show a hosted Kombai canvas beside the chat. The `work-with-kombai` skill opens that view after creating a canvas. In Codex terminal sessions, it opens the canvas in a browser.

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

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare. The plugin never requests credentials in chat or passes them to Kombai tools.

The skills are [`skills/work-with-kombai/SKILL.md`](skills/work-with-kombai/SKILL.md) and [`skills/about-kombai/SKILL.md`](skills/about-kombai/SKILL.md).

Licensed under the [MIT License](LICENSE).
