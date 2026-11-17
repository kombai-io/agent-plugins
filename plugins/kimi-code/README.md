# Kombai for Kimi Code

This Kimi Code plugin ships four skills: `work-with-kombai` for UI design, `about-kombai` for product questions, `generate-assets-with-kombai` for requested images or videos, and `get-started-with-kombai` for first-use sign-in and prompts. The skills use Kombai’s CLI for the workflow, FAQ, assets, and sign-in topics. The CLI needs Node.js 20 or later and opens the hosted Kombai canvas in your browser. The plugin does not register an MCP server.

Each skill first says how to run them: "Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.2.0`."

## Test from a local checkout

Start Kimi Code, then enter:

```text
/plugins install /absolute/path/to/agent-plugins/plugins/kimi-code
/plugins reload
/plugins list
/plugins info kombai
```

Start a new session if the skills do not appear in the current one. Ask, “Help me get started with Kombai.” After onboarding, ask “Use Kombai to design a landing page for this project.” Also try “What is Kombai?” and “Use Kombai to generate a hero image.” To invoke a skill directly for debugging, Kimi Code uses `/skill:kombai:get-started-with-kombai` (and the other skill names).

Kimi Code copies a local plugin into its managed plugin directory. After changing this checkout, reinstall it to test those changes. Use this plugin directory, not the monorepo root. For a ZIP build, unzip the plugin archive and install its extracted folder.

Sign-in happens in the browser. The CLI shows a match code to compare. Do not ask the agent to sign in or sign up on the user's behalf unless the user explicitly asks.

Licensed under the [MIT License](LICENSE).
