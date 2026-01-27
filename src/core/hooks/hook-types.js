/**
 * BMAD Hook Types
 *
 * Defines all hook types available in the BMAD system.
 * Hooks allow extending behavior at key points in workflow execution.
 */

/**
 * Hook event types - when hooks are triggered
 */
const HookType = {
  // Tool-related hooks (Claude Code integration)
  PRE_TOOL_USE: 'PreToolUse',       // Before a tool is executed
  POST_TOOL_USE: 'PostToolUse',     // After a tool completes

  // Session lifecycle hooks
  SESSION_START: 'SessionStart',    // When a BMAD session begins
  SESSION_STOP: 'Stop',             // When a BMAD session ends

  // Workflow execution hooks
  WORKFLOW_START: 'WorkflowStart',  // Before workflow begins
  WORKFLOW_END: 'WorkflowEnd',      // After workflow completes
  STEP_COMPLETE: 'StepComplete',    // After each workflow step

  // Agent hooks
  AGENT_ACTIVATE: 'AgentActivate',  // When an agent is activated
  AGENT_DEACTIVATE: 'AgentDeactivate', // When agent is deactivated

  // Routing hooks (orchestrator)
  ROUTE_DECISION: 'RouteDecision',  // After router makes a decision

  // Error handling
  ON_ERROR: 'OnError',              // When an error occurs
  ON_RECOVERY: 'OnRecovery'         // When error recovery triggers
};

/**
 * Tool patterns for matching in PreToolUse/PostToolUse
 */
const ToolPatterns = {
  FILE_WRITE: /^(Write|Edit)$/,
  FILE_READ: /^(Read|Glob|Grep)$/,
  COMMAND: /^Bash$/,
  ALL_FILES: /^(Write|Edit|Read|Glob|Grep)$/,
  ANY: /.*/
};

/**
 * Hook execution modes
 */
const HookMode = {
  SYNC: 'sync',           // Execute synchronously, wait for result
  ASYNC: 'async',         // Execute asynchronously, don't wait
  BLOCKING: 'blocking'    // Must pass validation to continue
};

/**
 * Hook priority levels (lower = executed first)
 */
const HookPriority = {
  CRITICAL: 0,    // Security, validation
  HIGH: 10,       // Important processing
  NORMAL: 50,     // Standard hooks
  LOW: 90,        // Logging, monitoring
  DEFERRED: 100   // Cleanup, non-critical
};

/**
 * Hook result types
 */
const HookResult = {
  CONTINUE: 'continue',   // Continue execution
  SKIP: 'skip',           // Skip the action
  ABORT: 'abort',         // Abort entire workflow
  RETRY: 'retry',         // Retry the action
  MODIFY: 'modify'        // Modify the action/data
};

/**
 * Context keys available to hooks
 */
const HookContext = {
  // Tool context
  TOOL_NAME: 'toolName',
  TOOL_ARGS: 'toolArgs',
  TOOL_RESULT: 'toolResult',

  // Workflow context
  WORKFLOW_ID: 'workflowId',
  WORKFLOW_NAME: 'workflowName',
  CURRENT_STEP: 'currentStep',
  TOTAL_STEPS: 'totalSteps',

  // Agent context
  AGENT_ID: 'agentId',
  AGENT_NAME: 'agentName',

  // Project context
  PROJECT_PATH: 'projectPath',
  PROJECT_NAME: 'projectName',

  // Session context
  SESSION_ID: 'sessionId',
  START_TIME: 'startTime',

  // Error context
  ERROR: 'error',
  ERROR_CODE: 'errorCode',
  RECOVERABLE: 'recoverable'
};

/**
 * Built-in hook identifiers
 */
const BuiltinHooks = {
  VALIDATE_FILE_PATH: 'validate-file-path',
  LOG_COMMAND: 'log-command',
  UPDATE_WORKFLOW_STATUS: 'update-workflow-status',
  EXTRACT_LEARNINGS: 'extract-learnings',
  CHECKPOINT_STATE: 'checkpoint-state'
};

/**
 * Creates a hook definition object
 * @param {Object} options Hook options
 * @returns {Object} Hook definition
 */
function createHookDefinition({
  id,
  type,
  match = null,
  action,
  mode = HookMode.SYNC,
  priority = HookPriority.NORMAL,
  description = '',
  enabled = true
}) {
  return {
    id,
    type,
    match,
    action,
    mode,
    priority,
    description,
    enabled,
    createdAt: new Date().toISOString()
  };
}

/**
 * Validates a hook definition
 * @param {Object} hook Hook definition to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateHookDefinition(hook) {
  const errors = [];

  if (!hook.id) {
    errors.push('Hook must have an id');
  }

  if (!hook.type || !Object.values(HookType).includes(hook.type)) {
    errors.push(`Invalid hook type: ${hook.type}. Must be one of: ${Object.values(HookType).join(', ')}`);
  }

  if (!hook.action) {
    errors.push('Hook must have an action');
  }

  if (hook.mode && !Object.values(HookMode).includes(hook.mode)) {
    errors.push(`Invalid hook mode: ${hook.mode}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  HookType,
  ToolPatterns,
  HookMode,
  HookPriority,
  HookResult,
  HookContext,
  BuiltinHooks,
  createHookDefinition,
  validateHookDefinition
};
