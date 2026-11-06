// The directory release of the plugins with the Kombai CLI pinned: OpenAI's and Anthropic's plugin directories take
// no floating npm tag, so the ZIPs submitted to them must run one exact CLI version. The source keeps naming the
// release tag (`@kombai/cli@latest`, RELEASE_CLI_PACKAGE); this script pins a copy, never the source:
//
//   1. the version: the one given (`--cli 0.1.4`), else the one npm's `latest` names now; a plain x.y.z release;
//   2. checks it on npm: the version exists, and its `mcp install` takes the client each chosen plugin's get-started
//      skill runs it for (Codex: `codex`, Claude Code: `claude-code`), so no ZIP pins a CLI older than its skills;
//   3. copies the repository, puts `@kombai/cli@<version>` in place of `@kombai/cli@latest` in each chosen plugin's
//      .md and .json files, and checks nothing there still names a tag;
//   4. packs each chosen plugin from that copy with the plugin's own `pack` (which validates it first), checks the
//      archive names no tag either, and writes it as `kombai-<host>-plugin-<plugin version>-cli-<version>.zip`.
//
// Usage: node scripts/pin-release.mjs [--cli <x.y.z>] [--hosts codex,claude-code|all] [--out <dir>]
// Defaults: npm's latest CLI, the Codex and Claude Code plugins, and `dist/pinned` (which git ignores).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packAntigravityPlugin, validateAntigravityPlugin } from './antigravity-plugin.mjs';
import { packClaudeCodePlugin, validateClaudeCodePlugin } from './claude-code-plugin.mjs';
import { RELEASE_CLI_PACKAGE } from './cli-view.mjs';
import { packCodexPlugin, validateCodexPlugin } from './codex-plugin.mjs';
import { packCursorPlugin, validateCursorPlugin } from './cursor-plugin.mjs';
import { packGeminiCliPlugin, validateGeminiCliPlugin } from './gemini-cli-plugin.mjs';
import { packVsCodePlugin, validateVsCodePlugin } from './vscode-plugin.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_NAME = '@kombai/cli';
/** A released CLI: no tag, no range, no prerelease. */
const RELEASE_VERSION_RE = /^\d+\.\d+\.\d+$/;
/** A Kombai CLI package that names no exact version: a tag (`@latest`, `@beta`, …) or nothing. */
const UNPINNED_RE = /@kombai(?:-io)?\/cli(?!@\d+\.\d+\.\d+\b)(?:@[A-Za-z0-9._-]+)?/g;
/** What the repository copy leaves out: git's own files, installs, earlier builds. */
const NOT_COPIED = new Set(['.git', 'node_modules', 'dist', '.DS_Store']);
/** The directory plugins, packed when no `--hosts` is given. */
const DIRECTORY_HOSTS = ['codex', 'claude-code'];

/**
 * Each plugin this script can pin: its validator and packer (each takes the repository root), and the clients its
 * get-started skill runs `mcp install` for, which the pinned CLI must take.
 */
export const PINNABLE = {
  codex: { validate: validateCodexPlugin, pack: packCodexPlugin, clients: ['codex'] },
  'claude-code': { validate: validateClaudeCodePlugin, pack: packClaudeCodePlugin, clients: ['claude-code'] },
  cursor: { validate: validateCursorPlugin, pack: packCursorPlugin, clients: [] },
  vscode: { validate: validateVsCodePlugin, pack: packVsCodePlugin, clients: [] },
  antigravity: { validate: validateAntigravityPlugin, pack: packAntigravityPlugin, clients: [] },
  'gemini-cli': { validate: validateGeminiCliPlugin, pack: packGeminiCliPlugin, clients: [] },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function filesUnder(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => (entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

const isText = (file) => /\.(md|json)$/.test(file);

/**
 * Every Kombai CLI package in `dir`'s .md and .json files that names no exact version, in file order.
 * @returns {{ file: string, match: string }[]}
 */
export function unpinnedReferences(dir) {
  return filesUnder(dir)
    .filter(isText)
    .flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(UNPINNED_RE)].map(([match]) => ({ file, match })));
}

/** The clients the CLI's `mcp install` takes, from its help's usage line (`kombai mcp install codex|claude-code`). */
function installClients(help) {
  const usage = /mcp install (\S+)/.exec(help);
  return usage ? usage[1].split('|') : [];
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  return result;
}

/** npm as this script asks it, over the network. */
export const npmRegistry = {
  latestVersion() {
    const result = run('npm', ['view', `${CLI_NAME}@latest`, 'version', '--prefer-online']);
    assert(result.status === 0, `npm view ${CLI_NAME}@latest failed: ${result.stderr}`);
    return result.stdout.trim();
  },
  versionExists(version) {
    const result = run('npm', ['view', `${CLI_NAME}@${version}`, 'version', '--prefer-online']);
    return result.status === 0 && result.stdout.trim() === version;
  },
  installHelp(version) {
    const result = run('npx', ['-y', `${CLI_NAME}@${version}`, 'mcp', 'install', '--help']);
    return `${result.stdout}\n${result.stderr}`;
  },
};

/** Copy the repository into a new folder, and pin `version` in each of `hosts`' plugin folders. */
function stagePinnedCopy(root, hosts, version) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-pin-stage-'));
  fs.cpSync(root, stage, {
    recursive: true,
    filter: (from) => !NOT_COPIED.has(path.basename(from)) && !from.endsWith('.zip'),
  });
  const pinned = `${CLI_NAME}@${version}`;
  for (const host of hosts) {
    const pluginRoot = path.join(stage, 'plugins', host);
    const contract = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'kombai.package.json'), 'utf8'));
    assert(
      contract.cli?.package === RELEASE_CLI_PACKAGE,
      `The ${host} plugin must name ${RELEASE_CLI_PACKAGE} to be pinned, not ${contract.cli?.package}.`,
    );
    for (const file of filesUnder(pluginRoot).filter(isText)) {
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes(RELEASE_CLI_PACKAGE)) fs.writeFileSync(file, text.replaceAll(RELEASE_CLI_PACKAGE, pinned));
    }
    const left = unpinnedReferences(pluginRoot).map((ref) => `${path.relative(stage, ref.file)}: ${ref.match}`);
    assert(left.length === 0, `The ${host} plugin still names an unpinned CLI: ${left.join(', ')}`);
  }
  return stage;
}

