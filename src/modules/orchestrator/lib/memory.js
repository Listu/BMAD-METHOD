/**
 * BMAD Orchestrator - Memory Manager
 *
 * High-level API for project memory operations.
 * Handles automatic memory queries, storage, and user interactions.
 */

const { createMemoryClient, MEMORY_TYPES, STATUS } = require('./memory-client');

/**
 * Memory Manager
 * Provides high-level memory operations for the orchestrator
 */
class MemoryManager {
  constructor(projectId, options = {}) {
    this.projectId = projectId;
    this.options = options;
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize the memory manager
   */
  async init() {
    if (this.initialized) return;

    this.client = await createMemoryClient(this.projectId, this.options);
    this.initialized = true;
  }

  /**
   * Ensure initialized before operations
   */
  async ensureInit() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // ============================================================================
  // Error Memory
  // ============================================================================

  /**
   * Record an error and how it was resolved
   */
  async recordError(error, resolution, context = {}) {
    await this.ensureInit();

    const content = `Error: ${error}\nResolution: ${resolution}`;

    return this.client.addEntry('errors', content, {
      error,
      resolution,
      context: context.context || '',
      file: context.file || '',
      workflow: context.workflow || '',
      tags: context.tags || ['error'],
      created_by: context.created_by || 'ai'
    });
  }

  /**
   * Search for similar errors
   */
  async findSimilarErrors(errorDescription, limit = 3) {
    await this.ensureInit();
    return this.client.search(errorDescription, { type: 'errors', limit });
  }

  // ============================================================================
  // Decision Memory
  // ============================================================================

  /**
   * Record a technical decision
   */
  async recordDecision(decision, rationale, alternatives = [], context = {}) {
    await this.ensureInit();

    const content = `Decision: ${decision}\nRationale: ${rationale}\nAlternatives considered: ${alternatives.join(', ') || 'None documented'}`;

    return this.client.addEntry('decisions', content, {
      decision,
      rationale,
      alternatives: JSON.stringify(alternatives),
      area: context.area || '',
      workflow: context.workflow || '',
      tags: context.tags || ['decision'],
      created_by: context.created_by || 'ai'
    });
  }

  /**
   * Search for related decisions
   */
  async findRelatedDecisions(topic, limit = 3) {
    await this.ensureInit();
    return this.client.search(topic, { type: 'decisions', limit });
  }

  // ============================================================================
  // Lesson Memory
  // ============================================================================

  /**
   * Record a lesson learned
   */
  async recordLesson(lesson, context = {}) {
    await this.ensureInit();

    return this.client.addEntry('lessons', lesson, {
      applicability: context.applicability || 'general',
      source: context.source || '',
      workflow: context.workflow || '',
      tags: context.tags || ['lesson'],
      created_by: context.created_by || 'ai'
    });
  }

  /**
   * Search for relevant lessons
   */
  async findRelevantLessons(situation, limit = 3) {
    await this.ensureInit();
    return this.client.search(situation, { type: 'lessons', limit });
  }

  // ============================================================================
  // Pattern Memory
  // ============================================================================

  /**
   * Record a recurring pattern
   */
  async recordPattern(pattern, occurrences = 1, context = {}) {
    await this.ensureInit();

    return this.client.addEntry('patterns', pattern, {
      occurrences,
      first_seen: context.first_seen || new Date().toISOString(),
      last_seen: new Date().toISOString(),
      tags: context.tags || ['pattern'],
      created_by: context.created_by || 'ai'
    });
  }

  /**
   * Search for matching patterns
   */
  async findPatterns(description, limit = 3) {
    await this.ensureInit();
    return this.client.search(description, { type: 'patterns', limit });
  }

  // ============================================================================
  // General Operations
  // ============================================================================

  /**
   * Search across all memory types
   */
  async search(query, limit = 5) {
    await this.ensureInit();
    return this.client.search(query, { limit });
  }

  /**
   * Add a manual note to memory
   */
  async addNote(content, type = 'lessons', metadata = {}) {
    await this.ensureInit();
    return this.client.addEntry(type, content, {
      ...metadata,
      created_by: 'user'
    });
  }

  /**
   * Correct an existing memory entry
   */
  async correct(type, entryId, newContent, reason) {
    await this.ensureInit();
    return this.client.correctEntry(type, entryId, newContent, reason);
  }

  /**
   * Mark an entry as no longer valid
   */
  async deprecate(type, entryId, reason) {
    await this.ensureInit();
    return this.client.deprecateEntry(type, entryId, reason);
  }

  /**
   * Get memory summary for display
   */
  async getSummary() {
    await this.ensureInit();

    const summary = {
      projectId: this.projectId,
      connected: this.client.connected !== false,
      counts: {}
    };

    for (const type of MEMORY_TYPES) {
      try {
        summary.counts[type] = await this.client.countEntries(type);
      } catch {
        summary.counts[type] = 0;
      }
    }

    summary.total = Object.values(summary.counts).reduce((a, b) => a + b, 0);

    return summary;
  }

  /**
   * Get all memories formatted for display
   */
  async getAll(options = {}) {
    await this.ensureInit();

    const result = {};

    for (const type of MEMORY_TYPES) {
      result[type] = await this.client.getAllEntries(type, options);
    }

    return result;
  }

  /**
   * Pre-workflow context gathering
   * Searches memory for relevant information before starting a workflow
   */
  async gatherContext(workflowType, description = '') {
    await this.ensureInit();

    const context = {
      relevantErrors: [],
      relevantDecisions: [],
      relevantLessons: [],
      relevantPatterns: []
    };

    // Search based on workflow type and description
    const searchQuery = `${workflowType} ${description}`.trim();

    if (searchQuery) {
      context.relevantErrors = await this.findSimilarErrors(searchQuery, 2);
      context.relevantDecisions = await this.findRelatedDecisions(searchQuery, 2);
      context.relevantLessons = await this.findRelevantLessons(searchQuery, 2);
      context.relevantPatterns = await this.findPatterns(searchQuery, 2);
    }

    // Filter out empty results
    for (const key of Object.keys(context)) {
      if (context[key].length === 0) {
        delete context[key];
      }
    }

    return context;
  }

  /**
   * Format memory for LLM context
   */
  formatForContext(memories) {
    if (!memories || Object.keys(memories).length === 0) {
      return '';
    }

    const sections = [];

    if (memories.relevantErrors?.length > 0) {
      sections.push('## Previous Errors\n' + memories.relevantErrors.map(e =>
        `- ${e.content}`
      ).join('\n'));
    }

    if (memories.relevantDecisions?.length > 0) {
      sections.push('## Past Decisions\n' + memories.relevantDecisions.map(d =>
        `- ${d.content}`
      ).join('\n'));
    }

    if (memories.relevantLessons?.length > 0) {
      sections.push('## Lessons Learned\n' + memories.relevantLessons.map(l =>
        `- ${l.content}`
      ).join('\n'));
    }

    if (memories.relevantPatterns?.length > 0) {
      sections.push('## Known Patterns\n' + memories.relevantPatterns.map(p =>
        `- ${p.content}`
      ).join('\n'));
    }

    return sections.join('\n\n');
  }
}

module.exports = { MemoryManager, MEMORY_TYPES, STATUS };
