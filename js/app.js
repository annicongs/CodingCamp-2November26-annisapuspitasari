/**
 * To-Do List Life Dashboard
 * Single-file, zero-dependency, fully client-side web application.
 * All widgets follow the IIFE module pattern and are coordinated by App.init().
 */

/* ==========================================================================
   Storage Module
   Wraps all localStorage interactions with JSON serialisation and
   graceful corrupt-data handling. Never throws on read failures.
   ========================================================================== */
const Storage = (() => {
  /** Canonical localStorage key constants — all prefixed with "tld_" */
  const KEYS = {
    TASKS:          'tld_tasks',
    LINKS:          'tld_links',
    TIMER_DURATION: 'tld_timer_duration',
    THEME:          'tld_theme',
  };

  /**
   * Read and JSON-parse a value from localStorage.
   * Returns `defaultValue` if the key is missing, the stored string is not
   * valid JSON, or any other error occurs — never throws.
   *
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  function get(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[Storage.get] Failed to read key "%s":', key, e);
      return defaultValue;
    }
  }

  /**
   * JSON-serialise `value` and write it to localStorage under `key`.
   * Silently swallows write errors (e.g. quota exceeded, SecurityError).
   *
   * @param {string} key
   * @param {*} value
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[Storage.set] Failed to write key "%s":', key, e);
    }
  }

  /**
   * Remove a key from localStorage.
   *
   * @param {string} key
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Storage.remove] Failed to remove key "%s":', key, e);
    }
  }

  return { KEYS, get, set, remove };
})();


/* ==========================================================================
   Greeting Widget
   Renders date, time, and a contextual greeting; drives its own 1 s tick.
   ========================================================================== */
const GreetingWidget = (() => {
  // ── DOM references ──────────────────────────────────────────────────────
  const elDate     = document.getElementById('greeting-date');
  const elTime     = document.getElementById('greeting-time');
  const elGreeting = document.getElementById('greeting-text');

  // ── Pure helper functions ────────────────────────────────────────────────

  /**
   * Returns the contextual greeting string for a given 0–23 hour.
   *
   * Hour ranges:
   *   05–11 → "Good Morning"
   *   12–17 → "Good Afternoon"
   *   18–21 → "Good Evening"
   *   22–23, 00–04 → "Good Night"
   *
   * @param {number} hour  Integer in [0, 23]
   * @returns {string}
   */
  function getGreeting(hour) {
    if (hour >= 5 && hour <= 11) return 'Good Morning';
    if (hour >= 12 && hour <= 17) return 'Good Afternoon';
    if (hour >= 18 && hour <= 21) return 'Good Evening';
    return 'Good Night'; // covers 22–23 and 00–04
  }

  /**
   * Formats a Date object as the full human-readable date string.
   * Example output: "Wednesday, November 6, 2026"
   *
   * @param {Date} date
   * @returns {string}
   */
  function formatDate(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric',
    });
  }

  /**
   * Formats a Date object as a zero-padded HH:MM:SS wall-clock string.
   * Example output: "09:05:03"
   *
   * @param {Date} date
   * @returns {string}
   */
  function formatTime(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  // ── Render & lifecycle ───────────────────────────────────────────────────

  /**
   * Reads the current wall-clock time, formats all three values, and writes
   * them to the DOM. Called immediately on init and then every second.
   */
  function render() {
    const now = new Date();
    if (elDate)     elDate.textContent     = formatDate(now);
    if (elTime)     elTime.textContent     = formatTime(now);
    if (elGreeting) elGreeting.textContent = getGreeting(now.getHours());
  }

  /**
   * Bootstraps the widget: renders immediately (no blank period on load),
   * then schedules a 1-second interval to keep the clock live.
   */
  function init() {
    render();
    setInterval(render, 1000);
  }

  // Expose pure functions for unit / property tests
  return { init, getGreeting, formatDate, formatTime };
})();


/* ==========================================================================
   Timer Widget
   Countdown (Pomodoro) timer with configurable session duration.
   Pure helper functions formatTime and validateDuration are exposed for
   property-based testing.
   ========================================================================== */
const TimerWidget = (() => {
  // ── State ────────────────────────────────────────────────────────────────
  let totalSeconds; // total seconds for the configured session
  let remaining;    // seconds remaining in the current countdown
  let intervalId;   // handle returned by setInterval
  let running;      // boolean — true while the countdown is active

  // ── Constants ────────────────────────────────────────────────────────────
  const DEFAULT_MINUTES = 25;
  const MIN_MINUTES     = 1;
  const MAX_MINUTES     = 60;

  // ── DOM references (resolved lazily in init to allow deferred DOM access) ──
  let elDisplay;    // #timer-display
  let elStart;      // #timer-start
  let elStop;       // #timer-stop
  let elReset;      // #timer-reset
  let elAlert;      // #timer-alert  (existing hidden div in the markup)

  // ── Pure helper functions ─────────────────────────────────────────────────

  /**
   * Converts an integer number of seconds in [0, 3599] to a zero-padded
   * "MM:SS" string.
   *
   * Examples:
   *   formatTime(0)    → "00:00"
   *   formatTime(90)   → "01:30"
   *   formatTime(3599) → "59:59"
   *
   * @param {number} seconds  Integer in [0, 3599]
   * @returns {string}        "MM:SS" where both parts are zero-padded to 2 digits
   */
  function formatTime(seconds) {
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  /**
   * Validates that a session duration is within the allowed range.
   *
   * Returns `null` when `minutes` is an integer in [1, 60] (valid).
   * Returns a non-empty error string when the value is outside that range
   * or is not a valid integer.
   *
   * @param {number} minutes  Candidate session duration in minutes
   * @returns {null|string}   null on success; error message string on failure
   */
  function validateDuration(minutes) {
    if (Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES) {
      return null;
    }
    return 'Duration must be between 1 and 60 minutes.';
  }

  // ── State machine methods ─────────────────────────────────────────────────

  /** Play an audible alert when the session completes. */
  function playAlert() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return; // silently skip if unsupported
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, ctx.currentTime);
      oscillator.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
      // Clean up after the tone finishes
      oscillator.onended = () => ctx.close();
    } catch (e) {
      // silently ignore — audio is non-critical
    }
  }

  /**
   * Transition: Idle/Paused → Running
   * Starts the countdown interval. No-op if already running.
   */
  function start() {
    if (running === true) return; // guard: already running

    running = true;
    intervalId = setInterval(tick, 1000);

    // Disable Start button while running; the user must Stop or Reset
    if (elStart) elStart.disabled = true;
  }

  /**
   * Transition: Running → Paused
   * Pauses the countdown, preserving `remaining`. No-op if not running.
   */
  function stop() {
    if (running === false) return; // guard: already stopped

    clearInterval(intervalId);
    intervalId = null;
    running = false;

    // Re-enable Start so the user can resume
    if (elStart) elStart.disabled = false;
  }

  /**
   * Transition: Running/Paused/Completed → Idle
   * Cancels any active interval, restores display to totalSeconds,
   * hides the completion alert, and re-enables the Start button.
   */
  function reset() {
    clearInterval(intervalId);
    intervalId = null;
    running = false;

    remaining = totalSeconds;

    // Restore display
    if (elDisplay) elDisplay.textContent = formatTime(totalSeconds);

    // Hide the completion alert banner
    if (elAlert) {
      elAlert.hidden = true;
      elAlert.textContent = '';
    }

    // Re-enable Start button
    if (elStart) elStart.disabled = false;
  }

  /**
   * Called every second by setInterval while Running.
   * Decrements `remaining`; on reaching 0 triggers the completion sequence.
   */
  function tick() {
    remaining -= 1;

    // Update display with current remaining time
    if (elDisplay) elDisplay.textContent = formatTime(remaining);

    if (remaining === 0) {
      // Countdown complete — transition to Completed state
      clearInterval(intervalId);
      intervalId = null;
      running = false;

      // Lock display at 00:00
      if (elDisplay) elDisplay.textContent = '00:00';

      // Show the completion alert banner (already exists in the DOM, hidden)
      if (elAlert) {
        elAlert.textContent = 'Session complete!';
        elAlert.hidden = false;
      }

      // Disable Start — user must Reset to begin a new session
      if (elStart) elStart.disabled = true;

      playAlert();
    }
  }

  /**
   * Bootstrap the widget: resolve DOM refs, load saved duration, initialise
   * state, wire button and duration-input event listeners.
   */
  function init() {
    // Resolve DOM references
    elDisplay = document.getElementById('timer-display');
    elStart   = document.getElementById('timer-start');
    elStop    = document.getElementById('timer-stop');
    elReset   = document.getElementById('timer-reset');
    elAlert   = document.getElementById('timer-alert');

    // Resolve the duration controls using the IDs defined in index.html.
    const elDuration = document.getElementById('timer-duration-input');
    const elSet      = document.getElementById('timer-duration-set');
    const elError    = document.getElementById('timer-duration-error');

    // Load persisted duration; fall back to DEFAULT_MINUTES if absent.
    const savedMinutes = Storage.get(Storage.KEYS.TIMER_DURATION, DEFAULT_MINUTES);
    const savedValid   = validateDuration(savedMinutes);

    totalSeconds = (savedValid === null ? savedMinutes : DEFAULT_MINUTES) * 60;
    remaining    = totalSeconds;
    intervalId   = null;
    running      = false;

    if (elDisplay) elDisplay.textContent = formatTime(totalSeconds);
    if (elDuration) elDuration.value = savedValid === null ? savedMinutes : DEFAULT_MINUTES;

    // Apply the value only when the user presses Set or Enter.
    function applyDuration() {
      if (!elDuration) return;

      const raw = elDuration.value.trim();
      const minutes = raw === '' ? NaN : Number(raw);
      const error = validateDuration(minutes);

      if (error) {
        if (elError) elError.textContent = error;
        return;
      }

      if (elError) elError.textContent = '';
      Storage.set(Storage.KEYS.TIMER_DURATION, minutes);
      totalSeconds = minutes * 60;
      reset(); // Stop any active session and immediately display the new duration.
    }

    if (elSet) elSet.addEventListener('click', applyDuration);
    if (elDuration) {
      elDuration.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyDuration();
        }
      });
      elDuration.addEventListener('input', function () {
        if (elError) elError.textContent = '';
      });
    }

    // Wire button event listeners
    if (elStart) elStart.addEventListener('click', start);
    if (elStop)  elStop.addEventListener('click', stop);
    if (elReset) elReset.addEventListener('click', reset);
  }

  // Expose pure functions for unit / property tests alongside init
  return { init, formatTime, validateDuration };
})();


