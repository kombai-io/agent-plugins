import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bumpClaudeCodeVersion, packClaudeCodePlugin, validateClaudeCodePlugin } from './claude-code-plugin.mjs';
import { CHAT_NOTICES, cliViewMcpConfig, SETUP_SKILL, TEAM_CLI_PACKAGE } from './cli-view.mjs';
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
      ['generate-assets-with-kombai', ' assets'],
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
    // The view's old shape, the CLI server in .mcp.json, is refused.
    withViewOn(root);
    assert.throws(() => validateClaudeCodePlugin(root), /canvas view off/);
  });
});

test("the Claude Code plugin's get-started skill sets Kombai's server up before the first design chat", () => {
  // Claude Code gives a session only the MCP servers it had when it started, as Codex does a chat: setting the server
  // up mid-design leaves that chat without Kombai's card. Getting started first means the next chat has it.
  fixture((root) => {
    const archive = packClaudeCodePlugin(path.join(root, 'out'), root);
    const packed = spawnSync('unzip', ['-p', archive, `plugins/claude-code/skills/${SETUP_SKILL}/SKILL.md`], {
      encoding: 'utf8',
    });
    assert.equal(packed.status, 0, packed.stderr);
    const text = packed.stdout;
    const flat = text.replace(/\s+/g, ' ');
    assert.match(text, new RegExp(`^---\\nname: ${SETUP_SKILL}\\ndescription: `));
    // It looks for Kombai's card first, and sets the server up only where it is missing.
    assert.ok(flat.includes('ends in `taste_card`'));
    assert.ok(flat.indexOf('`taste_card`') < flat.indexOf(`npx -y ${RELEASE_CLI_PACKAGE} mcp install claude-code`));
    // It follows the CLI's answers, which only the CLI can read: a Claude Code with no card, a server turned off or
    // not starting.
    for (const answer of ['`claudeDesktop: false`', '`disabled: true`', '`notStarting: true`']) assert.ok(flat.includes(answer), answer);
    assert.ok(flat.includes(`npx -y ${RELEASE_CLI_PACKAGE} whoami`));
    // The same three prompts as Codex's onboarding and the CLI's starters card, each in a code block of its own, which
    // Claude draws with a Copy button: Claude's chat opens no link to a new session, so the user copies one there.
    for (const prompt of [
      'Design a standout UI for my website',
      'Explore design directions on canvas',
      'Redesign this section for my app',
    ])
      // Each starts with the workflow skill's command, Claude's counterpart of Codex's @Kombai mention, so a pasted prompt
      // runs Kombai's skill from its first message.
      assert.ok(text.includes(`\n\`\`\`\n/kombai:work-with-kombai ${prompt}\n\`\`\`\n`), prompt);
    // The user hears what to do in their words: where to start the new session, and why this one can't show the card.
    assert.ok(flat.includes('Start a new session in this folder to use it'));
    assert.ok(flat.includes("which this one can't load"));
    assert.ok(flat.includes('Copy a prompt to begin'));
    // Where the card can't show (a terminal, or a server off or not starting), the user designs right here.
    assert.ok(flat.includes('Ask for a design right here'));
    // A server turned off is so for this folder only (`/mcp disable` is per project), and one not starting may start in
    // a new session once its first download is done: the user hears that, as the CLI's answer says.
    assert.ok(flat.includes('turned off in this folder') && flat.includes('`/mcp enable kombai`'));
    assert.ok(flat.includes('a new session in a minute or two may get them'));
    // An error still ends the path: one retry where the CLI's next says so, else the sign-in check and the prompts.
    assert.ok(flat.includes('run it once more'));
    assert.ok(flat.includes('end as the `claudeDesktop: false` path does'));
    assert.ok(flat.includes('`CLI_NODE_TOO_OLD`'));
    for (const link of ['claude://', 'Reply with', '](']) assert.ok(!text.includes(link), link);
    for (const codexOnly of ['codex://', 'canvas_app', 'starters_card', 'sandbox_permissions'])
      assert.ok(!text.includes(codexOnly), codexOnly);
  });
});

test('Claude validation requires the get-started skill, and that it sets the server up', () => {
  fixture((root) => {
    const skill = path.join(root, 'plugins/claude-code/skills', SETUP_SKILL, 'SKILL.md');
    const text = fs.readFileSync(skill, 'utf8');
    fs.writeFileSync(skill, text.replaceAll('mcp install claude-code', 'mcp install codex'));
    assert.throws(() => validateClaudeCodePlugin(root), new RegExp(`must run ${RELEASE_CLI_PACKAGE.replaceAll('.', '\\.')} mcp install claude-code`));
    fs.rmSync(path.dirname(skill), { recursive: true });
    assert.throws(() => validateClaudeCodePlugin(root), new RegExp(SETUP_SKILL));
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

test('Claude validation accepts skills with CRLF line endings', () => {
  fixture((root) => {
    for (const skill of fs.readdirSync(path.join(root, 'plugins/claude-code/skills'))) {
      const file = path.join(root, 'plugins/claude-code/skills', skill, 'SKILL.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
    }
    validateClaudeCodePlugin(root);
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
      assert.ok(
        fs
          .readFileSync(path.join(plugin, 'skills', SETUP_SKILL, 'SKILL.md'), 'utf8')
          .includes(`npx -y ${TEAM_CLI_PACKAGE} mcp install claude-code`),
      );
      assert.equal(validateClaudeCodePlugin(extracted, { team: true }), version);
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true });
    }
  });
});
