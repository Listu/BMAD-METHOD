# Step 5: Execute

## Purpose

Execute the routing decision - invoke workflows, present options, or interact with the user.

## Input

- Routing decision (from step-04)
- Active project context

## Actions by Decision Type

### invoke

1. Load target agent from `agent-manifest.csv`
2. Load target workflow from `workflow-manifest.csv`
3. Invoke workflow via `workflow.xml` execution engine
4. Monitor for completion or errors
5. On completion → Update workflow-status.yaml

```
Agent: "I'm starting the {workflow_name} workflow for you."
→ Invoke {module}/{workflow}
→ Workflow executes
→ Return to orchestrator on completion
```

### present_options

1. Display options to user in numbered list
2. Include recommendations (marked with ✓)
3. Wait for user selection
4. Route to selected option

```
Agent: "{message}"
1. {option_1.label} - {option_1.description}
2. {option_2.label} ✓ (Recommended) - {option_2.description}
3. {option_3.label} - {option_3.description}

User selects → Re-route with selection
```

### clarify

1. Display clarifying question
2. Provide helpful suggestions
3. Wait for user response
4. Re-process from step-02

```
Agent: "{message}"
Suggestions:
- Start a new project
- Continue with current work
- Check status

User responds → Back to step-02-detect-intent
```

### confirm

1. Display best guess with confirmation
2. Wait for yes/no
3. Yes → Execute as invoke
4. No → Ask for clarification

```
Agent: "I think you want to {best_guess}. Is that right?"
User: Yes → Invoke
User: No → Clarify
```

### help

1. Display orchestrator capabilities
2. Show current project context
3. List available workflows
4. Suggest next actions based on state

## Post-Execution

After any workflow completes:
1. Check Quality Gate (if enabled)
   - Run build
   - Run tests
   - Report results
2. Update workflow-status.yaml
3. Extract learnings for memory (if auto-retention enabled)
4. Return to orchestrator idle state

## Loop

The orchestrator stays active, waiting for the next user input.
Each input cycles through steps 2-5.

## Exit Conditions

- User explicitly exits ("quit", "exit", "done for now")
- Session timeout
- Error that cannot be recovered
