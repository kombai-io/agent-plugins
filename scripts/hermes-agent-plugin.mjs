import { makeFolderPlugin } from './folder-plugin.mjs';

const plugin = makeFolderPlugin({
  host: 'hermes-agent',
  label: 'Hermes Agent plugin',
  manifest: 'plugin.json',
  files: [],
  extraSkills: ['get-started-with-kombai'],
  schema: 'kombai-hermes-agent-plugin/v1',
  checkManifest(manifest) {
    if (
      manifest.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json' ||
      manifest.name !== 'kombai' ||
      manifest.license !== 'MIT' ||
      !manifest.description?.trim() ||
      manifest.author?.name !== 'Kombai' ||
      manifest.mcpServers !== undefined
    ) throw new Error('Hermes Agent portable plugin metadata is invalid.');
  },
});

export const checkHermesAgentPluginDir = plugin.checkDir;
export const validateHermesAgentPlugin = plugin.validate;
export const bumpHermesAgentVersion = plugin.bump;
export const packHermesAgentPlugin = plugin.pack;
plugin.main(import.meta.url);
