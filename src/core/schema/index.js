/**
 * BMAD Schema Module
 *
 * Provides schema definitions and validation for BMAD entities.
 */

const v2Schema = require('./v2-schema');

module.exports = {
  // v2 Schema exports
  SCHEMA_VERSION: v2Schema.SCHEMA_VERSION,
  EntityType: v2Schema.EntityType,
  DEFAULT_ALLOWED_TOOLS: v2Schema.DEFAULT_ALLOWED_TOOLS,

  // Schemas
  agentFrontmatterSchema: v2Schema.agentFrontmatterSchema,
  workflowFrontmatterSchema: v2Schema.workflowFrontmatterSchema,
  skillFrontmatterSchema: v2Schema.skillFrontmatterSchema,

  // Functions
  parseFrontmatter: v2Schema.parseFrontmatter,
  validateFrontmatter: v2Schema.validateFrontmatter,
  isV2Format: v2Schema.isV2Format,
  getSchema: v2Schema.getSchema
};
