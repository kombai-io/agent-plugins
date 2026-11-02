import fs from 'node:fs';
import path from 'node:path';

// The Kombai CLI's canvas view (`kombai mcp`, registered as `kombai-cli`) is the one MCP server a plugin may bundle.
// Which hosts are shown the view is the CLI's call (VIEW_HOSTS in vscode-assistant's
// packages/cli/src/mcp/client-gate.js); a plugin only registers the server, and only while its kombai.package.json
// has `cli.view` on. Turning it on for another host: README.md, "Adding a host to the canvas view".
export const CLI_VIEW_SERVER = 'kombai-cli';
const CLI_PACKAGE_RE = /^@kombai(-io)?\/cli@\S+$/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** The `.mcp.json` that registers the view, for a plugin whose skill runs `cliPackage` (`@kombai/cli@latest`). */
export function cliViewMcpConfig(cliPackage) {
  return { mcpServers: { [CLI_VIEW_SERVER]: { command: 'npx', args: ['-y', cliPackage, 'mcp'] } } };
}

/**
 * Check a plugin against the `cli` block of its kombai.package.json: its workflow skill runs that CLI, and its
 * `.mcp.json` registers the view exactly when `cli.view` is on. No other MCP or app configuration ships.
 * Returns whether the plugin registers the view.
 */
export function checkCliContract(pluginRoot, contract, host) {
  const cli = contract.cli;
  assert(
    typeof cli?.package === 'string' && CLI_PACKAGE_RE.test(cli.package),
    `${host} contract must name the Kombai CLI it runs (cli.package).`,
  );
  assert(typeof cli.view === 'boolean', `${host} contract must say whether it registers the canvas view (cli.view).`);
  const skill = fs.readFileSync(path.join(pluginRoot, 'skills/kombai-workflow/SKILL.md'), 'utf8');
  assert(skill.includes(`npx -y ${cli.package} skill`), `${host} workflow skill must run ${cli.package}.`);

  const mcpFile = path.join(pluginRoot, '.mcp.json');
  if (cli.view) {
    assert(fs.existsSync(mcpFile), `${host} has the canvas view on, so it must ship .mcp.json.`);
    assert(
      JSON.stringify(readJson(mcpFile)) === JSON.stringify(cliViewMcpConfig(cli.package)),
      `${host} .mcp.json may only register the Kombai CLI view (${CLI_VIEW_SERVER}).`,
    );
  } else {
    assert(!fs.existsSync(mcpFile), `${host} has the canvas view off, so .mcp.json must not ship.`);
  }
  for (const forbidden of ['mcp.json', '.app.json']) {
    assert(
      !fs.existsSync(path.join(pluginRoot, forbidden)),
      `Local MCP config must not ship in the plugin: ${forbidden}`,
    );
  }
  return cli.view;
}
