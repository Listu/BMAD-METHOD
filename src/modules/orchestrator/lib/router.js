/**
 * BMAD Orchestrator - Intelligent Router
 *
 * Combines intent detection with project state to route
 * user requests to the appropriate BMAD workflow.
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const { IntentDetector } = require('./intent');
const { ProjectRegistry } = require('./registry');

/**
 * Routing decision
 * @typedef {Object} RoutingDecision
 * @property {string} action - What to do (invoke, present_options, clarify, etc.)
 * @property {string} [workflow] - Target workflow if action is invoke
 * @property {string} [module] - Module containing the workflow
 * @property {Object} [options] - Options to present if action is present_options
 * @property {string} [message] - Message to show user
 * @property {number} confidence - Confidence in this decision
 * @property {string} reasoning - Explanation for this decision
 */

class Router {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.intentDetector = new IntentDetector(options.dataPath);
    this.registry = options.registry || new ProjectRegistry();
    this.routingRules = null;
    this.workflowManifest = null;
  }

  /**
   * Initialize router with required data
   */
  async init() {
    await this.intentDetector.init();

    // Load routing rules
    const rulesPath = path.join(__dirname, '..', 'data', 'routing-rules.yaml');
    const rulesContent = await fs.readFile(rulesPath, 'utf8');
    this.routingRules = yaml.parse(rulesContent);

    // Load workflow manifest
    await this.loadWorkflowManifest();
  }

  /**
   * Load the workflow manifest CSV
   */
  async loadWorkflowManifest() {
    const manifestPath = path.join(
      this.projectPath,
      '_bmad',
      '_config',
      'workflow-manifest.csv'
    );

    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      this.workflowManifest = this.parseManifestCSV(content);
    } catch (error) {
      console.warn(`Could not load workflow manifest: ${error.message}`);
      this.workflowManifest = [];
    }
  }

  /**
   * Route a user request to the appropriate workflow
   * @param {string} input - User's natural language input
   * @returns {RoutingDecision}
   */
  async route(input) {
    if (!this.routingRules) await this.init();

    // 1. Detect intent
    const intent = await this.intentDetector.detectIntent(input);

    // 2. Get project state
    const state = await this.getProjectState();

    // 3. Apply routing rules
    const decision = await this.applyRoutingRules(intent, state);

    // 4. Validate and enhance decision
    return this.enhanceDecision(decision, intent, state);
  }

  /**
   * Get current project state from workflow-status.yaml
   */
  async getProjectState() {
    const statusPaths = [
      path.join(this.projectPath, '_bmad-output', 'planning-artifacts', 'bmm-workflow-status.yaml'),
      path.join(this.projectPath, '_bmad-output', 'planning-artifacts', 'workflow-status.yaml')
    ];

    for (const statusPath of statusPaths) {
      try {
        const content = await fs.readFile(statusPath, 'utf8');
        return {
          exists: true,
          ...yaml.parse(content)
        };
      } catch {
        // Try next path
      }
    }

    return { exists: false };
  }

  /**
   * Apply routing rules based on intent and state
   */
  async applyRoutingRules(intent, state) {
    const rules = this.routingRules.routing_rules[intent.category];
    if (!rules) {
      return this.handleUnknownIntent(intent);
    }

    // Check confidence thresholds
    const thresholds = this.routingRules.thresholds;
    if (intent.confidence < thresholds.suggest) {
      return {
        action: 'clarify',
        message: rules.low_confidence?.question ||
          "I'm not sure I understand. Could you rephrase?",
        confidence: intent.confidence,
        reasoning: `Low confidence (${(intent.confidence * 100).toFixed(0)}%) - asking for clarification`
      };
    }

    // State-aware routing
    const stateKey = state.exists ? 'has_status_file' : 'no_status_file';
    const stateRule = rules[stateKey] || rules;

    switch (stateRule.action) {
      case 'invoke':
        return {
          action: 'invoke',
          workflow: stateRule.workflow,
          module: stateRule.module || 'bmm',
          confidence: intent.confidence,
          reasoning: `Routing to ${stateRule.workflow} based on ${intent.category} intent`
        };

      case 'route_to_next':
        return this.findNextWorkflow(state);

      case 'fuzzy_match':
        return this.fuzzyMatchWorkflow(intent);

      case 'warn':
        return {
          action: 'present_options',
          message: stateRule.message,
          options: stateRule.options,
          confidence: intent.confidence,
          reasoning: 'Project exists - presenting options'
        };

      case 'query_memory':
        return {
          action: 'query_memory',
          types: stateRule.types,
          confidence: intent.confidence,
          reasoning: 'Memory query requested'
        };

      case 'add_to_memory':
        return {
          action: 'add_to_memory',
          content: intent.entities.target || intent.raw_input,
          confidence: intent.confidence,
          reasoning: 'Adding note to memory'
        };

      case 'switch_context':
        return {
          action: 'switch_project',
          projectName: intent.entities.projectName,
          confidence: intent.confidence,
          reasoning: `Switching to project: ${intent.entities.projectName}`
        };

      case 'display_capabilities':
        return {
          action: 'help',
          include: stateRule.include,
          confidence: 1.0,
          reasoning: 'Displaying help information'
        };

      default:
        return this.handleUnknownIntent(intent);
    }
  }

  /**
   * Find the next workflow based on project state
   */
  findNextWorkflow(state) {
    if (!state.exists || !state.workflow_status) {
      return {
        action: 'invoke',
        workflow: 'workflow-init',
        module: 'bmm',
        confidence: 0.9,
        reasoning: 'No workflow status found - starting workflow initialization'
      };
    }

    // Find first incomplete required workflow
    for (const phase of state.workflow_status || []) {
      for (const wf of phase.workflows || []) {
        if (wf.status === 'required' || wf.status === 'recommended') {
          return {
            action: 'invoke',
            workflow: wf.id,
            module: wf.module || 'bmm',
            confidence: 0.85,
            reasoning: `Next required workflow in phase ${phase.name}: ${wf.id}`
          };
        }
      }
    }

    return {
      action: 'invoke',
      workflow: 'workflow-status',
      module: 'bmm',
      confidence: 0.8,
      reasoning: 'All workflows complete - showing status'
    };
  }

  /**
   * Fuzzy match against workflow manifest
   */
  fuzzyMatchWorkflow(intent) {
    if (!this.workflowManifest || this.workflowManifest.length === 0) {
      return {
        action: 'clarify',
        message: 'No workflows available. Is BMAD installed correctly?',
        confidence: 0,
        reasoning: 'Empty workflow manifest'
      };
    }

    const searchTerm = intent.entities.workflowType ||
                       intent.entities.target ||
                       intent.raw_input;

    const matches = this.workflowManifest
      .filter(wf => {
        const name = wf.name?.toLowerCase() || '';
        const desc = wf.description?.toLowerCase() || '';
        const term = searchTerm.toLowerCase();
        return name.includes(term) || desc.includes(term) || term.includes(name);
      })
      .slice(0, 5);

    if (matches.length === 0) {
      return {
        action: 'clarify',
        message: `I couldn't find a workflow matching "${searchTerm}". What would you like to do?`,
        confidence: 0.3,
        reasoning: 'No workflow matches found'
      };
    }

    if (matches.length === 1) {
      return {
        action: 'invoke',
        workflow: matches[0].name,
        module: matches[0].module,
        workflowPath: matches[0].path,
        confidence: intent.confidence * 0.9,
        reasoning: `Single match found: ${matches[0].name}`
      };
    }

    return {
      action: 'present_options',
      message: `I found ${matches.length} matching workflows:`,
      options: matches.map(m => ({
        label: m.name,
        description: m.description,
        workflow: m.name,
        module: m.module,
        path: m.path
      })),
      confidence: intent.confidence * 0.7,
      reasoning: 'Multiple workflow matches - presenting options'
    };
  }

  /**
   * Handle unknown or very low confidence intents
   */
  handleUnknownIntent(intent) {
    if (intent.confidence > 0.3 && intent.alternatives?.length > 0) {
      return {
        action: 'confirm',
        message: `I think you want to ${intent.category}. Is that right?`,
        fallback: intent.alternatives[0],
        confidence: intent.confidence,
        reasoning: 'Medium confidence - asking for confirmation'
      };
    }

    return {
      action: 'clarify',
      message: "I'm not sure what you'd like to do. You can:\n" +
               "- Start a new project\n" +
               "- Continue with the current workflow\n" +
               "- Ask for status\n" +
               "- Request a specific workflow (like 'create PRD')",
      confidence: 0,
      reasoning: 'Unknown intent - showing available actions'
    };
  }

  /**
   * Enhance decision with additional context
   */
  enhanceDecision(decision, intent, state) {
    return {
      ...decision,
      intent,
      projectState: {
        hasStatus: state.exists,
        currentPhase: state.current_phase,
        projectName: state.project_name
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Parse workflow manifest CSV
   */
  parseManifestCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());

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

module.exports = { Router };
