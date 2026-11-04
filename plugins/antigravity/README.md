# Kombai for Antigravity

This plugin is for Google Antigravity: the Antigravity app, the `agy` CLI and the Antigravity IDE all load plugins from `~/.gemini/config/plugins/`.

Its `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@latest skill`) and follows what it prints: the agent designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@latest skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

## Install

With the `agy` CLI, install from this folder's GitHub URL; the app picks the plugin up too:

```sh
agy plugin install https://github.com/kombai-io/agent-plugins/tree/main/plugins/antigravity
```

Use this folder's URL, never the repository's: from the repository root, `agy` installs every plugin manifest it finds, and other hosts' plugins here are also named `kombai`.

From a local checkout or an unpacked Build Plugins ZIP (the ZIP holds this folder's contents at its root):

```sh
agy plugin validate --strict ./plugins/antigravity
agy plugin install ./plugins/antigravity
agy plugin list
```

The Antigravity IDE has no plugin installer: copy this folder to `~/.gemini/config/plugins/kombai` and reload.

Antigravity's Marketplace lists only Google's own catalog, so the plugin is not in it until it is submitted there.

## Using it

The agent picks a skill by its description. To call one directly, type `/kombai:work-with-kombai` or `/kombai:about-kombai`.

The manifest is `.antigravity-plugin/plugin.json`, which Antigravity reads before a root `plugin.json`; this repository's VS Code plugin uses a root `plugin.json`.

Antigravity's sandbox has no network by default, and the CLI downloads from npm and writes `~/.kombai`, so the skills ask Antigravity to run each Kombai command outside the sandbox. Depending on the user's terminal permissions, Antigravity approves that by itself or asks the user. A headless `agy -p` run cannot ask, so there the user must allow the commands in their permissions first.

The plugin registers no MCP server (`cli.view` is off in `kombai.package.json`): Antigravity has no canvas view, and validation does not yet support Antigravity's `mcp_config.json`. The skill opens the canvas in Antigravity's browser or the user's browser.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
