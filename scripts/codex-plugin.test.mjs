import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpCodexVersion, packCodexPlugin, validateCodexPlugin } from './codex-plugin.mjs';
import {
  cliViewMcpConfig,
  RELEASE_CLI_PACKAGE,
  stageTeamBuild,
  TEAM_CLI_PACKAGE,
} from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-codex-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.mkdirSync(path.join(root, '.agents/plugins'), { recursive: true });
    fs.copyFileSync(
      path.join(source, '.agents/plugins/marketplace.json'),
      path.join(root, '.agents/plugins/marketplace.json'),
    );
    fs.cpSync(path.join(source, 'plugins/codex'), path.join(root, 'plugins/codex'), { recursive: true });
    run(root);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * Turn the canvas view on in a fixture copy, as Codex plugin versions to 0.4.x shipped it: `cli.view`, the
 * `.mcp.json` that registers the CLI view, and the manifest's `mcpServers`. From 0.5.0 the plugin is skills-only and
 * its skill writes the server into the user's own config (`kombai mcp install codex`).
 */
function withViewOn(root) {
  const pluginRoot = path.join(root, 'plugins/codex');
  const contractPath = path.join(pluginRoot, 'kombai.package.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.cli.view = true;
  fs.writeFileSync(contractPath, JSON.stringify(contract));
  fs.writeFileSync(path.join(pluginRoot, '.mcp.json'), JSON.stringify(cliViewMcpConfig(contract.cli.package)));
  const manifestPath = path.join(pluginRoot, '.codex-plugin/plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.mcpServers = './.mcp.json';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
}

/** Unzip a team archive and check each stub runs the CLI's newest beta from npm. */
function checkTeamArchive(archive, pluginDir) {
  const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-team-unpacked-'));
  try {
    const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const plugin = path.join(extracted, pluginDir);
    const contract = JSON.parse(fs.readFileSync(path.join(plugin, 'kombai.package.json'), 'utf8'));
    assert.equal(contract.cli.package, TEAM_CLI_PACKAGE);
    for (const [skill, topic] of [
      ['work-with-kombai', ''],
      ['about-kombai', ' faq'],
    ]) {
      const text = fs.readFileSync(path.join(plugin, 'skills', skill, 'SKILL.md'), 'utf8');
      assert.ok(text.includes(`npx -y ${TEAM_CLI_PACKAGE} skill${topic}\``), skill);
      assert.ok(!text.includes('GitHub Packages'), skill);
      assert.ok(!text.includes(RELEASE_CLI_PACKAGE), skill);
    }
    return { extracted, plugin };
  } catch (error) {
    fs.rmSync(extracted, { recursive: true, force: true });
    throw error;
  }
}

test('a Codex version bump updates its release files without changing the workspace version', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateCodexPlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpCodexVersion(next, root), next);
    assert.equal(validateCodexPlugin(root), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    const archive = packCodexPlugin(path.join(root, 'out'), root);
    assert.equal(path.basename(archive), `kombai-codex-plugin-${next}.zip`);
    for (const licensePath of ['LICENSE', 'plugins/codex/LICENSE']) {
      const packedLicense = spawnSync('unzip', ['-p', archive, licensePath], { encoding: 'utf8' });
      assert.equal(packedLicense.status, 0, packedLicense.stderr);
      assert.equal(packedLicense.stdout, fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    }
    const packedManifest = spawnSync('unzip', ['-p', archive, 'plugins/codex/.codex-plugin/plugin.json'], {
      encoding: 'utf8',
    });
    assert.equal(packedManifest.status, 0, packedManifest.stderr);
    assert.equal(JSON.parse(packedManifest.stdout).version, next);
    assert.throws(() => bumpCodexVersion(current, root), /version must increase/);
  });
});

