/**
 * BMAD Skills Module
 *
 * Skills are reusable capability bundles that combine:
 * - A skill definition (skill.yaml)
 * - Instructions for execution (instructions.xml)
 * - Templates for output files
 * - Optional helper scripts
 *
 * Usage:
 *   const { getSkillRegistry } = require('@bmad/core/skills');
 *
 *   const registry = getSkillRegistry();
 *   await registry.discover();
 *
 *   // Get skill by command
 *   const skill = registry.getByCommand('/plan');
 *
 *   // Execute skill
 *   const result = await registry.execute('planning-with-files', {
 *     goal: 'Implement feature X',
 *     projectPath: '/path/to/project'
 *   });
 */

const {
  SkillRegistry,
  getSkillRegistry,
  resetSkillRegistry,
  DEFAULT_SKILLS_DIR
} = require('./skill-registry');

module.exports = {
  SkillRegistry,
  getSkillRegistry,
  resetSkillRegistry,
  DEFAULT_SKILLS_DIR
};
