const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');

/**
 * Claude Code Platform-Specific Installer for Orchestrator
 *
 * Configures the orchestrator for Claude Code CLI usage
 */
async function install(options) {
  const { projectRoot, config, logger } = options;

  logger.log(chalk.cyan('  Configuring Orchestrator for Claude Code...'));

  // Add orchestrator slash command to Claude Code settings
  await addOrchestratorCommand(projectRoot, logger);

  // Create the orchestrator skill file
  await createOrchestratorSkill(projectRoot, logger);

  logger.log(chalk.green('  ✓ Claude Code configuration complete'));
}

/**
 * Add orchestrator command to Claude Code settings
 */
async function addOrchestratorCommand(projectRoot, logger) {
  const settingsDir = path.join(projectRoot, '.claude');
  const settingsFile = path.join(settingsDir, 'settings.json');

  try {
    // Ensure .claude directory exists
    await fs.ensureDir(settingsDir);

    let settings = {};

    // Load existing settings if they exist
    if (await fs.pathExists(settingsFile)) {
      const content = await fs.readFile(settingsFile, 'utf8');
      settings = JSON.parse(content);
    }

    // Initialize projectSettings if not present
    settings.projectSettings = settings.projectSettings || {};
    settings.projectSettings.bmad = settings.projectSettings.bmad || {};
    settings.projectSettings.bmad.orchestrator = settings.projectSettings.bmad.orchestrator || {};
    settings.projectSettings.bmad.orchestrator.workflows = settings.projectSettings.bmad.orchestrator.workflows || {};

    // Add orchestrate workflow as a skill
    if (!settings.projectSettings.bmad.orchestrator.workflows.orchestrate) {
      settings.projectSettings.bmad.orchestrator.workflows.orchestrate = [
        {
          type: 'text',
          text: `IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS:

You are the BMAD Orchestrator - a super-agent that helps users interact with BMAD using natural language.

## Your Role
1. Listen to what the user wants to do
2. Detect their intent (continue project, start new, check status, etc.)
3. Route them to the appropriate BMAD workflow
4. If unclear, ask clarifying questions

## Available Actions
- **continue**: Resume work on current project → check workflow-status → route to next workflow
- **new project**: Start a new project → route to workflow-init or project templates
- **status**: Show project status → route to workflow-status
- **help**: Explain BMAD and available workflows
- **switch project**: Change active project in registry
- **memory**: Query or add to project memory

## How to Respond
- Be conversational and helpful
- Don't require users to know BMAD terminology
- Suggest next steps based on project state
- When routing, load the target workflow using the Skill tool

## Project Context
- Check for _bmad/workflow-status.yaml to understand project state
- Check for _bmad/project.yaml for project configuration

Begin by greeting the user and asking what they'd like to work on, or check their current project status.
`
        }
      ];

      logger.log(chalk.yellow('    Added /orchestrate skill'));
    }

    // Add alias commands
    const aliases = ['orch', 'o'];
    for (const alias of aliases) {
      settings.projectSettings.bmad.orchestrator.workflows[alias] =
        settings.projectSettings.bmad.orchestrator.workflows.orchestrate;
    }

    // Write updated settings
    await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf8');

  } catch (error) {
    logger.warn(chalk.yellow(`    Could not update Claude Code settings: ${error.message}`));
  }
}

/**
 * Create orchestrator skill markdown file
 */
async function createOrchestratorSkill(projectRoot, logger) {
  const skillDir = path.join(projectRoot, '_bmad', 'orchestrator');
  const skillFile = path.join(skillDir, 'orchestrate.md');

  await fs.ensureDir(skillDir);

  const skillContent = `# BMAD Orchestrator

You are the BMAD Orchestrator - a super-agent that helps users interact with BMAD using natural language.

## Your Role
1. Listen to what the user wants to do
2. Detect their intent (continue project, start new, check status, etc.)
3. Route them to the appropriate BMAD workflow
4. If unclear, ask clarifying questions

## Quick Commands
- "continue" / "keep going" → Resume current project
- "status" / "where am I" → Show project status
- "new project" → Start fresh
- "help" → Explain BMAD

## Routing Logic
1. Check \`_bmad/workflow-status.yaml\` for current state
2. Determine next workflow based on intent + state
3. Load the target workflow using the Skill tool

## Example Routing
| User Says | Intent | Route To |
|-----------|--------|----------|
| "Continue my app" | continue | workflow-status → next pending |
| "Start a new API" | new_project | workflow-init |
| "What's next?" | status | workflow-status |
| "Create the PRD" | specific_workflow | create-prd |

Begin by greeting the user!
`;

  await fs.writeFile(skillFile, skillContent, 'utf8');
  logger.log(chalk.yellow('    Created orchestrator skill file'));
}

module.exports = { install };
