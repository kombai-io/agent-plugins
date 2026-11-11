import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { filesBesidePlugin, stageTeamBuild } from './cli-view.mjs';
import { packCodexPlugin } from './codex-plugin.mjs';
import {
  checkCliVersion,
  installClients,
  npmRegistryWith,
  pinnedCliPackage,
  PINNED_PATHS,
  PLUGINS,
  requiredInstallClients,
  setCliVersion,
} from './cli-version.mjs';

// The tag the source used to run, spelled in two parts so a repository grep for it finds nothing.
const LATEST = `@kombai/cli@${'latest'}`;

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A copy of the repository, without what git ignores.
function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-cli-version-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.cpSync(source, root, {
      recursive: true,
      filter: (from) =>
        !['.git', 'node_modules', 'dist', '.DS_Store'].includes(path.basename(from)) && !from.endsWith('.zip'),
    });
    run(root);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/** npm as the script asks it: whether a version exists, and what its `mcp install --help` prints. */
/** A release no pin in this repository ever names, so a test that moves the pin always moves it. */
const NEXT = '9.9.9';

function fakeNpm({ published = ['0.1.4', '0.1.5', '0.1.5-beta.1', NEXT], help = 'kombai mcp install codex|claude-code' } = {}) {
  const asked = [];
  return {
    asked,
    versionExists: (version) => published.includes(version),
    installHelp: (version) => {
      asked.push(version);
      return help;
    },
  };
}

/** Every pinned text file's contents, by path. */
function snapshot(root) {
  const files = {};
  const walk = (target) => {
    if (!fs.existsSync(target)) return;
    if (fs.statSync(target).isDirectory()) {
      for (const name of fs.readdirSync(target)) walk(path.join(target, name));
    } else {
      files[path.relative(root, target)] = fs.readFileSync(target, 'utf8');
    }
  };
  for (const relative of PINNED_PATHS) walk(path.join(root, relative));
  return files;
}

test('the source pins one released CLI everywhere', () => {
  assert.match(pinnedCliPackage(), /^@kombai\/cli@\d+\.\d+\.\d+$/);
  assert.equal(checkCliVersion(), pinnedCliPackage());
});

test('set-cli-version pins the version in every plugin and every file that names the CLI', () => {
  fixture((root) => {
    const before = pinnedCliPackage(root);
    const npm = fakeNpm();
    const result = setCliVersion(NEXT, { root, npm });
    assert.equal(result.cliPackage, `@kombai/cli@${NEXT}`);
    assert.deepEqual(npm.asked, [NEXT]);
    assert.equal(pinnedCliPackage(root), `@kombai/cli@${NEXT}`);
    assert.equal(checkCliVersion(root), `@kombai/cli@${NEXT}`);
    for (const host of Object.keys(PLUGINS)) {
      assert.ok(result.changed.includes(`plugins/${host}/kombai.package.json`), host);
      assert.ok(result.changed.includes(`plugins/${host}/skills/work-with-kombai/SKILL.md`), host);
      assert.ok(result.changed.includes(`plugins/${host}/skills/generate-assets-with-kombai/SKILL.md`), host);
      assert.ok(result.changed.includes(`plugins/${host}/README.md`), host);
    }
    for (const file of [
      'README.md',
      'skills/work-with-kombai/SKILL.md',
      'skills/about-kombai/SKILL.md',
      'skills/generate-assets-with-kombai/SKILL.md',
    ]) {
      assert.ok(result.changed.includes(file), file);
    }
    const text = Object.values(snapshot(root)).join('\n');
    assert.ok(!text.includes(before));
    // Every plugin validates with the new pin (setCliVersion ran them), and no plugin version moved.
    for (const [host, validate] of Object.entries(PLUGINS)) {
      const contract = JSON.parse(fs.readFileSync(path.join(root, 'plugins', host, 'kombai.package.json'), 'utf8'));
      const original = JSON.parse(fs.readFileSync(path.join(source, 'plugins', host, 'kombai.package.json'), 'utf8'));
      assert.equal(validate(root), original.version, host);
      assert.equal(contract.version, original.version, host);
    }
    // A version class in a regular expression (Antigravity's allow rule) is no CLI reference: it stays as it is.
    assert.ok(
      fs
        .readFileSync(path.join(root, 'plugins/antigravity/skills/work-with-kombai/SKILL.md'), 'utf8')
        .includes('@kombai/cli@[a-z0-9.-]+ .*)'),
    );
    // The same version again changes nothing.
    assert.deepEqual(setCliVersion(NEXT, { root, npm: fakeNpm() }).changed, []);
  });
});

