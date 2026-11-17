import path from 'node:path';
import { makeFolderPlugin } from './folder-plugin.mjs';

const skillNames = ['work-with-kombai', 'about-kombai', 'generate-assets-with-kombai', 'get-started-with-kombai'];
const plugin = makeFolderPlugin({
  host: 'muse',
  label: 'Muse Code plugin',
  manifest: '.muse-plugin/plugin.json',
  files: [],
  extraSkills: ['get-started-with-kombai'],
  schema: 'kombai-muse-plugin/v1',
  checkManifest(manifest, pluginRoot) {
    if (
      manifest.schemaVersion !== 1 ||
      manifest.name !== 'kombai' ||
      manifest.displayName !== 'Kombai' ||
      !manifest.description?.trim() ||
      manifest.compat?.source !== 'native' ||
      manifest.compat?.manifestDir !== '.muse-plugin' ||
      JSON.stringify(manifest.capabilities?.skills) !== JSON.stringify(skillNames.map((id) => ({
        id, path: path.posix.join('skills', id, 'SKILL.md'), enabledDefault: true,
      }))) ||
      ['commands', 'hooks', 'mcpServers', 'reminders'].some((key) =>
        JSON.stringify(manifest.capabilities?.[key]) !== '[]')
    ) throw new Error('Muse Code plugin metadata is invalid.');
  },
});

export const checkMusePluginDir = plugin.checkDir;
export const validateMusePlugin = plugin.validate;
export const bumpMuseVersion = plugin.bump;
export const packMusePlugin = plugin.pack;
plugin.main(import.meta.url);
