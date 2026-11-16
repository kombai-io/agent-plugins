import { makeFolderPlugin } from './folder-plugin.mjs';

const plugin = makeFolderPlugin({
  host: 'opencode',
  label: 'OpenCode plugin',
  manifest: 'package.json',
  files: ['index.js'],
  extraSkills: ['get-started-with-kombai'],
  schema: 'kombai-opencode-plugin/v2',
  checkManifest(manifest) {
    if (
      manifest.name !== '@kombai/opencode-plugin' ||
      manifest.type !== 'module' ||
      manifest.exports?.['.'] !== './index.js' ||
      manifest.dependencies?.['@opencode/plugin'] !== '^2.0.0' ||
      manifest.license !== 'MIT' ||
      !manifest.files?.includes('skills')
    ) throw new Error('OpenCode package metadata is invalid.');
  },
});

export const checkOpenCodePluginDir = plugin.checkDir;
export const validateOpenCodePlugin = plugin.validate;
export const bumpOpenCodeVersion = plugin.bump;
export const packOpenCodePlugin = plugin.pack;
plugin.main(import.meta.url);
