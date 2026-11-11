import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// The Kombai CLI's MCP server (`kombai mcp`, registered as `kombai`: the canvas view and Kombai's cards) is the one
// MCP server a plugin may bundle. What each host is listed is the CLI's call (VIEW_HOSTS and cardsFor in
// vscode-assistant's packages/cli/src/mcp/client-gate.js); a plugin only registers the server, and only while its
// kombai.package.json has `cli.view` on. Turning it on for another host: README.md, "Adding a host to the canvas view".
export const CLI_VIEW_SERVER = 'kombai';
// Each plugin's skills, all stubs over the CLI's text: the workflow runs `kombai skill`, the FAQ `kombai skill faq`, the
// asset generation one `kombai skill assets`.
export const WORKFLOW_SKILL = 'work-with-kombai';
export const FAQ_SKILL = 'about-kombai';
export const ASSETS_SKILL = 'generate-assets-with-kombai';
const SKILL_TOPICS = { [WORKFLOW_SKILL]: '', [FAQ_SKILL]: ' faq', [ASSETS_SKILL]: ' assets' };
/** The CLI's skill topic each skill prints, by skill: `kombai skill` alone prints the `overview` topic. The pinned CLI
 *  must have every one (cli-version.mjs). */
export const SKILL_CLI_TOPICS = Object.fromEntries(
  Object.entries(SKILL_TOPICS).map(([name, topic]) => [name, topic.trim() || 'overview']),
);
/** The CLI's npm package. */
export const CLI_NAME = '@kombai/cli';
/** A released CLI version: x.y.z, no tag, range or prerelease. What a plugin's `cli.package` pins. */
export const RELEASE_VERSION_RE = /^\d+\.\d+\.\d+$/;
/** Whether `cliPackage` pins a released CLI: `@kombai/cli@x.y.z`. */
export function isReleaseCliPackage(cliPackage) {
  return (
    typeof cliPackage === 'string' &&
    cliPackage.startsWith(`${CLI_NAME}@`) &&
    RELEASE_VERSION_RE.test(cliPackage.slice(CLI_NAME.length + 1))
  );
}
// Where a text names the Kombai CLI package (the internal `@kombai-io` one too), built from shared parts so the check
// and set-cli-version's rewrite read the same name. Not a link to the package's npm page
// (`npmjs.com/package/@kombai/cli`), which runs nothing; not another package whose name starts the same
// (`@kombai/client`, `@kombai/cli-tools`); and not ANTIGRAVITY_VERSION_CLASS, the version class of Antigravity's
// allow rule (`@kombai/cli@[a-z0-9.-]+`), which runs no CLI and matches every version. Any other spelling is read as
// the CLI: a bare name or a range as `@kombai/cli`, which the check refuses.
export const ANTIGRAVITY_VERSION_CLASS = '[a-z0-9.-]+';
const NOT_NPM_PAGE = String.raw`(?<!npmjs\.com\/package\/)`;
const NAME_END = String.raw`\/cli(?![\w-]|@${ANTIGRAVITY_VERSION_CLASS.replace(/[[\].+-]/g, '\\$&')}(?![\w.-]))`;
const VERSION_OR_TAG = '@[A-Za-z0-9._+-]+';
/** Every Kombai CLI package a text names, with whatever tag or version follows it, or none. */
const CLI_REFERENCE_RE = new RegExp(`${NOT_NPM_PAGE}@kombai(?:-io)?${NAME_END}(?:${VERSION_OR_TAG})?`, 'g');
/** A reference set-cli-version moves: the public package with a version or tag. */
export const PINNABLE_REFERENCE_RE = new RegExp(`${NOT_NPM_PAGE}@kombai${NAME_END}${VERSION_OR_TAG}`, 'g');

