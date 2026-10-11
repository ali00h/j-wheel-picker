# Jalali Wheel Picker

A dependency-free, Persian (Jalali) date picker for plain HTML and JavaScript, with touch scrolling, mouse dragging, keyboard controls, and a responsive modal. Use one date field, multiple independent fields, or a linked **from/to date range**.

## Quick start

Copy `js/j-wheel-picker.js` and `css/j-wheel-picker.css` into your project. Load the script and initialize the picker after the input exists:

```html
<link rel="stylesheet" href="css/j-wheel-picker.css">

<label for="date">Date</label>
<input id="date" name="date" readonly placeholder="YYYY/MM/DD" aria-haspopup="dialog">

<script src="js/j-wheel-picker.js"></script>
<script>
  const picker = new JWheelPicker({
    target: '#date',
    onSelect(date) {
      console.log(date.formatted); // e.g. "1405/07/19"
    }
  });
</script>
```

No build step or package installation is required. Scripts expose `JWheelPicker` and `JalaliWheelRangePicker` as classic-script globals; this project does not ship an ES-module or npm package.

## Examples

- [Plain HTML](sample/html/index.html): independent single-date and range pickers, callbacks, and clearing a range.
- [Alpine.js](sample/alpinejs/index.html): reactive `x-model` fields, initialization, and component cleanup.

Open either HTML file directly in your browser, or serve the repository with your usual static server. The plain HTML example works offline. The Alpine.js example downloads pinned Alpine.js **3.14.9** from a CDN and needs internet access; replace that script URL with a local copy for offline use.

## From/to range

```html
<label for="from">From</label>
<input id="from" name="from" readonly>
<label for="to">To</label>
<input id="to" name="to" readonly>

<script>
  const range = new JalaliWheelRangePicker({
    from: '#from',
    to: '#to',
    minYear: 1320,
    maxYear: 1420,
    onSelect({ from, to, complete, changed }) {
      if (complete) console.log(from.formatted, to.formatted);
      console.log('Edited endpoint:', changed); // "from" or "to"
    }
  });

  // { from: dateObject | null, to: dateObject | null, complete: boolean }
  console.log(range.getRange());

  // When removing the associated UI:
  // range.destroy();
</script>
```

Either endpoint can be selected first. Both dates are inclusive, and same-day ranges are allowed. Confirmation rejects a start after the end or an end before the start, shows an error, and leaves the input values unchanged. Wheels still display all dates within the year bounds; ordering is validated on confirmation.

The callback runs after each successful endpoint selection. `complete` is true only when both fields contain valid, ordered dates. Set input `value` attributes before initialization to prefill a range. An invalid existing counterpart must be corrected or cleared before confirming. Direct programmatic or manual edits are not intercepted; use `getRange()` to validate completeness before submitting a form. Prefer `readonly` inputs when all edits should go through the picker.

This is a two-endpoint range API, not selection of an arbitrary set of disconnected dates. For independent dates, create separate `JWheelPicker` instances with distinct targets. Only one modal is open at a time.

## Single-date options

| Option | Default | Description |
| --- | --- | --- |
| `target` | none | CSS selector (first match) or an HTML element, normally a text input. Optional for a callback-only picker opened with `open()`. |
| `minYear` | `1320` | First selectable Jalali year. |
| `maxYear` | `1420` | Last selectable Jalali year. Integer bounds must satisfy `1 <= minYear <= maxYear <= 3000`. |
| `title` | `انتخاب تاریخ` | Plain-text modal title. |
| `initialDate` | none | Starting date when the target is empty; does not write to the input until confirmation. |
| `onSelect` | none | Function receiving `{ year, month, day, formatted }` after confirmation. |
| `validate` | none | Function receiving the candidate date. Return an error string to keep the modal open and reject the selection; return a falsy value to accept it. |

`open()` rereads the input. A nonempty input takes priority over `initialDate`; otherwise the picker starts on today's date from the client's local clock. Invalid starting dates fall back to today, with the year and day clamped to the configured year range.

