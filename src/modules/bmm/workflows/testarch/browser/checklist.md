# Browser Journey Testing — Validation Checklist

Use this checklist to validate that the `testarch-browser` workflow has been executed correctly and all deliverables meet quality standards.

---

## Step 1: Preflight — Chrome DevTools MCP

- [ ] `mcp__chrome-devtools__list_pages` was called as the first action
- [ ] If DevTools unavailable: graceful warning message was displayed with setup instructions
- [ ] If DevTools unavailable: workflow exited cleanly (no HALT, no crash)
- [ ] If DevTools available: confirmation output shown to user before proceeding

---

## Step 2: Journey Discovery

- [ ] If `{journeys}` was provided: list used as-is without re-discovery
- [ ] If auto-discovery enabled:
  - [ ] UX design specification checked for "User Journeys" section
  - [ ] PRD checked if UX spec had no journeys
  - [ ] User asked if no journeys found in artifacts
- [ ] Journey list presented to user for confirmation before execution
- [ ] User confirmed journey list (or edited it)

---

## Step 3: Output Structure

- [ ] Run directory uses `YYYY-MM-DD` format (no time component, no colons)
- [ ] Journey slugs are lowercase, hyphenated, max 40 chars, no special characters
- [ ] One subdirectory created per journey: `{screenshots_dir}/{YYYY-MM-DD}/{journey-slug}/`
- [ ] Output path communicated to user before execution starts

---

## Step 4: Journey Execution

For each journey:

- [ ] Journey start announced with journey name and folder path
- [ ] `mcp__chrome-devtools__navigate_page` called to reset to app home
- [ ] First screenshot (`01-start.png`) always captured
- [ ] For each journey step:
  - [ ] Action performed (click / fill / navigate / type / wait)
  - [ ] Screenshot captured AFTER the action
  - [ ] Screenshot saved with correct naming: `{step:02d}-{action-slug}.png`
  - [ ] Step number increments sequentially within the journey
- [ ] Accessibility snapshot captured at journey end (if `capture_accessibility_snapshot: true`)
- [ ] Journey completion message shown with step count

### Error handling verified:
- [ ] Mid-journey DevTools connection loss → attempt reconnect, skip remaining steps if fails, continue to next journey
- [ ] Individual screenshot failure → log warning, continue (do not abort journey)
- [ ] App unreachable → graceful exit with clear message

---

## Step 5: Summary & Notification

- [ ] Summary markdown file written to `{default_output_file}`
- [ ] Summary contains: date, app URL, table of journeys with step counts and folder paths
- [ ] Summary contains: total journey count and total screenshot count
- [ ] Final notification displayed to user with:
  - [ ] Full path to screenshots root folder
  - [ ] Per-journey breakdown (name + screenshot count)
  - [ ] Total counts (journeys + screenshots)
  - [ ] Path to summary report

---

## Screenshot Quality

- [ ] All screenshots saved as PNG (or configured format)
- [ ] File names follow `{step:02d}-{action-slug}.png` convention exactly
- [ ] Action slugs are readable and descriptive (not `01-action.png` with no context)
- [ ] No screenshots from one journey appear in another journey's folder
- [ ] Step numbers within each journey start at `01` and increment without gaps

---

## Completion Criteria

All of the following must be true before marking this workflow complete:

- [ ] DevTools preflight passed (or graceful exit if unavailable)
- [ ] All journeys confirmed with user before execution
- [ ] Each journey folder contains at minimum a `01-start.png`
- [ ] Screenshots named correctly and organized by journey
- [ ] No journeys skipped silently (all skips/errors documented)
- [ ] Summary report generated at `{default_output_file}`
- [ ] User notified with full folder path and counts

---

## Common Issues and Resolutions

### Issue: DevTools MCP not available
**Resolution:** Display setup instructions (see Step 1). Do not HALT. Exit gracefully. The user must start Chrome with `--remote-debugging-port=9222` and configure the MCP server.

### Issue: No journeys found in planning artifacts
**Resolution:** Ask the user directly. Do not generate fictional journeys. Provide examples to help the user respond.

### Issue: UI element not found during journey
**Resolution:** Log a warning, take a screenshot of the current state anyway, skip the step, continue. Do not abort the journey.

### Issue: Date format produces invalid path
**Resolution:** Always use `YYYY-MM-DD` (ISO date, no time). Never include colons, slashes, or spaces in the folder name.

### Issue: Journey folder already exists from previous run
**Resolution:** Append screenshots to the existing folder (do not overwrite). If `01-start.png` already exists, start numbering from the next available number or create a subfolder with a run suffix.
