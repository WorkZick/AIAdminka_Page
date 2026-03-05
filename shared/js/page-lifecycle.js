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

        // Параллельно: компоненты UI + CloudStorage (независимы)
        ComponentLoader.init(sharedPath);
        const componentsPromise = ComponentLoader.loadAll([
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

        // CloudStorage init — лёгкий (localStorage), запускаем параллельно
        let csReady = false;
        if (config.needsCloudStorage !== false && typeof CloudStorage !== 'undefined') {
            try {
                csReady = await CloudStorage.init();
            } catch (e) {
                if (typeof ErrorHandler !== 'undefined') {
                    ErrorHandler.handle(e, { module: config.module, action: 'cloudStorageInit' });
                }
            }
        }

        // Ждём компоненты (sidebar нужен для UI)
        await componentsPromise;

        // Auth check
        if (config.needsAuth !== false) {
            if (!await AuthGuard.checkWithRole()) return;
        }

        // Авто-синхронизация профиля — фоновая, не блокирует UI
        this._autoSyncProfile();

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
            try { config.onReady(); } catch (e) { /* silent */ }
        }

        // Централизованные обработчики
        this._setupModalHandlers(config.modals);
        this._setupCleanup(config.onDestroy);
    },

    /**
     * Авто-синхронизация профиля в team-info при первом входе после одобрения
     * Решает проблему: руководитель не появляется в модуле «Сотрудники» без ручного сохранения настроек
     */
    async _autoSyncProfile() {
        try {
            if (typeof RoleGuard === 'undefined' || !RoleGuard.initialized) return;
            if (typeof CloudStorage === 'undefined' || !CloudStorage.isAuthenticated()) return;

            const user = RoleGuard.user;
            if (!user || !user.email) return;

            // Только для активных пользователей с командой (или админов)
            if (user.status !== 'active') return;
            if (!user.teamId && user.role !== 'admin') return;

            // Только роли с правами на employees API (бэкенд запрещает остальным)
            if (user.role !== 'leader' && user.role !== 'admin' && user.isAdmin !== true) return;

            // Проверяем флаг: синхронизация уже выполнена?
            const syncKey = 'profile-synced-' + user.email;
            if (localStorage.getItem(syncKey)) return;

            // Первая синхронизация: создаём/обновляем карточку сотрудника
            const authUser = typeof AuthGuard !== 'undefined' ? AuthGuard.getUser() : null;

            const employeeData = {
                email: user.email,
                fullName: user.name || authUser?.name || '',
                position: user.position || '',
                avatar: user.picture || authUser?.picture || '',
                status: 'Работает',
                reddyId: user.reddyId || '',
                corpEmail: user.email,
                corpTelegram: user.telegram || '',
                corpPhone: user.phone || '',
                predefinedFields: {},
                customFields: {}
            };

            if (employeeData.reddyId) {
                employeeData.predefinedFields['Reddy'] = employeeData.reddyId;
            }
            if (employeeData.corpEmail) {
                employeeData.predefinedFields['Корп. e-mail'] = employeeData.corpEmail;
            }

            // Проверяем существующего сотрудника (только если есть права на employees)
            const canViewEmployees = user.role === 'leader' || user.role === 'admin' || user.isAdmin === true;
            if (canViewEmployees) {
                try {
                    const employees = await CloudStorage.getEmployees();
                    const existing = employees.find(emp => emp.email === user.email || emp.corpEmail === user.email);
                    if (existing) {
                        employeeData.id = existing.id;
                        if (existing.fullName) employeeData.fullName = existing.fullName;
                        if (existing.position) employeeData.position = existing.position;
                        if (existing.status) employeeData.status = existing.status;
                        if (existing.avatar) employeeData.avatar = existing.avatar;
                    }
                } catch (e) {
                    // Не удалось проверить — сохраняем как нового
                }
            }

            await CloudStorage.saveEmployee(employeeData);
            // Ставим флаг после успешного вызова
            localStorage.setItem(syncKey, Date.now().toString());
        } catch (e) {
            console.warn('[PageLifecycle] Auto-sync profile failed:', e.message);
        }
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
                try { onDestroy(); } catch (e) { /* silent */ }
            }

            // Кастомные cleanup функции
            this._cleanupFns.forEach(fn => {
                try { fn(); } catch (e) { /* silent */ }
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
