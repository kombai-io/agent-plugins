# Kombai agent plugins

This standalone repository contains the [Codex](plugins/codex/README.md),
[Claude Code](plugins/claude-code/README.md), [Cursor](plugins/cursor/README.md),
[VS Code](plugins/vscode/README.md) and [Antigravity](plugins/antigravity/README.md) plugins, the
[Gemini CLI](plugins/gemini-cli/README.md) extension, their marketplaces where the host has one,
and release tooling.

Each plugin's `work-with-kombai` skill runs the Kombai CLI
(`npx -y @kombai/cli@0.1.5 skill`), which prints the full instructions for designing on a hosted
Kombai canvas. The CLI needs Node.js 20 or later.

A second skill, `about-kombai`, runs `npx -y @kombai/cli@0.1.5 skill faq` and answers the user's
questions about Kombai from what it prints: accounts and guest mode, credits, where designs and data
live, sharing, updates and support.

A third skill, `generate-assets-with-kombai`, runs `npx -y @kombai/cli@0.1.5 skill assets` and follows
what it prints: generating an AI image or video for a design or the repo, and getting a public link
to it. It runs only when the user asks Kombai for an image or video (names Kombai or picks the skill), or
for the videos a taste run left as prompts; never on its own, and a plain image request stays with the
host's own image tool. It is not for stock photos or for designing a whole UI (that is `work-with-kombai`'s).

**Release order:** this skill runs `kombai skill assets`, which a CLI has only from the release that ships
vscode-assistant PR #4095. The skills' pinned CLI version must point at such a release
(`pnpm run set-cli-version <version>`) before this skill reaches `main`: GitHub-sourced installs
(`npx skills add ...`, `gemini skills install ...`, `agy plugin install ...`) read `main` directly.

