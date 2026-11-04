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
    contract.cli.package = '@kombai-io/cli@next';
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    assert.throws(() => validateCodexPlugin(root), /work-with-kombai skill must run @kombai-io\/cli@next skill\./);
  });
});

test('validation rejects an app MCP configuration', () => {
  fixture((root) => {
    fs.writeFileSync(path.join(root, 'plugins/codex/.app.json'), '{}');
    assert.throws(() => validateCodexPlugin(root), /Local MCP config must not ship/);
  });
});

test('the packed plugin carries the CLI view', () => {
  fixture((root) => {
    const archive = packCodexPlugin(path.join(root, 'out'), root);
    const packed = spawnSync('unzip', ['-p', archive, 'plugins/codex/.mcp.json'], { encoding: 'utf8' });
    assert.equal(packed.status, 0, packed.stderr);
    assert.deepEqual(Object.keys(JSON.parse(packed.stdout).mcpServers), ['kombai']);
  });
});

test('a team pack runs the CLI beta from npm next, and the source stays on the release', () => {
  fixture((root) => {
    const version = validateCodexPlugin(root);
    const archive = packCodexPlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-codex-plugin-${version}-team.zip`);
    const { extracted, plugin } = checkTeamArchive(archive, 'plugins/codex');
    try {
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(plugin, '.mcp.json'), 'utf8')),
        cliViewMcpConfig(TEAM_CLI_PACKAGE),
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
