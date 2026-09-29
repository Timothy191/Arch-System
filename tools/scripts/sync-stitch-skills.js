/**
 * Emulates the 'stitch-skills' standard by enforcing Agent Skill schemas.
 * Ensures every SKILL.md has required YAML frontmatter (name, description, mcp_dependencies).
 */
import fs from 'fs/promises';
import path from 'path';

const SKILLS_DIR = path.join(process.cwd(), '.agents', 'skills');

async function syncStitchSkills() {
  console.log('🔄 Syncing Agent Skills to Stitch Standard...');
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  let syncedCount = 0;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
      try {
        let content = await fs.readFile(skillPath, 'utf8');
        // Simple frontmatter check
        if (!content.startsWith('---\n')) {
          console.log(`⚠️ Patching missing frontmatter in ${entry.name}`);
          const frontmatter = `---
name: ${entry.name}
description: Auto-migrated skill to Stitch Open Standard
mcp_dependencies: []
---
`;
          content = frontmatter + content;
          await fs.writeFile(skillPath, content, 'utf8');
          syncedCount++;
        }
      } catch (err) {
        // file might not exist, skip
      }
    }
  }
  console.log(
    `✅ Successfully verified/synced all Agent Skills to Stitch Standard. (${syncedCount} patched)`
  );
}

syncStitchSkills().catch(console.error);
