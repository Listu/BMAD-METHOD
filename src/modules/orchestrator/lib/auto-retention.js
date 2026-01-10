/**
 * BMAD Orchestrator - Auto-Retention
 *
 * Automatically extracts errors, decisions, and lessons from workflow execution.
 * Hooks into workflow system to capture valuable information without manual entry.
 */

const { MemoryManager } = require('./memory');

// Patterns for detecting extractable content
const EXTRACTION_PATTERNS = {
  error: {
    patterns: [
      /error[:\s]+(.+?)(?:\n|$)/gi,
      /failed[:\s]+(.+?)(?:\n|$)/gi,
      /exception[:\s]+(.+?)(?:\n|$)/gi,
      /\[error\][:\s]*(.+?)(?:\n|$)/gi,
      /fix(?:ed)?[:\s]+(.+?)(?:\n|$)/gi
    ],
    keywords: ['error', 'failed', 'exception', 'bug', 'fix', 'issue', 'problem', 'broken']
  },
  decision: {
    patterns: [
      /(?:decided|decision)[:\s]+(.+?)(?:\n|$)/gi,
      /(?:chose|choosing)[:\s]+(.+?)(?:\n|$)/gi,
      /(?:selected|selecting)[:\s]+(.+?)(?:\n|$)/gi,
      /(?:went with|going with)[:\s]+(.+?)(?:\n|$)/gi,
      /(?:approach|strategy)[:\s]+(.+?)(?:\n|$)/gi
    ],
    keywords: ['decided', 'decision', 'chose', 'selected', 'approach', 'strategy', 'went with', 'opted for']
  },
  lesson: {
    patterns: [
      /(?:learned|lesson)[:\s]+(.+?)(?:\n|$)/gi,
      /(?:next time|in future)[,:\s]+(.+?)(?:\n|$)/gi,
      /(?:remember|note)[:\s]+(.+?)(?:\n|$)/gi,
      /(?:tip|insight)[:\s]+(.+?)(?:\n|$)/gi,
      /(?:important|key point)[:\s]+(.+?)(?:\n|$)/gi
    ],
    keywords: ['learned', 'lesson', 'remember', 'next time', 'tip', 'insight', 'important', 'key point']
  }
};

// Minimum confidence threshold for auto-extraction
const MIN_CONFIDENCE = 0.6;

/**
 * Auto-Retention Manager
 * Automatically captures and stores learnings from workflow execution
 */
class AutoRetention {
  constructor(projectId, options = {}) {
    this.projectId = projectId;
    this.options = {
      autoExtract: true,
      minConfidence: options.minConfidence || MIN_CONFIDENCE,
      confirmBeforeStore: options.confirmBeforeStore || false,
      ...options
    };
    this.memoryManager = null;
    this.pendingExtractions = [];
    this.initialized = false;
  }

