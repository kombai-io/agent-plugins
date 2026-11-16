import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSETS_SKILL,
  checkCliContract,
  checkPluginFiles,
  checkSkills,
  FAQ_SKILL,
  isFile,
  readPluginFile,
  WORKFLOW_SKILL,
} from './cli-view.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLUGIN_DIR = 'plugins/grok';
// xAI's marketplace (xai-org/plugin-marketplace) points at this folder pinned to a commit, so there is no package to
// build: the folder is the release. Grok Build reads `.grok-plugin/plugin.json` first, then Cursor's and Claude's.
const MANIFEST = '.grok-plugin/plugin.json';
// The keys the marketplace's own third-party manifests use. `skills` is left out: Grok reads skills/ by default.
const MANIFEST_KEYS = new Set([
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'logo',
]);
// Everything the folder holds. Grok Build also loads commands/, agents/, hooks/hooks.json, .mcp.json and .lsp.json
// from a plugin, and xAI's review audits each, so the skills stay the whole plugin.
const PLUGIN_FILES = [
  MANIFEST,
  'LICENSE',
  'README.md',
  'kombai.package.json',
  'assets/logo.png',
  `skills/${WORKFLOW_SKILL}/SKILL.md`,
  `skills/${FAQ_SKILL}/SKILL.md`,
  `skills/${ASSETS_SKILL}/SKILL.md`,
];

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

/** Check one Grok Build plugin folder: the repository's `plugins/grok`, or a copy of it. */
export function checkGrokPluginDir(pluginRoot) {
  const manifest = JSON.parse(readPluginFile(pluginRoot, MANIFEST, 'Grok plugin'));
  const contract = JSON.parse(readPluginFile(pluginRoot, 'kombai.package.json', 'Grok plugin'));

  assert(isObject(manifest), 'Grok manifest must be a JSON object.');
  for (const key of Object.keys(manifest)) assert(MANIFEST_KEYS.has(key), `Grok manifest must not set ${key}.`);
  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'Grok plugin names must be kombai.');
  assert(typeof manifest.description === 'string' && manifest.description.trim(), 'Grok description is missing.');
  assert(manifest.license === 'MIT', 'Grok manifest license must be MIT.');
  assert(isObject(manifest.author) && manifest.author.name === 'Kombai', 'Grok manifest author must be Kombai.');
  for (const key of ['homepage', 'repository']) assert(isHttps(manifest[key]), `Grok manifest ${key} must be an https URL.`);
  // Grok's marketplace pushes back on generic keywords: they drive the prompt that suggests a plugin.
  assert(
    Array.isArray(manifest.keywords) &&
      manifest.keywords.length > 0 &&
      manifest.keywords.every((keyword) => typeof keyword === 'string' && /^kombai\b/.test(keyword)),
    'Grok keywords must each name Kombai, so they suggest the plugin only for Kombai requests.',
  );
  assert(manifest.logo === 'assets/logo.png', 'Grok manifest must point to its bundled logo.');
  assert(VERSION_RE.test(manifest.version), `Invalid Grok plugin version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'Grok manifest and package contract versions must match.');
  assert(contract.schemaVersion === 'kombai-grok-plugin/v1', 'Unexpected Grok package contract schema.');
  assert(contract.cli?.view !== true, 'Grok has no canvas view; keep cli.view off.');
  checkPluginFiles(pluginRoot, PLUGIN_FILES, 'Grok plugin');
  checkCliContract(pluginRoot, contract, 'Grok');
  checkSkills(pluginRoot, 'Grok');
  return manifest.version;
}

export function validateGrokPlugin(root = workspaceRoot) {
  const pluginRoot = path.join(root, PLUGIN_DIR);
  const version = checkGrokPluginDir(pluginRoot);
  assert(isFile(path.join(root, 'LICENSE')), 'Missing repository LICENSE.');
  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );
  return version;
}

export function bumpGrokVersion(next, root = workspaceRoot) {
  const current = validateGrokPlugin(root);
  assert(VERSION_RE.test(next), `Invalid Grok plugin version: ${next}`);
  assert(compareVersion(next, current) > 0, `Grok plugin version must increase from ${current}.`);
  for (const file of [path.join(root, PLUGIN_DIR, MANIFEST), path.join(root, PLUGIN_DIR, 'kombai.package.json')]) {
    const data = readJson(file);
    data.version = next;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  validateGrokPlugin(root);
  return next;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , command, value, ...extra] = process.argv;
    let result;
    if (command === 'validate') {
      assert(extra.length === 0 && !value, 'Usage: validate');
      result = validateGrokPlugin();
    } else if (command === 'bump') {
      assert(value && extra.length === 0, 'Usage: bump <version>');
      result = bumpGrokVersion(value);
    } else {
      throw new Error('Usage: grok-plugin.mjs <validate|bump>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
