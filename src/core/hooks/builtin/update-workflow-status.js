/**
 * Update Workflow Status Hook
 *
 * Step-complete hook that maintains workflow progress tracking.
 * Updates status files in _bmad-output/ for workflow visibility.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const {
  HookType,
  HookMode,
  HookPriority,
  HookResult,
  createHookDefinition
} = require('../hook-types');

/**
 * Default status file location
 */
const DEFAULT_STATUS_FILE = '_bmad-output/workflow-status.yaml';

/**
 * Workflow status states
 */
const WorkflowStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Load existing status from file
 * @param {string} statusPath Path to status file
 * @returns {Object} Status data or empty object
 */
function loadStatus(statusPath) {
  try {
    if (fs.existsSync(statusPath)) {
      const content = fs.readFileSync(statusPath, 'utf-8');
      return yaml.load(content) || {};
    }
  } catch (err) {
    console.error(`Failed to load workflow status: ${err.message}`);
  }
  return {};
}

/**
 * Save status to file
 * @param {string} statusPath Path to status file
 * @param {Object} status Status data
 */
function saveStatus(statusPath, status) {
  try {
    const dir = path.dirname(statusPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = yaml.dump(status, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });

    fs.writeFileSync(statusPath, content);
  } catch (err) {
    console.error(`Failed to save workflow status: ${err.message}`);
  }
}

/**
 * Hook handler for updating workflow status
 * @param {Object} context Hook execution context
 * @param {Object} hook Hook definition
 * @returns {Object} Hook result
 */
async function handler(context, hook) {
  const {
    workflowId,
    workflowName,
    currentStep,
    totalSteps,
    stepName,
    stepResult,
    projectPath,
    sessionId,
    error
  } = context;

  // Skip if no workflow context
  if (!workflowId && !workflowName) {
    return { result: HookResult.CONTINUE };
  }

  const config = hook.config || {};
  const statusFile = config.statusFile || DEFAULT_STATUS_FILE;
  const statusPath = statusFile.startsWith('/')
    ? statusFile
    : path.join(projectPath || process.cwd(), statusFile);

  // Load existing status
  const allStatus = loadStatus(statusPath);

  // Initialize workflow entry if needed
  const wfKey = workflowId || workflowName;
  if (!allStatus.workflows) {
    allStatus.workflows = {};
  }

  if (!allStatus.workflows[wfKey]) {
    allStatus.workflows[wfKey] = {
      name: workflowName,
      status: WorkflowStatus.IN_PROGRESS,
      startedAt: new Date().toISOString(),
      steps: [],
      currentStep: 0,
      totalSteps: totalSteps || 0
    };
  }

  const wfStatus = allStatus.workflows[wfKey];

  // Update step information
  if (stepName || currentStep !== undefined) {
    const stepEntry = {
      step: currentStep,
      name: stepName,
      completedAt: new Date().toISOString(),
      result: error ? 'failed' : (stepResult || 'completed'),
      error: error ? String(error) : undefined
    };

    // Add or update step
    const existingIdx = wfStatus.steps.findIndex(s => s.step === currentStep);
    if (existingIdx !== -1) {
      wfStatus.steps[existingIdx] = stepEntry;
    } else {
      wfStatus.steps.push(stepEntry);
    }

    wfStatus.currentStep = currentStep;
    if (totalSteps) {
      wfStatus.totalSteps = totalSteps;
    }
  }

  // Calculate progress
  if (wfStatus.totalSteps > 0) {
    wfStatus.progress = Math.round((wfStatus.currentStep / wfStatus.totalSteps) * 100);
  }

  // Update overall status
  if (error) {
    wfStatus.status = WorkflowStatus.FAILED;
    wfStatus.failedAt = new Date().toISOString();
    wfStatus.lastError = String(error);
  } else if (currentStep === totalSteps) {
    wfStatus.status = WorkflowStatus.COMPLETED;
    wfStatus.completedAt = new Date().toISOString();
  } else {
    wfStatus.status = WorkflowStatus.IN_PROGRESS;
  }

  wfStatus.lastUpdated = new Date().toISOString();
  wfStatus.sessionId = sessionId;

  // Update metadata
  allStatus.lastUpdated = new Date().toISOString();
  allStatus.activeWorkflow = wfKey;

  // Save status
  saveStatus(statusPath, allStatus);

  // Verbose output
  if (context.verbose || config.verbose) {
    const progress = wfStatus.progress ? ` (${wfStatus.progress}%)` : '';
    console.log(`[workflow-status] ${workflowName}: Step ${currentStep}/${totalSteps}${progress} - ${wfStatus.status}`);
  }

  return { result: HookResult.CONTINUE };
}

/**
 * Get current workflow status
 * @param {string} projectPath Project path
 * @param {string} workflowId Optional workflow ID
 * @returns {Object} Workflow status
 */
function getWorkflowStatus(projectPath, workflowId = null) {
  const statusPath = path.join(projectPath, DEFAULT_STATUS_FILE);
  const allStatus = loadStatus(statusPath);

  if (workflowId) {
    return allStatus.workflows?.[workflowId] || null;
  }

  return allStatus;
}

/**
 * Clear workflow status
 * @param {string} projectPath Project path
 * @param {string} workflowId Optional specific workflow to clear
 */
function clearWorkflowStatus(projectPath, workflowId = null) {
  const statusPath = path.join(projectPath, DEFAULT_STATUS_FILE);

  if (workflowId) {
    const allStatus = loadStatus(statusPath);
    if (allStatus.workflows?.[workflowId]) {
      delete allStatus.workflows[workflowId];
      saveStatus(statusPath, allStatus);
    }
  } else {
    if (fs.existsSync(statusPath)) {
      fs.unlinkSync(statusPath);
    }
  }
}

/**
 * Mark workflow as failed
 * @param {string} projectPath Project path
 * @param {string} workflowId Workflow ID
 * @param {string} error Error message
 */
function markWorkflowFailed(projectPath, workflowId, error) {
  const statusPath = path.join(projectPath, DEFAULT_STATUS_FILE);
  const allStatus = loadStatus(statusPath);

  if (allStatus.workflows?.[workflowId]) {
    allStatus.workflows[workflowId].status = WorkflowStatus.FAILED;
    allStatus.workflows[workflowId].failedAt = new Date().toISOString();
    allStatus.workflows[workflowId].lastError = error;
    saveStatus(statusPath, allStatus);
  }
}

/**
 * Mark workflow as completed
 * @param {string} projectPath Project path
 * @param {string} workflowId Workflow ID
 */
function markWorkflowCompleted(projectPath, workflowId) {
  const statusPath = path.join(projectPath, DEFAULT_STATUS_FILE);
  const allStatus = loadStatus(statusPath);

  if (allStatus.workflows?.[workflowId]) {
    allStatus.workflows[workflowId].status = WorkflowStatus.COMPLETED;
    allStatus.workflows[workflowId].completedAt = new Date().toISOString();
    allStatus.workflows[workflowId].progress = 100;
    saveStatus(statusPath, allStatus);
  }
}

/**
 * Hook definition for auto-registration
 */
const hookDefinition = createHookDefinition({
  id: 'builtin-update-workflow-status',
  type: HookType.STEP_COMPLETE,
  action: 'update-workflow-status',
  mode: HookMode.ASYNC,
  priority: HookPriority.NORMAL,
  description: 'Updates workflow progress tracking in status file'
});

module.exports = {
  handler,
  hookDefinition,
  WorkflowStatus,
  getWorkflowStatus,
  clearWorkflowStatus,
  markWorkflowFailed,
  markWorkflowCompleted,
  DEFAULT_STATUS_FILE
};
