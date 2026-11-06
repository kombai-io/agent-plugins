// The directory release of the plugins with the Kombai CLI pinned: OpenAI's and Anthropic's plugin directories take
// no floating npm tag, so the ZIPs submitted to them must run one exact CLI version. The source keeps naming the
// release tag (`@kombai/cli@latest`, RELEASE_CLI_PACKAGE); this script pins a copy, never the source:
//
//   1. the version: the one given (`--cli 0.1.4`), else the one npm's `latest` names now; a plain x.y.z release;
//   2. checks it on npm: the version exists, and its `mcp install` takes the client each chosen plugin's get-started
//      skill runs it for (Codex: `codex`, Claude Code: `claude-code`), so no ZIP pins a CLI older than its skills;
//   3. copies the repository, puts `@kombai/cli@<version>` in place of `@kombai/cli@latest` in every text file of
//      each chosen plugin, and checks every Kombai CLI package named there is exactly that one;
//   4. packs each chosen plugin from that copy with the plugin's own `pack` (which validates it first) and checks the
//      archive the same way; only when every plugin packed does it write them, as
//      `kombai-<host>-plugin-<plugin version>-cli-<version>.zip`.
//
// Usage: node scripts/pin-release.mjs [--cli <x.y.z>] [--hosts codex,claude-code|all] [--out <dir>]
// Defaults: npm's latest CLI, the Codex and Claude Code plugins, and `dist/pinned` (which git ignores).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packAntigravityPlugin } from './antigravity-plugin.mjs';
import { packClaudeCodePlugin } from './claude-code-plugin.mjs';
import { RELEASE_CLI_PACKAGE } from './cli-view.mjs';
import { packCodexPlugin } from './codex-plugin.mjs';
import { packCursorPlugin } from './cursor-plugin.mjs';
import { packGeminiCliPlugin } from './gemini-cli-plugin.mjs';
import { packVsCodePlugin } from './vscode-plugin.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_NAME = '@kombai/cli';
/** A released CLI: no tag, no range, no prerelease. */
const RELEASE_VERSION_RE = /^\d+\.\d+\.\d+$/;
/** Every Kombai CLI package a text names, with whatever tag or version follows it. */
const CLI_REFERENCE_RE = /@kombai(?:-io)?\/cli(?:@[A-Za-z0-9._+-]+)?/g;
/** What the repository copy leaves out: git's own files, installs, earlier builds. */
const NOT_COPIED = new Set(['.git', 'node_modules', 'dist', '.DS_Store']);
/** Files the plugins ship that are no text: never rewritten, and left out of the archive check. */
const BINARY_PATTERNS = ['*.png', '*.jpg', '*.jpeg', '*.gif', '*.ico', '*.webp', '*.woff', '*.woff2'];
/** The directory plugins, packed when no `--hosts` is given. */
const DIRECTORY_HOSTS = ['codex', 'claude-code'];

/** Each plugin this script can pin: its packer (which validates first), and the clients its get-started skill runs
 *  `mcp install` for, which the pinned CLI must take. */
