# Requirements Document

## Introduction

The To-Do List Life Dashboard is a standalone, client-side web application built with HTML, CSS, and Vanilla JavaScript. It provides a personal productivity hub with four core widgets — a real-time greeting, a Focus (Pomodoro) Timer, a To-Do List, and a Quick Links manager — along with a Light/Dark Mode toggle. All user data is persisted in the browser's Local Storage. The app is responsive and works across Chrome, Firefox, Edge, and Safari with no build steps or external dependencies.

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **Widget**: A self-contained UI section within the Dashboard (e.g., Greeting, Timer, To-Do List, Quick Links).
- **Task**: A to-do item created by the user with a title and optional completion state.
- **Quick Link**: A user-defined bookmark consisting of a label and a URL.
- **Focus Timer**: A countdown timer based on the Pomodoro technique.
- **Session**: One countdown cycle of the Focus Timer from the configured duration down to zero.
- **Theme**: The visual color scheme of the Dashboard; either Light Mode or Dark Mode.
- **Local_Storage**: The browser's `localStorage` API used to persist all user data client-side.
- **Greeting_Widget**: The top section of the Dashboard that displays date, time, and a contextual greeting.
- **Timer_Widget**: The Focus Timer section of the Dashboard.
- **Todo_Widget**: The To-Do List section of the Dashboard.
- **Links_Widget**: The Quick Links section of the Dashboard.

---

## Requirements

### Requirement 1: Real-Time Greeting Display

**User Story:** As a user, I want to see the current date, time, and a greeting that reflects the time of day, so that I have immediate context when I open the Dashboard.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current date showing the full weekday name, full month name, numeric day, and 4-digit year (e.g., "Wednesday, November 6, 2026").
2. THE Greeting_Widget SHALL display the current time in HH:MM:SS format, updated exactly every 1 second without requiring a page reload.
3. WHEN the current local hour is between 05:00 and 11:59, THE Greeting_Widget SHALL display the greeting "Good Morning".
4. WHEN the current local hour is between 12:00 and 17:59, THE Greeting_Widget SHALL display the greeting "Good Afternoon".
5. WHEN the current local hour is between 18:00 and 21:59, THE Greeting_Widget SHALL display the greeting "Good Evening".
6. WHEN the current local hour is between 22:00 and 23:59 or between 00:00 and 04:59, THE Greeting_Widget SHALL display the greeting "Good Night".
7. WHEN the Dashboard first loads, THE Greeting_Widget SHALL render the date, time, and greeting immediately on load without a 1-second blank period.

---

### Requirement 2: Focus Timer

**User Story:** As a user, I want a configurable countdown timer with start, stop, and reset controls, so that I can manage focused work sessions using the Pomodoro technique.

#### Acceptance Criteria

1. THE Timer_Widget SHALL display a countdown in MM:SS format.
2. IF Local_Storage contains no saved session duration, THEN THE Timer_Widget SHALL default to a 25-minute session duration on Dashboard load.
3. WHEN the user presses the Start button and the timer is not running, THE Timer_Widget SHALL begin counting down from the current displayed time one second at a time.
4. WHEN the user presses the Stop button and the timer is running, THE Timer_Widget SHALL pause the countdown at the current time.
5. WHEN the user presses the Reset button, THE Timer_Widget SHALL stop any active countdown and restore the display to the configured session duration.
6. WHEN the countdown reaches 00:00, THE Timer_Widget SHALL stop the countdown, display a visual alert notification, and play an audible signal, then enter an idle state where the Start button resumes no countdown until Reset is pressed.
7. WHEN the user sets a custom session duration between 1 minute and 60 minutes, THE Timer_Widget SHALL save that duration to Local_Storage and apply it as the new default on subsequent page loads.
8. IF the user enters a session duration outside the range of 1 to 60 minutes, THEN THE Timer_Widget SHALL display a validation error message and retain the previous valid duration until the user submits a value within the valid range.

---

### Requirement 3: To-Do List Management

**User Story:** As a user, I want to add, edit, complete, and delete tasks in a to-do list that persists across sessions, so that I can track my daily activities without losing data on refresh.

#### Acceptance Criteria

