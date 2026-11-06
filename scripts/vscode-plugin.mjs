import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertPackOutside,
  checkCliContract,
  filesBesidePlugin,
  checkPluginFiles,
  checkSkills,
  FAQ_SKILL,
  readPluginFile,
  skillGuidance,
  stageTeamBuild,
  STRAY_FILE,
  WORKFLOW_SKILL,
} from './cli-view.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PACKAGE_FILES = ['.github/plugin', 'plugins/vscode', 'LICENSE'];
// VS Code reads the first of these marketplace files that has a `plugins` array, so a file earlier in the list would
// hide `.github/plugin/marketplace.json` (and, with it gone, VS Code falls through to the Claude Code marketplace).
// GitHub Copilot CLI reads the same files in the same order.
const VSCODE_EARLIER_MARKETPLACES = ['marketplace.json', '.plugin/marketplace.json'];
// VS Code (1.136) picks a plugin's format in this order: a root `plugin.json` whose `$schema` is an agent-plugins.org
// plugin schema (Agent Plugin format), then `.plugin/plugin.json` (Open Plugin), then `.claude-plugin/plugin.json` or
// any `.claude` folder in the plugin's path (Claude), and otherwise the Copilot-format root `plugin.json` this plugin
// uses (1.143 adds `.github/plugin/plugin.json` as a later fallback). So the manifest carries no `$schema` (checked
// below), and neither of these files may exist. The `.claude` path rule depends on where VS Code installs the plugin.
const VSCODE_EARLIER_MANIFESTS = ['.plugin/plugin.json', '.claude-plugin/plugin.json'];
// VS Code reads a Copilot-format manifest's commands, agents, rules, hooks and mcpServers keys too, and an inline
// hooks or mcpServers object replaces hooks.json or .mcp.json. The skills are the whole plugin; the canvas view, when
// on, ships as .mcp.json, which VS Code reads by default.
const MANIFEST_KEYS = new Set([
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'skills',
]);
// Everything the plugin folder holds. VS Code also loads commands/, agents/, rules/ and hooks.json from it by default.
const PLUGIN_FILES = [
  'LICENSE',
  'README.md',
  'kombai.package.json',
  'plugin.json',
  `skills/${WORKFLOW_SKILL}/SKILL.md`,
  `skills/${FAQ_SKILL}/SKILL.md`,
];
// VS Code's terminal sandbox blocks the network and writes outside the workspace; the skill asks for this way out.
export const VSCODE_UNSANDBOXED = 'requestUnsandboxedExecution: true';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compareVersion(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export function validateVsCodePlugin(root = workspaceRoot, { team = false } = {}) {
  const pluginRoot = path.join(root, 'plugins/vscode');
  const marketplace = readJson(path.join(root, '.github/plugin/marketplace.json'));
  const manifest = JSON.parse(readPluginFile(pluginRoot, 'plugin.json', 'VS Code plugin'));
  const contract = JSON.parse(readPluginFile(pluginRoot, 'kombai.package.json', 'VS Code plugin'));

  assert(marketplace.name === 'kombai' && marketplace.owner?.name === 'Kombai', 'Invalid VS Code marketplace.');
  assert(
    marketplace.plugins?.length === 1 &&
      marketplace.plugins[0].name === 'kombai' &&
      marketplace.plugins[0].source === './plugins/vscode',
    'VS Code marketplace must point to the bundled plugin at ./plugins/vscode.',
  );
  for (const file of VSCODE_EARLIER_MARKETPLACES) {
    assert(!fs.existsSync(path.join(root, file)), `${file} would hide the VS Code marketplace from VS Code.`);
  }
  for (const file of VSCODE_EARLIER_MANIFESTS) {
    assert(!fs.existsSync(path.join(pluginRoot, file)), `${file} would change how VS Code reads the plugin.`);
  }
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'VS Code manifest must be a JSON object.');
  assert(manifest.$schema === undefined, 'VS Code manifest must stay in the Copilot format (no $schema).');
  for (const key of Object.keys(manifest)) {
    assert(MANIFEST_KEYS.has(key), `VS Code manifest must not set ${key}.`);
  }
  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'VS Code plugin names must be kombai.');
  assert(manifest.license === 'MIT' && manifest.skills === 'skills/', 'VS Code manifest license and skills must be set.');
  assert(VERSION_RE.test(manifest.version), `Invalid VS Code plugin version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'VS Code manifest and package contract versions must match.');
  assert(contract.schemaVersion === 'kombai-vscode-plugin/v2', 'Unexpected VS Code package contract schema.');
  checkPluginFiles(pluginRoot, PLUGIN_FILES, 'VS Code plugin');
  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );
  checkCliContract(pluginRoot, contract, 'VS Code', { team, root, shipped: filesBesidePlugin(PACKAGE_FILES) });
  checkSkills(pluginRoot, 'VS Code');
  for (const name of [WORKFLOW_SKILL, FAQ_SKILL]) {
    const skill = fs.readFileSync(path.join(pluginRoot, 'skills', name, 'SKILL.md'), 'utf8');
    assert(
      skillGuidance(skill).includes(VSCODE_UNSANDBOXED),
      `VS Code ${name} skill must ask to run outside VS Code's terminal sandbox before the first command.`,
    );
  }
  return manifest.version;
}