/** A reference without the full stop of a sentence that ends right after it. */
export function withoutFullStop(reference) {
  return reference.replace(/\.+$/, '');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** The `.mcp.json` that registers the view, for a plugin whose skill runs `cliPackage` (`@kombai/cli@x.y.z`). */
export function cliViewMcpConfig(cliPackage) {
  return { mcpServers: { [CLI_VIEW_SERVER]: { command: 'npx', args: ['-y', cliPackage, 'mcp'] } } };
}

/** A file's text, or null when it holds a NUL byte (an image, a font). */
export function textOf(file) {
  const bytes = fs.readFileSync(file);
  return bytes.includes(0) ? null : bytes.toString('utf8');
}

/** The Kombai CLI packages `text` names, in order. */
export function cliReferences(text) {
  return [...text.matchAll(CLI_REFERENCE_RE)].map(([match]) => withoutFullStop(match));
}

/**
 * Every Kombai CLI package named in a text file under `dir` that is not exactly `cliPackage`: a tag (`@latest`,
 * `@beta`), no version, another version or the internal package. In file order.
 * @returns {{ file: string, match: string }[]}
 */
export function strayCliReferences(dir, cliPackage) {
  return filesUnder(dir).flatMap((file) => {
    const text = textOf(file);
    return text === null ? [] : cliReferences(text).filter((m) => m !== cliPackage).map((match) => ({ file, match }));
  });
}

/**
 * Fail when `stray` (strayCliReferences' answer, each file labelled relative to `base`) is not empty, with `rule`
 * and each reference named once. A reference set-cli-version can move points there; any other it can't (a bare name, a range, the internal
 * package), so it asks for an exact version instead.
 */
export function assertNoStrayCli(stray, base, cliPackage, rule) {
  if (stray.length === 0) return;
  const found = [...new Set(stray.map(({ file, match }) => `${path.relative(base, file).split(path.sep).join('/')}: ${match}`))];
  const unmovable = [...new Set(stray.map(({ match }) => match))].filter(
    (match) => match.replace(PINNABLE_REFERENCE_RE, '') !== '',
  );
  throw new Error(
    `${rule} (${cliPackage}): ${found.join(', ')}. ` +
      (unmovable.length === 0
        ? 'Run pnpm run set-cli-version <x.y.z>.'
        : `set-cli-version can't move ${unmovable.join(', ')}: name the CLI there as ${cliPackage}.`),
  );
}

/**
 * Check a plugin against the `cli` block of its kombai.package.json: it pins one released CLI (`@kombai/cli@x.y.z`,
 * never a tag such as `latest`, which the plugin directories refuse), every file in it names that CLI and no other,
 * and its `.mcp.json` registers the view exactly when `cli.view` is on. No other MCP or app configuration ships.
 * `shipped` lists the other files or folders (relative to `root`) a pack zips with the plugin, its marketplace among
 * them, held to the same CLI: filesBesidePlugin of the pack's own list, so nothing it zips goes unchecked.
 * `team` checks a team build instead (stageTeamBuild), which runs TEAM_CLI_PACKAGE. Returns whether the plugin
 * registers the view.
 */
export function checkCliContract(pluginRoot, contract, host, { team = false, root, shipped = [] } = {}) {
  const cli = contract.cli;
  if (team) {
    assert(cli?.package === TEAM_CLI_PACKAGE, `${host} team build must run ${TEAM_CLI_PACKAGE}, not ${cli?.package}.`);
  } else {
    assert(
      isReleaseCliPackage(cli?.package),
      `${host} contract must pin a released Kombai CLI, ${CLI_NAME}@x.y.z (cli.package), not ${cli?.package}: ` +
        'run pnpm run set-cli-version <x.y.z>.',
    );
  }
  assertNoStrayCli(
    strayCliReferences(pluginRoot, cli.package),
    pluginRoot,
    cli.package,
    `${host} plugin must name only the CLI its contract pins`,
  );
  // The other files a pack zips beside the plugin folder (its marketplace) ship in the same ZIP.
  assert(shipped.length === 0 || root, `${host}: checkCliContract needs the root its shipped files are under.`);
  assertNoStrayCli(
    shipped.flatMap((file) => strayCliReferences(path.join(root, file), cli.package)),
    root,
    cli.package,
    `${host} marketplace must name only the CLI the plugin pins`,
  );
  assert(typeof cli.view === 'boolean', `${host} contract must say whether it registers the canvas view (cli.view).`);
  for (const [name, topic] of Object.entries(SKILL_TOPICS)) {
    const skill = fs.readFileSync(path.join(pluginRoot, 'skills', name, 'SKILL.md'), 'utf8');
    assert(
      skill.includes(`npx -y ${cli.package} skill${topic}\``),
      `${host} ${name} skill must run ${cli.package} skill${topic}.`,
    );
  }

  const mcpFile = path.join(pluginRoot, '.mcp.json');
  if (cli.view) {
    assert(fs.existsSync(mcpFile), `${host} has the canvas view on, so it must ship .mcp.json.`);
    assert(
      JSON.stringify(readJson(mcpFile)) === JSON.stringify(cliViewMcpConfig(cli.package)),
      `${host} .mcp.json may only register the Kombai CLI view (${CLI_VIEW_SERVER}).`,
    );
  } else {
    assert(!fs.existsSync(mcpFile), `${host} has the canvas view off, so .mcp.json must not ship.`);
  }
  for (const forbidden of ['mcp.json', '.app.json']) {
    assert(
      !fs.existsSync(path.join(pluginRoot, forbidden)),
      `Local MCP config must not ship in the plugin: ${forbidden}`,
    );
  }
  return cli.view;
}

/**
 * A skill's host guidance: the text before the line that runs the CLI ("Run `npx"), which the agent reads before its
 * first command. Each host's sandbox guidance must be there, not only in a later bullet.
 */
export function skillGuidance(text) {
  const run = text.indexOf('Run `npx');
  return run > 0 ? text.slice(0, run) : '';
}

/**
 * The Codex and Claude Code plugins' onboarding skill. A running Codex chat or Claude Code session never picks up an
 * MCP server added during it, so this sets Kombai's server up (`kombai mcp install codex|claude-code`) before the
 * user's first design chat, which then has Kombai's view or card from its first message. Codex runs it when the user
 * sets the plugin up after installing it (its manifest's `onboardingSkill`), and from its Try now (the manifest's first
 * `defaultPrompt` asks for it); where the chat has the view it shows the CLI's starters card. Claude Code has no
 * onboarding key: the user asks for it, or runs `/kombai:get-started-with-kombai`, and its README says to. Either
 * user can run it again.
 */
export const SETUP_SKILL = 'get-started-with-kombai';

/** What the agent tells a user who runs the plugin for `agent` in `chat` (Claude's chat for Claude Code). */
const chatRefusal = (agent, chat) =>
  `Kombai's plugin works only in ${agent}, not in ${chat}. Install it in ${agent} and ask there.`;
const chatNotice = (agent, chat, where) =>
  `**${agent} only.** Kombai runs its CLI in a shell on the user's computer. If this chat is in ${chat} (${where}) ` +
  `rather than ${agent}, run nothing, not even in the chat's own code tool (it is not the user's computer), and do no ` +
  `design work: reply with only this, word for word, and add nothing else (no prompt to paste elsewhere, no other ` +
  `help): "${chatRefusal(agent, chat)}"`;
/**
 * What the Codex plugin tells a user whose chat can't run commands on their computer. The ChatGPT desktop app runs Codex
 * on the user's computer (its Work chats and Codex), so the refusal is keyed on that, not on the app's name.
 */
export const CODEX_REFUSAL =
  "Kombai needs to run commands on your computer, and this chat can't. Ask in Codex or in a Work chat in the " +
  'ChatGPT desktop app.';
const codexNotice =
  "**Needs a shell on the user's computer.** Kombai runs its CLI in a shell on the user's computer. Codex has one " +
  "wherever it runs: the ChatGPT desktop app (its Work chats and Codex), the Codex CLI and the IDE extension, so " +
  "carry on there, whatever the app is called. Only if this chat has no shell on the user's computer, as in " +
  "ChatGPT on the web, whose code tool is a cloud sandbox, run nothing, not even in that code tool, and do no " +
  'design work: reply with only this, word for word, and add nothing else (no prompt to paste elsewhere, no other ' +
  `help): "${CODEX_REFUSAL}"`;
/**
 * The paragraph every skill of the Codex and Claude Code plugins opens with, each naming only its own agent. OpenAI's
 * directory and Anthropic's plugin catalog also offer these plugins in their chat apps, which have no shell on the
 * user's computer, so the skill could never run there: the agent says where Kombai works instead. The Claude Code
 * notice names Claude's chat rather than listing where the plugin may run, so an older VS Code install that still
 * loads the Claude Code plugin (README.md) keeps working; the Codex notice is keyed on a shell on the user's computer.
 * Keyed by plugin folder.
 */
export const CHAT_NOTICES = {
  codex: codexNotice,
  'claude-code': chatNotice(
    'Claude Code',
    "Claude's chat",
    'claude.ai, or the Chat tab of the Claude desktop or mobile app',
  ),
};

/** Check that every skill of a plugin opens with `notice`, the first paragraph after its frontmatter. */
export function checkChatNotice(pluginRoot, host, notice) {
  const skillRoot = path.join(pluginRoot, 'skills');
  for (const entry of fs.readdirSync(skillRoot, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const text = fs.readFileSync(path.join(skillRoot, entry.name, 'SKILL.md'), 'utf8');
    const afterFrontmatter = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/^\s+/, '');
    assert(
      // A paragraph of its own, with either line ending: a Windows checkout may have CRLF.
      afterFrontmatter.startsWith(notice) && /^\r?\n/.test(afterFrontmatter.slice(notice.length)),
      `${host} ${entry.name} skill must open with the notice about where it works.`,
    );
  }
}

/**
 * Check that a plugin ships exactly the workflow, FAQ and asset skills, plus the host's own `extra` ones, each named in its
 * frontmatter and described.
 */
export function checkSkills(pluginRoot, host, extra = []) {
  const skillRoot = path.join(pluginRoot, 'skills');
  const names = fs
    .readdirSync(skillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert(
    JSON.stringify(names) === JSON.stringify([...Object.keys(SKILL_TOPICS), ...extra].sort()),
    `${host} plugin must contain the ${[WORKFLOW_SKILL, FAQ_SKILL, ASSETS_SKILL, ...extra].join(', ')} skills, and no other.`,
  );
  for (const name of names) {
    const skill = fs.readFileSync(path.join(skillRoot, name, 'SKILL.md'), 'utf8');
    assert(new RegExp(`^---\\r?\\n[\\s\\S]*?^name: ${name}\\r?$`, 'm').test(skill), `${host} ${name} skill name is missing.`);
    assert(/^description: \S.+$/m.test(skill), `${host} ${name} skill description is missing.`);
    const description = skill.match(/^description: (.+)$/m)?.[1] ?? '';
    assert(
      !UNQUOTED_YAML_BREAKER_RE.test(description),
      `${host} ${name} skill description is an unquoted YAML value, so it can't hold ": " or " #": the hosts' YAML ` +
        'parsers reject the frontmatter.',
    );
  }
}

/** What ends an unquoted YAML value early: ": " starts a mapping (a parse error) and " #" a comment. */
export const UNQUOTED_YAML_BREAKER_RE = /:\s|\s#/;

// The team build of a plugin, for colleagues trying a CLI beta before it is released: the same plugin, running the
// newest beta from npm's `beta` tag (vscode-assistant's Publish CLI `beta` action, run from `preprod`), which
// talks to preprod. `pack --team` zips a staged copy, so the source always pins a released CLI. The one place a tag
// is allowed: a team ZIP never goes to a plugin directory, and following the tag spares colleagues a reinstall for
// every beta.
export const TEAM_CLI_PACKAGE = `${CLI_NAME}@beta`;

/** The files under `target` in name order, `target` itself when it is a file, or none when it is missing. */
export function filesUnder(target) {
  if (!fs.existsSync(target)) return [];
  if (!fs.statSync(target).isDirectory()) return [target];
  return fs
    .readdirSync(target, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => filesUnder(path.join(target, entry.name)));
}

/** The paths in a pack's list (relative to the repository) that are not the plugin folder: its marketplace, LICENSE. */
export function filesBesidePlugin(packageFiles) {
  return packageFiles.filter((file) => file !== 'plugins' && !file.startsWith('plugins/'));
}

/** Whether `file` exists and is a regular file. */
export function isFile(file) {
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true;
}

// Finder's folder metadata: the packs leave it out (`zip -x`), so a local build on a Mac may have it.
export const STRAY_FILE = '.DS_Store';
// checkCliContract decides these.
const CONTRACT_FILES = ['.mcp.json', 'mcp.json', '.app.json'];

/**
 * Check that a plugin folder holds exactly `files` (paths relative to it), besides STRAY_FILE and the MCP files
 * checkCliContract decides. Hosts load parts they find by name (agents/, hooks.json, GEMINI.md, …), and the packs zip
 * the whole folder, so anything else fails. `label` names the folder in messages ("VS Code plugin").
 */
export function checkPluginFiles(pluginRoot, files, label) {
  for (const file of files) assert(isFile(path.join(pluginRoot, file)), `Missing ${label} file: ${file}`);
  const expected = new Set(files);
  const tops = new Set(files.map((file) => file.split('/')[0]));
  // The folders on the way to those files. Any other folder would ship empty, or holding only STRAY_FILE.
  const folders = new Set(
    files.flatMap((file) => file.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))),
  );
  for (const entry of fs.readdirSync(pluginRoot, { recursive: true, withFileTypes: true })) {
    const relative = path.relative(pluginRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join('/');
    if (entry.isDirectory() ? folders.has(relative) : expected.has(relative) || CONTRACT_FILES.includes(relative) || entry.name === STRAY_FILE) {
      continue;
    }
    const top = relative.split('/')[0];
    throw new Error(`${label} must not ship ${tops.has(top) ? relative : top}.`);
  }
}

/** Read one of a plugin's files, with the same message as checkPluginFiles when it is missing. */
export function readPluginFile(pluginRoot, file, label) {
  assert(isFile(path.join(pluginRoot, file)), `Missing ${label} file: ${file}`);
  return fs.readFileSync(path.join(pluginRoot, file), 'utf8');
}

function realPath(file) {
  // The nearest existing parent's real path (macOS /var is /private/var), with the rest of the path after it.
  let existing = path.resolve(file);
  const rest = [];
  while (!fs.existsSync(existing)) {
    rest.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  return path.join(fs.realpathSync(existing), ...rest);
}

/**
 * Refuse an output directory inside any of the `paths` (under `root`) a pack zips: the archive would carry the output
 * folder, and every later validation would reject it. Call it before validating.
 */
export function assertPackOutside(outputDir, root, paths) {
  const output = realPath(outputDir);
  for (const packed of paths) {
    const relative = path.relative(realPath(path.join(root, packed)), output);
    const outside = relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
    assert(outside, `Pack into a folder outside ${packed}: ${outputDir} would ship in the archive.`);
  }
}

/**
 * Zip the plugin folder `dir` into `archive` as one folder named after the archive (`kombai-<host>-plugin-<version>`),
 * leaving out STRAY_FILE, so unzipping it makes that folder rather than spilling the plugin into the current one.
 * For hosts that install a plugin folder rather than a marketplace (Antigravity, Gemini CLI).
 */
export function zipPluginFolder(dir, archive) {
  const folder = path.basename(archive, '.zip');
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-plugin-pack-'));
  try {
    fs.cpSync(dir, path.join(stage, folder), { recursive: true, filter: (from) => path.basename(from) !== STRAY_FILE });
    fs.rmSync(archive, { force: true });
    for (const [command, args] of [
      ['zip', ['-q', '-r', archive, folder]],
      ['unzip', ['-tq', archive]],
    ]) {
      const result = spawnSync(command, args, { cwd: stage, encoding: 'utf8' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
    }
    return archive;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

/**
 * Copy `files` (paths under `root`) into a new directory as the team build, with TEAM_CLI_PACKAGE in place of the
 * pinned release CLI (`contract.cli.package`) in every text file. The caller removes the returned directory and
 * checks it with its validator's `team` option.
 */
export function stageTeamBuild(root, files, contract) {
  const release = contract.cli?.package;
  assert(
    isReleaseCliPackage(release),
    `A team build starts from the release plugin (${CLI_NAME}@x.y.z), not ${release}.`,
  );
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-plugin-team-'));
  for (const file of files) {
    fs.cpSync(path.join(root, file), path.join(stage, file), {
      recursive: true,
      filter: (from) => path.basename(from) !== STRAY_FILE,
    });
  }
  // Whole references only: `@kombai/cli@0.1.40` is not `@kombai/cli@0.1.4` followed by a 0.
  for (const file of filesUnder(stage)) {
    const text = textOf(file);
    const next = text?.replace(PINNABLE_REFERENCE_RE, (match) => {
      const reference = withoutFullStop(match);
      return reference === release ? TEAM_CLI_PACKAGE + match.slice(reference.length) : match;
    });
    if (next !== undefined && next !== text) fs.writeFileSync(file, next);
  }
  return stage;
}
