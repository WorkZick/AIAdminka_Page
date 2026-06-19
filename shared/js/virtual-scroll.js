/* ============================================================
   AIAdminka — VirtualScroller
   Shared virtual scroll component for HTML tables.
   API: VirtualScroller.create({container, tbody, colCount, renderRow, overscan})
   ============================================================ */

/**
 * VirtualScroller — Factory for table virtual scrolling.
 * Uses the spacer-TR pattern: two invisible <tr> rows fake total scrollable height.
 * Only the visible window (~20 rows) exists in the DOM at any time.
 *
 * Usage:
 *   const vs = VirtualScroller.create({ container, tbody, colCount, renderRow });
 *   vs.init(items, totalCount, fetchChunk);
 *   // ... on filter change:
 *   vs.reset();
 *   vs.init(newItems, newTotal, fetchChunk);
 *   // ... cleanup:
 *   vs.destroy();
 *
 * create() config:
 *   - container   {HTMLElement}  Scrollable parent div (overflow-y: auto).
 *   - tbody       {HTMLElement}  The <tbody> element to render rows into.
 *   - colCount    {number}       Column count for spacer TD colspan.
 *   - renderRow   {Function}     (item, index) => HTMLTableRowElement. Caller provides row rendering.
 *   - overscan    {number}       Rows to render above/below viewport. Default: 5.
 *
 * Instance methods:
 *   - init(items, totalCount, fetchChunk) — Renders first window, attaches scroll listener.
 *   - setItems(items)   — Update buffer after fetchChunk resolves, re-render current window.
 *   - refresh()         — Re-render current visible window (call after OptimisticManager confirm/rollback).
 *   - reset()           — Set scrollTop=0, startIndex=0, re-render from beginning.
 *   - scrollTo(index)   — Scroll to make row at index visible.
 *   - destroy()         — Remove listeners, clear tbody, remove spacers.
 */
