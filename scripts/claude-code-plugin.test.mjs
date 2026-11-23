import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpClaudeCodeVersion, packClaudeCodePlugin, validateClaudeCodePlugin } from './claude-code-plugin.mjs';
import {
  ALPHA_CLI_PACKAGE,
  CHAT_NOTICES,
  cliRunLine,
  cliViewMcpConfig,
  LAUNCHER_RUN,
  SETUP_SKILL,
  TEAM_CLI_PACKAGE,
} from './cli-view.mjs';
import { pinnedCliPackage } from './cli-version.mjs';

/** The released CLI the source pins. */
const RELEASE_CLI_PACKAGE = pinnedCliPackage();

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

/** Unzip a team archive and check each stub runs the CLI's newest beta from npm (or `cliPackage`, the alpha). */
function checkTeamArchive(archive, pluginDir, cliPackage = TEAM_CLI_PACKAGE) {
  const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-team-unpacked-'));
  try {
    const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const plugin = path.join(extracted, pluginDir);
    const contract = JSON.parse(fs.readFileSync(path.join(plugin, 'kombai.package.json'), 'utf8'));
    assert.equal(contract.cli.package, cliPackage);
    for (const [skill, topic] of [
      ['work-with-kombai', ''],
      ['about-kombai', ' faq'],
    ]) {
      const text = fs.readFileSync(path.join(plugin, 'skills', skill, 'SKILL.md'), 'utf8');
      assert.ok(text.includes(cliRunLine(cliPackage, { npxOnly: true })), skill);
      assert.ok(text.includes(`Run \`kombai skill${topic}\``), skill);
      assert.ok(!text.includes('GitHub Packages'), skill);
      assert.ok(!text.includes(RELEASE_CLI_PACKAGE), skill);
      // A team build follows the beta tag through npx, never the installed copy's launcher.
      assert.ok(!text.includes(LAUNCHER_RUN), skill);
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

test('the Claude Code plugin ships no MCP server, as Anthropic\'s plugin directory requires', () => {
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
    assert.ok(skill.stdout.includes(`${cliRunLine(RELEASE_CLI_PACKAGE)}\n\nRun \`kombai skill\``));
    // The view's old shape, the CLI server in .mcp.json, is refused.
    withViewOn(root);
    assert.throws(() => validateClaudeCodePlugin(root), /canvas view off/);
  });
});

test('Claude validation refuses the get-started-with-kombai skill, which adds an MCP server the plugin does not declare', () => {
  fixture((root) => {
    const skillRoot = path.join(root, 'plugins/claude-code/skills');
    assert.ok(!fs.existsSync(path.join(skillRoot, SETUP_SKILL)));
    // Claude Code's last copy of the skill ran `kombai mcp install claude-code`: its about-kombai skill renamed will do,
    // since the skill set itself is refused.
    const about = fs.readFileSync(path.join(skillRoot, 'about-kombai', 'SKILL.md'), 'utf8');
    fs.mkdirSync(path.join(skillRoot, SETUP_SKILL));
    fs.writeFileSync(
      path.join(skillRoot, SETUP_SKILL, 'SKILL.md'),
      about.replace(/^name: about-kombai$/m, `name: ${SETUP_SKILL}`),
    );
    assert.throws(() => validateClaudeCodePlugin(root), /Claude plugin must contain the .* skills, and no other/);
  });
});

test('Claude validation refuses the generate-assets-with-kombai skill, which the directory refuses', () => {
  fixture((root) => {
    const skillRoot = path.join(root, 'plugins/claude-code/skills');
    assert.ok(!fs.existsSync(path.join(skillRoot, 'generate-assets-with-kombai')));
    validateClaudeCodePlugin(root);
    // Claude Code's last copy of the skill: its about-kombai skill with the asset skill's name and topic.
    const about = fs.readFileSync(path.join(skillRoot, 'about-kombai', 'SKILL.md'), 'utf8');
    fs.mkdirSync(path.join(skillRoot, 'generate-assets-with-kombai'));
    fs.writeFileSync(
      path.join(skillRoot, 'generate-assets-with-kombai', 'SKILL.md'),
      about.replace(/^name: about-kombai$/m, 'name: generate-assets-with-kombai').replaceAll('kombai skill faq', 'kombai skill assets'),
    );
    assert.throws(() => validateClaudeCodePlugin(root), /Claude plugin must contain the .* skills, and no other/);
  });
});

test('Claude validation requires every skill to open with its Claude Code-only notice', () => {
  fixture((root) => {
    const notice = CHAT_NOTICES['claude-code'];
    for (const skill of fs.readdirSync(path.join(root, 'plugins/claude-code/skills'))) {
      const file = path.join(root, 'plugins/claude-code/skills', skill, 'SKILL.md');
      const text = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, text.replace(`${notice}\n\n`, ''));
      assert.throws(() => validateClaudeCodePlugin(root), new RegExp(`Claude ${skill} skill must open with the notice`));
      // Codex's notice is about Codex and ChatGPT, not Claude Code.
      fs.writeFileSync(file, text.replace(notice, CHAT_NOTICES.codex));
      assert.throws(() => validateClaudeCodePlugin(root), new RegExp(`Claude ${skill} skill must open with the notice`));
      fs.writeFileSync(file, text);
    }
    validateClaudeCodePlugin(root);
  });
});

