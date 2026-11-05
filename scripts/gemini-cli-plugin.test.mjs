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
  GEMINI_SANDBOX_CHECK,
  GEMINI_UNSANDBOXED,
  packGeminiCliPlugin,
  validateGeminiCliPlugin,
} from './gemini-cli-plugin.mjs';
import { cliViewMcpConfig, FAQ_SKILL, RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE, WORKFLOW_SKILL } from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = 'plugins/gemini-cli';
const MANIFEST = `${PLUGIN}/gemini-extension.json`;

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-gemini-cli-plugin-test-'));
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
  const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-gemini-cli-unpacked-'));
  try {
    const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(extracted), [path.basename(archive, '.zip')]);
    run(path.join(extracted, path.basename(archive, '.zip')));
  } finally {
    fs.rmSync(extracted, { recursive: true, force: true });
  }
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
    write(root, `${PLUGIN}/.DS_Store`, 'x');
    const relative = path.relative(process.cwd(), path.join(root, 'out'));
    const archive = packGeminiCliPlugin(relative, root);
    assert.equal(archive, path.join(root, 'out', `kombai-gemini-cli-plugin-${next}.zip`));
    // The archive holds the extension folder, with gemini-extension.json at its top, for `gemini extensions install`.
    unpack(archive, (plugin) => {
      assert.equal(checkGeminiCliPluginDir(plugin), next);
      assert.equal(fs.readFileSync(path.join(plugin, 'LICENSE'), 'utf8'), fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
      assert.equal(fs.existsSync(path.join(plugin, '.DS_Store')), false);
    });
    assert.throws(() => bumpGeminiCliVersion(current, root), /version must increase/);
  });
});

test('Gemini CLI validation rejects every manifest key Gemini CLI reads beyond name, version and description', () => {
  for (const key of ['mcpServers', 'contextFileName', 'excludeTools', 'settings', 'themes', 'plan', 'migratedTo']) {
    fixture((root) => {
      editJson(path.join(root, MANIFEST), (data) => (data[key] = {}));
      assert.throws(() => validateGeminiCliPlugin(root), { message: `Gemini CLI manifest must not set ${key}.` });
    });
  }
  fixture((root) => {
    fs.writeFileSync(path.join(root, MANIFEST), '[]');
    assert.throws(() => validateGeminiCliPlugin(root), /must be a JSON object/);
  });
});

test('Gemini CLI validation rejects context files, other extension parts and MCP configuration', () => {
  // Each part Gemini CLI loads from an extension folder, and anything else.
  for (const [file, part] of [
    ['GEMINI.md', 'GEMINI.md'],
    ['hooks/hooks.json', 'hooks'],
    ['commands/kombai.toml', 'commands'],
    ['agents/kombai.md', 'agents'],
    ['policies/kombai.toml', 'policies'],
    ['.env', '.env'],
    [`skills/${FAQ_SKILL}/extra.md`, `skills/${FAQ_SKILL}/extra.md`],
  ]) {
    fixture((root) => {
      write(root, `${PLUGIN}/${file}`, 'x');
      assert.throws(() => validateGeminiCliPlugin(root), { message: `Gemini CLI extension must not ship ${part}.` }, file);
    });
  }
  fixture((root) => {
    write(root, `${PLUGIN}/.mcp.json`);
    assert.throws(() => validateGeminiCliPlugin(root), /canvas view off, so \.mcp\.json must not ship/);
  });
  for (const folder of ['commands', 'policies']) {
    fixture((root) => {
      fs.mkdirSync(path.join(root, PLUGIN, folder));
      if (folder === 'policies') write(root, `${PLUGIN}/policies/.DS_Store`, 'x');
      assert.throws(() => validateGeminiCliPlugin(root), { message: `Gemini CLI extension must not ship ${folder}.` });
    });
  }
  fixture((root) => {
    write(root, `${PLUGIN}/.DS_Store`, 'x');
    assert.ok(validateGeminiCliPlugin(root));
  });
});

test('Gemini CLI validation keeps the canvas view off', () => {
  for (const withConfig of [false, true]) {
    fixture((root) => {
      let cliPackage;
      editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => {
        data.cli.view = true;
        cliPackage = data.cli.package;
      });
      if (withConfig) write(root, `${PLUGIN}/.mcp.json`, JSON.stringify(cliViewMcpConfig(cliPackage)));
      // Gemini CLI's own place for MCP servers, which validation would otherwise reject without saying why.
      if (withConfig) editJson(path.join(root, MANIFEST), (data) => (data.mcpServers = cliViewMcpConfig(cliPackage).mcpServers));
      assert.throws(() => validateGeminiCliPlugin(root), /gemini-extension\.json, which validation does not support yet; keep cli\.view off/);
    });
  }
});

