import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PINNABLE, releasePinned, unpinnedReferences } from './pin-release.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A copy of the repository, without what git ignores.
function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-pin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.cpSync(source, root, {
      recursive: true,
      filter: (from) =>
        !['.git', 'node_modules', 'dist', '.DS_Store'].includes(path.basename(from)) && !from.endsWith('.zip'),
    });
    run(root, temp);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/** npm as the script asks it: what `latest` is, whether a version exists, and what `mcp install --help` prints. */
function fakeNpm({
  latest = '0.1.4',
  published = ['0.1.3', '0.1.4'],
  help = 'kombai mcp install codex|claude-code',
} = {}) {
  const asked = [];
  return {
    asked,
    latestVersion: () => latest,
    versionExists: (version) => published.includes(version),
    installHelp: (version) => {
      asked.push(version);
      return help;
    },
  };
}

/** Every .md and .json file in an archive, as one text. */
function archiveText(archive) {
  const result = spawnSync('unzip', ['-p', archive, '*.md', '*.json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function archiveFile(archive, file) {
  const result = spawnSync('unzip', ['-p', archive, file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('unpinnedReferences finds every CLI package that names no exact version', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-pin-refs-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'SKILL.md'),
      'Run `npx -y @kombai/cli@latest skill`, `npx -y @kombai/cli@beta x`, `npx -y @kombai/cli skill`, ' +
        '`npx -y @kombai-io/cli@next mcp` and `npx -y @kombai/cli@0.1.4 skill`.',
    );
    fs.writeFileSync(path.join(dir, 'kombai.package.json'), JSON.stringify({ cli: { package: '@kombai/cli@0.1.4' } }));
    const found = unpinnedReferences(dir).map((ref) => ref.match);
    assert.deepEqual(found, ['@kombai/cli@latest', '@kombai/cli@beta', '@kombai/cli', '@kombai-io/cli@next']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("pins npm's latest CLI into a copy, packs each directory plugin, and leaves the source alone", () => {
  fixture((root, temp) => {
    const npm = fakeNpm();
    const out = path.join(temp, 'out');
    const result = releasePinned({ root, outputDir: out, npm });
    assert.equal(result.cliVersion, '0.1.4');
    // The directories' plugins, Codex and Claude Code, unless asked for others.
    assert.deepEqual(
      result.archives.map((entry) => entry.host),
      ['codex', 'claude-code'],
    );
    for (const { host, archive } of result.archives) {
      assert.equal(path.dirname(archive), out, host);
      assert.match(path.basename(archive), new RegExp(`^kombai-${host}-plugin-\\d+\\.\\d+\\.\\d+-cli-0\\.1\\.4\\.zip$`));
      const text = archiveText(archive);
      // Nothing in the archive runs a floating tag: reviewers see one exact CLI.
      assert.doesNotMatch(text, /@kombai(-io)?\/cli(?!@0\.1\.4\b)/, host);
      assert.ok(text.includes('npx -y @kombai/cli@0.1.4 skill'), host);
      assert.ok(text.includes(`npx -y @kombai/cli@0.1.4 mcp install ${host}`), host);
      const contract = JSON.parse(archiveFile(archive, `plugins/${host}/kombai.package.json`));
      assert.equal(contract.cli.package, '@kombai/cli@0.1.4', host);
    }
    // The source still names the release tag: only the submitted copy is pinned.
    for (const host of ['codex', 'claude-code']) {
      const skill = fs.readFileSync(path.join(root, 'plugins', host, 'skills/work-with-kombai/SKILL.md'), 'utf8');
      assert.ok(skill.includes('npx -y @kombai/cli@latest skill'), host);
    }
    assert.deepEqual(npm.asked, ['0.1.4']);
    assert.ok(!fs.readdirSync(temp).some((name) => name.startsWith('kombai-pin-stage')), 'no stage left in the fixture');
  });
});

test('takes the version it is given, and refuses a tag, a prerelease or one npm does not have', () => {
  fixture((root, temp) => {
    const out = path.join(temp, 'out');
    const given = releasePinned({ root, outputDir: out, cliVersion: '0.1.3', npm: fakeNpm() });
    assert.equal(given.cliVersion, '0.1.3');
    for (const cliVersion of ['latest', '0.1.4-beta.2', '^0.1.4', 'v0.1.4']) {
      assert.throws(
        () => releasePinned({ root, outputDir: out, cliVersion, npm: fakeNpm() }),
        /a released CLI version, x\.y\.z/,
        cliVersion,
      );
    }
    assert.throws(
      () => releasePinned({ root, outputDir: out, cliVersion: '0.1.9', npm: fakeNpm() }),
      /@kombai\/cli@0\.1\.9 is not on npm/,
    );
  });
});

test("refuses a CLI that can't run the mcp install a plugin's get-started skill runs", () => {
  fixture((root, temp) => {
    const out = path.join(temp, 'out');
    const codexOnly = fakeNpm({ help: 'kombai mcp install codex' });
    assert.throws(
      () => releasePinned({ root, outputDir: out, npm: codexOnly }),
      /@kombai\/cli@0\.1\.4 can't run `mcp install claude-code`, which the claude-code plugin runs/,
    );
    assert.ok(!fs.existsSync(out) || fs.readdirSync(out).length === 0, 'nothing packed');
    // 0.1.3 had no `mcp install` at all.
    assert.throws(
      () => releasePinned({ root, outputDir: out, hosts: ['codex'], npm: fakeNpm({ help: 'unknown command' }) }),
      /can't run `mcp install codex`/,
    );
    assert.equal(releasePinned({ root, outputDir: out, hosts: ['codex'], npm: codexOnly }).archives.length, 1);
  });
});

test('pins any plugin it is asked for, all six included', () => {
  fixture((root, temp) => {
    const out = path.join(temp, 'out');
    const result = releasePinned({ root, outputDir: out, hosts: Object.keys(PINNABLE), npm: fakeNpm() });
    assert.deepEqual(
      result.archives.map((entry) => entry.host),
      Object.keys(PINNABLE),
    );
    for (const { host, archive } of result.archives) {
      assert.doesNotMatch(archiveText(archive), /@kombai(-io)?\/cli(?!@0\.1\.4\b)/, host);
    }
    assert.throws(() => releasePinned({ root, outputDir: out, hosts: ['zed'], npm: fakeNpm() }), /No plugin "zed"/);
  });
});
