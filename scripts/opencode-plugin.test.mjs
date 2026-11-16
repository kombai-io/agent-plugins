import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bumpOpenCodeVersion, checkOpenCodePluginDir, packOpenCodePlugin, validateOpenCodePlugin } from './opencode-plugin.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-opencode-test-'));
  try {
    fs.cpSync(path.join(source, 'plugins/opencode'), path.join(root, 'plugins/opencode'), { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('OpenCode package validates, bumps independently, and packs a loadable folder', () => {
  fixture((root) => {
    assert.equal(validateOpenCodePlugin(root), '0.1.0');
    assert.equal(bumpOpenCodeVersion('0.1.1', root), '0.1.1');
    const archive = packOpenCodePlugin(path.join(root, 'out'), root);
    const extracted = path.join(root, 'extracted');
    assert.equal(spawnSync('unzip', ['-q', archive, '-d', extracted]).status, 0);
    const plugin = path.join(extracted, 'kombai-opencode-plugin-0.1.1');
    assert.equal(checkOpenCodePluginDir(plugin), '0.1.1');
    assert.equal(JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'))).exports['.'], './index.js');
  });
});

test('OpenCode entry registers all four packaged skills through the Skills API', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-opencode-runtime-'));
  try {
    const pluginDir = path.join(root, 'plugin');
    fs.cpSync(path.join(source, 'plugins/opencode'), pluginDir, { recursive: true });
    const sdk = path.join(pluginDir, 'node_modules/@opencode/plugin');
    fs.mkdirSync(sdk, { recursive: true });
    fs.writeFileSync(path.join(sdk, 'package.json'), JSON.stringify({ name: '@opencode/plugin', type: 'module', exports: './index.js' }));
    fs.writeFileSync(path.join(sdk, 'index.js'), `
      export const Plugin = { define: value => value };
      export const Skill = {
        ID: { make: value => value }, Name: { make: value => value },
        Info: { fields: { path: { make: value => value } } }
      };
    `);
    const { default: plugin } = await import(pathToFileURL(path.join(pluginDir, 'index.js')).href);
    assert.equal(plugin.id, 'kombai');
    const registered = [];
    await plugin.setup({ skill: { transform: async (callback) => callback({
      add: (skill) => registered.push(skill),
      update: (id, change) => change(registered.find((skill) => skill.id === id)),
    }) } });
    assert.deepEqual(registered.map((skill) => skill.id), ['work-with-kombai', 'about-kombai', 'generate-assets-with-kombai', 'get-started-with-kombai']);
    for (const skill of registered) {
      assert.ok(skill.description);
      assert.ok(skill.content.includes('npx -y @kombai/cli@0.2.0'));
      assert.equal(skill.autoinvoke, true);
      assert.equal(fs.existsSync(skill.path), true);
    }
    assert.ok(registered.find((skill) => skill.id === 'get-started-with-kombai').content.includes('whoami'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
