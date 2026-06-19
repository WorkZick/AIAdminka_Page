/**
 * EventManager — централизованная регистрация event listeners с Map-tracked registry.
 *
 * Зачем: автоматическая очистка всех listeners через destroyAll() — устраняет memory leaks
 * при двойном init() / навигации между страницами.
 *
 * API:
 *   EventManager.on(el, event, handler, options)   — register + add listener
 *   EventManager.off(el, event, handler, options)  — remove specific listener
 *   EventManager.destroyAll()                       — remove all + clear registry
 *
 * Подключать после utils.js, перед модулями страницы.
 *
 * Status (Phase 21): создан и доступен в window. НЕ интегрирован в существующие модули.
 * Реальное использование начнётся в Phase 24 (ModuleFactory) и Phase 27 (mass migration).
 */

const EventManager = {
    _handlers: new Map(),

    /**
     * Регистрирует event listener и добавляет запись в _handlers Map для последующей destroyAll().
     * @param {EventTarget} el - элемент-цель
     * @param {string} event - имя события (например 'click', 'input')
     * @param {Function} handler - обработчик
     * @param {Object|boolean} [options] - addEventListener options (passive, capture, once)
     */
    on(el, event, handler, options) {
        el.addEventListener(event, handler, options);
        if (!this._handlers.has(el)) this._handlers.set(el, []);
        this._handlers.get(el).push({ event, handler, options });
    },

    /**
     * Снимает конкретный listener. НЕ удаляет запись из _handlers Map (упрощённое поведение).
     * Для полной очистки используйте destroyAll().
     */
    off(el, event, handler, options) {
        el.removeEventListener(event, handler, options);
    },

    /**
     * Снимает ВСЕ зарегистрированные listeners со ВСЕХ элементов и очищает Map registry.
     * Вызывать в onDestroy() / disconnectedCallback / beforeunload.
     */
    destroyAll() {
        for (const [el, handlers] of this._handlers) {
            handlers.forEach(({ event, handler, options }) =>
                el.removeEventListener(event, handler, options));
        }
        this._handlers.clear();
    }
};

// Browser global export (production usage via <script src="...">)
if (typeof window !== 'undefined') {
    window.EventManager = EventManager;
}

// CommonJS export for vitest unit tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventManager;
}