const VirtualScroller = (() => {
    const FALLBACK_ROW_HEIGHT = 48;

    /**
     * Create an isolated VirtualScroller instance.
     * @param {Object} config
     * @param {HTMLElement} config.container   Scrollable parent div.
     * @param {HTMLElement} config.tbody       The <tbody> element.
     * @param {number}      config.colCount    Column count for spacer TD colspan.
     * @param {Function}    config.renderRow   (item, index) => HTMLTableRowElement.
     * @param {number}      [config.overscan]  Extra rows above/below viewport. Default: 5.
     * @returns {{ init, setItems, refresh, reset, scrollTo, destroy }}
     */
    function create(config) {
        const container = config.container;
        const tbody = config.tbody;
        const colCount = config.colCount;
        const renderRow = config.renderRow;
        const overscan = typeof config.overscan === 'number' ? config.overscan : 5;

        // Internal state
        let _items = [];
        let _totalCount = 0;
        let _fetchChunk = null;
        let _rowHeight = FALLBACK_ROW_HEIGHT;
        let _startIndex = 0;
        let _focusedIndex = 0;
        let _rafPending = false;
        let _fetchPending = false;
        let _initialized = false;

        // Spacer row references
        let _spacerTop = null;
        let _spacerBottom = null;

        // Stored listener references for cleanup
        let _scrollHandler = null;
        let _keydownHandler = null;

        // -------------------------------------------------------
        // Spacer TR creation
        // -------------------------------------------------------

        function _createSpacer(className) {
            const tr = document.createElement('tr');
            tr.className = 'vs-spacer ' + className;
            tr.setAttribute('aria-hidden', 'true');
            const td = document.createElement('td');
            td.setAttribute('colspan', String(colCount));
            td.style.cssText = 'height: 0px; padding: 0; border: none; background: transparent; line-height: 0;';
            tr.appendChild(td);
            return tr;
        }

        function _setSpacerHeight(spacer, height) {
            spacer.firstChild.style.height = Math.max(0, height) + 'px';
        }

        // -------------------------------------------------------
        // Visible range calculation
        // -------------------------------------------------------

        function _getVisibleRange(scrollTop, viewportHeight, totalRows) {
            const start = Math.max(0, Math.floor(scrollTop / _rowHeight) - overscan);
            const end = Math.min(
                totalRows - 1,
                Math.ceil((scrollTop + viewportHeight) / _rowHeight) + overscan
            );
            return { startIndex: start, endIndex: end };
        }

        // -------------------------------------------------------
        // Row height measurement
        // -------------------------------------------------------

        function _measureRowHeight() {
            const firstRow = tbody.querySelector('tr:not(.vs-spacer)');
            if (firstRow) {
                const h = firstRow.getBoundingClientRect().height;
                if (h > 0) {
                    _rowHeight = h;
                }
            }
        }

        // -------------------------------------------------------
        // ARIA attributes
        // -------------------------------------------------------

        function _updateAria(startIndex, visibleCount) {
            const table = tbody.closest('table');
            if (table) {
                table.setAttribute('aria-rowcount', String(_totalCount));
                if (!table.getAttribute('role')) {
                    table.setAttribute('role', 'grid');
                }
            }
            const rows = tbody.querySelectorAll('tr:not(.vs-spacer)');
            for (let i = 0; i < rows.length; i++) {
                rows[i].setAttribute('aria-rowindex', String(startIndex + i + 2)); // +2: header row is 1
            }
        }

        // -------------------------------------------------------
        // DOM recycling render
        // -------------------------------------------------------

        function _render(scrollTop) {
            if (!_initialized || _items.length === 0) return;

            const totalRows = _items.length;
            const { startIndex, endIndex } = _getVisibleRange(
                scrollTop,
                container.clientHeight,
                totalRows
            );
            _startIndex = startIndex;

            const visibleCount = Math.max(0, endIndex - startIndex + 1);

            // Update spacers
            _setSpacerHeight(_spacerTop, startIndex * _rowHeight);
            _setSpacerHeight(_spacerBottom, Math.max(0, (totalRows - endIndex - 1) * _rowHeight));

            // Get existing real rows (excluding spacers)
            const existingRows = Array.from(tbody.querySelectorAll('tr:not(.vs-spacer)'));

            // Recycle: add rows if needed
            while (existingRows.length < visibleCount) {
                const newRow = renderRow(_items[startIndex + existingRows.length], startIndex + existingRows.length);
                newRow.setAttribute('tabindex', '-1');
                tbody.insertBefore(newRow, _spacerBottom);
                existingRows.push(newRow);
            }

            // Recycle: remove excess rows
            while (existingRows.length > visibleCount) {
                const removed = existingRows.pop();
                if (removed && removed.parentNode === tbody) {
                    tbody.removeChild(removed);
                }
            }

            // Update content of existing rows
            const currentRows = tbody.querySelectorAll('tr:not(.vs-spacer)');
            for (let i = 0; i < currentRows.length; i++) {
                const itemIndex = startIndex + i;
                if (itemIndex < _items.length) {
                    const freshRow = renderRow(_items[itemIndex], itemIndex);
                    freshRow.setAttribute('tabindex', '-1');
                    // Copy attributes and children from fresh row
                    currentRows[i].replaceWith(freshRow);
                }
            }

            // Re-query after replace
            const renderedRows = tbody.querySelectorAll('tr:not(.vs-spacer)');

            // Roving tabindex: focused row gets tabindex=0
            for (let i = 0; i < renderedRows.length; i++) {
                const rowIndex = startIndex + i;
                renderedRows[i].setAttribute('tabindex', rowIndex === _focusedIndex ? '0' : '-1');
            }

            // Update ARIA
            _updateAria(startIndex, renderedRows.length);

            // Trigger fetchChunk if near buffer end
            if (_fetchChunk && !_fetchPending) {
                const threshold = overscan * 2;
                if (endIndex + threshold >= _items.length && _items.length < _totalCount) {
                    _fetchPending = true;
                    const nextPage = Math.floor(_items.length / 200) + 1;
                    _fetchChunk(nextPage, 200).finally(() => {
                        _fetchPending = false;
                    });
                }
            }
        }

        // -------------------------------------------------------
        // Public: init
        // -------------------------------------------------------

        /**
         * Render first window and attach scroll/keydown listeners.
         * @param {Array}    items       Buffer array of items.
         * @param {number}   totalCount  Total dataset size (for spacer math and ARIA).
         * @param {Function} [fetchChunk] (page, pageSize) => Promise — optional chunk loader.
         */
        function init(items, totalCount, fetchChunk) {
            _items = items;
            _totalCount = totalCount;
            _fetchChunk = fetchChunk || null;
            _startIndex = 0;
            _focusedIndex = 0;
            _fetchPending = false;
            _initialized = true;

            // Add vs-container class for CSS containment
            container.classList.add('vs-container');

            // Clear tbody and insert spacers
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }

            _spacerTop = _createSpacer('vs-spacer-top');
            _spacerBottom = _createSpacer('vs-spacer-bottom');
            tbody.appendChild(_spacerTop);
            tbody.appendChild(_spacerBottom);

            // Render first window
            _render(container.scrollTop);

            // Measure row height after first render
            _measureRowHeight();

            // Re-render with measured height
            _render(container.scrollTop);

            // Attach scroll listener (rAF throttle, passive)
            _scrollHandler = () => {
                if (!_rafPending) {
                    _rafPending = true;
                    requestAnimationFrame(() => {
                        _render(container.scrollTop);
                        _rafPending = false;
                    });
                }
            };
            container.addEventListener('scroll', _scrollHandler, { passive: true });

            // Attach keydown listener for arrow key navigation
            _keydownHandler = (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    _focusedIndex = Math.min(_items.length - 1, _focusedIndex + 1);
                    scrollTo(_focusedIndex);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    _focusedIndex = Math.max(0, _focusedIndex - 1);
                    scrollTo(_focusedIndex);
                }
            };
            container.addEventListener('keydown', _keydownHandler);
        }

        // -------------------------------------------------------
        // Public: setItems
        // -------------------------------------------------------

        /**
         * Update buffer after fetchChunk resolves, re-render current window.
         * @param {Array} items  Updated items buffer.
         */
        function setItems(items) {
            _items = items;
            _render(container.scrollTop);
        }

        // -------------------------------------------------------
        // Public: refresh
        // -------------------------------------------------------

        /**
         * Re-render current visible window from current items buffer.
         * Call after OptimisticManager confirm() or rollback().
         */
        function refresh() {
            _render(container.scrollTop);
        }

        // -------------------------------------------------------
        // Public: reset
        // -------------------------------------------------------

        /**
         * Set scrollTop=0 and re-render from index 0.
         * Call on filter/search change.
         */
        function reset() {
            container.scrollTop = 0;
            _startIndex = 0;
            _focusedIndex = 0;
            _render(0);
        }

        // -------------------------------------------------------
        // Public: scrollTo
        // -------------------------------------------------------

        /**
         * Scroll to make row at the given index visible, then focus it.
         * @param {number} index  Logical row index to scroll to.
         */
        function scrollTo(index) {
            if (index < 0 || index >= _items.length) return;

            const targetScrollTop = Math.max(
                0,
                index * _rowHeight - container.clientHeight / 2
            );
            container.scrollTop = targetScrollTop;
            _render(container.scrollTop);

            // Focus the rendered row
            const targetRow = tbody.querySelector('[aria-rowindex="' + (index + 2) + '"]');
            if (targetRow) {
                targetRow.setAttribute('tabindex', '0');
                targetRow.focus();
            }
        }

        // -------------------------------------------------------
        // Public: destroy
        // -------------------------------------------------------

        /**
         * Remove scroll and keydown listeners, clear tbody, remove spacers.
         */
        function destroy() {
            if (_scrollHandler) {
                container.removeEventListener('scroll', _scrollHandler, { passive: true });
                _scrollHandler = null;
            }
            if (_keydownHandler) {
                container.removeEventListener('keydown', _keydownHandler);
                _keydownHandler = null;
            }

            container.classList.remove('vs-container');

            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }

            _spacerTop = null;
            _spacerBottom = null;
            _items = null;
            _rafPending = false;
            _fetchPending = false;
            _initialized = false;
        }

        return { init, setItems, refresh, reset, scrollTo, destroy };
    }

    return { create };
})();

// Экспорт для тестов (Vitest / Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualScroller;
}
