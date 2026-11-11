import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ANTIGRAVITY_SANDBOX } from './antigravity-plugin.mjs';
import { ASSETS_SKILL, CHAT_NOTICES, CODEX_REFUSAL, FAQ_SKILL, skillGuidance, WORKFLOW_SKILL } from './cli-view.mjs';
import { GEMINI_SANDBOX } from './gemini-cli-plugin.mjs';
import { VSCODE_UNSANDBOXED } from './vscode-plugin.mjs';

// Every copy of the two skills: the standalone one at the repository root (`npx skills add`) and each plugin's. This
// reads the whole repository, so it is a test and not part of a plugin's validation, which also runs on one unpacked
// plugin.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODEX_ESCALATION = 'sandbox_permissions: "require_escalated"';
// Each copy and the sandbox guidance it carries (null: none beyond the generic network bullet).
const COPIES = {
  '.': CODEX_ESCALATION,
  'plugins/codex': CODEX_ESCALATION,
  'plugins/claude-code': null,
  'plugins/cursor': null,
  'plugins/vscode': VSCODE_UNSANDBOXED,
  'plugins/antigravity': ANTIGRAVITY_SANDBOX,
  'plugins/gemini-cli': GEMINI_SANDBOX,
};
const MARKERS = [...new Set(Object.values(COPIES).filter(Boolean))];
// The one copy with more of its own: the Codex app shows the canvas beside the chat, through canvas_app.
const CODEX_WORKFLOW = `plugins/codex/${WORKFLOW_SKILL}`;
const NETWORK_BULLET = /^- \*\*The network is blocked\*\*.*$/m;
const GENERIC_BULLET =
  '- **The network is blocked** (a sandboxed shell). Ask for network access the way your client does; Node is not missing.';
const DESCRIPTION = /^description: .+\n/m;
// The standalone copy runs in any agent, so it keeps its Codex guidance in a file beside SKILL.md that only an agent
// in Codex's sandbox reads; SKILL.md points at it. Its first two paragraphs are a heading and who should read it.
const CODEX_ACCESS_FILE = 'codex-access.md';
const CODEX_POINTER = `first read \`${CODEX_ACCESS_FILE}\` beside this file`;

// The copies that open every skill with a notice that they work only in their own agent (cli-view.mjs).
const NOTICES = { 'plugins/codex': CHAT_NOTICES.codex, 'plugins/claude-code': CHAT_NOTICES['claude-code'] };

// A skill in four parts: its frontmatter; its host guidance (between the frontmatter and the line that runs the CLI,
// less the Codex or Claude Code notice, checked on its own); its network bullet, which is the host's too; and the body
// every copy shares (from that line on, less the bullet).
function parts(copy, skill) {
  const text = fs.readFileSync(path.join(root, copy, 'skills', skill, 'SKILL.md'), 'utf8');
  const frontmatter = text.match(/^---\n[\s\S]*?\n---\n/)?.[0];
  const bullet = text.match(NETWORK_BULLET)?.[0];
  const guidance = skillGuidance(text);
  assert.ok(frontmatter && bullet && guidance, `${copy}/${skill}: frontmatter, guidance and network bullet`);
  const notice = NOTICES[copy];
  const own = guidance.slice(frontmatter.length);
  const accessFile = path.join(root, copy, 'skills', skill, CODEX_ACCESS_FILE);
  const access = fs.existsSync(accessFile) ? fs.readFileSync(accessFile, 'utf8') : null;
  return {
    text: access ? `${text}\n${access}` : text,
    // The Codex guidance itself: inline for a Codex plugin's copy, in codex-access.md for the standalone one.
    codexGuidance: access ? access.split('\n\n').slice(2).join('\n\n').trim() : null,
    frontmatter,
    guidance: (notice ? own.replace(`\n${notice}\n`, '') : own).trim(),
    bullet,
    body: text.slice(guidance.length).replace(NETWORK_BULLET, ''),
  };
}

test('every plugin has a row in the skill copies table', () => {
  const plugins = fs.readdirSync(path.join(root, 'plugins')).filter((name) => !name.startsWith('.')).sort();
  assert.deepEqual(plugins.map((name) => `plugins/${name}`), Object.keys(COPIES).filter((copy) => copy !== '.').sort());
});

for (const skill of [WORKFLOW_SKILL, FAQ_SKILL, ASSETS_SKILL]) {
  test(`every copy of ${skill} shares the standalone text outside its host guidance`, () => {
    const standalone = parts('.', skill);
    for (const copy of Object.keys(COPIES)) {
      const own = parts(copy, skill);
      assert.equal(own.body, standalone.body, `${copy}/${skill}: body`);
      if (`${copy}/${skill}` === CODEX_WORKFLOW) {
        assert.equal(own.frontmatter.replace(DESCRIPTION, ''), standalone.frontmatter.replace(DESCRIPTION, ''), copy);
      } else {
        assert.equal(own.frontmatter, standalone.frontmatter, `${copy}/${skill}: frontmatter`);
      }
      assert.equal(own.text.includes('canvas_app'), `${copy}/${skill}` === CODEX_WORKFLOW, `${copy}/${skill}: canvas_app`);
    }
  });

  test(`every copy of ${skill} carries its own host's sandbox guidance and no other host's`, () => {
    const standalone = parts('.', skill);
    // The standalone skill runs in any agent, so its network bullet is the generic one.
    assert.equal(standalone.bullet, GENERIC_BULLET, `${skill}: standalone network bullet`);
    for (const [copy, marker] of Object.entries(COPIES)) {
      const own = parts(copy, skill);
      for (const other of MARKERS) {
        assert.equal(own.text.includes(other), other === marker, `${copy}/${skill}: ${other}`);
      }
      if (marker === null) {
        // "Nothing beyond 'ask for network access the way your client does'".
        assert.equal(own.guidance, '', `${copy}/${skill}: guidance`);
        assert.equal(own.bullet, GENERIC_BULLET, `${copy}/${skill}: network bullet`);
      } else {
        // Before the first command, not only in a later bullet: inline, or a pointer to the file that holds it.
        const before = copy === '.' ? own.codexGuidance : own.guidance;
        assert.ok(before?.includes(marker), `${copy}/${skill}: guidance before the first command`);
        if (copy === '.') assert.ok(own.guidance.includes(CODEX_POINTER), `${skill}: points at ${CODEX_ACCESS_FILE}`);
        if (copy !== '.') assert.notEqual(own.bullet, GENERIC_BULLET, `${copy}/${skill}: network bullet`);
      }
      if (marker === CODEX_ESCALATION) {
        const guidance = own.guidance
          .split('\n\n')
          .filter((paragraph) => !paragraph.includes('canvas_app'))
          .join('\n\n');
        if (copy !== '.') assert.equal(guidance, standalone.codexGuidance, `${copy}/${skill}: Codex guidance`);
      }
    }
  });
}

