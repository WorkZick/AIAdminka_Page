/**
 * AIAdminka DatePicker Component
 * Custom date/datetime picker with glassmorphism popup (singleton pattern)
 * API: DatePicker.initAll(root) / DatePicker.create(el, options)
 */

const DatePicker = (() => {
    'use strict';

    const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const CHEVRON_LEFT = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
    const CHEVRON_RIGHT = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

    let popup = null;       // singleton popup element
    let activeInstance = null; // currently open instance
    let ymPanelOpen = false; // year-month panel open

    // ── Calendar icon SVG ──
    const CALENDAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`;

    // ── Popup (singleton) ──

    function _ensurePopup() {
        if (popup) return popup;

        popup = document.createElement('div');
        popup.className = 'datepicker-popup';
        popup.setAttribute('data-visible', 'false');
        popup.innerHTML = `
            <div class="datepicker-header">
                <button class="datepicker-nav datepicker-prev" type="button" title="Предыдущий месяц">${CHEVRON_LEFT}</button>
                <span class="datepicker-month-year"></span>
                <button class="datepicker-nav datepicker-next" type="button" title="Следующий месяц">${CHEVRON_RIGHT}</button>
            </div>
            <div class="datepicker-ym-panel" style="display:none">
                <div class="datepicker-year-strip">
                    <button class="datepicker-nav datepicker-ys-prev" type="button">${CHEVRON_LEFT}</button>
                    <div class="datepicker-year-cells"></div>
                    <button class="datepicker-nav datepicker-ys-next" type="button">${CHEVRON_RIGHT}</button>
                </div>
                <div class="datepicker-month-grid"></div>
            </div>
            <div class="datepicker-calendar-panel">
                <div class="datepicker-weekdays">${WEEKDAYS.map(d => `<span>${d}</span>`).join('')}</div>
                <div class="datepicker-grid"></div>
            </div>
            <div class="datepicker-time" style="display:none">
                <input type="number" class="datepicker-hour" min="0" max="23" value="12"> :
                <input type="number" class="datepicker-minute" min="0" max="59" value="00" step="5">
            </div>
            <div class="datepicker-footer">
                <button class="datepicker-btn" type="button" data-action="today">Сегодня</button>
                <button class="datepicker-btn datepicker-btn--now" type="button" data-action="now" style="display:none">Сейчас</button>
                <button class="datepicker-btn" type="button" data-action="clear">Очистить</button>
            </div>`;

        document.body.appendChild(popup);

        // Header ◀ ▶ — month navigation (only in calendar mode)
        popup.querySelector('.datepicker-prev').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!activeInstance || ymPanelOpen) return;
            activeInstance._viewMonth--;
            if (activeInstance._viewMonth < 0) { activeInstance._viewMonth = 11; activeInstance._viewYear--; }
            _renderGrid();
        });
        popup.querySelector('.datepicker-next').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!activeInstance || ymPanelOpen) return;
            activeInstance._viewMonth++;
            if (activeInstance._viewMonth > 11) { activeInstance._viewMonth = 0; activeInstance._viewYear++; }
            _renderGrid();
        });

        // Click "Март 2026" → toggle year-month panel
        popup.querySelector('.datepicker-month-year').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!activeInstance) return;
            ymPanelOpen ? _closeYMPanel() : _openYMPanel();
        });

        // Year strip ◀ ▶
        popup.querySelector('.datepicker-ys-prev').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!activeInstance) return;
            _yearPageCenter -= 5;
            _renderYearStrip();
        });
        popup.querySelector('.datepicker-ys-next').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!activeInstance) return;
            _yearPageCenter += 5;
            _renderYearStrip();
        });

        // Year cell click
        popup.querySelector('.datepicker-year-cells').addEventListener('click', (e) => {
            const btn = e.target.closest('.datepicker-year-cell');
            if (!btn || !activeInstance) return;
            e.stopPropagation();
            activeInstance._viewYear = parseInt(btn.dataset.year);
            _renderYearStrip();
            _renderMonthGrid();
        });

        // Month cell click → close panel, back to calendar
        popup.querySelector('.datepicker-month-grid').addEventListener('click', (e) => {
            const btn = e.target.closest('.datepicker-month-cell');
            if (!btn || !activeInstance) return;
            e.stopPropagation();
            activeInstance._viewMonth = parseInt(btn.dataset.month);
            _closeYMPanel();
        });

        // Footer buttons
        popup.querySelector('.datepicker-footer').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || !activeInstance) return;
            e.stopPropagation();
            const action = btn.dataset.action;
            const now = new Date();
            if (action === 'today') {
                activeInstance._setDate(now.getFullYear(), now.getMonth(), now.getDate(),
                    activeInstance.mode === 'datetime' ? now.getHours() : null,
                    activeInstance.mode === 'datetime' ? now.getMinutes() : null);
                _close();
            } else if (action === 'now') {
                activeInstance._setDate(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
                _close();
            } else if (action === 'clear') {
                activeInstance._clear();
                _close();
            }
        });

        // Grid clicks (event delegation)
        popup.querySelector('.datepicker-grid').addEventListener('click', (e) => {
            const cell = e.target.closest('.datepicker-day');
            if (!cell || !activeInstance) return;
            e.stopPropagation();
            const y = parseInt(cell.dataset.year);
            const m = parseInt(cell.dataset.month);
            const d = parseInt(cell.dataset.day);
            if (activeInstance.mode === 'datetime') {
                const hEl = popup.querySelector('.datepicker-hour');
                const mEl = popup.querySelector('.datepicker-minute');
                activeInstance._setDate(y, m, d, parseInt(hEl.value) || 0, parseInt(mEl.value) || 0);
                // Keep open for time adjustment — update grid to show selected
                _renderGrid();
            } else {
                activeInstance._setDate(y, m, d);
                _close();
            }
        });

        // Time inputs — update value live in datetime mode
        popup.querySelectorAll('.datepicker-hour, .datepicker-minute').forEach(input => {
            input.addEventListener('change', () => {
                if (!activeInstance || !activeInstance._selectedDate) return;
                const sd = activeInstance._selectedDate;
                const h = parseInt(popup.querySelector('.datepicker-hour').value) || 0;
                const mi = parseInt(popup.querySelector('.datepicker-minute').value) || 0;
                activeInstance._setDate(sd.getFullYear(), sd.getMonth(), sd.getDate(), h, mi);
            });
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!activeInstance) return;
            if (e.target.closest('.datepicker-popup') || e.target.closest('.datepicker-wrap')) return;
            _close();
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && activeInstance) _close();
        });

        return popup;
    }

    // ── Year-Month panel (single panel, no levels) ──

    let _yearPageCenter = 2026;

    function _openYMPanel() {
        if (!popup || !activeInstance) return;
        ymPanelOpen = true;
        _yearPageCenter = activeInstance._viewYear;
        popup.querySelector('.datepicker-calendar-panel').style.display = 'none';
        popup.querySelector('.datepicker-ym-panel').style.display = 'block';
        popup.querySelector('.datepicker-month-year').classList.add('datepicker-month-year--active');
        // Hide header ◀ ▶ (year strip has its own)
        popup.querySelector('.datepicker-prev').style.visibility = 'hidden';
        popup.querySelector('.datepicker-next').style.visibility = 'hidden';
        _renderYearStrip();
        _renderMonthGrid();
    }

    function _closeYMPanel() {
        if (!popup) return;
        ymPanelOpen = false;
        popup.querySelector('.datepicker-calendar-panel').style.display = 'block';
        popup.querySelector('.datepicker-ym-panel').style.display = 'none';
        popup.querySelector('.datepicker-month-year').classList.remove('datepicker-month-year--active');
        popup.querySelector('.datepicker-prev').style.visibility = '';
        popup.querySelector('.datepicker-next').style.visibility = '';
        _renderGrid();
    }

    function _renderYearStrip() {
        if (!popup || !activeInstance) return;
        const thisYear = new Date().getFullYear();
        const start = _yearPageCenter - 2;
        let html = '';
        for (let y = start; y < start + 5; y++) {
            let cls = 'datepicker-year-cell';
            if (y === activeInstance._viewYear) cls += ' datepicker-year-cell--selected';
            if (y === thisYear) cls += ' datepicker-year-cell--current';
            html += `<button type="button" class="${cls}" data-year="${y}">${y}</button>`;
        }
        popup.querySelector('.datepicker-year-cells').innerHTML = html;
    }

    function _renderMonthGrid() {
        if (!popup || !activeInstance) return;
        const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        let html = '';
        for (let m = 0; m < 12; m++) {
            let cls = 'datepicker-month-cell';
            if (m === activeInstance._viewMonth) cls += ' datepicker-month-cell--selected';
            html += `<button type="button" class="${cls}" data-month="${m}">${MONTHS_SHORT[m]}</button>`;
        }
        popup.querySelector('.datepicker-month-grid').innerHTML = html;
    }

    function _renderGrid() {
        if (!popup || !activeInstance) return;

        const year = activeInstance._viewYear;
        const month = activeInstance._viewMonth;
        const sel = activeInstance._selectedDate;
        const today = new Date();

        popup.querySelector('.datepicker-month-year').textContent = `${MONTHS[month]} ${year}`;

        // First day of month (0=Sun..6=Sat) -> convert to Mon-based (0=Mon..6=Sun)
        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay === 0 ? 6 : firstDay - 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();

        let html = '';
        // 6 rows x 7 cols = 42 cells
        for (let i = 0; i < 42; i++) {
            let d, m, y, cls = 'datepicker-day';
            if (i < startOffset) {
                // Previous month
                d = daysInPrev - startOffset + i + 1;
                m = month - 1; y = year;
                if (m < 0) { m = 11; y--; }
                cls += ' datepicker-day--other';
            } else if (i >= startOffset + daysInMonth) {
                // Next month
                d = i - startOffset - daysInMonth + 1;
                m = month + 1; y = year;
                if (m > 11) { m = 0; y++; }
                cls += ' datepicker-day--other';
            } else {
                d = i - startOffset + 1;
                m = month; y = year;
            }

            // Today
            if (d === today.getDate() && m === today.getMonth() && y === today.getFullYear()) {
                cls += ' datepicker-day--today';
            }
            // Selected
            if (sel && d === sel.getDate() && m === sel.getMonth() && y === sel.getFullYear()) {
                cls += ' datepicker-day--selected';
            }

            html += `<button type="button" class="${cls}" data-year="${y}" data-month="${m}" data-day="${d}">${d}</button>`;
        }

        popup.querySelector('.datepicker-grid').innerHTML = html;
    }

    function _position(wrapEl) {
        if (!popup) return;
        const rect = wrapEl.getBoundingClientRect();
        const popH = 340; // approximate popup height
        const spaceBelow = window.innerHeight - rect.bottom;

        popup.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 290)) + 'px';
        if (spaceBelow >= popH || spaceBelow > rect.top) {
            popup.style.top = (rect.bottom + 4) + 'px';
        } else {
            popup.style.top = (rect.top - popH - 4) + 'px';
        }
    }

    function _open(instance) {
        if (activeInstance === instance) { _close(); return; }
        _ensurePopup();
        activeInstance = instance;

        // Set view to selected date or today
        const d = instance._selectedDate || new Date();
        instance._viewYear = d.getFullYear();
        instance._viewMonth = d.getMonth();

        // Reset to calendar if panel was open
        if (ymPanelOpen) _closeYMPanel();

        // Show/hide time & now button
        const isDatetime = instance.mode === 'datetime';
        popup.querySelector('.datepicker-time').style.display = isDatetime ? 'flex' : 'none';
        popup.querySelector('.datepicker-btn--now').style.display = instance.showNowButton ? 'inline-block' : 'none';

        if (isDatetime && instance._selectedDate) {
            popup.querySelector('.datepicker-hour').value = String(instance._selectedDate.getHours()).padStart(2, '0');
            popup.querySelector('.datepicker-minute').value = String(instance._selectedDate.getMinutes()).padStart(2, '0');
        } else if (isDatetime) {
            const now = new Date();
            popup.querySelector('.datepicker-hour').value = String(now.getHours()).padStart(2, '0');
            popup.querySelector('.datepicker-minute').value = String(now.getMinutes()).padStart(2, '0');
        }

        _renderGrid();
        _position(instance.wrapEl);
        popup.setAttribute('data-visible', 'true');
    }

    function _close() {
        if (popup) popup.setAttribute('data-visible', 'false');
        activeInstance = null;
    }

    // ── Instance ──

    class DatePickerInstance {
        constructor(el, options = {}) {
            this.hiddenInput = el;
            this.mode = options.mode || el.dataset.datepicker || 'date';
            if (this.mode === '' || this.mode === 'true') this.mode = 'date';
            this.showNowButton = options.showNowButton || el.hasAttribute('data-datepicker-now');
            this.onChange = options.onChange || null;
            this._selectedDate = null;
            this._viewYear = new Date().getFullYear();
            this._viewMonth = new Date().getMonth();

            this._build();
            this._parseExisting();
        }

        _build() {
            const el = this.hiddenInput;

            // Wrap
            const wrap = document.createElement('div');
            wrap.className = 'datepicker-wrap';
            el.parentNode.insertBefore(wrap, el);
            wrap.appendChild(el);
            this.wrapEl = wrap;

            // Ensure hidden
            el.type = 'hidden';

            // Visible input
            const display = document.createElement('input');
            display.type = 'text';
            display.readOnly = true;
            display.className = 'datepicker-input form-input';
            display.placeholder = el.placeholder || (this.mode === 'datetime' ? 'ДД.ММ.ГГГГ ЧЧ:мм' : 'ДД.ММ.ГГГГ');
            display.id = (el.id || el.name || '') + '_display';
            display.autocomplete = 'off';
            wrap.insertBefore(display, el);
            this.displayInput = display;

            // Icon button
            const icon = document.createElement('button');
            icon.type = 'button';
            icon.className = 'datepicker-icon';
            icon.title = 'Выбрать дату';
            icon.innerHTML = CALENDAR_SVG;
            wrap.appendChild(icon);

            // Events
            const toggle = (e) => { e.stopPropagation(); _open(this); };
            display.addEventListener('click', toggle);
            icon.addEventListener('click', toggle);

            el._datepicker = this;
        }

        _parseExisting() {
            const val = this.hiddenInput.value;
            if (!val) return;

            if (this.mode === 'datetime' && val.includes('T')) {
                const [datePart, timePart] = val.split('T');
                const [y, m, d] = datePart.split('-').map(Number);
                const [h, mi] = timePart.split(':').map(Number);
                this._selectedDate = new Date(y, m - 1, d, h, mi);
            } else {
                const parts = val.split('-').map(Number);
                if (parts.length === 3) {
                    this._selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
                }
            }
            this._updateDisplay();
        }

        _setDate(y, m, d, h, mi) {
            const pad = n => String(n).padStart(2, '0');
            if (this.mode === 'datetime' && h != null) {
                this._selectedDate = new Date(y, m, d, h, mi);
                this.hiddenInput.value = `${y}-${pad(m + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
            } else {
                this._selectedDate = new Date(y, m, d);
                this.hiddenInput.value = `${y}-${pad(m + 1)}-${pad(d)}`;
            }
            this._updateDisplay();
            this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            if (this.onChange) this.onChange(this.hiddenInput.value);
        }

        _clear() {
            this._selectedDate = null;
            this.hiddenInput.value = '';
            this.displayInput.value = '';
            this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            if (this.onChange) this.onChange('');
        }

        _updateDisplay() {
            if (!this._selectedDate) { this.displayInput.value = ''; return; }
            const d = this._selectedDate;
            const pad = n => String(n).padStart(2, '0');
            let text = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
            if (this.mode === 'datetime') {
                text += ` ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }
            this.displayInput.value = text;
        }

        /** Programmatic set (external code) */
        setValue(isoValue) {
            this.hiddenInput.value = isoValue || '';
            this._selectedDate = null;
            if (isoValue) this._parseExisting();
            else this.displayInput.value = '';
        }
    }

    // ── Public API ──

    function initAll(root) {
        root = root || document;
        const els = root.querySelectorAll('[data-datepicker]');
        const instances = [];
        els.forEach(el => {
            if (el._datepicker) return; // already initialized
            instances.push(new DatePickerInstance(el));
        });
        return instances;
    }

    function create(el, options) {
        if (el._datepicker) return el._datepicker;
        return new DatePickerInstance(el, options);
    }

    return { initAll, create };
})();
