/* ============================================================
   AIAdminka — PaginationHelper
   Shared stateless pagination component.
   API: PaginationHelper.render(container, {page, pageSize, totalCount, onPageChange})
   ============================================================ */

const PaginationHelper = {
    /**
     * Рендер пагинации в container.
     * При totalCount=0 или totalPages<=1 — container остаётся пустым.
     *
     * @param {HTMLElement} container
     * @param {Object} opts
     * @param {number} opts.page          - текущая страница (1-based)
     * @param {number} opts.pageSize      - записей на странице
     * @param {number} opts.totalCount    - всего записей
     * @param {Function} opts.onPageChange - callback(newPage)
     */
    render(container, { page, pageSize, totalCount, onPageChange }) {
        container.innerHTML = '';

        if (!totalCount || totalCount <= 0) return;

        const totalPages = Math.ceil(totalCount / pageSize);
        if (totalPages <= 1) return;

        const from = (page - 1) * pageSize + 1;
        const to = Math.min(page * pageSize, totalCount);

        // Левая часть: счётчик
        const counter = document.createElement('span');
        counter.className = 'pagination-counter';
        counter.textContent = `Показано ${from}-${to} из ${totalCount}`;

        // Правая часть: кнопки
        const btns = document.createElement('div');
        btns.className = 'pagination-buttons';

        // Prev
        const prev = this._makeBtn('←', page === 1, () => onPageChange(page - 1));
        prev.className = 'btn btn-secondary btn-sm page-btn-prev';
        btns.appendChild(prev);

        // Номера страниц с ellipsis
        const pages = this._getPageNumbers(page, totalPages);
        pages.forEach(p => {
            if (p === '...') {
                const dots = document.createElement('span');
                dots.className = 'pagination-dots';
                dots.textContent = '...';
                btns.appendChild(dots);
            } else {
                const isActive = p === page;
                const btn = this._makeBtn(String(p), isActive, () => onPageChange(p));
                btn.className = 'btn btn-sm ' + (isActive ? 'btn-primary' : 'btn-secondary');
                btns.appendChild(btn);
            }
        });

        // Next
        const next = this._makeBtn('→', page === totalPages, () => onPageChange(page + 1));
        next.className = 'btn btn-secondary btn-sm page-btn-next';
        btns.appendChild(next);

        container.appendChild(counter);
        container.appendChild(btns);
    },

    /**
     * Создать кнопку.
     * @param {string} text
     * @param {boolean} disabled
     * @param {Function} onClick
     * @returns {HTMLButtonElement}
     */
    _makeBtn(text, disabled, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.disabled = disabled;
        if (!disabled) btn.addEventListener('click', onClick);
        return btn;
    },

    /**
     * Возвращает массив номеров страниц и '...' для ellipsis.
     * При totalPages <= 7 — все страницы без ellipsis.
     *
     * @param {number} current  - текущая страница
     * @param {number} total    - всего страниц
     * @returns {Array<number|string>}
     */
    _getPageNumbers(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

        const pages = [];
        pages.push(1);

        const windowStart = Math.max(2, current - 1);
        let windowEnd = Math.min(total - 1, current + 1);

        // Если нет leading ellipsis (windowStart=2 вплотную к 1) —
        // показываем хотя бы до страницы 3, чтобы избежать [1, 2, '...', N]
        if (windowStart === 2) {
            windowEnd = Math.min(total - 1, Math.max(windowEnd, 3));
        }

        if (windowStart > 2) {
            pages.push('...');
        }

        for (let i = windowStart; i <= windowEnd; i++) {
            pages.push(i);
        }

        if (windowEnd < total - 1) {
            pages.push('...');
        }

        pages.push(total);
        return pages;
    }
};

if (typeof module !== 'undefined') module.exports = PaginationHelper;