test('the extracted Codex archive is a self-contained marketplace', () => {
  fixture((root) => {
    const version = validateCodexPlugin(root);
    const originalSkill = fs.readFileSync(path.join(root, 'plugins/codex/skills/work-with-kombai/SKILL.md'), 'utf8');
    fs.writeFileSync(path.join(root, 'plugins/codex/development-only.txt'), 'Do not package this file.');
    const archive = packCodexPlugin(path.join(root, 'out'), root);
    const extracted = path.join(path.dirname(root), 'unpacked');
    const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    // The installed marketplace must work without the original checkout or its archive.
    fs.rmSync(root, { recursive: true, force: true });
    const marketplace = JSON.parse(fs.readFileSync(path.join(extracted, '.agents/plugins/marketplace.json'), 'utf8'));
    assert.equal(marketplace.name, 'kombai');
    assert.equal(marketplace.plugins.length, 1);
    const entry = marketplace.plugins[0];
    assert.equal(entry.name, 'kombai');
    assert.deepEqual(entry.source, { source: 'local', path: './plugins/codex' });
    const pluginRoot = path.resolve(extracted, entry.source.path);
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
    assert.equal(manifest.name, entry.name);
    assert.equal(manifest.version, version);
    const skillFile = path.resolve(pluginRoot, manifest.skills, 'work-with-kombai/SKILL.md');
    assert.equal(fs.readFileSync(skillFile, 'utf8'), originalSkill);
    assert.equal(validateCodexPlugin(extracted), version);
    assert.equal(fs.existsSync(path.join(pluginRoot, 'development-only.txt')), false);
  });
});

test('a missing Codex marketplace stops validation and packaging', () => {
  fixture((root) => {
    fs.rmSync(path.join(root, '.agents/plugins/marketplace.json'));
    assert.throws(() => validateCodexPlugin(root), /marketplace\.json/);
    assert.throws(() => packCodexPlugin(path.join(root, 'out'), root), /marketplace\.json/);
    assert.equal(fs.existsSync(path.join(root, 'out')), false);
  });
});

test('validation rejects malformed Codex marketplace metadata', () => {
  const entry = { name: 'kombai', source: { source: 'local', path: './plugins/codex' } };
  const invalid = [
    ['invalid JSON', '{'],
    ['wrong marketplace name', JSON.stringify({ name: 'other', plugins: [entry] })],
    ['missing plugin', JSON.stringify({ name: 'kombai', plugins: [] })],
    ['extra plugin', JSON.stringify({ name: 'kombai', plugins: [entry, { ...entry, name: 'other' }] })],
    ['wrong plugin name', JSON.stringify({ name: 'kombai', plugins: [{ ...entry, name: 'other' }] })],
    [
      'non-local source',
      JSON.stringify({ name: 'kombai', plugins: [{ ...entry, source: { source: 'github', path: './plugins/codex' } }] }),
    ],
    [
      'source outside bundled plugin',
      JSON.stringify({ name: 'kombai', plugins: [{ ...entry, source: { source: 'local', path: '../codex' } }] }),
    ],
  ];
  for (const [label, contents] of invalid) {
    fixture((root) => {
      fs.writeFileSync(path.join(root, '.agents/plugins/marketplace.json'), contents);
      assert.throws(() => validateCodexPlugin(root), undefined, label);
    });
  }
});

test('validation stops packaging when versions disagree', () => {
  fixture((root) => {
    const file = path.join(root, 'plugins/codex/kombai.package.json');
    const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
    contract.version = '999.0.0';
    fs.writeFileSync(file, JSON.stringify(contract));
    assert.throws(() => validateCodexPlugin(root), /versions must match/);
  });
});

test('validation accepts only the Kombai CLI view as a bundled MCP server', () => {
  fixture((root) => {
    withViewOn(root);
    const file = path.join(root, 'plugins/codex/.mcp.json');
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    config.mcpServers.kombai = { command: '/Applications/Kombai.app/Contents/MacOS/Kombai', args: [] };
    fs.writeFileSync(file, JSON.stringify(config));
    assert.throws(() => validateCodexPlugin(root), /may only register the Kombai CLI view/);
    fs.rmSync(file);
    assert.throws(() => validateCodexPlugin(root), /canvas view on, so it must ship \.mcp\.json/);
  });
});

