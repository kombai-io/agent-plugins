import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpVsCodeVersion, packVsCodePlugin, validateVsCodePlugin, VSCODE_UNSANDBOXED } from './vscode-plugin.mjs';
import { FAQ_SKILL, RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE, WORKFLOW_SKILL } from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = 'plugins/vscode';

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-vscode-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, '.github/plugin'), path.join(root, '.github/plugin'), { recursive: true });
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

function unzipText(archive, file) {
  const result = spawnSync('unzip', ['-p', archive, file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function zipEntries(archive) {
  const result = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split('\n').filter(Boolean);
}

test('VS Code version bump and marketplace package are independent of the other plugins', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateVsCodePlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpVsCodeVersion(next, root), next);
    assert.equal(validateVsCodePlugin(root), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    const archive = packVsCodePlugin(path.join(root, 'out'), root);
    assert.equal(path.basename(archive), `kombai-vscode-plugin-${next}.zip`);
    for (const licensePath of ['LICENSE', `${PLUGIN}/LICENSE`]) {
      assert.equal(unzipText(archive, licensePath), fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    }
    assert.equal(JSON.parse(unzipText(archive, '.github/plugin/marketplace.json')).plugins[0].source, './plugins/vscode');
    assert.equal(JSON.parse(unzipText(archive, `${PLUGIN}/plugin.json`)).version, next);
    assert.throws(() => bumpVsCodeVersion(current, root), /version must increase/);
  });
});

test('the VS Code ZIP holds only its marketplace, its plugin and the license', () => {
  fixture((root) => {
    // Other hosts' files beside the VS Code ones, and Finder's metadata, must stay out of it.
    for (const decoy of ['plugins/claude-code/.mcp.json', '.github/workflows/validate.yml', '.claude-plugin/marketplace.json']) {
      write(root, decoy);
    }
    write(root, `${PLUGIN}/.DS_Store`, 'x');
    write(root, `${PLUGIN}/skills/.DS_Store`, 'x');
    const relative = path.relative(process.cwd(), path.join(root, 'out'));
    const archive = packVsCodePlugin(relative, root);
    assert.equal(archive, path.join(root, 'out', path.basename(archive)));
    const files = zipEntries(archive).filter((entry) => !entry.endsWith('/'));
    assert.deepEqual(files.sort(), [
      '.github/plugin/marketplace.json',
      'LICENSE',
      `${PLUGIN}/LICENSE`,
      `${PLUGIN}/README.md`,
      `${PLUGIN}/kombai.package.json`,
      `${PLUGIN}/plugin.json`,
      `${PLUGIN}/skills/${FAQ_SKILL}/SKILL.md`,
      `${PLUGIN}/skills/${WORKFLOW_SKILL}/SKILL.md`,
    ]);
  });
});

test('VS Code validation rejects mismatched versions and bundled MCP configuration', () => {
  fixture((root) => {
    editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.version = '999.0.0'));
    assert.throws(() => validateVsCodePlugin(root), /versions must match/);
  });
  fixture((root) => {
    write(root, `${PLUGIN}/.mcp.json`);
    assert.throws(() => validateVsCodePlugin(root), /canvas view off, so \.mcp\.json must not ship/);
  });
});

test('VS Code validation rejects every file VS Code would read before ours', () => {
  // VS Code's marketplace and manifest lookup orders, written out here so trimming the validator's lists fails.
  for (const [file, message] of [
    ['marketplace.json', 'marketplace.json would hide the VS Code marketplace from VS Code.'],
    ['.plugin/marketplace.json', '.plugin/marketplace.json would hide the VS Code marketplace from VS Code.'],
    [`${PLUGIN}/.plugin/plugin.json`, '.plugin/plugin.json would change how VS Code reads the plugin.'],
    [`${PLUGIN}/.claude-plugin/plugin.json`, '.claude-plugin/plugin.json would change how VS Code reads the plugin.'],
  ]) {
    fixture((root) => {
      // VS Code stops at the first marketplace file with any plugins array, even an empty one.
      write(root, file, '{"plugins":[]}');
      assert.throws(() => validateVsCodePlugin(root), { message }, file);
    });
  }
});

