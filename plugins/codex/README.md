# Kombai for Codex

This plugin's `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.1.5 skill`) and follows what it prints: Codex designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@0.1.5 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

The plugin works wherever Codex runs on the user's computer: the ChatGPT desktop app (its Work chats and Codex), the Codex CLI and the IDE extension. OpenAI's directory also offers it in ChatGPT on the web, which has no shell on the user's computer, so every skill opens with a notice keyed on that shell, not on the app's name: where there is none the agent runs nothing and tells the user to ask in Codex or in a Work chat in the ChatGPT desktop app. The validator checks each skill opens with it (`CHAT_NOTICES` in `scripts/cli-view.mjs`).

The skill requests approved execution outside Codex's sandbox before this first `npx` call
and for later Kombai CLI commands, using the execution tool's
`sandbox_permissions: "require_escalated"` setting. npm may need network access before Kombai
starts, and the CLI writes `~/.kombai`. In a ChatGPT or Codex app chat with no project picked,
escalations are rejected automatically, so the skill asks for network access and write access to
`~/.kombai`, npm's cache and the folder holding Codex's `config.toml` (the CLI saves it through a
temporary file beside it) through Codex's `request_permissions` tool
instead; if that is missing or declined, it tells the user to choose "Approve for me" in the
permissions menu. Update the installed plugin to receive this bootstrap
guidance; updating only the CLI does not change the installed skill.

The plugin ships skills only (`cli.view` is off in `kombai.package.json`, and `requires_local_executor` is set in the manifest): OpenAI's plugin directory drops a plugin's local MCP config. Kombai's canvas view is the Kombai CLI's MCP server, `kombai` (`npx -y @kombai/cli@0.1.5 mcp`), in the user's own Codex config. Setting the plugin up right after installing it runs its onboarding skill, `get-started-with-kombai` (the manifest's `onboardingSkill`; Codex's Try now after an install asks for it too, through the manifest's first `defaultPrompt`), which adds that server with `npx -y @kombai/cli@0.1.5 mcp install codex`, checks the Kombai sign-in, and ends with links that each open a new chat with a Kombai prompt filled in, so the user's first design chat has the view from its first message. Codex gives a chat only the MCP servers it had when it started, so that first onboarding chat can't show the canvas. The user can run the onboarding again: in a chat that has Kombai's view it shows the CLI's starters card, prompts to try with a Try button each. If the user skipped setup, the first time the `work-with-kombai` skill finds no `canvas_app` tool, it runs, without asking, `npx -y @kombai/cli@0.1.5 mcp install codex` to add that server to `config.toml` (`$CODEX_HOME`, else `~/.codex`), and continues in a new task, since a running task never picks up a new MCP server. `npx -y @kombai/cli@0.1.5 mcp uninstall codex` takes the entry out again; uninstalling the plugin leaves it in place. In the Codex desktop app the view is the only way the skill shows a canvas: never a browser or a link. Codex in a terminal gets no view; the skill opens the canvas in the browser instead. The skills read the plugin's Codex id from their own install path (`plugins/cache/<marketplace>/kombai/…`), for the `@Kombai` mention a new chat's prompt starts with: the same ZIP installs as `kombai@openai-curated-remote` from OpenAI's directory and under its marketplace's name when added as a local marketplace.

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
