# Implementation Plan: To-Do List Life Dashboard

## Overview

Build a fully client-side productivity dashboard as three files (`index.html`, `css/style.css`, `js/app.js`) with zero external runtime dependencies. The implementation follows the widget-module pattern described in the design: each widget is an IIFE exposing only an `init` method, coordinated by a top-level `App` controller. A `Storage` utility wraps all `localStorage` access. Property-based tests (fast-check) validate all 14 correctness properties from the design document.

---

## Tasks

- [x] 1. Scaffold project structure and Storage module
  - Create `index.html` with semantic shell: `<head>` (meta charset, viewport, title, CSS link, inline theme-init script), `<body>` with five widget sections, JS script tag
  - Add the inline theme-init script in `<head>` before the CSS link to apply `theme-dark` class on `<html>` before first paint — prevents FOUC
    ```html
    <script>
      (function() {
        var t = localStorage.getItem('tld_theme');
        if (t === 'dark') document.documentElement.classList.add('theme-dark');
      })();
    </script>
    ```
  - Create `css/style.css` as an empty file with a comment placeholder
  - Create `js/app.js` with the `Storage` IIFE: `KEYS` constants (`tld_tasks`, `tld_links`, `tld_timer_duration`, `tld_theme`), `get(key, defaultValue)` with `try/catch` around `JSON.parse`, `set(key, value)` with `try/catch` around `setItem`, and `remove(key)`
  - Wrap `js/app.js` contents in a `DOMContentLoaded` listener that calls `App.init()`
  - _Requirements: 6.4, 6.5, 7.1, 7.5_

  - [x] 1.1 Implement Storage module with get/set/remove
    - Write the `Storage` IIFE with `KEYS`, `get`, `set`, `remove` as described above
    - `get` must return `defaultValue` — not throw — for missing, non-JSON, or structurally invalid data
    - _Requirements: 7.1, 7.4, 7.5_

  - [ ]* 1.2 Write property test for Storage corrupt-data safety (Property 14)
    - **Property 14: Corrupt localStorage data never throws an uncaught error**
    - **Validates: Requirements 7.4**
    - Use `fc.string()` to generate arbitrary strings as the stored value; assert `Storage.get` always returns the default without throwing

- [x] 2. Implement Greeting Widget
  - Add `GreetingWidget` IIFE to `js/app.js` with `getGreeting(hour)`, `formatDate(date)`, `formatTime(date)`, `render()`, and `init()`
  - `render()` calls all three formatters and writes to the DOM; `init()` calls `render()` immediately then sets a 1-second `setInterval`
  - Wire the widget's DOM elements to the corresponding IDs/classes in `index.html`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.1 Implement `getGreeting`, `formatDate`, and `formatTime` pure functions
    - `getGreeting(hour)`: returns "Good Morning" [5–11], "Good Afternoon" [12–17], "Good Evening" [18–21], "Good Night" [22–23, 0–4]
    - `formatDate(date)`: returns full weekday + month + day + 4-digit year string
    - `formatTime(date)`: returns current wall-clock time as `HH:MM:SS`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Write property test for greeting hour mapping (Property 1)
    - **Property 1: Greeting hour mapping is exhaustive and correct**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**
    - Use `fc.integer({ min: 0, max: 23 })` and assert the returned string matches the hour-to-greeting spec exactly

  - [x] 2.3 Implement `render()` and `init()` with live clock interval
    - `render()` reads `new Date()`, calls formatters, writes to DOM
    - `init()` calls `render()` once synchronously (no blank period), then `setInterval(render, 1000)`
    - _Requirements: 1.2, 1.7_

