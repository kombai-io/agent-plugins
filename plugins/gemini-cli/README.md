# Kombai for Gemini CLI

This folder is a Gemini CLI extension. Gemini CLI loads its skills by default (`skills.enabled`, since v0.26).

Its `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@latest skill`) and follows what it prints: the agent designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@latest skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

## Install

Gemini CLI installs an extension only from a folder, repository or archive whose root holds `gemini-extension.json`, so it cannot install this folder from the repository's GitHub URL. Install it from a local checkout or an unpacked Build Plugins ZIP (the ZIP holds this folder's contents at its root):

```sh
gemini extensions validate ./plugins/gemini-cli
gemini extensions install ./plugins/gemini-cli
gemini extensions list
```

Installing from a local folder first asks the user to trust that folder; answer `y`.

`gemini extensions link ./plugins/gemini-cli` installs it as a link, for development. A local install does not update itself: uninstall and install the new version.

## Using it

Gemini CLI's model activates a skill when the request matches its description, and asks the user before it does. `/skills list` shows both skills.

A skill with the same name in `~/.agents/skills` or `~/.gemini/skills` (from `npx skills add`, say) takes precedence over the extension's: Gemini CLI warns about the conflict, and the user should remove one copy.

Gemini CLI runs unsandboxed unless started with `-s` or `GEMINI_SANDBOX`. Its sandboxes block writes outside the project, which the CLI needs for `~/.kombai`, and some block the network. The skills tell the agent to stop and ask the user to restart Gemini CLI without the sandbox, or to run the command in their own terminal, rather than retry.

The extension registers no MCP server (`cli.view` is off in `kombai.package.json`): Gemini CLI does not show MCP App views, and validation does not yet support Gemini CLI's `mcpServers`. It ships no `GEMINI.md`, so it adds nothing to every session's context. The skill opens the canvas in the user's browser.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Google has moved Gemini CLI's consumer users to the Antigravity CLI (`agy`); see this repository's Antigravity plugin. `agy plugin import gemini` brings an installed Gemini CLI extension across.

Licensed under the [MIT License](LICENSE).
