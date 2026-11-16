import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpDevinVersion, checkDevinPluginDir, validateDevinPlugin } from './devin-plugin.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = 'plugins/devin';
const MANIFEST = `${PLUGIN}/.devin-plugin/plugin.json`;

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-devin-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, PLUGIN), path.join(root, PLUGIN), { recursive: true });
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

function write(root, file, text = '{}') {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

test('Devin version bump is independent of the other plugins', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateDevinPlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpDevinVersion(next, root), next);
    assert.equal(validateDevinPlugin(root), next);
    assert.equal(checkDevinPluginDir(path.join(root, PLUGIN)), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    assert.throws(() => bumpDevinVersion(current, root), /version must increase/);
    assert.throws(() => bumpDevinVersion('1.0', root), /Invalid Devin plugin version/);
  });
});

test('Devin validation checks the manifest', () => {
  for (const [change, error] of [
    [(data) => (data.skills = './skills/'), /must not set skills\./],
    [(data) => (data.mcpServers = {}), /must not set mcpServers\./],
    [(data) => (data.name = 'kombai-design'), /names must be kombai/],
    [(data) => (data.description = '  '), /description is missing/],
    [(data) => (data.license = 'Apache-2.0'), /license must be MIT/],
    [(data) => (data.author = 'Kombai'), /author must be Kombai/],
    [(data) => (data.homepage = 'http://kombai.com/'), /homepage must be an https URL/],
    [(data) => (data.repository = 'git@github.com:kombai-io/agent-plugins.git'), /repository must be an https URL/],
    [(data) => (data.displayName = 'kombai'), /displayName must be Kombai/],
    [(data) => (data.description = 'Design UI with Kombai.'), /60 to 200 characters/],
    [(data) => (data.description += '.'), /without a trailing full stop/],
    [(data) => delete data.shortDescription, /shortDescription is missing/],
    [(data) => (data.keywords = 'Design & Creative'), /keywords must be a list of words/],
    // Kombai signs in through the browser on the user's computer, which a cloud session's machine is not.
    [(data) => delete data.platforms, /platforms: \["local"\]/],
    [(data) => (data.platforms = ['local', 'cloud']), /platforms: \["local"\]/],
    [(data) => (data.logo = 'https://kombai.com/logo.png'), /bundled logo/],
    [(data) => (data.version = '0.2.0'), /versions must match/],
  ]) {
    fixture((root) => {
      editJson(path.join(root, MANIFEST), change);
      assert.throws(() => validateDevinPlugin(root), error);
    });
  }
  fixture((root) => {
    fs.writeFileSync(path.join(root, MANIFEST), 'null');
    assert.throws(() => validateDevinPlugin(root), /must be a JSON object/);
  });
});

test('Devin validation checks the package contract and license', () => {
  for (const [change, error] of [
    [(data) => (data.schemaVersion = 'kombai-cursor-plugin/v2'), /Unexpected Devin package contract schema/],
    [(data) => (data.cli.view = true), /keep cli\.view off/],
    [(data) => (data.cli.package = '@kombai/cli@latest'), /must pin a released Kombai CLI/],
  ]) {
    fixture((root) => {
      editJson(path.join(root, PLUGIN, 'kombai.package.json'), change);
      assert.throws(() => validateDevinPlugin(root), error);
    });
  }
  fixture((root) => {
    fs.appendFileSync(path.join(root, PLUGIN, 'LICENSE'), '\n');
    assert.throws(() => validateDevinPlugin(root), /license must match the repository LICENSE/);
  });
});

test('Devin validation rejects extra plugin parts', () => {
  // Each part Devin loads from a plugin besides skills, and anything else.
  for (const [file, part] of [
    ['AGENTS.md', 'AGENTS.md'],
    ['rules/design.md', 'rules'],
    ['agents/designer.md', 'agents'],
    ['hooks.json', 'hooks.json'],
    ['.claude-plugin/plugin.json', '.claude-plugin'],
    ['plugin.json', 'plugin.json'],
    ['skills/extra/SKILL.md', 'skills/extra'],
  ]) {
    fixture((root) => {
      write(root, `${PLUGIN}/${file}`);
      assert.throws(() => validateDevinPlugin(root), new RegExp(`must not ship ${part.replace(/\./g, '\\.')}\\.`));
    });
  }
  fixture((root) => {
    write(root, `${PLUGIN}/.mcp.json`);
    assert.throws(() => validateDevinPlugin(root), /canvas view off, so \.mcp\.json must not ship/);
  });
  fixture((root) => {
    // Finder's metadata is ignored.
    write(root, `${PLUGIN}/.DS_Store`, 'x');
    assert.ok(validateDevinPlugin(root));
  });
});
