/**
 * Validate File Path Hook
 *
 * Pre-tool hook that validates file paths before Write/Edit operations.
 * Ensures files are written to allowed locations and follow project conventions.
 */

const path = require('path');
const {
  HookType,
  HookMode,
  HookPriority,
  HookResult,
  createHookDefinition
} = require('../hook-types');

/**
 * Default allowed paths (relative to project root)
 */
const DEFAULT_ALLOWED_PATHS = [
  'src/',
  'lib/',
  'docs/',
  '_bmad/',
  '_bmad-output/',
  'tests/',
  'test/',
  '__tests__/',
  'scripts/',
  'config/',
  '.github/',
  'public/',
  'assets/'
];

/**
 * Paths that should never be written to
 */
const FORBIDDEN_PATHS = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  '.env',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
];

/**
 * Dangerous patterns that might indicate unintended writes
 */
const DANGEROUS_PATTERNS = [
  /^\//, // Absolute path starting with /
  /\.\./, // Path traversal
  /~/, // Home directory
  /^C:\\/, // Windows absolute path
  /^[A-Z]:/ // Windows drive letter
];

/**
 * Hook handler for file path validation
 * @param {Object} context Hook execution context
 * @param {Object} hook Hook definition
 * @returns {Object} Hook result
 */
async function handler(context, hook) {
  const { toolName, toolArgs, projectPath } = context;

  // Only validate Write and Edit operations
  if (!['Write', 'Edit'].includes(toolName)) {
    return { result: HookResult.CONTINUE };
  }

  const filePath = toolArgs?.file_path || toolArgs?.path;
  if (!filePath) {
    return { result: HookResult.CONTINUE };
  }

  const config = hook.config || {};
  const allowedPaths = config.allowedPaths || DEFAULT_ALLOWED_PATHS;
  const forbiddenPaths = config.forbiddenPaths || FORBIDDEN_PATHS;
  const strict = config.strict !== false;

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(filePath)) {
      if (strict) {
        return {
          result: HookResult.ABORT,
          error: `Dangerous file path pattern detected: ${filePath}`,
          message: `The path "${filePath}" contains a potentially dangerous pattern. Use relative paths within the project.`
        };
      }
      console.warn(`Warning: Potentially dangerous file path: ${filePath}`);
    }
  }

  // Check forbidden paths
  const normalizedPath = path.normalize(filePath);
  for (const forbidden of forbiddenPaths) {
    if (normalizedPath.includes(forbidden)) {
      return {
        result: HookResult.ABORT,
        error: `Forbidden path: ${filePath}`,
        message: `Writing to "${forbidden}" is not allowed. This path is protected.`
      };
    }
  }

  // In strict mode, verify path is in allowed list
  if (strict && allowedPaths.length > 0) {
    const isAllowed = allowedPaths.some(allowed => {
      return normalizedPath.startsWith(allowed) ||
             normalizedPath.includes(`/${allowed}`) ||
             normalizedPath.includes(`\\${allowed}`);
    });

    if (!isAllowed) {
      // Don't block, just warn
      console.warn(`Warning: File path "${filePath}" is outside standard project directories`);
    }
  }

  // Log the validated path
  if (context.verbose) {
    console.log(`[validate-file-path] Validated: ${filePath}`);
  }

  return { result: HookResult.CONTINUE };
}

/**
 * Hook definition for auto-registration
 */
const hookDefinition = createHookDefinition({
  id: 'builtin-validate-file-path',
  type: HookType.PRE_TOOL_USE,
  match: '^(Write|Edit)$',
  action: 'validate-file-path',
  mode: HookMode.BLOCKING,
  priority: HookPriority.CRITICAL,
  description: 'Validates file paths before write operations to prevent dangerous writes'
});

module.exports = {
  handler,
  hookDefinition,
  DEFAULT_ALLOWED_PATHS,
  FORBIDDEN_PATHS,
  DANGEROUS_PATTERNS
};
