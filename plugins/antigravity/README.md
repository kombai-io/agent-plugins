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

Kombai needs network access and writes to `~/.kombai`. If approval is declined, the agent explains the restriction and stops. For a headless `agy -p` run, configure the two Allow rules before the first run. Use Antigravity's permission settings or `/permissions` in agy.

- For the npm bootstrap, add `command(regex:npx(.cmd)? -y @kombai/cli@[a-z0-9.-]+ .*)`.
- For the launcher on a POSIX shell, start from the absolute home directory of the account that will run agy. Append `.kombai/cli/install/latest/launch.mjs`, or use `beta` if that is the channel you run. For example, Sam would enter `command(node "/Users/sam/.kombai/cli/install/latest/launch.mjs")`. The path is known before the bootstrap creates the file and stays the same across updates on that channel. Substitute your own path, keep the quotes, and replace any earlier wildcard launcher rule.

Business and enterprise accounts use `unsandboxed(...)` with the same command text. In `~/.gemini/antigravity-cli/settings.json`, escape the inner double quotes as `\"` in the strings under `permissions.allow`. In native PowerShell and Command Prompt, agy requires a full command match. For headless jobs with fixed commands, approve each complete command ahead of time. If the command varies and needs approval, use an interactive session. [Antigravity permissions](https://antigravity.google/docs/agent-permissions) · [CLI v1.5.8 release notes](https://antigravity.google/releases?tab=cli&version=1.5.8)

The plugin registers no MCP server: Antigravity has no canvas view. The skill opens the canvas in the user's default browser.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
