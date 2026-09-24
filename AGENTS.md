# Working on Kombai agent plugins

- This repository owns host plugin payloads, marketplaces, version scripts, and plugin CI.
- Read `README.md` and the relevant plugin README before editing. Use pnpm, not npm.
- The desktop app's MCP server, gateway, CLI registration, and task skills live in the
  separate `vscode-assistant` repository (usually `../vscode-assistant`). Do not copy them here.
- Keep each plugin manifest and its `kombai.package.json` version in sync using the version
  command. The root tooling package and other plugins retain their own versions.
- Run `pnpm test` and `pnpm run check` after release-tooling or metadata changes. Packaging
  needs `zip` and `unzip`. Do not introduce a dependency on a sibling repository for validation.
- Update the relevant README when changing setup, packaging, or release behavior.
