/**
 * BMAD Skill Registry
 *
 * Manages skill discovery, loading, and execution.
 * Skills are reusable capability bundles (workflow + templates + scripts).
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { parseFrontmatter, validateFrontmatter, EntityType } = require('../schema/v2-schema');

/**
 * Default skills directory
 */
const DEFAULT_SKILLS_DIR = path.join(__dirname, '../../skills');

/**
 * SkillRegistry - Central skill management
 */
class SkillRegistry {
  constructor(options = {}) {
    this.skills = new Map();
    this.aliasMap = new Map();
    this.skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
    this.verbose = options.verbose || false;
    this.loaded = false;
  }

  /**
   * Discover and load all skills from the skills directory
   */
  async discover() {
    if (!fs.existsSync(this.skillsDir)) {
      if (this.verbose) {
        console.log(`Skills directory not found: ${this.skillsDir}`);
      }
      return;
    }

    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(this.skillsDir, entry.name);
      const skillYaml = path.join(skillDir, 'skill.yaml');

      if (fs.existsSync(skillYaml)) {
        try {
          await this.loadSkill(skillDir);
        } catch (err) {
          console.error(`Failed to load skill ${entry.name}:`, err.message);
        }
      }
    }

    this.loaded = true;
    if (this.verbose) {
      console.log(`Loaded ${this.skills.size} skills`);
    }
  }

  /**
   * Load a skill from a directory
   * @param {string} skillDir Path to skill directory
   * @returns {Object} Loaded skill
   */
  async loadSkill(skillDir) {
    const skillYamlPath = path.join(skillDir, 'skill.yaml');
    const instructionsPath = path.join(skillDir, 'instructions.xml');

    // Read and parse skill.yaml
    const content = fs.readFileSync(skillYamlPath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    // Validate frontmatter
    const validation = validateFrontmatter(frontmatter, EntityType.SKILL);
    if (!validation.valid) {
      throw new Error(`Invalid skill: ${validation.errors.join(', ')}`);
    }

    // Parse body as YAML if present
    let skillConfig = {};
    if (body) {
      skillConfig = yaml.load(body) || {};
    }

    // Load instructions if present
    let instructions = null;
    if (fs.existsSync(instructionsPath)) {
      instructions = fs.readFileSync(instructionsPath, 'utf-8');
    }

    // Load templates
    const templates = await this._loadTemplates(skillDir);

    // Build skill object
    const skill = {
      id: frontmatter.bmad.id,
      name: frontmatter.bmad.name,
      description: frontmatter.bmad.description,
      entryCommand: frontmatter.bmad['entry-command'],
      aliases: frontmatter.bmad.aliases || [],
      hooks: frontmatter.bmad.hooks || {},
      config: skillConfig.skill || {},
      instructions,
      templates,
      path: skillDir
    };

    // Register skill
    this.skills.set(skill.id, skill);

    // Register aliases
    if (skill.entryCommand) {
      this.aliasMap.set(skill.entryCommand, skill.id);
    }
    for (const alias of skill.aliases) {
      this.aliasMap.set(alias, skill.id);
      this.aliasMap.set(`/${alias}`, skill.id);
    }

    if (this.verbose) {
      console.log(`Loaded skill: ${skill.id} (${skill.entryCommand})`);
    }

    return skill;
  }

  /**
   * Load templates from skill directory
   * @private
   */
  async _loadTemplates(skillDir) {
    const templatesDir = path.join(skillDir, 'templates');
    const templates = {};

    if (!fs.existsSync(templatesDir)) {
      return templates;
    }

    const files = fs.readdirSync(templatesDir);
    for (const file of files) {
      const filePath = path.join(templatesDir, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        const name = path.basename(file, path.extname(file));
        templates[name] = fs.readFileSync(filePath, 'utf-8');
      }
    }

    return templates;
  }

  /**
   * Get a skill by ID or alias
   * @param {string} idOrAlias Skill ID or alias
   * @returns {Object|null} Skill or null
   */
  get(idOrAlias) {
    // Try direct ID
    if (this.skills.has(idOrAlias)) {
      return this.skills.get(idOrAlias);
    }

    // Try alias
    const id = this.aliasMap.get(idOrAlias);
    if (id) {
      return this.skills.get(id);
    }

    return null;
  }

  /**
   * Check if a skill exists
   * @param {string} idOrAlias Skill ID or alias
   * @returns {boolean}
   */
  has(idOrAlias) {
    return this.skills.has(idOrAlias) || this.aliasMap.has(idOrAlias);
  }

  /**
   * Get all skills
   * @returns {Array} Array of skills
   */
  getAll() {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill by command (e.g., /plan)
   * @param {string} command Command string
   * @returns {Object|null} Skill or null
   */
  getByCommand(command) {
    const normalizedCommand = command.startsWith('/') ? command : `/${command}`;
    return this.get(normalizedCommand);
  }

  /**
   * Execute a skill
   * @param {string} idOrAlias Skill ID or alias
   * @param {Object} context Execution context
   * @returns {Object} Execution result
   */
  async execute(idOrAlias, context = {}) {
    const skill = this.get(idOrAlias);
    if (!skill) {
      throw new Error(`Skill not found: ${idOrAlias}`);
    }

    const result = {
      skill: skill.id,
      started: new Date().toISOString(),
      outputDir: null,
      files: {},
      success: false
    };

    try {
      // Determine output directory
      const projectPath = context.projectPath || process.cwd();
      const outputDir = path.join(
        projectPath,
        skill.config.output_directory || '_bmad-output/skills/' + skill.id
      );

      result.outputDir = outputDir;

      // Create output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Initialize files from templates
      for (const [name, template] of Object.entries(skill.templates)) {
        const filePath = path.join(outputDir, `${name}.md`);

        // Only create if doesn't exist
        if (!fs.existsSync(filePath)) {
          const content = this._processTemplate(template, context);
          fs.writeFileSync(filePath, content);
          result.files[name] = { path: filePath, created: true };
        } else {
          result.files[name] = { path: filePath, created: false };
        }
      }

      result.success = true;
      result.instructions = skill.instructions;
      result.completed = new Date().toISOString();

    } catch (err) {
      result.success = false;
      result.error = err.message;
    }

    return result;
  }

  /**
   * Process template with context variables
   * @private
   */
  _processTemplate(template, context) {
    return template
      .replace(/\{\{GOAL\}\}/g, context.goal || 'Untitled Task')
      .replace(/\{\{DESCRIPTION\}\}/g, context.description || '')
      .replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString())
      .replace(/\{\{STATUS\}\}/g, context.status || 'In Progress')
      .replace(/\{\{CONTEXT\}\}/g, context.context || '')
      .replace(/\{\{FIRST_TASK\}\}/g, context.firstTask || 'Define first task');
  }

  /**
   * List available skills in a formatted way
   * @returns {string} Formatted skill list
   */
  listFormatted() {
    const skills = this.getAll();
    if (skills.length === 0) {
      return 'No skills available';
    }

    const lines = ['Available Skills:', ''];
    for (const skill of skills) {
      const aliases = skill.aliases.length > 0
        ? ` (aliases: ${skill.aliases.join(', ')})`
        : '';
      lines.push(`  ${skill.entryCommand || skill.id}${aliases}`);
      lines.push(`    ${skill.description.split('\n')[0]}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create the global skill registry
 * @param {Object} options Options
 * @returns {SkillRegistry}
 */
function getSkillRegistry(options = {}) {
  if (!instance) {
    instance = new SkillRegistry(options);
  }
  return instance;
}

/**
 * Reset the skill registry (for testing)
 */
function resetSkillRegistry() {
  instance = null;
}

module.exports = {
  SkillRegistry,
  getSkillRegistry,
  resetSkillRegistry,
  DEFAULT_SKILLS_DIR
};
