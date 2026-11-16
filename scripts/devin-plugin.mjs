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
const PLUGIN_DIR = 'plugins/devin';
// Devin's marketplace (CognitionAI/devin-marketplace) lists a third-party plugin as a `git-subdir` entry pointing at
// this folder pinned to a commit, so there is no package to build: the folder is the release. Devin reads
// `.devin-plugin/plugin.json` before Claude's and a root plugin.json, and takes the listing's name, description and
// logo from it.
const MANIFEST = '.devin-plugin/plugin.json';
// The descriptive keys Devin's manifest takes, and the ones its marketplace cards show (displayName,
// shortDescription). `skills` is left out: Devin reads skills/ by default.
const MANIFEST_KEYS = new Set([
  'name',
  'displayName',
  'version',
  'description',
  'shortDescription',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'logo',
  'platforms',
]);
// Everything the folder holds. Devin also loads AGENTS.md, rules/, agents/, hooks.json and .mcp.json from a plugin,
// so the skills stay the whole plugin.
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

/** Check one Devin plugin folder: the repository's `plugins/devin`, or a copy of it. */
export function checkDevinPluginDir(pluginRoot) {
  const manifest = JSON.parse(readPluginFile(pluginRoot, MANIFEST, 'Devin plugin'));
  const contract = JSON.parse(readPluginFile(pluginRoot, 'kombai.package.json', 'Devin plugin'));

  assert(isObject(manifest), 'Devin manifest must be a JSON object.');
  for (const key of Object.keys(manifest)) assert(MANIFEST_KEYS.has(key), `Devin manifest must not set ${key}.`);
  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'Devin plugin names must be kombai.');
  assert(typeof manifest.description === 'string' && manifest.description.trim(), 'Devin description is missing.');
  assert(manifest.license === 'MIT', 'Devin manifest license must be MIT.');
  assert(manifest.displayName === 'Kombai', 'Devin displayName must be Kombai.');
  // Devin's marketplace guide: one sentence, ideally 60 to 130 characters and about 200 at most, with no full stop
  // at the end.
  assert(
    manifest.description.length >= 60 && manifest.description.length <= 200 && !/\.\s*$/.test(manifest.description),
    'Devin description must be one sentence of 60 to 200 characters, without a trailing full stop.',
  );
  assert(
    typeof manifest.shortDescription === 'string' && manifest.shortDescription.trim(),
    'Devin shortDescription is missing.',
  );
  // The marketplace's own check (its scripts/validate.py): a card's short description is 40 characters at most.
  assert(manifest.shortDescription.length <= 40, 'Devin shortDescription must be 40 characters or fewer.');
  assert(isObject(manifest.author) && manifest.author.name === 'Kombai', 'Devin manifest author must be Kombai.');
  for (const key of ['homepage', 'repository']) assert(isHttps(manifest[key]), `Devin manifest ${key} must be an https URL.`);
  assert(
    Array.isArray(manifest.keywords) &&
      manifest.keywords.length > 0 &&
      manifest.keywords.every((keyword) => typeof keyword === 'string' && keyword),
    'Devin keywords must be a list of words, with at least one: the marketplace files the plugin under them.',
  );
  // The CLI signs in through the browser on the user's computer and opens the canvas there, which a cloud Devin
  // session's machine is not; the plugin loads in the Devin CLI and Devin Desktop only. `platforms` narrows where a
  // plugin loads (https://docs.devin.ai/cli/extensibility/plugins/overview#platforms): "local" is those two, and
  // Devin ignores a value it does not know, so the list is held to exactly this one.
  assert(
    JSON.stringify(manifest.platforms) === JSON.stringify(['local']),
    'Devin plugin must load only locally (platforms: ["local"]).',
  );
  assert(manifest.logo === 'assets/logo.png', 'Devin manifest must point to its bundled logo.');
  assert(VERSION_RE.test(manifest.version), `Invalid Devin plugin version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'Devin manifest and package contract versions must match.');
  assert(contract.schemaVersion === 'kombai-devin-plugin/v1', 'Unexpected Devin package contract schema.');
  assert(contract.cli?.view !== true, 'Devin shows no MCP App views; keep cli.view off.');
  checkPluginFiles(pluginRoot, PLUGIN_FILES, 'Devin plugin');
  checkCliContract(pluginRoot, contract, 'Devin');
  checkSkills(pluginRoot, 'Devin');
  return manifest.version;
}

export function validateDevinPlugin(root = workspaceRoot) {
  const pluginRoot = path.join(root, PLUGIN_DIR);
  const version = checkDevinPluginDir(pluginRoot);
  assert(isFile(path.join(root, 'LICENSE')), 'Missing repository LICENSE.');
  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );
  return version;
}

export function bumpDevinVersion(next, root = workspaceRoot) {
  const current = validateDevinPlugin(root);
  assert(VERSION_RE.test(next), `Invalid Devin plugin version: ${next}`);
  assert(compareVersion(next, current) > 0, `Devin plugin version must increase from ${current}.`);
  for (const file of [path.join(root, PLUGIN_DIR, MANIFEST), path.join(root, PLUGIN_DIR, 'kombai.package.json')]) {
    const data = readJson(file);
    data.version = next;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  validateDevinPlugin(root);
  return next;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , command, value, ...extra] = process.argv;
    let result;
    if (command === 'validate') {
      assert(extra.length === 0 && !value, 'Usage: validate');
      result = validateDevinPlugin();
    } else if (command === 'bump') {
      assert(value && extra.length === 0, 'Usage: bump <version>');
      result = bumpDevinVersion(value);
    } else {
      throw new Error('Usage: devin-plugin.mjs <validate|bump>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
