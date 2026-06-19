/**
 * DropdownHelper - вспомогательные функции для shared dropdown компонента
 * (shared/css/components/dropdown.css)
 *
 * Подключать ПОСЛЕ utils.js, ПЕРЕД модулями страницы.
 *
 * Методы:
 *   autoFlip(wrap, options)           — авто-направление раскрытия (вверх/вниз)
 *   toggle(triggerEl, evt)            — открыть/закрыть form-dropdown menu (QWIN-03 + BFIX-15)
 *   select(itemEl, value, label)      — выбрать item: hidden input + label + .active (QWIN-03)
 */

const DropdownHelper = {
    /**
     * Авто-определение направления раскрытия dropdown (вверх/вниз).
     * Добавляет/снимает класс .dropdown-wrap--up в зависимости от доступного места.
     *
     * @param {HTMLElement} wrap - элемент .dropdown-wrap
     * @param {Object} [options]
     * @param {number} [options.margin=16] - запас пространства в пикселях
     * @param {number} [options.fallbackHeight=280] - fallback высоты меню, если не удалось измерить
     */
    autoFlip(wrap, options = {}) {
        if (!wrap || typeof wrap.querySelector !== 'function') return;
        const menu = wrap.querySelector('.dropdown-menu');
        const trigger = wrap.querySelector('.dropdown-trigger');
        if (!menu || !trigger) return;

        const margin = typeof options.margin === 'number' ? options.margin : 16;
        const fallbackHeight = typeof options.fallbackHeight === 'number' ? options.fallbackHeight : 280;

        // Оценка высоты меню: если скрыто — временно показать невидимо для измерения
        const wasHidden = menu.classList.contains('hidden');
        if (wasHidden) {
            menu.classList.remove('hidden');
            menu.style.visibility = 'hidden';
        }
        const menuH = menu.offsetHeight || fallbackHeight;
        if (wasHidden) {
            menu.classList.add('hidden');
            menu.style.visibility = '';
        }

        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow < menuH + margin && spaceAbove > spaceBelow) {
            wrap.classList.add('dropdown-wrap--up');
        } else {
            wrap.classList.remove('dropdown-wrap--up');
        }
    },

    /**
     * Toggle form-dropdown menu visibility (QWIN-03).
     * Закрывает другие открытые .dropdown-wrap--form menus, toggles target menu .hidden класс.
     *
     * BFIX-15: Если evt.type === 'touchend', вызывает preventDefault для предотвращения
     * дабл-fire (touchend + click на mobile/touch устройствах).
     *
     * @param {HTMLElement} triggerEl - .dropdown-trigger--form элемент с data-target атрибутом
     * @param {Event} [evt] - click или touchend event (опциональный, defensive если dispatcher не передал)
     */
    toggle(triggerEl, evt) {
        // BFIX-15: prevent default on touchend (предотвращает дабл-fire click+touchend на mobile)
        if (evt && evt.type === 'touchend' && typeof evt.preventDefault === 'function') {
            evt.preventDefault();
        }
        if (!triggerEl) return;
        const menuId = triggerEl.dataset && triggerEl.dataset.target;
        if (!menuId) return;
        const menu = document.getElementById(menuId);
        if (!menu) return;

        // Закрыть другие открытые form-dropdowns
        document.querySelectorAll('.dropdown-wrap--form .dropdown-menu:not(.hidden)').forEach(m => {
            if (m !== menu) m.classList.add('hidden');
        });
        menu.classList.toggle('hidden');
    },

    /**
     * Select dropdown item — обновляет hidden input, trigger label, .placeholder/.active классы (QWIN-03).
     *
     * Dispatches 'change' event на hidden input (нужно для cascade обработчиков
     * в partner-onboarding и template-change callback'ов).
     *
     * @param {HTMLElement} itemEl - .dropdown-item который был выбран
     * @param {string} value - значение (обычно itemEl.dataset.value)
     * @param {string} label - текст для отображения в trigger (обычно itemEl.textContent)
     */
    select(itemEl, value, label) {
        if (!itemEl) return;
        const menu = itemEl.closest('.dropdown-menu');
        const wrap = itemEl.closest('.dropdown-wrap--form');
        if (!menu || !wrap) return;

        const v = value != null ? value : '';

        // Update hidden input + dispatch change (для cascade обработчиков)
        const input = wrap.querySelector('input[type="hidden"]');
        if (input) {
            input.value = v;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Update trigger label
        const trigger = wrap.querySelector('.dropdown-trigger--form');
        const labelEl = trigger ? trigger.querySelector('span') : null;
        if (labelEl) labelEl.textContent = label;
        if (trigger) trigger.classList.toggle('placeholder', !v);

        // Update active marker
        menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        itemEl.classList.add('active');

        // Close menu
        menu.classList.add('hidden');
    }
};

// Экспорт в window для использования без модульной системы
if (typeof window !== 'undefined') {
    window.DropdownHelper = DropdownHelper;
}

// CommonJS export для тестов через new Function() wrapper
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DropdownHelper;
}