- [x] 3. Implement Timer Widget
  - Add `TimerWidget` IIFE to `js/app.js` with state variables (`totalSeconds`, `remaining`, `intervalId`, `running`), `formatTime(seconds)`, `validateDuration(minutes)`, `playAlert()`, `start()`, `stop()`, `reset()`, `tick()`, and `init()`
  - Wire Start, Stop, Reset buttons and the duration input to their DOM counterparts in `index.html`
  - `playAlert()` uses Web Audio API to generate a 440 Hz sine wave for 0.5 s; falls back silently if `AudioContext` unavailable
  - On completion: `clearInterval`, display `00:00`, inject `.alert-banner` div, disable Start button
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 3.1 Implement `formatTime(seconds)` and `validateDuration(minutes)`
    - `formatTime`: converts integer seconds [0–3599] to `MM:SS` string
    - `validateDuration`: returns `null` for `m` in [1, 60]; returns non-empty error string otherwise
    - _Requirements: 2.1, 2.7, 2.8_

  - [ ]* 3.2 Write property test for `formatTime` MM:SS invariant (Property 2)
    - **Property 2: Time formatter produces valid MM:SS for all representable seconds**
    - **Validates: Requirements 2.1**
    - Use `fc.integer({ min: 0, max: 3599 })`; assert result matches `^[0-5]\d:[0-5]\d$` and `MM * 60 + SS === s`

  - [ ]* 3.3 Write property test for duration validation partition (Property 3)
    - **Property 3: Timer duration validation partitions the domain correctly**
    - **Validates: Requirements 2.7, 2.8**
    - Use `fc.integer({ min: -1000, max: 1000 })`; assert `null` iff `1 ≤ m ≤ 60`

  - [x] 3.4 Implement `start()`, `stop()`, `reset()`, and `tick()` state machine
    - Follow the Idle → Running → Paused → Completed → Idle state transitions from the design diagram
    - `tick()` decrements `remaining`; at 0 triggers completion sequence
    - `reset()` restores `remaining` to `totalSeconds` and clears interval
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [x] 3.5 Implement duration persistence and `playAlert()`
    - Save custom duration to `Storage` on valid input; load on `init()`; default to 25 min if absent
    - `playAlert()`: create `AudioContext`, oscillator at 440 Hz, connect to destination, start/stop after 0.5 s, wrapped in `try/catch` for browsers without Web Audio API
    - _Requirements: 2.2, 2.6, 2.7_

  - [ ]* 3.6 Write property test for duration localStorage round-trip (Property 4)
    - **Property 4: Timer duration round-trip through localStorage**
    - **Validates: Requirements 2.7, 7.2**
    - Use `fc.integer({ min: 1, max: 60 })`; save via `Storage.set`, read back via `Storage.get`, assert equality

- [x] 4. Implement Todo Widget
  - Add `TodoWidget` IIFE to `js/app.js` with `validateTitle(title)`, `sortTasks(tasks, criterion)`, `renderList()`, `addTask(title)`, `toggleTask(id)`, `editTask(id, newTitle)`, `deleteTask(id)`, and `init()`
  - Task data shape: `{ id, title, completed, createdAt }` stored as JSON array under `tld_tasks`
  - Support three sort criteria: `'default'` (insertion order by `createdAt`), `'alpha'` (A–Z by title), `'completed-last'`
  - Inline edit: replace title text with an `<input>`, confirm on Enter or save button click
  - Display inline error messages adjacent to the input for validation failures
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 4.1 Implement `validateTitle(title)` and `sortTasks(tasks, criterion)`
    - `validateTitle`: trims input; returns `null` for trimmed length [1–100]; returns error string otherwise
    - `sortTasks`: returns a new sorted array without mutating the original; supports all three criteria
    - _Requirements: 3.1, 3.2, 3.6, 3.9, 3.10_

  - [ ]* 4.2 Write property test for title validation partition (Property 5)
    - **Property 5: Task title validation partitions the domain correctly**
    - **Validates: Requirements 3.1, 3.2, 3.6**
    - Use `fc.string()` and `fc.string({ minLength: 101 })`; assert `null` iff trimmed length is [1–100]

  - [ ]* 4.3 Write property test for sort does not mutate localStorage (Property 10)
    - **Property 10: Sort does not mutate localStorage**
    - **Validates: Requirements 3.9, 3.10**
    - Use `fc.array(arbitraryTask)` × `fc.constantFrom('default','alpha','completed-last')`; assert `tld_tasks` value in `localStorage` is unchanged after `sortTasks` call

  - [x] 4.4 Implement `addTask(title)`, `toggleTask(id)`, `editTask(id, newTitle)`, and `deleteTask(id)`
    - `addTask`: validate, create `{ id: crypto.randomUUID(), title: trimmed, completed: false, createdAt: Date.now() }`, append to stored array, re-render
    - `toggleTask`: flip `completed` boolean, persist, re-render
    - `editTask`: validate new title, update in array, persist, re-render; on empty title show inline error
    - `deleteTask`: filter out by `id`, persist, re-render
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 4.5 Write property test for addTask grows list by exactly one (Property 6)
    - **Property 6: Adding a valid task increases the stored list length by exactly one**
    - **Validates: Requirements 3.1, 7.2**
    - Use `fc.string({ minLength: 1, maxLength: 100 })` filtered to non-whitespace; assert `tld_tasks` length increases by 1 and new entry has `completed === false`

  - [ ]* 4.6 Write property test for toggleTask involution (Property 7)
    - **Property 7: Task completion toggle is an involution**
    - **Validates: Requirements 3.3, 3.4**
    - Use `fc.boolean()` as initial `completed` state; assert `toggle(toggle(task)).completed === task.completed`

  - [ ]* 4.7 Write property test for deleteTask removes from storage (Property 8)
    - **Property 8: Deleting a task removes it from persistent storage**
    - **Validates: Requirements 3.7, 7.2**
    - Use arbitrary task array + index; assert no element with matching `id` remains after `deleteTask`

  - [x] 4.8 Implement `renderList()` and `init()` with sort UI
    - `renderList()` reads current tasks from storage, applies active sort criterion, and renders task items with complete/edit/delete controls
    - Completed tasks get strikethrough and 50% opacity via CSS class
    - `init()` loads tasks from `Storage`, renders, and wires up add-form and sort-selector event listeners
    - _Requirements: 3.3, 3.4, 3.8, 3.9, 3.10_

  - [ ]* 4.9 Write property test for task list localStorage round-trip (Property 9)
    - **Property 9: Task list round-trip through localStorage**
    - **Validates: Requirements 3.8, 7.3**
    - Use `fc.array(arbitraryTask)`; write to storage, re-init widget, assert length and `{ id, title, completed }` match exactly

