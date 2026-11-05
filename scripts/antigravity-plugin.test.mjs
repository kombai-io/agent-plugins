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
import { cliViewMcpConfig, FAQ_SKILL, RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE, WORKFLOW_SKILL } from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = 'plugins/antigravity';
const MANIFEST = `${PLUGIN}/.antigravity-plugin/plugin.json`;

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-antigravity-plugin-test-'));
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

// Unzip into a new folder and return the one folder the archive holds, which must be named after the archive.
function unpack(archive, run) {
  const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-antigravity-unpacked-'));
  try {
    const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(extracted), [path.basename(archive, '.zip')]);
    run(path.join(extracted, path.basename(archive, '.zip')));
  } finally {
    fs.rmSync(extracted, { recursive: true, force: true });
  }
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
    write(root, `${PLUGIN}/.DS_Store`, 'x');
    const relative = path.relative(process.cwd(), path.join(root, 'out'));
    const archive = packAntigravityPlugin(relative, root);
    assert.equal(archive, path.join(root, 'out', `kombai-antigravity-plugin-${next}.zip`));
    // The archive holds the plugin folder, ready for `agy plugin install <folder>`.
    unpack(archive, (plugin) => {
      assert.equal(checkAntigravityPluginDir(plugin), next);
      assert.equal(fs.readFileSync(path.join(plugin, 'LICENSE'), 'utf8'), fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
      assert.equal(fs.existsSync(path.join(plugin, '.DS_Store')), false);
    });
    assert.throws(() => bumpAntigravityVersion(current, root), /version must increase/);
  });
});

test('Antigravity validation keeps the manifest inside its schema', () => {
  for (const [change, error] of [
    [(data) => (data.icon = './assets/logo.png'), /outside its schema, or a deprecated one: icon/],
    [(data) => (data.source = 'gemini'), /outside its schema, or a deprecated one: source/],
    [(data) => (data.display_name = 'Kombai'), /must not set display_name\./],
    [(data) => (data.disabled = false), /must not set disabled\./],
    [(data) => (data.extensions = {}), /must not set extensions\./],
    [(data) => (data.skills = 'extra-skills'), /skills key would add more folders/],
    [(data) => (data.$schema = 'https://example.com/plugin.json'), /\$schema must be https:\/\/antigravity\.google/],
    [(data) => (data.author.id = 'kombai'), /author has a key its schema does not allow: id/],
    [(data) => (data.author.url = 5), /author url must be an https URL/],
    [(data) => (data.author.email = 'kombai'), /author email must be an address/],
    [(data) => (data.author = 'Kombai'), /author must be Kombai/],
    [(data) => (data.homepage = 5), /homepage must be an https URL/],
    [(data) => (data.homepage = 'http://kombai.com/'), /homepage must be an https URL/],
    [(data) => (data.homepage = ['https://kombai.com/']), /homepage must be an https URL/],
    [(data) => (data.homepage = 'https://kombai.com/ x'), /homepage must be an https URL/],
    [(data) => (data.author.email = 5), /author email must be an address/],
    [(data) => (data.author.email = ['@']), /author email must be an address/],
    [(data) => (data.keywords = ['']), /keywords must be a list of words/],
    [(data) => (data.description = 5), /description is missing/],
    [(data) => (data.suggestedPrompts = [5]), /suggestedPrompts must not be blank/],
    [(data) => (data.repository = 'git@github.com:kombai-io/agent-plugins.git'), /repository must be an https URL/],
    [(data) => (data.keywords = 'kombai'), /keywords must be a list of words/],
    [(data) => (data.keywords = ['kombai', 5]), /keywords must be a list of words/],
    [(data) => (data.displayName = 'kombai'), /displayName must be Kombai/],
    [(data) => (data.description = '  '), /description is missing/],
    [(data) => (data.license = 'Apache-2.0'), /license must be MIT/],
    [(data) => data.suggestedPrompts.push('A fourth prompt'), /at most three prompts/],
    [(data) => (data.suggestedPrompts[0] = '  '), /suggestedPrompts must not be blank/],
    [(data) => delete data.suggestedPrompts, /must set suggestedPrompts/],
    [(data) => (data.logo = 'https://example.com/logo.png'), /relative image path/],
    [(data) => (data.logo = '/assets/logo.png'), /relative image path/],
    [(data) => (data.logo = '../logo.png'), /relative image path/],
    // These exist on disk, so only the path rules can reject them.
    [(data) => (data.logo = 'assets/../assets/logo.png'), /relative image path/],
    [(data) => (data.logo = 'README.md'), /relative image path/],
    [(data) => (data.logo = 'assets/kombai.png'), /Missing Antigravity logo: assets\/kombai\.png/],
  ]) {
    fixture((root) => {
      editJson(path.join(root, MANIFEST), change);
      assert.throws(() => validateAntigravityPlugin(root), error);
    });
  }
  fixture((root) => {
    fs.writeFileSync(path.join(root, MANIFEST), 'null');
    assert.throws(() => validateAntigravityPlugin(root), /must be a JSON object/);
  });
  fixture((root) => {
    // A logo the manifest names in another form is still the one logo.
    editJson(path.join(root, MANIFEST), (data) => (data.logo = './assets/logo.png'));
    assert.ok(validateAntigravityPlugin(root));
  });
});

