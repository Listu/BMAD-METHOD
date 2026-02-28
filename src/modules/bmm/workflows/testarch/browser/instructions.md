<!-- Powered by BMAD-CORE™ -->

# Browser Journey Testing

**Workflow ID**: `testarch-browser`
**Version**: 1.0 (BMad v6)

---

## Overview

Executes user journeys against a running application using Chrome DevTools MCP. At each step of each journey, a screenshot is captured and saved to an organized folder structure. At the end, a summary is delivered with the evidence path.

**Core Principle**: Every journey produces visual evidence. Screenshots are named for easy reading (`01-navigate-to-login.png`, `02-enter-credentials.png`, etc.). Folders are organized by date and journey slug.

---

## Preflight Requirements

**Required:**
- Chrome DevTools MCP accessible (checked in Step 1)
- A running application accessible at `{app_url}` (or URL provided interactively)

**Optional (enhance journey discovery):**
- UX design specification at `{planning_artifacts}/ux-design-specification.md`
- PRD at `{planning_artifacts}/prd.md`

**If DevTools MCP is unavailable:**
- Do NOT HALT brutally
- Display a clear warning with setup instructions (see Step 1)
- EXIT gracefully

---

## Step 1: Preflight — Verify Chrome DevTools MCP

### Actions

1. **Test DevTools availability** by calling `mcp__chrome-devtools__list_pages`.

2. **If the call succeeds** (returns page list, even if empty):
   - Confirm DevTools is available
   - Output: `✅ Chrome DevTools MCP available — [N] page(s) open`
   - Proceed to Step 2

3. **If the call fails** (tool unavailable, connection refused, or error):
   - Output the following warning and EXIT (do not continue):

```
⚠️ Chrome DevTools MCP is not available.

Browser journey testing requires Chrome to be running with remote debugging enabled
and the Chrome DevTools MCP server configured in Claude Code.

**To set up:**
1. Launch Chrome with: `google-chrome --remote-debugging-port=9222`
   (or `open -a "Google Chrome" --args --remote-debugging-port=9222` on macOS)
2. Ensure the Chrome DevTools MCP server is configured in your Claude Code MCP settings
3. Re-run this workflow once Chrome is running

Journey testing has been skipped. All other BMAD workflows remain unaffected.
```

---

## Step 2: Discover Journeys

### Actions

1. **If `{journeys}` variable is provided and non-empty** → use as-is, skip discovery

2. **If `auto_discover_journeys: true` and journeys is empty:**

   a. Check if `{planning_artifacts}/ux-design-specification.md` exists:
      - If yes: Read the file, look for a section named "User Journeys" or "User Journey Flows"
      - Extract each journey name/description as a separate journey item

   b. If not found in UX spec, check `{planning_artifacts}/prd.md`:
      - Look for user flows, user stories, or use case sections
      - Extract flow names as journey items

   c. If still no journeys found → ask the user:
      ```
      No user journeys found in planning artifacts. Please describe the journeys to test:
      (e.g., "User registration", "Login flow", "Add item to cart", "Checkout")
      ```

3. **Present journey list to user for confirmation:**
   ```
   📋 Journeys to test (N total):
   1. {journey-1}
   2. {journey-2}
   ...

   [C] Start testing
   [e] Edit journey list before starting
   ```
   Halt and wait for confirmation.

---

## Step 3: Prepare Output Structure

### Actions

1. Determine today's date in `YYYY-MM-DD` format (from `{date}`)
2. Set `run_dir` = `{screenshots_dir}/{YYYY-MM-DD}/`
3. For each journey, compute `journey_slug`:
   - Lowercase, replace spaces and special chars with `-`, truncate to 40 chars
   - e.g., "User Registration Flow" → `user-registration-flow`
   - **Collision detection**: if two journeys in the same run produce the same slug, append a counter suffix to the duplicate(s): e.g., `user-registration`, `user-registration-2`
4. Create directories: `{run_dir}{journey_slug}/` for each journey

Output:
```
📁 Screenshots will be saved to: {run_dir}
```

---

## Step 4: Execute Journeys

