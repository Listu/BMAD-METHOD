# Step 2: Detect Intent

## Purpose

Analyze the user's natural language input to determine what they want to achieve.

## Input

- User's natural language message
- Current project context (from step-01)

## Process

1. **Normalize Input**
   - Convert to lowercase
   - Trim whitespace
   - Handle multi-language input

2. **Pattern Matching**
   - Check against known patterns from `intent-categories.csv`
   - Look for exact matches first
   - Then partial/fuzzy matches

3. **Keyword Detection**
   - Scan for workflow-related keywords from `routing-rules.yaml`
   - Match against workflow names and descriptions

4. **Heuristic Analysis**
   - Detect question patterns (?, what, how, where)
   - Detect action patterns (create, make, build)
   - Detect continuation patterns (continue, next, go)

5. **Entity Extraction**
   - Project names (quoted or after "project")
   - Workflow types (prd, architecture, etc.)
   - Target specifications

## Output

```yaml
intent:
  category: "specific_workflow" | "continue" | "status" | ...
  confidence: 0.0-1.0
  entities:
    projectName: "string" | null
    workflowType: "string" | null
    target: "string" | null
  alternatives: ["other_category", ...]
  raw_input: "original user message"
```

## Decision Points

- **Confidence >= 0.85**: Proceed to routing
- **Confidence >= 0.60**: Proceed with confirmation
- **Confidence < 0.60**: Ask for clarification

## Next Step

→ step-03-check-state.md