/* ==========================================================================
   Todo Widget
   Manages the task array (add, edit, delete, toggle), sort order, and
   rendering. Pure functions validateTitle and sortTasks are exposed for
   property-based testing.
   ========================================================================== */
const TodoWidget = (() => {
  // ── Constants ────────────────────────────────────────────────────────────
  const MAX_TITLE_LENGTH = 100;

  // ── State ────────────────────────────────────────────────────────────────
  let currentSort = 'default'; // 'default' | 'alpha' | 'completed-last'

  // ── Pure helper functions ─────────────────────────────────────────────────

  /**
   * Validates a task title string.
   *
   * Trims the input, then:
   *   - Returns `null` when the trimmed length is in [1, 100]  (valid)
   *   - Returns "Task title is required."  when the trimmed length is 0
   *   - Returns "Title must be 100 characters or fewer."  when > 100 chars
   *
   * @param {string} title  Raw user input
   * @returns {null|string} null on success; error message string on failure
   */
  function validateTitle(title) {
    const trimmed = (title || '').trim();
    if (trimmed.length === 0) {
      return 'Task title is required.';
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      return 'Title must be 100 characters or fewer.';
    }
    return null;
  }

  /**
   * Returns a new sorted copy of the task array without mutating the original.
   *
   * Supported criteria:
   *   'default'        — ascending by `createdAt` (insertion order)
   *   'alpha'          — A–Z by `title`, case-insensitive
   *   'completed-last' — incomplete tasks first, completed tasks last;
   *                      relative order within each group is preserved
   *                      (relies on the native stable sort guarantee)
   *
   * @param {Array<{id: string, title: string, completed: boolean, createdAt: number}>} tasks
   * @param {'default'|'alpha'|'completed-last'} criterion
   * @returns {Array}  A new sorted array; the original is never mutated.
   */
  function sortTasks(tasks, criterion) {
    // Shallow-copy first so the original array is never mutated
    const copy = tasks.slice();

    if (criterion === 'alpha') {
      copy.sort((a, b) =>
        a.title.toLowerCase().localeCompare(b.title.toLowerCase())
      );
    } else if (criterion === 'completed-last') {
      // false (0) before true (1); stable sort preserves relative order within groups
      copy.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
    } else {
      // 'default' — sort ascending by createdAt (insertion order)
      copy.sort((a, b) => a.createdAt - b.createdAt);
    }

    return copy;
  }

  // ── CRUD operations ───────────────────────────────────────────────────────

  /**
   * Validates `title`, creates a new task object, appends it to the stored
   * array, persists the updated array, clears the add-input field, and
   * re-renders the list.
   *
   * On validation failure the error message is written to `#todo-add-error`
   * and the function returns early without mutating storage.
   *
   * @param {string} title  Raw value from the add-task input
   */
  function addTask(title) {
    const error = validateTitle(title);
    const elAddError = document.getElementById('todo-add-error');

    if (error) {
      if (elAddError) elAddError.textContent = error;
      return;
    }

    // Clear any previous error
    if (elAddError) elAddError.textContent = '';

    const tasks = Storage.get(Storage.KEYS.TASKS, []);

    const newTask = {
      id:        crypto.randomUUID(),
      title:     title.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    tasks.push(newTask);
    Storage.set(Storage.KEYS.TASKS, tasks);

    // Clear the input field
    const elInput = document.getElementById('todo-input');
    if (elInput) elInput.value = '';

    renderList();
  }

  /**
   * Flips the `completed` boolean on the task identified by `id`, persists
   * the updated array, and re-renders the list.
   *
   * @param {string} id  The `id` of the task to toggle
   */
  function toggleTask(id) {
    const tasks = Storage.get(Storage.KEYS.TASKS, []);

    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
    }

    Storage.set(Storage.KEYS.TASKS, tasks);
    renderList();
  }

  /**
   * Validates `newTitle` and, if valid, updates the matching task's title,
   * persists the array, and re-renders the list.
   *
   * On validation failure the error message is written into the
   * `.error-msg` span inside the `<li data-id="…">` element for that task,
   * and the function returns early without mutating storage.
   *
   * @param {string} id        The `id` of the task to edit
   * @param {string} newTitle  The candidate replacement title
   */
  function editTask(id, newTitle) {
    const error = validateTitle(newTitle);

    if (error) {
      // Show inline error inside the task's list item
      const li = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (li) {
        const errSpan = li.querySelector('.error-msg');
        if (errSpan) errSpan.textContent = error;
      }
      return;
    }

    const tasks = Storage.get(Storage.KEYS.TASKS, []);

    const task = tasks.find(t => t.id === id);
    if (task) {
      task.title = newTitle.trim();
    }

    Storage.set(Storage.KEYS.TASKS, tasks);
    renderList();
  }

  /**
   * Removes the task identified by `id` from the stored array, persists the
   * filtered result, and re-renders the list.
   *
   * @param {string} id  The `id` of the task to delete
   */
  function deleteTask(id) {
    const tasks = Storage.get(Storage.KEYS.TASKS, []);
    const filtered = tasks.filter(t => t.id !== id);
    Storage.set(Storage.KEYS.TASKS, filtered);
    renderList();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  /**
   * Reads tasks from storage, applies the active sort criterion, then
   * rebuilds the `#todo-list` DOM from scratch.
   *
   * Each list item contains:
   *   - A checkbox  (toggles completion)
   *   - A title span
   *   - An "Edit" button  (enters inline-edit mode)
   *   - A "Delete" button
   *
   * Completed tasks receive the `todo-item--completed` class so CSS can
   * apply strikethrough and 50 % opacity.
   */
  function renderList() {
    const tasks = Storage.get(Storage.KEYS.TASKS, []);
    const sorted = sortTasks(tasks, currentSort);

    const elList = document.getElementById('todo-list');
    if (!elList) return;

    elList.innerHTML = '';

    sorted.forEach(function (task) {
      // ── <li> container ──────────────────────────────────────────────────
      const li = document.createElement('li');
      li.className = 'todo-item' + (task.completed ? ' todo-item--completed' : '');
      li.setAttribute('data-id', task.id);

      // ── Checkbox ────────────────────────────────────────────────────────
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.completed;
      checkbox.setAttribute('aria-label', 'Mark complete');
      checkbox.addEventListener('change', function () {
        toggleTask(task.id);
      });

      // ── Title span ──────────────────────────────────────────────────────
      const titleSpan = document.createElement('span');
      titleSpan.className = 'todo-title';
      titleSpan.textContent = task.title;

      // ── Edit button ─────────────────────────────────────────────────────
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-edit';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () {
        // Enter inline-edit mode
        // Replace title span with an <input>
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'todo-edit-input';
        editInput.value = task.title;

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-save';
        saveBtn.textContent = 'Save';

        // Inline error span
        const errSpan = document.createElement('span');
        errSpan.className = 'error-msg';

        // Commit handler — shared by Save button and Enter key
        function commitEdit() {
          editTask(task.id, editInput.value);
        }

        saveBtn.addEventListener('click', commitEdit);
        editInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit();
          }
        });

        // Swap span → input in the DOM
        li.replaceChild(editInput, titleSpan);
        // Insert Save button and error span after the edit input
        editBtn.insertAdjacentElement('beforebegin', saveBtn);
        editBtn.insertAdjacentElement('beforebegin', errSpan);
        // Hide the Edit button while in edit mode
        editBtn.hidden = true;

        // Focus the edit field immediately
        editInput.focus();
      });

      // ── Delete button ────────────────────────────────────────────────────
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () {
        deleteTask(task.id);
      });

      // ── Assemble ─────────────────────────────────────────────────────────
      li.appendChild(checkbox);
      li.appendChild(titleSpan);
      li.appendChild(editBtn);
      li.appendChild(deleteBtn);

      elList.appendChild(li);
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Bootstrap the widget: render the initial task list, then wire up the
   * add-form and sort-selector event listeners.
   *
   * Sort is a view-only concern: changing the sort criterion calls
   * `renderList()` without touching `localStorage`.
   */
  function init() {
    // Initial render — pulls tasks from storage and displays them
    renderList();

    // Wire add-form submit
    const addForm = document.getElementById('todo-add-form');
    if (addForm) {
      addForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const elInput = document.getElementById('todo-input');
        addTask(elInput ? elInput.value : '');
      });
    }

    // Wire sort-selector change
    const sortSelect = document.getElementById('todo-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        currentSort = sortSelect.value;
        renderList();
      });
    }
  }

  // Expose pure functions for unit / property tests
  return { init, validateTitle, sortTasks };
})();