test('set-cli-version moves any tag or version a file names, and keeps a sentence-ending full stop', () => {
  fixture((root) => {
    const skill = path.join(root, 'skills/about-kombai/SKILL.md');
    fs.appendFileSync(skill, `\nOld: \`npx -y ${LATEST} skill\`, then @kombai/cli@0.1.2-beta.3.\n`);
    assert.throws(() => checkCliVersion(root), /skills\/about-kombai\/SKILL\.md: @kombai\/cli@latest/);
    setCliVersion('0.1.5', { root, npm: fakeNpm() });
    assert.ok(
      fs.readFileSync(skill, 'utf8').endsWith('\nOld: `npx -y @kombai/cli@0.1.5 skill`, then @kombai/cli@0.1.5.\n'),
    );
  });
});

test('set-cli-version refuses a tag, a prerelease, a range, and a version npm does not have', () => {
  fixture((root) => {
    const before = snapshot(root);
    for (const version of ['latest', 'beta', '0.1.5-beta.1', '^0.1.4', 'v0.1.4', '0.1', '']) {
      const npm = fakeNpm();
      assert.throws(() => setCliVersion(version, { root, npm }), /Pin a released CLI version, x\.y\.z/, version);
      assert.deepEqual(npm.asked, [], version);
    }
    assert.throws(() => setCliVersion('0.1.9', { root, npm: fakeNpm() }), /@kombai\/cli@0\.1\.9 is not on npm/);
    assert.deepEqual(snapshot(root), before);
  });
});

test("set-cli-version refuses a CLI whose mcp install doesn't take a client a plugin's skill installs for", () => {
  fixture((root) => {
    assert.deepEqual(requiredInstallClients(root), ['claude-code', 'codex']);
    const before = snapshot(root);
    assert.throws(
      () => setCliVersion('0.1.4', { root, npm: fakeNpm({ help: 'kombai mcp install codex' }) }),
      /can't run `mcp install claude-code`.*it answered: kombai mcp install codex/,
    );
    assert.throws(
      () => setCliVersion('0.1.4', { root, npm: fakeNpm({ help: '{"error":{"code":"CLI_UNKNOWN_COMMAND"}}' }) }),
      /can't run `mcp install claude-code`/,
    );
    assert.deepEqual(snapshot(root), before);
  });
});

test("reads the CLI's usage line however it brackets the clients", () => {
  for (const help of [
    'kombai mcp install codex|claude-code',
    'Usage: kombai mcp install [codex|claude-code]',
    'kombai mcp install <codex|claude-code>',
  ]) {
    assert.deepEqual(installClients(help), ['codex', 'claude-code'], help);
  }
  assert.deepEqual(installClients('Unknown command'), []);
});

test('check fails unless every plugin pins the same released CLI', () => {
  fixture((root) => {
    const contractPath = path.join(root, 'plugins/cursor/kombai.package.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    contract.cli.package = '@kombai/cli@0.0.1';
    fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2));
    assert.throws(() => checkCliVersion(root), /Every plugin must pin the same CLI: .*cursor @kombai\/cli@0\.0\.1/);
  });
  fixture((root) => {
    for (const host of Object.keys(PLUGINS)) {
      const contractPath = path.join(root, 'plugins', host, 'kombai.package.json');
      const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      contract.cli.package = LATEST;
      fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2));
    }
    assert.throws(() => checkCliVersion(root), /must pin a released CLI, @kombai\/cli@x\.y\.z, not @kombai\/cli@latest/);
  });
});

test("set-cli-version leaves the files as they were when the pin doesn't validate", () => {
  fixture((root) => {
    // A file that names the internal package, which set-cli-version doesn't move and validation refuses.
    fs.appendFileSync(path.join(root, 'skills/work-with-kombai/SKILL.md'), '\nSee @kombai-io/cli@1.0.0.\n');
    const before = snapshot(root);
    assert.throws(() => setCliVersion('0.1.5', { root, npm: fakeNpm() }), /skills\/work-with-kombai\/SKILL\.md: @kombai-io\/cli@1\.0\.0/);
    assert.deepEqual(snapshot(root), before);
  });
});

test('check fails on a file outside the plugins that names a tag', () => {
  fixture((root) => {
    fs.appendFileSync(path.join(root, 'README.md'), '\nTry `npx -y @kombai/cli@beta skill`.\n');
    assert.throws(() => checkCliVersion(root), /README\.md: @kombai\/cli@beta/);
  });
});

