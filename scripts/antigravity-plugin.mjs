import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkCliContract, checkSkills, FAQ_SKILL, stageTeamBuild, WORKFLOW_SKILL } from './cli-view.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLUGIN_DIR = 'plugins/antigravity';
// Antigravity has no marketplace a repository can host (only Google's own), so the package is the plugin folder:
// its contents sit at the archive root, ready for `agy plugin install <folder>`.
const STAGE_FILES = [PLUGIN_DIR, 'LICENSE'];
// The repository ships other hosts' manifests, so the plugin uses `.antigravity-plugin/plugin.json`, which Antigravity
// reads before a root `plugin.json`.
const MANIFEST = '.antigravity-plugin/plugin.json';
// The keys of https://antigravity.google/schemas/v1/plugin.json, which allows no others.
const MANIFEST_KEYS = new Set([
  '$schema',
  'name',
  'displayName',
  'display_name',
  'description',
  'version',
  'disabled',
  'logo',
  'suggestedPrompts',
  'suggested_prompts',
  'skills',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'extensions',
]);
// Plugin parts this plugin does not ship: the skills are the whole plugin. `mcp_config.json` is where Antigravity
// would read the canvas view's server from, which validation does not support yet (README, "The canvas view").
const FORBIDDEN = ['plugin.json', 'mcp_config.json', 'rules', 'agents', 'hooks.json'];
// Antigravity's sandbox has no network and Kombai writes ~/.kombai; the skill asks to run outside it.
export const ANTIGRAVITY_SANDBOX = 'When Antigravity runs terminal commands in its sandbox';

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

/** Check one Antigravity plugin folder: the repository's `plugins/antigravity`, or an unpacked archive. */
export function checkAntigravityPluginDir(pluginRoot) {
  const manifest = readJson(path.join(pluginRoot, MANIFEST));
  const contract = readJson(path.join(pluginRoot, 'kombai.package.json'));

  for (const key of Object.keys(manifest)) {
    assert(MANIFEST_KEYS.has(key), `Antigravity manifest has a key its schema does not allow: ${key}`);
  }
  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'Antigravity plugin names must be kombai.');
  assert(manifest.displayName === 'Kombai', 'Antigravity displayName must be Kombai.');
  assert(typeof manifest.description === 'string' && manifest.description.trim(), 'Antigravity description is missing.');
  assert(manifest.license === 'MIT', 'Antigravity manifest license must be MIT.');
  assert(manifest.author?.name === 'Kombai', 'Antigravity manifest author must be Kombai.');
  for (const key of Object.keys(manifest.author)) {
    assert(['name', 'email', 'url'].includes(key), `Antigravity author has a key its schema does not allow: ${key}`);
  }
  assert(manifest.skills === undefined, 'Antigravity reads skills/ by default; a skills key would add more folders.');
  assert(
    typeof manifest.logo === 'string' &&
      !/^([a-z][a-z0-9+.-]*:|\/)/i.test(manifest.logo) &&
      !manifest.logo.split('/').includes('..') &&
      /\.(png|svg|jpe?g|webp)$/.test(manifest.logo),
    'Antigravity logo must be a relative image path inside the plugin.',
  );
  assert(fs.statSync(path.join(pluginRoot, manifest.logo)).isFile(), `Missing Antigravity logo: ${manifest.logo}`);
  assert(
    Array.isArray(manifest.suggestedPrompts) &&
      manifest.suggestedPrompts.length <= 3 &&
      manifest.suggestedPrompts.every((prompt) => typeof prompt === 'string' && /\S/.test(prompt)),
    'Antigravity suggestedPrompts must be at most three prompts.',
  );
  assert(VERSION_RE.test(manifest.version), `Invalid Antigravity plugin version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'Antigravity manifest and package contract versions must match.');
  assert(contract.schemaVersion === 'kombai-antigravity-plugin/v2', 'Unexpected Antigravity package contract schema.');
  for (const file of ['README.md', 'LICENSE', 'kombai.package.json', `skills/${WORKFLOW_SKILL}/SKILL.md`, `skills/${FAQ_SKILL}/SKILL.md`]) {
    assert(fs.statSync(path.join(pluginRoot, file)).isFile(), `Missing Antigravity plugin file: ${file}`);
  }
  for (const file of FORBIDDEN) {
    assert(!fs.existsSync(path.join(pluginRoot, file)), `Antigravity plugin must not ship ${file}.`);
  }
  assert(
    checkCliContract(pluginRoot, contract, 'Antigravity') === false,
    'Antigravity reads MCP servers from mcp_config.json, which validation does not support yet; keep cli.view off.',
  );
  checkSkills(pluginRoot, 'Antigravity');
  for (const name of [WORKFLOW_SKILL, FAQ_SKILL]) {
    const skill = fs.readFileSync(path.join(pluginRoot, 'skills', name, 'SKILL.md'), 'utf8');
    assert(skill.includes(ANTIGRAVITY_SANDBOX), `Antigravity ${name} skill must ask to run outside Antigravity's sandbox.`);
  }
  return manifest.version;
}

export function validateAntigravityPlugin(root = workspaceRoot) {
  const pluginRoot = path.join(root, PLUGIN_DIR);
  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );
  return checkAntigravityPluginDir(pluginRoot);
}

export function bumpAntigravityVersion(next, root = workspaceRoot) {
  const current = validateAntigravityPlugin(root);
  assert(VERSION_RE.test(next), `Invalid Antigravity plugin version: ${next}`);
  assert(compareVersion(next, current) > 0, `Antigravity plugin version must increase from ${current}.`);
  for (const file of [path.join(root, PLUGIN_DIR, MANIFEST), path.join(root, PLUGIN_DIR, 'kombai.package.json')]) {
    const data = readJson(file);
    data.version = next;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  validateAntigravityPlugin(root);
  return next;
}

export function packAntigravityPlugin(
  outputDir = path.join(os.tmpdir(), 'kombai-agent-plugins'),
  root = workspaceRoot,
  { team = false } = {},
) {
  const version = validateAntigravityPlugin(root);
  // The team build zips a staged copy that runs the CLI's team build (cli-view.mjs).
  const from = team ? stageTeamBuild(root, STAGE_FILES, readJson(path.join(root, PLUGIN_DIR, 'kombai.package.json'))) : root;
  try {
    if (team) validateAntigravityPlugin(from);
    fs.mkdirSync(outputDir, { recursive: true });
    const archive = path.join(outputDir, `kombai-antigravity-plugin-${version}${team ? '-team' : ''}.zip`);
    fs.rmSync(archive, { force: true });
    for (const [command, args] of [
      ['zip', ['-q', '-r', archive, '.']],
      ['unzip', ['-tq', archive]],
    ]) {
      const result = spawnSync(command, args, { cwd: path.join(from, PLUGIN_DIR), encoding: 'utf8' });
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
      result = validateAntigravityPlugin();
      if (value === '--github-output') {
        assert(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required for --github-output.');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result}\n`);
      }
    } else if (command === 'bump') {
      assert(value && extra.length === 0, 'Usage: bump <version>');
      result = bumpAntigravityVersion(value);
    } else if (command === 'pack') {
      const args = [value, ...extra].filter((arg) => arg !== undefined);
      const dirs = args.filter((arg) => arg !== '--team');
      assert(dirs.length <= 1, 'Usage: pack [output-directory] [--team]');
      result = packAntigravityPlugin(dirs[0] && path.resolve(dirs[0]), undefined, { team: args.includes('--team') });
    } else {
      throw new Error('Usage: antigravity-plugin.mjs <validate|bump|pack>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
