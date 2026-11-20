# Kombai for Devin

This plugin is for Cognition's Devin CLI and Devin Desktop. Devin's marketplace
([CognitionAI/devin-marketplace](https://github.com/CognitionAI/devin-marketplace)) lists a third-party plugin as a
`git-subdir` entry pointing at its folder (here `path: plugins/devin`), pinned to one commit of this repository.

Its `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.3.0 skill`) and follows what it prints: the agent designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later. Each skill writes its commands as `kombai <command>` and first says how to run them: "Run Kombai's CLI (`kombai` below) from `node "$HOME/.kombai/cli/install/latest/launch.mjs"` if that file exists; if not, fall back to `npx -y @kombai/cli@0.3.0`."

Its `about-kombai` skill runs `npx -y @kombai/cli@0.3.0 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

Its `generate-assets-with-kombai` skill runs `npx -y @kombai/cli@0.3.0 skill assets` and follows what it prints to generate an AI image or video and get a public link to use. It runs only when the user asks Kombai for one, or for the videos a taste run left as prompts once the user asked for AI video, never on its own (not for stock photos or whole-UI design).

## Install

```sh
devin plugins install kombai-io/agent-plugins#plugins/devin
```

That adds the plugin to your personal plugins, so it follows you to every computer you sign in to Devin on. From a
checkout of the repository: `devin plugins install --local ./plugins/devin`, which stays on that computer.

The manifest sets [`"platforms": ["local"]`](https://docs.devin.ai/cli/extensibility/plugins/overview#platforms): the
plugin loads in the Devin CLI and Devin Desktop, not in cloud Devin sessions, because the CLI signs in through the
browser on the user's computer and opens the canvas there.

Installing from the Devin web app (**Customize → Plugins → Add plugin → From repository** with
`kombai-io/agent-plugins` and the subdirectory `plugins/devin`, or the Marketplace list once Kombai is in it) adds it
to your personal plugins the same way: use it from the Devin CLI or Devin Desktop, since a cloud session does not load
it.

## Using it

Devin lists the skills as `/kombai:work-with-kombai`, `/kombai:about-kombai` and
`/kombai:generate-assets-with-kombai`; the agent also picks one by its description.

## Releasing an update

Devin's marketplace pins a commit, so a change here reaches Devin users only after a PR to
CognitionAI/devin-marketplace moves the entry's `sha` to a commit that has it.

The skills carry no sandbox guidance beyond "ask for network access the way your client does". The plugin registers
no MCP server: the skill opens the canvas in the user's browser.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
