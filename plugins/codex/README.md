# Kombai for Codex

This plugin's `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.2.0 skill`) and follows what it prints: Codex designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later. Each skill writes its commands as `kombai <command>` and first says how to run them: "Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.2.0`."

Its `about-kombai` skill runs `npx -y @kombai/cli@0.2.0 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

Its `generate-assets-with-kombai` skill runs `npx -y @kombai/cli@0.2.0 skill assets` and follows what it prints to generate an AI image or video and get a public link to use. It runs only when the user asks Kombai for one, or for the videos a taste run left as prompts once the user asked for AI video, never on its own (not for stock photos or whole-UI design).

The plugin works only in Codex: Codex in the ChatGPT desktop app, the Codex CLI and the IDE extension. OpenAI's directory also offers it in ChatGPT's Chat and Work (chatgpt.com, and the Chat and Work tabs of the ChatGPT desktop app), where it can't run: Chat has no shell on the user's computer, and Work's sandbox refuses Kombai's commands (its "Approve for me" hands each request to an AI reviewer, which has refused every Kombai command seen, and a workspace's policy may block them outright). So every skill opens with a notice, as the Claude Code plugin's do for Claude's chat: there the agent runs nothing and tells the user Kombai's plugin works only in Codex. The validator checks each skill opens with it (`CHAT_NOTICES` in `scripts/cli-view.mjs`).

The skills run every Kombai CLI command outside Codex's sandbox from the first one, using the execution tool's
`sandbox_permissions: "require_escalated"` setting: npm may need network access before Kombai starts, and the CLI
writes `~/.kombai`, npm's cache and, for `mcp install codex`, Codex's config folder. Where the chat can't escalate,
or the user declines, the skill runs nothing and tells the user Kombai needs to run outside the sandbox, which they
can allow when Codex asks. Update the installed plugin to receive this guidance; updating only the CLI does not
change the installed skill.

The plugin ships skills only (`cli.view` is off in `kombai.package.json`, and `requires_local_executor` is set in the manifest): OpenAI's plugin directory drops a plugin's local MCP config. Kombai's canvas view is the Kombai CLI's MCP server, `kombai` (`npx -y @kombai/cli@0.2.0 mcp`), in the user's own Codex config. Setting the plugin up right after installing it runs its onboarding skill, `get-started-with-kombai` (the manifest's `onboardingSkill`; Codex's Try now after an install asks for it too, through the manifest's first `defaultPrompt`), which adds that server with `npx -y @kombai/cli@0.2.0 mcp install codex`, checks the Kombai sign-in, and ends with links that each open a new chat with a Kombai prompt filled in, so the user's first design chat has the view from its first message. Codex gives a chat only the MCP servers it had when it started, so that first onboarding chat can't show the canvas. The user can run the onboarding again: in a chat that has Kombai's view it shows the CLI's starters card, prompts to try with a Try button each. If the user skipped setup, the first time the `work-with-kombai` skill finds no `canvas_app` tool, it runs, without asking, `npx -y @kombai/cli@0.2.0 mcp install codex` to add that server to `config.toml` (`$CODEX_HOME`, else `~/.codex`), and continues in a new task, since a running task never picks up a new MCP server. `npx -y @kombai/cli@0.2.0 mcp uninstall codex` takes the entry out again; uninstalling the plugin leaves it in place. In the Codex desktop app the view is the only way the skill shows a canvas: never a browser or a link. Codex in a terminal gets no view; the skill opens the canvas in the browser instead. The skills read the plugin's Codex id from their own install path (`plugins/cache/<marketplace>/kombai/…`), for the `@Kombai` mention a new chat's prompt starts with: the same ZIP installs as `kombai@openai-curated-remote` from OpenAI's directory and under its marketplace's name when added as a local marketplace.

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

The skills are [`skills/work-with-kombai/SKILL.md`](skills/work-with-kombai/SKILL.md), [`skills/about-kombai/SKILL.md`](skills/about-kombai/SKILL.md) and [`skills/generate-assets-with-kombai/SKILL.md`](skills/generate-assets-with-kombai/SKILL.md).

Licensed under the [MIT License](LICENSE).
