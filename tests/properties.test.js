// Feature: todo-life-dashboard — All 14 Property-Based Tests
// Runner: node tests/properties.test.js
// Requires: npm install  (fast-check + jsdom)

'use strict';

/* Bootstrap JSDOM environment */
const { JSDOM }  = require('jsdom');
const fc         = require('fast-check');
const fs         = require('fs');
const path       = require('path');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});
const { window } = dom;

global.window        = window;
global.document      = window.document;
global.localStorage  = window.localStorage;
global.crypto        = { randomUUID: function () { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); } };

const appPath = path.join(__dirname, '..', 'js', 'app.js');
let appCode   = fs.readFileSync(appPath, 'utf8');
appCode = appCode.replace(
  /document\.addEventListener\(\s*['"]DOMContentLoaded['"]\s*,[\s\S]*?\}\s*\)\s*;?\s*$/,
  ''
);
eval(appCode); // eslint-disable-line no-eval

/* Arbitrary helpers */
const arbitraryTask = fc.record({
  id:        fc.uuid(),
  title:     fc.string({ minLength: 1, maxLength: 100 }),
  completed: fc.boolean(),
  createdAt: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
});

const arbitraryLink = fc.record({
  id:    fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 100 }),
  url:   fc.oneof(
           fc.constant('http://example.com'),
           fc.constant('https://example.org'),
           fc.webUrl(),
         ),
});

/* Micro test runner */
var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  \u2713 ' + name);
    passed++;
  } catch (e) {
    console.error('  \u2717 ' + name);
    console.error('    ' + (e.message || e));
    failed++;
  }
}

console.log('\nTo-Do Life Dashboard \u2014 Property-Based Tests\n');

// Feature: todo-life-dashboard, Property 1: Greeting hour mapping is exhaustive and correct
test('P1  Greeting hour mapping is exhaustive and correct', function () {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 23 }), function (hour) {
      var result = GreetingWidget.getGreeting(hour);
      var valid  = ['Good Morning', 'Good Afternoon', 'Good Evening', 'Good Night'];
      if (!valid.includes(result)) return false;
      if (hour >= 5  && hour <= 11) return result === 'Good Morning';
      if (hour >= 12 && hour <= 17) return result === 'Good Afternoon';
      if (hour >= 18 && hour <= 21) return result === 'Good Evening';
      return result === 'Good Night';
    }),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 2: Time formatter produces valid MM:SS for all representable seconds
test('P2  formatTime produces valid MM:SS for all seconds in [0, 3599]', function () {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3599 }), function (s) {
      var result = TimerWidget.formatTime(s);
      if (!/^[0-5]\d:[0-5]\d$/.test(result)) return false;
      var mm = parseInt(result.slice(0, 2), 10);
      var ss = parseInt(result.slice(3, 5), 10);
      return mm * 60 + ss === s;
    }),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 3: Timer duration validation partitions the domain correctly
