import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ANTIGRAVITY_SANDBOX,
  bumpAntigravityVersion,
  checkAntigravityPluginDir,
  packAntigravityPlugin,
  validateAntigravityPlugin,
} from './antigravity-plugin.mjs';
import { RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE } from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'plugins/antigravity/.antigravity-plugin/plugin.json';

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-antigravity-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, 'plugins/antigravity'), path.join(root, 'plugins/antigravity'), { recursive: true });
    run(root);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function editJson(file, change) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(data);
  fs.writeFileSync(file, JSON.stringify(data));
}

function unpack(archive) {
  const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-antigravity-unpacked-'));
  const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return extracted;
}

test('Antigravity version bump and package are independent of the other plugins', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateAntigravityPlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpAntigravityVersion(next, root), next);
    assert.equal(validateAntigravityPlugin(root), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    const archive = packAntigravityPlugin(path.join(root, 'out'), root);
    assert.equal(path.basename(archive), `kombai-antigravity-plugin-${next}.zip`);
    // The archive is the plugin folder itself, ready for `agy plugin install`.
    const extracted = unpack(archive);
    try {
      assert.equal(checkAntigravityPluginDir(extracted), next);
      assert.equal(fs.readFileSync(path.join(extracted, 'LICENSE'), 'utf8'), fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
      assert.equal(fs.existsSync(path.join(extracted, 'plugins')), false);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
    assert.throws(() => bumpAntigravityVersion(current, root), /version must increase/);
  });
});

test('Antigravity validation keeps the manifest inside its schema', () => {
  fixture((root) => {
    const manifest = path.join(root, MANIFEST);
    const original = fs.readFileSync(manifest, 'utf8');
    editJson(manifest, (data) => (data.icon = './assets/logo.png'));
    assert.throws(() => validateAntigravityPlugin(root), /schema does not allow: icon/);
    fs.writeFileSync(manifest, original);
    editJson(manifest, (data) => data.suggestedPrompts.push('A fourth prompt'));
    assert.throws(() => validateAntigravityPlugin(root), /at most three prompts/);
    fs.writeFileSync(manifest, original);
    editJson(manifest, (data) => (data.logo = 'https://example.com/logo.png'));
    assert.throws(() => validateAntigravityPlugin(root), /relative image path/);
  });
});

test('Antigravity validation rejects extra plugin parts and MCP configuration', () => {
  fixture((root) => {
    for (const file of ['plugins/antigravity/mcp_config.json', 'plugins/antigravity/plugin.json', 'plugins/antigravity/.mcp.json']) {
      fs.writeFileSync(path.join(root, file), '{}');
      assert.throws(() => validateAntigravityPlugin(root), /must not ship|\.mcp\.json must not ship/);
      fs.rmSync(path.join(root, file));
    }
    editJson(path.join(root, 'plugins/antigravity/kombai.package.json'), (data) => (data.version = '999.0.0'));
    assert.throws(() => validateAntigravityPlugin(root), /versions must match/);
  });
});

test('Antigravity skills must ask to run outside the sandbox', () => {
  fixture((root) => {
    const skillPath = path.join(root, 'plugins/antigravity/skills/work-with-kombai/SKILL.md');
    fs.writeFileSync(skillPath, fs.readFileSync(skillPath, 'utf8').replaceAll(ANTIGRAVITY_SANDBOX, 'Something else'));
    assert.throws(() => validateAntigravityPlugin(root), /outside Antigravity's sandbox/);
  });
});

test('an Antigravity team pack runs the CLI team build', () => {
  fixture((root) => {
    const version = validateAntigravityPlugin(root);
    const archive = packAntigravityPlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-antigravity-plugin-${version}-team.zip`);
    const extracted = unpack(archive);
    try {
      assert.equal(JSON.parse(fs.readFileSync(path.join(extracted, 'kombai.package.json'), 'utf8')).cli.package, TEAM_CLI_PACKAGE);
      for (const [skill, topic] of [
        ['work-with-kombai', ''],
        ['about-kombai', ' faq'],
      ]) {
        const text = fs.readFileSync(path.join(extracted, 'skills', skill, 'SKILL.md'), 'utf8');
        assert.ok(text.includes(`npx -y ${TEAM_CLI_PACKAGE} skill${topic}\``), skill);
        assert.ok(!text.includes(RELEASE_CLI_PACKAGE), skill);
      }
      assert.equal(checkAntigravityPluginDir(extracted), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});
