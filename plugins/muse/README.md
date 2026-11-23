# Kombai for Muse Code

This native Muse Code plugin provides four skills: `work-with-kombai` for UI design, `about-kombai` for product questions, `generate-assets-with-kombai` for requested images or videos, and `get-started-with-kombai` for first use. They use Kombai’s CLI, which needs Node.js 20 or later. Designs open on Kombai's hosted canvas in your browser. This plugin declares no hooks, reminders, commands, or MCP servers.

Each skill first says how to run them: "Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.3.1`."

## Install from this checkout

Muse Code installs a plugin from a local folder. From the repository root, run:

```sh
muse plugins validate ./plugins/muse
muse plugins install ./plugins/muse
muse plugins list
```

Skills are active when the plugin is installed and enabled. In Muse Code, ask “Help me get started with Kombai,” then “Use Kombai to design a landing page for this project.” You can also ask “What is Kombai?” or “Use Kombai to generate a hero image.” To invoke onboarding explicitly, use `/kombai:get-started-with-kombai`.

To test a Build Plugins ZIP, unzip it and install its `kombai-muse-plugin-<version>` folder. Muse copies the plugin into its store; after changing this checkout, run `muse plugins update kombai` or reinstall it. To remove it, run `muse plugins remove kombai`.

Sign-in happens in the browser. The CLI shows a match code to compare. Do not ask the agent to sign in or sign up on the user's behalf unless the user explicitly asks.

Licensed under the [MIT License](LICENSE).
