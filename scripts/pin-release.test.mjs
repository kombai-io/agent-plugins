import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { npmRegistryWith, PINNABLE, releasePinned, unpinnedReferences } from './pin-release.mjs';

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

/** npm as the script asks it: what a dist-tag names, whether a version exists, and what `mcp install --help` prints. */
function fakeNpm({
  tags = { latest: '0.1.4', beta: '0.1.5-beta.1' },
  published = ['0.1.3', '0.1.4', '0.1.5-beta.1'],
  help = 'kombai mcp install codex|claude-code',
} = {}) {
  const asked = [];
  return {
    asked,
    tagVersion: (tag) => tags[tag],
    versionExists: (version) => published.includes(version),
    installHelp: (version) => {
      asked.push(version);
      return help;
    },
  };
}

/** Every file in an archive but its images, as one text. */
function archiveText(archive) {
  const result = spawnSync('unzip', ['-p', archive, '-x', '*.png'], {
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

test('unpinnedReferences finds every CLI package that is not exactly the pinned one, in any text file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-pin-refs-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'SKILL.md'),
      'Run `npx -y @kombai/cli@latest skill`, `npx -y @kombai/cli@beta x`, `npx -y @kombai/cli skill`, ' +
        '`npx -y @kombai-io/cli@next mcp`, `npx -y @kombai/cli@0.2.0-beta.1 x`, `npx -y @kombai/cli@0.1.3 x`, ' +
        '`npx -y @kombai-io/cli@0.1.4 x` and `npx -y @kombai/cli@0.1.4 skill`; see @kombai/cli@0.1.4.',
    );
    fs.writeFileSync(path.join(dir, 'kombai.package.json'), JSON.stringify({ cli: { package: '@kombai/cli@0.1.4' } }));
    // A host's own metadata (Codex's agents/openai.yaml) is text too; an image is not read.
    fs.writeFileSync(path.join(dir, 'openai.yaml'), 'default_prompt: "Run npx -y @kombai/cli@latest skill"\n');
    fs.writeFileSync(path.join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x40, 0x6b]));
    const found = unpinnedReferences(dir, '0.1.4').map((ref) => `${path.basename(ref.file)}: ${ref.match}`);
    // In file order, by name.
    assert.deepEqual(found, [
      'openai.yaml: @kombai/cli@latest',
      'SKILL.md: @kombai/cli@latest',
      'SKILL.md: @kombai/cli@beta',
      'SKILL.md: @kombai/cli',
      'SKILL.md: @kombai-io/cli@next',
      'SKILL.md: @kombai/cli@0.2.0-beta.1',
      'SKILL.md: @kombai/cli@0.1.3',
      'SKILL.md: @kombai-io/cli@0.1.4',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** The script's folders in the system temp folder, so a test can tell it left none. */
const pinTemps = () => fs.readdirSync(os.tmpdir()).filter((name) => /^kombai-pin-(stage|pack)-/.test(name));

test("pins npm's latest CLI into a copy, packs each directory plugin, and leaves the source alone", () => {
  fixture((root, temp) => {
    const before = pinTemps();
    // A host's own text file names the CLI too: it is pinned like the skills.
    const yaml = path.join(root, 'plugins/codex/skills/get-started-with-kombai/agents/openai.yaml');
    fs.appendFileSync(yaml, '# runs npx -y @kombai/cli@latest skill\n');
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
      if (host === 'codex') {
        const shipped = archiveFile(archive, 'plugins/codex/skills/get-started-with-kombai/agents/openai.yaml');
        assert.ok(shipped.includes('npx -y @kombai/cli@0.1.4 skill'));
      }
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
    assert.deepEqual(pinTemps(), before, 'no staged copy or pack folder left behind');
  });
});

test('a pack that fails leaves no ZIP from the run and no temp folder', () => {
  fixture((root, temp) => {
    const before = pinTemps();
    const out = path.join(temp, 'out');
    // Codex packs first; the Claude Code plugin then fails its own validation (no MCP config may ship).
    fs.writeFileSync(path.join(root, 'plugins/claude-code/mcp.json'), '{}');
    assert.throws(() => releasePinned({ root, outputDir: out, npm: fakeNpm() }), /mcp\.json/);
    assert.ok(!fs.existsSync(out) || fs.readdirSync(out).length === 0, 'no Codex ZIP beside an older run');
    assert.deepEqual(pinTemps(), before);
    // Staging that fails (a plugin that names no release tag) cleans up too.
    const contract = path.join(root, 'plugins/codex/kombai.package.json');
    fs.writeFileSync(contract, fs.readFileSync(contract, 'utf8').replace('@kombai/cli@latest', '@kombai/cli@beta'));
    fs.rmSync(path.join(root, 'plugins/claude-code/mcp.json'));
    assert.throws(() => releasePinned({ root, outputDir: out, npm: fakeNpm() }), /must name @kombai\/cli@latest/);
    assert.deepEqual(pinTemps(), before);
  });
});

test('pins the beta for a trial run when asked, and only a beta version there', () => {
  fixture((root, temp) => {
    const out = path.join(temp, 'out');
    const result = releasePinned({ root, outputDir: out, channel: 'beta', npm: fakeNpm() });
    assert.equal(result.cliVersion, '0.1.5-beta.1');
    for (const { host, archive } of result.archives) {
      assert.match(path.basename(archive), new RegExp(`^kombai-${host}-plugin-\\d+\\.\\d+\\.\\d+-cli-0\\.1\\.5-beta\\.1\\.zip$`));
      const text = archiveText(archive);
      assert.ok(text.includes('npx -y @kombai/cli@0.1.5-beta.1 skill'), host);
      assert.doesNotMatch(text, /@kombai\/cli@latest|@kombai\/cli@beta\b/, host);
    }
    assert.throws(
      () => releasePinned({ root, outputDir: out, channel: 'beta', cliVersion: '0.1.4', npm: fakeNpm() }),
      /A beta pin takes a beta version, x\.y\.z-beta\.n, not "0\.1\.4"/,
    );
    assert.throws(() => releasePinned({ root, outputDir: out, channel: 'alpha', npm: fakeNpm() }), /channel "alpha"/);
  });
});

test("reads the CLI's usage line however it brackets the clients", () => {
  fixture((root, temp) => {
    for (const help of ['Usage: kombai mcp install [codex|claude-code]', 'kombai mcp install <codex|claude-code>']) {
      const result = releasePinned({ root, outputDir: path.join(temp, 'out'), npm: fakeNpm({ help }) });
      assert.equal(result.archives.length, 2, help);
    }
  });
});

test('tells a network failure from a version npm does not have', () => {
  const answers = (status, stdout, stderr) => () => ({ status, stdout, stderr });
  // npm view: E404 is "not on npm"; anything else is npm failing, and says why.
  assert.equal(npmRegistryWith(answers(0, '0.1.4\n', '')).versionExists('0.1.4'), true);
  assert.equal(npmRegistryWith(answers(0, '', '')).versionExists('0.1.9'), false);
  assert.equal(npmRegistryWith(answers(1, '', 'npm error code E404\n')).versionExists('0.1.9'), false);
  assert.throws(
    () => npmRegistryWith(answers(1, '', 'npm error code ENOTFOUND\nnpm error network')).versionExists('0.1.4'),
    /npm view @kombai\/cli@0\.1\.4 failed: npm error code ENOTFOUND/,
  );
  assert.throws(() => npmRegistryWith(answers(1, '', 'npm error code EAI_AGAIN')).tagVersion('latest'), /EAI_AGAIN/);
  assert.equal(npmRegistryWith(answers(0, '0.1.5-beta.1\n', '')).tagVersion('beta'), '0.1.5-beta.1');
  // npx: npm failing to fetch the CLI is no answer from the CLI; the CLI refusing the command is one.
  assert.throws(
    () => npmRegistryWith(answers(1, '', 'npm error code ENOTFOUND')).installHelp('0.1.4'),
    /npx couldn't run @kombai\/cli@0\.1\.4: npm error code ENOTFOUND/,
  );
  assert.match(
    npmRegistryWith(answers(1, '{"error":{"code":"CLI_UNKNOWN_COMMAND"}}', '')).installHelp('0.1.3'),
    /CLI_UNKNOWN_COMMAND/,
  );
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