test('check reads only the CLI itself: no other package whose name starts the same, but a bare name is refused', () => {
  fixture((root) => {
    const skill = path.join(root, 'skills/about-kombai/SKILL.md');
    fs.appendFileSync(skill, '\nThe @kombai/client and @kombai/cli-tools packages are unrelated.\n');
    assert.equal(checkCliVersion(root), pinnedCliPackage(root));
    // A bare name runs whatever npm's latest is.
    fs.appendFileSync(skill, 'Run `npx -y @kombai/cli skill`.\n');
    assert.throws(() => checkCliVersion(root), /skills\/about-kombai\/SKILL\.md: @kombai\/cli\. set-cli-version can't move @kombai\/cli: name the CLI there as @kombai\/cli@\d/);
  });
});

test('check takes a repository without one of the pinned paths', () => {
  fixture((root) => {
    fs.rmSync(path.join(root, 'skills'), { recursive: true });
    assert.equal(checkCliVersion(root), pinnedCliPackage(root));
  });
});

test("an install command split across lines still counts toward the clients the CLI must take", () => {
  fixture((root) => {
    const skill = path.join(root, 'plugins/cursor/skills/work-with-kombai/SKILL.md');
    fs.appendFileSync(skill, `\nRun \`npx -y ${pinnedCliPackage(root)}\nmcp install cursor\`.\n`);
    assert.deepEqual(requiredInstallClients(root), ['claude-code', 'codex', 'cursor']);
    assert.throws(() => setCliVersion('0.1.5', { root, npm: fakeNpm() }), /can't run `mcp install cursor`/);
  });
});

test("set-cli-version keeps the README's prose about tags as it is", () => {
  fixture((root) => {
    const readme = () => fs.readFileSync(path.join(root, 'README.md'), 'utf8').replace(/\s+/g, ' ');
    const prose = [
      "refuse a plugin that runs a floating npm tag (the CLI's `latest`)",
      "the CLI's skill text has the agent run later commands with the CLI's `latest` tag",
      'vscode-assistant removes that tag',
    ];
    for (const sentence of prose) assert.ok(readme().includes(sentence), sentence);
    setCliVersion('0.1.5', { root, npm: fakeNpm() });
    for (const sentence of prose) assert.ok(readme().includes(sentence), sentence);
  });
});

test('the marketplaces the packs zip are held to the pin too, and set-cli-version moves them', () => {
  fixture((root) => {
    const marketplace = path.join(root, '.claude-plugin/marketplace.json');
    const data = JSON.parse(fs.readFileSync(marketplace, 'utf8'));
    data.plugins[0].description += ` Runs npx -y ${LATEST} skill.`;
    fs.writeFileSync(marketplace, JSON.stringify(data, null, 2));
    assert.throws(() => PLUGINS['claude-code'](root), new RegExp(`\\.claude-plugin/marketplace\\.json: ${LATEST}`));
    const result = setCliVersion('0.1.5', { root, npm: fakeNpm() });
    assert.ok(result.changed.includes('.claude-plugin/marketplace.json'));
    assert.ok(fs.readFileSync(marketplace, 'utf8').includes('npx -y @kombai/cli@0.1.5 skill'));
  });
});

test("each plugin's validator refuses a tag in the marketplace its pack zips", () => {
  for (const [host, file] of [
    ['codex', '.agents/plugins/marketplace.json'],
    ['claude-code', '.claude-plugin/marketplace.json'],
    ['cursor', '.cursor-plugin/marketplace.json'],
    ['vscode', '.github/plugin/marketplace.json'],
  ]) {
    fixture((root) => {
      const marketplace = path.join(root, file);
      const data = JSON.parse(fs.readFileSync(marketplace, 'utf8'));
      data.description = `Runs npx -y ${LATEST} skill.`;
      fs.writeFileSync(marketplace, JSON.stringify(data, null, 2));
      assert.throws(
        () => PLUGINS[host](root),
        new RegExp(`marketplace must name only the CLI the plugin pins .*${file.replaceAll('.', '\\.')}: ${LATEST}`),
        host,
      );
    });
  }
});

test("a link to the CLI's npm page names no CLI; a reference set-cli-version can't move says so", () => {
  fixture((root) => {
    const skill = path.join(root, 'skills/about-kombai/SKILL.md');
    fs.appendFileSync(
      skill,
      '\nSee https://www.npmjs.com/package/@kombai/cli and https://www.npmjs.com/package/@kombai/cli/v/0.1.4.\n',
    );
    assert.equal(checkCliVersion(root), pinnedCliPackage(root));
    // A range reads as the bare name, which set-cli-version can't move: it would run whatever npm's latest is.
    fs.appendFileSync(skill, 'Run `npx -y @kombai/cli@^0.1.4 skill`.\n');
    assert.throws(
      () => checkCliVersion(root),
      /SKILL\.md: @kombai\/cli\. set-cli-version can't move @kombai\/cli: name the CLI there as @kombai\/cli@\d/,
    );
  });
});

test('a team build swaps in the beta in every text file it zips, marketplace and openai.yaml too', () => {
  fixture((root) => {
    const pinned = pinnedCliPackage(root);
    const yaml = path.join(root, 'plugins/codex/skills/work-with-kombai/agents/openai.yaml');
    fs.appendFileSync(yaml, `# runs npx -y ${pinned} skill\n`);
    const marketplacePath = path.join(root, '.agents/plugins/marketplace.json');
    const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
    marketplace.description = `Runs npx -y ${pinned} skill.`;
    fs.writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2));
    const out = path.join(root, '..', 'out');
    const archive = packCodexPlugin(out, root, { team: true });
    for (const file of ['plugins/codex/skills/work-with-kombai/agents/openai.yaml', '.agents/plugins/marketplace.json']) {
      const result = spawnSync('unzip', ['-p', archive, file], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.includes('npx -y @kombai/cli@beta skill'), file);
      assert.ok(!result.stdout.includes(pinned), file);
    }
  });
});