Input accepts slash or hyphen separators and Latin, Persian, or Arabic-Indic digits, such as `1405/7/19`, `1405-07-19`, or `۱۴۰۵/۰۷/۱۹`. Output always uses Latin digits and zero-padded `YYYY/MM/DD`. Values are calendar dates, not timestamps. Calendar conversion and leap-year checks use the browser's `Intl` Persian calendar, which can differ from other calendar algorithms for distant dates.

Confirmation writes the target value and dispatches bubbling `change` and `input` events. Cancellation, backdrop clicks, and Escape discard the unconfirmed selection. A target inside a `.control` wrapper also supports clicking the wrapper's `.icon` elements.

### Methods

| Method | Behavior |
| --- | --- |
| `open()` | Create the modal on first use and show the current value. |
| `close()` | Close without committing and restore focus. |
| `confirm()` | Validate and commit; returns `true` on success or `false` if rejected/closed. |
| `destroy()` | Close, remove the modal, cancel timers, and release event listeners. The instance cannot be reopened. |
| `parseDate(value)` | Return a normalized date object, or `null` for invalid/out-of-bounds values. |

### Range options and methods

`from` and `to` are required selectors or references to two distinct, existing input elements. Shared `minYear` and `maxYear` use the single-picker defaults. `fromTitle` and `toTitle` default to `از تاریخ` and `تا تاریخ`. `onSelect` receives `{ from, to, complete, changed }`.

Use `getRange()` to read the current fields and `destroy()` to dispose of both pickers. `fromPicker` and `toPicker` expose the individual picker instances, for example `range.toPicker.open()`.

## Alpine.js integration

Use `x-ref` to pass actual input elements and `x-model` to synchronize values. Create pickers in `$nextTick` after Alpine has initialized the fields, and call `destroy()` from the component's cleanup hook. Keep the picker instances in the `Alpine.data` factory closure so Alpine does not proxy their internal state. The complete implementation is in [sample/alpinejs/app.js](sample/alpinejs/app.js).

The sample loads scripts in this order, all with `defer`: picker, component registration, then Alpine. Registration listens for `alpine:init`. Clearing or assigning a model updates the field; the picker reads that field again the next time it opens.

## Styling and accessibility

Override the CSS custom properties after loading the stylesheet:

```css
:root {
  --jwp-accent: #7c3aed;
  --jwp-item-height: 44px;
  --jwp-body-height: 308px;
}
```

The picker measures item height when opened. Keep wheel items at a uniform height. Persian labels and the modal use right-to-left layout; the surrounding page can use either direction.

Enter or Space opens a focused target. Tab cycles through modal controls; Arrow Up/Down and Home/End operate each focused wheel. Escape cancels. The dialog and wheels expose accessible names and current values, restore focus on close, and respect reduced-motion preferences. Test with your application's target browsers and assistive technology.

## Performance and browser support

- Modal DOM is created lazily, then reused on later opens.
- Wheel positions use direct index arithmetic instead of scanning all items.
- The day list rebuilds only when the number of days changes; year/day nodes are inserted in batches.
- Passive scroll handlers debounce updates; confirmation reads the current wheel positions without waiting for the debounce.
- Calendar formatting and leap-year results are cached. `destroy()` releases listeners and timers.

Year items are not virtualized. Prefer a narrow year range when possible, especially on mobile. These are implementation improvements, not a measured performance benchmark.

Requires a modern browser with `Intl.DateTimeFormat` Persian-calendar support, CSS scroll snap, and modern JavaScript (optional chaining/nullish coalescing). No Internet Explorer support. Mobile uses native touch scrolling; desktop also supports mouse dragging.

## Verification

Open [tests/browser.html](tests/browser.html) to run the browser regression suite, or run it headlessly with Node.js and a locally installed Chrome/Edge:

```sh
node tests/run.cjs
# Also verify both examples (requires internet for Alpine.js):
node tests/run.cjs --examples
```

Set the `BROWSER_PATH` environment variable if the browser is installed in a nonstandard location. No test dependencies are required. The suite covers calendar boundaries, multiple instances, range ordering, events, immediate confirmation, keyboard operation, and cleanup. The optional example checks also exercise Alpine model synchronization and clearing fields.
