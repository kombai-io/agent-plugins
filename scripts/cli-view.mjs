import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

/**
 * A skill's host guidance: the text before the line that runs the CLI ("Run `npx"), which the agent reads before its
 * first command. Each host's sandbox guidance must be there, not only in a later bullet.
 */
export function skillGuidance(text) {
  const run = text.indexOf('Run `npx');
  return run > 0 ? text.slice(0, run) : '';
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

// The team build of a plugin, for colleagues trying a CLI beta before it is released: the same plugin, running the
// newest beta from npm's `beta` tag (vscode-assistant's Publish CLI `beta` action, run from `preprod`), which
// talks to preprod. `pack --team` zips a staged copy, so the source always names the release.
export const RELEASE_CLI_PACKAGE = '@kombai/cli@latest';
export const TEAM_CLI_PACKAGE = '@kombai/cli@beta';

function filesUnder(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );
}

/** Whether `file` exists and is a regular file. */
export function isFile(file) {
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true;
}

// Finder's folder metadata: the packs leave it out (`zip -x`), so a local build on a Mac may have it.
export const STRAY_FILE = '.DS_Store';
// checkCliContract decides these.
const CONTRACT_FILES = ['.mcp.json', 'mcp.json', '.app.json'];

/**
 * Check that a plugin folder holds exactly `files` (paths relative to it), besides STRAY_FILE and the MCP files
 * checkCliContract decides. Hosts load parts they find by name (agents/, hooks.json, GEMINI.md, …), and the packs zip
 * the whole folder, so anything else fails. `label` names the folder in messages ("VS Code plugin").
 */
export function checkPluginFiles(pluginRoot, files, label) {
  for (const file of files) assert(isFile(path.join(pluginRoot, file)), `Missing ${label} file: ${file}`);
  const expected = new Set(files);
  const tops = new Set(files.map((file) => file.split('/')[0]));
  // The folders on the way to those files. Any other folder would ship empty, or holding only STRAY_FILE.
  const folders = new Set(
    files.flatMap((file) => file.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))),
  );
  for (const entry of fs.readdirSync(pluginRoot, { recursive: true, withFileTypes: true })) {
    const relative = path.relative(pluginRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join('/');
    if (entry.isDirectory() ? folders.has(relative) : expected.has(relative) || CONTRACT_FILES.includes(relative) || entry.name === STRAY_FILE) {
      continue;
    }
    const top = relative.split('/')[0];
    throw new Error(`${label} must not ship ${tops.has(top) ? relative : top}.`);
  }
}

/** Read one of a plugin's files, with the same message as checkPluginFiles when it is missing. */
export function readPluginFile(pluginRoot, file, label) {
  assert(isFile(path.join(pluginRoot, file)), `Missing ${label} file: ${file}`);
  return fs.readFileSync(path.join(pluginRoot, file), 'utf8');
}

function realPath(file) {
  // The nearest existing parent's real path (macOS /var is /private/var), with the rest of the path after it.
  let existing = path.resolve(file);
  const rest = [];
  while (!fs.existsSync(existing)) {
    rest.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  return path.join(fs.realpathSync(existing), ...rest);
}

/**
 * Refuse an output directory inside any of the `paths` (under `root`) a pack zips: the archive would carry the output
 * folder, and every later validation would reject it. Call it before validating.
 */
export function assertPackOutside(outputDir, root, paths) {
  const output = realPath(outputDir);
  for (const packed of paths) {
    const relative = path.relative(realPath(path.join(root, packed)), output);
    const outside = relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
    assert(outside, `Pack into a folder outside ${packed}: ${outputDir} would ship in the archive.`);
  }
}

/**
 * Zip the plugin folder `dir` into `archive` as one folder named after the archive (`kombai-<host>-plugin-<version>`),
 * leaving out STRAY_FILE, so unzipping it makes that folder rather than spilling the plugin into the current one.
 * For hosts that install a plugin folder rather than a marketplace (Antigravity, Gemini CLI).
 */
export function zipPluginFolder(dir, archive) {
  const folder = path.basename(archive, '.zip');
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-plugin-pack-'));
  try {
    fs.cpSync(dir, path.join(stage, folder), { recursive: true, filter: (from) => path.basename(from) !== STRAY_FILE });
    fs.rmSync(archive, { force: true });
    for (const [command, args] of [
      ['zip', ['-q', '-r', archive, folder]],
      ['unzip', ['-tq', archive]],
    ]) {
      const result = spawnSync(command, args, { cwd: stage, encoding: 'utf8' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
    }
    return archive;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

/**
 * Copy `files` (paths under `root`) into a new directory as the team build, with TEAM_CLI_PACKAGE in place of
 * RELEASE_CLI_PACKAGE everywhere. The caller removes the returned directory.
 */
export function stageTeamBuild(root, files, contract) {
  assert(
    contract.cli?.package === RELEASE_CLI_PACKAGE,
    `A team build starts from the release plugin (${RELEASE_CLI_PACKAGE}), not ${contract.cli?.package}.`,
  );
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-plugin-team-'));
  for (const file of files) {
    fs.cpSync(path.join(root, file), path.join(stage, file), {
      recursive: true,
      filter: (from) => path.basename(from) !== STRAY_FILE,
    });
  }
  for (const file of filesUnder(stage)) {
    if (!/\.(md|json)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(RELEASE_CLI_PACKAGE)) fs.writeFileSync(file, text.replaceAll(RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE));
  }
  return stage;
}