test('the Codex and Claude Code copies open every skill with their own chat notice, and no other copy has one', () => {
  for (const copy of Object.keys(COPIES)) {
    for (const skill of fs.readdirSync(path.join(root, copy, 'skills'))) {
      const text = fs.readFileSync(path.join(root, copy, 'skills', skill, 'SKILL.md'), 'utf8');
      const opening = text.replace(/^---\n[\s\S]*?\n---\n\n/, '').split('\n\n')[0];
      if (NOTICES[copy]) {
        assert.equal(opening, NOTICES[copy], `${copy}/${skill}: opening paragraph`);
      } else {
        assert.ok(!text.includes("Kombai's plugin works only in") && !text.includes(CODEX_REFUSAL), `${copy}/${skill}: no chat notice`);
      }
    }
  }
  // Codex's is keyed on a shell on the user's computer, not on the app's name: the ChatGPT desktop app runs Codex there.
  assert.ok(CHAT_NOTICES.codex.includes(`"${CODEX_REFUSAL}"`), 'the Codex notice quotes its refusal');
  assert.match(CHAT_NOTICES.codex, /ChatGPT desktop app \(its Work chats and Codex\)[^.]*carry on there/);
  assert.match(CODEX_REFUSAL, /Codex or in a Work chat in the ChatGPT desktop app/);
  assert.match(
    CHAT_NOTICES['claude-code'],
    /"Kombai's plugin works only in Claude Code, not in Claude's chat\. Install it in Claude Code and ask there\."/,
  );
  assert.ok(!/Claude/.test(CHAT_NOTICES.codex), 'the Codex notice names no Claude product');
  assert.ok(!/Codex|ChatGPT/.test(CHAT_NOTICES['claude-code']), 'the Claude Code notice names no OpenAI product');
});

test("each copy's skills share one network bullet", () => {
  for (const copy of Object.keys(COPIES)) {
    assert.equal(parts(copy, WORKFLOW_SKILL).bullet, parts(copy, FAQ_SKILL).bullet, copy);
    assert.equal(parts(copy, ASSETS_SKILL).bullet, parts(copy, FAQ_SKILL).bullet, copy);
  }
});

test('every copy of the assets skill is named for generating assets, and routes stock photos and whole-UI design elsewhere', () => {
  for (const copy of Object.keys(COPIES)) {
    const text = fs.readFileSync(path.join(root, copy, 'skills', ASSETS_SKILL, 'SKILL.md'), 'utf8');
    assert.match(text, /^name: generate-assets-with-kombai\r?$/m, `${copy}: name`);
    const description = text.match(/^description: (.+)$/m)?.[1] ?? '';
    // A stock photo is not generated (it would spend credits), and a whole UI is work-with-kombai's.
    assert.ok(description.includes('not for stock photos'), `${copy}: description excludes stock photos`);
    assert.ok(description.includes('work-with-kombai'), `${copy}: description points a whole UI at work-with-kombai`);
    // In the Codex app a plain "AI image for my page" went to the host's own image tool, which leaves a local file.
    assert.ok(
      description.includes('in place of a built-in image generator'),
      `${copy}: description claims project images over a built-in generator`,
    );
    assert.equal(text.split('skill assets`').length - 1, 1, `${copy}: runs skill assets exactly once`);
  }
});

test('the standalone skills keep Codex-only guidance out of SKILL.md, in one shared codex-access.md', () => {
  const files = [WORKFLOW_SKILL, FAQ_SKILL, ASSETS_SKILL].map((skill) => {
    const skillText = fs.readFileSync(path.join(root, 'skills', skill, 'SKILL.md'), 'utf8');
    // Every agent reads SKILL.md: none of the Codex mechanics, only the pointer.
    for (const word of ['request_permissions', 'access_card', 'CODEX_SANDBOX_NETWORK_DISABLED', 'config.toml']) {
      assert.ok(!skillText.includes(word), `skills/${skill}/SKILL.md: ${word}`);
    }
    return fs.readFileSync(path.join(root, 'skills', skill, CODEX_ACCESS_FILE), 'utf8');
  });
  assert.equal(files[0], files[1], `standalone skills carry the same ${CODEX_ACCESS_FILE}`);
  assert.equal(files[0], files[2], `standalone skills carry the same ${CODEX_ACCESS_FILE}`);
});