export function bumpVsCodeVersion(next, root = workspaceRoot) {
  const current = validateVsCodePlugin(root);
  assert(VERSION_RE.test(next), `Invalid VS Code plugin version: ${next}`);
  assert(compareVersion(next, current) > 0, `VS Code plugin version must increase from ${current}.`);
  for (const file of [
    path.join(root, 'plugins/vscode/plugin.json'),
    path.join(root, 'plugins/vscode/kombai.package.json'),
  ]) {
    const data = readJson(file);
    data.version = next;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  validateVsCodePlugin(root);
  return next;
}

export function packVsCodePlugin(
  outputDir = path.join(os.tmpdir(), 'kombai-agent-plugins'),
  root = workspaceRoot,
  { team = false } = {},
) {
  outputDir = path.resolve(outputDir);
  assertPackOutside(outputDir, root, PACKAGE_FILES);
  const version = validateVsCodePlugin(root);
  // The team build zips a staged copy that runs the CLI's team build (cli-view.mjs).
  const from = team
    ? stageTeamBuild(root, PACKAGE_FILES, readJson(path.join(root, 'plugins/vscode/kombai.package.json')))
    : root;
  try {
    if (team) validateVsCodePlugin(from, { team });
    fs.mkdirSync(outputDir, { recursive: true });
    const archive = path.join(outputDir, `kombai-vscode-plugin-${version}${team ? '-team' : ''}.zip`);
    fs.rmSync(archive, { force: true });
    for (const [command, args] of [
      ['zip', ['-q', '-r', archive, ...PACKAGE_FILES, '-x', `*${STRAY_FILE}`]],
      ['unzip', ['-tq', archive]],
    ]) {
      const result = spawnSync(command, args, { cwd: from, encoding: 'utf8' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
    }
    return archive;
  } finally {
    if (team) fs.rmSync(from, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , command, value, ...extra] = process.argv;
    let result;
    if (command === 'validate') {
      assert(extra.length === 0 && (!value || value === '--github-output'), 'Usage: validate [--github-output]');
      result = validateVsCodePlugin();
      if (value === '--github-output') {
        assert(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required for --github-output.');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result}\n`);
      }
    } else if (command === 'bump') {
      assert(value && extra.length === 0, 'Usage: bump <version>');
      result = bumpVsCodeVersion(value);
    } else if (command === 'pack') {
      const args = [value, ...extra].filter((arg) => arg !== undefined);
      const dirs = args.filter((arg) => arg !== '--team');
      assert(dirs.length <= 1, 'Usage: pack [output-directory] [--team]');
      result = packVsCodePlugin(dirs[0] && path.resolve(dirs[0]), undefined, { team: args.includes('--team') });
    } else {
      throw new Error('Usage: vscode-plugin.mjs <validate|bump|pack>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
