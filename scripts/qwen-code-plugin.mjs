import { makeFolderPlugin } from './folder-plugin.mjs';

const plugin = makeFolderPlugin({
  host: 'qwen-code',
  label: 'Qwen Code extension',
  manifest: 'qwen-extension.json',
  files: [],
  extraSkills: ['get-started-with-kombai'],
  schema: 'kombai-qwen-code-plugin/v1',
  checkManifest(manifest) {
    if (
      manifest.name !== 'kombai' ||
      manifest.displayName !== 'Kombai' ||
      !manifest.description?.trim() ||
      manifest.skills !== 'skills' ||
      manifest.mcpServers !== undefined
    ) throw new Error('Qwen Code extension metadata is invalid.');
  },
});

export const checkQwenCodePluginDir = plugin.checkDir;
export const validateQwenCodePlugin = plugin.validate;
export const bumpQwenCodeVersion = plugin.bump;
export const packQwenCodePlugin = plugin.pack;
plugin.main(import.meta.url);
