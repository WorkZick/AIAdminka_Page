/**
 * Admin Panel Module - AIAdminka
 * Панель администратора для управления всей системой
 * Поддерживает Mock API для тестирования
 */

const adminApp = {
    // Состояние
    currentUser: null,
    teams: [],
    users: [],
    requests: [],
    permissions: {},
    auditLog: [],
    currentTab: 'teams',
    editingUser: null,
    editingTeam: null,
    editingStatus: 'active',
    editingTeamActive: true,
    _optimistic: null,
    _optimisticTeams: null,

    // Пагинация пользователей (серверная)
    usersPage: 1,
    usersPageSize: 20,
    usersTotalCount: 0,
    usersServerFilter: {},
    _usersRequestId: 0,

    // Пагинация аудита (cursor)
    auditItems: [],
    auditCursor: null,
    auditTotalCount: 0,
    auditPageSize: 50,
    auditFilters: { dateFrom: '', dateTo: '', action: '' },
    _auditLoading: false,
    vsEnabled: true,
    _auditVS: null,

    // Phase 40 LIT-MIG-01 admin pilot — signal-driven <app-table> для ролей.
    // Атомарная per-table миграция (renderUsers/renderTeams/renderAuditLog мигрированы Phase 46/48/49).
    // Pattern: Phase 25-07 partners pilot bridge approach (mod.effect signal binding).
    _rolesSignal: null,        // window.signal([{id, role, name, color, isSystem}, ...])
    _rolesDisposers: [],       // dispose handles для effect() — cleanup в destroy()
    _rolesTableMounted: false, // flag — columns + effect bound only once

    // Phase 46 LIT-CONT-01 — signal-driven <app-card> grid для команд (continuation Phase 40 pattern).
    // renderTeams() пишет в _teamsSignal → effect() пересобирает <app-card> children внутри #teamsGrid.
    // Cleanup: _teamsDisposers диспозятся в destroy() (Pitfall C — no memory leak).
    // Атомарная per-render миграция (renderUsers/renderAuditLog отложены к Phase 48/49 — Pitfall #12).
    _teamsSignal: null,        // window.signal([{id, name, isActive, leaderName, members, ...}, ...])
    _teamsDisposers: [],       // dispose handles для effect() — cleanup в destroy()
    _teamsGridMounted: false,  // flag — effect bound only once

    // Phase 48 LIT-CONT-02 — signal-driven <app-table> для пользователей (continuation Phase 40 pattern).
    // renderUsers() пишет в _usersSignal → effect() обновляет tableEl.items (Lit диффинг строк).
    // Server-pagination preserved (usersPageSize: 20 — фильтрация/поиск/пагинация на сервере).
    // Cleanup: _usersDisposers диспозятся в destroy() (Pitfall C — no memory leak).
    // Атомарная per-render миграция (renderAuditLog отложен к Phase 49 — Pitfall #12).
    _usersSignal: null,        // window.signal([{id, name, email, picture, role, roleName, teamName, status, ...}, ...])
    _usersDisposers: [],       // dispose handles для effect() — cleanup в destroy()
    _usersTableMounted: false, // flag — columns + effect bound only once

    // Phase 49 LIT-CONT-03 — signal-driven <app-table id="auditLogTable"> для аудит-лога (continuation Phase 40/46/48 pattern).
    // VirtualScroller integration (Phase 19 v2.29, this._auditVS) preserved as-is — VS owns legacy
    // <table id="auditTable"> + <tbody id="auditTbody"> через spacer-TR pattern когда vsEnabled=true.
    // <app-table id="auditLogTable"> — signal-driven mount для non-VS fallback path (vsEnabled=false):
    // _appendAuditItems / resetAndLoadAudit пишут в _auditSignal → Lit cell renderers (XSS-proof через автоэскейп).
    // Cleanup: _auditDisposers диспозятся в destroy() (Pitfall C — no memory leak).
    _auditSignal: null,        // window.signal([{id, action, actionName, iconClass, iconSvg, message, actor, time}, ...])
    _auditDisposers: [],       // dispose handles для effect() — cleanup в destroy()
    _auditTableMounted: false, // flag — columns + effect bound only once

    // Модули
    modules: ['partners', 'partner-onboarding', 'team-info', 'traffic', 'reports', 'settings', 'documentation', 'team-management'],
    moduleNames: {
        'partners': 'Партнёры',
        'partner-onboarding': 'Заведение',
        'team-info': 'Сотрудники',
        'traffic': 'Трафик',
        'reports': 'Отчёты',
        'settings': 'Настройки',
        'documentation': 'Документация',
        'team-management': 'Моя команда'
    },

    // Действия аудита
    actionNames: {
        'user_approved': 'Одобрение',
        'user_rejected': 'Отклонение',
        'user_blocked': 'Блокировка',
        'user_unblocked': 'Разблокировка',
        'user_updated': 'Обновление пользователя',
        'user_deleted': 'Удаление пользователя',
        'role_changed': 'Смена роли',
        'team_created': 'Создание команды',
        'team_updated': 'Обновление команды',
        'team_deleted': 'Удаление команды',
        'team_settings_changed': 'Настройки команды',
        'permissions_changed': 'Изменение прав',
        'invite_sent': 'Приглашение отправлено',
        'invite_accepted': 'Приглашение принято',
        'invite_rejected': 'Приглашение отклонено',
        'storage_init': 'Инициализация хранилища',
        'partner_created': 'Создание партнёра',
        'partner_updated': 'Обновление партнёра',
        'partner_deleted': 'Удаление партнёра',
        'employee_created': 'Создание сотрудника',
        'employee_updated': 'Обновление сотрудника',
        'employee_deleted': 'Удаление сотрудника',
        'image_uploaded': 'Загрузка изображения',
        'image_deleted': 'Удаление изображения',
        'onboarding_created': 'Создание заявки',
        'onboarding_imported': 'Импорт заявки',
        'onboarding_step_submitted': 'Шаг отправлен',
        'onboarding_step_approved': 'Шаг одобрен',
        'onboarding_step_rejected': 'Шаг отклонён',
        'onboarding_completed': 'Онбординг завершён',
        'onboarding_cancelled': 'Онбординг отменён',
        'onboarding_reactivated': 'Онбординг восстановлен',
        'onboarding_reassigned': 'Онбординг передан',
        'onboarding_rolled_back': 'Онбординг откачен',
        'onboarding_withdrawn': 'Онбординг отозван',
        'onboarding_deleted': 'Удаление заявок',
        'onboarding_file_uploaded': 'Файл онбординга загружен',
        'onboarding_settings_updated': 'Настройки онбординга'
    },

    // ============ INITIALIZATION ============

    async init() {
        const loadingState = document.getElementById('adminLoadingState');
        this.loadUserData();
        this.populateAuditFilter();
        try {
            await this.loadAllData();
        } finally {
            if (loadingState) loadingState.classList.add('hidden');
            const tabs = document.getElementById('adminTabsContainer');
            if (tabs) tabs.classList.remove('hidden');
            if (typeof DatePicker !== 'undefined') DatePicker.initAll();
            // Phase 67 SYNC-FIX-05: cross-USER polling — admin видит новые
            // registration requests / изменения users/teams без manual refresh.
            // 30s интервал (heavier endpoint, чем team-info getEmployees),
            // visibility-aware pause + immediate refresh при возврате на вкладку.
            this._startCrossUserPoll();
        }
    },

    // Phase 67 SYNC-FIX-05: cross-user polling state + helpers
    _crossUserPollIntervalId: null,
    _crossUserPollVisibilityHandler: null,
    _crossUserPollInProgress: false,
    CROSS_USER_POLL_INTERVAL: 30000, // 30s — admin endpoint heavier (full getAdminData)

    _startCrossUserPoll() {
        this._stopCrossUserPoll();
        const tick = () => this._crossUserPollTick();
        this._crossUserPollIntervalId = setInterval(tick, this.CROSS_USER_POLL_INTERVAL);

        this._crossUserPollVisibilityHandler = () => {
            if (document.hidden) {
                this._stopCrossUserPollInterval();
            } else {
                tick(); // immediate refresh on return-to-tab
                if (!this._crossUserPollIntervalId) {
                    this._crossUserPollIntervalId = setInterval(tick, this.CROSS_USER_POLL_INTERVAL);
                }
            }
        };
        document.addEventListener('visibilitychange', this._crossUserPollVisibilityHandler);
    },

    _stopCrossUserPollInterval() {
        if (this._crossUserPollIntervalId) {
            clearInterval(this._crossUserPollIntervalId);
            this._crossUserPollIntervalId = null;
        }
    },

    _stopCrossUserPoll() {
        this._stopCrossUserPollInterval();
        if (this._crossUserPollVisibilityHandler) {
            document.removeEventListener('visibilitychange', this._crossUserPollVisibilityHandler);
            this._crossUserPollVisibilityHandler = null;
        }
    },

    async _crossUserPollTick() {
        // Reentrance guard: пропустить tick если предыдущий запрос ещё идёт
        if (this._crossUserPollInProgress) return;
        // Skip если есть pending optimistic ops (parity с team-info SYNC-FIX-05)
        if (this._optimistic && this._optimistic.getPendingCount && this._optimistic.getPendingCount() > 0) return;
        if (this._optimisticTeams && this._optimisticTeams.getPendingCount && this._optimisticTeams.getPendingCount() > 0) return;
        // Skip если открыта любая модалка (admin может редактировать team/user/role — re-render
        // во время редактирования сломает form state). Возобновится при закрытии модалки + след tick.
        if (document.querySelector('.modal-overlay.active, .modal.active, app-modal[open]')) return;

        this._crossUserPollInProgress = true;
        try {
            await this.loadAllData();
        } catch (err) {
            console.warn('[admin] cross-user poll failed:', err && err.message);
        } finally {
            this._crossUserPollInProgress = false;
        }
    },

    attachEventListeners() {
        // Delegate for all input events (filters, searches) — debounced
        this._filterTimer = null;
        this._inputHandler = (e) => {
            const action = e.target.dataset.action;
            if (!action) return;
            clearTimeout(this._filterTimer);
            this._filterTimer = setTimeout(() => {
                if (action === 'filter-teams') this.filterTeams();
                else if (action === 'filter-users') this.filterUsers();
                else if (action === 'filter-audit') this.filterAudit();
            }, 150);
        };
        document.addEventListener('input', this._inputHandler);

        // Delegate for all change events (form selects in modals)
        this._changeHandler = (e) => {
            const action = e.target.dataset.action;
            if (!action) return;
        };
        document.addEventListener('change', this._changeHandler);

        // Delegate for all click events
        this._clickHandler = (e) => {
            // Close open dropdowns when clicking outside
            document.querySelectorAll('.dropdown-menu:not(.hidden)').forEach(menu => {
                if (!e.target.closest('.dropdown-wrap') || e.target.closest('.dropdown-wrap') !== menu.closest('.dropdown-wrap')) {
                    menu.classList.add('hidden');
                }
            });

            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const tab = target.dataset.tab;
            const modal = target.dataset.modal;
            const status = target.dataset.status;

            switch (action) {
                case 'switch-tab':
                    if (tab) this.switchTab(tab);
                    break;
                case 'open-create-team-modal':
                    this.openCreateTeamModal();
                    break;
                case 'open-edit-team-modal':
                    const teamId = target.dataset.teamId;
                    const team = this.teams.find(t => t.id === teamId);
                    if (team) this.openEditTeamModal(team);
                    break;
                case 'open-edit-user-modal':
                    const email = target.dataset.email;
                    if (email) this.openEditUserModal(email);
                    break;
                case 'close-modal':
                    if (modal) this.closeModal(modal);
                    break;
                case 'submit-create-team':
                    document.getElementById('createTeamForm').dispatchEvent(new Event('submit'));
                    break;
                case 'submit-edit-team':
                    document.getElementById('editTeamForm').dispatchEvent(new Event('submit'));
                    break;
                case 'confirm-delete-team':
                    this.confirmDeleteTeam();
                    break;
                case 'delete-team':
                    this.deleteTeam();
                    break;
                case 'set-modal-status':
                    if (status) this.setModalStatus(status);
                    break;
                case 'save-user':
                    this.saveUser();
                    break;
                case 'confirm-delete-user':
                    this.confirmDeleteUser();
                    break;
                case 'delete-user':
                    this.deleteUser();
                    break;
                case 'set-team-status':
                    if (status) this.setTeamStatus(status === 'true');
                    break;
                case 'save-permissions':
                    this.savePermissions();
                    break;
                case 'save-role-names':
                    this.saveRoleNames();
                    break;
                case 'reset-role-names':
                    this.resetRoleNames();
                    break;
                case 'approve-request':
                    const approveId = target.dataset.requestId;
                    if (approveId) this.approveRequest(approveId, target);
                    break;
                case 'reject-request':
                    const rejectId = target.dataset.requestId;
                    if (rejectId) this.confirmRejectRequest(rejectId);
                    break;
                case 'confirm-reject':
                    this.executeRejectRequest();
                    break;
                case 'toggle-add-role':
                    this.toggleAddRole();
                    break;
                case 'confirm-delete-role':
                    this.confirmDeleteRole();
                    break;
                case 'switch-permissions-subtab':
                    this.switchPermissionsSubtab(target.dataset.subtab);
                    break;
                case 'toggle-permission':
                    this.togglePermission(target);
                    break;
                case 'pagination':
                    const page = parseInt(target.dataset.page);
                    const containerId = target.dataset.container;
                    const callback = this._paginationCallbacks?.[containerId];
                    if (callback && !isNaN(page)) {
                        callback(page);
                    }
                    break;
                case 'toggle-dropdown': {
                    const menuId = target.dataset.target;
                    if (menuId) this._toggleDropdown(menuId);
                    break;
                }
                case 'select-filter': {
                    const filterName = target.dataset.filter;
                    const filterValue = target.dataset.value;
                    if (filterName) this._selectFilter(filterName, filterValue, target);
                    break;
                }
                case 'toggle-form-dropdown': {
                    this._toggleFormDropdown(target);
                    break;
                }
                case 'select-form-dropdown': {
                    this._selectFormDropdown(target);
                    break;
                }
            }
        };
        document.addEventListener('click', this._clickHandler);

        // EXP-03: клавиатурный toggle для permission-cb (role=checkbox + tabindex=0)
        // Space/Enter активируют чекбокс — по паттерну ARIA checkbox widget
        this._permKeyHandler = (e) => {
            if (e.key !== ' ' && e.key !== 'Enter') return;
            const target = e.target.closest('.permission-cb:not(.disabled)');
            if (!target) return;
            e.preventDefault();
            this.togglePermission(target);
        };
        document.addEventListener('keydown', this._permKeyHandler);

        // Form submissions
        const createTeamForm = document.getElementById('createTeamForm');
        if (createTeamForm) {
            createTeamForm.addEventListener('submit', (e) => this.createTeam(e));
        }

        const editTeamForm = document.getElementById('editTeamForm');
        if (editTeamForm) {
            editTeamForm.addEventListener('submit', (e) => this.saveTeam(e));
        }

        // Аудит-лог: фильтры по дате
        document.getElementById('auditDateFrom')?.addEventListener('change', (e) => {
            this.auditFilters.dateFrom = e.target.value || '';
            this.resetAndLoadAudit();
        });
        document.getElementById('auditDateTo')?.addEventListener('change', (e) => {
            this.auditFilters.dateTo = e.target.value || '';
            this.resetAndLoadAudit();
        });

        // Аудит-лог: кнопка "Загрузить ещё"
        document.getElementById('loadMoreAuditBtn')?.addEventListener('click', () => {
            this.loadMoreAudit();
        });
    },

    loadUserData() {
        const authData = sessionStorage.getItem('cloud-auth');
        if (authData) {
            let auth;
            try {
                auth = JSON.parse(authData);
            } catch (e) {
                console.error('Invalid cloud-auth data:', e);
                return;
            }
            this.currentUser = {
                email: auth.email,
                name: auth.name,
                picture: auth.picture
            };

        }
    },

    async loadAllData() {
        // EXP-05/06: показать loading-state перед сетевым запросом
        const reqLoading = document.getElementById('requestsLoadingState');
        if (reqLoading) reqLoading.classList.remove('hidden');
        const permLoading = document.getElementById('permissionsLoadingState');
        if (permLoading) permLoading.classList.remove('hidden');

        try {
            const result = await CloudStorage.getAdminData({});

            if (result.error) {
                console.error('Error loading admin data:', result.error);

                if (result.error.includes('токен') || result.error.includes('авторизации')) {
                    Toast.error('Ошибка авторизации. Обновите страницу и войдите заново.');
                } else {
                    Toast.error('Ошибка загрузки данных: ' + result.error);
                }
                return;
            }

            this.teams = result.teams || [];
            this.requests = result.requests || [];
            this.permissions = result.permissions || {};
            // v2.27 FIXES-UI-01: getAdminData returns ALL users в result.users (non-paginated).
            // Seed this.users ДО renderTeams() — иначе team cards показывают "0 Участников"
            // т.к. renderTeams() читает this.users.filter(u => u.teamId === team.id).
            // goToUsersPage(1) ниже перезаписывает с paginated subset.
            if (Array.isArray(result.users)) {
                this.users = result.users;
            }

            if (!this._optimistic) {
                this._optimistic = OptimisticManager.create('admin-users');
            }
            if (!this._optimisticTeams) {
                this._optimisticTeams = OptimisticManager.create('admin-teams');
            }

            this.populateRoleSelects();
            this.updateCounts();
            this.renderTeams();
            this.renderRequests();
            this.renderRolesTable();
            this.renderPermissions();
            this.populateTeamFilter();

            await this.goToUsersPage(1);
            // v2.27 FIXES-UI-01: re-render teams после того как goToUsersPage обновил this.users
            // (paginated subset может отличаться от initial result.users для больших списков)
            this.renderTeams();
            await this.resetAndLoadAudit();

        } catch (error) {
            console.error('Error loading admin data:', error);
            Toast.error('Ошибка загрузки данных');
        }
    },

    // ============ UI Updates ============

    updateUI() {
        this.populateRoleSelects();
        this.updateCounts();
        this.renderTeams();
        this.renderUsers();
        this.renderRequests();
        this.renderRolesTable();
        this.renderPermissions();
        this.populateTeamFilter();
    },

    /**
     * Заполнить все select с ролями из RolesConfig
     */
    populateRoleSelects() {
        const roles = RolesConfig.ALL_ROLES.filter(r => r !== 'guest');

        // Фильтр ролей
        const filterMenu = document.getElementById('filterRoleMenu');
        if (filterMenu) {
            const currentValue = this._getFilterValue('filterRole');
            const firstItem = filterMenu.querySelector('.dropdown-item');
            filterMenu.innerHTML = '';
            if (firstItem) filterMenu.appendChild(firstItem);
            roles.forEach(role => {
                const item = document.createElement('div');
                item.className = 'dropdown-item' + (role === currentValue ? ' active' : '');
                item.dataset.action = 'select-filter';
                item.dataset.filter = 'filterRole';
                item.dataset.value = role;
                item.textContent = RolesConfig.getName(role);
                filterMenu.appendChild(item);
            });
        }

        // Модалка редактирования — заполняется в openEditUserModal
    },

    updateCounts() {
        document.getElementById('teamsCount').textContent = this.teams.filter(t => t.isActive).length;
        document.getElementById('usersCount').textContent = this.usersTotalCount || this.users.length;
        document.getElementById('requestsCount').textContent = this.requests.length;
    },

    _filterValues: {},

    _toggleDropdown(menuId) {
        const menu = document.getElementById(menuId);
        if (!menu) return;
        // Close other dropdowns first
        document.querySelectorAll('.dropdown-menu:not(.hidden)').forEach(m => {
            if (m.id !== menuId) m.classList.add('hidden');
        });
        menu.classList.toggle('hidden');
    },

    _toggleFormDropdown(trigger) {
        const menuId = trigger.dataset.target;
        const menu = document.getElementById(menuId);
        if (!menu) return;
        document.querySelectorAll('.dropdown-wrap--form .dropdown-menu:not(.hidden)').forEach(m => {
            if (m !== menu) m.classList.add('hidden');
        });
        menu.classList.toggle('hidden');
    },

    _selectFormDropdown(target) {
        const menu = target.closest('.dropdown-menu');
        const wrap = target.closest('.dropdown-wrap--form');
        if (!menu || !wrap) return;
        const value = target.dataset.value ?? '';
        const label = target.textContent;
        const input = wrap.querySelector('input[type="hidden"]');
        if (input) input.value = value;
        const trigger = wrap.querySelector('.dropdown-trigger--form');
        const labelEl = trigger?.querySelector('span');
        if (labelEl) labelEl.textContent = label;
        trigger?.classList.toggle('placeholder', !value);
        menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        target.classList.add('active');
        menu.classList.add('hidden');
    },

    _selectFilter(filterName, value, target) {
        this._filterValues[filterName] = value || '';
        // Update active state
        const menu = target.closest('.dropdown-menu');
        if (menu) {
            menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            target.classList.add('active');
            menu.classList.add('hidden');
        }
        // Update label
        const label = document.getElementById(filterName + 'Label');
        if (label) label.textContent = target.textContent;
        // Trigger filter
        if (filterName === 'filterAction') this.filterAudit();
        else this.filterUsers();
    },

    _getFilterValue(filterName) {
        return this._filterValues[filterName] || '';
    },

    populateTeamFilter() {
        const menu = document.getElementById('filterTeamMenu');
        if (!menu) return;

        const currentValue = this._getFilterValue('filterTeam');

        // Keep first item ("Все команды"), rebuild rest
        const firstItem = menu.querySelector('.dropdown-item');
        menu.innerHTML = '';
        if (firstItem) menu.appendChild(firstItem);

        this.teams.forEach(team => {
            const item = document.createElement('div');
            item.className = 'dropdown-item' + (team.id === currentValue ? ' active' : '');
            item.dataset.action = 'select-filter';
            item.dataset.filter = 'filterTeam';
            item.dataset.value = team.id;
            item.textContent = team.name;
            menu.appendChild(item);
        });
    },

    // ============ Teams ============

    /**
     * Phase 46 LIT-CONT-01 — атомарная миграция renderTeams() →
     * signal-driven <app-card> grid + Lit cell renderers (XSS-proof через автоэскейп).
     *
     * Pattern (Phase 40 LIT-MIG-01 admin pilot continuation):
     *   1. _mountTeamsGrid() — однократно настраивает effect(() => grid renders <app-card>s from _teamsSignal)
     *   2. renderTeams() — пишет filtered/sorted rows в _teamsSignal, Lit реактивно перерисовывает
     *
     * Cleanup: _teamsDisposers вызываются в destroy() (Pitfall C — no memory leak).
     *
     * Атомарность (Pitfall #12): мигрирована ТОЛЬКО renderTeams. renderUsers/renderAuditLog
     * отложены к Phase 48/49.
     */
    renderTeams() {
        const grid = document.getElementById('teamsGrid');
        const emptyEl = document.getElementById('emptyTeams');
        if (!grid) return;

        const searchValue = document.getElementById('searchTeams')?.value.toLowerCase() || '';

        // Фильтрация (data layer — без DOM)
        let filtered = [...this.teams];
        if (searchValue) {
            filtered = filtered.filter(t =>
                t.name.toLowerCase().includes(searchValue) ||
                t.leaderName.toLowerCase().includes(searchValue) ||
                t.leaderEmail.toLowerCase().includes(searchValue)
            );
        }

        // Сортировка: активные первые
        filtered.sort((a, b) => {
            if (a.isActive !== b.isActive) return b.isActive - a.isActive;
            return a.name.localeCompare(b.name);
        });

        // Build view-model rows (precompute members + initials, без DOM)
        const rows = filtered.map(team => {
            const members = this.users.filter(u => u.teamId === team.id).map(m => ({
                id: m.email,
                name: m.name || m.email,
                roleName: RolesConfig.getName(m.role),
                picture: m.picture || '',
                initials: this.getInitials(m.name)
            }));
            return {
                id: team.id,
                name: team.name,
                isActive: !!team.isActive,
                leaderName: team.leaderName,
                leaderInitials: this.getInitials(team.leaderName),
                pending: !!team._pending,
                error: !!team._error,
                members
            };
        });

        // Toggle empty state (legacy DOM — preserved для compat с existing skeleton/empty UX)
        if (emptyEl) {
            if (rows.length === 0) emptyEl.classList.remove('hidden');
            else emptyEl.classList.add('hidden');
        }

        // Mount once (idempotent) — затем записываем в signal
        this._mountTeamsGrid();

        if (this._teamsSignal) {
            this._teamsSignal.value = rows;
        } else {
            // Fallback: signals/Lit недоступны → graceful degradation (показываем empty state)
            console.warn('[admin] _teamsSignal not initialized — Lit/signals unavailable, teams grid degraded');
        }
    },

    /**
     * Phase 46 LIT-CONT-01 — однократная настройка <app-card> grid в #teamsGrid:
     * — effect-binding _teamsSignal → render <app-card> children (Lit html`` экранирует автоматически)
     * — disposers tracked в _teamsDisposers (cleanup в destroy)
     */
    _mountTeamsGrid() {
        if (this._teamsGridMounted) return;

        const grid = document.getElementById('teamsGrid');
        const emptyEl = document.getElementById('emptyTeams');
        if (!grid) return;

        // Lit globals + signals required (cdn-deps.js loaded asynchronously)
        if (typeof window.signal !== 'function' || typeof window.effect !== 'function' || !window.litHtml || !window.litRender) {
            // Lit ещё не готов — попытаемся отложить mount до lit-ready event
            if (!this._teamsPendingMount) {
                this._teamsPendingMount = true;
                window.addEventListener('lit-ready', () => {
                    this._teamsPendingMount = false;
                    this._mountTeamsGrid();
                    if (typeof this.renderTeams === 'function') {
                        this.renderTeams();
                    }
                }, { once: true });
            }
            return;
        }

        const html = window.litHtml;
        const render = window.litRender;
        const self = this;

        try {
            this._teamsSignal = window.signal([]);

            // Создать host для Lit-render внутри grid (рядом с emptyEl).
            // Lit render() в существующий контейнер поддерживает диффинг — повторные render-ы пересобирают
            // только изменённые app-card элементы.
            let renderHost = grid.querySelector('[data-teams-render-host]');
            if (!renderHost) {
                renderHost = document.createElement('div');
                renderHost.setAttribute('data-teams-render-host', '');
                renderHost.style.display = 'contents';
                if (emptyEl && emptyEl.parentNode === grid) {
                    grid.insertBefore(renderHost, emptyEl);
                } else {
                    grid.appendChild(renderHost);
                }
            }

            // Reactive render via effect (Option A — Lit render внутрь host)
            const dispose = window.effect(() => {
                const items = self._teamsSignal.value || [];
                const template = html`${items.map(team => {
                    const cardClass = `team-card${team.isActive ? '' : ' inactive'}${team.pending ? ' item--pending' : ''}${team.error ? ' item--error' : ''}`;
                    return html`
                        <app-card
                            variant="default"
                            class="${cardClass}"
                            data-action="open-edit-team-modal"
                            data-team-id="${team.id}"
                        >
                            <div slot="header" class="team-card-header">
                                <div class="team-name">${team.name}</div>
                                <div class="${team.isActive ? 'team-status' : 'team-status inactive'}"></div>
                            </div>
                            <div class="team-card-body">
                                <div class="team-leader">
                                    <div class="team-leader-avatar">${team.leaderInitials}</div>
                                    <span>${team.leaderName}</span>
                                </div>
                                ${team.members.length > 0 ? html`
                                    <div class="team-members-list">
                                        ${team.members.map(m => html`
                                            <div class="team-member">
                                                <div class="team-member-avatar">
                                                    ${m.picture ? html`<img src="${m.picture}" alt="">` : m.initials}
                                                </div>
                                                <div class="team-member-info">
                                                    <span class="team-member-name">${m.name}</span>
                                                    <span class="team-member-role">${m.roleName}</span>
                                                </div>
                                            </div>
                                        `)}
                                    </div>
                                ` : ''}
                                <div class="team-stats">
                                    <div class="team-stat">
                                        <span class="team-stat-value">${team.members.length}</span>
                                        <span class="team-stat-label">Участников</span>
                                    </div>
                                </div>
                            </div>
                        </app-card>
                    `;
                })}`;
                render(template, renderHost);
            });
            this._teamsDisposers.push(dispose);

            this._teamsGridMounted = true;
        } catch (e) {
            console.warn('[admin] _mountTeamsGrid failed (non-fatal):', e?.message);
            this._teamsGridMounted = false;
        }
    },

    filterTeams() {
        this.renderTeams();
    },

    openCreateTeamModal() {
        document.getElementById('newTeamName').value = '';
        document.getElementById('newTeamLeader').value = '';
        document.getElementById('newTeamDescription').value = '';
        this.openModal('createTeamModal');
    },

    async createTeam(event) {
        event.preventDefault();

        const name = document.getElementById('newTeamName').value.trim();
        const leaderEmail = document.getElementById('newTeamLeader').value.trim();
        const description = document.getElementById('newTeamDescription').value.trim();

        if (!name || !leaderEmail) {
            Toast.warning('Заполните обязательные поля');
            return false;
        }

        const btn = document.querySelector('[data-action="submit-create-team"]');
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        try {
            const result = await CloudStorage.createTeam({ name, leaderEmail, description });

            if (result.error) {
                throw new Error(result.error);
            }

            Toast.success('Команда создана');
            this.closeModal('createTeamModal');
            CloudStorage.clearCacheNamespace('adminData');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
        }

        return false;
    },

    openEditTeamModal(team) {
        this.editingTeam = team;
        this.editingTeamActive = team.isActive;

        document.getElementById('editTeamName').value = team.name;
        document.getElementById('editTeamDescription').value = team.description || '';
        this.setTeamStatus(team.isActive);

        this.openModal('editTeamModal');
    },

    setTeamStatus(isActive) {
        this.editingTeamActive = isActive;

        document.querySelectorAll('#editTeamModal .status-btn').forEach(btn => {
            const btnIsActive = btn.dataset.status === 'true';
            btn.classList.toggle('active', btnIsActive === isActive);
        });
    },

    async saveTeam(event) {
        event.preventDefault();

        if (!this.editingTeam) return false;

        const name = document.getElementById('editTeamName').value.trim();
        const description = document.getElementById('editTeamDescription').value.trim();

        if (!name) {
            Toast.warning('Введите название команды');
            return false;
        }

        const teamId = this.editingTeam.id;
        const idx = this.teams.findIndex(t => t.id === teamId);
        if (idx === -1) return false;

        const snapshot = structuredClone(this.teams);
        const team = this.teams[idx];
        team.name = name;
        team.description = description;
        team.isActive = this.editingTeamActive;
        team._pending = true;

        const opId = this._optimisticTeams.apply({
            stateRef: this.teams,
            index: idx,
            snapshot,
            operation: 'update',
            item: team,
            onRollback: (error) => {
                this.renderTeams();
                Toast.error('Ошибка сохранения команды: ' + error.message, 5000, {
                    action: { label: 'Повторить', callback: () => this.saveTeam(event) }
                });
            }
        });

        this.closeModal('editTeamModal');
        this.renderTeams();

        try {
            const result = await CloudStorage.updateTeam({
                teamId,
                name,
                description,
                isActive: this.editingTeamActive
            });

            if (result.error) throw new Error(result.error);

            this._optimisticTeams.confirm(opId);
            Toast.success('Команда обновлена');

        } catch (error) {
            this._optimisticTeams.rollback(opId, error);
        }

        return false;
    },

    confirmDeleteTeam() {
        if (!this.editingTeam) return;

        const members = this.users.filter(u => u.teamId === this.editingTeam.id);
        document.getElementById('deleteTeamName').textContent = this.editingTeam.name;

        const details = members.length > 0
            ? `У команды ${members.length} участник(ов). Участники будут откреплены от команды (не удалены).`
            : 'В команде нет участников.';
        document.getElementById('deleteTeamDetails').textContent = details;

        this.closeModal('editTeamModal');
        this.openModal('deleteTeamModal');
    },

    async deleteTeam() {
        if (!this.editingTeam) return;

        const teamId = this.editingTeam.id;
        const idx = this.teams.findIndex(t => t.id === teamId);
        if (idx === -1) return;

        const snapshot = structuredClone(this.teams);
        const removed = this.teams.splice(idx, 1)[0];
        removed._pending = true;

        const opId = this._optimisticTeams.apply({
            stateRef: this.teams,
            index: idx,
            snapshot,
            operation: 'delete',
            item: removed,
            onRollback: (error) => {
                this.renderTeams();
                Toast.error('Ошибка удаления команды: ' + error.message, 5000, {
                    action: { label: 'Повторить', callback: () => this.deleteTeam() }
                });
            }
        });

        this.closeModal('deleteTeamModal');
        this.renderTeams();
        this.updateCounts();

        try {
            const result = await CloudStorage.deleteTeam({ teamId });
            if (result.error) throw new Error(result.error);
            this._optimisticTeams.confirm(opId);
            Toast.success('Команда удалена');
        } catch (error) {
            this._optimisticTeams.rollback(opId, error);
        }
    },

    // ============ Users ============

    async goToUsersPage(page) {
        const reqId = ++this._usersRequestId;
        this._renderUsersSkeleton();
        try {
            const result = await CloudStorage.getAdminData({
                usersPage: page,
                usersPageSize: this.usersPageSize,
                filter_team: this.usersServerFilter.filter_team || undefined,
                filter_role: this.usersServerFilter.filter_role || undefined,
                filter_status: this.usersServerFilter.filter_status || undefined
            });
            if (reqId !== this._usersRequestId) return;
            // v2.27 FIXES-CACHE-03: handle notModified short-circuit — backend сказал "no changes",
            // не перезаписываем this.users пустым массивом (раньше result.users undefined → []).
            if (result && result.notModified === true) {
                // Keep current this.users / counts / page (already correct from cache)
                this.renderUsers();
                return;
            }
            this.users = result.users || [];
            this.usersTotalCount = result.usersTotalCount || 0;
            this.usersPage = result.usersPage || page;
            this.renderUsers();
            PaginationHelper.render(
                document.getElementById('usersPagination'),
                {
                    page: this.usersPage,
                    pageSize: this.usersPageSize,
                    totalCount: this.usersTotalCount,
                    onPageChange: (p) => this.goToUsersPage(p)
                }
            );
        } catch (error) {
            if (reqId !== this._usersRequestId) return;
            Toast.error('Ошибка загрузки: ' + error.message);
        }
    },

    _renderUsersSkeleton() {
        const table = document.getElementById('usersTable');
        if (table) table.classList.add('hidden');
        const emptyUsers = document.getElementById('emptyUsers');
        if (emptyUsers) emptyUsers.classList.add('hidden');
        const loading = document.getElementById('usersLoadingState');
        if (loading) loading.classList.remove('hidden');
    },

    /**
     * Phase 48 LIT-CONT-02 admin — атомарная миграция renderUsers() →
     * signal-driven <app-table> mount + Lit cell renderers (XSS-proof через автоэскейп).
     *
     * Pattern (Phase 40 LIT-MIG-01 admin pilot precedent + Phase 46 LIT-CONT-01 continuation):
     *   1. _mountUsersTable() — однократно настраивает columns + effect(() => tableEl.items = ...)
     *   2. renderUsers() — пишет filtered rows в _usersSignal, Lit реактивно перерисовывает строки
     *
     * Server-pagination preserved (usersPageSize: 20 — фильтры/пагинация на сервере через goToUsersPage).
     * Client-side только клиентский search filter по текущей странице (GAS не поддерживает search param).
     *
     * Cleanup: _usersDisposers вызываются в destroy() (Pitfall C — no memory leak).
     *
     * Атомарность (Pitfall #12): мигрирована ТОЛЬКО renderUsers. renderAuditLog отложен к Phase 49.
     */
    renderUsers() {
        const table = document.getElementById('usersTable');
        const usersLoading = document.getElementById('usersLoadingState');
        if (usersLoading) usersLoading.classList.add('hidden');
        const emptyEl = document.getElementById('emptyUsers');

        // Данные уже отфильтрованы и постранично на сервере
        const searchValue = document.getElementById('searchUsers')?.value.toLowerCase() || '';
        let filtered = [...this.users];

        // Клиентский поиск только по текущей странице (GAS не поддерживает search param)
        if (searchValue) {
            filtered = filtered.filter(u =>
                (u.name || '').toLowerCase().includes(searchValue) ||
                (u.email || '').toLowerCase().includes(searchValue) ||
                (u.reddyId || '').includes(searchValue)
            );
        }

        // Build view-model rows (data layer — без DOM)
        const rows = filtered.map(user => {
            const team = this.teams.find(t => t.id === user.teamId);
            const teamName = team ? team.name : '';
            const statusText = user.status === 'active' ? 'Активен' :
                              user.status === 'blocked' ? 'Заблокирован' :
                              user.status === 'waiting_invite' ? 'Ожидает' : 'Без команды';
            return {
                id: user.email,
                name: user.name || '',
                email: user.email || '',
                picture: user.picture || '',
                initials: this.getInitials(user.name),
                role: user.role,
                roleName: RolesConfig.getName(user.role),
                roleColor: RolesConfig.isCustomRole(user.role) ? RolesConfig.getColor(user.role) : '',
                teamName,
                status: user.status,
                statusClass: 'status-' + user.status,
                statusText,
                pending: !!user._pending,
                error: !!user._error
            };
        });

        // Toggle empty state (legacy DOM — preserved для compat с existing skeleton/empty UX)
        // v2.27 FIXES-VISUAL-02: при пустом списке прячем app-table ПОЛНОСТЬЮ (его дефолтный
        // "Нет данных" дублировал legacy #emptyUsers с иконкой). Показываем только legacy emptyUsers.
        const isEmpty = rows.length === 0;
        if (emptyEl) {
            if (isEmpty) emptyEl.classList.remove('hidden');
            else emptyEl.classList.add('hidden');
        }
        if (table) {
            if (isEmpty) table.classList.add('hidden');
            else table.classList.remove('hidden');
        }

        // Mount once (idempotent) — затем записываем в signal
        this._mountUsersTable();

        if (this._usersSignal) {
            this._usersSignal.value = rows;
        } else {
            // Fallback: signals/Lit недоступны → graceful degradation (показываем empty state)
            console.warn('[admin] _usersSignal not initialized — Lit/signals unavailable, users table degraded');
        }

        // Apply badge colors для кастомных ролей (data-role-color → inline style)
        this.applyBadgeColors();
    },

    /**
     * Phase 48 LIT-CONT-02 — однократная настройка <app-table id="usersTable">:
     * — columns с Lit cell renderers (user cell / team / role / status / actions)
     * — effect-binding _usersSignal → tableEl.items (reactive)
     * — disposers tracked в _usersDisposers (cleanup в destroy)
     *
     * Pattern: Phase 40 LIT-MIG-01 _mountRolesTable() precedent (direct prop assignment via effect).
     */
    _mountUsersTable() {
        if (this._usersTableMounted) return;

        const tableEl = document.getElementById('usersTable');
        if (!tableEl) return;

        // Lit globals + signals required (cdn-deps.js loaded asynchronously)
        if (typeof window.signal !== 'function' || typeof window.effect !== 'function' || !window.litHtml) {
            // Lit ещё не готов — попытаемся отложить mount до lit-ready event
            if (!this._usersPendingMount) {
                this._usersPendingMount = true;
                window.addEventListener('lit-ready', () => {
                    this._usersPendingMount = false;
                    this._mountUsersTable();
                    if (typeof this.renderUsers === 'function') {
                        this.renderUsers();
                    }
                }, { once: true });
            }
            return;
        }

        const html = window.litHtml;
        const self = this;

        try {
            this._usersSignal = window.signal([]);

            // Cell renderers — Lit html`` автоматически экранирует interpolated values (XSS-proof)
            tableEl.columns = [
                {
                    key: 'user',
                    label: 'Пользователь',
                    render: (item) => html`
                        <div class="user-cell">
                            <div class="user-avatar">
                                ${item.picture ? html`<img src="${item.picture}" alt="">` : item.initials}
                            </div>
                            <div class="user-details">
                                <span class="user-name">${item.name}</span>
                                <span class="user-email">${item.email}</span>
                            </div>
                        </div>
                    `
                },
                {
                    key: 'team',
                    label: 'Команда',
                    render: (item) => html`
                        <span class="${item.teamName ? 'user-team' : 'user-team no-team'}">${item.teamName || 'Нет'}</span>
                    `
                },
                {
                    key: 'role',
                    label: 'Роль',
                    render: (item) => html`
                        <span class="role-badge role-${item.role}" data-role-color="${item.roleColor}">${item.roleName}</span>
                    `
                },
                {
                    key: 'status',
                    label: 'Статус',
                    render: (item) => html`
                        <span class="status-badge ${item.statusClass}">${item.statusText}</span>
                    `
                },
                {
                    key: 'actions',
                    label: 'Действия',
                    render: (item) => html`
                        <button
                            class="btn btn-sm btn--ghost"
                            data-action="open-edit-user-modal"
                            data-email="${item.email}"
                            @click=${() => self.openEditUserModal(item.email)}
                        >Изменить</button>
                    `
                }
            ];

            // Reactive prop binding (Option A — direct prop assignment via effect)
            const dispose = window.effect(() => {
                tableEl.items = self._usersSignal.value || [];
                // Re-apply badge colors after Lit render (data-role-color → inline style)
                queueMicrotask(() => self.applyBadgeColors());
            });
            this._usersDisposers.push(dispose);

            this._usersTableMounted = true;
        } catch (e) {
            console.warn('[admin] _mountUsersTable failed (non-fatal):', e?.message);
            this._usersTableMounted = false;
        }
    },

    filterUsers() {
        this.usersServerFilter = {
            filter_team: this._getFilterValue('filterTeam') || undefined,
            filter_role: this._getFilterValue('filterRole') || undefined,
            filter_status: this._getFilterValue('filterStatus') || undefined
        };
        this.goToUsersPage(1);
    },

    applyBadgeColors() {
        document.querySelectorAll('[data-role-color]').forEach(el => {
            const color = el.dataset.roleColor;
            if (!color) return;
            el.style.color = color;
            el.style.background = color + '20';
        });
    },

    openEditUserModal(email) {
        const user = this.users.find(u => u.email === email);
        if (!user) return;

        // Проверка: можем ли редактировать этого пользователя
        if (typeof RoleGuard !== 'undefined' && !RoleGuard.canManageRole(user.role)) {
            Toast.warning('У вас нет прав для редактирования этого пользователя');
            return;
        }

        this.editingUser = user;
        this.editingStatus = user.status;

        // Заполнить модалку
        document.getElementById('modalUserAvatar').innerHTML = user.picture
            ? `<img src="${this.escapeHtml(user.picture)}" alt="">`
            : this.getInitials(user.name);
        document.getElementById('modalUserName').textContent = user.name;
        document.getElementById('modalUserEmail').textContent = user.email;

        // Заполнить dropdown команды
        const teamMenu = document.getElementById('modalUserTeamMenu');
        const teamInput = document.getElementById('modalUserTeamValue');
        const teamLabel = document.getElementById('modalUserTeamLabel');
        const teamTrigger = teamMenu?.closest('.dropdown-wrap--form')?.querySelector('.dropdown-trigger--form');

        // Leader видит только свою команду (но admin-leader видит все)
        const isAdminUser = typeof RoleGuard !== 'undefined' && RoleGuard.isAdmin();
        const isLeader = !isAdminUser && typeof RoleGuard !== 'undefined' && RoleGuard.hasRole('leader');
        const myTeamId = RoleGuard?.user?.teamId;

        let teamHtml = '<div class="dropdown-item' + (!user.teamId ? ' active' : '') + '" data-action="select-form-dropdown" data-value="">Без команды</div>';
        this.teams.forEach(team => {
            if (isLeader && team.id !== myTeamId) return;
            const isActive = team.id === user.teamId ? ' active' : '';
            teamHtml += '<div class="dropdown-item' + isActive + '" data-action="select-form-dropdown" data-value="' + this.escapeHtml(team.id) + '">' + this.escapeHtml(team.name) + '</div>';
        });
        if (teamMenu) teamMenu.innerHTML = teamHtml;
        if (teamInput) teamInput.value = user.teamId || '';
        const selectedTeam = user.teamId ? this.teams.find(t => t.id === user.teamId) : null;
        if (teamLabel) teamLabel.textContent = selectedTeam ? selectedTeam.name : 'Без команды';
        if (teamTrigger) teamTrigger.classList.toggle('placeholder', !user.teamId);

        // Заполнить dropdown ролей (только доступные)
        const roleMenu = document.getElementById('modalUserRoleMenu');
        const roleInput = document.getElementById('modalUserRoleValue');
        const roleLabel = document.getElementById('modalUserRoleLabel');
        const roleTrigger = roleMenu?.closest('.dropdown-wrap--form')?.querySelector('.dropdown-trigger--form');

        const assignableRoles = typeof RoleGuard !== 'undefined'
            ? RoleGuard.getAssignableRoles()
            : ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'];

        let roleHtml = '';
        // Если текущая роль не в списке - показать disabled
        if (!assignableRoles.includes(user.role)) {
            roleHtml += '<div class="dropdown-item dropdown-item--disabled active" data-action="select-form-dropdown" data-value="' + this.escapeHtml(user.role) + '">' + this.escapeHtml(RolesConfig.getName(user.role)) + '</div>';
        }
        assignableRoles.forEach(role => {
            const isActive = role === user.role ? ' active' : '';
            roleHtml += '<div class="dropdown-item' + isActive + '" data-action="select-form-dropdown" data-value="' + this.escapeHtml(role) + '">' + this.escapeHtml(RolesConfig.getName(role)) + '</div>';
        });
        if (roleMenu) roleMenu.innerHTML = roleHtml;
        if (roleInput) roleInput.value = user.role || '';
        if (roleLabel) roleLabel.textContent = RolesConfig.getName(user.role);
        if (roleTrigger) roleTrigger.classList.remove('placeholder');

        this.setModalStatus(user.status === 'blocked' ? 'blocked' : 'active');
        this.editingUserOriginalStatus = user.status;

        this.openModal('editUserModal');
    },

    setModalStatus(status) {
        this.editingStatus = status;

        document.querySelectorAll('#editUserModal .status-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.status === status);
        });
    },

    async saveUser() {
        if (!this.editingUser) return;

        const teamId = document.getElementById('modalUserTeamValue')?.value || '';
        let role = document.getElementById('modalUserRoleValue')?.value || '';
        const isBlocked = this.editingStatus === 'blocked';

        // Без команды и не admin → guest + waiting_invite
        if (!teamId && role !== 'admin' && !isBlocked) {
            role = 'guest';
        }

        const status = isBlocked ? 'blocked' :
                      (teamId ? 'active' : (role === 'guest' ? 'waiting_invite' : 'approved_no_team'));

        const isRoleOrStatusChange = (role !== this.editingUser.role) || (status !== this.editingUser.status);

        if (isRoleOrStatusChange) {
            // ADM-03: смена роли/статуса — pessimistic (btn-loading, ожидание сервера)
            const btn = document.querySelector('[data-action="save-user"]');
            if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

            try {
                const result = await CloudStorage.updateUser({
                    targetEmail: this.editingUser.email,
                    teamId,
                    role,
                    status
                });

                if (result.error) throw new Error(result.error);

                Toast.success('Пользователь обновлён');
                this.closeModal('editUserModal');
                CloudStorage.clearCacheNamespace('adminData');
                await this.goToUsersPage(this.usersPage);

            } catch (error) {
                Toast.error('Ошибка: ' + error.message);
            } finally {
                if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
            }
        } else {
            // Только данные пользователя (команда) — optimistic update
            const email = this.editingUser.email;
            const idx = this.users.findIndex(u => u.email === email);
            if (idx === -1) return;

            const snapshot = structuredClone(this.users);
            const user = this.users[idx];
            user.teamId = teamId;
            user._pending = true;

            const opId = this._optimistic.apply({
                stateRef: this.users,
                index: idx,
                snapshot,
                operation: 'update',
                item: user,
                onRollback: (err) => {
                    this.renderUsers();
                    Toast.error('Ошибка сохранения: ' + err.message, 5000, {
                        action: { label: 'Повторить', callback: () => this.saveUser() }
                    });
                }
            });

            this.closeModal('editUserModal');
            this.renderUsers();

            try {
                const result = await CloudStorage.updateUser({
                    targetEmail: email,
                    teamId,
                    role,
                    status
                });

                if (result.error) throw new Error(result.error);

                this._optimistic.confirm(opId);
                Toast.success('Пользователь обновлён');

            } catch (error) {
                this._optimistic.rollback(opId, error);
            }
        }
    },

    confirmDeleteUser() {
        if (!this.editingUser) return;

        // v2.27 FIXES-RBAC-01: self-delete protection (UI side; backend also rejects)
        if (this.currentUser && this.editingUser.email === this.currentUser.email) {
            Toast.warning('Нельзя удалить самого себя');
            return;
        }

        document.getElementById('deleteUserName').textContent =
            this.editingUser.name || this.editingUser.email;

        this.closeModal('editUserModal');
        this.openModal('deleteUserModal');
    },

    async deleteUser() {
        if (!this.editingUser) return;

        const email = this.editingUser.email;

        // v2.27 FIXES-RBAC-01: defence in depth — second check at execution
        if (this.currentUser && email === this.currentUser.email) {
            Toast.error('Нельзя удалить самого себя');
            this.closeModal('deleteUserModal');
            return;
        }
        const idx = this.users.findIndex(u => u.email === email);
        if (idx === -1) return;

        const snapshot = structuredClone(this.users);
        const removed = this.users.splice(idx, 1)[0];
        removed._pending = true;

        const opId = this._optimistic.apply({
            stateRef: this.users,
            index: idx,
            snapshot,
            operation: 'delete',
            item: removed,
            onRollback: (error) => {
                this.renderUsers();
                Toast.error('Ошибка удаления: ' + error.message, 5000, {
                    action: { label: 'Повторить', callback: () => this.deleteUser() }
                });
            }
        });

        this.closeModal('deleteUserModal');
        this.renderUsers();
        this.updateCounts();

        try {
            const result = await CloudStorage.deleteUser({ targetEmail: email });
            if (result.error) throw new Error(result.error);
            this._optimistic.confirm(opId);
            Toast.success('Пользователь удалён');
        } catch (error) {
            this._optimistic.rollback(opId, error);
        }
    },

    // ============ Requests ============

    renderRequests() {
        const grid = document.getElementById('requestsGrid');
        const emptyEl = document.getElementById('emptyRequests');
        // EXP-05: скрыть loading-state при рендере (данные уже получены)
        const loadingEl = document.getElementById('requestsLoadingState');
        if (loadingEl) loadingEl.classList.add('hidden');

        // Очистить (кроме empty state)
        const cards = grid.querySelectorAll('.request-card');
        cards.forEach(card => card.remove());

        if (this.requests.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }

        emptyEl.classList.add('hidden');

        this.requests.forEach(request => {
            const card = this.createRequestCard(request);
            grid.insertBefore(card, emptyEl);
        });
    },

    createRequestCard(request) {
        const card = document.createElement('div');
        card.className = 'request-card' + (request.isLeaderRequest ? ' request-card--leader' : '');
        card.id = 'request-' + request.id;

        const initials = this.getInitials(request.name);
        const date = new Date(request.requestedAt).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const leaderBadge = request.isLeaderRequest
            ? '<span class="request-leader-badge">Руководитель</span>'
            : '';

        const teamInfo = request.isLeaderRequest && request.teamName
            ? `<div class="request-team-info">
                <div class="request-team-name">Команда: <strong>${this.escapeHtml(request.teamName)}</strong></div>
                ${request.teamDescription ? '<div class="request-team-desc">' + this.escapeHtml(request.teamDescription) + '</div>' : ''}
               </div>`
            : '';

        card.innerHTML = `
            <div class="request-header">
                <div class="request-avatar">${initials}</div>
                <div class="request-info">
                    <div class="request-name">${this.escapeHtml(request.name)}${leaderBadge}</div>
                    <div class="request-email">${this.escapeHtml(request.email)}</div>
                </div>
            </div>
            <div class="request-body">
                <div class="request-field">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Reddy ID: <strong>${this.escapeHtml(request.reddyId)}</strong>
                </div>
                ${teamInfo}
                <div class="request-date">${date}</div>
            </div>
            <div class="request-actions">
                <button class="btn btn-success btn-sm" data-action="approve-request" data-request-id="${this.escapeHtml(request.id)}">Одобрить</button>
                <button class="btn btn-danger btn-sm" data-action="reject-request" data-request-id="${this.escapeHtml(request.id)}">Отклонить</button>
            </div>
        `;

        return card;
    },

    async approveRequest(requestId, triggerBtn) {
        if (triggerBtn) { triggerBtn.classList.add('btn-loading'); triggerBtn.disabled = true; }

        try {
            const result = await CloudStorage.approveRequest({ requestId });

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.isLeaderApproval) {
                Toast.success('Руководитель одобрен, команда создана');
            } else {
                Toast.success('Пользователь одобрен');
            }

            if (result.warning) {
                Toast.warning(result.warning);
            }

            CloudStorage.clearCacheNamespace('adminData');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
        } finally {
            if (triggerBtn) { triggerBtn.classList.remove('btn-loading'); triggerBtn.disabled = false; }
        }
    },

    confirmRejectRequest(requestId) {
        this._pendingRejectId = requestId;
        // EXP-07: показать имя пользователя в модалке подтверждения отклонения
        const request = this.requests.find(r => r.id === requestId);
        const nameEl = document.getElementById('rejectRequestName');
        if (nameEl) nameEl.textContent = request?.name || '';
        this.openModal('confirmRejectModal');
    },

    async executeRejectRequest() {
        const requestId = this._pendingRejectId;
        if (!requestId) return;

        this._pendingRejectId = null;

        const btn = document.querySelector('[data-action="confirm-reject"]');
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        try {
            const result = await CloudStorage.rejectRequest({ requestId });

            if (result.error) {
                throw new Error(result.error);
            }

            this.closeModal('confirmRejectModal');
            Toast.success('Запрос отклонён');
            CloudStorage.clearCacheNamespace('adminData');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
        }
    },

    // ============ Permissions ============

    switchPermissionsSubtab(subtab) {
        document.querySelectorAll('#tab-permissions .sub-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === subtab);
        });
        document.querySelectorAll('#tab-permissions .sub-tab-content').forEach(el => {
            el.classList.remove('active');
        });
        const target = document.getElementById('subtab-' + subtab);
        if (target) target.classList.add('active');
    },

    // ============ Role Management ============

    // Временное хранение цветов (до сохранения)
    _pendingColors: {},
    _pendingDeleteRole: null,

    /**
     * Phase 40 LIT-MIG-01 admin pilot — атомарная миграция renderRolesTable() →
     * signal-driven <app-table> mount + Lit cell renderers (XSS-proof через автоэскейп).
     *
     * Pattern (Phase 25-07 partners pilot precedent):
     *   1. _mountRolesTable() — однократно настраивает columns + effect(() => tableEl.items = ...)
     *   2. renderRolesTable() — пишет в _rolesSignal, Lit реактивно перерисовывает rows
     *
     * Cleanup: _rolesDisposers вызываются в destroy() (Pitfall C — no memory leak).
     *
     * Атомарность (Pitfall #12): мигрирована ТОЛЬКО renderRolesTable (smallest render
     * function в admin.js — ~5-15 ролей). renderUsers (~1000+ rows), renderTeams,
     * renderAuditLog отложены к v2.33+ continuation per audit-FIRST methodology.
     */
    renderRolesTable() {
        // Dirty-exclusion: пропустить обновление signal если пользователь активно
        // редактирует поле «Название» роли (защита от poll-перезаписи каретки/значения).
        // По образцу onboarding-form.js _dirtyFields — не сбрасываем чужой ввод.
        const activeEl = document.activeElement;
        if (activeEl && activeEl.classList.contains('role-name-input')) return;

        // Dirty-exclusion для цвета: пропустить rerender пока открыт color-picker.
        // Фоновый poll (30s) вызывает renderRolesTable() → this._pendingColors = {} →
        // выбранный но несохранённый цвет откатывался. Guard: if (this._activePicker) return
        // — точный и безопасный сигнал «идёт выбор», без риска залипания (после save
        // applyRoleColors/saveRoleConfig обнуляет _pendingColors ДО следующего poll).
        if (this._activePicker) return;

        // Сбросить pending color overrides (унаследовано от legacy: при rerender теряются несохранённые цвета)
        this._pendingColors = {};

        // Build rows from RolesConfig (data layer — без DOM)
        const rows = RolesConfig.ALL_ROLES.map(role => ({
            id: role,
            role,
            name: RolesConfig.getName(role),
            placeholder: RolesConfig.getDefaultName(role),
            color: RolesConfig.getColor(role),
            isSystem: RolesConfig.isSystemRole(role),
            isAdmin: role === 'admin'
        }));

        // Mount once (idempotent) — затем записываем в signal
        this._mountRolesTable();

        if (this._rolesSignal) {
            this._rolesSignal.value = rows;
        } else {
            // Fallback: signals/Lit недоступны → graceful degradation (показываем пустую таблицу)
            console.warn('[admin] _rolesSignal not initialized — Lit/signals unavailable, roles UI degraded');
        }
    },

    /**
     * Phase 40 LIT-MIG-01 — однократная настройка <app-table id="rolesTable">:
     * — columns с Lit cell renderers (color dot / key code / name input / delete button)
     * — effect-binding signal → tableEl.items (reactive)
     * — disposers tracked в _rolesDisposers (cleanup в destroy)
     */
    _mountRolesTable() {
        if (this._rolesTableMounted) return;

        const tableEl = document.getElementById('rolesTable');
        if (!tableEl) return;

        // Lit globals + signals required (cdn-deps.js loaded asynchronously)
        if (typeof window.signal !== 'function' || typeof window.effect !== 'function' || !window.litHtml) {
            // Lit ещё не готов — попытаемся отложить mount до lit-ready event
            if (!this._rolesPendingMount) {
                this._rolesPendingMount = true;
                window.addEventListener('lit-ready', () => {
                    this._rolesPendingMount = false;
                    this._mountRolesTable();
                    // re-trigger render для записи в signal
                    if (typeof this.renderRolesTable === 'function') {
                        this.renderRolesTable();
                    }
                }, { once: true });
            }
            return;
        }

        const html = window.litHtml;
        const self = this;

        try {
            this._rolesSignal = window.signal([]);

            // Cell renderers — Lit html`` автоматически экранирует interpolated values (XSS-proof)
            tableEl.columns = [
                {
                    key: 'color',
                    label: '',
                    render: (item) => html`
                        <span
                            class="role-color-dot"
                            style="background: ${item.color}"
                            data-role="${item.role}"
                            @click=${(e) => self.pickRoleColor(e.currentTarget, item.role)}
                        ></span>
                    `
                },
                {
                    key: 'role',
                    label: 'Ключ',
                    render: (item) => html`<code class="role-key">${item.role}</code>`
                },
                {
                    key: 'name',
                    label: 'Название',
                    render: (item) => html`
                        <input
                            type="text"
                            class="form-input role-name-input"
                            data-role="${item.role}"
                            .value=${item.name}
                            placeholder="${item.placeholder}"
                            ?disabled=${item.isAdmin}
                        />
                    `
                },
                {
                    key: 'actions',
                    label: '',
                    render: (item) => item.isSystem ? html`` : html`
                        <button
                            class="btn-delete-role"
                            data-role="${item.role}"
                            title="Удалить роль"
                            aria-label="Удалить роль ${item.role}"
                            @click=${() => self.openDeleteRoleModal(item.role)}
                        >✕</button>
                    `
                }
            ];

            // Reactive prop binding (Option A — direct prop assignment via effect)
            const dispose = window.effect(() => {
                tableEl.items = self._rolesSignal.value || [];
            });
            this._rolesDisposers.push(dispose);

            this._rolesTableMounted = true;
        } catch (e) {
            console.warn('[admin] _mountRolesTable failed (non-fatal):', e?.message);
            this._rolesTableMounted = false;
        }
    },

    pickRoleColor(dot, role) {
        // Guard: remove previous picker if exists
        if (this._activePicker && this._activePicker.parentNode) {
            this._activePicker.parentNode.removeChild(this._activePicker);
        }

        const picker = document.createElement('input');
        picker.type = 'color';
        picker.value = this._pendingColors[role] || RolesConfig.getColor(role);
        picker.style.position = 'absolute';
        picker.style.opacity = '0';
        picker.style.width = '0';
        picker.style.height = '0';
        document.body.appendChild(picker);
        this._activePicker = picker;

        const cleanup = () => {
            if (picker.parentNode) picker.parentNode.removeChild(picker);
            if (this._activePicker === picker) this._activePicker = null;
        };

        picker.addEventListener('input', () => {
            dot.style.background = picker.value;
            this._pendingColors[role] = picker.value;
        });
        picker.addEventListener('change', cleanup);
        picker.addEventListener('blur', cleanup);
        picker.click();
    },

    toggleAddRole() {
        const container = document.getElementById('addRoleRow');
        const btn = document.getElementById('btnAddRole');

        if (container.children.length > 0) {
            container.innerHTML = '';
            btn.style.display = '';
            return;
        }

        btn.style.display = 'none';

        const form = document.createElement('div');
        form.className = 'add-role-form';

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'form-input';
        keyInput.id = 'newRoleKey';
        keyInput.placeholder = 'Ключ (латиница)';
        keyInput.maxLength = 20;
        keyInput.style.width = '130px';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'form-input';
        nameInput.id = 'newRoleName';
        nameInput.placeholder = 'Название';
        nameInput.style.flex = '1';

        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.id = 'newRoleColor';
        colorPicker.value = '#868e96';
        colorPicker.className = 'role-color-picker';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary btn-sm';
        addBtn.textContent = 'Добавить';
        addBtn.addEventListener('click', () => this.addRole());

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary btn-sm';
        cancelBtn.textContent = 'Отмена';
        cancelBtn.addEventListener('click', () => this.toggleAddRole());

        form.appendChild(keyInput);
        form.appendChild(nameInput);
        form.appendChild(colorPicker);
        form.appendChild(addBtn);
        form.appendChild(cancelBtn);
        container.appendChild(form);

        keyInput.focus();
    },

    addRole() {
        const keyInput = document.getElementById('newRoleKey');
        const nameInput = document.getElementById('newRoleName');
        const colorInput = document.getElementById('newRoleColor');

        const key = keyInput.value.trim().toLowerCase();
        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!key || !name) {
            Toast.error('Заполните ключ и название');
            return;
        }

        if (!/^[a-z][a-z0-9_]{0,19}$/.test(key)) {
            Toast.error('Ключ: латиница, цифры, _ (начинается с буквы, макс. 20)');
            return;
        }

        if (RolesConfig.ALL_ROLES.includes(key)) {
            Toast.error('Роль с таким ключом уже существует');
            return;
        }

        // Добавить в RolesConfig (в памяти)
        RolesConfig._customRoles.push({ key, name, description: '', color });
        RolesConfig._defaults.names[key] = name;
        RolesConfig._defaults.descriptions[key] = '';
        RolesConfig._defaults.colors[key] = color;
        RolesConfig._rebuildRoleLists();

        this.toggleAddRole();
        this.renderRolesTable();
        Toast.info('Роль добавлена. Нажмите "Сохранить" для применения.');
    },

    async openDeleteRoleModal(roleKey) {
        this._pendingDeleteRole = roleKey;

        const nameEl = document.getElementById('deleteRoleName');
        nameEl.textContent = RolesConfig.getName(roleKey);

        const usersEl = document.getElementById('deleteRoleUsers');
        usersEl.innerHTML = '<div class="delete-role-no-users">Загрузка...</div>';

        // Заполнить dropdown переназначения
        const reassignMenu = document.getElementById('reassignRoleSelectMenu');
        const reassignInput = document.getElementById('reassignRoleSelectValue');
        const reassignLabel = document.getElementById('reassignRoleSelectLabel');
        const reassignTrigger = reassignMenu?.closest('.dropdown-wrap--form')?.querySelector('.dropdown-trigger--form');
        const otherRoles = RolesConfig.ASSIGNABLE_ROLES.filter(r => r !== roleKey);
        let reassignHtml = '';
        otherRoles.forEach((r, i) => {
            reassignHtml += '<div class="dropdown-item' + (i === 0 ? ' active' : '') + '" data-action="select-form-dropdown" data-value="' + this.escapeHtml(r) + '">' + this.escapeHtml(RolesConfig.getName(r)) + '</div>';
        });
        if (reassignMenu) reassignMenu.innerHTML = reassignHtml;
        if (reassignInput) reassignInput.value = otherRoles[0] || '';
        if (reassignLabel) reassignLabel.textContent = otherRoles[0] ? RolesConfig.getName(otherRoles[0]) : 'Выберите роль';
        if (reassignTrigger) reassignTrigger.classList.remove('placeholder');

        this.openModal('deleteRoleModal');

        // Если роль кастомная и ещё не сохранена на бэкенде — пропустить API
        if (RolesConfig.isCustomRole(roleKey)) {
            // Проверяем есть ли она на бэкенде (сохранена ли)
            try {
                const result = await CloudStorage.getUsersByRole({ roleKey });
                if (result.success && result.count > 0) {
                    usersEl.innerHTML = result.users.map(u =>
                        '<div class="delete-role-user">' + this.escapeHtml(u.name || u.email) + ' (' + this.escapeHtml(u.email) + ')</div>'
                    ).join('');
                    document.getElementById('reassignGroup').style.display = '';
                } else {
                    usersEl.innerHTML = '<div class="delete-role-no-users">Нет пользователей с этой ролью</div>';
                    document.getElementById('reassignGroup').style.display = 'none';
                }
            } catch (e) {
                usersEl.innerHTML = '<div class="delete-role-no-users">Нет пользователей с этой ролью</div>';
                document.getElementById('reassignGroup').style.display = 'none';
            }
        } else {
            // Дефолтная роль — всегда проверяем на бэкенде
            try {
                const result = await CloudStorage.getUsersByRole({ roleKey });
                if (result.success && result.count > 0) {
                    usersEl.innerHTML = result.users.map(u =>
                        '<div class="delete-role-user">' + this.escapeHtml(u.name || u.email) + ' (' + this.escapeHtml(u.email) + ')</div>'
                    ).join('');
                    document.getElementById('reassignGroup').style.display = '';
                } else {
                    usersEl.innerHTML = '<div class="delete-role-no-users">Нет пользователей с этой ролью</div>';
                    document.getElementById('reassignGroup').style.display = 'none';
                }
            } catch (error) {
                usersEl.innerHTML = '<div class="delete-role-no-users">Ошибка загрузки</div>';
                document.getElementById('reassignGroup').style.display = '';
            }
        }
    },

    async confirmDeleteRole() {
        const roleKey = this._pendingDeleteRole;
        if (!roleKey) return;

        const reassignTo = document.getElementById('reassignRoleSelectValue')?.value || '';
        const reassignGroupVisible = document.getElementById('reassignGroup').style.display !== 'none';

        const btn = document.getElementById('btnConfirmDeleteRole');
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        if (reassignGroupVisible && reassignTo) {
            // Есть пользователи — удаляем через API с переназначением
            try {
                const result = await CloudStorage.deleteRole({
                    roleKey: roleKey,
                    reassignTo: reassignTo
                });

                if (result.error) {
                    throw new Error(result.error);
                }

                Toast.success('Роль удалена, ' + (result.reassignedCount || 0) + ' пользователей переназначено');
            } catch (error) {
                Toast.error('Ошибка: ' + error.message);
                this._pendingDeleteRole = null;
                if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
                return;
            }
        }

        this.closeModal('deleteRoleModal');
        if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }

        // Удалить из RolesConfig (в памяти)
        RolesConfig._customRoles = RolesConfig._customRoles.filter(r => r.key !== roleKey);
        delete RolesConfig._defaults.names[roleKey];
        delete RolesConfig._defaults.descriptions[roleKey];
        delete RolesConfig._defaults.colors[roleKey];
        if (RolesConfig._overrides) {
            if (RolesConfig._overrides.names) delete RolesConfig._overrides.names[roleKey];
            if (RolesConfig._overrides.descriptions) delete RolesConfig._overrides.descriptions[roleKey];
            if (RolesConfig._overrides.colors) delete RolesConfig._overrides.colors[roleKey];
        }
        RolesConfig._rebuildRoleLists();

        this._pendingDeleteRole = null;
        this.renderRolesTable();
        this.populateRoleSelects();
        this.renderPermissions();
        this.renderUsers();

        // Сохранить обновлённый конфиг
        try {
            await CloudStorage.saveRoleConfig({ config: RolesConfig.getFullConfig() });
        } catch (e) {
            // Уже удалено локально, ошибка сохранения не критична
        }
    },

    async saveRoleNames() {
        const btn = document.getElementById('btnSaveRoleNames');
        btn.disabled = true;
        btn.textContent = 'Сохранение...';

        // Собрать overrides (изменённые названия + цвета)
        const nameOverrides = {};
        const colorOverrides = {};

        document.querySelectorAll('.role-name-input').forEach(input => {
            const role = input.dataset.role;
            const value = input.value.trim();
            const defaultName = RolesConfig.getDefaultName(role);

            if (value && value !== defaultName) {
                nameOverrides[role] = value;
            }
        });

        // Собрать изменённые цвета
        Object.entries(this._pendingColors).forEach(([role, color]) => {
            const defaultColor = RolesConfig._defaults.colors[role];
            if (color !== defaultColor) {
                colorOverrides[role] = color;
            }
        });

        const config = {
            customRoles: RolesConfig._customRoles.map(r => ({ ...r })),
            overrides: {}
        };

        if (Object.keys(nameOverrides).length > 0) config.overrides.names = nameOverrides;
        if (Object.keys(colorOverrides).length > 0) config.overrides.colors = colorOverrides;

        try {
            const result = await CloudStorage.saveRoleConfig({ config });

            if (result.error) {
                throw new Error(result.error);
            }

            RolesConfig.applyOverrides(config);
            this._pendingColors = {};

            this.populateRoleSelects();
            this.renderPermissions();
            this.renderUsers();

            Toast.success('Роли сохранены');

            btn.textContent = 'Сохранено';
            btn.classList.add('success');

            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('success');
                btn.textContent = 'Сохранить';
            }, 2000);

        } catch (error) {
            btn.disabled = false;
            btn.textContent = 'Сохранить';
            Toast.error('Ошибка: ' + error.message);
        }
    },

    resetRoleNames() {
        const inputs = document.querySelectorAll('.role-name-input');
        inputs.forEach(input => {
            const role = input.dataset.role;
            input.value = RolesConfig.getDefaultName(role);
        });
        this._pendingColors = {};
        this.renderRolesTable();
        Toast.info('Сброшено к стандартным. Нажмите "Сохранить" для применения.');
    },

    renderPermissions() {
        const tbody = document.getElementById('permissionsTableBody');
        tbody.innerHTML = '';
        // EXP-06: скрыть loading-state при рендере (данные уже получены)
        const loadingEl = document.getElementById('permissionsLoadingState');
        if (loadingEl) loadingEl.classList.add('hidden');

        // Получаем права, которые можно назначать
        const assignable = typeof RoleGuard !== 'undefined'
            ? RoleGuard.getAssignablePermissions()
            : null;

        // Все роли (как в табе "Управление ролями")
        RolesConfig.ALL_ROLES.forEach(role => {
            const row = document.createElement('tr');
            const roleName = RolesConfig.getName(role);
            const isSystem = RolesConfig.isSystemRole(role);

            if (isSystem) row.classList.add('system-role-row');

            let cells = `
                <td>
                    <div class="role-cell">
                        <span class="role-badge role-${this.escapeHtml(role)}" data-role-color="${RolesConfig.isCustomRole(role) ? this.escapeHtml(RolesConfig.getColor(role)) : ''}">${this.escapeHtml(roleName)}</span>
                    </div>
                </td>
            `;

            this.modules.forEach(module => {
                const perm = this.permissions[role]?.[module] || { view: false, edit: false, delete: false };

                if (isSystem) {
                    // Системные роли — только отображение, без редактирования
                    const safeRoleName = this.escapeHtml(roleName);
                    const safeModule = this.escapeHtml(module);
                    cells += `
                        <td>
                            <div class="permission-checkboxes">
                                <div class="permission-cb view${perm.view ? ' checked' : ''} disabled"
                                     role="checkbox" aria-checked="${perm.view ? 'true' : 'false'}" tabindex="-1"
                                     aria-label="Просмотр: ${safeRoleName} / ${safeModule} (системная роль)"
                                     title="Просмотр (системная роль)">V</div>
                                <div class="permission-cb edit${perm.edit ? ' checked' : ''} disabled"
                                     role="checkbox" aria-checked="${perm.edit ? 'true' : 'false'}" tabindex="-1"
                                     aria-label="Редактирование: ${safeRoleName} / ${safeModule} (системная роль)"
                                     title="Редактирование (системная роль)">E</div>
                                <div class="permission-cb delete${perm.delete ? ' checked' : ''} disabled"
                                     role="checkbox" aria-checked="${perm.delete ? 'true' : 'false'}" tabindex="-1"
                                     aria-label="Удаление: ${safeRoleName} / ${safeModule} (системная роль)"
                                     title="Удаление (системная роль)">D</div>
                            </div>
                        </td>
                    `;
                } else {
                    // Назначаемые роли — можно редактировать
                    const canAssignView = !assignable || assignable[module]?.canView;
                    const canAssignEdit = !assignable || assignable[module]?.canEdit;
                    const canAssignDelete = !assignable || assignable[module]?.canDelete;
                    const safeRoleName = this.escapeHtml(roleName);
                    const safeModule = this.escapeHtml(module);

                    cells += `
                        <td>
                            <div class="permission-checkboxes">
                                <div class="permission-cb view${perm.view ? ' checked' : ''}${!canAssignView ? ' disabled' : ''}"
                                     role="checkbox" aria-checked="${perm.view ? 'true' : 'false'}" tabindex="${canAssignView ? '0' : '-1'}"
                                     data-role="${role}" data-module="${module}" data-type="view"
                                     ${canAssignView ? 'data-action="toggle-permission"' : ''}
                                     aria-label="Просмотр: ${safeRoleName} / ${safeModule}${!canAssignView ? ' (недоступно)' : ''}"
                                     title="Просмотр${!canAssignView ? ' (недоступно)' : ''}">V</div>
                                <div class="permission-cb edit${perm.edit ? ' checked' : ''}${!canAssignEdit ? ' disabled' : ''}"
                                     role="checkbox" aria-checked="${perm.edit ? 'true' : 'false'}" tabindex="${canAssignEdit ? '0' : '-1'}"
                                     data-role="${role}" data-module="${module}" data-type="edit"
                                     ${canAssignEdit ? 'data-action="toggle-permission"' : ''}
                                     aria-label="Редактирование: ${safeRoleName} / ${safeModule}${!canAssignEdit ? ' (недоступно)' : ''}"
                                     title="Редактирование${!canAssignEdit ? ' (недоступно)' : ''}">E</div>
                                <div class="permission-cb delete${perm.delete ? ' checked' : ''}${!canAssignDelete ? ' disabled' : ''}"
                                     role="checkbox" aria-checked="${perm.delete ? 'true' : 'false'}" tabindex="${canAssignDelete ? '0' : '-1'}"
                                     data-role="${role}" data-module="${module}" data-type="delete"
                                     ${canAssignDelete ? 'data-action="toggle-permission"' : ''}
                                     aria-label="Удаление: ${safeRoleName} / ${safeModule}${!canAssignDelete ? ' (недоступно)' : ''}"
                                     title="Удаление${!canAssignDelete ? ' (недоступно)' : ''}">D</div>
                            </div>
                        </td>
                    `;
                }
            });

            row.innerHTML = cells;
            tbody.appendChild(row);
        });

        this.applyBadgeColors();
    },

    togglePermission(el) {
        if (el.classList.contains('disabled')) return;
        el.classList.toggle('checked');
        // EXP-03: синхронизировать aria-checked для скринридеров (VIS-02)
        el.setAttribute('aria-checked', el.classList.contains('checked') ? 'true' : 'false');
    },

    async savePermissions() {
        const btn = document.getElementById('btnSavePermissions');
        btn.disabled = true;
        btn.innerHTML = 'Сохранение...';

        // Собрать данные
        const permissions = {};
        const editableRoles = RolesConfig.ASSIGNABLE_ROLES;

        editableRoles.forEach(role => {
            permissions[role] = {};
            this.modules.forEach(module => {
                permissions[role][module] = {
                    view: document.querySelector(`.permission-cb[data-role="${role}"][data-module="${module}"][data-type="view"]`)?.classList.contains('checked') || false,
                    edit: document.querySelector(`.permission-cb[data-role="${role}"][data-module="${module}"][data-type="edit"]`)?.classList.contains('checked') || false,
                    delete: document.querySelector(`.permission-cb[data-role="${role}"][data-module="${module}"][data-type="delete"]`)?.classList.contains('checked') || false
                };
            });
        });

        try {
            const result = await CloudStorage.savePermissions({ permissions });

            if (result.error) {
                throw new Error(result.error);
            }

            Toast.success('Права сохранены');

            btn.innerHTML = 'Сохранено';
            btn.classList.add('success');

            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('success');
                btn.innerHTML = 'Сохранить';
            }, 2000);

            CloudStorage.clearCacheNamespace('adminData');
            await this.loadAllData();

        } catch (error) {
            btn.disabled = false;
            btn.innerHTML = 'Сохранить';
            Toast.error('Ошибка: ' + error.message);
        }
    },

    // ============ Audit Log ============

    populateAuditFilter() {
        const menu = document.getElementById('filterActionMenu');
        if (!menu) return;

        const groups = {
            'Пользователи': ['user_approved', 'user_rejected', 'user_blocked', 'user_unblocked', 'user_updated', 'user_deleted', 'role_changed'],
            'Команды': ['team_created', 'team_updated', 'team_deleted', 'team_settings_changed'],
            'Права': ['permissions_changed'],
            'Приглашения': ['invite_sent', 'invite_accepted', 'invite_rejected'],
            'Партнёры': ['partner_created', 'partner_updated', 'partner_deleted'],
            'Сотрудники': ['employee_created', 'employee_updated', 'employee_deleted'],
            'Онбординг': ['onboarding_created', 'onboarding_imported', 'onboarding_step_submitted', 'onboarding_step_approved', 'onboarding_step_rejected', 'onboarding_completed', 'onboarding_cancelled', 'onboarding_reactivated', 'onboarding_reassigned', 'onboarding_rolled_back', 'onboarding_withdrawn', 'onboarding_deleted', 'onboarding_file_uploaded', 'onboarding_settings_updated'],
            'Прочее': ['storage_init', 'image_uploaded', 'image_deleted']
        };

        // Add scrollable class for long list
        menu.classList.add('dropdown-menu--scroll');

        for (const [label, actions] of Object.entries(groups)) {
            const items = actions.filter(a => this.actionNames[a]);
            if (items.length === 0) continue;

            const section = document.createElement('div');
            section.className = 'dropdown-section';
            section.textContent = label;
            menu.appendChild(section);

            for (const action of items) {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.dataset.action = 'select-filter';
                item.dataset.filter = 'filterAction';
                item.dataset.value = action;
                item.textContent = this.actionNames[action];
                menu.appendChild(item);
            }
        }
    },

    async loadMoreAudit() {
        if (this.vsEnabled) return;
        if (this._auditLoading) return;
        this._auditLoading = true;
        const btn = document.getElementById('loadMoreAuditBtn');
        if (btn) btn.classList.add('btn-loading');
        try {
            const result = await CloudStorage.getAuditLog({
                cursor: this.auditCursor || undefined,
                pageSize: this.auditPageSize,
                dateFrom: this.auditFilters.dateFrom || undefined,
                dateTo: this.auditFilters.dateTo || undefined,
                action: this.auditFilters.action || undefined
            });
            for (const _it of (result.data || [])) this.auditItems.push(_it);
            this.auditCursor = result.nextCursor || null;
            this.auditTotalCount = result.totalCount || this.auditItems.length;
            this._appendAuditItems(result.data || []);
            this._updateAuditCounter();
            this._updateLoadMoreBtn();
        } catch (error) {
            Toast.error('Ошибка загрузки истории: ' + error.message);
        } finally {
            this._auditLoading = false;
            if (btn) btn.classList.remove('btn-loading');
        }
    },

    async resetAndLoadAudit() {
        this.auditItems = [];
        this.auditCursor = null;
        this.auditTotalCount = 0;

        if (this.vsEnabled && this._auditVS) {
            // VirtualScroller integration (Phase 19 v2.29) — VS owns legacy <table id="auditTable">,
            // .destroy() очищает spacer-TR + visible rows атомарно.
            this._auditVS.destroy();
            this._auditVS = null;
        } else {
            // Phase 49 LIT-CONT-03 — non-VS path: clear signal вместо tbody.innerHTML = ''.
            // <app-table id="auditLogTable"> reactivно стирает строки через Lit диффинг (XSS-proof).
            this._mountAuditLogTable();
            if (this._auditSignal) this._auditSignal.value = [];
            // Legacy fallback: на случай если Lit недоступен или mount не удался — clear legacy tbody.
            // Не удаляем — VS spacer-TR pattern требует пустой tbody при reset когда vsEnabled позже включат.
            const tbody = document.getElementById('auditTbody');
            if (tbody) tbody.replaceChildren();
        }
        this._updateAuditCounter();
        await this._loadFirstAuditChunk();
    },

    async _loadFirstAuditChunk() {
        this._auditLoading = true;
        const loadingEl = document.getElementById('auditLoadingState');
        const listEl = document.getElementById('auditList');
        const emptyEl = document.getElementById('emptyAudit');

        // Показать спиннер, скрыть список и empty
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (listEl) listEl.classList.add('hidden');
        if (emptyEl) emptyEl.classList.add('hidden');

        try {
            const result = await CloudStorage.getAuditLog({
                cursor: undefined,
                pageSize: this.auditPageSize,
                dateFrom: this.auditFilters.dateFrom || undefined,
                dateTo: this.auditFilters.dateTo || undefined,
                action: this.auditFilters.action || undefined
            });
            this.auditItems = result.data || [];
            this.auditCursor = result.nextCursor || null;
            this.auditTotalCount = result.totalCount || this.auditItems.length;

            if (this.auditItems.length === 0) {
                if (emptyEl) emptyEl.classList.remove('hidden');
                this._updateAuditCounter();
                return;
            }

            // Показать список
            if (listEl) listEl.classList.remove('hidden');

            if (this.vsEnabled) {
                const auditTab = document.getElementById('tab-audit');
                if (auditTab && auditTab.classList.contains('active')) {
                    this._initAndStartAuditVS();
                } else {
                    this._auditVSPending = true;
                }
            } else {
                this._appendAuditItems(this.auditItems);
            }
            this._updateAuditCounter();
            this._updateLoadMoreBtn();
        } catch (error) {
            Toast.error('Ошибка загрузки истории: ' + error.message);
        } finally {
            this._auditLoading = false;
            if (loadingEl) loadingEl.classList.add('hidden');
        }
    },

    _initAndStartAuditVS() {
        this._initAuditVirtualScroller();
        if (this._auditVS) {
            const total = this.auditCursor ? (this.auditTotalCount || this.auditItems.length + 1) : this.auditItems.length;
            this._auditVS.init(
                this.auditItems,
                total,
                (page, pageSize) => this._auditFetchChunk(page, pageSize)
            );
        }
        this._auditVSPending = false;
    },

    _initAuditVirtualScroller() {
        if (!this.vsEnabled) return;
        const container = document.getElementById('auditList');
        const tbody = document.getElementById('auditTbody');
        if (!container || !tbody) return;

        this._auditVS = VirtualScroller.create({
            container: container,
            tbody: tbody,
            colCount: 1,
            renderRow: (item, index) => this._renderAuditRow(item, index),
            overscan: 5
        });
    },

    _renderAuditRow(item, index) {
        return this.createAuditRow(item);
    },

    _auditFetchChunk(_page, _pageSize) {
        return this._loadAuditChunk();
    },

    async _loadAuditChunk() {
        if (this._auditLoading || this.auditCursor === null) return;
        this._auditLoading = true;
        try {
            const result = await CloudStorage.getAuditLog({
                cursor: this.auditCursor || undefined,
                pageSize: this.auditPageSize,
                dateFrom: this.auditFilters.dateFrom || undefined,
                dateTo: this.auditFilters.dateTo || undefined,
                action: this.auditFilters.action || undefined
            });
            const newItems = result.data || [];
            for (const _it of newItems) this.auditItems.push(_it);
            this.auditCursor = result.nextCursor || null;
            this.auditTotalCount = result.totalCount || this.auditItems.length;

            if (this._auditVS) {
                this._auditVS.setItems(this.auditItems);
            }
            this._updateAuditCounter();
        } catch (error) {
            Toast.error('Ошибка загрузки истории: ' + error.message);
        } finally {
            this._auditLoading = false;
        }
    },

    _appendAuditItems(items) {
        const tbody = document.getElementById('auditTbody');
        const emptyEl = document.getElementById('emptyAudit');
        const appTable = document.getElementById('auditLogTable');
        if (!tbody || !items.length) {
            if (this.auditItems.length === 0 && emptyEl) {
                emptyEl.classList.remove('hidden');
                // v2.27 FIXES-VISUAL-02: hide app-table при empty (его дефолтный "Нет данных"
                // дублировал legacy #emptyAudit с иконкой + двухстрочной подписью)
                if (appTable) appTable.classList.add('hidden');
            }
            // Phase 49 LIT-CONT-03 — sync signal даже при пустых items (для empty-state Lit path)
            this._mountAuditLogTable();
            if (this._auditSignal) this._auditSignal.value = this._buildAuditRows(this.auditItems);
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');
        if (appTable) appTable.classList.remove('hidden'); // v2.27 FIXES-VISUAL-02 unhide on data
        // Legacy DOM path (для VS spacer-TR pattern когда vsEnabled=true, либо non-VS fallback)
        items.forEach(log => {
            tbody.appendChild(this.createAuditRow(log));
        });
        // Phase 49 LIT-CONT-03 — также пишем в signal (полный auditItems set, не дельта)
        // <app-table id="auditLogTable"> Lit-диффинг сам найдёт новые записи и обновит DOM атомарно.
        // Когда vsEnabled=true — <app-table> остаётся hidden, но signal sync保ёт parity для non-VS path и тестов.
        this._mountAuditLogTable();
        if (this._auditSignal) this._auditSignal.value = this._buildAuditRows(this.auditItems);
    },

    /**
     * Phase 49 LIT-CONT-03 — строит view-model rows для <app-table id="auditLogTable">.
     * Pure data layer (no DOM) — Lit cell renderers потом экранируют через автоэскейп.
     * Унифицирует pre-computation icon/message/time per row для signal-driven path.
     */
    _buildAuditRows(logs) {
        if (!Array.isArray(logs)) return [];
        return logs.map((log, idx) => {
            const actionName = this.actionNames[log.action] || log.action;
            const onbActions = ['onboarding_created','onboarding_step_submitted','onboarding_step_approved','onboarding_step_rejected','onboarding_reassigned','onboarding_completed','onboarding_cancelled','onboarding_deleted','onboarding_imported','onboarding_reactivated','onboarding_rolled_back','onboarding_withdrawn','onboarding_file_uploaded','onboarding_settings_updated'];
            const iconMap = {
                user_approved:  'approved',
                user_rejected:  'rejected',
                user_blocked:   'blocked',
                user_unblocked: 'unblocked',
                role_changed:   'role_changed',
                team_created:   'team_created',
                permissions_changed: 'permissions',
            };
            const iconClass = iconMap[log.action] || (onbActions.includes(log.action) ? 'onboarding' : 'info');
            // Stable id для litRepeat (избегаем DOM пересоздания при reorder/append)
            const id = log.id || `${log.timestamp || ''}-${log.action || ''}-${log.actorEmail || ''}-${idx}`;
            return {
                id,
                action: log.action,
                actionName,
                iconClass,
                actorEmail: log.actorEmail || '',
                targetEmail: log.targetEmail || '',
                oldValue: log.oldValue || '',
                newValue: log.newValue || '',
                details: log.details || '',
                timestamp: log.timestamp,
                timeStr: log.timestamp ? new Date(log.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
            };
        });
    },

    /**
     * Phase 49 LIT-CONT-03 — однократная настройка <app-table id="auditLogTable">:
     * — columns config с Lit cell renderer (auto-escape XSS-proof)
     * — effect-binding _auditSignal → tableEl.items (reactive)
     * — disposers tracked в _auditDisposers (cleanup в destroy)
     *
     * VirtualScroller (this._auditVS) integration preserved as-is — VS owns legacy
     * <table id="auditTable">. <app-table> mount активен только для non-VS path.
     */
    _mountAuditLogTable() {
        if (this._auditTableMounted) return;

        const tableEl = document.getElementById('auditLogTable');
        if (!tableEl) return;

        // Lit globals + signals required (cdn-deps.js loaded asynchronously)
        if (typeof window.signal !== 'function' || typeof window.effect !== 'function' || !window.litHtml) {
            // Lit ещё не готов — попытаемся отложить mount до lit-ready event
            if (!this._auditPendingMount) {
                this._auditPendingMount = true;
                window.addEventListener('lit-ready', () => {
                    this._auditPendingMount = false;
                    this._mountAuditLogTable();
                    // После late mount — re-sync signal с текущими items
                    if (this._auditSignal) {
                        this._auditSignal.value = this._buildAuditRows(this.auditItems || []);
                    }
                }, { once: true });
            }
            return;
        }

        const html = window.litHtml;
        const self = this;

        try {
            this._auditSignal = window.signal([]);

            // Action icon SVG map — pure presentation, без user input → инлайн SVG ok (статичный набор иконок).
            const ICON_SVGS = {
                approved:    html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`,
                rejected:    html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>`,
                blocked:     html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
                unblocked:   html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
                role_changed: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
                team_created: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
                permissions: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
                onboarding:  html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
                info:        html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
            };

            // Single column — audit row composes icon + message + actor + time inside one cell.
            // Lit html`` template автоматически экранирует interpolated values (XSS-proof для actorEmail, targetEmail и т.д.)
            tableEl.columns = [
                {
                    key: 'audit',
                    label: '',
                    render: (item) => {
                        const iconSvg = ICON_SVGS[item.iconClass] || ICON_SVGS.info;
                        // Message rendering — Lit автоэскейп для interpolated values (item.targetEmail, oldValue, etc)
                        let messageNode;
                        switch (item.action) {
                            case 'user_approved':
                                messageNode = html`Пользователь <strong>${item.targetEmail}</strong> одобрен`;
                                break;
                            case 'user_rejected':
                                messageNode = html`Пользователь <strong>${item.targetEmail}</strong> отклонён`;
                                break;
                            case 'user_blocked':
                                messageNode = html`Пользователь <strong>${item.targetEmail}</strong> заблокирован`;
                                break;
                            case 'user_unblocked':
                                messageNode = html`Пользователь <strong>${item.targetEmail}</strong> разблокирован`;
                                break;
                            case 'role_changed': {
                                const oldName = RolesConfig.getName(item.oldValue) || item.oldValue;
                                const newName = RolesConfig.getName(item.newValue) || item.newValue;
                                messageNode = html`<strong>${item.targetEmail}</strong>: ${oldName} → ${newName}`;
                                break;
                            }
                            case 'team_created':
                                messageNode = html`Создана команда <strong>${item.newValue}</strong>`;
                                break;
                            case 'permissions_changed':
                                messageNode = 'Изменены права ролей';
                                break;
                            default:
                                messageNode = html`${item.actionName}: ${item.targetEmail || item.details}`;
                                break;
                        }
                        return html`
                            <div class="audit-cell">
                                <div class="audit-icon ${item.iconClass}">${iconSvg}</div>
                                <div class="audit-content">
                                    <div class="audit-message">${messageNode}</div>
                                    <div class="audit-details">${item.actorEmail}</div>
                                </div>
                                <div class="audit-time">${item.timeStr}</div>
                            </div>
                        `;
                    }
                }
            ];

            // Reactive items binding via effect (Option A — direct prop assignment, mirror Phase 40/48 pattern)
            const dispose = window.effect(() => {
                tableEl.items = self._auditSignal.value || [];
            });
            this._auditDisposers.push(dispose);

            this._auditTableMounted = true;
        } catch (e) {
            console.warn('[admin] _mountAuditLogTable failed (non-fatal):', e?.message);
            this._auditTableMounted = false;
        }
    },

    _updateAuditCounter() {
        const el = document.getElementById('auditCounter');
        if (!el) return;
        if (this.auditTotalCount > 0) {
            el.textContent = 'Показано ' + this.auditItems.length + ' из ' + this.auditTotalCount;
        } else {
            el.textContent = '';
        }
    },

    _updateLoadMoreBtn() {
        const btn = document.getElementById('loadMoreAuditBtn');
        if (!btn) return;
        if (this.vsEnabled) {
            btn.classList.add('hidden');
            return;
        }
        btn.classList.toggle('hidden', this.auditCursor === null);
    },

    filterAudit() {
        this.auditFilters.action = this._getFilterValue('filterAction') || '';
        this.resetAndLoadAudit();
    },

    /** Создаёт <tr> для аудит-лога. Используется и VS, и non-VS путями. */
    createAuditRow(log) {
        const actionName = this.actionNames[log.action] || log.action;

        // Иконка + цвет
        const iconMap = {
            user_approved:  ['approved',    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>'],
            user_rejected:  ['rejected',    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>'],
            user_blocked:   ['blocked',     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'],
            user_unblocked: ['unblocked',   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'],
            role_changed:   ['role_changed', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'],
            team_created:   ['team_created', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>'],
            permissions_changed: ['permissions', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'],
        };
        const onbActions = ['onboarding_created','onboarding_step_submitted','onboarding_step_approved','onboarding_step_rejected','onboarding_reassigned','onboarding_completed','onboarding_cancelled','onboarding_deleted','onboarding_imported','onboarding_reactivated','onboarding_rolled_back','onboarding_withdrawn','onboarding_file_uploaded','onboarding_settings_updated'];
        const onbIcon = ['onboarding', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>'];
        const defaultIcon = ['info', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'];

        const [iconClass, iconSvg] = iconMap[log.action] || (onbActions.includes(log.action) ? onbIcon : defaultIcon);

        // Сообщение
        const e = (v) => this.escapeHtml(v || '');
        let message;
        switch (log.action) {
            case 'user_approved':  message = `Пользователь <strong>${e(log.targetEmail)}</strong> одобрен`; break;
            case 'user_rejected':  message = `Пользователь <strong>${e(log.targetEmail)}</strong> отклонён`; break;
            case 'user_blocked':   message = `Пользователь <strong>${e(log.targetEmail)}</strong> заблокирован`; break;
            case 'user_unblocked': message = `Пользователь <strong>${e(log.targetEmail)}</strong> разблокирован`; break;
            case 'role_changed':   message = `<strong>${e(log.targetEmail)}</strong>: ${RolesConfig.getName(log.oldValue) || e(log.oldValue)} → ${RolesConfig.getName(log.newValue) || e(log.newValue)}`; break;
            case 'team_created':   message = `Создана команда <strong>${e(log.newValue)}</strong>`; break;
            case 'permissions_changed': message = 'Изменены права ролей'; break;
            default: message = `${e(actionName)}: ${e(log.targetEmail) || e(log.details)}`; break;
        }

        // Время
        const timeStr = new Date(log.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        // Строка таблицы
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.innerHTML = `
            <div class="audit-cell">
                <div class="audit-icon ${iconClass}">${iconSvg}</div>
                <div class="audit-content">
                    <div class="audit-message">${message}</div>
                    <div class="audit-details">${e(log.actorEmail)}</div>
                </div>
                <div class="audit-time">${timeStr}</div>
            </div>`;
        tr.appendChild(td);
        return tr;
    },

    // ============ Pagination ============

    renderPagination(container, currentPage, totalPages, onPageChange) {
        container.innerHTML = '';

        if (totalPages <= 1) return;

        // Store callback in container dataset
        const containerId = container.id || 'pagination-' + Math.random().toString(36).substr(2, 9);
        container.id = containerId;
        this._paginationCallbacks = this._paginationCallbacks || {};
        this._paginationCallbacks[containerId] = onPageChange;

        // Prev button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '←';
        prevBtn.disabled = currentPage === 1;
        prevBtn.dataset.action = 'pagination';
        prevBtn.dataset.page = currentPage - 1;
        prevBtn.dataset.container = containerId;
        container.appendChild(prevBtn);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = 'page-btn' + (i === currentPage ? ' active' : '');
                pageBtn.textContent = i;
                pageBtn.dataset.action = 'pagination';
                pageBtn.dataset.page = i;
                pageBtn.dataset.container = containerId;
                container.appendChild(pageBtn);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.className = 'pagination-dots';
                container.appendChild(dots);
            }
        }

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '→';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.dataset.action = 'pagination';
        nextBtn.dataset.page = currentPage + 1;
        nextBtn.dataset.container = containerId;
        container.appendChild(nextBtn);
    },

    // ============ Tabs ============

    switchTab(tabName) {
        this.currentTab = tabName;

        // Обновить кнопки
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Обновить контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === 'tab-' + tabName);
        });

        // VirtualScroller: lazy init при первом показе таба аудита
        if (tabName === 'audit' && this.vsEnabled) {
            if (this._auditVSPending) {
                requestAnimationFrame(() => this._initAndStartAuditVS());
            } else if (this._auditVS) {
                requestAnimationFrame(() => this._auditVS.refresh());
            }
        }
    },

    // ============ Modals ============

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        // Phase 28 LIT-MIG-01: <app-modal> Lit component использует boolean attribute API
        if (modal.tagName === 'APP-MODAL') {
            modal.setAttribute('open', '');
        } else {
            modal.classList.add('active');
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        // Phase 28 LIT-MIG-01: <app-modal> compat
        if (modal.tagName === 'APP-MODAL') {
            modal.removeAttribute('open');
        } else {
            modal.classList.remove('active');
        }
    },

    // ============ Helpers ============

    getInitials(name) { return Utils.getInitials(name); },
    escapeHtml(text) { return Utils.escapeHtml(text); },

    destroy() {
        // Phase 67 SYNC-FIX-05: stop cross-user polling
        this._stopCrossUserPoll();

        if (this._inputHandler) {
            document.removeEventListener('input', this._inputHandler);
            this._inputHandler = null;
        }
        if (this._changeHandler) {
            document.removeEventListener('change', this._changeHandler);
            this._changeHandler = null;
        }
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }
        if (this._permKeyHandler) {
            document.removeEventListener('keydown', this._permKeyHandler);
            this._permKeyHandler = null;
        }
        clearTimeout(this._filterTimer);
        this._paginationCallbacks = null;

        // Phase 40 LIT-MIG-01 admin pilot — dispose Lit effects (Pitfall C — no memory leak)
        if (Array.isArray(this._rolesDisposers)) {
            this._rolesDisposers.forEach(d => {
                try { d(); } catch (e) { /* swallow dispose errors */ }
            });
            this._rolesDisposers.length = 0;
        }
        this._rolesSignal = null;
        this._rolesTableMounted = false;

        // Phase 46 LIT-CONT-01 — dispose teams Lit effects (Pitfall C — no memory leak)
        if (Array.isArray(this._teamsDisposers)) {
            this._teamsDisposers.forEach(d => {
                try { d(); } catch (e) { /* swallow dispose errors */ }
            });
            this._teamsDisposers.length = 0;
        }
        this._teamsSignal = null;
        this._teamsGridMounted = false;

        // Phase 48 LIT-CONT-02 — dispose users Lit effects (Pitfall C — no memory leak)
        if (Array.isArray(this._usersDisposers)) {
            this._usersDisposers.forEach(d => {
                try { d(); } catch (e) { /* swallow dispose errors */ }
            });
            this._usersDisposers.length = 0;
        }
        this._usersSignal = null;
        this._usersTableMounted = false;

        // Phase 49 LIT-CONT-03 — dispose audit-log Lit effects (Pitfall C — no memory leak).
        // VirtualScroller separately owns _auditVS — его destroy() уже вызывается из resetAndLoadAudit/Tab switch.
        if (Array.isArray(this._auditDisposers)) {
            this._auditDisposers.forEach(d => {
                try { d(); } catch (e) { /* swallow dispose errors */ }
            });
            this._auditDisposers.length = 0;
        }
        this._auditSignal = null;
        this._auditTableMounted = false;
    }
};

// Initialize via PageLifecycle
PageLifecycle.init({
    module: 'admin-panel',
    async onInit() {
        // Проверяем права доступа к admin-panel (редирект на главную если нет доступа)
        if (typeof RoleGuard !== 'undefined' && !RoleGuard.checkPageAccess('admin-panel')) {
            return;
        }
        await adminApp.init();
        adminApp.attachEventListeners();
    },
    onDestroy() {
        adminApp.destroy();
    }
});