1. WHEN the user submits a non-empty task title of 1 to 100 characters, THE Todo_Widget SHALL add the task to the list and save it to Local_Storage.
2. IF the user attempts to submit an empty task title, THEN THE Todo_Widget SHALL display an inline error message indicating the title is required and not add any task.
3. WHEN the user marks a task as complete, THE Todo_Widget SHALL apply a strikethrough text style and 50% reduced opacity to that task and update its completion state in Local_Storage.
4. WHEN the user marks a completed task as incomplete, THE Todo_Widget SHALL remove the strikethrough and opacity styles and update its completion state in Local_Storage.
5. WHEN the user activates the edit action on a task and confirms the updated title by pressing Enter or activating the save control, THE Todo_Widget SHALL save the updated title to Local_Storage and display the new title inline.
6. IF the user confirms an edit with an empty task title, THEN THE Todo_Widget SHALL display an inline error message indicating the title is required and retain the original task title unchanged.
7. WHEN the user activates the delete action on a task, THE Todo_Widget SHALL remove the task from the list and from Local_Storage.
8. WHEN the Dashboard is loaded, THE Todo_Widget SHALL restore all tasks from Local_Storage and render each task with its saved title and completion state.
9. WHEN the user selects a sort order, THE Todo_Widget SHALL reorder the displayed task list according to the selected criterion without altering data stored in Local_Storage.
10. THE Todo_Widget SHALL support at least the following sort criteria: default insertion order, alphabetical by title (A–Z), and completed tasks last.

---

### Requirement 4: Quick Links Manager

**User Story:** As a user, I want to save and open my favorite website shortcuts from the Dashboard, so that I can navigate to frequently visited sites with one click.

#### Acceptance Criteria

1. WHEN the user submits a Quick Link with a non-empty label and a valid URL (starting with http:// or https://), THE Links_Widget SHALL add the link to the list and save it to Local_Storage.
2. IF the user submits a Quick Link with an empty label, THEN THE Links_Widget SHALL display an inline validation message indicating the label is required and not add the link.
3. IF the user submits a Quick Link with a URL that does not start with http:// or https://, THEN THE Links_Widget SHALL display an inline validation message indicating a valid URL is required and not add the link.
4. WHEN the user clicks a Quick Link, THE Links_Widget SHALL open the target URL in a new browser tab.
5. WHEN the user activates the delete action on a Quick Link, THE Links_Widget SHALL remove the link from the list and from Local_Storage.
6. WHEN the Dashboard is loaded, THE Links_Widget SHALL restore all Quick Links from Local_Storage and render them.

---

### Requirement 5: Light / Dark Mode

**User Story:** As a user, I want to toggle between a light and dark color scheme, so that I can choose a visual style that suits my environment or preference.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a visible toggle button that switches between Light Mode and Dark Mode and displays a label or icon reflecting the currently active theme.
2. WHEN the user activates the theme toggle, THE Dashboard SHALL switch the active Theme immediately without a page reload.
3. WHEN the user activates the theme toggle, THE Dashboard SHALL save the selected Theme identifier to Local_Storage.
4. WHEN the Dashboard is loaded, THE Dashboard SHALL read the saved Theme from Local_Storage and apply it before the first render to avoid a flash of the wrong theme.
5. IF no Theme preference is found in Local_Storage, THEN THE Dashboard SHALL apply the Light Mode theme as the default.
6. WHEN Dark Mode is active, THE Dashboard SHALL use a color palette with sufficient contrast so that all text elements meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text).

---

### Requirement 6: Responsive Layout and Cross-Browser Compatibility

**User Story:** As a user, I want the Dashboard to look and function correctly on both desktop and mobile devices across all major browsers, so that I can use it anywhere without issues.

#### Acceptance Criteria

1. THE Dashboard SHALL render without horizontal scrollbars on viewport widths from 320px to 2560px.
2. THE Dashboard SHALL use a single-column layout on viewport widths below 768px and a multi-column layout on viewport widths of 768px and above.
3. THE Dashboard SHALL function correctly in the latest stable versions of Chrome, Firefox, Edge, and Safari without polyfills or external dependencies.
4. THE Dashboard SHALL load from a single HTML file that references exactly one CSS file located in the `css/` directory and exactly one JavaScript file located in the `js/` directory.
5. THE Dashboard SHALL not require a build step, server, or internet connection to run locally.
6. WHEN the viewport width is below 768px, all interactive controls (buttons, input fields, checkboxes) SHALL have a minimum touch target size of 44×44 CSS pixels.

---

### Requirement 7: Data Persistence and Storage

**User Story:** As a user, I want all my data — tasks, links, timer settings, and theme preference — to be automatically saved and restored, so that I never lose my configuration between sessions.

#### Acceptance Criteria

1. THE Dashboard SHALL use Local_Storage as the sole persistence mechanism for all user data.
2. WHEN any user-configurable value changes (task added/edited/deleted/completed, link added/deleted, timer duration changed, theme toggled), THE Dashboard SHALL write the updated state to Local_Storage synchronously before the next user interaction.
3. WHEN the Dashboard is loaded, THE Dashboard SHALL read all persisted data from Local_Storage and initialize each Widget to its saved state before displaying the UI.
4. IF Local_Storage data for a Widget is missing or corrupt, THEN THE Dashboard SHALL initialize that Widget to its default state without throwing an uncaught JavaScript error.
5. THE Dashboard SHALL use distinct Local_Storage keys for each data category (tasks, links, timer duration, theme) to avoid key collisions.
