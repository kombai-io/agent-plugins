import { makeFolderPlugin } from './folder-plugin.mjs';

const plugin = makeFolderPlugin({
  host: 'pi-code',
  label: 'Pi plugin',
  manifest: 'package.json',
  files: [],
  extraSkills: ['get-started-with-kombai'],
  schema: 'kombai-pi-code-plugin/v1',
  checkManifest(manifest) {
    if (
      manifest.name !== '@kombai/pi-code-plugin' ||
      manifest.license !== 'MIT' ||
      typeof manifest.description !== 'string' ||
      !manifest.description.trim() ||
      !manifest.keywords?.includes('pi-package') ||
      JSON.stringify(manifest.pi) !== JSON.stringify({ skills: ['./skills'] }) ||
      !manifest.files?.includes('skills') ||
      manifest.dependencies !== undefined ||
      manifest.mcpServers !== undefined
    ) throw new Error('Pi package metadata is invalid.');
  },
});

export const checkPiCodePluginDir = plugin.checkDir;
export const validatePiCodePlugin = plugin.validate;
export const bumpPiCodeVersion = plugin.bump;
export const packPiCodePlugin = plugin.pack;
plugin.main(import.meta.url);