test('Gemini CLI validation checks the extension identity, license and files', () => {
  for (const [change, error] of [
    [(root) => editJson(path.join(root, MANIFEST), (data) => (data.name = 'kombai-gemini')), /names must be kombai/],
    [(root) => editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.name = 'other')), /names must be kombai/],
    [(root) => editJson(path.join(root, MANIFEST), (data) => (data.description = '')), /description is missing/],
    [(root) => editJson(path.join(root, MANIFEST), (data) => (data.description = 5)), /description is missing/],
    [
      (root) => editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.schemaVersion = 'kombai-vscode-plugin/v2')),
      /Unexpected Gemini CLI package contract schema/,
    ],
    [(root) => editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.version = '999.0.0')), /versions must match/],
    [(root) => fs.appendFileSync(path.join(root, PLUGIN, 'LICENSE'), '\nextra'), /license must match/],
    [
      (root) => {
        editJson(path.join(root, MANIFEST), (data) => (data.version = '1.0'));
        editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.version = '1.0'));
      },
      /Invalid Gemini CLI extension version: 1\.0/,
    ],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'README.md')), /Missing Gemini CLI extension file: README\.md/],
    [(root) => fs.rmSync(path.join(root, MANIFEST)), /Missing Gemini CLI extension file: gemini-extension\.json/],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'kombai.package.json')), /Missing Gemini CLI extension file: kombai\.package\.json/],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'LICENSE')), /Missing Gemini CLI extension file: LICENSE/],
  ]) {
    fixture((root) => {
      change(root);
      assert.throws(() => validateGeminiCliPlugin(root), error);
    });
  }
});

for (const skill of [WORKFLOW_SKILL, FAQ_SKILL]) {
  test(`the Gemini CLI ${skill} skill carries the sandbox note and nothing Gemini CLI substitutes`, () => {
    fixture((root) => {
      const skillPath = path.join(root, PLUGIN, 'skills', skill, 'SKILL.md');
      const original = fs.readFileSync(skillPath, 'utf8');
      fs.writeFileSync(skillPath, original.replaceAll(GEMINI_SANDBOX, 'Something else'));
      assert.throws(() => validateGeminiCliPlugin(root), {
        message: `Gemini CLI ${skill} skill must say what to do in Gemini CLI's sandbox before the first command.`,
      });
      fs.writeFileSync(skillPath, original.replaceAll(GEMINI_UNSANDBOXED, 'gemini'));
      assert.throws(() => validateGeminiCliPlugin(root), {
        message: `Gemini CLI ${skill} skill must say how to restart without the sandbox.`,
      });
      fs.writeFileSync(skillPath, `${original}\nSee \${extensionPath}.\n`);
      assert.throws(() => validateGeminiCliPlugin(root), {
        message: `Gemini CLI ${skill} skill must not contain \${…}, which Gemini CLI substitutes.`,
      });
    });
  });
}

test('the Gemini CLI workflow skill checks $SANDBOX before the first command', () => {
  fixture((root) => {
    const skillPath = path.join(root, PLUGIN, 'skills', WORKFLOW_SKILL, 'SKILL.md');
    const original = fs.readFileSync(skillPath, 'utf8');
    const message = `Gemini CLI ${WORKFLOW_SKILL} skill must check $SANDBOX before the first command.`;
    fs.writeFileSync(skillPath, original.replaceAll(GEMINI_SANDBOX_CHECK, 'look at the sandbox'));
    assert.throws(() => validateGeminiCliPlugin(root), { message });
    // After the first command is too late.
    fs.writeFileSync(skillPath, `${original.replaceAll(GEMINI_SANDBOX_CHECK, 'look at the sandbox')}\nThen ${GEMINI_SANDBOX_CHECK}.\n`);
    assert.throws(() => validateGeminiCliPlugin(root), { message });
  });
});

test('a Gemini CLI pack refuses to write into the extension folder', () => {
  fixture((root) => {
    for (const inside of [PLUGIN, `${PLUGIN}/dist`]) {
      assert.throws(() => packGeminiCliPlugin(path.join(root, inside), root), /Pack into a folder outside plugins\/gemini-cli/);
    }
    assert.equal(fs.existsSync(path.join(root, PLUGIN, 'dist')), false);
  });
});

test('a Gemini CLI team pack runs the CLI team build', () => {
  fixture((root) => {
    const version = validateGeminiCliPlugin(root);
    const archive = packGeminiCliPlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-gemini-cli-plugin-${version}-team.zip`);
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
      assert.equal(checkGeminiCliPluginDir(plugin), version);
    });
  });
});