test('the VS Code marketplace must install the VS Code plugin', () => {
  const marketplace = '.github/plugin/marketplace.json';
  for (const [change, error] of [
    // The ones that change what VS Code installs.
    [(data) => (data.plugins[0].source = './plugins/claude-code'), /must point to the bundled plugin/],
    [(data) => (data.plugins[0].source = { source: 'github', repo: 'kombai-io/agent-plugins' }), /must point to the bundled plugin/],
    [(data) => data.plugins.push({ ...data.plugins[0], name: 'kombai-team' }), /must point to the bundled plugin/],
    [(data) => (data.plugins = []), /must point to the bundled plugin/],
    [(data) => (data.plugins[0].name = 'kombai-vscode'), /must point to the bundled plugin/],
    // Repository convention: VS Code ignores the marketplace's own name and owner.
    [(data) => (data.name = 'other'), /Invalid VS Code marketplace/],
    [(data) => (data.owner = { name: 'Someone' }), /Invalid VS Code marketplace/],
  ]) {
    fixture((root) => {
      editJson(path.join(root, marketplace), change);
      assert.throws(() => validateVsCodePlugin(root), error);
    });
  }
});

test('the VS Code manifest stays in the Copilot format and declares only the skills', () => {
  const manifest = `${PLUGIN}/plugin.json`;
  for (const [change, error] of [
    [(data) => (data.$schema = 'https://agent-plugins.org/schemas/v1/plugin.schema.json'), /Copilot format \(no \$schema\)/],
    [(data) => (data.license = 'Apache-2.0'), /license and skills must be set/],
    [(data) => (data.skills = 'other/'), /license and skills must be set/],
    [(data) => delete data.skills, /license and skills must be set/],
    // VS Code reads each of these from a Copilot-format manifest, and an inline object replaces the default file.
    [(data) => (data.mcpServers = { other: { command: 'npx', args: ['-y', 'some-other-mcp'] } }), /must not set mcpServers\./],
    [(data) => (data.hooks = 'hooks.json'), /must not set hooks\./],
    [(data) => (data.agents = 'agents/'), /must not set agents\./],
    [(data) => (data.commands = 'commands/'), /must not set commands\./],
    [(data) => (data.rules = 'rules/'), /must not set rules\./],
  ]) {
    fixture((root) => {
      editJson(path.join(root, manifest), change);
      assert.throws(() => validateVsCodePlugin(root), error);
    });
  }
  fixture((root) => {
    fs.writeFileSync(path.join(root, manifest), 'null');
    assert.throws(() => validateVsCodePlugin(root), /must be a JSON object/);
  });
});

test('the VS Code plugin folder ships only its skills', () => {
  // VS Code loads these from a Copilot-format plugin by default.
  for (const [file, part] of [
    ['hooks.json', 'hooks.json'],
    ['agents/kombai.agent.md', 'agents'],
    ['commands/kombai.prompt.md', 'commands'],
    ['rules/kombai.instructions.md', 'rules'],
    ['notes.txt', 'notes.txt'],
    [`skills/${WORKFLOW_SKILL}/notes.md`, `skills/${WORKFLOW_SKILL}/notes.md`],
  ]) {
    fixture((root) => {
      write(root, `${PLUGIN}/${file}`, '# x\n');
      assert.throws(() => validateVsCodePlugin(root), { message: `VS Code plugin must not ship ${part}.` }, file);
    });
  }
  // An empty folder, or one holding only Finder's metadata, would ship empty.
  for (const folder of ['agents', 'commands']) {
    fixture((root) => {
      fs.mkdirSync(path.join(root, PLUGIN, folder));
      if (folder === 'commands') write(root, `${PLUGIN}/commands/.DS_Store`, 'x');
      assert.throws(() => validateVsCodePlugin(root), { message: `VS Code plugin must not ship ${folder}.` });
    });
  }
  fixture((root) => {
    write(root, `${PLUGIN}/.DS_Store`, 'x');
    assert.ok(validateVsCodePlugin(root));
  });
});