- [ ] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Quick Links Widget
  - Add `LinksWidget` IIFE to `js/app.js` with `validateLabel(label)`, `validateUrl(url)`, `renderList()`, `addLink(label, url)`, `deleteLink(id)`, and `init()`
  - Link data shape: `{ id, label, url }` stored as JSON array under `tld_links`
  - Links open in a new tab (`target="_blank"` + `rel="noopener noreferrer"`)
  - Inline validation errors for empty label and non-http(s) URL
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.1 Implement `validateLabel(label)` and `validateUrl(url)`
    - `validateLabel`: returns `null` for non-empty trimmed string; error string otherwise
    - `validateUrl`: returns `null` if starts with `http://` or `https://`; error string otherwise
    - _Requirements: 4.2, 4.3_

  - [ ]* 6.2 Write property test for URL validation partition (Property 11)
    - **Property 11: URL validation rejects all non-http(s) prefixes**
    - **Validates: Requirements 4.1, 4.3**
    - Use `fc.string()` and `fc.webUrl()`; assert `null` iff URL starts with `http://` or `https://`

  - [x] 6.3 Implement `addLink(label, url)`, `deleteLink(id)`, `renderList()`, and `init()`
    - `addLink`: validate both fields, create `{ id: crypto.randomUUID(), label: trimmed, url }`, append to stored array, re-render
    - `deleteLink`: filter by `id`, persist, re-render
    - `renderList()`: render anchor elements with `target="_blank"` and delete buttons
    - `init()`: load links from `Storage`, render, wire add-form listener
    - _Requirements: 4.1, 4.4, 4.5, 4.6_

  - [ ]* 6.4 Write property test for quick link list localStorage round-trip (Property 12)
    - **Property 12: Quick Link round-trip through localStorage**
    - **Validates: Requirements 4.6, 7.3**
    - Use `fc.array(arbitraryLink)`; write to storage, re-init widget, assert `{ id, label, url }` match exactly

- [x] 7. Implement Theme Widget
  - Add `ThemeWidget` IIFE to `js/app.js` with `applyTheme(value)`, `toggle()`, and `init()`
  - `applyTheme`: adds/removes `theme-dark` class on `<body>`; updates toggle button label/icon
  - `toggle()`: reads current stored theme, flips it, calls `applyTheme`, writes to `Storage`
  - `init()`: reads stored theme (default `'light'`), calls `applyTheme`, wires toggle button
  - The no-flash inline script (placed in `<head>` in Task 1) targets `<html>` (`document.documentElement`); `ThemeWidget` targets `<body>` — both must use the same `theme-dark` class
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.1 Implement `applyTheme(value)`, `toggle()`, and `init()`
    - As described above; default to `'light'` when no preference stored
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [ ]* 7.2 Write property test for theme preference localStorage round-trip (Property 13)
    - **Property 13: Theme preference round-trip through localStorage**
    - **Validates: Requirements 5.3, 5.4**
    - Use `fc.constantFrom('light','dark')`; save via `Storage.set`, re-init `ThemeWidget`, assert correct CSS class state on `<body>`