For **each journey** in the list, execute the following sub-loop:

### 4a. Announce Journey Start

```
🚀 Journey [{N}/{total}]: {journey_name}
   Folder: {run_dir}{journey_slug}/
```

### 4b. Navigate to Starting Point

Call `mcp__chrome-devtools__navigate_page(url={app_url})` to reset to the app home.

**Screenshot 1** (always): Call `mcp__chrome-devtools__take_screenshot` → save as `01-start.png` in the journey folder.

### 4c. Execute Journey Steps

For each step in the journey:

1. **Take snapshot** (optional, to understand the current page): `mcp__chrome-devtools__take_snapshot`
2. **Perform the action** based on the journey step:
   - Navigation: `mcp__chrome-devtools__navigate_page(url=...)`
   - Click: `mcp__chrome-devtools__click(uid=...)`
   - Fill input: `mcp__chrome-devtools__fill(uid=..., value=...)`
   - Type text: `mcp__chrome-devtools__type_text(text=...)`
   - Wait for content: `mcp__chrome-devtools__wait_for(text=[...])`
3. **Take screenshot** after the action:
   - Call `mcp__chrome-devtools__take_screenshot`
   - Save as `{step_number:02d}-{action-slug}.png`
   - `action-slug` = lowercase description of the action, spaces replaced by `-`, max 40 chars
   - e.g., step 3, action "Submit login form" → `03-submit-login-form.png`

**Screenshot naming convention:**
```
01-start.png
02-fill-email.png
03-fill-password.png
04-submit-login-form.png
05-dashboard-loaded.png
```

### 4d. Capture Accessibility Snapshot (if `capture_accessibility_snapshot: true`)

At the end of the journey, call `mcp__chrome-devtools__take_snapshot` and note any accessibility issues.

### 4e. Journey Complete

```
✅ Journey complete: {journey_name} — {step_count} screenshots saved
```

If `pause_between_journeys: true`, ask:
```
[C] Continue to next journey
```

---

## Step 5: Summary & Notification

### Actions

1. Count total screenshots saved across all journeys
2. Write a summary file to `{default_output_file}`:

```markdown
# Browser Journey Testing Summary

**Date:** {YYYY-MM-DD}
**App URL:** {app_url}
**Screenshots folder:** {run_dir}

## Results

| Journey | Steps | Folder |
|---------|-------|--------|
| {journey_1} | {step_count_1} | {run_dir}{slug_1}/ |
| {journey_2} | {step_count_2} | {run_dir}{slug_2}/ |

**Total:** {total_journey_count} journeys · {total_screenshot_count} screenshots

## How to review

Open the folder `{run_dir}` and browse by journey. Screenshots are numbered in order.
Each file is named `{step:02d}-{action}.png` for easy sequential reading.
```

3. **Notify the user:**

```
📸 Browser Journey Testing Complete!

📁 Screenshots ready at: {run_dir}
   ├── {journey_slug_1}/  ({N} screenshots)
   ├── {journey_slug_2}/  ({N} screenshots)
   └── ...

🧪 {total_journey_count} journeys tested · {total_screenshot_count} total screenshots
📄 Summary report: {default_output_file}

To review: open the folder above and browse screenshots in order.
```

---

## Error Handling

### DevTools loses connection mid-journey
- Output: `⚠️ DevTools connection lost during journey "{journey_name}" at step {N}.`
- Attempt to reconnect via `mcp__chrome-devtools__list_pages`
- If reconnect fails: skip remaining steps of this journey, continue to next journey
- Note the interrupted journey in the final summary

### Screenshot tool returns error
- Log the error inline: `⚠️ Screenshot failed at step {N} ({action}) — {error message}`
- Continue with remaining steps (do not abort the journey)

### App URL unreachable
- Output: `❌ Cannot reach {app_url}. Ensure the application is running before executing browser tests.`
- EXIT gracefully

### Journey steps are ambiguous
- If a journey step requires finding a UI element and the snapshot shows no clear match:
  - Output: `⚠️ Cannot locate "{element}" on current page. Skipping this step.`
  - Take a screenshot of the current state anyway
  - Continue to next step
