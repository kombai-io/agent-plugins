import fs from 'node:fs';
import path from 'node:path';

// The Kombai CLI's MCP server (`kombai mcp`, registered as `kombai`: the canvas view and Kombai's cards) is the one
// MCP server a plugin may bundle. What each host is listed is the CLI's call (VIEW_HOSTS and cardsFor in
// vscode-assistant's packages/cli/src/mcp/client-gate.js); a plugin only registers the server, and only while its
// kombai.package.json has `cli.view` on. Turning it on for another host: README.md, "Adding a host to the canvas view".
export const CLI_VIEW_SERVER = 'kombai';
// Each plugin's skills, both stubs over the CLI's text: the workflow runs `kombai skill`, the FAQ `kombai skill faq`.
export const WORKFLOW_SKILL = 'work-with-kombai';
export const FAQ_SKILL = 'about-kombai';
const SKILL_TOPICS = { [WORKFLOW_SKILL]: '', [FAQ_SKILL]: ' faq' };
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
 * Check a plugin against the `cli` block of its kombai.package.json: its skills run that CLI, and its
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
  for (const [name, topic] of Object.entries(SKILL_TOPICS)) {
    const skill = fs.readFileSync(path.join(pluginRoot, 'skills', name, 'SKILL.md'), 'utf8');
    assert(
      skill.includes(`npx -y ${cli.package} skill${topic}\``),
      `${host} ${name} skill must run ${cli.package} skill${topic}.`,
    );
  }

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

/** Check that a plugin ships exactly the workflow and FAQ skills, each named in its frontmatter and described. */
export function checkSkills(pluginRoot, host) {
  const skillRoot = path.join(pluginRoot, 'skills');
  const names = fs
    .readdirSync(skillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert(
    JSON.stringify(names) === JSON.stringify(Object.keys(SKILL_TOPICS).sort()),
    `${host} plugin must contain the ${WORKFLOW_SKILL} and ${FAQ_SKILL} skills, and no other.`,
  );
  for (const name of names) {
    const skill = fs.readFileSync(path.join(skillRoot, name, 'SKILL.md'), 'utf8');
    assert(new RegExp(`^---\\r?\\n[\\s\\S]*?^name: ${name}\\r?$`, 'm').test(skill), `${host} ${name} skill name is missing.`);
    assert(/^description: \S.+$/m.test(skill), `${host} ${name} skill description is missing.`);
  }
}
