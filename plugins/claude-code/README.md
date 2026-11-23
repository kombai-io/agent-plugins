# Kombai for Claude Code

Install the plugin from the marketplace in this workspace:

```sh
claude plugin marketplace add /absolute/path/to/agent-plugins
claude plugin install kombai@kombai
```

The plugin's `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.3.1 skill`) and follows what it prints: Claude Code designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later. Each skill writes its commands as `kombai <command>` and first says how to run them: "Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.3.1`."

Its `about-kombai` skill runs `npx -y @kombai/cli@0.3.1 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

The plugin works only in Claude Code (the CLI, IDE extensions and the Claude desktop app's Code tab). Claude's chat (claude.ai, or the Chat tab of the Claude desktop or mobile app) has no shell on the user's computer, so every skill opens with a notice: there the agent runs nothing and tells the user that Kombai's plugin works only in Claude Code. The notice names Claude's chat rather than listing where the plugin may run, so an older VS Code install that still loads this plugin keeps working. The validator checks each skill opens with it (`CHAT_NOTICES` in `scripts/cli-view.mjs`).

After installing, run `/kombai:get-started-with-kombai`, or ask Claude to get started with Kombai. That skill checks you're signed in and lists prompts to try, each starting with `/kombai:work-with-kombai`. Claude Code has no manifest key that runs a skill after an install, so this step is yours to run.

The plugin ships no MCP server: Anthropic's plugin directory refuses a plugin with an MCP server (`cli.view` is off in `kombai.package.json`). Kombai's server, `kombai` (`npx -y @kombai/cli@0.3.1 mcp`), only adds Kombai's taste card, and only in Claude desktop's Code tab, which shows MCP App views: a taste run's design brief appears as a card in the chat. Claude Code in a terminal shows none, though once the server is in your config, every Claude Code session that reads it starts it too (it lists no tools there). `npx -y @kombai/cli@0.3.1 mcp uninstall claude-code` takes the entry out again; uninstalling the plugin leaves it in place. The CLI shows Claude Code no canvas view: the skill opens the canvas in the agent's browser panel or the user's browser. See the repository README's "The canvas view".

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
