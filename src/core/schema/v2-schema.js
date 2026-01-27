/**
 * BMAD Schema v2 Definitions
 *
 * Defines the v2 frontmatter schema for agents and workflows.
 * This schema follows the claude-code-templates pattern with YAML frontmatter.
 */

/**
 * v2 Schema version
 */
const SCHEMA_VERSION = '2.0';

/**
 * Supported entity types
 */
const EntityType = {
  AGENT: 'agent',
  WORKFLOW: 'workflow',
  SKILL: 'skill',
  HOOK: 'hook',
  TEMPLATE: 'template'
};

/**
 * Default allowed tools for agents
 */
const DEFAULT_ALLOWED_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'Task',
  'WebFetch',
  'WebSearch',
  'NotebookEdit'
];

/**
 * v2 Agent frontmatter schema
 *
 * @example
 * ---
 * bmad:
 *   version: "2.0"
 *   type: agent
 *   id: bmm/agents/dev
 *   name: Developer
 *   description: Full-stack development agent
 *   module: bmm
 *   model: null
 *   allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
 *   hooks:
 *     PreToolUse:
 *       - match: "Write|Edit"
 *         action: validate-file-path
 * ---
 */
const agentFrontmatterSchema = {
  type: 'object',
  required: ['bmad'],
  properties: {
    bmad: {
      type: 'object',
      required: ['version', 'type', 'id', 'name'],
      properties: {
        version: { type: 'string', const: SCHEMA_VERSION },
        type: { type: 'string', const: EntityType.AGENT },
        id: { type: 'string', pattern: '^[a-z0-9-]+(/[a-z0-9-]+)*$' },
        name: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        module: { type: 'string' },
        model: { type: ['string', 'null'] },
        'allowed-tools': {
          type: 'array',
          items: { type: 'string' },
          default: DEFAULT_ALLOWED_TOOLS
        },
        hooks: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'object',
              required: ['action'],
              properties: {
                match: { type: 'string' },
                action: { type: 'string' },
                mode: { type: 'string', enum: ['sync', 'async', 'blocking'] },
                priority: { type: 'number' },
                enabled: { type: 'boolean', default: true }
              }
            }
          }
        }
      }
    }
  }
};

/**
 * v2 Workflow frontmatter schema
 *
 * @example
 * ---
 * bmad:
 *   version: "2.0"
 *   type: workflow
 *   id: bmm/workflows/dev-story
 *   name: Dev Story
 *   description: Execute a development story
 *   module: bmm
 *   aliases: [ds, dev-story]
 *   entry-point: true
 *   agent: dev
 *   hooks: []
 * ---
 */
const workflowFrontmatterSchema = {
  type: 'object',
  required: ['bmad'],
  properties: {
    bmad: {
      type: 'object',
      required: ['version', 'type', 'id', 'name'],
      properties: {
        version: { type: 'string', const: SCHEMA_VERSION },
        type: { type: 'string', const: EntityType.WORKFLOW },
        id: { type: 'string', pattern: '^[a-z0-9-]+(/[a-z0-9-]+)*$' },
        name: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        module: { type: 'string' },
        aliases: {
          type: 'array',
          items: { type: 'string' }
        },
        'entry-point': { type: 'boolean', default: false },
        agent: { type: ['string', 'null'] },
        hooks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'action'],
            properties: {
              type: { type: 'string' },
              match: { type: 'string' },
              action: { type: 'string' }
            }
          }
        }
      }
    }
  }
};

/**
 * v2 Skill frontmatter schema
 *
 * @example
 * ---
 * bmad:
 *   version: "2.0"
 *   type: skill
 *   id: planning-with-files
 *   name: Planning with Files
 *   description: Manus-style planning with task_plan.md, findings.md, progress.md
 *   entry-command: /plan
 *   aliases: [plan, planning]
 * ---
 */
