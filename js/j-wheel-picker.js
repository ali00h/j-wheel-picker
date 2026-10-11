/**
 * JWheelPicker
 * 
 * Copyright (c) 2026 Ali Hashemi. All rights reserved.
 */
class JWheelPicker {
    constructor(options = {}) {
        this.targetSelector = typeof options.target === 'string' ? options.target : null;
        this.targetElement = options.target instanceof HTMLElement ? options.target : null;

        this.minYear = options.minYear ?? 1320;
        this.maxYear = options.maxYear ?? 1420;
        if (!Number.isInteger(this.minYear) || !Number.isInteger(this.maxYear) ||
            this.minYear < 1 || this.maxYear > 3000 || this.minYear > this.maxYear) {
            throw new RangeError('Expected 1 <= minYear <= maxYear <= 3000.');
        }
        this.title = options.title || 'انتخاب تاریخ';
        this.onSelect = options.onSelect || null;
        this.initialDate = options.initialDate || null;
        this.validate = options.validate || null;
        this.cleanups = [];
        this.scrollTimers = new Map();
        this.destroyed = false;

        this.itemHeight = 40;
        this.currentYear = 1403;
        this.currentMonth = 1;
        this.currentDay = 1;

        this.months = [
            'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
            'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
        ];

        this.init();
    }

    init() {
        this.parseInitialDate();
        this.bindTargetTriggers();
    }

    listen(element, type, handler, options) {
        element.addEventListener(type, handler, options);
        this.cleanups.push(() => element.removeEventListener(type, handler, options));
    }

