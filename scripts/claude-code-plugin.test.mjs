import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpClaudeCodeVersion, packClaudeCodePlugin, validateClaudeCodePlugin } from './claude-code-plugin.mjs';
import { cliViewMcpConfig, RELEASE_CLI_PACKAGE, TEAM_CLI_PACKAGE } from './cli-view.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-claude-plugin-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(source, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(source, '.claude-plugin'), path.join(root, '.claude-plugin'), { recursive: true });
    fs.cpSync(path.join(source, 'plugins/claude-code'), path.join(root, 'plugins/claude-code'), {
      recursive: true,
    });
    run(root);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/** Unzip a team archive and check each stub runs the CLI's newest beta from npm. */
function checkTeamArchive(archive, pluginDir) {
  const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-team-unpacked-'));
  try {
    const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const plugin = path.join(extracted, pluginDir);
    const contract = JSON.parse(fs.readFileSync(path.join(plugin, 'kombai.package.json'), 'utf8'));
    assert.equal(contract.cli.package, TEAM_CLI_PACKAGE);
    for (const [skill, topic] of [
      ['work-with-kombai', ''],
      ['about-kombai', ' faq'],
    ]) {
      const text = fs.readFileSync(path.join(plugin, 'skills', skill, 'SKILL.md'), 'utf8');
      assert.ok(text.includes(`npx -y ${TEAM_CLI_PACKAGE} skill${topic}\``), skill);
      assert.ok(!text.includes('GitHub Packages'), skill);
      assert.ok(!text.includes(RELEASE_CLI_PACKAGE), skill);
    }
    return { extracted, plugin };
  } catch (error) {
    fs.rmSync(extracted, { recursive: true, force: true });
    throw error;
  }
}

test('Claude version bump and marketplace package are independent of Codex', () => {
  fixture((root) => {
    const workspaceVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const current = validateClaudeCodePlugin(root);
    const parts = current.split('.').map(Number);
    const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    assert.equal(bumpClaudeCodeVersion(next, root), next);
    assert.equal(validateClaudeCodePlugin(root), next);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, workspaceVersion);
    const archive = packClaudeCodePlugin(path.join(root, 'out'), root);
    assert.equal(path.basename(archive), `kombai-claude-code-plugin-${next}.zip`);
    for (const licensePath of ['LICENSE', 'plugins/claude-code/LICENSE']) {
      const packedLicense = spawnSync('unzip', ['-p', archive, licensePath], { encoding: 'utf8' });
      assert.equal(packedLicense.status, 0, packedLicense.stderr);
      assert.equal(packedLicense.stdout, fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    }
    const marketplace = spawnSync('unzip', ['-p', archive, '.claude-plugin/marketplace.json'], {
      encoding: 'utf8',
    });
    assert.equal(marketplace.status, 0, marketplace.stderr);
    assert.equal(JSON.parse(marketplace.stdout).plugins[0].source, './plugins/claude-code');
    const manifest = spawnSync('unzip', ['-p', archive, 'plugins/claude-code/.claude-plugin/plugin.json'], {
      encoding: 'utf8',
    });
    assert.equal(manifest.status, 0, manifest.stderr);
    assert.equal(JSON.parse(manifest.stdout).version, next);
    assert.throws(() => bumpClaudeCodeVersion(current, root), /version must increase/);
  });
});

test('Claude validation rejects mismatched versions and any MCP configuration', () => {
  fixture((root) => {
    const contractPath = path.join(root, 'plugins/claude-code/kombai.package.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const originalVersion = contract.version;
    contract.version = '999.0.0';
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    assert.throws(() => validateClaudeCodePlugin(root), /versions must match/);
    contract.version = originalVersion;
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    fs.writeFileSync(path.join(root, 'plugins/claude-code/.mcp.json'), '{}');
    assert.throws(() => validateClaudeCodePlugin(root), /canvas view off, so \.mcp\.json must not ship/);
  });
});

/**
 * Turn the canvas view on in a fixture copy, as Claude Code plugin versions to 0.4.x shipped it: `cli.view` and the
 * `.mcp.json` that registers the CLI server. From 0.5.0 the plugin is skills-only and the CLI writes the server into
 * the user's own Claude Code config (`kombai mcp install claude-code`, from the CLI's notes for the Claude desktop app).
 */
function withViewOn(root) {
  const pluginRoot = path.join(root, 'plugins/claude-code');
  const contractPath = path.join(pluginRoot, 'kombai.package.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.cli.view = true;
  fs.writeFileSync(contractPath, JSON.stringify(contract));
  fs.writeFileSync(path.join(pluginRoot, '.mcp.json'), JSON.stringify(cliViewMcpConfig(contract.cli.package)));
}

test('the Claude Code plugin ships no local MCP server, as Anthropic\'s plugin directory requires', () => {
  fixture((root) => {
    const pluginRoot = path.join(root, 'plugins/claude-code');
    const contract = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'kombai.package.json'), 'utf8'));
    assert.equal(contract.cli.view, false);
    validateClaudeCodePlugin(root);
    const archive = packClaudeCodePlugin(path.join(root, 'out'), root);
    const listing = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
    assert.equal(listing.status, 0, listing.stderr);
    for (const file of ['.mcp.json', 'mcp.json', '.app.json'])
      assert.ok(!listing.stdout.split('\n').includes(`plugins/claude-code/${file}`), file);
    // The skill stays a stub over the CLI's text, whose Claude desktop notes add Kombai's server when it is missing.
    const skill = spawnSync('unzip', ['-p', archive, 'plugins/claude-code/skills/work-with-kombai/SKILL.md'], {
      encoding: 'utf8',
    });
    assert.ok(skill.stdout.includes(`Run \`npx -y ${RELEASE_CLI_PACKAGE} skill\``));
    // The view's old shape, the CLI server in .mcp.json, is refused, as is a server named in the manifest.
    withViewOn(root);
    assert.throws(() => validateClaudeCodePlugin(root), /canvas view off/);
  });
});

test("the Claude Code manifest names no MCP server of its own", () => {
  fixture((root) => {
    const manifestPath = path.join(root, 'plugins/claude-code/.claude-plugin/plugin.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.mcpServers = cliViewMcpConfig(RELEASE_CLI_PACKAGE).mcpServers;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => validateClaudeCodePlugin(root), /must not name mcpServers/);
  });
});

test('a Claude Code team pack runs the CLI team build, and ships no MCP config either', () => {
  fixture((root) => {
    const version = validateClaudeCodePlugin(root);
    const archive = packClaudeCodePlugin(path.join(root, 'out'), root, { team: true });
    assert.equal(path.basename(archive), `kombai-claude-code-plugin-${version}-team.zip`);
    const { extracted, plugin } = checkTeamArchive(archive, 'plugins/claude-code');
    try {
      assert.ok(!fs.existsSync(path.join(plugin, '.mcp.json')));
      assert.equal(validateClaudeCodePlugin(extracted), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});
