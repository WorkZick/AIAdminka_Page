/**
 * RoleGuard - Управление правами доступа на основе ролей
 *
 * ИЕРАРХИЯ ПРАВ:
 * 1. Admin - полные права, устанавливает права для Leader
 * 2. Leader - права от Admin, назначает права сотрудникам (только из своих)
 * 3. Employee - права от Leader (не больше чем у Leader)
 *
 * Роли: admin, leader, assistant, sales, partners_mgr, payments, antifraud, tech
 * Модули: partners, team-info, traffic, reports, settings, documentation, team-management, admin-panel
 */
const RoleGuard = {
    // Данные пользователя
    user: null,
    permissions: null,
    initialized: false,

    // Настройки кеширования
    CACHE_KEY: 'roleGuard',
    CACHE_TTL: 300000, // 5 минут

    // Mock режим для тестирования без backend
    USE_MOCK_API: false,

    /**
     * Mock данные для тестирования
     */
    MOCK_DATA: {
        // Текущий пользователь (можно менять для тестирования)
        // Варианты: 'admin', 'leader', 'employee'
        mockUserType: 'admin',

        users: {
            admin: {
                user: {
                    email: 'admin@example.com',
                    name: 'Администратор',
                    reddyId: '12345678901',
                    role: 'admin',
                    teamId: '',
                    status: 'active',
                    picture: '',
                    phone: '+7 999 123-45-67',
                    telegram: 'admin_tg',
                    position: 'Администратор системы'
                },
                team: null,
                permissions: {
                    partners: { canView: true, canEdit: true, canDelete: true },
                    'team-info': { canView: true, canEdit: true, canDelete: true },
                    traffic: { canView: true, canEdit: true, canDelete: true },
                    reports: { canView: true, canEdit: true, canDelete: true },
                    settings: { canView: true, canEdit: true, canDelete: true },
                    documentation: { canView: true, canEdit: true, canDelete: true },
                    'team-management': { canView: true, canEdit: true, canDelete: true },
                    'admin-panel': { canView: true, canEdit: true, canDelete: true }
                },
                pendingRequestsCount: 0
            },
            leader: {
                user: {
                    email: 'leader@example.com',
                    name: 'Руководитель команды',
                    reddyId: '98765432101',
                    role: 'leader',
                    teamId: 'team-001',
                    status: 'active',
                    picture: '',
                    phone: '+7 999 765-43-21',
                    telegram: 'leader_tg',
                    position: 'Руководитель'
                },
                team: {
                    id: 'team-001',
                    name: 'Команда Alpha',
                    leaderName: 'Руководитель команды',
                    membersCount: 5
                },
                permissions: {
                    partners: { canView: true, canEdit: true, canDelete: true },
                    'team-info': { canView: true, canEdit: true, canDelete: true },
                    traffic: { canView: true, canEdit: true, canDelete: true },
                    reports: { canView: true, canEdit: true, canDelete: true },
                    settings: { canView: true, canEdit: true, canDelete: false },
                    documentation: { canView: true, canEdit: false, canDelete: false },
                    'team-management': { canView: true, canEdit: true, canDelete: true },
                    'admin-panel': { canView: false, canEdit: false, canDelete: false }
                },
                pendingRequestsCount: 0
            },
            employee: {
                user: {
                    email: 'employee@example.com',
                    name: 'Сотрудник',
                    reddyId: '11122233344',
                    role: 'sales',
                    teamId: 'team-001',
                    status: 'active',
                    picture: '',
                    phone: '+7 999 111-22-33',
                    telegram: 'employee_tg',
                    position: 'Менеджер по продажам'
                },
                team: {
                    id: 'team-001',
                    name: 'Команда Alpha',
                    leaderName: 'Руководитель команды',
                    membersCount: 5
                },
                permissions: {
                    partners: { canView: true, canEdit: true, canDelete: false },
                    'team-info': { canView: true, canEdit: false, canDelete: false },
                    traffic: { canView: true, canEdit: false, canDelete: false },
                    reports: { canView: true, canEdit: false, canDelete: false },
                    settings: { canView: true, canEdit: true, canDelete: false },
                    documentation: { canView: true, canEdit: false, canDelete: false },
                    'team-management': { canView: false, canEdit: false, canDelete: false },
                    'admin-panel': { canView: false, canEdit: false, canDelete: false }
                },
                pendingRequestsCount: 0
            }
        }
    },

    /**
     * Инициализация RoleGuard
     */
    async init() {
        if (this.initialized) return this;

        // Проверяем кеш
        const cached = this.getCache();
        if (cached) {
            this.user = cached.user;
            this.permissions = cached.permissions;
            this.initialized = true;
            this.applyUI();
            this.initDOMObserver();

            // Badge для руководителя/админа
            if (cached.pendingRequestsCount > 0) {
                this.showBadge(cached.pendingRequestsCount);
            }
            return this;
        }

        // Запрос к API
        try {
            let result;

            if (this.USE_MOCK_API) {
                result = await this.mockGetCurrentUser();
            } else {
                // Получаем email пользователя из AuthGuard
                const authUser = AuthGuard.getUser();
                if (!authUser) {
                    console.warn('[RoleGuard] No authenticated user');
                    return this;
                }

                // Проверяем права админа через существующий API
                const isAdmin = await CloudStorage.callApi('checkIsAdmin');

                // Строим результат в ожидаемом формате
                result = {
                    user: {
                        email: authUser.email,
                        name: authUser.name,
                        role: isAdmin.isAdmin ? 'admin' : 'user'
                    },
                    permissions: this.buildPermissions(isAdmin.isAdmin),
                    pendingRequestsCount: 0 // TODO: получать из API когда будет доступен
                };
            }

            this.user = result.user;
            this.permissions = result.permissions;
            this.setCache(result);
            this.initialized = true;
            this.applyUI();
            this.initDOMObserver();

            // Badge для руководителя/админа
            if (result.pendingRequestsCount > 0) {
                this.showBadge(result.pendingRequestsCount);
            }
        } catch (e) {
            console.error('[RoleGuard] Init error:', e);
        }

        return this;
    },

    /**
     * Mock API: получить текущего пользователя
     */
    async mockGetCurrentUser() {
        await new Promise(r => setTimeout(r, 100)); // Имитация задержки

        // Получаем email из AuthGuard
        let userEmail = '';
        if (typeof AuthGuard !== 'undefined') {
            const authUser = AuthGuard.getUser();
            if (authUser) {
                userEmail = authUser.email || '';
            }
        }

        // Используем mockUserType из MOCK_DATA
        const mockType = this.MOCK_DATA.mockUserType;
        const result = this.MOCK_DATA.users[mockType] || this.MOCK_DATA.users.employee;

        // Подставляем реальный email если есть
        if (userEmail && result.user) {
            result.user.email = userEmail;
        }

        return result;
    },

    /**
     * Построение permissions на основе роли
     * @param {boolean} isAdmin - является ли пользователь админом
     * @returns {object} - объект permissions
     */
    buildPermissions(isAdmin) {
        const allModules = ['partners', 'team-info', 'traffic', 'reports', 'settings', 'documentation', 'team-management', 'admin-panel'];
        const permissions = {};

        if (isAdmin) {
            // Админ имеет полные права на всё
            allModules.forEach(module => {
                permissions[module] = { canView: true, canEdit: true, canDelete: true };
            });
        } else {
            // Обычный пользователь имеет только права просмотра некоторых модулей
            ['partners', 'team-info', 'documentation', 'reports'].forEach(module => {
                permissions[module] = { canView: true, canEdit: false, canDelete: false };
            });
        }

        return permissions;
    },

    /**
     * Получить данные из кеша
     */
    getCache() {
        try {
            const data = localStorage.getItem(this.CACHE_KEY);
            if (!data) return null;

            const parsed = JSON.parse(data);
            if (Date.now() - parsed.timestamp > this.CACHE_TTL) {
                localStorage.removeItem(this.CACHE_KEY);
                return null;
            }
            return parsed;
        } catch (e) {
            return null;
        }
    },

    /**
     * Сохранить данные в кеш
     */
    setCache(data) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                ...data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[RoleGuard] Cache save error:', e);
        }
    },

    /**
     * Очистить кеш
     */
    clearCache() {
        localStorage.removeItem(this.CACHE_KEY);
        this.user = null;
        this.permissions = null;
        this.initialized = false;
    },

    /**
     * Проверка доступа к модулю (view)
     */
    canAccess(module) {
        if (!this.user) return false;
        if (this.user.role === 'admin') return true;

        // Главная страница доступна всем
        if (module === 'home') return true;

        // Руководитель всегда имеет доступ к team-management
        if (this.user.role === 'leader' && module === 'team-management') return true;

        return this.permissions?.[module]?.canView === true;
    },

    /**
     * Проверка права на редактирование
     */
    canEdit(module) {
        if (!this.user) return false;
        if (this.user.role === 'admin') return true;
        return this.permissions?.[module]?.canEdit === true;
    },

    /**
     * Проверка права на удаление
     */
    canDelete(module) {
        if (!this.user) return false;
        if (this.user.role === 'admin') return true;
        return this.permissions?.[module]?.canDelete === true;
    },

    /**
     * Проверка роли
     */
    hasRole(role) {
        return this.user?.role === role;
    },

    /**
     * Проверка: admin или leader
     */
    isAdminOrLeader() {
        return this.user?.role === 'admin' || this.user?.role === 'leader';
    },

    /**
     * Получить текущую роль
     */
    getRole() {
        return this.user?.role || null;
    },

    /**
     * Получить название роли на русском
     */
    getRoleName(role) {
        const names = {
            admin: 'Администратор',
            leader: 'Руководитель',
            assistant: 'Помощник',
            sales: 'Менеджер по продажам',
            partners_mgr: 'Менеджер по партнёрам',
            payments: 'Платёжные системы',
            antifraud: 'Антифрод',
            tech: 'Технический специалист'
        };
        return names[role || this.user?.role] || role || 'Неизвестно';
    },

    /**
     * Получить цвет badge роли
     */
    getRoleColor(role) {
        const colors = {
            admin: '#ff6b6b',
            leader: '#4dabf7',
            assistant: '#69db7c',
            sales: '#ffd43b',
            partners_mgr: '#da77f2',
            payments: '#38d9a9',
            antifraud: '#ff922b',
            tech: '#748ffc'
        };
        return colors[role || this.user?.role] || '#868e96';
    },

    /**
     * Применить UI ограничения
     */
    applyUI() {
        if (!this.initialized) return;

        // Скрыть недоступные пункты меню в sidebar
        document.querySelectorAll('[data-module]').forEach(el => {
            const module = el.dataset.module;
            if (!this.canAccess(module)) {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });

        // Скрыть карточки модулей на главной
        document.querySelectorAll('[data-module-card]').forEach(el => {
            const module = el.dataset.moduleCard;
            if (!this.canAccess(module)) {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });

        // Скрыть кнопки редактирования если нет прав
        document.querySelectorAll('[data-requires-edit]').forEach(el => {
            const module = el.dataset.requiresEdit;
            if (!this.canEdit(module)) {
                el.style.display = 'none';
            }
        });

        // Скрыть кнопки удаления если нет прав
        document.querySelectorAll('[data-requires-delete]').forEach(el => {
            const module = el.dataset.requiresDelete;
            if (!this.canDelete(module)) {
                el.style.display = 'none';
            }
        });

        // Элементы только для admin
        document.querySelectorAll('[data-admin-only]').forEach(el => {
            if (this.user?.role !== 'admin') {
                el.style.display = 'none';
            }
        });

        // Элементы только для leader
        document.querySelectorAll('[data-leader-only]').forEach(el => {
            if (this.user?.role !== 'leader' && this.user?.role !== 'admin') {
                el.style.display = 'none';
            }
        });
    },

    /**
     * Инициализация наблюдателя за изменениями DOM
     * Автоматически применяет права при добавлении новых элементов
     */
    initDOMObserver() {
        if (!this.initialized || this.domObserver) return;

        const targetAttributes = [
            'data-module',
            'data-module-card',
            'data-requires-edit',
            'data-requires-delete',
            'data-admin-only',
            'data-leader-only'
        ];

        this.domObserver = new MutationObserver((mutations) => {
            let needsReapply = false;

            for (const mutation of mutations) {
                // Проверяем добавленные узлы
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Проверяем сам элемент и его потомков
                            if (targetAttributes.some(attr => node.hasAttribute?.(attr)) ||
                                targetAttributes.some(attr => node.querySelector?.(`[${attr}]`))) {
                                needsReapply = true;
                                break;
                            }
                        }
                    }
                }

                // Проверяем изменения атрибутов
                if (mutation.type === 'attributes' && targetAttributes.includes(mutation.attributeName)) {
                    needsReapply = true;
                }

                if (needsReapply) break;
            }

            if (needsReapply) {
                this.applyUI();
            }
        });

        // Наблюдаем за всем документом
        this.domObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: targetAttributes
        });

        console.log('✅ RoleGuard DOM Observer активирован');
    },

    /**
     * Остановка наблюдателя
     */
    disconnectDOMObserver() {
        if (this.domObserver) {
            this.domObserver.disconnect();
            this.domObserver = null;
            console.log('🛑 RoleGuard DOM Observer остановлен');
        }
    },

    /**
     * Показать badge с количеством запросов
     */
    showBadge(count) {
        // Badge в sidebar
        const sidebarBadge = document.getElementById('teamRequestsBadge');
        if (sidebarBadge && count > 0) {
            sidebarBadge.textContent = count > 99 ? '99+' : count;
            sidebarBadge.style.display = 'flex';
        }

        // Badge для admin
        const adminBadge = document.getElementById('adminRequestsBadge');
        if (adminBadge && count > 0 && this.user?.role === 'admin') {
            adminBadge.textContent = count > 99 ? '99+' : count;
            adminBadge.style.display = 'flex';
        }
    },

    /**
     * Проверка доступа к странице
     * Редиректит на главную если нет доступа
     */
    checkPageAccess(module) {
        if (!this.canAccess(module)) {
            console.warn(`[RoleGuard] Access denied to module: ${module}`);

            // Определяем путь к главной
            const path = window.location.pathname;
            const isSubfolder = path.includes('/admin/') ||
                               path.includes('/team-management/') ||
                               path.includes('/partners/') ||
                               path.includes('/team-info/') ||
                               path.includes('/traffic-calculation/') ||
                               path.includes('/excel-reports/') ||
                               path.includes('/documentation/') ||
                               path.includes('/sync/');

            const homeUrl = isSubfolder ? '../index.html' : 'index.html';
            window.location.href = homeUrl;
            return false;
        }
        return true;
    },

    /**
     * Рендер информации о пользователе с ролью
     */
    renderUserBadge(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !this.user) return;

        const roleName = this.getRoleName();
        const roleColor = this.getRoleColor();

        container.innerHTML = `
            <span class="role-badge" style="
                background: ${roleColor}20;
                color: ${roleColor};
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
            ">${roleName}</span>
        `;
    },

    // ========== ИЕРАРХИЯ ПРАВ ==========

    /**
     * Получить права, которые текущий пользователь может назначать
     * Admin → может назначать ВСЕ права
     * Leader → может назначать только свои права (или меньше)
     */
    getAssignablePermissions() {
        if (!this.user) return {};

        // Admin может назначать все
        if (this.user.role === 'admin') {
            return {
                partners: { canView: true, canEdit: true, canDelete: true },
                'team-info': { canView: true, canEdit: true, canDelete: true },
                traffic: { canView: true, canEdit: true, canDelete: true },
                reports: { canView: true, canEdit: true, canDelete: true },
                settings: { canView: true, canEdit: true, canDelete: true },
                documentation: { canView: true, canEdit: true, canDelete: true },
                'team-management': { canView: true, canEdit: true, canDelete: true },
                'admin-panel': { canView: true, canEdit: true, canDelete: true }
            };
        }

        // Leader может назначать только свои права
        if (this.user.role === 'leader') {
            // Копируем свои права (без admin-panel и team-management для сотрудников)
            const assignable = {};
            for (const [module, perms] of Object.entries(this.permissions || {})) {
                // Leader не может давать доступ к admin-panel
                if (module === 'admin-panel') continue;
                // Leader не может давать полный доступ к team-management сотрудникам
                if (module === 'team-management') continue;

                assignable[module] = { ...perms };
            }
            return assignable;
        }

        // Обычные сотрудники не могут назначать права
        return {};
    },

    /**
     * Проверка: может ли текущий пользователь назначить указанное право
     */
    canAssignPermission(module, permission) {
        if (!this.user) return false;

        // Admin может всё
        if (this.user.role === 'admin') return true;

        // Leader - только свои права
        if (this.user.role === 'leader') {
            // Не может давать admin-panel
            if (module === 'admin-panel') return false;
            // Не может давать team-management
            if (module === 'team-management') return false;

            // Может давать только если сам имеет это право
            const myPerm = this.permissions?.[module]?.[permission];
            return myPerm === true;
        }

        return false;
    },

    /**
     * Проверка: может ли текущий пользователь управлять пользователем с указанной ролью
     */
    canManageRole(targetRole) {
        if (!this.user) return false;

        // Admin может управлять всеми кроме других админов
        if (this.user.role === 'admin') {
            return targetRole !== 'admin';
        }

        // Leader может управлять только сотрудниками своей команды
        if (this.user.role === 'leader') {
            return !['admin', 'leader'].includes(targetRole);
        }

        return false;
    },

    /**
     * Получить список ролей, которые может назначать текущий пользователь
     */
    getAssignableRoles() {
        if (!this.user) return [];

        if (this.user.role === 'admin') {
            // Admin может назначать все роли кроме admin
            return ['leader', 'assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'];
        }

        if (this.user.role === 'leader') {
            // Leader может назначать только роли сотрудников
            return ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'];
        }

        return [];
    }
};

// Очистка устаревшего кеша при загрузке (только если прошло больше CACHE_TTL)
(function() {
    try {
        const data = localStorage.getItem('roleGuard');
        if (data) {
            const parsed = JSON.parse(data);
            if (Date.now() - parsed.timestamp > 300000) {
                localStorage.removeItem('roleGuard');
            }
        }
    } catch (e) {
        localStorage.removeItem('roleGuard');
    }
})();

// Экспорт для модульных систем
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoleGuard;
}
