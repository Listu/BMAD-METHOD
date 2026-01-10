/**
 * BMAD Orchestrator - Error Recovery
 *
 * Provides checkpoint-based recovery for workflow execution.
 * Enables graceful recovery from failures without losing progress.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Recovery status values
const RECOVERY_STATUS = {
  ACTIVE: 'active',
  RECOVERED: 'recovered',
  FAILED: 'failed',
  ABANDONED: 'abandoned'
};

// Error categories for recovery strategy
const ERROR_CATEGORIES = {
  TRANSIENT: 'transient',      // Network, timeout - auto-retry
  VALIDATION: 'validation',    // Bad input - needs user fix
  SYSTEM: 'system',            // File not found, permission - may auto-recover
  LOGIC: 'logic',              // Bug in workflow - needs investigation
  EXTERNAL: 'external',        // API failure, service down - wait and retry
  UNKNOWN: 'unknown'
};

// Default configuration
const DEFAULT_CONFIG = {
  checkpointDir: '.bmad/checkpoints',
  maxRetries: 3,
  retryDelayMs: 5000,
  checkpointRetentionDays: 7,
  autoRecoveryEnabled: true
};

/**
 * Checkpoint Manager
 * Creates and manages workflow checkpoints for recovery
 */
class CheckpointManager {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.checkpointDir = path.join(projectPath, this.config.checkpointDir);
    this.initialized = false;
  }

  /**
   * Initialize checkpoint directory
   */
  async init() {
    if (this.initialized) return;
    await fs.mkdir(this.checkpointDir, { recursive: true });
    this.initialized = true;
  }

  /**
   * Create a checkpoint for current workflow state
   */
  async createCheckpoint(workflowId, state) {
    await this.init();

    const checkpointId = crypto.randomBytes(8).toString('hex');
    const timestamp = new Date().toISOString();

    const checkpoint = {
      id: checkpointId,
      workflowId,
      timestamp,
      state: {
        step: state.step || 0,
        stepName: state.stepName || '',
        data: state.data || {},
        outputs: state.outputs || [],
        context: state.context || {}
      },
      metadata: {
        projectPath: this.projectPath,
        createdAt: timestamp
      }
    };

    const checkpointPath = this.getCheckpointPath(workflowId, checkpointId);
    await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));

    // Update latest pointer
    await this.updateLatestPointer(workflowId, checkpointId);

    return checkpoint;
  }

  /**
   * Get checkpoint file path
   */
  getCheckpointPath(workflowId, checkpointId) {
    const safeWorkflowId = workflowId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.checkpointDir, safeWorkflowId, `${checkpointId}.json`);
  }

  /**
   * Update pointer to latest checkpoint for a workflow
   */
  async updateLatestPointer(workflowId, checkpointId) {
    const safeWorkflowId = workflowId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const pointerPath = path.join(this.checkpointDir, safeWorkflowId, 'latest.txt');
    await fs.writeFile(pointerPath, checkpointId);
  }

  /**
   * Load the latest checkpoint for a workflow
   */
  async loadLatestCheckpoint(workflowId) {
    await this.init();

    const safeWorkflowId = workflowId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const pointerPath = path.join(this.checkpointDir, safeWorkflowId, 'latest.txt');

    try {
      const checkpointId = (await fs.readFile(pointerPath, 'utf8')).trim();
      return this.loadCheckpoint(workflowId, checkpointId);
    } catch {
      return null;
    }
  }

  /**
   * Load a specific checkpoint
   */
  async loadCheckpoint(workflowId, checkpointId) {
    const checkpointPath = this.getCheckpointPath(workflowId, checkpointId);

    try {
      const content = await fs.readFile(checkpointPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * List all checkpoints for a workflow
   */
  async listCheckpoints(workflowId) {
    await this.init();

    const safeWorkflowId = workflowId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const workflowDir = path.join(this.checkpointDir, safeWorkflowId);

    try {
      const files = await fs.readdir(workflowDir);
      const checkpoints = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const checkpoint = await this.loadCheckpoint(workflowId, file.replace('.json', ''));
          if (checkpoint) {
            checkpoints.push({
              id: checkpoint.id,
              timestamp: checkpoint.timestamp,
              step: checkpoint.state.step,
              stepName: checkpoint.state.stepName
            });
          }
        }
      }

      return checkpoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch {
      return [];
    }
  }

  /**
   * Delete old checkpoints
   */
  async cleanupOldCheckpoints() {
    await this.init();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.checkpointRetentionDays);

    try {
      const workflows = await fs.readdir(this.checkpointDir);

      for (const workflow of workflows) {
        const workflowDir = path.join(this.checkpointDir, workflow);
        const stat = await fs.stat(workflowDir);

        if (!stat.isDirectory()) continue;

        const files = await fs.readdir(workflowDir);

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          const filePath = path.join(workflowDir, file);
          const fileStat = await fs.stat(filePath);

          if (fileStat.mtime < cutoffDate) {
            await fs.unlink(filePath);
          }
        }
      }
    } catch {
      // Cleanup failures are non-critical
    }
  }

  /**
   * Delete all checkpoints for a workflow
   */
  async clearWorkflowCheckpoints(workflowId) {
    const safeWorkflowId = workflowId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const workflowDir = path.join(this.checkpointDir, safeWorkflowId);

    try {
      await fs.rm(workflowDir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Error Analyzer
 * Categorizes errors and determines recovery strategy
 */
class ErrorAnalyzer {
  constructor() {
    this.patterns = {
      [ERROR_CATEGORIES.TRANSIENT]: [
        /timeout/i,
        /ETIMEDOUT/i,
        /ECONNRESET/i,
        /ECONNREFUSED/i,
        /network/i,
        /socket hang up/i
      ],
      [ERROR_CATEGORIES.VALIDATION]: [
        /validation/i,
        /invalid/i,
        /required/i,
        /missing.*field/i,
        /must be/i,
        /expected/i
      ],
      [ERROR_CATEGORIES.SYSTEM]: [
        /ENOENT/i,
        /EACCES/i,
        /EPERM/i,
        /no such file/i,
        /permission denied/i,
        /not found/i
      ],
      [ERROR_CATEGORIES.EXTERNAL]: [
        /API/i,
        /rate limit/i,
        /429/i,
        /503/i,
        /service unavailable/i,
        /quota/i
      ],
      [ERROR_CATEGORIES.LOGIC]: [
        /undefined is not/i,
        /cannot read prop/i,
        /is not a function/i,
        /assertion/i,
        /invariant/i
      ]
    };
  }

  /**
   * Analyze an error and determine its category
   */
  analyze(error) {
    const errorString = this.errorToString(error);

    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(errorString)) {
          return {
            category,
            message: errorString,
            recoverable: this.isRecoverable(category),
            strategy: this.getRecoveryStrategy(category),
            confidence: 0.8
          };
        }
      }
    }

    return {
      category: ERROR_CATEGORIES.UNKNOWN,
      message: errorString,
      recoverable: false,
      strategy: 'manual_review',
      confidence: 0.3
    };
  }

  /**
   * Convert error to string for analysis
   */
  errorToString(error) {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    if (error.message) return error.message;
    return JSON.stringify(error);
  }

  /**
   * Check if error category is recoverable
   */
  isRecoverable(category) {
    return [
      ERROR_CATEGORIES.TRANSIENT,
      ERROR_CATEGORIES.EXTERNAL,
      ERROR_CATEGORIES.SYSTEM
    ].includes(category);
  }

  /**
   * Get recovery strategy for error category
   */
  getRecoveryStrategy(category) {
    const strategies = {
      [ERROR_CATEGORIES.TRANSIENT]: 'auto_retry',
      [ERROR_CATEGORIES.VALIDATION]: 'user_fix',
      [ERROR_CATEGORIES.SYSTEM]: 'check_prerequisites',
      [ERROR_CATEGORIES.LOGIC]: 'manual_review',
      [ERROR_CATEGORIES.EXTERNAL]: 'wait_and_retry',
      [ERROR_CATEGORIES.UNKNOWN]: 'manual_review'
    };
    return strategies[category] || 'manual_review';
  }
}

