import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PACKAGE_FILES = ['.codex-plugin', 'assets', 'skills', 'README.md', 'kombai.package.json', 'LICENSE'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function requireFile(file) {
  if (!fs.statSync(file).isFile()) throw new Error(`Expected a file: ${file}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateCodexPlugin(root = workspaceRoot) {
  const pluginRoot = path.join(root, 'plugins/codex');
  const manifest = readJson(path.join(pluginRoot, '.codex-plugin/plugin.json'));
  const contract = readJson(path.join(pluginRoot, 'kombai.package.json'));

  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );

  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'Codex plugin names must be kombai.');
  assert(VERSION_RE.test(manifest.version), `Invalid Codex plugin version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'Codex manifest and package contract versions must match.');
  assert(VERSION_RE.test(contract.minimumKombaiVersion), 'Invalid minimum Kombai app version.');
  assert(contract.schemaVersion === 'kombai-codex-plugin/v1', 'Unexpected Codex package contract schema.');
  assert(contract.mcpServer === 'kombai' && contract.mcpTransport === 'stdio', 'Unexpected MCP contract.');
  assert(
    contract.localMcp?.owner === 'installed-kombai-desktop-app' &&
      JSON.stringify(contract.localMcp.packagedInstallArgs) === JSON.stringify(['mcp', 'install', 'codex']),
    'Codex plugin must register through the installed Kombai app.',
  );
  assert(manifest.skills === './skills/', 'Codex manifest must point at ./skills/.');

  for (const relative of PACKAGE_FILES) {
    assert(fs.existsSync(path.join(pluginRoot, relative)), `Missing Codex package content: ${relative}`);
  }
  for (const field of ['composerIcon', 'logo']) {
    const relative = manifest.interface?.[field];
    assert(typeof relative === 'string' && relative.startsWith('./assets/'), `Invalid ${field} path.`);
    requireFile(path.join(pluginRoot, relative));
  }
  for (const forbidden of ['.mcp.json', 'mcp.json', '.app.json']) {
    assert(
      !fs.existsSync(path.join(pluginRoot, forbidden)),
      `Local MCP config must not ship in the plugin: ${forbidden}`,
    );
  }

  const skillsRoot = path.join(pluginRoot, 'skills');
  const skills = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert(skills.length > 0, 'Codex plugin must contain at least one skill.');
  for (const skill of skills) {
    const skillFile = path.join(skillsRoot, skill.name, 'SKILL.md');
    requireFile(skillFile);
    const body = fs.readFileSync(skillFile, 'utf8');
    const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    assert(frontmatter, `Missing skill frontmatter: ${skill.name}`);
    assert(new RegExp(`^name: ${skill.name}$`, 'm').test(frontmatter[1]), `Wrong skill name: ${skill.name}`);
    assert(/^description: \S.+$/m.test(frontmatter[1]), `Missing skill description: ${skill.name}`);
  }
  requireFile(path.join(pluginRoot, 'README.md'));
  return manifest.version;
}

function compareNumericVersion(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export function bumpCodexVersion(next, root = workspaceRoot) {
  validateCodexPlugin(root);
  assert(VERSION_RE.test(next), `Invalid Codex plugin version: ${next}`);
  const files = [
    path.join(root, 'plugins/codex/.codex-plugin/plugin.json'),
    path.join(root, 'plugins/codex/kombai.package.json'),
  ];
  const current = readJson(files[0]).version;
  assert(compareNumericVersion(next, current) > 0, `Codex plugin version must increase from ${current}.`);
  for (const file of files) {
    const data = readJson(file);
    data.version = next;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  validateCodexPlugin(root);
  return next;
}

export function packCodexPlugin(outputDir = path.join(os.tmpdir(), 'kombai-agent-plugins'), root = workspaceRoot) {
  const version = validateCodexPlugin(root);
  fs.mkdirSync(outputDir, { recursive: true });
  const archive = path.join(outputDir, `kombai-codex-plugin-${version}.zip`);
  fs.rmSync(archive, { force: true });
  const cwd = path.join(root, 'plugins/codex');
  for (const [command, args] of [
    ['zip', ['-q', '-r', archive, ...PACKAGE_FILES]],
    ['unzip', ['-tq', archive]],
  ]) {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
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
      result = validateCodexPlugin();
      if (value === '--github-output') {
        assert(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required for --github-output.');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result}\n`);
      }
    } else if (command === 'bump') {
      assert(value && extra.length === 0, 'Usage: bump <version>');
      result = bumpCodexVersion(value);
    } else if (command === 'pack') {
      assert(extra.length === 0, 'Usage: pack [output-directory]');
      result = packCodexPlugin(value && path.resolve(value));
    } else {
      throw new Error('Usage: codex-plugin.mjs <validate|bump|pack>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
