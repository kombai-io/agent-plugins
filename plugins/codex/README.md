# Kombai for Codex

This plugin teaches Codex to hand UI design and implementation work to the installed Kombai desktop app. It supplies a workflow skill and visual assets. The app independently owns the local `kombai` MCP server; this payload contains no MCP executable, `.mcp.json`, or fixed localhost address.

Kombai must be installed and its MCP registered with Codex. You can turn on Codex in Kombai's MCP settings, or run `mcp install codex` through the **installed Kombai app executable**. The command requires a packaged Kombai build that includes this operation; it writes the Codex entry and the app's existing client skills. Check the result with `codex mcp get kombai --json`. If Codex cannot see newly registered tools in its current task, start a new Codex task.

For local development, point Codex at this package's marketplace root, then install its plugin:

```sh
codex plugin marketplace add /absolute/path/to/agent-plugins --json
codex plugin add kombai@kombai --json
```

This installs the plugin payload only. Register the MCP from the installed Kombai app or its settings.

To rehearse the user journey, install this plugin **before** installing Kombai Dev. Ask Codex to
use Kombai Dev for a task. It should explain that the requested app build is missing, without
offering the production download as a substitute. Install and sign in to your Dev build, then
tell Codex to continue. The workflow skill should locate that installed build, register its
MCP with Codex, verify the entry, and direct you to start a new Codex task for the tools.

For a direct registration diagnostic, `mcp install codex` must run through the installed
**Kombai Dev** executable, not the production app. On macOS, find the executable name in that app's
`Contents/Info.plist` and run the binary under `Contents/MacOS/`. Then inspect
`codex mcp get kombai --json`: its command and gateway paths should point into the Dev
installation, and its registration argument should name that build's launch record.
Start a new Codex task after registration so it loads the changed MCP entry.

The app's launch record is separate for each build identity, including Dev and variants.
Codex currently has one user-level MCP key, `kombai`, shared by those builds. Registering
another installed build replaces that key, and an opted-in app can refresh it at startup.
Re-run the desired build's install command before testing if the entry points elsewhere.

Sign in inside the Kombai app before starting work. The plugin never requests credentials in chat or stores them in MCP arguments.

The skill is [`skills/kombai-workflow/SKILL.md`](skills/kombai-workflow/SKILL.md). It complements the task-specific Kombai skills installed by the app, such as `design-with-kombai` and `code-with-kombai`.

Licensed under the [MIT License](LICENSE).