/* ==========================================================================
   Links Widget
   Manages the quick-link array (add, delete) and rendering.
   Pure functions validateLabel and validateUrl are exposed for
   property-based testing.
   ========================================================================== */
const LinksWidget = (() => {
  // ── Pure helper functions ─────────────────────────────────────────────────

  /**
   * Validates a quick-link label string.
   *
   * Trims the input, then:
   *   - Returns `null` when the trimmed string is non-empty  (valid)
   *   - Returns "Label is required."  when the trimmed string is empty
   *
   * @param {string} label  Raw user input for the link label
   * @returns {null|string} null on success; error message string on failure
   */
  function validateLabel(label) {
    const trimmed = (label || '').trim();
    if (trimmed.length === 0) {
      return 'Label is required.';
    }
    return null;
  }

  /**
   * Validates a quick-link URL string.
   *
   * Returns `null` when the URL starts with `http://` or `https://` (valid).
   * Returns an error string for any other value — including empty strings,
   * `ftp://`, `//`, relative paths, etc.
   *
   * @param {string} url  Raw user input for the link URL
   * @returns {null|string} null on success; error message string on failure
   */
  function validateUrl(url) {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      return null;
    }
    return 'URL must start with http:// or https://.';
  }

  // ── CRUD operations ───────────────────────────────────────────────────────

  /**
   * Validates both fields and, if both pass, creates a new link object,
   * appends it to the stored array, persists the updated array, clears the
   * input fields, and re-renders the list.
   *
   * On validation failure the relevant error message(s) are written to the
   * corresponding inline error spans and the function returns early without
   * mutating storage.
   *
   * @param {string} label  Raw value from the label input
   * @param {string} url    Raw value from the URL input
   */
  function addLink(label, url) {
    const labelError = validateLabel(label);
    const urlError   = validateUrl(url);

    const elLabelError = document.getElementById('links-label-error');
    const elUrlError   = document.getElementById('links-url-error');

    if (elLabelError) elLabelError.textContent = labelError || '';
    if (elUrlError)   elUrlError.textContent   = urlError   || '';

    if (labelError || urlError) return;

    const links = Storage.get(Storage.KEYS.LINKS, []);

    const newLink = {
      id:    crypto.randomUUID(),
      label: label.trim(),
      url:   url,
    };

    links.push(newLink);
    Storage.set(Storage.KEYS.LINKS, links);

    // Clear inputs on success
    const elLabel = document.getElementById('links-label-input');
    const elUrl   = document.getElementById('links-url-input');
    if (elLabel) elLabel.value = '';
    if (elUrl)   elUrl.value   = '';

    renderList();
  }

  /**
   * Removes the link identified by `id` from the stored array, persists the
   * filtered result, and re-renders the list.
   *
   * @param {string} id  The `id` of the link to delete
   */
  function deleteLink(id) {
    const links = Storage.get(Storage.KEYS.LINKS, []);
    const filtered = links.filter(l => l.id !== id);
    Storage.set(Storage.KEYS.LINKS, filtered);
    renderList();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  /**
   * Reads links from storage, then rebuilds the `#links-list` DOM from
   * scratch.
   *
   * Each list item contains:
   *   - An `<a>` anchor that opens the link in a new tab
   *   - A "Delete" button that removes the link
   */
  function renderList() {
    const links = Storage.get(Storage.KEYS.LINKS, []);

    const elList = document.getElementById('links-list');
    if (!elList) return;

    elList.innerHTML = '';

    links.forEach(function (link) {
      // ── <li> container ──────────────────────────────────────────────────
      const li = document.createElement('li');
      li.className = 'links-item';
      li.setAttribute('data-id', link.id);

      // ── Anchor ──────────────────────────────────────────────────────────
      const anchor = document.createElement('a');
      anchor.href             = link.url;
      anchor.textContent      = link.label;
      anchor.target           = '_blank';
      anchor.rel              = 'noopener noreferrer';
      anchor.className        = 'links-anchor';

      // ── Delete button ────────────────────────────────────────────────────
      const deleteBtn = document.createElement('button');
      deleteBtn.className  = 'btn-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () {
        deleteLink(link.id);
      });

      // ── Assemble ──────────────────────────────────────────────────────────
      li.appendChild(anchor);
      li.appendChild(deleteBtn);

      elList.appendChild(li);
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Bootstrap the widget: render the initial links list, then wire up the
   * add-form submit event listener.
   */
  function init() {
    renderList();

    const addForm = document.getElementById('links-add-form');
    if (addForm) {
      addForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const elLabel = document.getElementById('links-label-input');
        const elUrl   = document.getElementById('links-url-input');
        addLink(
          elLabel ? elLabel.value : '',
          elUrl   ? elUrl.value   : ''
        );
      });
    }
  }

  // Expose pure functions for unit / property tests
  return { init, validateLabel, validateUrl };
})();