test('with the canvas view off, the plugin registers no MCP server and packs none', () => {
  fixture((root) => {
    withViewOn(root);
    const pluginRoot = path.join(root, 'plugins/codex');
    const contractPath = path.join(pluginRoot, 'kombai.package.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    contract.cli.view = false;
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    assert.throws(() => validateCodexPlugin(root), /canvas view off, so \.mcp\.json must not ship/);
    fs.rmSync(path.join(pluginRoot, '.mcp.json'));
    assert.throws(() => validateCodexPlugin(root), /must not name mcpServers/);
    const manifestPath = path.join(pluginRoot, '.codex-plugin/plugin.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.mcpServers;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const archive = packCodexPlugin(path.join(root, 'out'), root);
    const listing = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
    assert.equal(listing.status, 0, listing.stderr);
    assert.ok(!listing.stdout.split('\n').includes('plugins/codex/.mcp.json'));
  });
});

test('validation holds the skill and the view to the CLI the contract names', () => {
  fixture((root) => {
    const contractPath = path.join(root, 'plugins/codex/kombai.package.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    contract.cli.package = '@kombai/cli@beta';
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    assert.throws(() => validateCodexPlugin(root), /work-with-kombai skill must run @kombai\/cli@beta skill\./);
  });
});

test('validation rejects an app MCP configuration', () => {
  fixture((root) => {
    fs.writeFileSync(path.join(root, 'plugins/codex/.app.json'), '{}');
    assert.throws(() => validateCodexPlugin(root), /Local MCP config must not ship/);
  });
});

test('the packed Codex plugin carries no MCP config: its skill sets the view up', () => {
  fixture((root) => {
    const archive = packCodexPlugin(path.join(root, 'out'), root);
    const listing = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
    assert.equal(listing.status, 0, listing.stderr);
    for (const file of ['.mcp.json', 'mcp.json', '.app.json'])
      assert.ok(!listing.stdout.split('\n').includes(`plugins/codex/${file}`), file);
    const skill = spawnSync('unzip', ['-p', archive, 'plugins/codex/skills/work-with-kombai/SKILL.md'], {
      encoding: 'utf8',
    });
    assert.ok(skill.stdout.includes(`npx -y ${RELEASE_CLI_PACKAGE} mcp install codex`));
    // The skill sets the view up without a question (as listing 0.2.2 did) and tells the user in one line.
    assert.ok(
      skill.stdout
        .replace(/\s+/g, ' ')
        .includes(`set it up without asking, with \`npx -y ${RELEASE_CLI_PACKAGE} mcp install codex\``),
    );
    // Setting the view up is the skill's first instruction after the sandbox note, before even `kombai skill`.
    const afterSandbox = skill.stdout.split('\n\n').slice(2).join('\n\n');
    assert.ok(afterSandbox.startsWith("**First, before anything else, even `npx"), afterSandbox.slice(0, 120));
    // The install's answer says how to move the work to a new task without the user asking twice.
    assert.ok(skill.stdout.replace(/\s+/g, ' ').includes('then follow its `next` to move the work to a new task'));
    // The new task's prompt starts with Kombai's mention, which needs the plugin's id in Codex.
    // It reads the plugin's id from its own install path, since one ZIP installs under different marketplaces.
    assert.ok(skill.stdout.replace(/\s+/g, ' ').includes("Kombai's plugin id in this Codex is `kombai@<marketplace>`"));
    assert.ok(!skill.stdout.includes('kombai@kombai'));
    assert.ok(skill.stdout.replace(/\s+/g, ' ').includes('a link that opens it with the request filled in'));
    assert.ok(skill.stdout.indexOf('mcp install codex') < skill.stdout.indexOf(`Run \`npx -y ${RELEASE_CLI_PACKAGE} skill\``));
  });
});

test('the Codex manifest says the plugin needs local execution', () => {
  fixture((root) => {
    const manifestPath = path.join(root, 'plugins/codex/.codex-plugin/plugin.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.requires_local_executor;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => validateCodexPlugin(root), /requires_local_executor/);
  });
});

test('a team pack runs the CLI beta from npm beta, and the source stays on the release', () => {
  fixture((root) => {
    const version = validateCodexPlugin(root);
    const archive = packCodexPlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-codex-plugin-${version}-team.zip`);
    const { extracted, plugin } = checkTeamArchive(archive, 'plugins/codex');
    try {
      // Skills-only: the team build ships no MCP config either; its skill runs the team CLI's mcp install.
      assert.ok(!fs.existsSync(path.join(plugin, '.mcp.json')));
      assert.ok(
        fs
          .readFileSync(path.join(plugin, 'skills/work-with-kombai/SKILL.md'), 'utf8')
          .includes(`npx -y ${TEAM_CLI_PACKAGE} mcp install codex`),
      );
      // The extracted team marketplace is a valid plugin of its own.
      assert.equal(validateCodexPlugin(extracted), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
    const contract = JSON.parse(fs.readFileSync(path.join(root, 'plugins/codex/kombai.package.json'), 'utf8'));
    assert.equal(contract.cli.package, RELEASE_CLI_PACKAGE);
  });
});

test('a team build starts only from the release plugin', () => {
  fixture((root) => {
    assert.throws(
      () => stageTeamBuild(root, [], { cli: { package: TEAM_CLI_PACKAGE } }),
      /starts from the release plugin/,
    );
  });
});

test("the Codex plugin's setup runs an onboarding skill that adds Kombai's view right after install", () => {
  fixture((root) => {
    validateCodexPlugin(root);
    const pluginRoot = path.join(root, 'plugins/codex');
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
    assert.equal(manifest.onboardingSkill, './skills/get-started-with-kombai/SKILL.md');
    const setup = fs.readFileSync(path.join(pluginRoot, 'skills/get-started-with-kombai/SKILL.md'), 'utf8');
    assert.match(setup, /^---\nname: get-started-with-kombai\n/);
    assert.ok(setup.includes(`npx -y ${RELEASE_CLI_PACKAGE} mcp install codex`));
    // The user can run it again. The branch is whether this chat has Kombai's view: then the starters card, or links
    // where the chat's CLI has no card yet; else the setup, then links that each open a new chat with Kombai mentioned
    // and a prompt filled in. A turned-off entry gets no links to another chat without the view.
    const flat = setup.replace(/\s+/g, ' ');
    assert.ok(flat.includes('**If `canvas_app` is there**'));
    assert.ok(flat.includes('If `starters_card` is there too'));
    // A turned-off entry is the CLI's own answer (`disabled: true`), not a guess about when this chat started.
    assert.ok(flat.includes('If it answered with `disabled: true`'));
    assert.ok(!flat.includes('this chat started after'));
    assert.ok(!flat.includes("what the install's `next` says"));
    // The id comes from the skill's own install path, so the links name the plugin the user has, however installed.
    assert.ok(flat.includes("Kombai's plugin id in this Codex is `kombai@<marketplace>`"));
    assert.ok(flat.includes('the folder after `plugins/cache/` in this skill\'s own path'));
    assert.ok(!setup.includes('kombai@kombai') && !setup.includes('kombai%40kombai'));
    assert.ok(flat.includes('`codex://threads/new?prompt=`'));
    assert.ok(flat.includes("`encodeURIComponent('[@Kombai](plugin://<id>) ' + request)`"));
    // No starter depends on a project: a new-chat link can carry only its prompt.
    assert.ok(!/this project/i.test(setup));
    const agent = fs.readFileSync(path.join(pluginRoot, 'skills/get-started-with-kombai/agents/openai.yaml'), 'utf8');
    assert.match(agent, /display_name: "Get started with Kombai"/);
    // Codex's Try now, on the toast after an install, starts a chat with the plugin's first default prompt after
    // Kombai's mention: that prompt asks for the onboarding, which picks it up by its description.
    assert.equal(manifest.interface.defaultPrompt[0], 'Get started and show me what to try');
    assert.match(setup, /^description: .*get started with it, or see what to try/m);
    const archive = packCodexPlugin(path.join(root, 'out'), root);
    const listing = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
    assert.ok(listing.stdout.split('\n').includes('plugins/codex/skills/get-started-with-kombai/SKILL.md'));
  });
});

test('validation holds the onboarding skill to the manifest and to the CLI the contract names', () => {
  fixture((root) => {
    const manifestPath = path.join(root, 'plugins/codex/.codex-plugin/plugin.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.onboardingSkill;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => validateCodexPlugin(root), /onboardingSkill/);
  });
  fixture((root) => {
    const setupPath = path.join(root, 'plugins/codex/skills/get-started-with-kombai/SKILL.md');
    fs.writeFileSync(setupPath, fs.readFileSync(setupPath, 'utf8').replaceAll('mcp install codex', 'mcp'));
    assert.throws(() => validateCodexPlugin(root), /get-started-with-kombai skill must run/);
  });
  fixture((root) => {
    const setupPath = path.join(root, 'plugins/codex/skills/get-started-with-kombai/SKILL.md');
    fs.writeFileSync(setupPath, fs.readFileSync(setupPath, 'utf8').replaceAll('`starters_card`', 'the card'));
    assert.throws(() => validateCodexPlugin(root), /get-started-with-kombai skill must show starters_card/);
  });
});

test("a team pack's onboarding skill installs with the team CLI", () => {
  fixture((root) => {
    const archive = packCodexPlugin(path.join(root, 'out'), root, { team: true });
    const setup = spawnSync('unzip', ['-p', archive, 'plugins/codex/skills/get-started-with-kombai/SKILL.md'], { encoding: 'utf8' });
    assert.ok(setup.stdout.includes(`npx -y ${TEAM_CLI_PACKAGE} mcp install codex`));
    assert.ok(!setup.stdout.includes(RELEASE_CLI_PACKAGE));
  });
});
