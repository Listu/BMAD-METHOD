/**
 * Log Command Hook
 *
 * Post-tool hook that logs Bash command execution for audit and debugging.
 * Maintains a command history that can be used for workflow replay.
 */

const fs = require('fs');
const path = require('path');
const {
  HookType,
  HookMode,
  HookPriority,
  HookResult,
  createHookDefinition
} = require('../hook-types');

/**
 * In-memory command log (for current session)
 */
const commandLog = [];

/**
 * Maximum commands to keep in memory
 */
const MAX_MEMORY_COMMANDS = 1000;

/**
 * Format a log entry
 * @param {Object} entry Log entry data
 * @returns {string} Formatted log line
 */
function formatLogEntry(entry) {
  const timestamp = new Date(entry.timestamp).toISOString();
  const status = entry.exitCode === 0 ? 'OK' : `FAIL(${entry.exitCode})`;
  const duration = entry.duration ? `${entry.duration}ms` : '-';

  return `[${timestamp}] [${status}] [${duration}] ${entry.command}`;
}

/**
 * Write log to file
 * @param {string} logPath Path to log file
 * @param {Object} entry Log entry
 */
async function writeToFile(logPath, entry) {
  try {
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logLine = formatLogEntry(entry) + '\n';
    fs.appendFileSync(logPath, logLine);
  } catch (err) {
    console.error(`Failed to write command log: ${err.message}`);
  }
}

/**
 * Hook handler for logging commands
 * @param {Object} context Hook execution context
 * @param {Object} hook Hook definition
 * @returns {Object} Hook result
 */
async function handler(context, hook) {
  const { toolName, toolArgs, toolResult, projectPath, sessionId } = context;

  // Only log Bash commands
  if (toolName !== 'Bash') {
    return { result: HookResult.CONTINUE };
  }

  const config = hook.config || {};
  const command = toolArgs?.command || '';
  const startTime = context.startTime || Date.now();

  // Create log entry
  const entry = {
    timestamp: new Date().toISOString(),
    sessionId: sessionId || 'unknown',
    command: command.substring(0, 500), // Truncate long commands
    fullCommand: command,
    exitCode: toolResult?.exitCode ?? (toolResult?.error ? 1 : 0),
    duration: toolResult?.duration || (Date.now() - startTime),
    cwd: toolArgs?.cwd || process.cwd(),
    output: config.logOutput ? toolResult?.output?.substring(0, 1000) : undefined
  };

  // Add to memory log
  commandLog.push(entry);
  if (commandLog.length > MAX_MEMORY_COMMANDS) {
    commandLog.shift();
  }

  // Write to file if configured
  if (config.logFile) {
    const logPath = config.logFile.startsWith('/')
      ? config.logFile
      : path.join(projectPath || process.cwd(), config.logFile);
    await writeToFile(logPath, entry);
  }

  // Default log location: _bmad-output/command-history.log
  if (config.logFile === undefined && projectPath) {
    const defaultLogPath = path.join(projectPath, '_bmad-output', 'command-history.log');
    await writeToFile(defaultLogPath, entry);
  }

  // Verbose console output
  if (context.verbose || config.verbose) {
    console.log(`[log-command] ${formatLogEntry(entry)}`);
  }

  // Emit warning for failed commands
  if (entry.exitCode !== 0 && config.warnOnFailure !== false) {
    console.warn(`[log-command] Command failed with exit code ${entry.exitCode}: ${command.substring(0, 100)}...`);
  }

  return { result: HookResult.CONTINUE };
}

/**
 * Get command history
 * @param {number} limit Max entries to return
 * @returns {Array} Command history entries
 */
function getCommandHistory(limit = 100) {
  return commandLog.slice(-limit);
}

/**
 * Clear command history
 */
function clearCommandHistory() {
  commandLog.length = 0;
}

/**
 * Get failed commands from history
 * @returns {Array} Failed command entries
 */
function getFailedCommands() {
  return commandLog.filter(entry => entry.exitCode !== 0);
}

/**
 * Hook definition for auto-registration
 */
const hookDefinition = createHookDefinition({
  id: 'builtin-log-command',
  type: HookType.POST_TOOL_USE,
  match: '^Bash$',
  action: 'log-command',
  mode: HookMode.ASYNC,
  priority: HookPriority.LOW,
  description: 'Logs Bash command execution for audit and debugging'
});

module.exports = {
  handler,
  hookDefinition,
  getCommandHistory,
  clearCommandHistory,
  getFailedCommands,
  formatLogEntry
};
