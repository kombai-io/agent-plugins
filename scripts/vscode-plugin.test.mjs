import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpVsCodeVersion, packVsCodePlugin, validateVsCodePlugin, VSCODE_UNSANDBOXED } from './vscode-plugin.mjs';
import { RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE } from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-vscode-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, '.github/plugin'), path.join(root, '.github/plugin'), { recursive: true });
    fs.cpSync(path.join(source, 'plugins/vscode'), path.join(root, 'plugins/vscode'), { recursive: true });
    run(root);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function unzipText(archive, file) {
  const result = spawnSync('unzip', ['-p', archive, file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('VS Code version bump and marketplace package are independent of the other plugins', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateVsCodePlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpVsCodeVersion(next, root), next);
    assert.equal(validateVsCodePlugin(root), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    const archive = packVsCodePlugin(path.join(root, 'out'), root);
    assert.equal(path.basename(archive), `kombai-vscode-plugin-${next}.zip`);
    for (const licensePath of ['LICENSE', 'plugins/vscode/LICENSE']) {
      assert.equal(unzipText(archive, licensePath), fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    }
    assert.equal(JSON.parse(unzipText(archive, '.github/plugin/marketplace.json')).plugins[0].source, './plugins/vscode');
    assert.equal(JSON.parse(unzipText(archive, 'plugins/vscode/plugin.json')).version, next);
    assert.throws(() => bumpVsCodeVersion(current, root), /version must increase/);
  });
});

test('VS Code validation rejects mismatched versions and bundled MCP configuration', () => {
  fixture((root) => {
    const contractPath = path.join(root, 'plugins/vscode/kombai.package.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const originalVersion = contract.version;
    contract.version = '999.0.0';
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    assert.throws(() => validateVsCodePlugin(root), /versions must match/);
    contract.version = originalVersion;
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    fs.writeFileSync(path.join(root, 'plugins/vscode/.mcp.json'), '{}');
    assert.throws(() => validateVsCodePlugin(root), /canvas view off, so \.mcp\.json must not ship/);
  });
});

test('VS Code validation rejects files that change what VS Code reads', () => {
  fixture((root) => {
    fs.writeFileSync(path.join(root, 'marketplace.json'), '{"plugins":[]}');
    assert.throws(() => validateVsCodePlugin(root), /would hide the VS Code marketplace/);
    fs.rmSync(path.join(root, 'marketplace.json'));
    fs.mkdirSync(path.join(root, 'plugins/vscode/.claude-plugin'));
    fs.writeFileSync(path.join(root, 'plugins/vscode/.claude-plugin/plugin.json'), '{}');
    assert.throws(() => validateVsCodePlugin(root), /would change how VS Code reads the plugin/);
  });
});

test('VS Code skills must ask to run outside the terminal sandbox', () => {
  fixture((root) => {
    const skillPath = path.join(root, 'plugins/vscode/skills/about-kombai/SKILL.md');
    const text = fs.readFileSync(skillPath, 'utf8');
    fs.writeFileSync(skillPath, text.replaceAll(VSCODE_UNSANDBOXED, 'something else'));
    assert.throws(() => validateVsCodePlugin(root), /outside VS Code's terminal sandbox/);
  });
});

test('a VS Code team pack runs the CLI team build', () => {
  fixture((root) => {
    const version = validateVsCodePlugin(root);
    const archive = packVsCodePlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-vscode-plugin-${version}-team.zip`);
    const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-team-unpacked-'));
    try {
      const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const plugin = path.join(extracted, 'plugins/vscode');
      assert.equal(JSON.parse(fs.readFileSync(path.join(plugin, 'kombai.package.json'), 'utf8')).cli.package, TEAM_CLI_PACKAGE);
      for (const [skill, topic] of [
        ['work-with-kombai', ''],
        ['about-kombai', ' faq'],
      ]) {
        const text = fs.readFileSync(path.join(plugin, 'skills', skill, 'SKILL.md'), 'utf8');
        assert.ok(text.includes(`npx -y ${TEAM_CLI_PACKAGE} skill${topic}\``), skill);
        assert.ok(!text.includes(RELEASE_CLI_PACKAGE), skill);
      }
      assert.equal(fs.existsSync(path.join(plugin, '.mcp.json')), false);
      assert.equal(validateVsCodePlugin(extracted), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});
