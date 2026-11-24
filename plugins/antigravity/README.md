# Kombai for Antigravity

This plugin is for Google Antigravity: the Antigravity app, the `agy` CLI and the Antigravity IDE all load plugins from `~/.gemini/config/plugins/`.

Its `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.3.1 skill`) and follows what it prints: the agent designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later. Each skill writes its commands as `kombai <command>` and first says how to run them: "Run Kombai's CLI (`kombai` below) as `npx -y @kombai/cli@0.3.1`."

Its `about-kombai` skill runs `npx -y @kombai/cli@0.3.1 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

Its `generate-assets-with-kombai` skill runs `npx -y @kombai/cli@0.3.1 skill assets` and follows what it prints to generate an AI image or video and get a public link to use. It runs only when the user asks Kombai for one, or for the videos a taste run left as prompts once the user asked for AI video, never on its own (not for stock photos or whole-UI design).

## Install

With the `agy` CLI, install from this folder's GitHub URL; the app picks the plugin up too:

```sh
agy plugin install https://github.com/kombai-io/agent-plugins/tree/main/plugins/antigravity
```

Use this folder's URL, never the repository's: from the repository root, `agy` installs every plugin manifest it finds, and other hosts' plugins there are also named `kombai`.

From a checkout of the repository:

```sh
agy plugin validate --strict ./plugins/antigravity
agy plugin install ./plugins/antigravity
agy plugin list
```

From a Build Plugins ZIP (the plugin ZIP inside the download; see the repository README): unzipping it makes a `kombai-antigravity-plugin-<version>` folder (`-team` at the end for a team build). Install that folder:

```sh
agy plugin validate --strict ./kombai-antigravity-plugin-<version>
agy plugin install ./kombai-antigravity-plugin-<version>
```

The Antigravity IDE has no plugin installer: copy this folder to `~/.gemini/config/plugins/kombai` and reload.

Brought the Kombai Gemini CLI extension across with `agy plugin import gemini` (or agy's first-launch import)? That copy keeps Gemini CLI's sandbox instructions and takes the `kombai` name. Run `agy plugin uninstall kombai`, then install this plugin.

## Using it

The agent picks a skill by its description. To call one directly, type `/kombai:work-with-kombai`, `/kombai:about-kombai` or `/kombai:generate-assets-with-kombai`.

A standalone Kombai skill of the same name does not replace this plugin's: Antigravity lists it next to the plugin's `kombai:<skill>` entry (for example `kombai:work-with-kombai`), with the same description, and it carries Codex's sandbox guidance instead of Antigravity's. Such copies come from a project's `.agents/skills` (`npx skills add`), from `~/.gemini/config/skills` (the Kombai desktop app's Antigravity switch) and, in agy, from `~/.gemini/skills` (the app's Gemini CLI switch). Remove the `npx skills` copy, and turn the app's switch off rather than deleting its copy (the app writes it again at its next start); or type `/kombai:work-with-kombai` (or the plugin's other skill names).

The skills request permission to run each Kombai command outside Antigravity's sandbox because the CLI uses the network and writes `~/.kombai`. In an interactive session you can approve each request. A headless `agy -p` session cannot prompt. To configure it, open Antigravity's permission settings, or use `/permissions` in agy.

- For the initial npm bootstrap, add `command(regex:npx(.cmd)? -y @kombai/cli@[a-z0-9.-]+ .*)`. This covers CLI version changes and Windows' `npx.cmd`.
- When the CLI prints a Node command, verify the absolute launcher path against the file installed under your home directory at `.kombai/cli/install/latest/launch.mjs` (or `beta/launch.mjs` for a beta). Use that exact path in a literal rule. For example, a macOS user might enter `command(node "/Users/sam/.kombai/cli/install/latest/launch.mjs")`, and a Windows user might enter `command(node "C:/Users/Sam Lee/.kombai/cli/install/latest/launch.mjs")`. Keep the quotes, including around paths with spaces. Remove any earlier Node rule with a wildcard launcher path when you replace it.

Business and enterprise accounts use `unsandboxed(...)` with the same command text. If you enter rules directly under `permissions.allow` in `~/.gemini/antigravity-cli/settings.json`, escape the inner double quotes as `\"`. If you cannot verify the path, or your Windows shell still prompts, use an interactive session and approve each command individually. [Antigravity permissions](https://antigravity.google/docs/agent-permissions)

The plugin registers no MCP server: Antigravity has no canvas view. The skill opens the canvas in the user's default browser.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
