// The Kombai CLI the plugins run, pinned in the source: OpenAI's and Anthropic's plugin directories refuse a plugin
// that runs a floating npm tag (the CLI's `latest`), so every plugin names one released CLI version
// (`cli.package` in its kombai.package.json, and every skill, README and other file that names the CLI). One command
// moves them all:
//
//   pnpm run set-cli-version <x.y.z>
//
//   1. refuses a tag (`latest`, `beta`, …), a range or a prerelease: the plugins are release plugins (team builds run
//      the beta from a staged copy, `pack --team`);
//   2. checks the version on npm: it exists, and its `mcp install` takes every client a plugin's skill runs it for
//      (Codex: `codex`, Claude Code: `claude-code`), so no plugin pins a CLI older than its skills;
//   3. names `@kombai/cli@<version>` in place of whatever CLI version or tag each file under PINNED_PATHS names;
//   4. checks the result: `check` below, and every plugin's validator.
//
// `node scripts/cli-version.mjs check` (part of `pnpm run check`) fails unless every plugin pins the same released
// CLI and every file outside the plugins (CHECKED_PATHS) names that one and no other. Each plugin's validator checks
// its own folder and the files its pack zips beside it (its marketplace) the same way, so `pnpm run check`, which
// runs both, reads each file once.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateAntigravityPlugin } from './antigravity-plugin.mjs';
import { validateClaudeCodePlugin } from './claude-code-plugin.mjs';
import {
  assertNoStrayCli,
  CLI_NAME,
  filesUnder,
  isReleaseCliPackage,
  PINNABLE_REFERENCE_RE,
  RELEASE_VERSION_RE,
  strayCliReferences,
  textOf,
  withoutFullStop,
} from './cli-view.mjs';
import { validateCodexPlugin } from './codex-plugin.mjs';
import { validateCursorPlugin } from './cursor-plugin.mjs';
import { validateGeminiCliPlugin } from './gemini-cli-plugin.mjs';
import { validateVsCodePlugin } from './vscode-plugin.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Each plugin under plugins/, with its validator. */
export const PLUGINS = {
  codex: validateCodexPlugin,
  'claude-code': validateClaudeCodePlugin,
  cursor: validateCursorPlugin,
  vscode: validateVsCodePlugin,
  antigravity: validateAntigravityPlugin,
  'gemini-cli': validateGeminiCliPlugin,
};
/** What names the CLI the plugins run, and set-cli-version moves: every text file under these (folders, or a file).
 *  The marketplaces ship in the packs too. */
