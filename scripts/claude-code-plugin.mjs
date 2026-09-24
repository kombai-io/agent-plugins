import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

export function validateClaudeCodePlugin(root = workspaceRoot) {
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
  assert(VERSION_RE.test(contract.minimumKombaiVersion), 'Invalid minimum Kombai app version.');
  assert(contract.schemaVersion === 'kombai-claude-code-plugin/v1', 'Unexpected Claude package contract schema.');
  assert(contract.mcpServer === 'kombai' && contract.mcpTransport === 'stdio', 'Unexpected MCP contract.');
  assert(
    contract.localMcp?.owner === 'installed-kombai-desktop-app' &&
      JSON.stringify(contract.localMcp.packagedInstallArgs) === JSON.stringify(['mcp', 'install', 'claude-code']),
    'Claude plugin must register through the installed Kombai app.',
  );
  assert(
    JSON.stringify(contract.localMcp.requiredTools) === JSON.stringify(['chat_start', 'chat_status', 'canvas_read']),
    'Unexpected required MCP tools.',
  );
  for (const file of [
    'README.md',
    'kombai.package.json',
    '.claude-plugin/plugin.json',
    'skills/kombai-workflow/SKILL.md',
  ]) {
    assert(fs.statSync(path.join(pluginRoot, file)).isFile(), `Missing Claude plugin file: ${file}`);
  }
  for (const forbidden of ['.mcp.json', 'mcp.json', '.app.json']) {
    assert(
      !fs.existsSync(path.join(pluginRoot, forbidden)),
      `Local MCP config must not ship in the plugin: ${forbidden}`,
    );
  }
  const skillRoot = path.join(pluginRoot, 'skills');
  const skills = fs.readdirSync(skillRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert(skills.length === 1 && skills[0].name === 'kombai-workflow', 'Claude plugin must contain its workflow skill.');
  const skill = fs.readFileSync(path.join(skillRoot, 'kombai-workflow/SKILL.md'), 'utf8');
  assert(/^---\r?\n[\s\S]*?^name: kombai-workflow\r?$/m.test(skill), 'Claude workflow skill name is missing.');
  assert(/^description: \S.+$/m.test(skill), 'Claude workflow skill description is missing.');
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

export function packClaudeCodePlugin(outputDir = path.join(os.tmpdir(), 'kombai-agent-plugins'), root = workspaceRoot) {
  const version = validateClaudeCodePlugin(root);
  fs.mkdirSync(outputDir, { recursive: true });
  const archive = path.join(outputDir, `kombai-claude-code-plugin-${version}.zip`);
  fs.rmSync(archive, { force: true });
  for (const [command, args] of [
    ['zip', ['-q', '-r', archive, ...PACKAGE_FILES]],
    ['unzip', ['-tq', archive]],
  ]) {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return archive;
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
      assert(extra.length === 0, 'Usage: pack [output-directory]');
      result = packClaudeCodePlugin(value && path.resolve(value));
    } else {
      throw new Error('Usage: claude-code-plugin.mjs <validate|bump|pack>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
