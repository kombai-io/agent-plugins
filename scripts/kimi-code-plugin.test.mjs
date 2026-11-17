import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpKimiCodeVersion, checkKimiCodePluginDir, packKimiCodePlugin, validateKimiCodePlugin } from './kimi-code-plugin.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Kimi Code manifest, version bump, and installable ZIP keep the skill paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-kimi-test-'));
  try {
    fs.cpSync(path.join(source, 'plugins/kimi-code'), path.join(root, 'plugins/kimi-code'), { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    assert.equal(validateKimiCodePlugin(root), '0.1.0');
    assert.equal(bumpKimiCodeVersion('0.1.1', root), '0.1.1');
    const archive = packKimiCodePlugin(path.join(root, 'out'), root);
    const extracted = path.join(root, 'extracted');
    assert.equal(spawnSync('unzip', ['-q', archive, '-d', extracted]).status, 0);
    const plugin = path.join(extracted, 'kombai-kimi-code-plugin-0.1.1');
    assert.equal(checkKimiCodePluginDir(plugin), '0.1.1');
    const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'kimi.plugin.json')));
    assert.equal(manifest.skills, './skills/');
    for (const name of ['work-with-kombai', 'about-kombai', 'generate-assets-with-kombai', 'get-started-with-kombai']) {
      assert.ok(fs.existsSync(path.join(plugin, manifest.skills, name, 'SKILL.md')));
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