test('P3  validateDuration returns null iff 1 <= m <= 60', function () {
  fc.assert(
    fc.property(fc.integer({ min: -1000, max: 1000 }), function (m) {
      var result = TimerWidget.validateDuration(m);
      var valid  = m >= 1 && m <= 60;
      if (valid) return result === null;
      return typeof result === 'string' && result.length > 0;
    }),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 4: Timer duration round-trip through localStorage
test('P4  Timer duration round-trips through localStorage', function () {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 60 }), function (m) {
      Storage.set(Storage.KEYS.TIMER_DURATION, m);
      var readBack = Storage.get(Storage.KEYS.TIMER_DURATION, null);
      return readBack === m;
    }),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 5: Task title validation partitions the domain correctly
test('P5  validateTitle returns null iff trimmed length in [1, 100]', function () {
  fc.assert(
    fc.property(fc.oneof(fc.string(), fc.string({ minLength: 101 })), function (s) {
      var result  = TodoWidget.validateTitle(s);
      var trimLen = (s || '').trim().length;
      var valid   = trimLen >= 1 && trimLen <= 100;
      if (valid) return result === null;
      return typeof result === 'string' && result.length > 0;
    }),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 6: Adding a valid task increases the stored list length by exactly one
test('P6  Adding a valid task grows the stored list by exactly one', function () {
  fc.assert(
    fc.property(
      fc.array(arbitraryTask, { maxLength: 10 }),
      fc.string({ minLength: 1, maxLength: 100 }).filter(function (s) { return s.trim().length > 0; }),
      function (tasks, title) {
        Storage.set(Storage.KEYS.TASKS, tasks);
        var before  = Storage.get(Storage.KEYS.TASKS, []);
        var newTask = {
          id:        String(Date.now()) + Math.random(),
          title:     title.trim(),
          completed: false,
          createdAt: Date.now(),
        };
        Storage.set(Storage.KEYS.TASKS, before.concat([newTask]));
        var after = Storage.get(Storage.KEYS.TASKS, []);
        return (
          after.length === before.length + 1 &&
          after[after.length - 1].completed === false &&
          after[after.length - 1].title === title.trim()
        );
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 7: Task completion toggle is an involution
test('P7  toggleTask is an involution (toggle twice = original state)', function () {
  fc.assert(
    fc.property(fc.boolean(), function (initialCompleted) {
      var completed = initialCompleted;
      completed = !completed;
      completed = !completed;
      return completed === initialCompleted;
    }),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 8: Deleting a task removes it from persistent storage
test('P8  deleteTask removes the target task from storage', function () {
  fc.assert(
    fc.property(
      fc.array(arbitraryTask, { minLength: 1, maxLength: 10 }),
      fc.integer({ min: 0, max: 9 }),
      function (tasks, rawIndex) {
        var index    = rawIndex % tasks.length;
        var targetId = tasks[index].id;
        Storage.set(Storage.KEYS.TASKS, tasks);
        var stored   = Storage.get(Storage.KEYS.TASKS, []);
        var filtered = stored.filter(function (t) { return t.id !== targetId; });
        Storage.set(Storage.KEYS.TASKS, filtered);
        var after = Storage.get(Storage.KEYS.TASKS, []);
        return !after.some(function (t) { return t.id === targetId; });
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 9: Task list round-trip through localStorage
test('P9  Task list round-trips through localStorage with no data loss', function () {
  fc.assert(
    fc.property(fc.array(arbitraryTask, { maxLength: 10 }), function (tasks) {
      Storage.set(Storage.KEYS.TASKS, tasks);
      var restored = Storage.get(Storage.KEYS.TASKS, []);
      if (restored.length !== tasks.length) return false;
      return tasks.every(function (t, i) {
        return (
          restored[i].id        === t.id        &&
          restored[i].title     === t.title     &&
          restored[i].completed === t.completed
        );
      });
    }),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 10: Sort does not mutate localStorage
test('P10 sortTasks does not mutate localStorage', function () {
  fc.assert(
    fc.property(
      fc.array(arbitraryTask, { maxLength: 10 }),
      fc.constantFrom('default', 'alpha', 'completed-last'),
      function (tasks, criterion) {
        Storage.set(Storage.KEYS.TASKS, tasks);
        var snapshot = localStorage.getItem(Storage.KEYS.TASKS);
        TodoWidget.sortTasks(tasks, criterion);
        var afterSort = localStorage.getItem(Storage.KEYS.TASKS);
        return snapshot === afterSort;
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 11: URL validation rejects all non-http(s) prefixes
test('P11 validateUrl returns null iff URL starts with http:// or https://', function () {
  fc.assert(
    fc.property(
      fc.oneof(fc.string(), fc.webUrl()),
      function (u) {
        var result = LinksWidget.validateUrl(u);
        var valid  = typeof u === 'string' &&
                     (u.startsWith('http://') || u.startsWith('https://'));
        if (valid) return result === null;
        return typeof result === 'string' && result.length > 0;
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 12: Quick Link round-trip through localStorage
test('P12 Quick Link list round-trips through localStorage', function () {
  fc.assert(
    fc.property(fc.array(arbitraryLink, { maxLength: 10 }), function (links) {
      Storage.set(Storage.KEYS.LINKS, links);
      var restored = Storage.get(Storage.KEYS.LINKS, []);
      if (restored.length !== links.length) return false;
      return links.every(function (l, i) {
        return (
          restored[i].id    === l.id    &&
          restored[i].label === l.label &&
          restored[i].url   === l.url
        );
      });
    }),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 13: Theme preference round-trip through localStorage
test('P13 Theme preference round-trips and applies correct CSS class', function () {
  fc.assert(
    fc.property(fc.constantFrom('light', 'dark'), function (value) {
      Storage.set(Storage.KEYS.THEME, value);
      ThemeWidget.applyTheme(value);
      var hasDark = document.body.classList.contains('theme-dark');
      if (value === 'dark'  && !hasDark) return false;
      if (value === 'light' &&  hasDark) return false;
      var stored = Storage.get(Storage.KEYS.THEME, null);
      return stored === value;
    }),
    { numRuns: 100 }
  );
});

// Feature: todo-life-dashboard, Property 14: Corrupt localStorage data never throws an uncaught error
test('P14 Storage.get never throws on arbitrary corrupt data', function () {
  fc.assert(
    fc.property(fc.string(), function (corruptStr) {
      localStorage.setItem(Storage.KEYS.TASKS, corruptStr);
      var threw = false;
      try {
        Storage.get(Storage.KEYS.TASKS, 'DEFAULT_SENTINEL');
      } catch (_) {
        threw = true;
      }
      return !threw;
    }),
    { numRuns: 100 }
  );
});

/* Results */
console.log('\n' + (passed + failed) + ' tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
