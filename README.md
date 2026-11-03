# Kombai agent plugins

This standalone repository contains the [Codex](plugins/codex/README.md),
[Claude Code](plugins/claude-code/README.md), and [Cursor](plugins/cursor/README.md) plugins,
their local marketplaces, and release tooling.

Each plugin's `kombai-workflow` skill runs the Kombai CLI's team build
(`npx -y @kombai-io/cli@next skill`), which prints the full instructions for designing on a hosted
Kombai canvas. The CLI needs Node.js 20 or later and npm access to `@kombai-io` on GitHub Packages.

When a shell is sandboxed, the bootstrap skill requests approved execution outside it before
the first `npx` call and for later CLI commands. npm may need network access before Kombai starts,
and the CLI writes `~/.kombai`. In Codex, the skill specifies the execution tool's
`sandbox_permissions: "require_escalated"` setting; other hosts use their own approval mechanism.
Existing installations need the updated plugin or standalone skill to receive this guidance;
upgrading only the CLI does not replace the bootstrap skill.

The only MCP server a plugin registers is the CLI's canvas view (`kombai-cli`), and only the Codex
plugin registers it today; see [The canvas view](#the-canvas-view). This repository supplies the
workflow skill and plugin packaging; it builds neither the CLI nor the desktop app.

The Codex marketplace is [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json).
The Claude Code marketplace is [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).
The Cursor marketplace is [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json).
Codex and Claude Code use the plugin selector `kombai@kombai`; Cursor uses its Customize plugin UI.

## Install with the skills CLI

For a platform-independent workflow skill, use Vercel's `skills` CLI:

```sh
npx skills add kombai-io/agent-plugins --skill kombai-workflow
```

The CLI discovers [`skills/kombai-workflow/SKILL.md`](skills/kombai-workflow/SKILL.md)
before the same-named skills inside the host plugins. It is the same CLI stub as the plugins'
and works in any agent that can run `npx`. It registers no MCP server, so the agent opens the
canvas in its own browser panel or the user's browser rather than in a view beside the chat.
The existing plugin marketplaces and packages continue to use their host-specific skills under
`plugins/`.

## The canvas view

`kombai mcp` serves a view of the live hosted canvas beside the agent's chat, and Kombai's cards
in it (a taste run's design brief, and the plans when taste is out of credits), as MCP Apps
(server `kombai-cli`, run as `npx -y <cli.package> mcp`). A host shows them only if it renders
MCP App views, and the CLI decides what each host is listed (`VIEW_HOSTS` and `cardsFor` in
vscode-assistant's `packages/cli/src/mcp/client-gate.js`): Codex desktop gets the view and both
cards, and Claude desktop's Code tab the taste card. So the Codex and Claude Code plugins have
`cli.view` on, which registers the server; Cursor's is off. Validation checks each plugin
against its contract: `.mcp.json` ships exactly when `cli.view` is on, with exactly the CLI
server in it (`scripts/cli-view.mjs`).

### Adding a host to the canvas view

When another host (Claude Code, Cursor, …) can show MCP App views:

1. Set `cli.view` to `true` in that plugin's `kombai.package.json`.
2. Add the plugin's `.mcp.json`; validation gives its exact content (`cliViewMcpConfig`). Check
   the host's plugin format first: Codex also points its manifest's `mcpServers` at the file,
   and validation knows only `.mcp.json`, so a host that reads another file needs
   `scripts/cli-view.mjs` taught its format.
3. Bump that plugin's version and release it.

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
`~/.cursor/plugins/local/kombai` and reload. See each plugin README for its setup.

## Versions and compatibility

Plugin versions are independent of each other and of the root tooling package version.
To change a plugin version in the working tree, run the appropriate command and commit
the changed plugin manifest and `kombai.package.json` together:

```sh
pnpm run version:codex 0.1.1
pnpm run version:claude-code 0.1.1
pnpm run version:cursor 0.1.1
```

The scripts require an increasing `major.minor.patch` version. Each plugin's
`kombai.package.json` names the CLI its workflow skill runs (`cli.package`) and whether the
plugin registers the canvas view (`cli.view`). Validation checks that the skill runs that CLI
and that `.mcp.json` matches `cli.view`. The scripts do not read a sibling checkout.

## CI and packaging

**Validate Plugins** runs the release-script tests and all plugin validators on pushes and
pull requests. **Build Plugins** is manually triggered and provides independent Codex,
Claude Code, and Cursor build checkboxes. Select at least one. Each selected job
runs its tests and validation before packaging and uploading its ZIP. No local command is required.

Each build checkbox has an optional version input. Leave it blank to package the committed
version. A supplied higher version changes the plugin manifest and contract in that job's
checkout only; it does not commit or push changes. For releases installed from Git, commit
that version change before publishing the revision.

The Codex ZIP contains the plugin payload at its root. The Claude Code and Cursor ZIPs
contain their respective marketplace manifests and plugin directories. Unzip the Claude Code
artifact before registering its extracted directory as a local marketplace. For Cursor, copy
the extracted `plugins/cursor` directory to Cursor's local plugin folder for testing. Workflow artifacts do not publish marketplace
listings or GitHub releases.

## Repository and license

Source repository: [kombai-io/agent-plugins](https://github.com/kombai-io/agent-plugins).

Licensed under the [MIT License](LICENSE), copyright (c) 2026 Kombai INC. Each plugin
includes its own copy of the license so Git installations and packaged ZIPs retain the notice.
Validation requires these copies to match the root license. This license covers this repository;
the separately distributed Kombai desktop app retains its own license.