- [x] 8. Style all widgets in `css/style.css`
  - [x] 8.1 Define CSS custom properties for both themes
    - Declare `--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, etc. on `:root`
    - Override values inside `.theme-dark` selector for dark mode
    - Ensure all text meets WCAG AA contrast ratios (4.5:1 normal, 3:1 large) in both themes
    - _Requirements: 5.6_

  - [x] 8.2 Implement responsive layout
    - Default single-column flex/grid layout for viewports below 768px
    - Multi-column layout via `@media (min-width: 768px)` for wider viewports
    - No horizontal scrollbars at 320px–2560px
    - All interactive controls (buttons, inputs, checkboxes) have `min-width: 44px; min-height: 44px` on mobile
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 8.3 Style each widget section
    - Greeting: large time display, secondary date line, greeting heading
    - Timer: prominent `MM:SS` display, control buttons, duration input, `.alert-banner` styles
    - Todo: task list items with checkbox, strikethrough+opacity for completed, edit/delete controls, sort selector, inline error spans
    - Links: link cards/list with label anchor and delete button, inline error spans
    - Theme toggle: visible button in page header with icon reflecting active theme
    - _Requirements: 2.6, 3.3, 5.1, 6.6_

- [x] 9. Wire `App` controller and final integration
  - [x] 9.1 Implement `App.init()` to coordinate all widget init calls
    - Call `Storage`-validation pass (no-op if data is valid, resets to defaults if corrupt)
    - Call `GreetingWidget.init()`, `TimerWidget.init()`, `TodoWidget.init()`, `LinksWidget.init()`, `ThemeWidget.init()` in order
    - Wrap all in `DOMContentLoaded` listener
    - _Requirements: 6.5, 7.3, 7.4_

  - [x] 9.2 Verify `localStorage` key isolation
    - Confirm all reads/writes use the `tld_` prefix constants from `Storage.KEYS`
    - No widget accesses `localStorage` directly — all access goes through `Storage.get`/`Storage.set`
    - _Requirements: 7.1, 7.5_

- [~] 10. Write remaining property-based tests
  - Set up fast-check test runner: create `tests/properties.test.js` loadable via `node --experimental-vm-modules` or a simple Node script using `require('fast-check')`; inline-load `js/app.js` exports via JSDOM or expose module internals for testing
  - Each test file starts with the tag comment: `// Feature: todo-life-dashboard, Property N: <title>`
  - Minimum 100 iterations per property (`fc.assert(..., { numRuns: 100 })`)

  - [ ]* 10.1 Run all 14 property tests end-to-end and confirm they pass
    - Collects results from properties already written in tasks 1–7 sub-tasks
    - Validates: Properties 1–14

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints (tasks 5 and 11) ensure incremental validation at natural seams
- Property tests use **fast-check** (`npx fast-check` or via Node); run with `node tests/properties.test.js`
- All 14 correctness properties from the design document are covered across tasks 1–10
- `crypto.randomUUID()` is available in all target browsers (Chrome 92+, Firefox 95+, Edge 92+, Safari 15.4+); no polyfill required
- The inline theme-init script targets `document.documentElement` (`<html>`) to apply the class before CSS loads; `ThemeWidget.applyTheme` applies the same class to `<body>` — keep both in sync
- Unit tests for boundary examples (hour 4/5, 11/12, etc.) complement the property tests and can be added alongside any sub-task

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "4.1", "6.1", "7.1", "8.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "4.2", "4.3", "6.2", "7.2", "8.2"] },
    { "id": 3, "tasks": ["3.4", "4.4", "6.3", "8.3", "9.2"] },
    { "id": 4, "tasks": ["3.5", "3.6", "4.5", "4.6", "4.7", "6.4"] },
    { "id": 5, "tasks": ["4.8", "4.9"] },
    { "id": 6, "tasks": ["9.1"] },
    { "id": 7, "tasks": ["10.1"] }
  ]
}
```
