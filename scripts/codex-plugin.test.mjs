import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpCodexVersion, packCodexPlugin, validateCodexPlugin } from './codex-plugin.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-codex-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, 'plugins/codex'), path.join(root, 'plugins/codex'), { recursive: true });
    run(root);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
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
    for (const licensePath of ['LICENSE']) {
      const packedLicense = spawnSync('unzip', ['-p', archive, licensePath], { encoding: 'utf8' });
      assert.equal(packedLicense.status, 0, packedLicense.stderr);
      assert.equal(packedLicense.stdout, fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    }
    const packedManifest = spawnSync('unzip', ['-p', archive, '.codex-plugin/plugin.json'], { encoding: 'utf8' });
    assert.equal(packedManifest.status, 0, packedManifest.stderr);
    assert.equal(JSON.parse(packedManifest.stdout).version, next);
    assert.throws(() => bumpCodexVersion(current, root), /version must increase/);
  });
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

test('validation rejects a bundled MCP configuration', () => {
  fixture((root) => {
    fs.writeFileSync(path.join(root, 'plugins/codex/.mcp.json'), '{}');
    assert.throws(() => validateCodexPlugin(root), /Local MCP config must not ship/);
  });
});