export const PINNABLE = {
  codex: { pack: packCodexPlugin, clients: ['codex'] },
  'claude-code': { pack: packClaudeCodePlugin, clients: ['claude-code'] },
  cursor: { pack: packCursorPlugin, clients: [] },
  vscode: { pack: packVsCodePlugin, clients: [] },
  antigravity: { pack: packAntigravityPlugin, clients: [] },
  'gemini-cli': { pack: packGeminiCliPlugin, clients: [] },
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

/** A file's text, or null when it holds a NUL byte (an image, a font). */
function textOf(file) {
  const bytes = fs.readFileSync(file);
  return bytes.includes(0) ? null : bytes.toString('utf8');
}

/** The Kombai CLI packages `text` names that are not exactly `@kombai/cli@<version>`. */
function strayReferences(text, version) {
  const pinned = `${CLI_NAME}@${version}`;
  // A sentence may end right after a version: its full stop is no part of it.
  return [...text.matchAll(CLI_REFERENCE_RE)].map(([match]) => match.replace(/\.+$/, '')).filter((m) => m !== pinned);
}

/**
 * Every Kombai CLI package in `dir`'s text files that is not exactly `@kombai/cli@<version>`: a tag, nothing, another
 * version (a prerelease included) or the internal package. In file order.
 * @returns {{ file: string, match: string }[]}
 */
export function unpinnedReferences(dir, version) {
  return filesUnder(dir).flatMap((file) => {
    const text = textOf(file);
    return text === null ? [] : strayReferences(text, version).map((match) => ({ file, match }));
  });
}

/** The clients the CLI's `mcp install` takes, from its help's usage line (`kombai mcp install codex|claude-code`,
 *  bracketed or not). */
function installClients(help) {
  const usage = /mcp install\s+(\S+)/.exec(help);
  return usage ? usage[1].replace(/[[\]<>()]/g, '').split('|') : [];
}

function spawn(command, args) {
  // npm and npx are .cmd files on Windows, which Node runs only through a shell; every argument here is a constant or
  // a checked x.y.z, so none needs quoting.
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  return result;
}

/** npm's own errors, as npm prints them: what tells npm failing from the CLI answering. */
const NPM_ERROR_RE = /npm (?:error|ERR!)/;

/**
 * npm as this script asks it, through `run` (spawnSync's result shape): what `latest` is, whether a version exists, and
 * what `mcp install --help` prints. A failing npm says why rather than passing for "no such version".
 */
export function npmRegistryWith(run) {
  return {
    latestVersion() {
      const result = run('npm', ['view', `${CLI_NAME}@latest`, 'version', '--prefer-online']);
      assert(result.status === 0, `npm view ${CLI_NAME}@latest failed: ${result.stderr.trim()}`);
      return result.stdout.trim();
    },
    versionExists(version) {
      const result = run('npm', ['view', `${CLI_NAME}@${version}`, 'version', '--prefer-online']);
      if (result.status === 0) return result.stdout.trim() === version;
      if (/\bE404\b/.test(result.stderr)) return false;
      throw new Error(`npm view ${CLI_NAME}@${version} failed: ${result.stderr.trim()}`);
    },
    installHelp(version) {
      const result = run('npx', ['-y', `${CLI_NAME}@${version}`, 'mcp', 'install', '--help']);
      if (result.status !== 0 && NPM_ERROR_RE.test(result.stderr)) {
        throw new Error(`npx couldn't run ${CLI_NAME}@${version}: ${result.stderr.trim()}`);
      }
      return `${result.stdout}\n${result.stderr}`;
    },
  };
}

/** npm over the network. */
export const npmRegistry = npmRegistryWith(spawn);

/** Copy the repository into `stage`, and pin `version` in every text file of each of `hosts`' plugin folders. */
function stagePinnedCopy(root, stage, hosts, version) {
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
    for (const file of filesUnder(pluginRoot)) {
      const text = textOf(file);
      if (text?.includes(RELEASE_CLI_PACKAGE)) fs.writeFileSync(file, text.replaceAll(RELEASE_CLI_PACKAGE, pinned));
    }
    const left = unpinnedReferences(pluginRoot, version).map((ref) => `${path.relative(stage, ref.file)}: ${ref.match}`);
    assert(left.length === 0, `The ${host} plugin names a CLI other than ${pinned}: ${left.join(', ')}`);
  }
}

/** Fail when anything but an image in `archive` names a CLI other than `@kombai/cli@<version>`. */
function assertArchivePinned(archive, version) {
  const result = spawnSync('unzip', ['-p', archive, '-x', ...BINARY_PATTERNS], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert(result.status === 0, `unzip -p ${archive} failed: ${result.stderr}`);
  const left = strayReferences(result.stdout, version);
  assert(left.length === 0, `${archive} names a CLI other than ${CLI_NAME}@${version}: ${[...new Set(left)].join(', ')}`);
}

/**
 * Pin the Kombai CLI in `hosts`' plugins and pack each into `outputDir`. Checks the version on npm before it copies
 * anything, and writes no ZIP unless every plugin packed, so a failed run leaves the output folder as it was.
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
    const help = npm.installHelp(version);
    const takes = installClients(help);
    const said = help.trim().split('\n')[0];
    for (const { host, client } of needed) {
      assert(
        takes.includes(client),
        `${CLI_NAME}@${version} can't run \`mcp install ${client}\`, which the ${host} plugin runs: ` +
          `release a CLI that can before pinning it (it answered: ${said}).`,
      );
    }
  }

  outputDir = path.resolve(outputDir);
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-pin-stage-'));
  const packed = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-pin-pack-'));
  try {
    stagePinnedCopy(root, stage, hosts, version);
    const built = hosts.map((host) => {
      const archive = PINNABLE[host].pack(packed, stage);
      assertArchivePinned(archive, version);
      return { host, archive };
    });
    // Every plugin packed: only now does anything reach the output folder. Copied, not renamed, as the system temp
    // folder may sit on another disk.
    fs.mkdirSync(outputDir, { recursive: true });
    const archives = built.map(({ host, archive }) => {
      const target = path.join(outputDir, `${path.basename(archive, '.zip')}-cli-${version}.zip`);
      fs.copyFileSync(archive, target);
      return { host, archive: target };
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
