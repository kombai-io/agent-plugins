import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkCliContract, checkSkills, stageTeamBuild } from './cli-view.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PACKAGE_FILES = ['.cursor-plugin', 'plugins/cursor', 'LICENSE'];

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

export function validateCursorPlugin(root = workspaceRoot) {
  const pluginRoot = path.join(root, 'plugins/cursor');
  const marketplace = readJson(path.join(root, '.cursor-plugin/marketplace.json'));
  const manifest = readJson(path.join(pluginRoot, '.cursor-plugin/plugin.json'));
  const contract = readJson(path.join(pluginRoot, 'kombai.package.json'));

  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );

  assert(marketplace.name === 'kombai' && marketplace.owner?.name === 'Kombai', 'Invalid Cursor marketplace.');
  assert(
    marketplace.plugins?.length === 1 &&
      marketplace.plugins[0].name === 'kombai' &&
      marketplace.plugins[0].source === 'plugins/cursor',
    'Cursor marketplace must point to the bundled plugin.',
  );
  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'Cursor plugin names must be kombai.');
  assert(manifest.license === 'MIT' && manifest.skills === './skills/', 'Cursor manifest license and skills must be set.');
  assert(manifest.logo === 'assets/logo.png', 'Cursor manifest must point to its bundled logo.');
  assert(VERSION_RE.test(manifest.version), `Invalid Cursor plugin version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'Cursor manifest and package contract versions must match.');
  assert(contract.schemaVersion === 'kombai-cursor-plugin/v2', 'Unexpected Cursor package contract schema.');
  for (const file of [
    'README.md',
    'kombai.package.json',
    '.cursor-plugin/plugin.json',
    'skills/work-with-kombai/SKILL.md',
    'skills/about-kombai/SKILL.md',
    'assets/logo.png',
  ]) {
    assert(fs.statSync(path.join(pluginRoot, file)).isFile(), `Missing Cursor plugin file: ${file}`);
  }
  checkCliContract(pluginRoot, contract, 'Cursor');
  checkSkills(pluginRoot, 'Cursor');
  return manifest.version;
}

export function bumpCursorVersion(next, root = workspaceRoot) {
  const current = validateCursorPlugin(root);
  assert(VERSION_RE.test(next), `Invalid Cursor plugin version: ${next}`);
  assert(compareVersion(next, current) > 0, `Cursor plugin version must increase from ${current}.`);
  for (const file of [
    path.join(root, 'plugins/cursor/.cursor-plugin/plugin.json'),
    path.join(root, 'plugins/cursor/kombai.package.json'),
  ]) {
    const data = readJson(file);
    data.version = next;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  validateCursorPlugin(root);
  return next;
}

export function packCursorPlugin(
  outputDir = path.join(os.tmpdir(), 'kombai-agent-plugins'),
  root = workspaceRoot,
  { team = false } = {},
) {
  const version = validateCursorPlugin(root);
  // The team build zips a staged copy that runs the CLI's team build (cli-view.mjs).
  const from = team
    ? stageTeamBuild(root, PACKAGE_FILES, readJson(path.join(root, 'plugins/cursor/kombai.package.json')))
    : root;
  try {
    if (team) validateCursorPlugin(from);
    fs.mkdirSync(outputDir, { recursive: true });
    const archive = path.join(outputDir, `kombai-cursor-plugin-${version}${team ? '-team' : ''}.zip`);
    fs.rmSync(archive, { force: true });
    for (const [command, args] of [
      ['zip', ['-q', '-r', archive, ...PACKAGE_FILES]],
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
      result = validateCursorPlugin();
      if (value === '--github-output') {
        assert(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required for --github-output.');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result}\n`);
      }
    } else if (command === 'bump') {
      assert(value && extra.length === 0, 'Usage: bump <version>');
      result = bumpCursorVersion(value);
    } else if (command === 'pack') {
      const args = [value, ...extra].filter((arg) => arg !== undefined);
      const dirs = args.filter((arg) => arg !== '--team');
      assert(dirs.length <= 1, 'Usage: pack [output-directory] [--team]');
      result = packCursorPlugin(dirs[0] && path.resolve(dirs[0]), undefined, { team: args.includes('--team') });
    } else {
      throw new Error('Usage: cursor-plugin.mjs <validate|bump|pack>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
