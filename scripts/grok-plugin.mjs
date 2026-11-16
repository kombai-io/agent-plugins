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
// The repository's own marketplace, for installing before (or besides) xAI's listing:
// `grok plugin marketplace add kombai-io/agent-plugins`, then `grok plugin install kombai@kombai`. Grok also reads
// Claude Code marketplaces, and `.claude-plugin/marketplace.json` points at the Claude Code plugin, whose skills
// refuse outside Claude Code; this file points Grok at its own folder. Its entry uses the catalog format and the local
// source form of xai-org/plugin-marketplace.
const MARKETPLACE = '.grok-plugin/marketplace.json';
const MARKETPLACE_KEYS = new Set(['name', 'description', 'category', 'source', 'homepage', 'keywords', 'domains']);
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

/** Check the repository's Grok marketplace against the plugin folder it lists. */
export function checkGrokMarketplace(root) {
  const marketplace = readJson(path.join(root, MARKETPLACE));
  const manifest = readJson(path.join(root, PLUGIN_DIR, MANIFEST));
  assert(
    isObject(marketplace) && marketplace.name === 'kombai' && marketplace.owner?.name === 'Kombai',
    'Invalid Grok marketplace: it must be named kombai and owned by Kombai.',
  );
  assert(
    Array.isArray(marketplace.plugins) && marketplace.plugins.length === 1 && isObject(marketplace.plugins[0]),
    'Grok marketplace must list exactly one plugin.',
  );
  const [entry] = marketplace.plugins;
  for (const key of Object.keys(entry)) assert(MARKETPLACE_KEYS.has(key), `Grok marketplace entry must not set ${key}.`);
  assert(entry.name === manifest.name, 'Grok marketplace entry must be named after the plugin (kombai).');
  assert(
    isObject(entry.source) &&
      Object.keys(entry.source).length === 2 &&
      entry.source.type === 'local' &&
      entry.source.path === `./${PLUGIN_DIR}`,
    `Grok marketplace must point to the bundled plugin: { "type": "local", "path": "./${PLUGIN_DIR}" }.`,
  );
  assert(entry.description === manifest.description, 'Grok marketplace and manifest descriptions must match.');
  assert(isHttps(entry.homepage), 'Grok marketplace homepage must be an https URL.');
  assert(
    JSON.stringify(entry.keywords) === JSON.stringify(manifest.keywords),
    'Grok marketplace keywords must match the manifest, which keeps them Kombai-scoped.',
  );
  assert(
    Array.isArray(entry.domains) &&
      entry.domains.length > 0 &&
      entry.domains.every((domain) => typeof domain === 'string' && /(^|\.)kombai\.com$/.test(domain)),
    "Grok marketplace domains must be Kombai's own (kombai.com).",
  );
}

export function validateGrokPlugin(root = workspaceRoot) {
  const pluginRoot = path.join(root, PLUGIN_DIR);
  const version = checkGrokPluginDir(pluginRoot);
  checkGrokMarketplace(root);
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