    parseDate(value) {
        const normalized = String(value || '').trim().replace(/[۰-۹٠-٩]/g, digit =>
            String(digit.charCodeAt(0) - (digit >= '۰' ? 1776 : 1632)));
        const match = normalized.match(/^(\d{1,4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
        if (!match) return null;
        const [year, month, day] = match.slice(1).map(Number);
        if (year < this.minYear || year > this.maxYear || month < 1 || month > 12 ||
            day < 1 || day > this.getDaysInMonth(year, month)) return null;
        return { year, month, day, formatted: this.formatDate(year, month, day) };
    }

    formatDate(year, month, day) {
        return `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    }

    /**
     * Converts Gregorian date to Jalali date.
     */
    gregorianToJalali(gy, gm, gd) {
        // Reuse the browser's Persian calendar instead of a repeating leap-year approximation.
        if (!JWheelPicker.dateFormatter) {
            JWheelPicker.dateFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
                year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC'
            });
        }
        const parts = JWheelPicker.dateFormatter.formatToParts(new Date(Date.UTC(gy, gm - 1, gd)));
        const value = type => Number(parts.find(part => part.type === type).value);
        return { jy: value('year'), jm: value('month'), jd: value('day') };
    }

    /**
     * Gets today's Jalali date from the client system.
     */
    getTodayJalali() {
        const now = new Date();
        return this.gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }

    isLeapYear(year) {
        if (!this.leapYears) this.leapYears = new Map();
        if (!this.leapYears.has(year)) {
            // March always straddles Esfand/Farvardin within the supported year bounds.
            const march = this.gregorianToJalali(year + 622, 3, 1);
            const april = this.gregorianToJalali(year + 622, 4, 1);
            this.leapYears.set(year, 31 + march.jd - april.jd === 30);
        }
        return this.leapYears.get(year);
    }

    getDaysInMonth(year, month) {
        if (month <= 6) return 31;
        if (month <= 11) return 30;
        return this.isLeapYear(year) ? 30 : 29;
    }

    getTargetInput() {
        if (this.targetElement) return this.targetElement;
        if (this.targetSelector) return document.querySelector(this.targetSelector);
        return null;
    }

    parseInitialDate() {
        const input = this.getTargetInput();
        let dateStr = '';

        if (input && input.value) {
            dateStr = input.value.trim();
        } else if (this.initialDate) {
            dateStr = this.initialDate.trim();
        }

        const parsed = this.parseDate(dateStr);
        if (parsed) {
            this.currentYear = parsed.year;
            this.currentMonth = parsed.month;
            this.currentDay = parsed.day;
        } else {
            // Default to current system date if field is empty
            const today = this.getTodayJalali();
            this.currentYear = today.jy;
            this.currentMonth = today.jm;
            this.currentDay = today.jd;
        }

        if (this.currentYear < this.minYear) this.currentYear = this.minYear;
        if (this.currentYear > this.maxYear) this.currentYear = this.maxYear;
        this.currentDay = Math.min(this.currentDay, this.getDaysInMonth(this.currentYear, this.currentMonth));
    }

    renderModal() {
        const modalHtml = `
            <div class="jwp-overlay" aria-hidden="true">
                <div class="jwp-container" role="dialog" aria-modal="true">
                    <div class="jwp-header">
                        <button type="button" class="jwp-btn jwp-btn-cancel">انصراف</button>
                        <span class="jwp-title"></span>
                        <button type="button" class="jwp-btn jwp-btn-confirm">تأیید</button>
                    </div>
                    <div class="jwp-body">
                        <div class="jwp-highlight"></div>
                        <div class="jwp-wheel-container">
                            <div class="jwp-wheel" data-unit="day" tabindex="0" role="spinbutton" aria-label="روز">
                                <div class="jwp-wheel-list"></div>
                            </div>
                            <div class="jwp-wheel" data-unit="month" tabindex="0" role="spinbutton" aria-label="ماه">
                                <div class="jwp-wheel-list"></div>
                            </div>
                            <div class="jwp-wheel" data-unit="year" tabindex="0" role="spinbutton" aria-label="سال">
                                <div class="jwp-wheel-list"></div>
                            </div>
                        </div>
                    </div>
                    <p class="jwp-error" role="alert" hidden></p>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHtml;
        this.el = wrapper.firstElementChild;
        document.body.appendChild(this.el);

        this.el.querySelector('.jwp-title').textContent = this.title;
        this.el.querySelector('[role="dialog"]').setAttribute('aria-label', this.title);
        this.dayWheel = this.el.querySelector('[data-unit="day"]');
        this.monthWheel = this.el.querySelector('[data-unit="month"]');
        this.yearWheel = this.el.querySelector('[data-unit="year"]');
        this.errorElement = this.el.querySelector('.jwp-error');

        this.populateYears();
        this.populateMonths();
        this.updateDays(false);
        this.bindEvents();
    }

    populateYears() {
        const list = this.yearWheel.querySelector('.jwp-wheel-list');
        list.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let y = this.minYear; y <= this.maxYear; y++) {
            const item = document.createElement('div');
            item.className = 'jwp-item';
            item.setAttribute('data-value', y);
            item.textContent = y;
            fragment.appendChild(item);
        }
        list.appendChild(fragment);
    }

    populateMonths() {
        const list = this.monthWheel.querySelector('.jwp-wheel-list');
        list.innerHTML = '';
        this.months.forEach((name, idx) => {
            const item = document.createElement('div');
            item.className = 'jwp-item';
            item.setAttribute('data-value', idx + 1);
            item.textContent = name;
            list.appendChild(item);
        });
    }

    updateDays() {
        const totalDays = this.getDaysInMonth(this.currentYear, this.currentMonth);
        if (this.currentDay > totalDays) {
            this.currentDay = totalDays;
        }

        const list = this.dayWheel.querySelector('.jwp-wheel-list');
        if (this.renderedDays === totalDays) return;
        this.renderedDays = totalDays;
        const fragment = document.createDocumentFragment();
        for (let d = 1; d <= totalDays; d++) {
            const item = document.createElement('div');
            item.className = 'jwp-item';
            item.setAttribute('data-value', d);
            item.textContent = d;
            fragment.appendChild(item);
        }
        list.replaceChildren(fragment);

        this.scrollToValue(this.dayWheel, this.currentDay, false);
    }

    bindTargetTriggers() {
        this.listen(document, 'click', e => {
            const input = this.getTargetInput();
            if (!input || !(e.target instanceof Element)) return;
            const wrapper = input.closest('.control');
            if (input === e.target || input.contains(e.target) ||
                (wrapper && wrapper.contains(e.target) && e.target.closest('.icon'))) {
                e.preventDefault();
                this.open();
            }
        });
        this.listen(document, 'keydown', e => {
            if (e.target === this.getTargetInput() && ['Enter', ' '].includes(e.key)) {
                e.preventDefault();
                this.open();
            }
        });
    }

    bindEvents() {
        this.listen(this.el.querySelector('.jwp-btn-cancel'), 'click', () => this.close());
        this.listen(this.el.querySelector('.jwp-btn-confirm'), 'click', () => this.confirm());

        this.listen(this.el, 'click', (e) => {
            if (e.target === this.el) this.close();
        });

        [this.dayWheel, this.monthWheel, this.yearWheel].forEach(wheel => {
            this.listen(wheel, 'scroll', () => {
                if (!this.isOpen) return;
                clearTimeout(this.scrollTimers.get(wheel));
                this.scrollTimers.set(wheel, setTimeout(() => {
                    if (!wheel.classList.contains('is-dragging')) this.onWheelScrollEnd(wheel);
                }, 80));
            }, { passive: true });
            this.listen(wheel, 'keydown', e => {
                if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                const min = wheel === this.yearWheel ? this.minYear : 1;
                const max = min + wheel.firstElementChild.children.length - 1;
                const current = this['current' + wheel.dataset.unit[0].toUpperCase() + wheel.dataset.unit.slice(1)];
                const value = e.key === 'Home' ? min : e.key === 'End' ? max :
                    Math.max(min, Math.min(max, current + (e.key === 'ArrowDown' ? 1 : -1)));
                this.scrollToValue(wheel, value, false);
                this.onWheelScrollEnd(wheel);
            });
            this.bindDragToScroll(wheel);
        });
        this.listen(this.el, 'keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); this.close(); }
            if (e.key === 'Tab') {
                const controls = Array.from(this.el.querySelectorAll('button, [tabindex="0"]'));
                const index = controls.indexOf(document.activeElement);
                e.preventDefault();
                controls[(index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
            }
        });
    }

    bindDragToScroll(wheel) {
        let isDown = false;
        let startY = 0;
        let startScrollTop = 0;
        let hasMoved = false;

        const onMouseMove = (e) => {
            if (!isDown) return;
            const walk = e.pageY - startY;
            if (Math.abs(walk) > 4) {
                hasMoved = true;
            }
            wheel.scrollTop = startScrollTop - walk;
        };

        const onMouseUp = () => {
            if (!isDown) return;
            isDown = false;
            wheel.classList.remove('is-dragging');
            wheel.style.scrollSnapType = 'y mandatory';

            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            const index = Math.round(wheel.scrollTop / this.itemHeight);
            wheel.scrollTo({
                top: index * this.itemHeight,
                behavior: 'smooth'
            });
        };

        this.listen(wheel, 'mousedown', (e) => {
            if (e.button !== 0) return;
            isDown = true;
            hasMoved = false;
            startY = e.pageY;
            startScrollTop = wheel.scrollTop;

            wheel.classList.add('is-dragging');
            wheel.style.scrollSnapType = 'none';

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        const stopDrag = () => {
            isDown = false;
            wheel.classList.remove('is-dragging');
            wheel.style.scrollSnapType = '';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        if (!this.dragCleanups) this.dragCleanups = [];
        this.dragCleanups.push(stopDrag);
        this.cleanups.push(stopDrag);
        this.listen(wheel, 'click', (e) => {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const item = e.target.closest('.jwp-item');
            if (item) {
                const val = parseInt(item.getAttribute('data-value'), 10);
                this.scrollToValue(wheel, val, false);
                this.onWheelScrollEnd(wheel);
            }
        });
    }

    onWheelScrollEnd(wheel) {
        const scrollTop = wheel.scrollTop;
        const index = Math.round(scrollTop / this.itemHeight);
        const items = wheel.firstElementChild.children;
        if (items[index]) {
            const val = parseInt(items[index].getAttribute('data-value'), 10);
            const unit = wheel.getAttribute('data-unit');

            if (unit === 'year' && this.currentYear !== val) {
                this.currentYear = val;
                this.updateDays(true);
            } else if (unit === 'month' && this.currentMonth !== val) {
                this.currentMonth = val;
                this.updateDays(true);
            } else if (unit === 'day') {
                this.currentDay = val;
            }
        }
        this.updateAria();
    }

    updateAria() {
        for (const [wheel, value, min, max] of [
            [this.dayWheel, this.currentDay, 1, this.renderedDays],
            [this.monthWheel, this.currentMonth, 1, 12],
            [this.yearWheel, this.currentYear, this.minYear, this.maxYear]
        ]) {
            wheel.setAttribute('aria-valuenow', value);
            wheel.setAttribute('aria-valuemin', min);
            wheel.setAttribute('aria-valuemax', max);
            wheel.setAttribute('aria-valuetext', wheel === this.monthWheel ? this.months[value - 1] : String(value));
        }
    }

    scrollToValue(wheel, value, smooth = true) {
        const index = value - (wheel === this.yearWheel ? this.minYear : 1);
        if (index >= 0 && index < wheel.firstElementChild.children.length) {
            wheel.scrollTo({
                top: index * this.itemHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }

    open() {
        if (this.destroyed || this.isOpen) return;
        if (JWheelPicker.activePicker) JWheelPicker.activePicker.close();
        JWheelPicker.activePicker = this;
        this.previousFocus = document.activeElement;
        this.parseInitialDate();
        if (!this.el) this.renderModal();
        this.isOpen = true;
        this.errorElement.hidden = true;
        this.el.setAttribute('aria-hidden', 'false');
        this.el.classList.add('is-active');
        // Read the untransformed CSS height: the container scales during its entrance.
        // Initialize synchronously so immediate input cannot race an opening frame.
        this.itemHeight = parseFloat(getComputedStyle(this.dayWheel.querySelector('.jwp-item')).height) || 40;
        this.scrollToValue(this.yearWheel, this.currentYear, false);
        this.scrollToValue(this.monthWheel, this.currentMonth, false);
        this.updateDays();
        this.scrollToValue(this.dayWheel, this.currentDay, false);
        this.updateAria();
        this.el.querySelector('.jwp-btn-cancel').focus();
    }

    close() {
        this.scrollTimers.forEach(clearTimeout);
        this.scrollTimers.clear();
        if (this.dragCleanups) this.dragCleanups.forEach(cleanup => cleanup());
        const wasOpen = this.isOpen;
        this.isOpen = false;
        if (this.el) {
            this.el.classList.remove('is-active');
            this.el.setAttribute('aria-hidden', 'true');
        }
        if (JWheelPicker.activePicker === this) JWheelPicker.activePicker = null;
        if (wasOpen && this.previousFocus && this.previousFocus.isConnected) this.previousFocus.focus();
    }

    destroy() {
        this.close();
        this.cleanups.forEach(cleanup => cleanup());
        this.cleanups = [];
        if (this.el) this.el.remove();
        this.destroyed = true;
    }

    confirm() {
        if (!this.isOpen || this.destroyed) return false;
        // Read the actual wheel positions before a pending scroll debounce can fire.
        for (const wheel of [this.yearWheel, this.monthWheel, this.dayWheel]) {
            const min = wheel === this.yearWheel ? this.minYear : 1;
            const index = Math.max(0, Math.min(wheel.firstElementChild.children.length - 1,
                Math.round(wheel.scrollTop / this.itemHeight)));
            const unit = wheel.dataset.unit;
            this['current' + unit[0].toUpperCase() + unit.slice(1)] = index + min;
        }
        this.currentDay = Math.min(this.currentDay, this.getDaysInMonth(this.currentYear, this.currentMonth));
        this.updateDays();
        this.updateAria();
        const formatted = this.formatDate(this.currentYear, this.currentMonth, this.currentDay);
        const selected = { year: this.currentYear, month: this.currentMonth, day: this.currentDay, formatted };
        const error = this.validate && this.validate(selected);
        if (error) {
            this.errorElement.textContent = String(error);
            this.errorElement.hidden = false;
            return false;
        }
        const input = this.getTargetInput();

        if (input) {
            input.value = formatted;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        this.close();
        if (typeof this.onSelect === 'function') this.onSelect(selected);
        return true;
    }
}

/** A linked pair of pickers. Invalid ordering is rejected before writing either input. */
class JalaliWheelRangePicker {
    constructor(options = {}) {
        const resolve = target => typeof target === 'string' ? document.querySelector(target) : target;
        const from = resolve(options.from);
        const to = resolve(options.to);
        if (!(from instanceof HTMLInputElement) || !(to instanceof HTMLInputElement) || from === to) {
            throw new TypeError('from and to must identify two different input elements.');
        }
        this.onSelect = options.onSelect;
        const shared = { minYear: options.minYear, maxYear: options.maxYear };
        this.fromPicker = new JWheelPicker({ ...shared, target: from,
            title: options.fromTitle || 'از تاریخ',
            validate: date => this.validateEndpoint('from', date),
            onSelect: () => this.notify('from') });
        this.toPicker = new JWheelPicker({ ...shared, target: to,
            title: options.toTitle || 'تا تاریخ',
            validate: date => this.validateEndpoint('to', date),
            onSelect: () => this.notify('to') });
    }

    validateEndpoint(endpoint, date) {
        const otherPicker = endpoint === 'from' ? this.toPicker : this.fromPicker;
        const raw = otherPicker.getTargetInput().value.trim();
        const other = otherPicker.parseDate(raw);
        if (raw && !other) return 'لطفاً تاریخ دیگر را اصلاح یا پاک کنید.';
        if (other && (endpoint === 'from' ? date.formatted > other.formatted : date.formatted < other.formatted)) {
            return 'تاریخ پایان باید برابر یا بعد از تاریخ شروع باشد.';
        }
        return null;
    }

    getRange() {
        const from = this.fromPicker.parseDate(this.fromPicker.getTargetInput().value);
        const to = this.toPicker.parseDate(this.toPicker.getTargetInput().value);
        return { from, to, complete: Boolean(from && to && from.formatted <= to.formatted) };
    }

    notify(changed) {
        if (typeof this.onSelect === 'function') this.onSelect({ ...this.getRange(), changed });
    }

    destroy() {
        this.fromPicker.destroy();
        this.toPicker.destroy();
    }
}