test('Antigravity validation rejects extra plugin parts and MCP configuration', () => {
  // A root manifest, each component Antigravity loads from its default path, and anything else.
  for (const [file, part] of [
    ['plugin.json', 'plugin.json'],
    ['mcp_config.json', 'mcp_config.json'],
    ['hooks.json', 'hooks.json'],
    ['rules/AGENTS.md', 'rules'],
    ['agents/helper.md', 'agents'],
    ['assets/extra.png', 'assets/extra.png'],
    ['.antigravity-plugin/notes.json', '.antigravity-plugin/notes.json'],
  ]) {
    fixture((root) => {
      write(root, `${PLUGIN}/${file}`);
      assert.throws(() => validateAntigravityPlugin(root), { message: `Antigravity plugin must not ship ${part}.` }, file);
    });
  }
  fixture((root) => {
    write(root, `${PLUGIN}/.mcp.json`);
    assert.throws(() => validateAntigravityPlugin(root), /canvas view off, so \.mcp\.json must not ship/);
  });
  for (const folder of ['rules', 'agents']) {
    fixture((root) => {
      fs.mkdirSync(path.join(root, PLUGIN, folder));
      if (folder === 'agents') write(root, `${PLUGIN}/agents/.DS_Store`, 'x');
      assert.throws(() => validateAntigravityPlugin(root), { message: `Antigravity plugin must not ship ${folder}.` });
    });
  }
  fixture((root) => {
    write(root, `${PLUGIN}/assets/.DS_Store`, 'x');
    assert.ok(validateAntigravityPlugin(root));
  });
});

test('an Antigravity pack refuses to write into the plugin folder', () => {
  fixture((root) => {
    for (const inside of [PLUGIN, `${PLUGIN}/dist`]) {
      assert.throws(() => packAntigravityPlugin(path.join(root, inside), root), /Pack into a folder outside plugins\/antigravity/);
    }
    assert.equal(fs.existsSync(path.join(root, PLUGIN, 'dist')), false);
  });
});

test('Antigravity validation keeps the canvas view off', () => {
  for (const withConfig of [false, true]) {
    fixture((root) => {
      let cliPackage;
      editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => {
        data.cli.view = true;
        cliPackage = data.cli.package;
      });
      if (withConfig) write(root, `${PLUGIN}/.mcp.json`, JSON.stringify(cliViewMcpConfig(cliPackage)));
      // Antigravity's own place for MCP servers, which validation would otherwise reject without saying why.
      if (withConfig) write(root, `${PLUGIN}/mcp_config.json`, JSON.stringify(cliViewMcpConfig(cliPackage)));
      assert.throws(() => validateAntigravityPlugin(root), /mcp_config\.json, which validation does not support yet; keep cli\.view off/);
    });
  }
});

test('Antigravity validation checks the plugin identity, license and files', () => {
  for (const [change, error] of [
    [(root) => editJson(path.join(root, MANIFEST), (data) => (data.name = 'kombai-antigravity')), /names must be kombai/],
    [(root) => editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.name = 'other')), /names must be kombai/],
    [
      (root) => editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.schemaVersion = 'kombai-vscode-plugin/v2')),
      /Unexpected Antigravity package contract schema/,
    ],
    [(root) => editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.version = '999.0.0')), /versions must match/],
    [(root) => fs.appendFileSync(path.join(root, PLUGIN, 'LICENSE'), '\nextra'), /license must match/],
    [
      (root) => {
        editJson(path.join(root, MANIFEST), (data) => (data.version = '1.0'));
        editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.version = '1.0'));
      },
      /Invalid Antigravity plugin version: 1\.0/,
    ],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'README.md')), /Missing Antigravity plugin file: README\.md/],
    [(root) => fs.rmSync(path.join(root, MANIFEST)), /Missing Antigravity plugin file: \.antigravity-plugin\/plugin\.json/],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'kombai.package.json')), /Missing Antigravity plugin file: kombai\.package\.json/],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'LICENSE')), /Missing Antigravity plugin file: LICENSE/],
  ]) {
    fixture((root) => {
      change(root);
      assert.throws(() => validateAntigravityPlugin(root), error);
    });
  }
});

for (const skill of [WORKFLOW_SKILL, FAQ_SKILL]) {
  test(`the Antigravity ${skill} skill must ask to run outside the sandbox`, () => {
    fixture((root) => {
      const skillPath = path.join(root, PLUGIN, 'skills', skill, 'SKILL.md');
      fs.writeFileSync(skillPath, fs.readFileSync(skillPath, 'utf8').replaceAll(ANTIGRAVITY_SANDBOX, 'Something else'));
      assert.throws(() => validateAntigravityPlugin(root), {
        message: `Antigravity ${skill} skill must ask to run outside Antigravity's sandbox before the first command.`,
      });
    });
  });
}

test('an Antigravity team pack runs the CLI team build', () => {
  fixture((root) => {
    const version = validateAntigravityPlugin(root);
    const archive = packAntigravityPlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-antigravity-plugin-${version}-team.zip`);
    unpack(archive, (plugin) => {
      assert.equal(JSON.parse(fs.readFileSync(path.join(plugin, 'kombai.package.json'), 'utf8')).cli.package, TEAM_CLI_PACKAGE);
      for (const [skill, topic] of [
        [WORKFLOW_SKILL, ''],
        [FAQ_SKILL, ' faq'],
      ]) {
        const text = fs.readFileSync(path.join(plugin, 'skills', skill, 'SKILL.md'), 'utf8');
        assert.ok(text.includes(`npx -y ${TEAM_CLI_PACKAGE} skill${topic}\``), skill);
        assert.ok(!text.includes(RELEASE_CLI_PACKAGE), skill);
      }
      assert.equal(checkAntigravityPluginDir(plugin), version);
    });
  });
});