test('a VS Code pack refuses to write into a folder it zips', () => {
  fixture((root) => {
    for (const inside of [PLUGIN, `${PLUGIN}/dist`, '.github/plugin/out']) {
      assert.throws(() => packVsCodePlugin(path.join(root, inside), root), /Pack into a folder outside/, inside);
    }
    assert.equal(fs.existsSync(path.join(root, PLUGIN, 'dist')), false);
  });
});

test('VS Code validation checks the plugin identity, license and files', () => {
  for (const [change, error] of [
    [(root) => editJson(path.join(root, PLUGIN, 'plugin.json'), (data) => (data.name = 'kombai-vscode')), /names must be kombai/],
    [(root) => editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.name = 'other')), /names must be kombai/],
    [
      (root) => editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.schemaVersion = 'kombai-cursor-plugin/v2')),
      /Unexpected VS Code package contract schema/,
    ],
    [(root) => fs.appendFileSync(path.join(root, PLUGIN, 'LICENSE'), '\nextra'), /license must match/],
    [
      (root) => {
        editJson(path.join(root, PLUGIN, 'plugin.json'), (data) => (data.version = '1.0'));
        editJson(path.join(root, PLUGIN, 'kombai.package.json'), (data) => (data.version = '1.0'));
      },
      /Invalid VS Code plugin version: 1\.0/,
    ],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'README.md')), /Missing VS Code plugin file: README\.md/],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'plugin.json')), /Missing VS Code plugin file: plugin\.json/],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'kombai.package.json')), /Missing VS Code plugin file: kombai\.package\.json/],
    [(root) => fs.rmSync(path.join(root, PLUGIN, 'LICENSE')), /Missing VS Code plugin file: LICENSE/],
  ]) {
    fixture((root) => {
      change(root);
      assert.throws(() => validateVsCodePlugin(root), error);
    });
  }
});

for (const skill of [WORKFLOW_SKILL, FAQ_SKILL]) {
  test(`the VS Code ${skill} skill must ask to run outside the terminal sandbox before the first command`, () => {
    fixture((root) => {
      const skillPath = path.join(root, PLUGIN, 'skills', skill, 'SKILL.md');
      const text = fs.readFileSync(skillPath, 'utf8');
      // Drop only the guidance paragraph: the network bullet's copy of the parameter does not count.
      const cut = text.slice(0, text.indexOf('When VS Code runs')) + text.slice(text.indexOf('Run `npx'));
      assert.ok(cut.includes(VSCODE_UNSANDBOXED));
      fs.writeFileSync(skillPath, cut);
      assert.throws(() => validateVsCodePlugin(root), {
        message: `VS Code ${skill} skill must ask to run outside VS Code's terminal sandbox before the first command.`,
      });
    });
  });
}

test('a VS Code team pack runs the CLI team build', () => {
  fixture((root) => {
    const version = validateVsCodePlugin(root);
    const archive = packVsCodePlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-vscode-plugin-${version}-team.zip`);
    const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-team-unpacked-'));
    try {
      const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const plugin = path.join(extracted, PLUGIN);
      assert.equal(JSON.parse(fs.readFileSync(path.join(plugin, 'kombai.package.json'), 'utf8')).cli.package, TEAM_CLI_PACKAGE);
      for (const [skill, topic] of [
        [WORKFLOW_SKILL, ''],
        [FAQ_SKILL, ' faq'],
      ]) {
        const text = fs.readFileSync(path.join(plugin, 'skills', skill, 'SKILL.md'), 'utf8');
        assert.ok(text.includes(`npx -y ${TEAM_CLI_PACKAGE} skill${topic}\``), skill);
        assert.ok(!text.includes(RELEASE_CLI_PACKAGE), skill);
      }
      assert.equal(validateVsCodePlugin(extracted), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});