const skillFrontmatterSchema = {
  type: 'object',
  required: ['bmad'],
  properties: {
    bmad: {
      type: 'object',
      required: ['version', 'type', 'id', 'name'],
      properties: {
        version: { type: 'string', const: SCHEMA_VERSION },
        type: { type: 'string', const: EntityType.SKILL },
        id: { type: 'string', pattern: '^[a-z0-9-]+$' },
        name: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        'entry-command': { type: 'string', pattern: '^/[a-z0-9-]+$' },
        aliases: {
          type: 'array',
          items: { type: 'string' }
        },
        templates: {
          type: 'array',
          items: { type: 'string' }
        },
        scripts: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }
};

/**
 * Parse YAML with frontmatter
 * @param {string} content File content
 * @returns {Object} { frontmatter, body }
 */
function parseFrontmatter(content) {
  const trimmed = content.trim();

  // Check for frontmatter delimiter
  if (!trimmed.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  // Find closing delimiter
  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    return { frontmatter: null, body: content };
  }

  const frontmatterStr = trimmed.substring(3, endIndex).trim();
  const bodyStr = trimmed.substring(endIndex + 3).trim();

  // Parse frontmatter YAML
  const yaml = require('js-yaml');
  let frontmatter;
  try {
    frontmatter = yaml.load(frontmatterStr);
  } catch (err) {
    throw new Error(`Invalid frontmatter YAML: ${err.message}`);
  }

  return { frontmatter, body: bodyStr };
}

/**
 * Validate frontmatter against schema
 * @param {Object} frontmatter Parsed frontmatter
 * @param {string} type Entity type
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateFrontmatter(frontmatter, type) {
  const errors = [];

  if (!frontmatter || !frontmatter.bmad) {
    errors.push('Missing bmad frontmatter block');
    return { valid: false, errors };
  }

  const bmad = frontmatter.bmad;

  // Common validations
  if (bmad.version !== SCHEMA_VERSION) {
    errors.push(`Invalid version: ${bmad.version}, expected ${SCHEMA_VERSION}`);
  }

  if (bmad.type !== type) {
    errors.push(`Invalid type: ${bmad.type}, expected ${type}`);
  }

  if (!bmad.id) {
    errors.push('Missing required field: id');
  }

  if (!bmad.name) {
    errors.push('Missing required field: name');
  }

  // Type-specific validations
  if (type === EntityType.AGENT) {
    if (bmad['allowed-tools'] && !Array.isArray(bmad['allowed-tools'])) {
      errors.push('allowed-tools must be an array');
    }
  }

  if (type === EntityType.WORKFLOW) {
    if (bmad.aliases && !Array.isArray(bmad.aliases)) {
      errors.push('aliases must be an array');
    }
  }

  if (type === EntityType.SKILL) {
    if (bmad['entry-command'] && !bmad['entry-command'].startsWith('/')) {
      errors.push('entry-command must start with /');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if content is v2 format
 * @param {string} content File content
 * @returns {boolean}
 */
function isV2Format(content) {
  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) return false;

  try {
    const { frontmatter } = parseFrontmatter(content);
    return frontmatter?.bmad?.version === SCHEMA_VERSION;
  } catch {
    return false;
  }
}

/**
 * Get schema for entity type
 * @param {string} type Entity type
 * @returns {Object} Schema definition
 */
function getSchema(type) {
  switch (type) {
    case EntityType.AGENT:
      return agentFrontmatterSchema;
    case EntityType.WORKFLOW:
      return workflowFrontmatterSchema;
    case EntityType.SKILL:
      return skillFrontmatterSchema;
    default:
      throw new Error(`Unknown entity type: ${type}`);
  }
}

module.exports = {
  SCHEMA_VERSION,
  EntityType,
  DEFAULT_ALLOWED_TOOLS,
  agentFrontmatterSchema,
  workflowFrontmatterSchema,
  skillFrontmatterSchema,
  parseFrontmatter,
  validateFrontmatter,
  isV2Format,
  getSchema
};
