import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertPackOutside,
  CHAT_NOTICES,
  checkChatNotice,
  checkCliContract,
  filesBesidePlugin,
  checkSkills,
  SETUP_SKILL,
  stageTeamBuild,
  STRAY_FILE,
} from './cli-view.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PACKAGE_FILES = ['.claude-plugin', 'plugins/claude-code', 'LICENSE'];

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

export function validateClaudeCodePlugin(root = workspaceRoot, { team = false } = {}) {
  const pluginRoot = path.join(root, 'plugins/claude-code');
  const marketplace = readJson(path.join(root, '.claude-plugin/marketplace.json'));
  const manifest = readJson(path.join(pluginRoot, '.claude-plugin/plugin.json'));
  const contract = readJson(path.join(pluginRoot, 'kombai.package.json'));

  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );

  assert(marketplace.name === 'kombai' && marketplace.owner?.name === 'Kombai', 'Invalid Claude marketplace.');
  assert(
    marketplace.plugins?.length === 1 &&
      marketplace.plugins[0].name === 'kombai' &&
      marketplace.plugins[0].source === './plugins/claude-code',
    'Claude marketplace must point to the bundled plugin.',
  );
  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'Claude plugin names must be kombai.');
  assert(VERSION_RE.test(manifest.version), `Invalid Claude plugin version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'Claude manifest and package contract versions must match.');
  assert(contract.schemaVersion === 'kombai-claude-code-plugin/v2', 'Unexpected Claude package contract schema.');
  for (const file of [
    'README.md',
    'kombai.package.json',
    '.claude-plugin/plugin.json',
    'skills/work-with-kombai/SKILL.md',
    'skills/about-kombai/SKILL.md',
    'skills/generate-assets-with-kombai/SKILL.md',
    `skills/${SETUP_SKILL}/SKILL.md`,
  ]) {
    assert(fs.statSync(path.join(pluginRoot, file)).isFile(), `Missing Claude plugin file: ${file}`);
  }
  // Anthropic's plugin directory refuses a plugin that ships a local (stdio) MCP server, so the plugin is skills-only:
  // the Kombai CLI writes its server into the user's own Claude Code config instead (`kombai mcp install claude-code`,
  // which the CLI's notes for the Claude desktop app run when Kombai's taste card is missing).
  const view = checkCliContract(pluginRoot, contract, 'Claude', {
    team,
    root,
    shipped: filesBesidePlugin(PACKAGE_FILES),
  });
  assert(!view, 'Claude must have the canvas view off: the plugin ships no MCP server (cli.view must be false).');
  assert(manifest.mcpServers === undefined, 'Claude manifest must not name mcpServers: the plugin ships no MCP server.');
  // A marketplace entry's fields reach the plugin it installs, so a server there would ship too.
  assert(
    marketplace.plugins[0].mcpServers === undefined,
    'Claude marketplace entry must not name mcpServers: the plugin ships no MCP server.',
  );
  checkSkills(pluginRoot, 'Claude', [SETUP_SKILL]);
  // Claude's chat offers the plugin too, but its skills need a shell on the user's computer.
  checkChatNotice(pluginRoot, 'Claude', CHAT_NOTICES['claude-code']);
  // Getting started sets Kombai's server up before the first design chat, which then has the taste card from its first
  // message: a running session never picks up a new MCP server.
  assert(
    fs
      .readFileSync(path.join(pluginRoot, 'skills', SETUP_SKILL, 'SKILL.md'), 'utf8')
      .includes(`npx -y ${contract.cli.package} mcp install claude-code`),
    `Claude ${SETUP_SKILL} skill must run ${contract.cli.package} mcp install claude-code.`,
  );
  return manifest.version;
}

export function bumpClaudeCodeVersion(next, root = workspaceRoot) {
  const current = validateClaudeCodePlugin(root);
  assert(VERSION_RE.test(next), `Invalid Claude plugin version: ${next}`);
  assert(compareVersion(next, current) > 0, `Claude plugin version must increase from ${current}.`);
  for (const file of [
    path.join(root, 'plugins/claude-code/.claude-plugin/plugin.json'),
    path.join(root, 'plugins/claude-code/kombai.package.json'),
  ]) {
    const data = readJson(file);
    data.version = next;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  validateClaudeCodePlugin(root);
  return next;
}

export function packClaudeCodePlugin(
  outputDir = path.join(os.tmpdir(), 'kombai-agent-plugins'),
  root = workspaceRoot,
  { team = false } = {},
) {
  outputDir = path.resolve(outputDir);
  assertPackOutside(outputDir, root, PACKAGE_FILES);
  const version = validateClaudeCodePlugin(root);
  // The team build zips a staged copy that runs the CLI's team build (cli-view.mjs).
  const from = team
    ? stageTeamBuild(root, PACKAGE_FILES, readJson(path.join(root, 'plugins/claude-code/kombai.package.json')))
    : root;
  try {
    if (team) validateClaudeCodePlugin(from, { team });
    fs.mkdirSync(outputDir, { recursive: true });
    const archive = path.join(outputDir, `kombai-claude-code-plugin-${version}${team ? '-team' : ''}.zip`);
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
      result = validateClaudeCodePlugin();
      if (value === '--github-output') {
        assert(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required for --github-output.');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result}\n`);
      }
    } else if (command === 'bump') {
      assert(value && extra.length === 0, 'Usage: bump <version>');
      result = bumpClaudeCodeVersion(value);
    } else if (command === 'pack') {
      const args = [value, ...extra].filter((arg) => arg !== undefined);
      const dirs = args.filter((arg) => arg !== '--team');
      assert(dirs.length <= 1, 'Usage: pack [output-directory] [--team]');
      result = packClaudeCodePlugin(dirs[0] && path.resolve(dirs[0]), undefined, { team: args.includes('--team') });
    } else {
      throw new Error('Usage: claude-code-plugin.mjs <validate|bump|pack>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