The Codex and Claude Code plugins have a fourth, `get-started-with-kombai`, their onboarding: it sets
up Kombai's MCP server in the user's own config before the first design chat, checks the sign-in,
and ends with prompts to try (see [The canvas view](#the-canvas-view)).

The Codex plugin needs Codex on the user's computer, and the Claude Code plugin needs Claude Code. ChatGPT on the web
and Claude's chat can offer the same plugins but have no shell on the user's computer, so every skill of those two
plugins opens with a notice: where the chat has no such shell the agent runs nothing and says where to ask instead
(`CHAT_NOTICES` in `scripts/cli-view.mjs`; their validators check it). The Codex notice is keyed on the shell, not on
the app's name: the ChatGPT desktop app runs Codex on the user's computer (its Work chats and Codex), so Kombai works
there even though the app's own prompts say "ChatGPT".

When running in Codex's sandbox, the Codex plugin and standalone skill request approved
execution outside it before the first `npx` call and for later CLI commands, using the execution
tool's `sandbox_permissions: "require_escalated"` setting. npm may need network access before
Kombai starts, and the CLI writes `~/.kombai` (and npm its configured cache, resolved with
`npm config get cache` from the workspace root when in an npm workspace). Where the chat cannot
approve escalations but offers Codex's `request_permissions` tool, the skills ask for network
access and those write paths through it instead: the ChatGPT and Codex apps give a chat with no
project picked that tool and reject every escalation automatically, even when its permissions menu
reads "Ask for approval". The grant can end with the turn (in ChatGPT mode the card offers only
"Allow once"; Codex mode also offers "Allow this conversation"), so before a reply's first Kombai
command or design-file write the agent runs `node -p "'network_off='+(process.env.CODEX_SANDBOX_NETWORK_DISABLED||0)"` and
asks again only when it prints `network_off=1`. Empty output alone does not trigger a retry: the agent polls a
running execution session, checks the network the same way when a command exits with no output, and retries only
a confirmed sandbox denial before a write was sent; for an unknown write outcome, it checks state first. When a later reply in such a chat has to ask again, it shows Kombai's `access_card`
where it is available (the CLI's card: Approve for me, a project, or Codex mode stops the
per-message prompt; only the `blocked` card has a Continue button, since the request is done
by then); no line of text asks it to relay that tip, which agents
ignored in testing. If neither
route works, the skills run nothing and show that card with reason `blocked`, or tell the user to
choose "Approve for me" in that menu. Existing Codex installations need the updated
plugin or standalone skill to receive this guidance; upgrading only the CLI does not replace
the bootstrap skill.

Codex setup resolves `config.toml` under `$CODEX_HOME` (else `~/.codex`) and follows a config symlink to its
target. It requests the target's directory because the CLI saves through a temporary sibling and rename.
The same grant is required for standalone setup and existing-view upgrades; skills request any missing
write access before later commands need it.

The skills differ between hosts in that sandbox guidance (the paragraphs before the line that runs
`npx`, and the "The network is blocked" bullet); the Codex workflow skill also has its own
description and a paragraph on showing the canvas beside the chat. `scripts/skills.test.mjs`
checks that every copy shares the rest of the standalone skill's text, that each carries its own
host's guidance before the first command and no other host's, and that the Claude Code and Cursor
copies have no guidance beyond the generic bullet. The standalone skill runs in any agent, so its
Codex guidance sits in `codex-access.md` beside each `SKILL.md`, which only points at it ("when
running in Codex's sandbox, first read …"); every other agent skips it. The test checks that file
matches the Codex plugin's inline guidance and that `SKILL.md` holds none of it. The VS Code, Antigravity and Gemini CLI
validators check their host's guidance too:

| Host | What the skill says about the sandbox |
| --- | --- |
| Codex (and the standalone skill, in its `codex-access.md`) | request `sandbox_permissions: "require_escalated"` before the first command, or, where escalations are off, network and write access through `request_permissions` |
| VS Code | set `requestUnsandboxedExecution: true` (never `requestAllowNetwork`) on the terminal tool call when VS Code's terminal sandbox is on |
| Antigravity | request to run outside Antigravity's sandbox from the first try; a headless `agy -p` run needs `command(...)` allow rules unless its permission mode approves the commands |
| Gemini CLI | the workflow skill checks `$SANDBOX` before the first command and, if it is set, asks the user to restart without the sandbox; the FAQ skill does the same after a command fails. With tool sandboxing, both pass `additional_permissions` on the first command |
| Claude Code, Cursor | nothing beyond "ask for network access the way your client does" |

The only MCP server a plugin may register is the CLI's canvas view (`kombai`), and only with
`cli.view` on, which no plugin has today. The Codex plugin's skill adds it to the user's own Codex
config instead (`kombai mcp install codex`), and in the Claude desktop app the CLI's own skill text
adds it to the user's own Claude Code config (`kombai mcp install claude-code`); see
[The canvas view](#the-canvas-view). This repository supplies the workflow skill and plugin
packaging; it builds neither the CLI nor the desktop app.

The Codex marketplace is [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json).
The Claude Code marketplace is [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).
The Cursor marketplace is [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json).
The VS Code marketplace is [`.github/plugin/marketplace.json`](.github/plugin/marketplace.json).
Codex and Claude Code use the plugin selector `kombai@kombai`; Cursor uses its Customize plugin UI;
VS Code installs from **Chat: Install Plugin from Source** or the Extensions view's `@agentPlugins`.

VS Code reads a repository's first marketplace file in the order `marketplace.json`,
`.plugin/marketplace.json`, `.github/plugin/marketplace.json`, `.claude-plugin/marketplace.json`,
so new installs use the VS Code marketplace, not the Claude Code one; the VS Code validator fails
if a file earlier in that order appears. GitHub Copilot CLI checks the same files in the same
order, so `copilot plugin install kombai@kombai` from this marketplace installs `plugins/vscode`
too. A VS Code install made before the VS Code plugin existed keeps loading `plugins/claude-code`
after updates; the [VS Code README](plugins/vscode/README.md) says how to move it over.

Antigravity and Gemini CLI have no marketplace a repository can host. Antigravity's only
marketplace is Google's curated catalog (`antigravity-plugins-official`) of Google and partner
plugins, which lists Kombai only once Google accepts it; until then Antigravity installs from the
plugin folder's GitHub URL (`agy plugin install https://github.com/kombai-io/agent-plugins/tree/main/plugins/antigravity`).
Gemini CLI installs an extension from a folder or a git repository whose root holds
`gemini-extension.json`, and not from a `.zip`, so it installs `plugins/gemini-cli` from a checkout
or the folder in an unzipped Build Plugins ZIP; `gemini skills install
https://github.com/kombai-io/agent-plugins --path plugins/gemini-cli/skills` installs just its
skills straight from GitHub.

## Install with the skills CLI

For a platform-independent workflow skill, use Vercel's `skills` CLI:

```sh
npx skills add kombai-io/agent-plugins --skill work-with-kombai
npx skills add kombai-io/agent-plugins --skill about-kombai
npx skills add kombai-io/agent-plugins --skill generate-assets-with-kombai
```

The CLI discovers [`skills/work-with-kombai/SKILL.md`](skills/work-with-kombai/SKILL.md),
[`skills/about-kombai/SKILL.md`](skills/about-kombai/SKILL.md) and
[`skills/generate-assets-with-kombai/SKILL.md`](skills/generate-assets-with-kombai/SKILL.md) before the same-named skills inside the host plugins. It calls the same CLI and works in any
agent that can run `npx`; its Codex permission guidance is in `codex-access.md` beside each
`SKILL.md`, which only an agent in Codex's sandbox reads (`npx skills add` installs it with the skill).
It registers no MCP server, so the agent opens the
canvas in its own browser panel or the user's browser rather than in a view beside the chat.
The existing plugin marketplaces and packages continue to use their host-specific skills under
`plugins/`, but in VS Code and Gemini CLI a standalone copy with the same name replaces the
plugin's skill, and in Antigravity it sits beside it; each of those plugin READMEs says where such
copies come from.

## The canvas view

`kombai mcp` serves a view of the live hosted canvas beside the agent's chat, and Kombai's cards
in it (a taste run's design brief, and the plans when taste is out of credits), as MCP Apps
(server `kombai`, run as `npx -y <cli.package> mcp`). A host shows them only if it renders
MCP App views, and the CLI decides what each host is listed (`VIEW_HOSTS` and `cardsFor` in
vscode-assistant's `packages/cli/src/mcp/client-gate.js`): Codex desktop gets the view and both
cards, and Claude desktop's Code tab the taste card. Every plugin has `cli.view` off. Anthropic's
plugin directory refuses a plugin that ships a local (stdio) MCP server, so the Claude Code plugin
(from 0.5.0) ships skills only, and its validator keeps it that way: no `.mcp.json` and no manifest
`mcpServers`. Its skill is the same stub over `npx -y <cli.package> skill` as before; in the Claude
desktop app that text tells the agent to run `npx -y <cli.package> mcp install claude-code` once a
session, without asking, when no `taste_card` tool is there, which writes the server into the user's
own Claude Code config (`.claude.json`'s `mcpServers`, as `claude mcp add --scope user` does). A
running Claude Code session never picks up a new MCP server, so the card shows from the next session
while the work carries on in this one. So that the user's first design chat has the card, the Claude
Code plugin has the same onboarding skill as Codex, `get-started-with-kombai`, which runs that install
before any design chat. Claude Code has no manifest key that runs a skill after an install, so the
user runs it (`/kombai:get-started-with-kombai`, or asking Claude to get started with Kombai), as the
plugin's README says; it ends with the same three prompts as Codex's, each in a code block (Claude
shows a Copy button) that starts with `/kombai:work-with-kombai`, since Claude's chat opens no link
to a new session. The CLI answers `claudeDesktop: false` in a terminal, which shows no card; once the
server is in the user's config, terminal sessions start it too and get no tools from it, as they did
with 0.4.x's `.mcp.json`. `mcp uninstall claude-code` takes it out; uninstalling the plugin leaves it
in place. OpenAI's plugin directory drops a plugin's local MCP config, so the Codex
plugin ships skills only (with `requires_local_executor` set), and the first time its skill finds no
`canvas_app` it runs `npx -y <cli.package> mcp install codex` without asking, which writes the
same server into the user's `config.toml`. A running Codex task never picks up a new MCP server, so
the view appears from the next task. To make that the user's first design chat, the Codex plugin's
onboarding skill (`get-started-with-kombai`, the manifest's `onboardingSkill`, which Codex runs when the user
sets the plugin up after installing it, and which its Try now and the user can run again) runs the same install before any design
chat starts. Where the chat already has Kombai's view, it shows the CLI's starters card instead: prompts to try, each
with a Try that opens a new chat. Validation checks each plugin against its contract: `.mcp.json` ships exactly when
`cli.view` is on, with exactly the CLI server in it (`scripts/cli-view.mjs`).

VS Code already shows MCP App views: it declares `io.modelcontextprotocol/ui` and sends its
product name as `clientInfo.name` ("Visual Studio Code" on Stable, "Visual Studio Code - Insiders"
on Insiders), and the CLI matches that name exactly, so a VS Code row must cover both. It needs
only the CLI side and `cli.view`: VS Code reads the plugin's `.mcp.json` by default, and the VS
Code validator forbids a manifest `mcpServers` key, which would replace that file. Antigravity
reads a plugin's MCP servers from `mcp_config.json` and Gemini CLI from `gemini-extension.json`'s
`mcpServers`, which validation does not know yet; their validators require `cli.view` off until
it does. The repository ships other hosts' manifests, and the VS Code plugin's is a root
`plugin.json`, so the Antigravity plugin keeps its manifest in `.antigravity-plugin/plugin.json`,
which Antigravity reads before a root `plugin.json`.

### Adding a host to the canvas view

When another host (Cursor, VS Code, …) can show MCP App views:

1. Set `cli.view` to `true` in that plugin's `kombai.package.json`.
2. Add the plugin's `.mcp.json`; validation gives its exact content (`cliViewMcpConfig`). Check
   the host's plugin format first: Codex also points its manifest's `mcpServers` at the file,
   and validation knows only `.mcp.json`, so a host that reads another file needs
   `scripts/cli-view.mjs` taught its format. For Antigravity (`mcp_config.json`) and Gemini CLI
   (`gemini-extension.json`'s `mcpServers`), teach `checkCliContract` the file, then lift the
   `cli.view` guard in `scripts/antigravity-plugin.mjs` or `scripts/gemini-cli-plugin.mjs` and
   allow that file or key there.
3. Bump that plugin's version and release it.

Claude Code's and Codex's plugins stay skills-only, as their directories require: the CLI writes
the server into the host's own config (`kombai mcp install <host>`), so giving either one more is a
CLI-side change only.

The CLI, the hosted canvas page and the backend each need a change for the new host too;
vscode-assistant's `agent-docs/peripheral-packages/cli.md` lists them under "Adding a host to
the view". The two sides can ship in either order: until the CLI has a row for the host, the
registered server lists no tools.

## Local development

Use Node.js 22 (see `.nvmrc`) and pnpm 10.15.1. Packaging and the release tests also need
`zip` and `unzip` on PATH; CI runs on Ubuntu. These scripts have no npm dependencies and
do not require the desktop app source checkout or a dependency install.

From this repository root:

```sh
pnpm test
pnpm run check
pnpm run pack:codex ./dist
pnpm run pack:claude-code ./dist
pnpm run pack:cursor ./dist
pnpm run pack:vscode ./dist
pnpm run pack:antigravity ./dist
pnpm run pack:gemini-cli ./dist
```

With Claude Code installed, also validate its native metadata:

```sh
claude plugin validate . --strict
claude plugin validate ./plugins/claude-code --strict
```

For local installation, use the absolute path to this repository as the marketplace source:

```sh
codex plugin marketplace add /absolute/path/to/agent-plugins --json
codex plugin add kombai@kombai --json

claude plugin marketplace add /absolute/path/to/agent-plugins
claude plugin install kombai@kombai
```

If an existing local marketplace points into the desktop app's old package directory,
replace that marketplace source with this repository's path before reinstalling the plugin.
For Cursor, use **From GitHub Repository** in Customize or copy `plugins/cursor` to
`~/.cursor/plugins/local/kombai` and reload. For the other hosts, install the plugin folder:

```sh
# VS Code 1.128 or later: run "Chat: Install Plugin from Source" with /absolute/path/to/agent-plugins/plugins/vscode
agy plugin install /absolute/path/to/agent-plugins/plugins/antigravity
gemini extensions install /absolute/path/to/agent-plugins/plugins/gemini-cli
```

VS Code uses a local plugin folder where it is (it adds the path to `chat.pluginLocations`), so
keep the folder in place while it is installed.

See each plugin README for its setup.

## Versions and compatibility

Plugin versions are independent of each other and of the root tooling package version.
To change a plugin version in the working tree, run the appropriate command and commit
the changed plugin manifest and `kombai.package.json` together:

```sh
pnpm run version:codex 0.1.1
pnpm run version:claude-code 0.1.1
pnpm run version:cursor 0.1.1
pnpm run version:vscode 0.1.1
pnpm run version:antigravity 0.1.1
pnpm run version:gemini-cli 0.1.1
```

The scripts require an increasing `major.minor.patch` version. Each plugin's
`kombai.package.json` names the CLI its workflow skill runs (`cli.package`) and whether the
plugin registers the canvas view (`cli.view`). Validation checks that the skill runs that CLI
and that `.mcp.json` matches `cli.view`. The scripts do not read a sibling checkout.

### The CLI version

OpenAI's and Anthropic's plugin directories refuse a plugin that runs a floating npm tag (the
CLI's `latest`), so the source pins one released CLI: every plugin's `cli.package`
is `@kombai/cli@0.1.5`, the same in all six, and every file that names the CLI (the skills under
`plugins/` and `skills/`, the READMEs, `agents/openai.yaml`, the marketplaces) names that one.
Describe a tag without the package name in front of it (the CLI's `latest` tag): the check reads
any package name followed by a tag as one the plugins run, and set-cli-version would rewrite it. Move them all with
one command:

```sh
pnpm run set-cli-version 0.1.5
```

It refuses a tag (`latest`, `beta`, …), a range or a prerelease, and a version npm doesn't have
(`npm view`). It runs that version's `mcp install --help` and refuses it unless it takes every
client a plugin's skill installs Kombai's server for (`codex`, `claude-code`), so no plugin pins
a CLI older than its skills. Then it rewrites every CLI it finds in those files, and runs the
checks below. Commit the result; it changes no plugin version.

`pnpm run check` (and Validate Plugins) runs `node scripts/cli-version.mjs check`, which fails
unless every plugin pins the same released CLI and `skills/` and `README.md` name it and no other.
Each plugin's validator fails the same way on its own folder and on the files its pack zips
beside it (its marketplace): a file that names a tag or another version than its `cli.package`.

## CI and packaging

**Validate Plugins** runs the release-script tests, the pinned-CLI check and all plugin validators on pushes and
pull requests. **Build Plugins** is manually triggered and provides independent Codex,
Claude Code, Cursor, VS Code, Antigravity and Gemini CLI build checkboxes. Select at least one. Each selected job
runs its tests and validation before packaging and uploading its ZIP. No local command is required.

Each build checkbox has an optional version input. Leave it blank to package the committed
version. A supplied higher version changes the plugin manifest and contract in that job's
checkout only; it does not commit or push changes. For releases installed from Git, commit
that version change before publishing the revision.

GitHub wraps each workflow artifact in a ZIP of its own, so the file downloaded from the run page,
`kombai-<host>-plugin-<version>[-team].zip`, holds the plugin ZIP of the same name. Unzip the
download into a folder of its own first (`gh run download <run-id> -n <artifact name>` does that
step for you); the sentences below are about that inner ZIP.

The Codex ZIP contains `.agents/plugins/marketplace.json` and the plugin under `plugins/codex/`.
Unzip it and pass the extracted root to `codex plugin marketplace add`, then install
`kombai@kombai`. The Claude Code and Cursor ZIPs contain their respective marketplace manifests
and plugin directories. Unzip the Claude Code artifact before registering its extracted directory
as a local marketplace. For Cursor, copy
the extracted `plugins/cursor` directory to Cursor's local plugin folder for testing. The VS Code
ZIP contains `.github/plugin/marketplace.json` and `plugins/vscode/`; unzip it somewhere it can
stay, then install the extracted `plugins/vscode` with **Chat: Install Plugin from Source** (VS
Code 1.128 or later), which uses the folder in place. The Antigravity and Gemini CLI ZIPs each
hold one folder named after the archive (`kombai-antigravity-plugin-<version>`,
`kombai-gemini-cli-plugin-<version>`, with `-team` for a team build) with the plugin's contents
in it, so that folder goes straight to `agy plugin install` or `gemini extensions install`.
Workflow artifacts do not publish marketplace listings or GitHub releases.

### Team builds

Colleagues trying a CLI beta before it is released use a team build of each plugin: the same
plugin, running the newest beta, npm's `beta` tag of the CLI (vscode-assistant's Publish CLI
`beta` action, run from `preprod`), which talks to preprod unless `kombai config env` says
otherwise. No plugin build runs the alphas from `dev` (npm's `alpha` tag).
Check **Team build** in Build Plugins, or run `node scripts/<host>-plugin.mjs pack [directory] --team`
(`<host>` is `codex`, `claude-code`, `cursor`, `vscode`, `antigravity` or `gemini-cli`): it writes `kombai-<host>-plugin-<version>-team.zip`
from a staged copy in which the beta tag takes the place of the pinned version everywhere, so the
source always pins a released CLI. The team build is the one place a tag is allowed: a team ZIP
never goes to a plugin directory, and following the tag spares colleagues a reinstall for every
beta. A team ZIP installs like the public one and has the same plugin name, so a machine has one
or the other. In VS Code the two
install side by side, because VS Code keys a local folder by its path, not by name: uninstall (or
disable) the public kombai from `@agentPlugins` before installing the team folder, and remove the
folder from `chat.pluginLocations` before going back. It needs no setup beyond the public one's.

### Directory releases

The Codex ZIP goes to OpenAI's plugin directory and the Claude Code ZIP to Anthropic's. A
directory takes a plugin version once, and runs the CLI the ZIP pins:

1. Pin the CLI the release needs, once it is on npm `latest`: `pnpm run set-cli-version <x.y.z>`.
2. Bump each plugin you submit: `pnpm run version:codex <next>`, `pnpm run version:claude-code <next>`.
3. Validate: `pnpm test` and `pnpm run check` (with Claude Code installed, also
   `claude plugin validate ./plugins/claude-code --strict`).
4. Commit and merge, then pack from that commit: run **Build Plugins** (Codex and Claude Code, no
   team build), or `pnpm run pack:codex ./dist` and `pnpm run pack:claude-code ./dist` on a clean
   checkout.
5. Submit the Codex ZIP to OpenAI's portal and the Claude Code ZIP to Anthropic's directory.

The plugins are ready for the directories only from a CLI release that names its own exact
version after the first call: up to 0.1.4, the CLI's skill text has the agent run later commands
with the CLI's `latest` tag, and `mcp install` writes that tag into the host's MCP config, whatever
version the plugin pinned. vscode-assistant removes that tag; once a CLI release includes it, run
`pnpm run set-cli-version` with that version and submit.

## Repository and license

Source repository: [kombai-io/agent-plugins](https://github.com/kombai-io/agent-plugins).

Licensed under the [MIT License](LICENSE), copyright (c) 2026 Kombai INC. Each plugin
includes its own copy of the license so Git installations and packaged ZIPs retain the notice.
Validation requires these copies to match the root license. This license covers this repository;
the separately distributed Kombai desktop app retains its own license.
