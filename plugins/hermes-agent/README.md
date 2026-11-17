# Kombai for Hermes Agent

This portable Agent Plugins v1 package provides four skills: `work-with-kombai` for UI design, `about-kombai` for product questions, `generate-assets-with-kombai` for requested images or videos, and `get-started-with-kombai` for first use. They run the pinned Kombai CLI (`npx -y @kombai/cli@0.2.0`), which needs Node.js 20 or later. Designs open on Kombai's hosted canvas in your browser. This package does not register an MCP server or add Python dependencies.

## Test from this checkout

Hermes discovers user plugins in `~/.hermes/plugins/`. Copy this folder there, validate it, then enable it:

```sh
cp -R ./plugins/hermes-agent ~/.hermes/plugins/kombai
hermes plugins validate ~/.hermes/plugins/kombai
hermes plugins enable kombai
hermes plugins list
```

Restart Hermes so its gateway loads the plugin. In a session, `skills_list` should include `kombai:work-with-kombai`, `kombai:about-kombai`, `kombai:generate-assets-with-kombai`, and `kombai:get-started-with-kombai`. Ask “Help me get started with Kombai,” then “Use Kombai to design a landing page for this project.”

After this folder reaches the repository's `main` branch, Hermes can also install the repository subdirectory directly:

```sh
hermes plugins install kombai-io/agent-plugins/plugins/hermes-agent --no-enable
hermes plugins enable kombai
```

For a reproducible install, add `--ref <full-40-character-commit-SHA>` to `hermes plugins install`. The direct Git install is disabled until enabled. To remove the plugin, run `hermes plugins remove kombai`.

Sign-in happens in the browser. The CLI shows a match code to compare. Do not ask the agent to sign in or sign up on the user's behalf unless the user explicitly asks.

Licensed under the [MIT License](LICENSE).
