import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpCursorVersion, packCursorPlugin, validateCursorPlugin } from './cursor-plugin.mjs';
import { RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE, TEAM_NPM_NOTE } from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-cursor-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, '.cursor-plugin'), path.join(root, '.cursor-plugin'), { recursive: true });
    fs.cpSync(path.join(source, 'plugins/cursor'), path.join(root, 'plugins/cursor'), {
      recursive: true,
    });
    run(root);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/** Unzip a team archive and check each stub runs the CLI's team build, with the GitHub Packages note. */
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
      assert.ok(text.includes(`${TEAM_NPM_NOTE}\n- **The network is blocked**`), skill);
      assert.ok(!text.includes(RELEASE_CLI_PACKAGE), skill);
    }
    return { extracted, plugin };
  } catch (error) {
    fs.rmSync(extracted, { recursive: true, force: true });
    throw error;
  }
}

test('Cursor version bump and marketplace package are independent of Codex', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateCursorPlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpCursorVersion(next, root), next);
    assert.equal(validateCursorPlugin(root), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    const archive = packCursorPlugin(path.join(root, 'out'), root);
    assert.equal(path.basename(archive), `kombai-cursor-plugin-${next}.zip`);
    for (const licensePath of ['LICENSE', 'plugins/cursor/LICENSE']) {
      const packedLicense = spawnSync('unzip', ['-p', archive, licensePath], { encoding: 'utf8' });
      assert.equal(packedLicense.status, 0, packedLicense.stderr);
      assert.equal(packedLicense.stdout, fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    }
    const marketplace = spawnSync('unzip', ['-p', archive, '.cursor-plugin/marketplace.json'], {
      encoding: 'utf8',
    });
    assert.equal(marketplace.status, 0, marketplace.stderr);
    assert.equal(JSON.parse(marketplace.stdout).plugins[0].source, 'plugins/cursor');
    const manifest = spawnSync('unzip', ['-p', archive, 'plugins/cursor/.cursor-plugin/plugin.json'], {
      encoding: 'utf8',
    });
    assert.equal(manifest.status, 0, manifest.stderr);
    assert.equal(JSON.parse(manifest.stdout).version, next);
    assert.throws(() => bumpCursorVersion(current, root), /version must increase/);
  });
});

test('Cursor validation rejects mismatched versions and bundled MCP configuration', () => {
  fixture((root) => {
    const contractPath = path.join(root, 'plugins/cursor/kombai.package.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const originalVersion = contract.version;
    contract.version = '999.0.0';
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    assert.throws(() => validateCursorPlugin(root), /versions must match/);
    contract.version = originalVersion;
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    fs.writeFileSync(path.join(root, 'plugins/cursor/.mcp.json'), '{}');
    assert.throws(() => validateCursorPlugin(root), /canvas view off, so \.mcp\.json must not ship/);
  });
});

test('a Cursor team pack runs the CLI team build', () => {
  fixture((root) => {
    const version = validateCursorPlugin(root);
    const archive = packCursorPlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-cursor-plugin-${version}-team.zip`);
    const { extracted, plugin } = checkTeamArchive(archive, 'plugins/cursor');
    try {
      assert.equal(fs.existsSync(path.join(plugin, '.mcp.json')), false);
      assert.equal(validateCursorPlugin(extracted), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});
