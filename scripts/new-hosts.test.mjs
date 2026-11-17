import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpQwenCodeVersion, checkQwenCodePluginDir, packQwenCodePlugin, validateQwenCodePlugin } from './qwen-code-plugin.mjs';
import { bumpHermesAgentVersion, checkHermesAgentPluginDir, packHermesAgentPlugin, validateHermesAgentPlugin } from './hermes-agent-plugin.mjs';
import { bumpMuseVersion, checkMusePluginDir, packMusePlugin, validateMusePlugin } from './muse-plugin.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hosts = [
  ['qwen-code', 'qwen-extension.json', validateQwenCodePlugin, bumpQwenCodeVersion, packQwenCodePlugin, checkQwenCodePluginDir],
  ['hermes-agent', 'plugin.json', validateHermesAgentPlugin, bumpHermesAgentVersion, packHermesAgentPlugin, checkHermesAgentPluginDir],
  ['muse', '.muse-plugin/plugin.json', validateMusePlugin, bumpMuseVersion, packMusePlugin, checkMusePluginDir],
];

for (const [host, manifest, validate, bump, pack, checkDir] of hosts) {
  test(`${host} ships a standalone, versioned, skills-only package`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `kombai-${host}-test-`));
    try {
      fs.cpSync(path.join(source, 'plugins', host), path.join(root, 'plugins', host), { recursive: true });
      fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
      const current = JSON.parse(fs.readFileSync(path.join(root, 'plugins', host, manifest), 'utf8')).version;
      const next = current.replace(/\d+$/, (patch) => String(Number(patch) + 1));
      assert.equal(validate(root), current);
      assert.equal(bump(next, root), next);
      const archive = pack(path.join(root, 'out'), root);
      const extracted = path.join(root, 'extracted');
      const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const packaged = path.join(extracted, `kombai-${host}-plugin-${next}`);
      assert.equal(checkDir(packaged), next);
      assert.equal(JSON.parse(fs.readFileSync(path.join(packaged, manifest), 'utf8')).version, next);
      assert.deepEqual(fs.readdirSync(path.join(packaged, 'skills')).sort(), [
        'about-kombai', 'generate-assets-with-kombai', 'get-started-with-kombai', 'work-with-kombai',
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
