import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertPackOutside,
  checkCliContract,
  checkPluginFiles,
  checkSkills,
  FAQ_SKILL,
  isFile,
  readPluginFile,
  skillGuidance,
  stageTeamBuild,
  WORKFLOW_SKILL,
  zipPluginFolder,
} from './cli-view.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLUGIN_DIR = 'plugins/antigravity';
// Antigravity's only marketplace is Google's own catalog, so the package is the plugin folder: the archive holds one
// folder, named after it, ready for `agy plugin install <folder>`.
const STAGE_FILES = [PLUGIN_DIR, 'LICENSE'];
// The repository ships other hosts' manifests, so the plugin uses `.antigravity-plugin/plugin.json`, which Antigravity
// reads before a root `plugin.json`.
const MANIFEST = '.antigravity-plugin/plugin.json';
const SCHEMA = 'https://antigravity.google/schemas/v1/plugin.json';
// The keys of that schema (which allows no others), less the deprecated source, sourcePath and source_path that only
// older imports set.
const SCHEMA_KEYS = new Set([
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
// The ones this plugin sets. The rest (the display_name and suggested_prompts aliases, disabled, skills, extensions)
// would change what Antigravity loads or shows.
const MANIFEST_KEYS = new Set([
  '$schema',
  'name',
  'displayName',
  'description',
  'version',
  'logo',
  'suggestedPrompts',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
]);
// Everything the plugin folder holds, besides the logo the manifest names. The skills are the whole plugin:
// Antigravity also loads rules/, agents/, hooks.json and mcp_config.json (where the canvas view's server would go,
// which validation does not support yet; README, "The canvas view") from it, and a root plugin.json would be read
// as a second manifest.
const PLUGIN_FILES = [
  MANIFEST,
  'LICENSE',
  'README.md',
  'kombai.package.json',
  `skills/${WORKFLOW_SKILL}/SKILL.md`,
  `skills/${FAQ_SKILL}/SKILL.md`,
];
// Antigravity's sandbox has no network and Kombai writes ~/.kombai; the skill asks to run outside it.
export const ANTIGRAVITY_SANDBOX = 'When Antigravity runs terminal commands in its sandbox';
// The Allow rule the skills give for Kombai's commands. Antigravity matches a rule's words against the command's whole
// words, so a rule naming the pinned CLI version would stop matching when set-cli-version moves it; each word of a
// `regex:` rule is matched as a whole regular expression, so this takes any CLI version, and `npx.cmd` on Windows.
export const ANTIGRAVITY_ALLOW_RULE = 'command(regex:npx(.cmd)? -y @kombai/cli@[a-z0-9.-]+ .*)';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isHttps(value) {
  return typeof value === 'string' && /^https:\/\/\S+$/.test(value);
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
export function checkAntigravityPluginDir(pluginRoot, { team = false } = {}) {
  const manifest = JSON.parse(readPluginFile(pluginRoot, MANIFEST, 'Antigravity plugin'));
  const contract = JSON.parse(readPluginFile(pluginRoot, 'kombai.package.json', 'Antigravity plugin'));

  // First, so turning the view on Antigravity's own way (mcp_config.json) explains itself.
  assert(
    contract.cli?.view !== true,
    'Antigravity reads MCP servers from mcp_config.json, which validation does not support yet; keep cli.view off.',
  );
  assert(isObject(manifest), 'Antigravity manifest must be a JSON object.');
  assert(manifest.skills === undefined, 'Antigravity reads skills/ by default; a skills key would add more folders.');
  for (const key of Object.keys(manifest)) {
    assert(SCHEMA_KEYS.has(key), `Antigravity manifest has a key outside its schema, or a deprecated one: ${key}`);
    assert(MANIFEST_KEYS.has(key), `Antigravity manifest must not set ${key}.`);
  }
  // Antigravity does not load a plugin whose manifest has a schema key of the wrong type.
  assert(manifest.$schema === SCHEMA, `Antigravity manifest $schema must be ${SCHEMA}.`);
  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'Antigravity plugin names must be kombai.');
  assert(manifest.displayName === 'Kombai', 'Antigravity displayName must be Kombai.');
  assert(typeof manifest.description === 'string' && manifest.description.trim(), 'Antigravity description is missing.');
  assert(manifest.license === 'MIT', 'Antigravity manifest license must be MIT.');
  assert(isObject(manifest.author) && manifest.author.name === 'Kombai', 'Antigravity manifest author must be Kombai.');
  for (const [key, value] of Object.entries(manifest.author)) {
    assert(['name', 'email', 'url'].includes(key), `Antigravity author has a key its schema does not allow: ${key}`);
    assert(key !== 'url' || isHttps(value), 'Antigravity author url must be an https URL.');
    assert(key !== 'email' || (typeof value === 'string' && value.includes('@')), 'Antigravity author email must be an address.');
  }
  for (const key of ['homepage', 'repository']) {
    assert(isHttps(manifest[key]), `Antigravity manifest ${key} must be an https URL.`);
  }
  assert(
    Array.isArray(manifest.keywords) && manifest.keywords.every((keyword) => typeof keyword === 'string' && keyword),
    'Antigravity keywords must be a list of words.',
  );
  assert(
    typeof manifest.logo === 'string' &&
      !/^([a-z][a-z0-9+.-]*:|\/)/i.test(manifest.logo) &&
      !manifest.logo.split('/').includes('..') &&
      /\.(png|svg|jpe?g|webp)$/.test(manifest.logo),
    'Antigravity logo must be a relative image path inside the plugin.',
  );
  const logo = path.posix.normalize(manifest.logo);
  assert(isFile(path.join(pluginRoot, logo)), `Missing Antigravity logo: ${manifest.logo}`);
  assert(Array.isArray(manifest.suggestedPrompts), 'Antigravity manifest must set suggestedPrompts.');
  assert(manifest.suggestedPrompts.length <= 3, 'Antigravity suggestedPrompts must be at most three prompts.');
  assert(
    manifest.suggestedPrompts.every((prompt) => typeof prompt === 'string' && /\S/.test(prompt)),
    'Antigravity suggestedPrompts must not be blank.',
  );
  assert(VERSION_RE.test(manifest.version), `Invalid Antigravity plugin version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'Antigravity manifest and package contract versions must match.');
  assert(contract.schemaVersion === 'kombai-antigravity-plugin/v2', 'Unexpected Antigravity package contract schema.');
  checkPluginFiles(pluginRoot, [...PLUGIN_FILES, logo], 'Antigravity plugin');
  checkCliContract(pluginRoot, contract, 'Antigravity', { team });
  checkSkills(pluginRoot, 'Antigravity');
  for (const name of [WORKFLOW_SKILL, FAQ_SKILL]) {
    const skill = fs.readFileSync(path.join(pluginRoot, 'skills', name, 'SKILL.md'), 'utf8');
    assert(
      skillGuidance(skill).includes(ANTIGRAVITY_SANDBOX),
      `Antigravity ${name} skill must ask to run outside Antigravity's sandbox before the first command.`,
    );
    assert(
      skillGuidance(skill).replace(/\s+/g, ' ').includes(ANTIGRAVITY_ALLOW_RULE),
      `Antigravity ${name} skill must give the Allow rule ${ANTIGRAVITY_ALLOW_RULE}, which matches every CLI version.`,
    );
  }
  return manifest.version;
}

export function validateAntigravityPlugin(root = workspaceRoot, { team = false } = {}) {
  const pluginRoot = path.join(root, PLUGIN_DIR);
  const version = checkAntigravityPluginDir(pluginRoot, { team });
  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );
  return version;
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
  outputDir = path.resolve(outputDir);
  assertPackOutside(outputDir, root, [PLUGIN_DIR]);
  const version = validateAntigravityPlugin(root);
  // The team build zips a staged copy that runs the CLI's team build (cli-view.mjs).
  const from = team ? stageTeamBuild(root, STAGE_FILES, readJson(path.join(root, PLUGIN_DIR, 'kombai.package.json'))) : root;
  try {
    if (team) validateAntigravityPlugin(from, { team });
    fs.mkdirSync(outputDir, { recursive: true });
    const archive = path.join(outputDir, `kombai-antigravity-plugin-${version}${team ? '-team' : ''}.zip`);
    return zipPluginFolder(path.join(from, PLUGIN_DIR), archive);
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