export const PINNED_PATHS = ['plugins', 'skills', 'README.md', '.agents', '.claude-plugin', '.cursor-plugin', '.github/plugin'];
/** The pinned paths no plugin validator reads, which `check` reads instead. */
export const CHECKED_PATHS = ['skills', 'README.md'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Every pinned text file, with its text. */
function pinnedFiles(root) {
  return PINNED_PATHS.flatMap((relative) => filesUnder(path.join(root, relative)))
    .map((file) => ({ file, text: textOf(file) }))
    .filter(({ text }) => text !== null);
}

/** The CLI every plugin pins (`cli.package`), which must be one released version for all of them. */
export function pinnedCliPackage(root = workspaceRoot) {
  const pins = Object.keys(PLUGINS).map((host) => ({
    host,
    cliPackage: readJson(path.join(root, 'plugins', host, 'kombai.package.json')).cli?.package,
  }));
  const distinct = [...new Set(pins.map(({ cliPackage }) => cliPackage))];
  assert(
    distinct.length === 1,
    `Every plugin must pin the same CLI: ${pins.map(({ host, cliPackage }) => `${host} ${cliPackage}`).join(', ')}. ` +
      'Run pnpm run set-cli-version <x.y.z>.',
  );
  assert(
    isReleaseCliPackage(distinct[0]),
    `The plugins must pin a released CLI, ${CLI_NAME}@x.y.z, not ${distinct[0]}: run pnpm run set-cli-version <x.y.z>.`,
  );
  return distinct[0];
}

/**
 * Check that every plugin pins the same released CLI and every file outside the plugins (CHECKED_PATHS) names it and
 * no other: no tag, no other version. The plugin validators check the rest. Returns the pinned package.
 */
export function checkCliVersion(root = workspaceRoot) {
  const cliPackage = pinnedCliPackage(root);
  assertNoStrayCli(
    CHECKED_PATHS.flatMap((relative) => strayCliReferences(path.join(root, relative), cliPackage)),
    root,
    cliPackage,
    'Every file must name only the CLI the plugins pin',
  );
  return cliPackage;
}

/** The clients the CLI's `mcp install` takes, from its help's usage line (`kombai mcp install codex|claude-code`,
 *  bracketed or not). */
export function installClients(help) {
  const usage = /mcp install\s+(\S+)/.exec(help);
  return usage ? usage[1].replace(/[[\]<>()]/g, '').split('|') : [];
}

/** The clients the plugins' skills run `mcp install` for (`npx -y <cli> mcp install codex`, even split across lines),
 *  which the pinned CLI must take. */
export function requiredInstallClients(root = workspaceRoot) {
  const clients = new Set();
  for (const host of Object.keys(PLUGINS)) {
    for (const file of filesUnder(path.join(root, 'plugins', host, 'skills'))) {
      const text = textOf(file) ?? '';
      for (const [, client] of text.matchAll(/npx\s+-y\s+@kombai\/cli@\S+\s+mcp\s+install\s+([a-z][a-z-]*)/g)) clients.add(client);
    }
  }
  return [...clients].sort();
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
 * npm as this script asks it, through `run` (spawnSync's result shape): whether a version exists, and what its
 * `mcp install --help` prints. A failing npm says why rather than passing for "no such version".
 */
export function npmRegistryWith(run) {
  return {
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

/**
 * Pin `version` of the Kombai CLI in every plugin and every file that names it, after checking it on npm. Returns the
 * pinned package and the files it changed (relative to `root`).
 * @param {string} version
 * @param {{ root?: string, npm?: typeof npmRegistry }} [options]
 * @returns {{ cliPackage: string, changed: string[] }}
 */
export function setCliVersion(version, { root = workspaceRoot, npm = npmRegistry } = {}) {
  assert(
    typeof version === 'string' && RELEASE_VERSION_RE.test(version),
    `Pin a released CLI version, x.y.z, not "${version}": the plugin directories refuse a tag, and the plugins ` +
      "don't run a prerelease (a team build runs the beta: pack --team).",
  );
  assert(npm.versionExists(version), `${CLI_NAME}@${version} is not on npm.`);
  const clients = requiredInstallClients(root);
  if (clients.length > 0) {
    const help = npm.installHelp(version);
    const takes = installClients(help);
    const said = help.trim().split('\n')[0];
    for (const client of clients) {
      assert(
        takes.includes(client),
        `${CLI_NAME}@${version} can't run \`mcp install ${client}\`, which a plugin's skill runs: ` +
          `release a CLI that can before pinning it (it answered: ${said}).`,
      );
    }
  }

  const cliPackage = `${CLI_NAME}@${version}`;
  const originals = [];
  try {
    for (const { file, text } of pinnedFiles(root)) {
      // A sentence may end right after a version: its full stop stays.
      const next = text.replace(PINNABLE_REFERENCE_RE, (match) => cliPackage + match.slice(withoutFullStop(match).length));
      if (next !== text) {
        originals.push({ file, text });
        fs.writeFileSync(file, next);
      }
    }
    checkCliVersion(root);
    for (const validate of Object.values(PLUGINS)) validate(root);
  } catch (error) {
    // A pin that doesn't validate leaves the files as they were: every file is restored, even when one can't be.
    const failed = [];
    for (const { file, text } of originals) {
      try {
        fs.writeFileSync(file, text);
      } catch (restoreError) {
        failed.push(restoreError);
      }
    }
    if (failed.length === 0) throw error;
    throw new AggregateError(
      [error, ...failed],
      `${error instanceof Error ? error.message : String(error)} Restoring ${failed.length} of the rewritten files ` +
        'failed too: git checkout them.',
    );
  }
  return { cliPackage, changed: originals.map(({ file }) => path.relative(root, file).split(path.sep).join('/')) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , command, value, ...extra] = process.argv;
    if (command === 'check') {
      assert(value === undefined, 'Usage: cli-version.mjs check');
      console.log(checkCliVersion());
    } else if (command === 'set') {
      assert(value && extra.length === 0, 'Usage: cli-version.mjs set <x.y.z>');
      console.log(JSON.stringify(setCliVersion(value), null, 2));
    } else {
      throw new Error('Usage: cli-version.mjs <check|set <x.y.z>>');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
