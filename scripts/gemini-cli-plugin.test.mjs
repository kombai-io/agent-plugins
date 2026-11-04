import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  bumpGeminiCliVersion,
  checkGeminiCliPluginDir,
  GEMINI_SANDBOX,
  packGeminiCliPlugin,
  validateGeminiCliPlugin,
} from './gemini-cli-plugin.mjs';
import { RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE } from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'plugins/gemini-cli/gemini-extension.json';

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-gemini-cli-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, 'plugins/gemini-cli'), path.join(root, 'plugins/gemini-cli'), { recursive: true });
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
  const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-gemini-cli-unpacked-'));
  const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return extracted;
}

test('Gemini CLI version bump and package are independent of the other plugins', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateGeminiCliPlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpGeminiCliVersion(next, root), next);
    assert.equal(validateGeminiCliPlugin(root), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    const archive = packGeminiCliPlugin(path.join(root, 'out'), root);
    assert.equal(path.basename(archive), `kombai-gemini-cli-plugin-${next}.zip`);
    // gemini-extension.json sits at the archive root, where `gemini extensions install` looks for it.
    const extracted = unpack(archive);
    try {
      assert.equal(checkGeminiCliPluginDir(extracted), next);
      assert.equal(fs.readFileSync(path.join(extracted, 'LICENSE'), 'utf8'), fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
    assert.throws(() => bumpGeminiCliVersion(current, root), /version must increase/);
  });
});

test('Gemini CLI validation rejects context files, MCP servers and other manifest keys', () => {
  fixture((root) => {
    const manifest = path.join(root, MANIFEST);
    const original = fs.readFileSync(manifest, 'utf8');
    editJson(manifest, (data) => (data.mcpServers = {}));
    assert.throws(() => validateGeminiCliPlugin(root), /must not set mcpServers/);
    fs.writeFileSync(manifest, original);
    fs.writeFileSync(path.join(root, 'plugins/gemini-cli/GEMINI.md'), '# context');
    assert.throws(() => validateGeminiCliPlugin(root), /must not ship GEMINI\.md/);
    fs.rmSync(path.join(root, 'plugins/gemini-cli/GEMINI.md'));
    fs.writeFileSync(path.join(root, 'plugins/gemini-cli/.mcp.json'), '{}');
    assert.throws(() => validateGeminiCliPlugin(root), /\.mcp\.json must not ship/);
    fs.rmSync(path.join(root, 'plugins/gemini-cli/.mcp.json'));
    editJson(path.join(root, 'plugins/gemini-cli/kombai.package.json'), (data) => (data.version = '999.0.0'));
    assert.throws(() => validateGeminiCliPlugin(root), /versions must match/);
  });
});

test('Gemini CLI skills carry the sandbox note and nothing Gemini CLI substitutes', () => {
  fixture((root) => {
    const skillPath = path.join(root, 'plugins/gemini-cli/skills/about-kombai/SKILL.md');
    const original = fs.readFileSync(skillPath, 'utf8');
    fs.writeFileSync(skillPath, original.replaceAll(GEMINI_SANDBOX, 'Something else'));
    assert.throws(() => validateGeminiCliPlugin(root), /in Gemini CLI's sandbox/);
    fs.writeFileSync(skillPath, `${original}\nSee \${extensionPath}.\n`);
    assert.throws(() => validateGeminiCliPlugin(root), /which Gemini CLI substitutes/);
  });
});

test('a Gemini CLI team pack runs the CLI team build', () => {
  fixture((root) => {
    const version = validateGeminiCliPlugin(root);
    const archive = packGeminiCliPlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-gemini-cli-plugin-${version}-team.zip`);
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
      assert.equal(checkGeminiCliPluginDir(extracted), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});
