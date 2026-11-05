# Kombai for Antigravity

This plugin is for Google Antigravity: the Antigravity app, the `agy` CLI and the Antigravity IDE all load plugins from `~/.gemini/config/plugins/`.

Its `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.1.3 skill`) and follows what it prints: the agent designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@0.1.3 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

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

The agent picks a skill by its description. To call one directly, type `/kombai:work-with-kombai` or `/kombai:about-kombai`.

A standalone `work-with-kombai` or `about-kombai` skill does not replace this plugin's: Antigravity lists it next to `kombai:work-with-kombai` and `kombai:about-kombai`, with the same description, and it carries Codex's sandbox guidance instead of Antigravity's. Such copies come from a project's `.agents/skills` (`npx skills add`), from `~/.gemini/config/skills` (the Kombai desktop app's Antigravity switch) and, in agy, from `~/.gemini/skills` (the app's Gemini CLI switch). Remove the `npx skills` copy, and turn the app's switch off rather than deleting its copy (the app writes it again at its next start); or type `/kombai:work-with-kombai`.

Antigravity's sandbox has no network by default, and the CLI downloads from npm and writes `~/.kombai`, so the skills ask Antigravity to run each Kombai command outside the sandbox. Depending on the user's permission preset, Antigravity approves that by itself or asks the user. To approve Kombai's commands ahead of time, add the Allow rules `command(npx -y @kombai/cli@0.1.3)` and `command(kombai)` (`unsandboxed(...)` on business and enterprise accounts; on Windows, where commands run as `npx.cmd`, also `command(npx.cmd -y @kombai/cli@0.1.3)`) in Antigravity's permission settings; for agy, with `/permissions` or under `permissions.allow` in `~/.gemini/antigravity-cli/settings.json`. If Antigravity still asks for a command a rule should cover, as can happen on Windows, approve the prompt.

A headless `agy -p` run cannot ask. Unless its permission mode approves Kombai's commands by itself, it skips them and prints a notice on stderr naming the rule to add; add the rules above first.

The skill opens the canvas in the user's default browser.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Licensed under the [MIT License](LICENSE).
