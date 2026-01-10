/**
 * BMAD Orchestrator - Workflow Executor
 *
 * Bridges the router to the workflow.xml execution engine.
 * Handles workflow invocation, agent loading, and result tracking.
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

/**
 * Execution result
 * @typedef {Object} ExecutionResult
 * @property {boolean} success - Whether execution completed successfully
 * @property {string} workflow - Workflow that was executed
 * @property {string} [output] - Path to output file if any
 * @property {Object} [error] - Error details if failed
 * @property {number} duration - Execution time in ms
 */

class Executor {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.bmadPath = path.join(projectPath, '_bmad');
    this.manifestCache = {};
  }

  /**
   * Execute a routing decision
   * @param {Object} decision - Routing decision from Router
   * @returns {ExecutionResult}
   */
  async execute(decision) {
    const startTime = Date.now();

    try {
      switch (decision.action) {
        case 'invoke':
          return await this.invokeWorkflow(decision);

        case 'present_options':
          return this.formatOptions(decision);

        case 'clarify':
        case 'confirm':
          return this.formatQuestion(decision);

        case 'help':
          return await this.showHelp(decision);

        case 'query_memory':
          return await this.queryMemory(decision);

        case 'add_to_memory':
          return await this.addToMemory(decision);

        case 'switch_project':
          return this.formatSwitchRequest(decision);

        default:
          return {
            success: false,
            error: { message: `Unknown action: ${decision.action}` },
            duration: Date.now() - startTime
          };
      }
    } catch (error) {
      return {
        success: false,
        error: { message: error.message, stack: error.stack },
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Invoke a BMAD workflow
   */
  async invokeWorkflow(decision) {
    const startTime = Date.now();

    // Find workflow in manifest
    const workflowInfo = await this.findWorkflow(decision.workflow, decision.module);
    if (!workflowInfo) {
      return {
        success: false,
        error: { message: `Workflow not found: ${decision.workflow}` },
        duration: Date.now() - startTime
      };
    }

    // Build invocation instruction for the LLM
    const invocation = this.buildInvocationInstruction(workflowInfo, decision);

    return {
      success: true,
      action: 'invoke_workflow',
      workflow: decision.workflow,
      module: decision.module || workflowInfo.module,
      workflowPath: workflowInfo.path,
      instruction: invocation,
      reasoning: decision.reasoning,
      duration: Date.now() - startTime
    };
  }

  /**
   * Find a workflow in the manifest
   */
  async findWorkflow(workflowName, preferredModule = null) {
    const manifest = await this.loadWorkflowManifest();

    // Try exact match first
    let match = manifest.find(w =>
      w.name?.toLowerCase() === workflowName.toLowerCase() &&
      (!preferredModule || w.module === preferredModule)
    );

    if (match) return match;

    // Try partial match
    match = manifest.find(w =>
      w.name?.toLowerCase().includes(workflowName.toLowerCase())
    );

    return match;
  }

  /**
   * Load the workflow manifest
   */
  async loadWorkflowManifest() {
    if (this.manifestCache.workflows) {
      return this.manifestCache.workflows;
    }

    const manifestPath = path.join(this.bmadPath, '_config', 'workflow-manifest.csv');

    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      this.manifestCache.workflows = this.parseCSV(content);
      return this.manifestCache.workflows;
    } catch (error) {
      console.warn(`Could not load workflow manifest: ${error.message}`);
      return [];
    }
  }

  /**
   * Build the instruction for LLM to execute workflow
   */
  buildInvocationInstruction(workflowInfo, decision) {
    const workflowPath = workflowInfo.path.startsWith('{project-root}')
      ? workflowInfo.path.replace('{project-root}', this.projectPath)
      : path.join(this.projectPath, workflowInfo.path);

    // Check if it's a YAML or MD workflow
    const isYamlWorkflow = workflowPath.endsWith('.yaml') || workflowPath.endsWith('.yml');

    if (isYamlWorkflow) {
      return {
        type: 'yaml_workflow',
        message: `Execute workflow using workflow.xml engine`,
        steps: [
          `1. Load workflow.xml from {project-root}/_bmad/core/tasks/workflow.xml`,
          `2. Read workflow configuration from: ${workflowPath}`,
          `3. Follow workflow.xml instructions to execute the workflow`,
          `4. Return to orchestrator when complete`
        ],
        workflowPath,
        enginePath: `${this.projectPath}/_bmad/core/tasks/workflow.xml`
      };
    } else {
      return {
        type: 'md_workflow',
        message: `Execute markdown workflow directly`,
        steps: [
          `1. Load workflow instructions from: ${workflowPath}`,
          `2. Follow the instructions in the workflow file`,
          `3. Return to orchestrator when complete`
        ],
        workflowPath
      };
    }
  }

  /**
   * Format options for presentation to user
   */
  formatOptions(decision) {
    const lines = [decision.message || 'Multiple options available:'];

    decision.options?.forEach((opt, i) => {
      const recommended = opt.recommended ? ' (Recommended)' : '';
      lines.push(`${i + 1}. ${opt.label}${recommended}`);
      if (opt.description) {
        lines.push(`   ${opt.description}`);
      }
    });

    return {
      success: true,
      action: 'present_options',
      message: lines.join('\n'),
      options: decision.options,
      requiresInput: true
    };
  }

  /**
   * Format a clarifying question
   */
  formatQuestion(decision) {
    return {
      success: true,
      action: decision.action,
      message: decision.message,
      requiresInput: true,
      fallback: decision.fallback
    };
  }

  /**
   * Show help information
   */
  async showHelp(decision) {
    const manifest = await this.loadWorkflowManifest();
    const workflows = manifest.slice(0, 10).map(w => `- ${w.name}: ${w.description || 'No description'}`);

    const helpText = [
      '## BMAD Orchestrator Help',
      '',
      '### What I Can Do',
      '- Start new projects with templates',
      '- Continue where you left off',
      '- Run specific workflows (PRD, Architecture, etc.)',
      '- Manage multiple projects',
      '- Remember errors, decisions, and lessons',
      '',
      '### Available Workflows',
      ...workflows,
      '',
      '### Quick Commands',
      '- "status" - Show current project status',
      '- "continue" - Proceed with next workflow',
      '- "projects" - List all registered projects',
      '- "switch to [project]" - Change active project',
      '',
      '### Tips',
      '- Just speak naturally - I\'ll figure out what you need',
      '- You don\'t need to know BMAD commands',
      '- Ask "what\'s next?" if you\'re unsure'
    ];

    return {
      success: true,
      action: 'help',
      message: helpText.join('\n')
    };
  }

  /**
   * Query project memory (placeholder - requires memory module)
   */
  async queryMemory(decision) {
    // This will integrate with the memory module when implemented
    return {
      success: true,
      action: 'query_memory',
      message: 'Memory module not yet available. This feature will be implemented in Phase 2.',
      types: decision.types
    };
  }

  /**
   * Add to project memory (placeholder - requires memory module)
   */
  async addToMemory(decision) {
    return {
      success: true,
      action: 'add_to_memory',
      message: 'Memory module not yet available. This feature will be implemented in Phase 2.',
      content: decision.content
    };
  }

  /**
   * Format project switch request
   */
  formatSwitchRequest(decision) {
    return {
      success: true,
      action: 'switch_project',
      projectName: decision.projectName,
      message: decision.projectName
        ? `Switching to project: ${decision.projectName}`
        : 'Which project would you like to switch to?',
      requiresInput: !decision.projectName
    };
  }

  /**
   * Parse CSV content
   */
  parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    return lines.slice(1).map(line => {
      const values = this.parseCSVLine(line);
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = values[i]?.trim().replace(/^"|"$/g, '');
      });
      return obj;
    });
  }

  /**
   * Parse CSV line handling quoted values
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    return values;
  }
}

module.exports = { Executor };
