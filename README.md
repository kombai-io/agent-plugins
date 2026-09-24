# Kombai agent plugins

This standalone repository contains the [Codex](plugins/codex/README.md),
[Claude Code](plugins/claude-code/README.md), and [Cursor](plugins/cursor/README.md) plugins,
their local marketplaces, and release tooling.

The installed Kombai desktop app owns the local `kombai` MCP server, registration commands,
gateway, and task skills. This repository supplies workflow instructions and plugin packaging;
it does not build the desktop app or bundle an MCP server or `.mcp.json`.

The Codex marketplace is [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json).
The Claude Code marketplace is [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).
The Cursor marketplace is [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json).
Codex and Claude Code use the plugin selector `kombai@kombai`; Cursor uses its Customize plugin UI.

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
`~/.cursor/plugins/local/kombai` and reload. See each plugin README for app setup and
the Kombai Dev testing flow.

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
`kombai.package.json` records its minimum required Kombai app version. Validation checks
that version's format and the registration contract; compatibility with a released app
must be verified using that app. The scripts do not read a sibling app checkout.

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
