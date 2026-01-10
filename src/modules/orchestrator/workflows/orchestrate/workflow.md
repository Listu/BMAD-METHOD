# Orchestrate Workflow

This is the main entry point for the BMAD Orchestrator. It processes natural language input and routes to the appropriate BMAD workflow.

## Overview

The orchestrate workflow:
1. Receives natural language input from the user
2. Detects the user's intent
3. Checks the current project state
4. Routes to the appropriate workflow or takes action

## How It Works

```
User Input → Intent Detection → State Check → Routing Decision → Action
```

## Usage

Simply talk to the orchestrator in natural language:

- "Start a new web app project"
- "Continue where I left off"
- "Create a PRD"
- "What's the status?"
- "Switch to project X"

The orchestrator will understand your intent and route you to the right place.

## Steps

1. **Init** - Load configuration and check for active project
2. **Detect Intent** - Analyze user input to understand what they want
3. **Check State** - Read workflow-status.yaml to understand project state
4. **Route** - Match intent + state to determine action
5. **Execute** - Invoke the target workflow or take action

## Configuration

The orchestrator uses:
- `~/.bmad/registry.yaml` - Multi-project registry
- `_bmad/orchestrator/config.yaml` - Module configuration
- `_bmad/orchestrator/data/routing-rules.yaml` - Routing logic
