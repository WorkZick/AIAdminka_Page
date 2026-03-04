/**
 * RoleGuard - Управление правами доступа на основе ролей
 *
 * ИЕРАРХИЯ ПРАВ:
 * 1. Admin - полные права, устанавливает права для Leader
 * 2. Leader - права от Admin, назначает права сотрудникам (только из своих)
 * 3. Employee - права от Leader (не больше чем у Leader)
 *
 * Роли: admin, leader, assistant, sales, partners_mgr, payments, antifraud, tech, guest
 * Модули: partners, partner-onboarding, team-info, traffic, reports, settings, documentation, team-management, admin-panel
 */
const RoleGuard = {
    // Данные пользователя
    user: null,
    permissions: null,
    initialized: false,

    // Настройки кеширования
    CACHE_KEY: 'roleGuard',
    CACHE_TTL: 300000, // 5 минут
    STALE_MAX_AGE: 420000, // 7 минут — максимальный возраст stale-кеша (TTL=5мин + 2мин stale)


    /**
     * Инициализация RoleGuard
     * Загружает роль и права пользователя с бэкенда
     *
     * Стратегия загрузки (stale-while-revalidate):
     * 1. Свежий кеш (< 5 мин) → мгновенный показ
     * 2. Stale кеш (5-7 мин) → мгновенный показ + фоновое обновление
     * 3. Нет кеша или кеш > 7 мин → ждём API
     */
    async init() {
        if (this.initialized) return this;

        // Safety-таймаут: показать UI даже если init зависнет
        this._safetyTimer = setTimeout(() => {
            if (!document.body.classList.contains('role-ready')) {
                document.body.classList.add('role-ready');
            }
        }, 5000);

        // 1. Свежий кеш (в пределах TTL)
        const cached = this.getCache();
        if (cached) {
            this.user = cached.user;
            this.permissions = cached.permissions;
            this.initialized = true;
            this.applyUI();
            this.initDOMObserver();
            if (cached.pendingRequestsCount > 0) {
                this.showBadge(cached.pendingRequestsCount);
            }
            return this;
        }

        // 2. Stale кеш (просроченный, но не старше STALE_MAX_AGE)
        const stale = this.getStaleCache();
        if (stale) {
            this.user = stale.user;
            this.permissions = stale.permissions;
            this.initialized = true;
            this.applyUI();
            this.initDOMObserver();
            if (stale.pendingRequestsCount > 0) {
                this.showBadge(stale.pendingRequestsCount);
            }
            // Фоновое обновление (не блокируем UI)
            this.revalidateInBackground();
            return this;
        }

        // 3. Нет кеша — ждём API
        try {
            const apiResponse = await CloudStorage.callApi('getUserRole');
            if (apiResponse.error) {
                throw new Error(apiResponse.error);
            }
            const result = this.convertApiResponse(apiResponse);

            this.user = result.user;
            this.permissions = result.permissions;
            this.setCache(result);
            this.initialized = true;
            this.applyUI();
            this.initDOMObserver();

            if (result.pendingRequestsCount > 0) {
                this.showBadge(result.pendingRequestsCount);
            }
        } catch (e) {
            console.error('[RoleGuard] Init error:', e);

            // Fallback: базовые данные из AuthGuard с ролью guest
            const authUser = typeof AuthGuard !== 'undefined' ? AuthGuard.getUser() : null;
            if (authUser) {
                this.user = {
                    email: authUser.email,
                    name: authUser.name,
                    role: 'guest',
                    status: 'unknown'
                };
                this.permissions = this.buildPermissions(false);
                this.initialized = true;
            }
            // Показать UI даже при ошибке (с guest-правами)
            document.body.classList.add('role-ready');
        }

        // Ревалидация при возврате на вкладку (обнаружение смены роли другим пользователем)
        if (!this._visibilityHandler) {
            this._visibilityHandler = () => {
                if (document.visibilityState === 'visible' && this.initialized) {
                    try {
                        const raw = localStorage.getItem(this.CACHE_KEY);
                        if (raw) {
                            const age = Date.now() - JSON.parse(raw).timestamp;
                            if (age > 10000) {
                                this.revalidateInBackground();
                            }
                        }
                    } catch (e) { /* ignore */ }
                }
            };
            document.addEventListener('visibilitychange', this._visibilityHandler);
        }

        return this;
    },

    /**
     * Конвертация ответа API getUserRole в формат RoleGuard
     * API возвращает { view, edit, delete }, RoleGuard ожидает { canView, canEdit, canDelete }
     */
    convertApiResponse(apiResponse) {
        const user = {
            email: apiResponse.email,
            name: apiResponse.name,
            role: apiResponse.role,
            isAdmin: apiResponse.isAdmin === true,  // v2.2.0: поддержка isAdmin из API
            teamId: apiResponse.teamId,
            teamName: apiResponse.teamName || null,
            status: apiResponse.status,
            picture: apiResponse.picture,
            phone: apiResponse.phone,
            telegram: apiResponse.telegram,
            position: apiResponse.position,
            reddyId: apiResponse.reddyId
        };

        // Конвертируем permissions из { view, edit, delete } в { canView, canEdit, canDelete }
        const permissions = {};
        if (apiResponse.permissions) {
            for (const [module, perm] of Object.entries(apiResponse.permissions)) {
                permissions[module] = {
                    canView: perm.view === true,
                    canEdit: perm.edit === true,
                    canDelete: perm.delete === true
                };
            }
        }

        // Применяем кастомные названия ролей если есть
        if (apiResponse.roleConfig && typeof RolesConfig !== 'undefined') {
            RolesConfig.applyOverrides(apiResponse.roleConfig);
        }

        return {
            user,
            permissions,
            pendingRequestsCount: 0 // TODO: получать из API если нужно
        };
    },

    /**
     * Построение permissions на основе роли
     * @param {boolean} isAdmin - является ли пользователь админом
     * @returns {object} - объект permissions
     */
    buildPermissions(isAdmin) {
        const allModules = ['partners', 'partner-onboarding', 'team-info', 'traffic', 'reports', 'settings', 'documentation', 'team-management', 'admin-panel'];
        const permissions = {};

        if (isAdmin) {
            // Админ имеет полные права на всё
            allModules.forEach(module => {
                permissions[module] = { canView: true, canEdit: true, canDelete: true };
            });
        } else {
            // Временно: все пользователи видят все модули (включая admin-panel)
            // Права редактирования/удаления только у админа
            allModules.forEach(module => {
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
            // Cache save failed silently
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
     * Получить stale-кеш (просроченный, но не старше STALE_MAX_AGE)
     * Используется для stale-while-revalidate: показать старые данные мгновенно,
     * обновить в фоне
     */
    getStaleCache() {
        try {
            const data = localStorage.getItem(this.CACHE_KEY);
            if (!data) return null;

            const parsed = JSON.parse(data);
            const age = Date.now() - parsed.timestamp;

            // Если кеш свежий — getCache() уже обработал
            if (age <= this.CACHE_TTL) return null;

            // Если кеш слишком старый — не используем (безопасность)
            if (age > this.STALE_MAX_AGE) {
                localStorage.removeItem(this.CACHE_KEY);
                return null;
            }

            return parsed;
        } catch (e) {
            return null;
        }
    },

    /**
     * Фоновая ревалидация: обновить данные с API без блокировки UI
     * Если права изменились — переприменить UI
     */
    async revalidateInBackground() {
        try {
            const apiResponse = await CloudStorage.callApi('getUserRole');
            if (apiResponse.error) throw new Error(apiResponse.error);
            const result = this.convertApiResponse(apiResponse);

            // Обновить кеш
            this.setCache(result);

            // Проверить изменились ли права
            const permChanged = JSON.stringify(this.permissions) !== JSON.stringify(result.permissions);
            const roleChanged = this.user?.role !== result.user?.role;

            if (permChanged || roleChanged) {
                this.user = result.user;
                this.permissions = result.permissions;
                this.applyUI();

                // Роль сменилась на guest — редирект на ожидание приглашения
                if (roleChanged && result.user?.role === 'guest' && typeof AuthGuard !== 'undefined') {
                    window.location.href = AuthGuard.getBasePath() + '/login/waiting-invite.html';
                    return;
                }

                // Статус blocked — показать экран блокировки
                if (result.user?.status === 'blocked' && typeof AuthGuard !== 'undefined') {
                    AuthGuard.showBlockedScreen();
                    return;
                }
            }
        } catch (e) {
            // Фоновая ревалидация провалилась — stale данные остаются
        }
    },

    /**
     * Проверка доступа к модулю (view)
     */
    canAccess(module) {
        if (!this.user) return false;
        // v2.2.0: Проверяем role='admin' ИЛИ isAdmin=true (может быть leader и admin одновременно)
        if (this.user.role === 'admin' || this.user.isAdmin === true) return true;

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
        // v2.2.0: Проверяем role='admin' ИЛИ isAdmin=true
        if (this.user.role === 'admin' || this.user.isAdmin === true) return true;
        // Руководитель всегда может управлять командой
        if (this.user.role === 'leader' && module === 'team-management') return true;
        return this.permissions?.[module]?.canEdit === true;
    },

    /**
     * Проверка права на удаление
     */
    canDelete(module) {
        if (!this.user) return false;
        // v2.2.0: Проверяем role='admin' ИЛИ isAdmin=true
        if (this.user.role === 'admin' || this.user.isAdmin === true) return true;
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
        // v2.2.0: Учитываем isAdmin
        return this.user?.role === 'admin' || this.user?.isAdmin === true || this.user?.role === 'leader';
    },

    /**
     * Проверка: является ли пользователь админом (v2.2.0)
     */
    isAdmin() {
        return this.user?.role === 'admin' || this.user?.isAdmin === true;
    },

    /**
     * Получить текущую роль
     */
    getRole() {
        return this.user?.role || null;
    },

    /**
     * Алиас для getRole() - для совместимости с AuthGuard
     */
    getCurrentRole() {
        return this.getRole();
    },

    /**
     * Получить статус пользователя
     * @returns {'active'|'blocked'|'waiting_invite'|'pending'|null}
     */
    getStatus() {
        return this.user?.status || null;
    },

    /**
     * Получить ID команды пользователя
     */
    getTeamId() {
        return this.user?.teamId || null;
    },

    /**
     * Получить название команды пользователя
     */
    getTeamName() {
        return this.user?.teamName || null;
    },

    /**
     * Получить название роли на русском
     */
    getRoleName(role) {
        if (typeof RolesConfig !== 'undefined') {
            return RolesConfig.getName(role || this.user?.role);
        }
        return role || this.user?.role || 'Неизвестно';
    },

    /**
     * Получить цвет badge роли
     */
    getRoleColor(role) {
        if (typeof RolesConfig !== 'undefined') {
            return RolesConfig.getColor(role || this.user?.role);
        }
        return '#868e96';
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

        // Элементы только для admin (v2.2.0: учитываем isAdmin)
        document.querySelectorAll('[data-admin-only]').forEach(el => {
            if (this.user?.role !== 'admin' && this.user?.isAdmin !== true) {
                el.style.display = 'none';
            }
        });

        // Элементы только для leader
        document.querySelectorAll('[data-leader-only]').forEach(el => {
            if (this.user?.role !== 'leader' && this.user?.role !== 'admin') {
                el.style.display = 'none';
            }
        });

        // Сигнал: role-based UI готов — CSS снимает visibility: hidden
        document.body.classList.add('role-ready');

        // Очищаем safety-таймаут
        if (this._safetyTimer) {
            clearTimeout(this._safetyTimer);
            this._safetyTimer = null;
        }
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

        let applyScheduled = false;
        this.domObserver = new MutationObserver((mutations) => {
            if (applyScheduled) return;

            let needsReapply = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (targetAttributes.some(attr => node.hasAttribute?.(attr)) ||
                                targetAttributes.some(attr => node.querySelector?.(`[${attr}]`))) {
                                needsReapply = true;
                                break;
                            }
                        }
                    }
                }

                if (mutation.type === 'attributes' && targetAttributes.includes(mutation.attributeName)) {
                    needsReapply = true;
                }

                if (needsReapply) break;
            }

            if (needsReapply) {
                applyScheduled = true;
                requestAnimationFrame(() => {
                    applyScheduled = false;
                    this.applyUI();
                });
            }
        });

        // Наблюдаем за всем документом
        this.domObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: targetAttributes
        });

    },

    /**
     * Остановка наблюдателя
     */
    disconnectDOMObserver() {
        if (this.domObserver) {
            this.domObserver.disconnect();
            this.domObserver = null;
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
        const role = this.user.role || 'employee';

        const _esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        container.innerHTML = `
            <span class="role-badge role-${_esc(role)}">${_esc(roleName)}</span>
        `;

        // Применить цвет для кастомных ролей (без CSS-класса)
        if (typeof RolesConfig !== 'undefined' && RolesConfig.isCustomRole(role)) {
            const badge = container.querySelector('.role-badge');
            if (badge) {
                const color = RolesConfig.getColor(role);
                badge.style.color = color;
                badge.style.background = color + '20';
            }
        }
    },

    // ========== ИЕРАРХИЯ ПРАВ ==========

    /**
     * Получить права, которые текущий пользователь может назначать
     * Admin → может назначать ВСЕ права
     * Leader → может назначать только свои права (или меньше)
     */
    getAssignablePermissions() {
        if (!this.user) return {};

        // Admin может назначать все (v2.2.0: учитываем isAdmin)
        if (this.user.role === 'admin' || this.user.isAdmin === true) {
            return {
                partners: { canView: true, canEdit: true, canDelete: true },
                'partner-onboarding': { canView: true, canEdit: true, canDelete: true },
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

        // Admin может всё (v2.2.0: учитываем isAdmin)
        if (this.user.role === 'admin' || this.user.isAdmin === true) return true;

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

        // Admin может управлять всеми кроме других админов (v2.2.0: учитываем isAdmin)
        if (this.user.role === 'admin' || this.user.isAdmin === true) {
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

        // v2.2.0: учитываем isAdmin
        if (this.user.role === 'admin' || this.user.isAdmin === true) {
            // Admin может назначать все роли кроме admin и guest
            if (typeof RolesConfig !== 'undefined') {
                return RolesConfig.ALL_ROLES.filter(r => r !== 'admin' && r !== 'guest');
            }
            return ['leader', 'assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'];
        }

        if (this.user.role === 'leader') {
            // Leader может назначать только ASSIGNABLE роли
            if (typeof RolesConfig !== 'undefined') {
                return [...RolesConfig.ASSIGNABLE_ROLES];
            }
            return ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'];
        }

        return [];
    }
};

// Очистка кеша при загрузке: удаляем только если старше STALE_MAX_AGE (7 мин)
(function() {
    try {
        const data = localStorage.getItem('roleGuard');
        if (data) {
            const parsed = JSON.parse(data);
            if (Date.now() - parsed.timestamp > RoleGuard.STALE_MAX_AGE) {
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
