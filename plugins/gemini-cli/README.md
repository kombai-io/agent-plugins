# Kombai for Gemini CLI

This folder is a Gemini CLI extension. Gemini CLI loads its skills by default (`skills.enabled`, since v0.26).

Its `work-with-kombai` skill runs the Kombai CLI (`npx -y @kombai/cli@0.1.5 skill`) and follows what it prints: the agent designs on a hosted Kombai canvas. The CLI needs Node.js 20 or later.

Its `about-kombai` skill runs `npx -y @kombai/cli@0.1.5 skill faq` and answers the user's questions about Kombai (accounts, credits, where designs and data live, updates, support) from what it prints.

Its `generate-assets-with-kombai` skill runs `npx -y @kombai/cli@0.1.5 skill assets` and follows what it prints to generate an AI image or video and get a public link to use. It runs only when the user asks Kombai for one, or for the videos a taste run left as prompts, never on its own (not for stock photos or whole-UI design).

## Install

`gemini extensions install` takes a local folder or a git repository whose root holds `gemini-extension.json`, so it cannot install this folder from the repository's GitHub URL, and it does not take a `.zip`.

Run the install from inside the extension folder. From a checkout of the repository:

```sh
cd plugins/gemini-cli
gemini extensions validate .
gemini extensions install .
gemini extensions list
```

From a Build Plugins ZIP (the plugin ZIP inside the download; see the repository README): unzipping it makes a `kombai-gemini-cli-plugin-<version>` folder (`-team` at the end for a team build). Install that folder:

```sh
cd kombai-gemini-cli-plugin-<version>
gemini extensions install .
```

Gemini CLI then asks the user to trust that folder and to confirm the install; answer `y` to both (`--consent` skips the confirmation). Run from any other folder that is not trusted yet, it also asks to trust that one (`--consent` trusts it without asking), and Gemini CLI then loads that folder's own settings, commands and skills.

Gemini CLI does not update a local install by itself. When a new version lands in the folder you installed from (after `git pull` in a checkout, say), run `gemini extensions update kombai`, or `/extensions update kombai` inside Gemini CLI; Gemini CLI sees an update only when the version in `gemini-extension.json` changes. For a ZIP unpacked to a new folder, run `gemini extensions uninstall kombai`, then install the new folder. In a checkout, `gemini extensions link ./plugins/gemini-cli` installs it as a link instead, which always reads the folder.

To install only the skills, straight from GitHub, without the extension:

```sh
gemini skills install https://github.com/kombai-io/agent-plugins --path plugins/gemini-cli/skills
```

They go to `~/.gemini/skills` (`--scope workspace` puts them in the project), and running the command again updates them. Use either this or the extension, not both: the skills in `~/.gemini/skills` take precedence over the extension's.

## Using it

In an interactive session, Gemini CLI's model activates a skill when the request matches its description, and asks the user first (in YOLO mode, `--yolo` or `--approval-mode=yolo`, it does not ask). `/skills list` shows the skills. A headless `gemini -p` run has no skill, shell or file-writing tool, so the design workflow runs there only in YOLO mode, or with a policy that allows `activate_skill`, `run_shell_command` for `echo` and `npx -y @kombai/cli@0.1.5` (the workflow skill first runs `echo "$SANDBOX"`), and `write_file` and `replace` (the agent writes each design's files). Pass the policy with `--policy <file>`, or put it in `~/.gemini/policies/`.

A skill with the same name takes precedence over the extension's: one in the project's `.agents/skills` or `.gemini/skills` (in trusted folders), or in `~/.agents/skills` or `~/.gemini/skills`. Gemini CLI warns about the conflict and names both files; the user should remove one copy. Such copies come from `npx skills add` (the project's `.agents/skills`, or `~/.agents/skills` with `-g`) and from the Kombai desktop app's Gemini CLI and Codex switches (`~/.gemini/skills`, `~/.agents/skills`). They carry Codex's sandbox guidance instead of Gemini CLI's. Turn the app's switch off rather than deleting its copy: the app writes it again at its next start.

Gemini CLI runs sandboxed when it is started with `-s`/`--sandbox`, when `GEMINI_SANDBOX` is set, or when `tools.sandbox` is set in a user, project or system `settings.json`; it then sets `$SANDBOX`. Its sandboxes block writes outside the project, which the CLI needs for `~/.kombai`, and some block the network. So before running anything, the workflow skill checks `$SANDBOX`, and if it is set, asks the user to restart Gemini CLI as `GEMINI_SANDBOX=false gemini` (without `-s`), which starts it unsandboxed whatever the settings say, or to run Kombai in their own terminal. With Gemini CLI's per-command tool sandboxing (`security.toolSandboxing`) instead, the skills pass `additional_permissions` (network access and writes to `~/.kombai` and `~/.npm`) on the first Kombai command, and Gemini CLI asks the user once; allowing it for the session covers the later commands.

The extension registers no MCP server (`cli.view` is off in `kombai.package.json`): Gemini CLI does not show MCP App views. It ships no `GEMINI.md`, so the only thing it adds to each session's prompt is its skills' names and descriptions; a skill's instructions load only when Gemini CLI activates it. The skill opens the canvas in the user's default browser.

Signing in happens in the browser: the CLI opens Kombai's sign-in page and shows a match code to compare.

Google has moved Gemini CLI's consumer users to the Antigravity CLI (`agy`). In Antigravity, install this repository's [Antigravity plugin](../antigravity/README.md) rather than bringing this extension across with `agy plugin import gemini`: an imported copy keeps Gemini CLI's sandbox instructions. If it was already imported, run `agy plugin uninstall kombai`, then install the Antigravity plugin.

Licensed under the [MIT License](LICENSE).
