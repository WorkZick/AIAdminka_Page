/**
 * PageLifecycle - Централизованный менеджер жизненного цикла страниц
 * Заменяет повторяющийся boilerplate (ComponentLoader → AuthGuard → CloudStorage → init)
 * @version 1.0
 */

const PageLifecycle = {
    _initialized: false,
    _cleanupFns: [],
    /**
     * Инициализация страницы
     * @param {Object} config
     * @param {string} config.module - ID модуля для сайдбара (например 'partners')
     * @param {string} [config.basePath='..'] - Путь к корню ('.' для home, '..' для подпапок)
     * @param {boolean} [config.needsAuth=true] - Нужна ли проверка авторизации
     * @param {boolean} [config.needsCloudStorage=true] - Нужен ли CloudStorage.init()
     * @param {Function} [config.onInit] - Инициализация модуля (загрузка данных)
     * @param {Function} [config.onReady] - Вызывается когда контент виден
     * @param {Function} [config.onDestroy] - Очистка при уходе со страницы
     * @param {Object} [config.modals] - { '#modalId': closeFn } для Escape/backdrop
     */
    async init(config) {
        if (this._initialized) return;
        this._initialized = true;
        // Ждём DOM
        if (document.readyState === 'loading') {
            await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
        }

        const basePath = config.basePath || '..';
        const sharedPath = basePath === '.' ? 'shared' : '../shared';

        // Загружаем shell-компоненты параллельно
        ComponentLoader.init(sharedPath);
        await ComponentLoader.loadAll([
            {
                name: 'sidebar',
                target: '#sidebar-container',
                options: { basePath, activeModule: config.module }
            },
            {
                name: 'about-modal',
                target: '#about-modal-container',
                options: { basePath }
            }
        ]);

        // Auth check
        if (config.needsAuth !== false) {
            if (!await AuthGuard.checkWithRole()) return;
        }

        // CloudStorage
        if (config.needsCloudStorage !== false && typeof CloudStorage !== 'undefined') {
            try {
                await CloudStorage.init();
            } catch (e) {
                if (typeof ErrorHandler !== 'undefined') {
                    ErrorHandler.handle(e, { module: config.module, action: 'cloudStorageInit' });
                }
            }
        }

        // Инициализация модуля (page-loading виден до завершения)
        try {
            if (config.onInit) await config.onInit();
        } catch (error) {
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handle(error, { module: config.module, action: 'init' });
            } else if (typeof Toast !== 'undefined') {
                Toast.error('Ошибка загрузки: ' + error.message);
            }
        }

        // Плавное появление контента (после onInit — данные загружены)
        document.body.classList.add('lifecycle-ready');

        // onReady callback
        if (config.onReady) {
            try { config.onReady(); } catch (e) {
                console.error('[PageLifecycle] onReady error:', e);
            }
        }

        // Централизованные обработчики
        this._setupModalHandlers(config.modals);
        this._setupCleanup(config.onDestroy);
    },

    /**
     * Добавить функцию очистки (будет вызвана при beforeunload)
     */
    addCleanup(fn) {
        this._cleanupFns.push(fn);
    },

    /**
     * Централизованная обработка модалок (Escape + backdrop click)
     */
    _setupModalHandlers(customModals) {
        const escapeHandler = (e) => {
            if (e.key !== 'Escape') return;

            // Кастомные модалки модуля
            if (customModals) {
                for (const [selector, closeFn] of Object.entries(customModals)) {
                    const modal = document.querySelector(selector);
                    if (modal && modal.classList.contains('active')) {
                        closeFn();
                        return;
                    }
                }
            }

            // Generic: закрыть последнюю открытую .modal.active
            const activeModals = document.querySelectorAll('.modal.active');
            if (activeModals.length > 0) {
                activeModals[activeModals.length - 1].classList.remove('active');
            }
        };

        const backdropHandler = (e) => {
            // Клик по самому .modal overlay (не по его дочерним элементам)
            if (!e.target.classList.contains('modal')) return;
            if (!e.target.classList.contains('active')) return;

            if (customModals && customModals['#' + e.target.id]) {
                customModals['#' + e.target.id]();
            } else {
                e.target.classList.remove('active');
            }
        };

        document.addEventListener('keydown', escapeHandler);
        document.addEventListener('click', backdropHandler);

        this._cleanupFns.push(() => {
            document.removeEventListener('keydown', escapeHandler);
            document.removeEventListener('click', backdropHandler);
        });
    },

    /**
     * Регистрация cleanup при уходе со страницы
     */
    _setupCleanup(onDestroy) {
        const cleanup = () => {
            // Модульная очистка
            if (onDestroy) {
                try { onDestroy(); } catch (e) {
                    console.error('[PageLifecycle] onDestroy error:', e);
                }
            }

            // Кастомные cleanup функции
            this._cleanupFns.forEach(fn => {
                try { fn(); } catch (e) {
                    console.error('[PageLifecycle] cleanup error:', e);
                }
            });

            // Очистка shared-модулей
            if (typeof SyncManager !== 'undefined' && SyncManager.destroy) {
                SyncManager.destroy();
            }
        };

        window.addEventListener('beforeunload', cleanup, { once: true });
    }
};

if (typeof window !== 'undefined') {
    window.PageLifecycle = PageLifecycle;
}
