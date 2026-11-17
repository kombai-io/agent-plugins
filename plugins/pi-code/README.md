# Kombai for Pi

This Pi package provides four skills: `work-with-kombai` for UI design, `about-kombai` for product questions, `generate-assets-with-kombai` for requested images or videos, and `get-started-with-kombai` for first-use sign-in and prompts. The skills run the pinned Kombai CLI (`npx -y @kombai/cli@0.2.0`), which needs Node.js 20 or later. Designs open on the hosted Kombai canvas in your browser. This package does not register an MCP server.

## Test from a local checkout

Install the package folder, using its absolute path:

```sh
pi install /absolute/path/to/agent-plugins/plugins/pi-code
pi list
```

Start a new Pi session or run `/reload` in an existing one. Ask, “Help me get started with Kombai.” Then try “Use Kombai to design a landing page for this project,” “What is Kombai?” and “Use Kombai to generate a hero image.” To explicitly load the onboarding skill, run `/skill:get-started-with-kombai`.

Pi loads the skills from the `pi.skills` entry in `package.json`. A local install refers to this folder in place, so keep it available while testing. If the skills do not appear, check `pi list` and `/config`. To remove the test package, run `pi remove /absolute/path/to/agent-plugins/plugins/pi-code`.

Sign-in happens in the browser. The CLI shows a match code to compare. Do not ask the agent to sign in or sign up on the user's behalf unless the user explicitly asks.

Licensed under the [MIT License](LICENSE).
