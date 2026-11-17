# Kombai for OpenCode

This is an OpenCode V2 server plugin. It registers four skills: `work-with-kombai` for UI design, `about-kombai` for product questions, `generate-assets-with-kombai` for requested images or videos, and `get-started-with-kombai` for first-use sign-in and prompts. The workflow skill runs `npx -y @kombai/cli@0.2.0 skill`; the others use its `faq`, `assets` and `sign-in` topics. The CLI needs Node.js 20 or later. Each skill writes its commands as `kombai <command>` and first says how to run them: "Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.2.0`." It opens the hosted Kombai canvas in your browser. This plugin does not register an MCP server or a desktop canvas view.

## Test from a local checkout

In a project you want to test, add the absolute path to this folder to that project's `opencode.jsonc` (or to `~/.config/opencode/opencode.jsonc` for all projects):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/agent-plugins/plugins/opencode"]
}
```

OpenCode resolves relative paths from the config file, so use an absolute path when the plugin lives in another checkout. Start or restart OpenCode, then ask, “Help me get started with Kombai.” After onboarding, ask “Use Kombai to design a landing page for this project.” You can also ask “What is Kombai?” or “Use Kombai to generate a hero image.” If a skill is already installed from another source, disable that copy while testing this plugin.

OpenCode V2 loads `index.js`, which registers the packaged skills through its Skills API. It loads the `@opencode/plugin` dependency declared in `package.json`. For an install from the Git repository later, OpenCode supports npm-compatible Git subdirectory specs; the local directory is simpler for initial testing.

## Install from GitHub

After this plugin is on the repository's `main` branch, install it globally with:

```sh
opencode plugin add 'github:kombai-io/agent-plugins#main::path:plugins/opencode'
```

Run `opencode plugin list` to confirm that it is installed. Remove any local path to this plugin
from `opencode.jsonc` first, so OpenCode does not load both copies.

Sign-in happens in the browser. The CLI shows a match code to compare. Do not ask the agent to sign in or sign up on the user's behalf unless the user explicitly asks.

Licensed under the [MIT License](LICENSE).
