#!/usr/bin/env node
/**
 * Quick setup script to add /orchestrate command to Claude Code
 *
 * Usage: node src/modules/orchestrator/setup-command.js
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const settingsDir = path.join(projectRoot, '.claude');
const settingsFile = path.join(settingsDir, 'settings.json');

// Ensure .claude directory exists
if (!fs.existsSync(settingsDir)) {
  fs.mkdirSync(settingsDir, { recursive: true });
}

// Load or create settings
let settings = {};
if (fs.existsSync(settingsFile)) {
  settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
}

// Initialize structure
settings.projectSettings = settings.projectSettings || {};
settings.projectSettings.bmad = settings.projectSettings.bmad || {};
settings.projectSettings.bmad.orchestrator = settings.projectSettings.bmad.orchestrator || {};
settings.projectSettings.bmad.orchestrator.workflows = settings.projectSettings.bmad.orchestrator.workflows || {};

// The orchestrator skill prompt
const orchestratorSkill = [
  {
    type: 'text',
    text: `IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS:

You are the BMAD Orchestrator - a super-agent that helps users interact with BMAD using natural language.

## Your Role
1. Listen to what the user wants to do
2. Detect their intent (continue project, start new, check status, etc.)
3. Route them to the appropriate BMAD workflow
4. If unclear, ask clarifying questions

## Available Intents & Routing
| Intent | Trigger Words | Route To |
|--------|---------------|----------|
| continue | "continue", "keep going", "resume" | Check workflow-status.yaml → next pending workflow |
| status | "status", "where am I", "what's next" | /workflow-status |
| new_project | "new project", "start fresh", "create" | /workflow-init |
| prd | "prd", "requirements", "product" | /create-prd |
| architecture | "architecture", "tech design" | /create-architecture |
| stories | "stories", "epics", "backlog" | /create-epics-and-stories |
| implement | "implement", "code", "build" | /dev-story or /quick-dev |
| help | "help", "what can you do" | Explain BMAD workflows |

## How to Route
1. First, check _bmad/workflow-status.yaml if it exists
2. Detect user intent from their message
3. Use the Skill tool to invoke the target workflow
4. Example: For "continue" → invoke skill "bmad:bmm:workflows:workflow-status"

## Project Context
- Check _bmad/workflow-status.yaml for: current_phase, next_workflow, completed, pending
- Check _bmad/project.yaml for project configuration

## Response Style
- Be conversational and helpful
- Don't require BMAD terminology knowledge
- Suggest next steps proactively
- When routing, briefly explain what workflow you're invoking

Begin by checking project status and greeting the user!
`
  }
];

// Add the skill
settings.projectSettings.bmad.orchestrator.workflows.orchestrate = orchestratorSkill;

// Add aliases
settings.projectSettings.bmad.orchestrator.workflows.orch = orchestratorSkill;
settings.projectSettings.bmad.orchestrator.workflows.o = orchestratorSkill;

// Write settings
fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

console.log('✅ Orchestrator command added!');
console.log('');
console.log('You can now use these commands in Claude Code:');
console.log('  /orchestrate  - Full orchestrator');
console.log('  /orch         - Short alias');
console.log('  /o            - Quick alias');
console.log('');
console.log('Restart Claude Code or start a new session to use them.');
