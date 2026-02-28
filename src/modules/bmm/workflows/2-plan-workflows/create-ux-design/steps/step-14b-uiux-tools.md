# Step 14b: Visual Mockups & Design System Generation

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 BOTH PHASES SHOULD BE EXECUTED — gracefully skip a phase only if its required MCP/skill is confirmed unavailable (see FAILURE MODES)

- 📖 CRITICAL: ALWAYS read the complete step file before taking any action - partial understanding leads to incomplete decisions
- 🔄 CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- 🎨 THIS IS A TECHNICAL GENERATION STEP — execute both phases autonomously, no collaborative menu loops
- 📋 Phase A creates visual .pen mockups; Phase B generates implementation-ready design system rules
- 💾 ONLY proceed to next step after both phases complete successfully
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- 🎯 Execute Phase A fully before starting Phase B
- ⚠️ Present [C] Continue menu only AFTER both phases are complete
- 💾 Update output file frontmatter by appending `"14b"` to stepsCompleted array
- 📖 Append generated content to the UX design specification document
- 🚫 FORBIDDEN to load next step until [C] is selected

## CONTEXT BOUNDARIES:

- Complete UX design specification from all previous steps is available
- Design system choice from step-6 informs Pencil style guide selection
- Stack and platform from step-3 informs guidelines topic selection
- User journeys from step-10 identify which screens to mockup
- Visual foundation (colors, typography) from step-8 informs design decisions

## YOUR TASK:

Generate visual Pencil mockups of the key screens AND produce implementation-ready design system rules using ui-ux-pro-max. Both outputs are appended to the UX design specification.

---

## PHASE A: VISUAL MOCKUPS (Pencil MCP)

### Step 0: Pencil MCP Preflight

Before proceeding with Phase A, verify that the Pencil MCP server is available by calling `mcp__pencil__get_style_guide_tags`. If the call fails or the tool is unavailable:
- Output: `⚠️ Pencil MCP not available — visual mockup generation skipped. Phase B (ui-ux-pro-max) will still execute.`
- Skip the remaining steps of Phase A and proceed directly to Phase B.

### Step 1: Determine Project Type

From the UX design specification (step-3 platform requirements and step-6 design system choice), determine the project type:
- Web application / SaaS dashboard → use `topic="web-app"`
- Marketing / landing page → use `topic="landing-page"`
- Mobile application → use `topic="mobile-app"`

### Step 2: Load Design Guidelines

Call `mcp__pencil__get_guidelines` with the determined topic to load layout and design rules.

### Step 3: Select Style Guide

1. Call `mcp__pencil__get_style_guide_tags` to retrieve available tags
2. Select 5-8 tags relevant to the project (match aesthetic from step-8: colors, typography, emotional tone from step-4)
3. Call `mcp__pencil__get_style_guide(tags=[...])` to retrieve the matching style guide

### Step 4: Open New Document

Call `mcp__pencil__open_document("new")` to open a fresh Pencil canvas.

Then immediately call `mcp__pencil__get_editor_state(include_schema=false)` to retrieve the `filePath` of the opened document. Store this as `{pen_file_path}`.

### Step 5: Create Key Screens

Using the user journeys (step-10) and component strategy (step-11), identify the 2-3 most critical screens/views to mockup (e.g., main dashboard, primary form, key landing section).

For each screen, call `mcp__pencil__batch_design(filePath={pen_file_path}, operations=...)` to build the layout. Follow the guidelines loaded in Step 2 and the style guide from Step 3.

After creating all screens, call `mcp__pencil__get_screenshot(filePath={pen_file_path}, nodeId=...)` on the root or key screen node to capture a preview.

### Step 6: Communicate Pencil Output

Inform the user:
"🎨 **Visual Mockups Created**

Pencil file: `{pen_file_path}`

Screens generated:
- [list of screen names created]

You can open this file in the Pencil editor to review and iterate on the mockups."

---

## PHASE B: DESIGN SYSTEM IMPLEMENTATION (ui-ux-pro-max)

### Step 7: Invoke ui-ux-pro-max Skill

Use the Skill tool to invoke the skill `ui-ux-pro-max:ui-ux-pro-max`.

If the skill invocation fails or is unavailable:
- Output: `⚠️ ui-ux-pro-max skill not available — design system generation skipped. Phase A results (if any) are still saved.`
- Skip Step 8 and proceed to UPDATE FRONTMATTER.

Provide as context (concise — do NOT paste the full spec):
- Project type (web app / landing page / mobile)
- Design system chosen (from step-6)
- Tech stack (framework from step-3)
- Primary color palette (from step-8)
- Typography choices (from step-8)
- Key components needed (from step-11 component list)

### Step 8: Append Design System Rules to Specification

Take the output from ui-ux-pro-max (CSS custom properties, utility classes, component tokens, or framework-specific recommendations) and append it to the UX design specification document as a new section:

```markdown
## Design System Implementation

### Generated by ui-ux-pro-max

[ui-ux-pro-max output — CSS tokens, component classes, design rules]
```

---

## UPDATE FRONTMATTER

After both phases complete, update the UX design specification frontmatter:
- Append `"14b"` to the `stepsCompleted` array

---

## PRESENT COMPLETION MENU

Show the user what was accomplished and present the continuation option:

"✅ **Visual Tools Phase Complete**

**Phase A — Pencil Mockups:**
- File: `{pen_file_path}`
- Screens created: [count]

**Phase B — Design System Rules:**
- Section `## Design System Implementation` added to UX spec
- Framework-specific tokens and component guidelines generated

**What would you like to do?**
[C] Continue — finalize the UX design workflow"

**HALT and wait for user selection.**

### Menu Handling:

#### If 'C' (Continue):
- Verify frontmatter updated with `"14b"` in stepsCompleted
- Load `./step-14-complete.md`

---

## SUCCESS METRICS:

✅ Project type correctly determined from spec context
✅ Pencil guidelines and style guide loaded
✅ New Pencil document opened, filePath retrieved
✅ 2-3 key screens created via batch_design
✅ Screenshot captured of Pencil result
✅ Pencil file path communicated to user
✅ ui-ux-pro-max skill invoked with minimal focused context
✅ `## Design System Implementation` section appended to UX spec
✅ Frontmatter stepsCompleted updated with `"14b"`
✅ [C] menu presented and handled correctly

## FAILURE MODES:

❌ Skipping Phase A (Pencil) and going straight to Phase B
❌ Skipping Phase B (ui-ux-pro-max) after Pencil
❌ Passing the full UX specification as context to ui-ux-pro-max (too verbose — use minimal context)
❌ Not calling get_editor_state after open_document (filePath required for all subsequent Pencil calls)
❌ Proceeding to step-14-complete without user selecting [C]
❌ Not appending Design System Implementation section to the UX spec document
❌ `mcp__pencil__get_screenshot` failure is non-blocking — log warning and continue; do NOT abort Phase A for a failed screenshot

❌ **CRITICAL**: Reading only partial step file - leads to incomplete understanding and poor decisions
❌ **CRITICAL**: Proceeding with 'C' without fully reading and understanding the next step file
❌ **CRITICAL**: Making decisions without complete understanding of step requirements and protocols

## NEXT STEP:

After user selects 'C' and both phases are complete, load `./step-14-complete.md` to finalize the UX design workflow.

Remember: Do NOT proceed to step-14-complete until BOTH phases are done AND user explicitly selects 'C'!
