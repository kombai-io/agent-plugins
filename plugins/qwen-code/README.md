# Kombai for Qwen Code

This native Qwen Code extension provides four skills: `work-with-kombai` for UI design, `about-kombai` for product questions, `generate-assets-with-kombai` for requested images or videos, and `get-started-with-kombai` for first use. They use Kombai’s CLI, which needs Node.js 20 or later. Designs open on Kombai's hosted canvas in your browser. This extension does not register an MCP server.

Each skill first says how to run them: "Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.3.0`."

## Install from this checkout

Qwen Code accepts a local extension folder or ZIP. From the repository root, run:

```sh
qwen extensions install ./plugins/qwen-code
qwen extensions list
```

Start a new Qwen Code session, or use `/extensions install` inside a running session to hot-reload. `/skills` should show all four Kombai skills, namespaced under `kombai`. Ask “Help me get started with Kombai,” then “Use Kombai to design a landing page for this project.” You can also ask “What is Kombai?” or “Use Kombai to generate a hero image.” To invoke onboarding explicitly, use `/kombai:get-started-with-kombai`.

The Build Plugins workflow can make a ZIP with this extension as its single top-level folder. Install that ZIP with `qwen extensions install /absolute/path/to/kombai-qwen-code-plugin-<version>.zip`. Qwen copies local installs; after changing this checkout, run `qwen extensions update kombai` or reinstall it. To remove it, run `qwen extensions uninstall kombai`.

Sign-in happens in the browser. The CLI shows a match code to compare. Do not ask the agent to sign in or sign up on the user's behalf unless the user explicitly asks.

Licensed under the [MIT License](LICENSE).
