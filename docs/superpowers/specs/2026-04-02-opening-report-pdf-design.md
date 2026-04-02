# Opening Report PDF Export

## Summary

Replace the existing text-file opening report with a professional PDF export using the browser's native `window.print()` flow. Before generating, prompt the user with a modal containing a freeform text area for an executive summary. The report focuses on the last 7 days of activity: completed tasks, updates/notes added, plus overall progress stats and overdue items.

## Trigger

Clicking the existing "Report" button on an opening view calls `exportOpeningReport()` in `js/admin.js`.

## Flow

1. User clicks "Report" button
2. Modal appears with:
   - Text area labeled "Executive Summary / Notes" (optional)
   - "Generate Report" button
   - "Cancel" button
3. On "Generate Report":
   - Render styled HTML into `#print-view`
   - Call `window.print()`
   - Clean up `#print-view` after print dialog closes

## Report Sections (in order)

### 1. Header
- Opening name
- Restaurant name
- Target open date
- Days remaining (or days past target)
- Report generation date

### 2. Executive Summary (conditional)
- Only rendered if the user typed something in the modal text area
- Displayed in a styled block below the header

### 3. Progress Summary
- Total tasks count
- Completed: X/Y (percentage)
- Overdue count
- High priority open count

### 4. Tasks Completed (Last 7 Days)
- Table with columns: Task Name, Category, Owner, Completed Date
- Sorted by completion date (most recent first)
- Uses `updatedAt` timestamp on tasks where `complete === true` and `updatedAt` is within last 7 days
- If no tasks completed in last 7 days, show "No tasks completed in the last 7 days"

### 5. Updates Added (Last 7 Days)
- Grouped by task
- Each group: task name header, then list of notes with date and text
- Filters `project.notes` where `note.date` is within last 7 days
- Sorted by date descending within each group
- If no updates in last 7 days, show "No updates added in the last 7 days"

### 6. Overdue Tasks (conditional)
- Only shown if overdue tasks exist
- Table with columns: Task Name, Days Overdue, Owner, Priority
- Sorted by most overdue first

## Styling

- Reuse existing `pr-*` print CSS classes from restaurant weekly report
- Extend with any new classes needed for the summary block and section spacing
- `@media print` rules ensure only `#print-view` is visible during print

## Technical Notes

- No external PDF library needed
- Modal markup added to `index.html` or generated dynamically in JS
- All data sourced from `state.projects` filtered by `openingId`
- Date calculations use existing `today()`, `formatDate()`, `daysUntil()` utilities from `js/utils.js`