  /**
   * Initialize the auto-retention system
   */
  async init() {
    if (this.initialized) return;

    this.memoryManager = new MemoryManager(this.projectId, this.options.memory);
    await this.memoryManager.init();
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
  // Extraction
  // ============================================================================

  /**
   * Extract potential memories from text content
   */
  extractFromText(text, context = {}) {
    const extractions = [];

    for (const [type, config] of Object.entries(EXTRACTION_PATTERNS)) {
      // Check for keyword presence
      const hasKeywords = config.keywords.some(kw =>
        text.toLowerCase().includes(kw.toLowerCase())
      );

      if (!hasKeywords) continue;

      // Try pattern matching
      for (const pattern of config.patterns) {
        pattern.lastIndex = 0; // Reset regex state
        let match;

        while ((match = pattern.exec(text)) !== null) {
          const content = match[1]?.trim();
          if (content && content.length > 10 && content.length < 500) {
            extractions.push({
              type,
              content,
              confidence: this.calculateConfidence(content, type, context),
              source: context.source || 'workflow',
              context
            });
          }
        }
      }
    }

    // Deduplicate by content similarity
    return this.deduplicateExtractions(extractions);
  }

  /**
   * Extract from workflow output/result
   */
  async extractFromWorkflowResult(result, workflowInfo = {}) {
    await this.ensureInit();

    const extractions = [];
    const context = {
      workflow: workflowInfo.name || 'unknown',
      step: workflowInfo.step || '',
      source: 'workflow_result'
    };

    // Extract from output text
    if (result.output) {
      extractions.push(...this.extractFromText(result.output, context));
    }

    // Extract from summary if present
    if (result.summary) {
      extractions.push(...this.extractFromText(result.summary, {
        ...context,
        source: 'workflow_summary'
      }));
    }

    // Check for explicit errors
    if (result.error || result.errors) {
      const errors = Array.isArray(result.errors) ? result.errors : [result.error];
      for (const error of errors.filter(Boolean)) {
        extractions.push({
          type: 'error',
          content: typeof error === 'string' ? error : JSON.stringify(error),
          confidence: 0.95, // Explicit errors are high confidence
          source: 'workflow_error',
          context: {
            ...context,
            resolution: result.resolution || ''
          }
        });
      }
    }

    // Check for explicit decisions
    if (result.decisions) {
      for (const decision of result.decisions) {
        extractions.push({
          type: 'decision',
          content: typeof decision === 'string' ? decision : decision.content || JSON.stringify(decision),
          confidence: 0.95,
          source: 'workflow_decision',
          context: {
            ...context,
            rationale: decision.rationale || ''
          }
        });
      }
    }

    return extractions;
  }

  /**
   * Extract from conversation/chat messages
   */
  extractFromConversation(messages, context = {}) {
    const extractions = [];

    for (const message of messages) {
      const text = typeof message === 'string' ? message : message.content;
      if (text) {
        extractions.push(...this.extractFromText(text, {
          ...context,
          source: 'conversation',
          role: message.role || 'unknown'
        }));
      }
    }

    return extractions;
  }

  /**
   * Extract from file changes
   */
  extractFromFileChanges(changes, context = {}) {
    const extractions = [];

    for (const change of changes) {
      // Look for meaningful comments or commit messages
      if (change.message) {
        extractions.push(...this.extractFromText(change.message, {
          ...context,
          source: 'file_change',
          file: change.file
        }));
      }

      // Check for error fixes in diffs
      if (change.diff && change.diff.includes('fix')) {
        const lines = change.diff.split('\n');
        for (const line of lines) {
          if (line.startsWith('+') && /fix|error|bug/i.test(line)) {
            extractions.push(...this.extractFromText(line, {
              ...context,
              source: 'code_change',
              file: change.file
            }));
          }
        }
      }
    }

    return extractions;
  }

  // ============================================================================
  // Confidence & Deduplication
  // ============================================================================

  /**
   * Calculate confidence score for an extraction
   */
  calculateConfidence(content, type, context = {}) {
    let confidence = 0.5; // Base confidence

    const config = EXTRACTION_PATTERNS[type];

    // Boost for multiple keywords
    const keywordCount = config.keywords.filter(kw =>
      content.toLowerCase().includes(kw.toLowerCase())
    ).length;
    confidence += keywordCount * 0.1;

    // Boost for reasonable length
    if (content.length > 20 && content.length < 200) {
      confidence += 0.1;
    }

    // Boost for context clues
    if (context.workflow) confidence += 0.05;
    if (context.step) confidence += 0.05;

    // Boost for explicit markers
    if (/^(error|decision|lesson|note|important):/i.test(content)) {
      confidence += 0.2;
    }

    // Reduce for generic content
    if (/^(the|a|an|this|that|it)\s/i.test(content)) {
      confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Deduplicate extractions by content similarity
   */
  deduplicateExtractions(extractions) {
    const unique = [];

    for (const extraction of extractions) {
      const isDuplicate = unique.some(existing =>
        this.contentSimilarity(existing.content, extraction.content) > 0.8
      );

      if (!isDuplicate) {
        unique.push(extraction);
      }
    }

    // Sort by confidence
    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Simple content similarity check
   */
  contentSimilarity(a, b) {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  // ============================================================================
  // Storage
  // ============================================================================

  /**
   * Store extractions that meet confidence threshold
   */
  async storeExtractions(extractions) {
    await this.ensureInit();

    const stored = [];
    const pending = [];

    for (const extraction of extractions) {
      if (extraction.confidence >= this.options.minConfidence) {
        if (this.options.confirmBeforeStore) {
          pending.push(extraction);
        } else {
          const result = await this.storeExtraction(extraction);
          if (result) stored.push(result);
        }
      }
    }

    if (pending.length > 0) {
      this.pendingExtractions.push(...pending);
    }

    return { stored, pending };
  }

  /**
   * Store a single extraction
   */
  async storeExtraction(extraction) {
    await this.ensureInit();

    const metadata = {
      source: extraction.source,
      confidence: extraction.confidence,
      workflow: extraction.context?.workflow || '',
      tags: [extraction.type, 'auto-extracted'],
      created_by: 'auto-retention'
    };

    switch (extraction.type) {
      case 'error':
        return this.memoryManager.recordError(
          extraction.content,
          extraction.context?.resolution || 'Auto-extracted - resolution pending',
          metadata
        );

      case 'decision':
        return this.memoryManager.recordDecision(
          extraction.content,
          extraction.context?.rationale || 'Auto-extracted',
          [],
          metadata
        );

      case 'lesson':
        return this.memoryManager.recordLesson(extraction.content, metadata);

      default:
        return null;
    }
  }

  /**
   * Get pending extractions for user confirmation
   */
  getPendingExtractions() {
    return [...this.pendingExtractions];
  }

  /**
   * Confirm and store a pending extraction
   */
  async confirmExtraction(index) {
    if (index < 0 || index >= this.pendingExtractions.length) {
      return null;
    }

    const extraction = this.pendingExtractions[index];
    const result = await this.storeExtraction(extraction);
    this.pendingExtractions.splice(index, 1);
    return result;
  }

  /**
   * Reject a pending extraction
   */
  rejectExtraction(index) {
    if (index < 0 || index >= this.pendingExtractions.length) {
      return false;
    }
    this.pendingExtractions.splice(index, 1);
    return true;
  }

  /**
   * Confirm all pending extractions
   */
  async confirmAllPending() {
    const results = [];
    while (this.pendingExtractions.length > 0) {
      const result = await this.confirmExtraction(0);
      if (result) results.push(result);
    }
    return results;
  }

  /**
   * Clear all pending extractions
   */
  clearPending() {
    const count = this.pendingExtractions.length;
    this.pendingExtractions = [];
    return count;
  }

  // ============================================================================
  // Workflow Hooks
  // ============================================================================

  /**
   * Hook: Called when a workflow step completes
   */
  async onStepComplete(stepResult, workflowInfo) {
    if (!this.options.autoExtract) return { stored: [], pending: [] };

    const extractions = await this.extractFromWorkflowResult(stepResult, workflowInfo);
    return this.storeExtractions(extractions);
  }

  /**
   * Hook: Called when a workflow completes
   */
  async onWorkflowComplete(workflowResult, workflowInfo) {
    if (!this.options.autoExtract) return { stored: [], pending: [] };

    const extractions = await this.extractFromWorkflowResult(workflowResult, workflowInfo);

    // Also extract from any summary
    if (workflowResult.summary) {
      const summaryExtractions = this.extractFromText(workflowResult.summary, {
        workflow: workflowInfo.name,
        source: 'workflow_summary'
      });
      extractions.push(...summaryExtractions);
    }

    return this.storeExtractions(extractions);
  }

  /**
   * Hook: Called when an error occurs
   */
  async onError(error, context = {}) {
    await this.ensureInit();

    const errorContent = typeof error === 'string' ? error : error.message || JSON.stringify(error);

    return this.memoryManager.recordError(
      errorContent,
      context.resolution || 'Pending resolution',
      {
        source: 'error_hook',
        workflow: context.workflow || '',
        file: context.file || '',
        tags: ['error', 'auto-captured'],
        created_by: 'auto-retention'
      }
    );
  }

  /**
   * Hook: Called when a decision is made
   */
  async onDecision(decision, rationale, alternatives = [], context = {}) {
    await this.ensureInit();

    return this.memoryManager.recordDecision(
      decision,
      rationale,
      alternatives,
      {
        source: 'decision_hook',
        workflow: context.workflow || '',
        tags: ['decision', 'auto-captured'],
        created_by: 'auto-retention'
      }
    );
  }

  // ============================================================================
  // Summary & Stats
  // ============================================================================

  /**
   * Get retention statistics
   */
  async getStats() {
    await this.ensureInit();

    const summary = await this.memoryManager.getSummary();

    return {
      ...summary,
      pendingCount: this.pendingExtractions.length,
      autoExtractEnabled: this.options.autoExtract,
      minConfidence: this.options.minConfidence
    };
  }

  /**
   * Format extractions for display
   */
  formatExtractions(extractions) {
    if (!extractions || extractions.length === 0) {
      return 'No extractions found.';
    }

    const lines = ['## Auto-Extracted Memories\n'];

    for (const [i, ext] of extractions.entries()) {
      const icon = ext.type === 'error' ? '!' : (ext.type === 'decision' ? '?' : '*');
      const conf = Math.round(ext.confidence * 100);
      lines.push(`${i + 1}. [${icon}] **${ext.type}** (${conf}%)`);
      lines.push(`   ${ext.content}`);
      if (ext.context?.workflow) {
        lines.push(`   _Source: ${ext.context.workflow}_`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Create auto-retention instance with default configuration
 */
function createAutoRetention(projectId, options = {}) {
  return new AutoRetention(projectId, options);
}

module.exports = {
  AutoRetention,
  createAutoRetention,
  EXTRACTION_PATTERNS,
  MIN_CONFIDENCE
};
