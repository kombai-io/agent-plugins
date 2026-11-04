import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpClaudeCodeVersion, packClaudeCodePlugin, validateClaudeCodePlugin } from './claude-code-plugin.mjs';
import { cliViewMcpConfig, RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE } from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-claude-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, '.claude-plugin'), path.join(root, '.claude-plugin'), { recursive: true });
    fs.cpSync(path.join(source, 'plugins/claude-code'), path.join(root, 'plugins/claude-code'), {
      recursive: true,
    });
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

test('Claude version bump and marketplace package are independent of Codex', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateClaudeCodePlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpClaudeCodeVersion(next, root), next);
    assert.equal(validateClaudeCodePlugin(root), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    const archive = packClaudeCodePlugin(path.join(root, 'out'), root);
    assert.equal(path.basename(archive), `kombai-claude-code-plugin-${next}.zip`);
    for (const licensePath of ['LICENSE', 'plugins/claude-code/LICENSE']) {
      const packedLicense = spawnSync('unzip', ['-p', archive, licensePath], { encoding: 'utf8' });
      assert.equal(packedLicense.status, 0, packedLicense.stderr);
      assert.equal(packedLicense.stdout, fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    }
    const marketplace = spawnSync('unzip', ['-p', archive, '.claude-plugin/marketplace.json'], {
      encoding: 'utf8',
    });
    assert.equal(marketplace.status, 0, marketplace.stderr);
    assert.equal(JSON.parse(marketplace.stdout).plugins[0].source, './plugins/claude-code');
    const manifest = spawnSync('unzip', ['-p', archive, 'plugins/claude-code/.claude-plugin/plugin.json'], {
      encoding: 'utf8',
    });
    assert.equal(manifest.status, 0, manifest.stderr);
    assert.equal(JSON.parse(manifest.stdout).version, next);
    assert.throws(() => bumpClaudeCodeVersion(current, root), /version must increase/);
  });
});

test('Claude validation rejects mismatched versions and any MCP configuration but the CLI server', () => {
  fixture((root) => {
    const contractPath = path.join(root, 'plugins/claude-code/kombai.package.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const originalVersion = contract.version;
    contract.version = '999.0.0';
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    assert.throws(() => validateClaudeCodePlugin(root), /versions must match/);
    contract.version = originalVersion;
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    fs.writeFileSync(path.join(root, 'plugins/claude-code/.mcp.json'), '{}');
    assert.throws(() => validateClaudeCodePlugin(root), /may only register the Kombai CLI view/);
  });
});

test('the Claude Code plugin registers the CLI server for the taste card, and packs it', () => {
  fixture((root) => {
    const pluginRoot = path.join(root, 'plugins/claude-code');
    const contract = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'kombai.package.json'), 'utf8'));
    assert.equal(contract.cli.view, true);
    validateClaudeCodePlugin(root);
    const archive = packClaudeCodePlugin(path.join(root, 'out'), root);
    const packed = spawnSync('unzip', ['-p', archive, 'plugins/claude-code/.mcp.json'], { encoding: 'utf8' });
    assert.equal(packed.status, 0, packed.stderr);
    assert.deepEqual(JSON.parse(packed.stdout), cliViewMcpConfig(contract.cli.package));
    fs.rmSync(path.join(pluginRoot, '.mcp.json'));
    assert.throws(() => validateClaudeCodePlugin(root), /canvas view on, so it must ship \.mcp\.json/);
  });
});

test('a Claude Code team pack runs the CLI team build, its server included', () => {
  fixture((root) => {
    const version = validateClaudeCodePlugin(root);
    const archive = packClaudeCodePlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-claude-code-plugin-${version}-team.zip`);
    const { extracted, plugin } = checkTeamArchive(archive, 'plugins/claude-code');
    try {
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(plugin, '.mcp.json'), 'utf8')),
        cliViewMcpConfig(TEAM_CLI_PACKAGE),
      );
      assert.equal(validateClaudeCodePlugin(extracted), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});
