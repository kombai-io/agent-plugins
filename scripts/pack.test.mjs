import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { packAntigravityPlugin } from './antigravity-plugin.mjs';
import { packClaudeCodePlugin } from './claude-code-plugin.mjs';
import { packCodexPlugin } from './codex-plugin.mjs';
import { packCursorPlugin } from './cursor-plugin.mjs';
import { packGeminiCliPlugin } from './gemini-cli-plugin.mjs';
import { packVsCodePlugin } from './vscode-plugin.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = {
  codex: packCodexPlugin,
  'claude-code': packClaudeCodePlugin,
  cursor: packCursorPlugin,
  vscode: packVsCodePlugin,
  antigravity: packAntigravityPlugin,
  'gemini-cli': packGeminiCliPlugin,
};

// A copy of the repository, without what git ignores.
function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombai-pack-test-'));
  const root = path.join(temp, 'agent-plugins');
  try {
    fs.cpSync(source, root, {
      recursive: true,
      filter: (from) => !['.git', 'node_modules', 'dist', '.DS_Store'].includes(path.basename(from)) && !from.endsWith('.zip'),
    });
    run(root, temp);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function entries(archive) {
  const result = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split('\n').filter(Boolean).sort();
}

// Every packer takes a relative output directory (resolved against the current directory, as the CLI does) and leaves
// Finder's .DS_Store out of the archive.
for (const [host, pack] of Object.entries(PACKS)) {
  test(`the ${host} pack resolves a relative output directory and leaves .DS_Store out`, () => {
    fixture((root, temp) => {
      const clean = entries(pack(path.join(temp, 'clean'), root));
      for (const folder of [`plugins/${host}`, `plugins/${host}/skills`, `plugins/${host}/skills/work-with-kombai`]) {
        fs.writeFileSync(path.join(root, folder, '.DS_Store'), 'x');
      }
      for (const team of [false, true]) {
        const out = path.join(temp, team ? 'team' : 'out');
        const archive = pack(path.relative(process.cwd(), out), root, { team });
        assert.equal(archive, path.join(out, path.basename(archive)), `${host} team=${team}`);
        if (!team) assert.deepEqual(entries(archive), clean, host);
        assert.ok(entries(archive).every((entry) => !entry.endsWith('.DS_Store')), `${host} team=${team}`);
      }
    });
  });
}
