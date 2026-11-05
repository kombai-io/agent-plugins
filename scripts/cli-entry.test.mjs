import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Each script runs only when it is the entry point, and compares real paths to know, so spawn it by its real path.
const scripts = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));

function cli(script, args, env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(result.status, 0, `${path.basename(script)} ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

// The commands Build Plugins runs for each host: `validate --github-output`, then `pack "$RUNNER_TEMP"` with or
// without `--team`.
for (const host of ['codex', 'claude-code', 'cursor', 'vscode', 'antigravity', 'gemini-cli']) {
  test(`${host}: validate --github-output and pack <dir> [--team] work as Build Plugins runs them`, () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), `kombai-${host}-cli-`));
    try {
      const output = path.join(out, 'github-output');
      fs.writeFileSync(output, '');
      const script = path.join(scripts, `${host}-plugin.mjs`);
      const version = cli(script, ['validate', '--github-output'], { GITHUB_OUTPUT: output });
      assert.match(version, /^\d+\.\d+\.\d+$/);
      assert.equal(fs.readFileSync(output, 'utf8'), `version=${version}\n`);
      for (const team of [false, true]) {
        const archive = cli(script, ['pack', out, ...(team ? ['--team'] : [])]);
        assert.equal(archive, path.join(out, `kombai-${host}-plugin-${version}${team ? '-team' : ''}.zip`));
        assert.ok(fs.statSync(archive).size > 0, archive);
      }
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
}