/**
 * Recovery Manager
 * Coordinates checkpoint creation, error analysis, and recovery execution
 */
class RecoveryManager {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.checkpointManager = new CheckpointManager(projectPath, options);
    this.errorAnalyzer = new ErrorAnalyzer();
    this.activeRecoveries = new Map();
  }

  /**
   * Initialize recovery manager
   */
  async init() {
    await this.checkpointManager.init();
  }

  /**
   * Create checkpoint before risky operation
   */
  async checkpoint(workflowId, state) {
    return this.checkpointManager.createCheckpoint(workflowId, state);
  }

  /**
   * Handle an error and determine recovery action
   */
  async handleError(workflowId, error, context = {}) {
    const analysis = this.errorAnalyzer.analyze(error);

    const recovery = {
      id: crypto.randomBytes(4).toString('hex'),
      workflowId,
      error: analysis,
      context,
      status: RECOVERY_STATUS.ACTIVE,
      attempts: 0,
      createdAt: new Date().toISOString()
    };

    this.activeRecoveries.set(recovery.id, recovery);

    // Check for existing checkpoint
    const checkpoint = await this.checkpointManager.loadLatestCheckpoint(workflowId);

    if (checkpoint) {
      recovery.checkpoint = checkpoint;
      recovery.canRecover = true;
    } else {
      recovery.canRecover = false;
    }

    // Determine next action
    recovery.recommendedAction = this.getRecommendedAction(recovery);

    return recovery;
  }

  /**
   * Get recommended recovery action
   */
  getRecommendedAction(recovery) {
    if (!recovery.canRecover) {
      return {
        action: 'restart',
        reason: 'No checkpoint available for recovery',
        automatic: false
      };
    }

    const { strategy } = recovery.error;

    switch (strategy) {
      case 'auto_retry':
        return {
          action: 'retry',
          reason: 'Transient error - automatic retry recommended',
          automatic: this.config.autoRecoveryEnabled,
          delay: this.config.retryDelayMs
        };

      case 'wait_and_retry':
        return {
          action: 'retry',
          reason: 'External service issue - retry after delay',
          automatic: this.config.autoRecoveryEnabled,
          delay: this.config.retryDelayMs * 3
        };

      case 'check_prerequisites':
        return {
          action: 'diagnose',
          reason: 'System error - check file/permission prerequisites',
          automatic: false,
          checks: ['file_exists', 'permissions', 'disk_space']
        };

      case 'user_fix':
        return {
          action: 'user_input',
          reason: 'Validation error - user must correct input',
          automatic: false,
          field: recovery.context.field || 'unknown'
        };

      default:
        return {
          action: 'manual_review',
          reason: 'Unknown error - manual investigation required',
          automatic: false
        };
    }
  }

  /**
   * Attempt recovery from checkpoint
   */
  async recover(recoveryId) {
    const recovery = this.activeRecoveries.get(recoveryId);
    if (!recovery) {
      throw new Error(`Recovery not found: ${recoveryId}`);
    }

    if (!recovery.canRecover) {
      return {
        success: false,
        reason: 'No checkpoint available'
      };
    }

    recovery.attempts++;

    if (recovery.attempts > this.config.maxRetries) {
      recovery.status = RECOVERY_STATUS.FAILED;
      return {
        success: false,
        reason: `Max retries (${this.config.maxRetries}) exceeded`,
        recovery
      };
    }

    // Return checkpoint state for caller to resume
    return {
      success: true,
      checkpoint: recovery.checkpoint,
      resumeFrom: {
        step: recovery.checkpoint.state.step,
        stepName: recovery.checkpoint.state.stepName,
        data: recovery.checkpoint.state.data
      },
      recovery
    };
  }

  /**
   * Mark recovery as successful
   */
  markRecovered(recoveryId) {
    const recovery = this.activeRecoveries.get(recoveryId);
    if (recovery) {
      recovery.status = RECOVERY_STATUS.RECOVERED;
      recovery.recoveredAt = new Date().toISOString();
    }
  }

  /**
   * Abandon recovery attempt
   */
  abandonRecovery(recoveryId, reason) {
    const recovery = this.activeRecoveries.get(recoveryId);
    if (recovery) {
      recovery.status = RECOVERY_STATUS.ABANDONED;
      recovery.abandonedAt = new Date().toISOString();
      recovery.abandonReason = reason;
    }
  }

  /**
   * Get active recovery for a workflow
   */
  getActiveRecovery(workflowId) {
    for (const recovery of this.activeRecoveries.values()) {
      if (recovery.workflowId === workflowId &&
          recovery.status === RECOVERY_STATUS.ACTIVE) {
        return recovery;
      }
    }
    return null;
  }

  /**
   * List all active recoveries
   */
  listActiveRecoveries() {
    return Array.from(this.activeRecoveries.values())
      .filter(r => r.status === RECOVERY_STATUS.ACTIVE);
  }

  /**
   * Check if workflow has pending recovery
   */
  hasPendingRecovery(workflowId) {
    return this.getActiveRecovery(workflowId) !== null;
  }

  /**
   * Run automatic retry if configured
   */
  async autoRetry(recoveryId, executeFunc) {
    const recovery = this.activeRecoveries.get(recoveryId);
    if (!recovery) return { success: false, reason: 'Recovery not found' };

    const action = recovery.recommendedAction;
    if (!action.automatic) {
      return { success: false, reason: 'Automatic recovery not available' };
    }

    // Wait for delay
    if (action.delay) {
      await new Promise(resolve => setTimeout(resolve, action.delay));
    }

    // Attempt recovery
    const recoverResult = await this.recover(recoveryId);
    if (!recoverResult.success) {
      return recoverResult;
    }

    // Execute the retry
    try {
      const result = await executeFunc(recoverResult.resumeFrom);
      this.markRecovered(recoveryId);
      return { success: true, result };
    } catch (error) {
      // Update recovery with new error
      recovery.lastError = this.errorAnalyzer.analyze(error);
      return { success: false, error, recovery };
    }
  }

  /**
   * Format recovery status for display
   */
  formatRecoveryStatus(recovery) {
    const lines = [];

    lines.push(`## Recovery Status: ${recovery.status.toUpperCase()}`);
    lines.push('');
    lines.push(`**Workflow:** ${recovery.workflowId}`);
    lines.push(`**Error Category:** ${recovery.error.category}`);
    lines.push(`**Message:** ${recovery.error.message}`);
    lines.push('');

    if (recovery.checkpoint) {
      lines.push(`**Checkpoint Available:** Yes`);
      lines.push(`**Resume From:** Step ${recovery.checkpoint.state.step} (${recovery.checkpoint.state.stepName})`);
    } else {
      lines.push(`**Checkpoint Available:** No`);
    }

    lines.push('');
    lines.push(`**Recommended Action:** ${recovery.recommendedAction.action}`);
    lines.push(`**Reason:** ${recovery.recommendedAction.reason}`);
    lines.push(`**Automatic:** ${recovery.recommendedAction.automatic ? 'Yes' : 'No'}`);

    if (recovery.attempts > 0) {
      lines.push(`**Attempts:** ${recovery.attempts}/${this.config.maxRetries}`);
    }

    return lines.join('\n');
  }
}

/**
 * Create recovery manager with default configuration
 */
function createRecoveryManager(projectPath, options = {}) {
  return new RecoveryManager(projectPath, options);
}

module.exports = {
  RecoveryManager,
  CheckpointManager,
  ErrorAnalyzer,
  createRecoveryManager,
  RECOVERY_STATUS,
  ERROR_CATEGORIES
};
