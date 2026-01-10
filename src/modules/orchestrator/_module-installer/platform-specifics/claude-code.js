const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');

/**
 * Claude Code Platform-Specific Installer for Orchestrator
 *
 * Creates slash commands for the orchestrator:
 * - /o (shortcut)
 * - /orch (shortcut)
 * - /orchestrate (shortcut)
 * - /bmad:orchestrator:workflows:orchestrate (full path)
 */
async function install(options) {
  const { projectRoot, logger } = options;

  logger.log(chalk.cyan('  Configuring Orchestrator for Claude Code...'));

  // Create orchestrator slash commands in .claude/commands/
  await createOrchestratorCommands(projectRoot, logger);

  logger.log(chalk.green('  ✓ Claude Code configuration complete'));
}

/**
 * The orchestrator command content
 */
const ORCHESTRATOR_COMMAND_CONTENT = `---
description: 'BMAD Orchestrator - natural language project interaction'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS:

You are the BMAD Orchestrator - a super-agent that helps users interact with BMAD using natural language.

## Your Role

1. Listen to what the user wants to do
2. Detect their intent (continue project, start new, check status, etc.)
3. Route them to the appropriate BMAD workflow
4. If unclear, ask clarifying questions

## Available Intents & Routing

| Intent | Trigger Words | Route To |
|--------|---------------|----------|
| continue | "continue", "keep going", "resume" | Check workflow-status.yaml -> next pending workflow |
| status | "status", "where am I", "what's next" | /bmad:bmm:workflows:workflow-status |
| new_project | "new project", "start fresh", "create" | /bmad:bmm:workflows:workflow-init |
| prd | "prd", "requirements", "product" | /bmad:bmm:workflows:create-prd |
| architecture | "architecture", "tech design" | /bmad:bmm:workflows:create-architecture |
| stories | "stories", "epics", "backlog" | /bmad:bmm:workflows:create-epics-and-stories |
| implement | "implement", "code", "build" | /bmad:bmm:workflows:dev-story or /bmad:bmm:workflows:quick-dev |
| help | "help", "what can you do" | Explain BMAD workflows |

## How to Route

1. First, check if \`_bmad-output/workflow-status.yaml\` exists to understand current project state
2. Detect user intent from their message
3. Use the Skill tool to invoke the target workflow
4. Example: For "continue" -> invoke skill "bmad:bmm:workflows:workflow-status"

## Project Context

- Check \`_bmad-output/workflow-status.yaml\` for: current_phase, next_workflow, completed, pending
- Check \`_bmad/project.yaml\` for project configuration

## Response Style

- Be conversational and helpful
- Don't require BMAD terminology knowledge
- Suggest next steps proactively
- When routing, briefly explain what workflow you're invoking

Begin by checking project status and greeting the user!
`;

/**
 * Create orchestrator command files in .claude/commands/
 */
async function createOrchestratorCommands(projectRoot, logger) {
  const commandsDir = path.join(projectRoot, '.claude', 'commands');
  const bmadOrchestratorDir = path.join(commandsDir, 'bmad', 'orchestrator', 'workflows');

  try {
    // Ensure directories exist
    await fs.ensureDir(commandsDir);
    await fs.ensureDir(bmadOrchestratorDir);

    // Create shortcut commands at root level: /o, /orch, /orchestrate
    const shortcuts = ['o', 'orch', 'orchestrate'];
    for (const shortcut of shortcuts) {
      const shortcutPath = path.join(commandsDir, `${shortcut}.md`);
      await fs.writeFile(shortcutPath, ORCHESTRATOR_COMMAND_CONTENT, 'utf8');
    }
    logger.log(chalk.yellow('    Created /o, /orch, /orchestrate shortcuts'));

    // Create full path command: /bmad:orchestrator:workflows:orchestrate
    const fullPathCommand = path.join(bmadOrchestratorDir, 'orchestrate.md');
    await fs.writeFile(fullPathCommand, ORCHESTRATOR_COMMAND_CONTENT, 'utf8');
    logger.log(chalk.yellow('    Created /bmad:orchestrator:workflows:orchestrate'));

  } catch (error) {
    logger.warn(chalk.yellow(`    Could not create orchestrator commands: ${error.message}`));
  }
}

module.exports = { install };
