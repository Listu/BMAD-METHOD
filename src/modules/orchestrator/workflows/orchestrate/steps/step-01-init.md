# Step 1: Initialize

## Purpose

Load configuration, check for active project, and prepare for intent detection.

## Actions

1. **Load Core Config**
   - Read `{project-root}/_bmad/core/config.yaml`
   - Extract: user_name, communication_language

2. **Load Orchestrator Config**
   - Read `{project-root}/_bmad/orchestrator/config.yaml` (if exists)
   - Extract: registry_path, memory_enabled, quality_gate_enabled

3. **Initialize Registry**
   - Check `~/.bmad/registry.yaml` exists
   - Create default if not exists
   - Load active project

4. **Check Current Context**
   - Determine if running in a BMAD project directory
   - If yes, auto-register if not already in registry
   - Set as active project context

## Output

- Config loaded into memory
- Registry initialized
- Active project determined
- Ready for user input

## Next Step

→ step-02-detect-intent.md (when user provides input)
