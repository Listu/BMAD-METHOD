# Step 3: Check State

## Purpose

Read the current project state to inform routing decisions.

## Input

- Detected intent (from step-02)
- Active project path

## Process

1. **Locate Status File**
   - Check: `_bmad-output/planning-artifacts/bmm-workflow-status.yaml`
   - Fallback: `_bmad-output/planning-artifacts/workflow-status.yaml`

2. **Parse Status (if exists)**
   ```yaml
   exists: true
   project_type: "product" | "game" | "library" | ...
   selected_track: "method" | "quickflow"
   current_phase: 1-4
   workflow_status:
     - phase: 1
       name: "Analysis"
       workflows:
         - id: "brainstorm"
           status: "done" | "required" | "optional" | "skipped"
   ```

3. **No Status File**
   ```yaml
   exists: false
   ```

4. **Detect Project Type** (if no status)
   - Check for game files (project.godot, etc.)
   - Check for package.json (Node.js)
   - Check for existing BMAD artifacts

## Output

```yaml
project_state:
  exists: boolean
  project_type: string | null
  selected_track: string | null
  current_phase: number | null
  next_required_workflow: string | null
  completed_workflows: [string, ...]
  pending_workflows: [string, ...]
```

## Next Step

→ step-04-route.md
