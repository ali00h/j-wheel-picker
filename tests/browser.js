(async () => {
    const results = [];
    const fixtures = document.querySelector('#fixtures');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const wait = () => new Promise(resolve => setTimeout(resolve, 120));
    const input = value => {
        const element = document.createElement('input');
        element.value = value || '';
        fixtures.appendChild(element);
        return element;
    };
    const instances = [];
    const picker = options => {
        const instance = new JWheelPicker(options);
        instances.push(instance);
        return instance;
    };
    const open = async instance => { instance.open(); await wait(); };
    const position = (instance, year, month, day) => {
        instance.scrollToValue(instance.yearWheel, year, false);
        instance.scrollToValue(instance.monthWheel, month, false);
        instance.scrollToValue(instance.dayWheel, day, false);
    };
    const test = async (name, run) => {
        try { await run(); results.push(`PASS ${name}`); }
        catch (error) { results.push(`FAIL ${name}: ${error.message}`); }
        finally {
            instances.splice(0).forEach(instance => instance.destroy());
            fixtures.replaceChildren();
        }
    };

    await test('calendar conversion and leap Esfand', () => {
        const p = picker();
        assert(p.gregorianToJalali(2024, 3, 20).jy === 1403, 'Nowruz year');
        assert(p.gregorianToJalali(2024, 3, 20).jd === 1, 'Nowruz day');
        assert(p.getDaysInMonth(1403, 12) === 30, '1403 leap');
        assert(p.getDaysInMonth(1404, 12) === 29, '1404 common');
        assert(p.getDaysInMonth(1405, 6) === 31 && p.getDaysInMonth(1405, 7) === 30, 'month lengths');
    });
    await test('strict parsing, Persian digits and invalid bounds', () => {
        const p = picker();
        assert(p.parseDate('۱۴۰۳/۱۲/۳۰').formatted === '1403/12/30', 'Persian digits');
        assert(p.parseDate('١٤٠٥-٧-١٩').formatted === '1405/07/19', 'Arabic digits');
        for (const value of ['1404/12/30', '1405/13/01', '1405/00/01', '1405/01/00', '9999/01/01', 'nonsense']) {
            assert(p.parseDate(value) === null, `invalid ${value}`);
        }
        let threw = false;
        try { new JWheelPicker({ minYear: 1420, maxYear: 1320 }); } catch { threw = true; }
        assert(threw, 'reversed years rejected');
    });
    await test('lazy DOM, multiple instances, title treated as text', async () => {
        const a = picker({ target: input('1405/01/01'), title: '<b>title</b>' });
        const b = picker({ target: input('1405/02/02') });
        assert(!a.el && !b.el, 'no eager modals');
        await open(a);
        assert(!a.el.querySelector('.jwp-title b'), 'no title HTML');
        await open(b);
        assert(a.el.isConnected && b.el.isConnected, 'both modals survive');
        assert(!a.isOpen && b.isOpen, 'only one active');
        assert(document.querySelectorAll('.jwp-overlay').length === 2, 'two distinct overlays');
    });
    await test('one open per click with a selector target', async () => {
        const field = input(); field.id = 'selector-test';
        const p = picker({ target: '#selector-test' });
        let count = 0;
        const original = p.open.bind(p);
        p.open = () => { count++; original(); };
        field.click(); await wait();
        assert(count === 1, 'duplicate trigger');
    });
    await test('confirmation before debounce emits events and latest date', async () => {
        const field = input('1405/01/01');
        let changes = 0, inputs = 0, selection;
        field.addEventListener('change', () => changes++);
        field.addEventListener('input', () => inputs++);
        const p = picker({ target: field, onSelect: date => { selection = date; } });
        await open(p);
        position(p, 1406, 2, 12);
        assert(p.confirm(), 'confirm failed');
        assert(field.value === '1406/02/12', `stale value ${field.value}`);
        assert(changes === 1 && inputs === 1 && selection.day === 12, 'events/callback');
    });
    await test('reuse day nodes and clamp day when month shrinks', async () => {
        const p = picker({ target: input('1405/01/31') });
        await open(p);
        const first = p.dayWheel.firstElementChild.firstElementChild;
        p.scrollToValue(p.monthWheel, 2, false); p.onWheelScrollEnd(p.monthWheel);
        assert(p.dayWheel.firstElementChild.firstElementChild === first, 'unnecessary rebuild');
        p.scrollToValue(p.monthWheel, 7, false); p.onWheelScrollEnd(p.monthWheel);
        assert(p.currentDay === 30 && p.renderedDays === 30, 'day not clamped');
        p.confirm();
        assert(p.getTargetInput().value === '1405/07/30', `clamped confirmation: ${p.getTargetInput().value}, scroll ${p.dayWheel.scrollTop}, height ${p.itemHeight}`);
    });
    await test('range supports either endpoint first, rejects reversed, allows equal', async () => {
        const from = input(), to = input();
        const selections = [];
        const range = new JalaliWheelRangePicker({ from, to, onSelect: date => selections.push(date) });
        instances.push(range);
        await open(range.toPicker);
        position(range.toPicker, 1405, 7, 10); range.toPicker.confirm();
        assert(!range.getRange().complete && selections[0].changed === 'to', 'partial range');
        await open(range.fromPicker);
        position(range.fromPicker, 1405, 7, 11);
        assert(!range.fromPicker.confirm() && from.value === '', 'reversed start accepted');
        assert(!range.fromPicker.errorElement.hidden && range.fromPicker.isOpen, 'missing validation UI');
        position(range.fromPicker, 1405, 7, 10);
        assert(range.fromPicker.confirm() && range.getRange().complete, 'same day rejected');
        await open(range.toPicker);
        position(range.toPicker, 1405, 7, 9);
        assert(!range.toPicker.confirm() && to.value === '1405/07/10', 'reversed end accepted');
    });
    await test('range reads programmatic edits and invalid counterpart', async () => {
        const from = input('invalid'), to = input();
        const range = new JalaliWheelRangePicker({ from, to }); instances.push(range);
        await open(range.toPicker);
        assert(!range.toPicker.confirm(), 'invalid counterpart accepted');
        from.value = '1405/01/01';
        position(range.toPicker, 1405, 2, 1);
        assert(range.toPicker.confirm(), 'programmatic update not read');
        from.value = '';
        assert(!range.getRange().complete && range.getRange().from === null, 'clear not read');
    });
    await test('keyboard, cancel, focus restore and custom item height', async () => {
        const field = input('1405/01/01');
        document.documentElement.style.setProperty('--jwp-item-height', '44px');
        const p = picker({ target: field });
        field.focus(); await open(p);
        assert(p.itemHeight === 44, `CSS item height ignored: ${p.itemHeight}, measured ${p.dayWheel.querySelector('.jwp-item').getBoundingClientRect().height}`);
        p.dayWheel.focus();
        p.dayWheel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        assert(p.currentDay === 2 && p.dayWheel.getAttribute('aria-valuenow') === '2', 'keyboard selection');
        p.dayWheel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert(!p.isOpen && field.value === '1405/01/01', 'cancel committed');
        assert(document.activeElement === field, 'focus not restored');
        document.documentElement.style.removeProperty('--jwp-item-height');
    });
    await test('destroy cancels pending work and prevents reopening', async () => {
        const field = input(); const p = picker({ target: field });
        p.open(); p.destroy(); field.click(); await wait();
        assert(!p.el.isConnected && !p.isOpen && p.scrollTimers.size === 0, 'destroy leaked');
    });
    if (new URLSearchParams(location.search).has('examples')) {
        for (const kind of ['html', 'alpinejs']) {
            await test(`${kind} example: selection, range and clear`, async () => {
                const frame = document.createElement('iframe');
                frame.style.cssText = 'width:800px;height:600px';
                const loaded = new Promise((resolve, reject) => {
                    frame.onload = resolve;
                    frame.onerror = () => reject(new Error('Example failed to load'));
                });
                frame.src = `../sample/${kind}/index.html`;
                fixtures.appendChild(frame);
                await loaded; await wait();
                const doc = frame.contentDocument;
                const win = frame.contentWindow;
                const select = async field => {
                    field.click();
                    await wait();
                    const confirm = doc.querySelector('.jwp-overlay.is-active .jwp-btn-confirm');
                    assert(confirm, 'picker did not open');
                    confirm.click();
                    await wait();
                    assert(/^\d{4}\/\d{2}\/\d{2}$/.test(field.value), 'date not written');
                };
                await select(doc.querySelector(kind === 'html' ? '#date' : '#appointment'));
                await select(doc.querySelector('#from'));
                await select(doc.querySelector('#to'));
                assert(doc.querySelectorAll('output')[1].textContent.includes('→'), 'range output not updated');
                if (kind === 'alpinejs') {
                    const state = win.Alpine.$data(doc.querySelector('main'));
                    assert(state.date === doc.querySelector('#appointment').value, 'x-model did not synchronize');
                }
                doc.querySelector('.clear').click(); await wait();
                assert(!doc.querySelector('#from').value && !doc.querySelector('#to').value, 'range not cleared');
            });
        }
    }
    const failed = results.filter(result => result.startsWith('FAIL')).length;
    document.querySelector('#results').textContent = results.join('\n') + `\nRESULT: ${results.length - failed} passed, ${failed} failed`;
    document.body.dataset.testStatus = failed ? 'failed' : 'passed';
})();