/* ==========================================================================
   Theme Widget
   Manages light/dark mode toggling, persists the preference in localStorage,
   and applies the theme class to <body> on load and on toggle.
   ========================================================================== */
const ThemeWidget = (() => {
  // ── Constants ────────────────────────────────────────────────────────────
  const DARK_CLASS  = 'theme-dark';
  const LIGHT_VALUE = 'light';
  const DARK_VALUE  = 'dark';

  // ── Core functions ────────────────────────────────────────────────────────

  /**
   * Applies the given theme to <body> and updates the toggle button label.
   *
   * When value === 'dark':
   *   - adds the `theme-dark` class to document.body
   *   - sets the toggle button text to "☀️ Light Mode" (click → switch to light)
   *
   * Otherwise (light mode):
   *   - removes the `theme-dark` class from document.body
   *   - sets the toggle button text to "🌙 Dark Mode" (click → switch to dark)
   *
   * @param {string} value  Either 'dark' or 'light'
   */
  function applyTheme(value) {
    if (value === DARK_VALUE) {
      document.body.classList.add(DARK_CLASS);
    } else {
      document.body.classList.remove(DARK_CLASS);
    }

    // Update the toggle button label to reflect the next action
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = value === DARK_VALUE ? '☀️ Light Mode' : '🌙 Dark Mode';
      btn.setAttribute('aria-label', value === DARK_VALUE ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
  }

  /**
   * Reads the current stored theme, flips it, applies the new theme to
   * the DOM, and persists the new value to localStorage.
   *
   * light → dark → light → … (cycles between the two values)
   */
  function toggle() {
    const current = Storage.get(Storage.KEYS.THEME, LIGHT_VALUE);
    const next    = current === DARK_VALUE ? LIGHT_VALUE : DARK_VALUE;
    applyTheme(next);
    Storage.set(Storage.KEYS.THEME, next);
  }

  /**
   * Bootstrap the widget:
   *   1. Reads the stored theme (defaults to 'light' if absent).
   *   2. Calls applyTheme to set the correct class on <body> and button label.
   *   3. Wires the click event on the theme toggle button.
   *
   * Note: the inline script in <head> already applied the class to <html>
   * before first paint (FOUC prevention). This init call syncs <body> to
   * match and activates the toggle control.
   */
  function init() {
    const stored = Storage.get(Storage.KEYS.THEME, LIGHT_VALUE);
    applyTheme(stored);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }
  }

  // Expose init and applyTheme for property tests
  return { init, applyTheme, toggle };
})();


