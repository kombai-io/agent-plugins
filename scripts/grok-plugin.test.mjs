import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpGrokVersion, checkGrokPluginDir, validateGrokPlugin } from './grok-plugin.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = 'plugins/grok';
const MANIFEST = `${PLUGIN}/.grok-plugin/plugin.json`;
const MARKETPLACE = '.grok-plugin/marketplace.json';

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-grok-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, PLUGIN), path.join(root, PLUGIN), { recursive: true });
    fs.cpSync(path.join(source, '.grok-plugin'), path.join(root, '.grok-plugin'), { recursive: true });
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

test('Grok version bump is independent of the other plugins', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateGrokPlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpGrokVersion(next, root), next);
    assert.equal(validateGrokPlugin(root), next);
    assert.equal(checkGrokPluginDir(path.join(root, PLUGIN)), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    assert.throws(() => bumpGrokVersion(current, root), /version must increase/);
    assert.throws(() => bumpGrokVersion('1.0', root), /Invalid Grok plugin version/);
  });
});

test('Grok validation checks the manifest', () => {
  for (const [change, error] of [
    [(data) => (data.skills = './skills/'), /must not set skills\./],
    [(data) => (data.mcpServers = {}), /must not set mcpServers\./],
    [(data) => (data.name = 'kombai-design'), /names must be kombai/],
    [(data) => (data.description = '  '), /description is missing/],
    [(data) => (data.license = 'Apache-2.0'), /license must be MIT/],
    [(data) => (data.author = 'Kombai'), /author must be Kombai/],
    [(data) => (data.homepage = 'http://kombai.com/'), /homepage must be an https URL/],
    [(data) => (data.repository = 'git@github.com:kombai-io/agent-plugins.git'), /repository must be an https URL/],
    // Generic keywords fire Grok's suggest-this-plugin prompt on unrelated requests.
    [(data) => data.keywords.push('design'), /keywords must each name Kombai/],
    [(data) => (data.keywords = []), /keywords must each name Kombai/],
    [(data) => (data.logo = 'https://kombai.com/logo.png'), /bundled logo/],
    [(data) => (data.version = '0.2.0'), /versions must match/],
  ]) {
    fixture((root) => {
      editJson(path.join(root, MANIFEST), change);
      assert.throws(() => validateGrokPlugin(root), error);
    });
  }
  fixture((root) => {
    fs.writeFileSync(path.join(root, MANIFEST), 'null');
    assert.throws(() => validateGrokPlugin(root), /must be a JSON object/);
  });
});

test('Grok validation checks the package contract and license', () => {
  for (const [change, error] of [
    [(data) => (data.schemaVersion = 'kombai-cursor-plugin/v2'), /Unexpected Grok package contract schema/],
    [(data) => (data.cli.view = true), /keep cli\.view off/],
    [(data) => (data.cli.package = '@kombai/cli@latest'), /must pin a released Kombai CLI/],
  ]) {
    fixture((root) => {
      editJson(path.join(root, PLUGIN, 'kombai.package.json'), change);
      assert.throws(() => validateGrokPlugin(root), error);
    });
  }
  fixture((root) => {
    fs.appendFileSync(path.join(root, PLUGIN, 'LICENSE'), '\n');
    assert.throws(() => validateGrokPlugin(root), /license must match the repository LICENSE/);
  });
});

test('Grok validation rejects extra plugin parts', () => {
  // Each part Grok Build loads from a plugin besides skills, and anything else.
  for (const [file, part] of [
    ['commands/design.md', 'commands'],
    ['agents/designer.md', 'agents'],
    ['hooks/hooks.json', 'hooks'],
    ['.lsp.json', '.lsp.json'],
    ['.claude-plugin/plugin.json', '.claude-plugin'],
    ['skills/extra/SKILL.md', 'skills/extra'],
  ]) {
    fixture((root) => {
      write(root, `${PLUGIN}/${file}`);
      assert.throws(() => validateGrokPlugin(root), new RegExp(`must not ship ${part.replace(/\./g, '\\.')}\\.`));
    });
  }
  fixture((root) => {
    write(root, `${PLUGIN}/.mcp.json`);
    assert.throws(() => validateGrokPlugin(root), /canvas view off, so \.mcp\.json must not ship/);
  });
  fixture((root) => {
    // Finder's metadata is ignored.
    write(root, `${PLUGIN}/.DS_Store`, 'x');
    assert.ok(validateGrokPlugin(root));
  });
});

test('Grok marketplace lists only the bundled plugin, with Kombai-scoped suggestions', () => {
  for (const [change, error] of [
    [(data) => (data.name = 'kombai-plugins'), /named kombai and owned by Kombai/],
    [(data) => delete data.owner, /named kombai and owned by Kombai/],
    [(data) => data.plugins.push({ ...data.plugins[0], name: 'kombai-2' }), /exactly one plugin/],
    [(data) => (data.plugins = {}), /exactly one plugin/],
    [(data) => (data.plugins[0].name = 'kombai-design'), /named after the plugin/],
    // The Claude Code plugin's skills refuse outside Claude Code.
    [(data) => (data.plugins[0].source.path = './plugins/claude-code'), /point to the bundled plugin/],
    [(data) => (data.plugins[0].source = './plugins/grok'), /point to the bundled plugin/],
    [(data) => (data.plugins[0].source.sha = 'a'.repeat(40)), /point to the bundled plugin/],
    [(data) => (data.plugins[0].description = 'Kombai.'), /descriptions must match/],
    [(data) => (data.plugins[0].homepage = 'kombai.com'), /homepage must be an https URL/],
    [(data) => data.plugins[0].keywords.push('design'), /keywords must match the manifest/],
    [(data) => data.plugins[0].domains.push('figma.com'), /Kombai's own/],
    [(data) => (data.plugins[0].domains = []), /Kombai's own/],
    [(data) => (data.plugins[0].hooks = {}), /must not set hooks\./],
  ]) {
    fixture((root) => {
      editJson(path.join(root, MARKETPLACE), change);
      assert.throws(() => validateGrokPlugin(root), error);
    });
  }
  fixture((root) => {
    fs.rmSync(path.join(root, MARKETPLACE));
    assert.throws(() => validateGrokPlugin(root), /ENOENT/);
  });
});
