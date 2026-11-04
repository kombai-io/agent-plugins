import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkCliContract, checkSkills, FAQ_SKILL, stageTeamBuild, WORKFLOW_SKILL } from './cli-view.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLUGIN_DIR = 'plugins/gemini-cli';
// Gemini CLI has no marketplace file, and it installs an extension only from a folder, repository or archive whose
// root holds gemini-extension.json, so the package is the extension folder at the archive root.
const STAGE_FILES = [PLUGIN_DIR, 'LICENSE'];
// The manifest keys this extension uses. Gemini CLI also reads mcpServers (the canvas view's server would go there,
// which validation does not support yet), contextFileName, excludeTools, settings, themes and plan: none ship.
const MANIFEST_KEYS = new Set(['name', 'version', 'description']);
// GEMINI.md is the default context file, loaded into every session when it exists.
const FORBIDDEN = ['GEMINI.md', 'hooks', 'commands'];
// Gemini CLI's sandbox blocks writes to ~/.kombai (and, in some profiles, the network); the skill says what to do.
export const GEMINI_SANDBOX = "Gemini CLI's sandbox (on when `$SANDBOX` is set)";

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

/** Check one Gemini CLI extension folder: the repository's `plugins/gemini-cli`, or an unpacked archive. */
export function checkGeminiCliPluginDir(pluginRoot) {
  const manifest = readJson(path.join(pluginRoot, 'gemini-extension.json'));
  const contract = readJson(path.join(pluginRoot, 'kombai.package.json'));

  for (const key of Object.keys(manifest)) {
    assert(MANIFEST_KEYS.has(key), `Gemini CLI manifest must not set ${key}.`);
  }
  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'Gemini CLI extension names must be kombai.');
  assert(typeof manifest.description === 'string' && manifest.description.trim(), 'Gemini CLI description is missing.');
  assert(VERSION_RE.test(manifest.version), `Invalid Gemini CLI extension version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'Gemini CLI manifest and package contract versions must match.');
  assert(contract.schemaVersion === 'kombai-gemini-cli-plugin/v2', 'Unexpected Gemini CLI package contract schema.');
  for (const file of ['README.md', 'LICENSE', 'kombai.package.json', `skills/${WORKFLOW_SKILL}/SKILL.md`, `skills/${FAQ_SKILL}/SKILL.md`]) {
    assert(fs.statSync(path.join(pluginRoot, file)).isFile(), `Missing Gemini CLI extension file: ${file}`);
  }
  for (const file of FORBIDDEN) {
    assert(!fs.existsSync(path.join(pluginRoot, file)), `Gemini CLI extension must not ship ${file}.`);
  }
  assert(
    checkCliContract(pluginRoot, contract, 'Gemini CLI') === false,
    'Gemini CLI reads MCP servers from gemini-extension.json, which validation does not support yet; keep cli.view off.',
  );
  checkSkills(pluginRoot, 'Gemini CLI');
  for (const name of [WORKFLOW_SKILL, FAQ_SKILL]) {
    const skill = fs.readFileSync(path.join(pluginRoot, 'skills', name, 'SKILL.md'), 'utf8');
    assert(skill.includes(GEMINI_SANDBOX), `Gemini CLI ${name} skill must say what to do in Gemini CLI's sandbox.`);
    // Gemini CLI substitutes ${extensionPath}, ${workspacePath} and the like in skill text.
    assert(!skill.includes('${'), `Gemini CLI ${name} skill must not contain \${…}, which Gemini CLI substitutes.`);
  }
  return manifest.version;
}

export function validateGeminiCliPlugin(root = workspaceRoot) {
  const pluginRoot = path.join(root, PLUGIN_DIR);
  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );
  return checkGeminiCliPluginDir(pluginRoot);
}

export function bumpGeminiCliVersion(next, root = workspaceRoot) {
  const current = validateGeminiCliPlugin(root);
  assert(VERSION_RE.test(next), `Invalid Gemini CLI extension version: ${next}`);
  assert(compareVersion(next, current) > 0, `Gemini CLI extension version must increase from ${current}.`);
  for (const file of [
    path.join(root, PLUGIN_DIR, 'gemini-extension.json'),
    path.join(root, PLUGIN_DIR, 'kombai.package.json'),
  ]) {
    const data = readJson(file);
    data.version = next;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  validateGeminiCliPlugin(root);
  return next;
}

export function packGeminiCliPlugin(
  outputDir = path.join(os.tmpdir(), 'kombai-agent-plugins'),
  root = workspaceRoot,
  { team = false } = {},
) {
  const version = validateGeminiCliPlugin(root);
  // The team build zips a staged copy that runs the CLI's team build (cli-view.mjs).
  const from = team ? stageTeamBuild(root, STAGE_FILES, readJson(path.join(root, PLUGIN_DIR, 'kombai.package.json'))) : root;
  try {
    if (team) validateGeminiCliPlugin(from);
    fs.mkdirSync(outputDir, { recursive: true });
    const archive = path.join(outputDir, `kombai-gemini-cli-plugin-${version}${team ? '-team' : ''}.zip`);
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
      result = validateGeminiCliPlugin();
      if (value === '--github-output') {
        assert(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required for --github-output.');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result}\n`);
      }
    } else if (command === 'bump') {
      assert(value && extra.length === 0, 'Usage: bump <version>');
      result = bumpGeminiCliVersion(value);
    } else if (command === 'pack') {
      const args = [value, ...extra].filter((arg) => arg !== undefined);
      const dirs = args.filter((arg) => arg !== '--team');
      assert(dirs.length <= 1, 'Usage: pack [output-directory] [--team]');
      result = packGeminiCliPlugin(dirs[0] && path.resolve(dirs[0]), undefined, { team: args.includes('--team') });
    } else {
      throw new Error('Usage: gemini-cli-plugin.mjs <validate|bump|pack>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