/** Fail when anything in `archive`'s .md and .json files names an unpinned CLI. */
function assertArchivePinned(archive) {
  const result = spawnSync('unzip', ['-p', archive, '*.md', '*.json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert(result.status === 0, `unzip -p ${archive} failed: ${result.stderr}`);
  const left = [...result.stdout.matchAll(UNPINNED_RE)].map(([match]) => match);
  assert(left.length === 0, `${archive} still names an unpinned CLI: ${[...new Set(left)].join(', ')}`);
}

/**
 * Pin the Kombai CLI in `hosts`' plugins and pack each into `outputDir`. Checks the version on npm before it copies
 * anything, so a refused version packs nothing.
 * @param {{ root?: string, outputDir?: string, hosts?: string[], cliVersion?: string, npm?: typeof npmRegistry }} [options]
 * @returns {{ cliVersion: string, archives: { host: string, archive: string }[] }}
 */
export function releasePinned({
  root = workspaceRoot,
  outputDir = path.join(root, 'dist', 'pinned'),
  hosts = DIRECTORY_HOSTS,
  cliVersion,
  npm = npmRegistry,
} = {}) {
  for (const host of hosts) {
    assert(Object.hasOwn(PINNABLE, host), `No plugin "${host}": use ${Object.keys(PINNABLE).join(', ')}.`);
  }
  const version = cliVersion ?? npm.latestVersion();
  assert(RELEASE_VERSION_RE.test(version), `Pin a released CLI version, x.y.z, not "${version}".`);
  assert(npm.versionExists(version), `${CLI_NAME}@${version} is not on npm.`);
  const needed = hosts.flatMap((host) => PINNABLE[host].clients.map((client) => ({ host, client })));
  if (needed.length > 0) {
    const takes = installClients(npm.installHelp(version));
    for (const { host, client } of needed) {
      assert(
        takes.includes(client),
        `${CLI_NAME}@${version} can't run \`mcp install ${client}\`, which the ${host} plugin runs: ` +
          'release a CLI that can before pinning it.',
      );
    }
  }

  outputDir = path.resolve(outputDir);
  const stage = stagePinnedCopy(root, hosts, version);
  const packed = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-pin-pack-'));
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    const archives = hosts.map((host) => {
      const built = PINNABLE[host].pack(packed, stage);
      assertArchivePinned(built);
      const archive = path.join(outputDir, `${path.basename(built, '.zip')}-cli-${version}.zip`);
      fs.rmSync(archive, { force: true });
      fs.renameSync(built, archive);
      return { host, archive };
    });
    return { cliVersion: version, archives };
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(packed, { recursive: true, force: true });
  }
}

/** `--name value` pairs from argv; refuses anything else. */
function parseArgs(argv) {
  const known = new Set(['--cli', '--hosts', '--out']);
  const usage = 'Usage: pin-release.mjs [--cli <x.y.z>] [--hosts codex,claude-code|all] [--out <dir>]';
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const [name, value] = [argv[i], argv[i + 1]];
    assert(known.has(name) && value !== undefined, usage);
    options[name.slice(2)] = value;
  }
  return {
    cliVersion: options.cli,
    hosts: options.hosts === 'all' ? Object.keys(PINNABLE) : options.hosts?.split(',').filter(Boolean),
    outputDir: options.out,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { cliVersion, hosts, outputDir } = parseArgs(process.argv.slice(2));
    const result = releasePinned({
      cliVersion,
      ...(hosts ? { hosts } : {}),
      ...(outputDir ? { outputDir } : {}),
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
