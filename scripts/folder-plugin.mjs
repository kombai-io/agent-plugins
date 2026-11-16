import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSETS_SKILL,
  FAQ_SKILL,
  WORKFLOW_SKILL,
  assertPackOutside,
  checkCliContract,
  checkPluginFiles,
  checkSkills,
  readPluginFile,
  stageTeamBuild,
  zipPluginFolder,
} from './cli-view.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const skillFiles = [WORKFLOW_SKILL, FAQ_SKILL, ASSETS_SKILL].map((name) => `skills/${name}/SKILL.md`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function json(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function newer(next, current) {
  const a = next.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/** Folder-based skill plugins for hosts that do not use a marketplace manifest in this repository. */
export function makeFolderPlugin({ host, label, manifest, files, extraSkills = [], schema, checkManifest }) {
  const relative = `plugins/${host}`;
  const stageFiles = [relative, 'LICENSE'];
  const expected = [manifest, 'LICENSE', 'README.md', 'kombai.package.json', ...skillFiles,
    ...extraSkills.map((name) => `skills/${name}/SKILL.md`), ...files];

  function checkDir(pluginRoot, { team = false } = {}) {
    const metadata = JSON.parse(readPluginFile(pluginRoot, manifest, label));
    const contract = JSON.parse(readPluginFile(pluginRoot, 'kombai.package.json', label));
    assert(metadata && typeof metadata === 'object' && !Array.isArray(metadata), `${label} manifest must be an object.`);
    assert(versionPattern.test(metadata.version), `${label} version must be major.minor.patch.`);
    assert(metadata.version === contract.version, `${label} manifest and contract versions must match.`);
    assert(contract.name === 'kombai' && contract.schemaVersion === schema, `${label} contract identity is invalid.`);
    assert(contract.cli?.view === false, `${label} does not register an MCP server.`);
    checkManifest(metadata, pluginRoot);
    checkPluginFiles(pluginRoot, expected, label);
    checkCliContract(pluginRoot, contract, label, { team });
    checkSkills(pluginRoot, label, extraSkills);
    return metadata.version;
  }

  function validate(root = workspaceRoot, { team = false } = {}) {
    const pluginRoot = path.join(root, relative);
    const version = checkDir(pluginRoot, { team });
    assert(
      fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8') === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
      `${label} license must match the repository LICENSE.`,
    );
    return version;
  }

  function bump(next, root = workspaceRoot) {
    const current = validate(root);
    assert(versionPattern.test(next) && newer(next, current), `${label} version must increase from ${current}.`);
    for (const file of [manifest, 'kombai.package.json']) {
      const filename = path.join(root, relative, file);
      const data = json(filename);
      data.version = next;
      fs.writeFileSync(filename, `${JSON.stringify(data, null, 2)}\n`);
    }
    validate(root);
    return next;
  }

  function pack(outputDir = path.join(os.tmpdir(), 'kombai-agent-plugins'), root = workspaceRoot, { team = false } = {}) {
    outputDir = path.resolve(outputDir);
    assertPackOutside(outputDir, root, [relative]);
    const version = validate(root);
    const from = team ? stageTeamBuild(root, stageFiles, json(path.join(root, relative, 'kombai.package.json'))) : root;
    try {
      if (team) validate(from, { team });
      fs.mkdirSync(outputDir, { recursive: true });
      return zipPluginFolder(path.join(from, relative), path.join(outputDir, `kombai-${host}-plugin-${version}${team ? '-team' : ''}.zip`));
    } finally {
      if (team) fs.rmSync(from, { recursive: true, force: true });
    }
  }

  function main(moduleUrl) {
    if (!process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(moduleUrl)) return;
    try {
      const [, , command, value, ...extra] = process.argv;
      let result;
      if (command === 'validate') {
        assert(extra.length === 0 && (!value || value === '--github-output'), 'Usage: validate [--github-output]');
        result = validate();
        if (value === '--github-output') {
          assert(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required for --github-output.');
          fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result}\n`);
        }
      } else if (command === 'bump') {
        assert(value && extra.length === 0, 'Usage: bump <version>');
        result = bump(value);
      } else if (command === 'pack') {
        const args = [value, ...extra].filter((arg) => arg !== undefined);
        const dirs = args.filter((arg) => arg !== '--team');
        assert(dirs.length <= 1, 'Usage: pack [output-directory] [--team]');
        result = pack(dirs[0] && path.resolve(dirs[0]), undefined, { team: args.includes('--team') });
      } else {
        throw new Error(`Usage: ${host}-plugin.mjs <validate|bump|pack>`);
      }
      console.log(result);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }

  return { checkDir, validate, bump, pack, main };
}
