import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpPiCodeVersion, checkPiCodePluginDir, packPiCodePlugin, validatePiCodePlugin } from './pi-code-plugin.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Pi package validates, bumps independently, and packs its four skills', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-pi-test-'));
  try {
    fs.cpSync(path.join(source, 'plugins/pi-code'), path.join(root, 'plugins/pi-code'), { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    assert.equal(validatePiCodePlugin(root), '0.1.0');
    assert.equal(bumpPiCodeVersion('0.1.1', root), '0.1.1');
    const archive = packPiCodePlugin(path.join(root, 'out'), root);
    const extracted = path.join(root, 'extracted');
    assert.equal(spawnSync('unzip', ['-q', archive, '-d', extracted]).status, 0);
    const packageRoot = path.join(extracted, 'kombai-pi-code-plugin-0.1.1');
    assert.equal(checkPiCodePluginDir(packageRoot), '0.1.1');
    const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    assert.deepEqual(manifest.pi.skills, ['./skills']);
    for (const name of ['work-with-kombai', 'about-kombai', 'generate-assets-with-kombai', 'get-started-with-kombai']) {
      assert.ok(fs.existsSync(path.join(packageRoot, 'skills', name, 'SKILL.md')));
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