test('a team build swaps whole references only', () => {
  fixture((root) => {
    const pinned = pinnedCliPackage(root);
    const note = path.join(root, 'plugins/cursor/notes.md');
    fs.writeFileSync(note, `${pinned}0 and ${pinned}-rc.1 stay; ${pinned}. moves.\n`);
    const stage = stageTeamBuild(root, ['plugins/cursor/notes.md'], { cli: { package: pinned } });
    try {
      assert.equal(
        fs.readFileSync(path.join(stage, 'plugins/cursor/notes.md'), 'utf8'),
        `${pinned}0 and ${pinned}-rc.1 stay; @kombai/cli@beta. moves.\n`,
      );
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
    }
  });
});

test('only the npm page link and the Antigravity version class are exempt, spelled exactly', () => {
  fixture((root) => {
    const skill = path.join(root, 'skills/about-kombai/SKILL.md');
    const original = fs.readFileSync(skill, 'utf8');
    for (const [line, found] of [
      [`npx -y https://registry.example.com/package/${LATEST} skill`, LATEST],
      ['npx -y @kombai/cli@[version] skill', '@kombai/cli'],
      ['allow command(regex:npx -y @kombai/cli@[a-z0-9]+ .*)', '@kombai/cli'],
    ]) {
      fs.writeFileSync(skill, `${original}\n${line}\n`);
      assert.throws(
        () => checkCliVersion(root),
        new RegExp(`SKILL\\.md: ${found.replaceAll('.', '\\.')}[.,]`),
        line,
      );
    }
  });
});

test("the files a pack zips beside the plugin folder are the ones its validator checks", () => {
  assert.deepEqual(filesBesidePlugin(['.claude-plugin', 'plugins/claude-code', 'LICENSE']), ['.claude-plugin', 'LICENSE']);
});

test('a failed pin restores every file, and says so when one cannot be restored', () => {
  fixture((root) => {
    const before = snapshot(root);
    const cursor = PLUGINS.cursor;
    const locked = path.join(root, 'skills/work-with-kombai/SKILL.md');
    PLUGINS.cursor = () => {
      fs.chmodSync(locked, 0o444);
      throw new Error('cursor plugin is broken.');
    };
    try {
      assert.throws(
        () => setCliVersion(NEXT, { root, npm: fakeNpm() }),
        (error) =>
          error instanceof AggregateError &&
          /^cursor plugin is broken\. Restoring 1 of the rewritten files failed too/.test(error.message) &&
          error.errors[0].message === 'cursor plugin is broken.',
      );
    } finally {
      PLUGINS.cursor = cursor;
      fs.chmodSync(locked, 0o644);
    }
    // Every other file is back as it was; the locked one still names the new pin.
    const after = snapshot(root);
    for (const [file, text] of Object.entries(before)) {
      if (path.join(root, file) === locked) assert.ok(after[file].includes(`@kombai/cli@${NEXT}`), file);
      else assert.equal(after[file], text, file);
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
