import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Plugin, Skill } from '@opencode/plugin';

const root = path.dirname(fileURLToPath(import.meta.url));
const skills = ['work-with-kombai', 'about-kombai', 'generate-assets-with-kombai', 'get-started-with-kombai'];
const titles = {
  'work-with-kombai': 'Work with Kombai',
  'about-kombai': 'About Kombai',
  'generate-assets-with-kombai': 'Generate assets with Kombai',
  'get-started-with-kombai': 'Get started with Kombai',
};

function loadSkill(name) {
  const filename = path.join(root, 'skills', name, 'SKILL.md');
  const source = readFileSync(filename, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`Invalid frontmatter in ${filename}`);
  const declaredName = /^name: (.+)$/m.exec(match[1])?.[1];
  const description = /^description: (.+)$/m.exec(match[1])?.[1];
  if (declaredName !== name || !description) throw new Error(`Invalid skill metadata in ${filename}`);
  return {
    id: Skill.ID.make(name),
    name: Skill.Name.make(titles[name]),
    description,
    path: Skill.Info.fields.path.make(filename),
    content: match[2].trim(),
  };
}

export default Plugin.define({
  id: 'kombai',
  async setup(ctx) {
    await ctx.skill.transform((editor) => {
      for (const name of skills) {
        editor.add(loadSkill(name));
        editor.update(name, (skill) => {
          skill.autoinvoke = true;
        });
      }
    });
  },
});
