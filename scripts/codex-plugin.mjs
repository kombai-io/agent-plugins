import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkCliContract, checkSkills, CODEX_SETUP_SKILL, stageTeamBuild, STRAY_FILE } from './cli-view.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
// Plus `.mcp.json` while the contract has the canvas view on (cli-view.mjs).
const PLUGIN_FILES = ['.codex-plugin', 'assets', 'skills', 'README.md', 'kombai.package.json', 'LICENSE'];
const MARKETPLACE_FILE = '.agents/plugins/marketplace.json';

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
  const marketplace = readJson(path.join(root, MARKETPLACE_FILE));
  const manifest = readJson(path.join(pluginRoot, '.codex-plugin/plugin.json'));
  const contract = readJson(path.join(pluginRoot, 'kombai.package.json'));

  assert(marketplace.name === 'kombai', 'Codex marketplace name must be kombai.');
  assert(
    marketplace.plugins?.length === 1 &&
      marketplace.plugins[0].name === 'kombai' &&
      marketplace.plugins[0].source?.source === 'local' &&
      marketplace.plugins[0].source.path === './plugins/codex',
    'Codex marketplace must point to the bundled plugin at ./plugins/codex.',
  );

  assert(
    fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    'Plugin license must match the repository LICENSE.',
  );

  assert(manifest.name === 'kombai' && contract.name === manifest.name, 'Codex plugin names must be kombai.');
  assert(VERSION_RE.test(manifest.version), `Invalid Codex plugin version: ${manifest.version}`);
  assert(manifest.version === contract.version, 'Codex manifest and package contract versions must match.');
  assert(contract.schemaVersion === 'kombai-codex-plugin/v2', 'Unexpected Codex package contract schema.');
  assert(manifest.skills === './skills/', 'Codex manifest must point at ./skills/.');
  // The skills run the Kombai CLI on the user's computer, which OpenAI's directory lists as desktop-only.
  assert(manifest.requires_local_executor === true, 'Codex manifest must set requires_local_executor to true.');

  for (const relative of PLUGIN_FILES) {
    assert(fs.existsSync(path.join(pluginRoot, relative)), `Missing Codex package content: ${relative}`);
  }
  for (const field of ['composerIcon', 'logo']) {
    const relative = manifest.interface?.[field];
    assert(typeof relative === 'string' && relative.startsWith('./assets/'), `Invalid ${field} path.`);
    requireFile(path.join(pluginRoot, relative));
  }
  if (checkCliContract(pluginRoot, contract, 'Codex')) {
    assert(manifest.mcpServers === './.mcp.json', 'Codex manifest must point mcpServers at ./.mcp.json.');
  } else {
    assert(manifest.mcpServers === undefined, 'Codex manifest must not name mcpServers while the canvas view is off.');
  }

  checkSkills(pluginRoot, 'Codex', [CODEX_SETUP_SKILL]);
  // Setup right after install adds Kombai's view, so the user's first design chat has it from its first message.
  assert(
    manifest.onboardingSkill === `./skills/${CODEX_SETUP_SKILL}/SKILL.md`,
    `Codex manifest must set onboardingSkill to ./skills/${CODEX_SETUP_SKILL}/SKILL.md.`,
  );
  assert(
    fs
      .readFileSync(path.join(pluginRoot, 'skills', CODEX_SETUP_SKILL, 'SKILL.md'), 'utf8')
      .includes(`npx -y ${contract.cli.package} mcp install codex`),
    `Codex ${CODEX_SETUP_SKILL} skill must run ${contract.cli.package} mcp install codex.`,
  );
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

export function packCodexPlugin(
  outputDir = path.join(os.tmpdir(), 'kombai-agent-plugins'),
  root = workspaceRoot,
  { team = false } = {},
) {
  outputDir = path.resolve(outputDir);
  const version = validateCodexPlugin(root);
  const pluginRoot = path.join(root, 'plugins/codex');
  // Validation has checked that .mcp.json is there exactly when the canvas view is on.
  const pluginFiles = fs.existsSync(path.join(pluginRoot, '.mcp.json')) ? [...PLUGIN_FILES, '.mcp.json'] : PLUGIN_FILES;
  // marketplace add needs the catalog and its source path to exist in the extracted archive.
  const files = [MARKETPLACE_FILE, 'LICENSE', ...pluginFiles.map((file) => `plugins/codex/${file}`)];
  // The team build zips a staged copy that runs the CLI's team build (cli-view.mjs).
  const from = team ? stageTeamBuild(root, files, readJson(path.join(pluginRoot, 'kombai.package.json'))) : root;
  try {
    if (team) validateCodexPlugin(from);
    fs.mkdirSync(outputDir, { recursive: true });
    const archive = path.join(outputDir, `kombai-codex-plugin-${version}${team ? '-team' : ''}.zip`);
    fs.rmSync(archive, { force: true });
    for (const [command, args] of [
      ['zip', ['-q', '-r', archive, ...files, '-x', `*${STRAY_FILE}`]],
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
      result = validateCodexPlugin();
      if (value === '--github-output') {
        assert(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required for --github-output.');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result}\n`);
      }
    } else if (command === 'bump') {
      assert(value && extra.length === 0, 'Usage: bump <version>');
      result = bumpCodexVersion(value);
    } else if (command === 'pack') {
      const args = [value, ...extra].filter((arg) => arg !== undefined);
      const dirs = args.filter((arg) => arg !== '--team');
      assert(dirs.length <= 1, 'Usage: pack [output-directory] [--team]');
      result = packCodexPlugin(dirs[0] && path.resolve(dirs[0]), undefined, { team: args.includes('--team') });
    } else {
      throw new Error('Usage: codex-plugin.mjs <validate|bump|pack>');
    }
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
