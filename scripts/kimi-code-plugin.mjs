import { makeFolderPlugin } from './folder-plugin.mjs';

const plugin = makeFolderPlugin({
  host: 'kimi-code',
  label: 'Kimi Code plugin',
  manifest: 'kimi.plugin.json',
  files: [],
  extraSkills: ['get-started-with-kombai'],
  schema: 'kombai-kimi-code-plugin/v2',
  checkManifest(manifest) {
    if (
      manifest.name !== 'kombai' ||
      manifest.skills !== './skills/' ||
      manifest.license !== 'MIT' ||
      typeof manifest.description !== 'string' ||
      !manifest.description.trim() ||
      manifest.mcpServers !== undefined ||
      manifest.sessionStart !== undefined ||
      manifest.systemPrompt !== undefined
    ) throw new Error('Kimi Code manifest is invalid.');
  },
});

export const checkKimiCodePluginDir = plugin.checkDir;
export const validateKimiCodePlugin = plugin.validate;
export const bumpKimiCodeVersion = plugin.bump;
export const packKimiCodePlugin = plugin.pack;
plugin.main(import.meta.url);
