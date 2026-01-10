/**
 * BMAD Orchestrator Library
 *
 * Main entry point for the orchestrator module.
 * Exports all core functionality.
 */

// Phase 1: Core MVP
const { ProjectRegistry } = require('./registry');
const { IntentDetector } = require('./intent');
const { Router } = require('./router');
const { Executor } = require('./executor');

// Phase 2: Growth Features
const { MemoryManager, MEMORY_TYPES, STATUS } = require('./memory');
const { createMemoryClient, MemoryClient, FallbackMemoryClient } = require('./memory-client');
const { SessionManager, DelegationQueue, DELEGATION_STATUS } = require('./delegation');
const { QualityGate, validateTask, PROJECT_MARKERS, BUILD_COMMANDS, TEST_COMMANDS } = require('./quality-gate');
const { AutoRetention, createAutoRetention, EXTRACTION_PATTERNS } = require('./auto-retention');

// Phase 3: Vision Features
const { RecoveryManager, CheckpointManager, ErrorAnalyzer, createRecoveryManager, RECOVERY_STATUS, ERROR_CATEGORIES } = require('./error-recovery');
const { TemplateManager, createTemplateManager, BUILTIN_TEMPLATES, TEMPLATE_CATEGORIES } = require('./project-templates');
const { ExportImportManager, ProjectExporter, ProjectImporter, createExportImportManager, EXPORT_FORMATS } = require('./export-import');
const { MetaReviewManager, PatternDetector, ReportGenerator, createMetaReviewManager, REVIEW_CATEGORIES, INSIGHT_TYPES } = require('./meta-review');

/**
 * Create and initialize an orchestrator instance
 * @param {string} projectPath - Path to the current project
 * @param {Object} options - Configuration options
 */
async function createOrchestrator(projectPath, options = {}) {
  const registry = new ProjectRegistry(options.registryPath);
  await registry.init();

  const router = new Router(projectPath, {
    ...options,
    registry
  });
  await router.init();

  const executor = new Executor(projectPath, options);

  return {
    registry,
    router,
    executor,
    intentDetector: router.intentDetector,

    /**
     * Process a natural language command and execute
     * @param {string} input - Natural language input
     * @returns {Object} Execution result with instructions
     */
    async process(input) {
      // 1. Route the input
      const decision = await router.route(input);

      // 2. Execute the decision
      const result = await executor.execute(decision);

      return {
        input,
        decision,
        result
      };
    },

    /**
     * Route only (without execution)
     */
    async route(input) {
      return router.route(input);
    },

    /**
     * Get current project status
     */
    async getStatus() {
      return router.getProjectState();
    },

    /**
     * List all registered projects
     */
    async listProjects() {
      return registry.listProjects();
    },

    /**
     * Switch to a different project
     */
    async switchProject(projectId) {
      return registry.switchProject(projectId);
    },

    /**
     * Register current project
     */
    async registerProject(path = projectPath) {
      return registry.addProject(path);
    },

    /**
     * Get the active project
     */
    async getActiveProject() {
      const projects = await registry.listProjects();
      if (!projects.activeId) return null;
      return registry.getProject(projects.activeId);
    }
  };
}

module.exports = {
  // Main factory
  createOrchestrator,

  // Phase 1: Core MVP
  ProjectRegistry,
  IntentDetector,
  Router,
  Executor,

  // Phase 2: Memory
  MemoryManager,
  createMemoryClient,
  MemoryClient,
  FallbackMemoryClient,
  MEMORY_TYPES,
  STATUS,

  // Phase 2: Delegation
  SessionManager,
  DelegationQueue,
  DELEGATION_STATUS,

  // Phase 2: Quality Gate
  QualityGate,
  validateTask,
  PROJECT_MARKERS,
  BUILD_COMMANDS,
  TEST_COMMANDS,

  // Phase 2: Auto-Retention
  AutoRetention,
  createAutoRetention,
  EXTRACTION_PATTERNS,

  // Phase 3: Error Recovery
  RecoveryManager,
  CheckpointManager,
  ErrorAnalyzer,
  createRecoveryManager,
  RECOVERY_STATUS,
  ERROR_CATEGORIES,

  // Phase 3: Project Templates
  TemplateManager,
  createTemplateManager,
  BUILTIN_TEMPLATES,
  TEMPLATE_CATEGORIES,

  // Phase 3: Export/Import
  ExportImportManager,
  ProjectExporter,
  ProjectImporter,
  createExportImportManager,
  EXPORT_FORMATS,

  // Phase 3: Meta-Review
  MetaReviewManager,
  PatternDetector,
  ReportGenerator,
  createMetaReviewManager,
  REVIEW_CATEGORIES,
  INSIGHT_TYPES
};
