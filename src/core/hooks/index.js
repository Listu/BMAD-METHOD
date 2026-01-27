/**
 * BMAD Hook System
 *
 * Extensible hook system for BMAD workflows and agents.
 *
 * Usage:
 *   const { getHookRegistry, HookType, HookResult } = require('@bmad/core/hooks');
 *
 *   // Get the global registry
 *   const registry = getHookRegistry();
 *
 *   // Register a custom hook
 *   registry.register({
 *     id: 'my-custom-hook',
 *     type: HookType.PRE_TOOL_USE,
 *     match: 'Write|Edit',
 *     action: 'my-action',
 *     mode: HookMode.SYNC
 *   });
 *
 *   // Register a handler
 *   registry.registerHandler('my-action', async (context, hook) => {
 *     console.log('Before write:', context.toolArgs.file_path);
 *     return { result: HookResult.CONTINUE };
 *   });
 *
 *   // Execute hooks
 *   const result = await registry.execute(HookType.PRE_TOOL_USE, {
 *     toolName: 'Write',
 *     toolArgs: { file_path: '/path/to/file' }
 *   });
 *
 *   // Load hooks from YAML
 *   registry.loadFromYaml('/path/to/hooks.yaml');
 */

const {
  HookType,
  ToolPatterns,
  HookMode,
  HookPriority,
  HookResult,
  HookContext,
  BuiltinHooks,
  createHookDefinition,
  validateHookDefinition
} = require('./hook-types');

const {
  HookRegistry,
  getHookRegistry,
  resetHookRegistry
} = require('./hook-registry');

// Re-export builtin hooks for direct access
const validateFilePath = require('./builtin/validate-file-path');
const logCommand = require('./builtin/log-command');
const updateWorkflowStatus = require('./builtin/update-workflow-status');

/**
 * Convenience function to create and register a hook in one step
 * @param {Object} options Hook options
 * @returns {boolean} Success
 */
function registerHook(options) {
  const registry = getHookRegistry();
  const hookDef = createHookDefinition(options);
  return registry.register(hookDef);
}

/**
 * Convenience function to execute hooks
 * @param {string} type Hook type
 * @param {Object} context Execution context
 * @returns {Promise<Object>} Execution result
 */
async function executeHooks(type, context = {}) {
  const registry = getHookRegistry();
  return registry.execute(type, context);
}

/**
 * Initialize the hook system with options
 * @param {Object} options Initialization options
 * @returns {HookRegistry} Configured registry
 */
function initHookSystem(options = {}) {
  // Reset if requested
  if (options.reset) {
    resetHookRegistry();
  }

  const registry = getHookRegistry({
    verbose: options.verbose,
    enabled: options.enabled !== false,
    loadBuiltins: options.loadBuiltins !== false
  });

  // Load from config file if provided
  if (options.configPath) {
    registry.loadFromYaml(options.configPath);
  }

  return registry;
}

/**
 * Create a pre-tool-use hook for file validation
 * @param {Object} config Validation config
 * @returns {Object} Hook definition
 */
function createFileValidationHook(config = {}) {
  return createHookDefinition({
    id: config.id || 'custom-file-validation',
    type: HookType.PRE_TOOL_USE,
    match: config.match || '^(Write|Edit)$',
    action: 'validate-file-path',
    mode: HookMode.BLOCKING,
    priority: HookPriority.CRITICAL,
    config
  });
}

/**
 * Create a step-complete hook for workflow tracking
 * @param {Object} config Tracking config
 * @returns {Object} Hook definition
 */
function createWorkflowTrackingHook(config = {}) {
  return createHookDefinition({
    id: config.id || 'custom-workflow-tracking',
    type: HookType.STEP_COMPLETE,
    action: 'update-workflow-status',
    mode: HookMode.ASYNC,
    priority: HookPriority.NORMAL,
    config
  });
}

module.exports = {
  // Core types
  HookType,
  ToolPatterns,
  HookMode,
  HookPriority,
  HookResult,
  HookContext,
  BuiltinHooks,

  // Registry
  HookRegistry,
  getHookRegistry,
  resetHookRegistry,

  // Definition helpers
  createHookDefinition,
  validateHookDefinition,

  // Convenience functions
  registerHook,
  executeHooks,
  initHookSystem,
  createFileValidationHook,
  createWorkflowTrackingHook,

  // Builtin hooks (for direct access/configuration)
  builtin: {
    validateFilePath,
    logCommand,
    updateWorkflowStatus
  }
};
