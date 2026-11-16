# Kombai for Grok Build

This plugin is for xAI's Grok Build CLI. It is listed in xAI's official marketplace (`xai-official`,
[xai-org/plugin-marketplace](https://github.com/xai-org/plugin-marketplace)), whose catalog entry points at this
folder (`path: plugins/grok`) pinned to one commit of this repository.

Its `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.2.0 skill`) and follows what it prints: the agent designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@0.2.0 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

Its `generate-assets-with-kombai` skill runs `npx -y @kombai/cli@0.2.0 skill assets` and follows what it prints to generate an AI image or video and get a public link to use. It runs only when the user asks Kombai for one, or for the videos a taste run left as prompts once the user asked for AI video, never on its own (not for stock photos or whole-UI design).

## Install

From xAI's marketplace, once Kombai is listed there:

```sh
grok plugin install kombai@xai-official
```

Or open `/marketplace` in Grok Build and search for Kombai.

## Releasing an update

The marketplace pins a commit, so a change here reaches Grok Build users only after the catalog's `sha` moves to a
commit that has it. xAI's bot bumps listed plugins' pins daily; otherwise, open a PR to xai-org/plugin-marketplace
that changes the entry's `sha` and regenerates its index.

The skills carry no sandbox guidance beyond "ask for network access the way your client does". The plugin registers
no MCP server: the skill opens the canvas in the user's browser.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