/* ==========================================================================
   App Controller — coordinates all widget initialisations
   ========================================================================== */
const App = (() => {
  /**
   * Validates each persisted tld_* key and resets it to a safe default when
   * the stored value is of the wrong type or out of the allowed range.
   *
   * This is a no-op when all values are already valid, so it is safe to call
   * unconditionally on every page load.
   *
   * Checks performed:
   *   tld_tasks          → must be an Array;              default []
   *   tld_links          → must be an Array;              default []
   *   tld_timer_duration → must be a number in [1, 60];   default 25
   *   tld_theme          → must be 'light' or 'dark';     default 'light'
   */
  function validateAndRepairStorage() {
    // ── tld_tasks ──────────────────────────────────────────────────────────
    const tasks = Storage.get(Storage.KEYS.TASKS, []);
    if (!Array.isArray(tasks)) {
      console.warn('[App] Corrupt tld_tasks — resetting to []');
      Storage.set(Storage.KEYS.TASKS, []);
    }

    // ── tld_links ──────────────────────────────────────────────────────────
    const links = Storage.get(Storage.KEYS.LINKS, []);
    if (!Array.isArray(links)) {
      console.warn('[App] Corrupt tld_links — resetting to []');
      Storage.set(Storage.KEYS.LINKS, []);
    }

    // ── tld_timer_duration ─────────────────────────────────────────────────
    const duration = Storage.get(Storage.KEYS.TIMER_DURATION, 25);
    if (typeof duration !== 'number' || duration < 1 || duration > 60) {
      console.warn('[App] Corrupt tld_timer_duration — resetting to 25');
      Storage.set(Storage.KEYS.TIMER_DURATION, 25);
    }

    // ── tld_theme ──────────────────────────────────────────────────────────
    const theme = Storage.get(Storage.KEYS.THEME, 'light');
    if (theme !== 'light' && theme !== 'dark') {
      console.warn('[App] Corrupt tld_theme — resetting to "light"');
      Storage.set(Storage.KEYS.THEME, 'light');
    }
  }

  function init() {
    validateAndRepairStorage();
    GreetingWidget.init();
    TimerWidget.init();
    TodoWidget.init();
    LinksWidget.init();
    ThemeWidget.init();
  }

  return { init };
})();


/* ==========================================================================
   Bootstrap — kick off after the DOM is ready
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
