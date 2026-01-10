# Step 4: Route

## Purpose

Combine intent and state to determine the appropriate action.

## Input

- Detected intent (from step-02)
- Project state (from step-03)

## Routing Logic

### By Intent Category

**new_project:**
- No status → Invoke `workflow-init`
- Has status → Present options (continue existing or start fresh)

**continue:**
- No status → Invoke `workflow-init`
- Has status → Route to next required workflow from status

**specific_workflow:**
- Fuzzy match against `workflow-manifest.csv`
- Single match → Invoke directly
- Multiple matches → Present options with recommendations
- No match → Suggest similar or ask for clarification

**status:**
- Invoke `workflow-status` in interactive mode

**help:**
- Display available capabilities
- Show current project state
- Suggest next actions

**memory_query:**
- Query per-project memory
- Display errors, decisions, lessons

**memory_add:**
- Add note to project memory
- Confirm addition

**switch_project:**
- Look up project in registry
- Switch active context
- Not found → Offer discovery

## Confidence Handling

| Confidence | Action |
|------------|--------|
| >= 0.85 | Route automatically |
| >= 0.60 | Route with confirmation ("I think you want to... Is that right?") |
| < 0.60 | Ask for clarification |

## Output

```yaml
routing_decision:
  action: "invoke" | "present_options" | "clarify" | "confirm" | "help"
  workflow: "workflow-id" (if invoke)
  module: "bmm" | "bmgd" | "orchestrator"
  options: [...] (if present_options)
  message: "string" (user-facing message)
  confidence: 0.0-1.0
  reasoning: "why this decision was made"
```

## Next Step

→ step-05-execute.md
