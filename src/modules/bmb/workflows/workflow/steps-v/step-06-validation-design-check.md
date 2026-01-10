---
name: 'step-06-validation-design-check'
description: 'Check if workflow has proper validation steps that load validation data (if validation is critical)'

nextStepFile: './step-07-instruction-style-check.md'
targetWorkflowPath: '{bmb_creations_output_folder}/workflows/{new_workflow_name}'
validationReportFile: '{targetWorkflowPath}/validation-report-{new_workflow_name}.md'
workflowPlanFile: '{targetWorkflowPath}/workflow-plan-{new_workflow_name}.md'
trimodalWorkflowStructure: '../data/trimodal-workflow-structure.md'
---

# Validation Step 6: Validation Design Check

## STEP GOAL:

To check if the workflow has proper validation steps when validation is critical - validation steps should load from validation data and perform systematic checks.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 DO NOT BE LAZY - LOAD AND REVIEW EVERY FILE
- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step, ensure entire file is read
- ✅ Validation does NOT stop for user input - auto-proceed through all validation steps

### Step-Specific Rules:

- 🎯 Check if workflow needs validation steps
- 🚫 DO NOT skip any validation step reviews
- 💬 Append findings to report, then auto-load next step
- 🚪 This is validation - systematic and thorough

## EXECUTION PROTOCOLS:

- 🎯 Determine if validation is critical for this workflow
- 💾 Check validation steps exist and are well-designed
- 📖 Append findings to validation report
- 🚫 DO NOT halt for user input - validation runs to completion

## CONTEXT BOUNDARIES:

- Some workflows need validation (compliance, safety, quality gates)
- Others don't (creative, exploratory)
- Check the design to determine if validation steps are needed

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip or shortcut.

### 1. Determine If Validation Is Critical

From {workflowPlanFile}, check:

**Does this workflow NEED validation?**

**YES - Validation Critical If:**
- Compliance/regulatory requirements (tax, legal, medical)
- Safety-critical outputs
- Quality gates required
- User explicitly requested validation steps

**NO - Validation Not Critical If:**
- Creative/exploratory workflow
- User-driven without formal requirements
- Output is user's responsibility to validate

### 2. If Validation Is Critical, Check Validation Steps

**DO NOT BE LAZY - For EACH validation step in the workflow:**

1. Find the step (usually named with "validate", "check", "review")
2. Load the step file
3. Check for:

**Proper Validation Step Design:**
- ✅ Loads validation data/standards from `data/` folder
- ✅ Has systematic check sequence (not hand-wavy)
- ✅ Auto-proceeds through checks (not stopping for each)
- ✅ Clear pass/fail criteria
- ✅ Reports findings to user

**"DO NOT BE LAZY" Language Check:**
- ✅ Step includes "DO NOT BE LAZY - LOAD AND REVIEW EVERY FILE" or similar mandate
- ✅ Step instructs to "Load and review EVERY file" not "sample files"
- ✅ Step has "DO NOT SKIP" or "DO NOT SHORTCUT" language
- ⚠️ WARNING if validation step lacks anti-lazy language

**Critical Flow Check:**
- ✅ For critical flows (compliance, safety, quality gates): validation steps are in steps-v/ folder (tri-modal)
- ✅ Validation steps are segregated from create flow
- ✅ Validation can be run independently
- ⚠️ For non-critical flows (entertainment, therapy, casual): validation may be inline
- ❌ ERROR if critical validation is mixed into create steps

### 3. Check Validation Data Files

**If workflow has validation steps:**

1. Check `data/` folder for validation data
2. Verify data files exist and are properly structured:
   - CSV files have headers
   - Markdown files have clear criteria
   - Data is referenced in step frontmatter

### 4. Document Findings

```markdown
### Validation Design Check Results

**Workflow Requires Validation:** [Yes/No]

**Workflow Domain Type:** [Critical/Compliance/Creative/Entertainment/Therapy/Casual]

**If Yes:**

**Validation Steps Found:**
- [List each validation step]

**Validation Step Quality:**
| Step | Loads Data | Systematic | Auto-proceed | DO NOT BE LAZY | Criteria | Status |
|------|-----------|------------|--------------|----------------|----------|--------|
| step-04-validate.md | ✅ | ✅ | ✅ | ✅ | ✅ Clear | ✅ PASS |
| step-07-check.md | ❌ | ⚠️ Vague | ❌ User choice each | ❌ | ❌ Unclear | ❌ FAIL |

**"DO NOT BE LAZY" Language Check:**
| Step | Has Anti-Lazy Language | Status |
|------|----------------------|--------|
| step-04-validate.md | ✅ "DO NOT BE LAZY - LOAD AND REVIEW EVERY FILE" | ✅ PASS |
| step-07-check.md | ❌ No anti-lazy language found | ⚠️ WARN |

**Critical Flow Check:**
- Workflow domain: [Critical/Creative/Therapy/etc.]
- Validation location: [steps-v/ folder / inline with create]
- For [critical] workflows: Validation is in steps-v/ ✅ / ❌ mixed in create
- Status: ✅ Properly segregated / ⚠️ Consider segregation / ❌ Should be in steps-v/

**Validation Data Files:**
- [List data files found, or note if missing]

**Issues Found:**
[List issues with validation design]

**If No (Validation Not Required):**
- Workflow is [creative/exploratory/type]
- Validation is user's responsibility
- No validation steps needed ✅

**Status:** ✅ PASS / ❌ FAIL / ⚠️ WARNINGS / N/A (not applicable)
```

### 5. Append to Report

Update {validationReportFile} - replace "## Validation Design Check *Pending...*" with actual findings.

### 6. Save Report and Auto-Proceed

**CRITICAL:** Save the validation report BEFORE loading next step.

Then immediately load, read entire file, then execute {nextStepFile}.

**Display:**
"**Validation Design check complete.** Proceeding to Instruction Style Check..."

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Determined if validation is critical
- If critical: checked all validation steps
- Validated validation step quality
- Checked validation data files
- Findings documented
- Report saved before proceeding
- Next validation step loaded

### ❌ SYSTEM FAILURE:

- Not checking validation steps when critical
- Missing validation data files
- Not documenting validation design issues
- Not saving report before proceeding

**Master Rule:** Validation is systematic and thorough. DO NOT BE LAZY. Check validation steps thoroughly. Auto-proceed through all validation steps.