test('Claude validation requires every skill to say how to run the CLI in one line, before its first command', () => {
  fixture((root) => {
    const line = cliRunLine(RELEASE_CLI_PACKAGE);
    // The installed CLI's launcher first, npx as the fallback, and npx named nowhere else.
    assert.ok(line.indexOf(LAUNCHER_RUN) > 0 && line.indexOf(LAUNCHER_RUN) < line.indexOf('npx -y'));
    for (const skill of fs.readdirSync(path.join(root, 'plugins/claude-code/skills'))) {
      const file = path.join(root, 'plugins/claude-code/skills', skill, 'SKILL.md');
      const text = fs.readFileSync(file, 'utf8');
      assert.ok(text.includes(`\n\n${line}\n\n`), skill);
      assert.equal(text.split('npx -y').length, 2, `${skill}: npx is named once, in the line`);
      const without = text.replace(`${line}\n\n`, '');
      const pattern = new RegExp(`Claude ${skill} skill must say how to run Kombai's CLI in a line of its own`);
      fs.writeFileSync(file, without);
      assert.throws(() => validateClaudeCodePlugin(root), pattern);
      // After a command is too late: the agent would not know how to run it.
      fs.writeFileSync(file, `${without.trimEnd()}\n\n${line}\n\nThen stop.\n`);
      assert.throws(() => validateClaudeCodePlugin(root), pattern);
      // Run into the next paragraph, it is no line of its own.
      fs.writeFileSync(file, text.replace(`${line}\n\n`, `${line}\n`));
      assert.throws(() => validateClaudeCodePlugin(root), pattern);
      // Naming another CLI version than the plugin pins.
      fs.writeFileSync(file, text.replace(line, cliRunLine('@kombai/cli@9.9.9')));
      assert.throws(() => validateClaudeCodePlugin(root));
      // A command written out with npx again: the line would no longer be what says how to run it.
      fs.writeFileSync(file, `${text.trimEnd()}\n\nThen run \`npx -y ${RELEASE_CLI_PACKAGE} whoami\`.\n`);
      assert.throws(
        () => validateClaudeCodePlugin(root),
        new RegExp(`Claude ${skill} skill must write each command as \`kombai <command>\`, not with npx`),
      );
      fs.writeFileSync(file, text);
    }
    validateClaudeCodePlugin(root);
  });
});

test('Claude validation accepts skills with CRLF line endings, and their team pack still drops the launcher', () => {
  fixture((root) => {
    for (const skill of fs.readdirSync(path.join(root, 'plugins/claude-code/skills'))) {
      const file = path.join(root, 'plugins/claude-code/skills', skill, 'SKILL.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
    }
    validateClaudeCodePlugin(root);
    const archive = packClaudeCodePlugin(path.join(root, 'out'), root, { team: true });
    const { extracted } = checkTeamArchive(archive, 'plugins/claude-code');
    try {
      validateClaudeCodePlugin(extracted, { team: true });
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});

test('neither the Claude Code manifest nor its marketplace entry names an MCP server', () => {
  fixture((root) => {
    const manifestPath = path.join(root, 'plugins/claude-code/.claude-plugin/plugin.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.mcpServers = cliViewMcpConfig(RELEASE_CLI_PACKAGE).mcpServers;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => validateClaudeCodePlugin(root), /manifest must not name mcpServers/);
  });
  // A marketplace entry's fields reach the plugin too, so a server there would ship as surely as one in .mcp.json.
  fixture((root) => {
    const marketplacePath = path.join(root, '.claude-plugin/marketplace.json');
    const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
    marketplace.plugins[0].mcpServers = cliViewMcpConfig(RELEASE_CLI_PACKAGE).mcpServers;
    fs.writeFileSync(marketplacePath, JSON.stringify(marketplace));
    assert.throws(() => validateClaudeCodePlugin(root), /marketplace entry must not name mcpServers/);
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
      assert.ok(!fs.existsSync(path.join(plugin, 'skills', SETUP_SKILL)));
      // The README's quote of the line follows the skills: the team's line, with no launcher.
      const readme = fs.readFileSync(path.join(plugin, 'README.md'), 'utf8');
      assert.ok(readme.includes(`first says how to run them: "${cliRunLine(TEAM_CLI_PACKAGE, { npxOnly: true })}"`));
      assert.ok(!readme.includes(LAUNCHER_RUN));
      assert.equal(validateClaudeCodePlugin(extracted, { team: true }), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});

test('a Claude Code alpha pack runs the CLI alpha from npm alpha, and passes as an alpha build only', () => {
  fixture((root) => {
    const version = validateClaudeCodePlugin(root);
    const archive = packClaudeCodePlugin(path.join(root, 'out'), root, { team: 'alpha' });
    assert.equal(path.basename(archive), `kombai-claude-code-plugin-${version}-alpha.zip`);
    const { extracted, plugin } = checkTeamArchive(archive, 'plugins/claude-code', ALPHA_CLI_PACKAGE);
    try {
      const readme = fs.readFileSync(path.join(plugin, 'README.md'), 'utf8');
      assert.ok(readme.includes(`first says how to run them: "${cliRunLine(ALPHA_CLI_PACKAGE, { npxOnly: true })}"`));
      assert.ok(!readme.includes(LAUNCHER_RUN));
      assert.ok(!readme.includes(TEAM_CLI_PACKAGE));
      assert.equal(validateClaudeCodePlugin(extracted, { team: 'alpha' }), version);
      // It is neither of the other two builds.
      assert.throws(
        () => validateClaudeCodePlugin(extracted, { team: true }),
        /team build must run @kombai\/cli@beta/,
      );
      assert.throws(() => validateClaudeCodePlugin(extracted), /must pin a released Kombai CLI/);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});
