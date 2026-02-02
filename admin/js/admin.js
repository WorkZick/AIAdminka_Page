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

    // Пагинация
    usersPage: 1,
    usersPerPage: 10,
    auditPage: 1,
    auditPerPage: 15,

    // Mock API режим
    USE_MOCK_API: false,

    // ============ MOCK DATA ============
    // Mock данные вынесены в admin-mock-data.js для удобства поддержки
    // Для использования: подключите <script src="js/admin-mock-data.js"></script> в index.html

    mockData: window.ADMIN_MOCK_DATA || {
        teams: [],
        users: [],
        requests: [],
        permissions: {},
        auditLog: []
    },

    // Названия ролей — из RolesConfig (shared/roles-config.js)

    // Модули
    modules: ['partners', 'team-info', 'traffic', 'reports', 'settings', 'documentation', 'team-management'],
    moduleNames: {
        'partners': 'Партнёры',
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
        'role_changed': 'Смена роли',
        'team_created': 'Создание команды',
        'team_settings_changed': 'Настройки команды',
        'permissions_changed': 'Изменение прав'
    },

    // ============ INITIALIZATION ============

    async init() {
        // Check authentication and role status (waiting_invite/blocked check)
        if (!await AuthGuard.checkWithRole()) {
            return; // Will redirect to login or waiting-invite
        }

        this.loadUserData();

        this.loadAllData();
    },

    attachEventListeners() {
        // Delegate for all input/change events (filters, searches)
        document.addEventListener('input', (e) => {
            const target = e.target;
            const action = target.dataset.action;

            if (action === 'filter-teams') {
                this.filterTeams();
            } else if (action === 'filter-users') {
                this.filterUsers();
            } else if (action === 'filter-audit') {
                this.filterAudit();
            }
        });

        // Delegate for all change events (selects)
        document.addEventListener('change', (e) => {
            const target = e.target;
            const action = target.dataset.action;

            if (action === 'filter-users') {
                this.filterUsers();
            } else if (action === 'filter-audit') {
                this.filterAudit();
            }
        });

        // Delegate for all click events
        document.addEventListener('click', (e) => {
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
                    if (approveId) this.approveRequest(approveId);
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
            }
        });

        // Form submissions
        const createTeamForm = document.getElementById('createTeamForm');
        if (createTeamForm) {
            createTeamForm.addEventListener('submit', (e) => this.createTeam(e));
        }

        const editTeamForm = document.getElementById('editTeamForm');
        if (editTeamForm) {
            editTeamForm.addEventListener('submit', (e) => this.saveTeam(e));
        }
    },

    loadUserData() {
        const authData = localStorage.getItem('cloud-auth');
        if (authData) {
            const auth = JSON.parse(authData);
            this.currentUser = {
                email: auth.email,
                name: auth.name,
                picture: auth.picture
            };

            // Обновить mock данные
            if (this.USE_MOCK_API) {
                this.mockData.users[0].email = auth.email;
                this.mockData.users[0].name = auth.name || this.mockData.users[0].name;
                this.mockData.users[0].picture = auth.picture || '';
            }
        }
    },

    async loadAllData() {
        try {
            const result = await this.apiCall('getAdminData');

            if (result.error) {
                console.error('Error loading admin data:', result.error);

                // Показать ошибку пользователю
                if (result.error.includes('токен') || result.error.includes('авторизации')) {
                    Toast.error('Ошибка авторизации. Обновите страницу и войдите заново.');
                } else {
                    Toast.error('Ошибка загрузки данных: ' + result.error);
                }
                return;
            }

            this.teams = result.teams || [];
            this.users = result.users || [];
            this.requests = result.requests || [];
            this.permissions = result.permissions || {};
            this.auditLog = result.auditLog || [];

            this.updateUI();

        } catch (error) {
            console.error('Error loading admin data:', error);
            Toast.error('Ошибка загрузки данных');
        }
    },

    // ============ API ============

    async apiCall(action, params = {}) {
        if (this.USE_MOCK_API) {
            return this.mockApiCall(action, params);
        }

        // Реальный API через CloudStorage (автоматически добавляет токен)
        try {
            return await CloudStorage.callApi(action, params);
        } catch (error) {
            console.error('API call error:', error);
            return { error: error.message || 'Ошибка сети' };
        }
    },

    async mockApiCall(action, params = {}) {
        await new Promise(resolve => setTimeout(resolve, 300));

        switch (action) {
            case 'getAdminData':
                return {
                    success: true,
                    teams: [...this.mockData.teams],
                    users: [...this.mockData.users],
                    requests: [...this.mockData.requests],
                    permissions: JSON.parse(JSON.stringify(this.mockData.permissions)),
                    auditLog: [...this.mockData.auditLog]
                };

            case 'createTeam':
                const newTeamId = 'team-' + Date.now();
                const newTeam = {
                    id: newTeamId,
                    name: params.name,
                    leaderEmail: params.leaderEmail,
                    leaderName: params.leaderName || 'Новый руководитель',
                    leaderReddyId: '',
                    description: params.description || '',
                    membersCount: 1,
                    isActive: true,
                    createdAt: new Date().toISOString()
                };
                this.mockData.teams.push(newTeam);
                this.addAuditLog('team_created', params.leaderEmail, newTeamId, '', params.name);
                return { success: true, teamId: newTeamId };

            case 'updateTeam':
                const teamIdx = this.mockData.teams.findIndex(t => t.id === params.teamId);
                if (teamIdx === -1) return { error: 'Команда не найдена' };
                Object.assign(this.mockData.teams[teamIdx], params);
                return { success: true };

            case 'updateUser':
                const userIdx = this.mockData.users.findIndex(u => u.email === params.targetEmail);
                if (userIdx === -1) return { error: 'Пользователь не найден' };
                const oldRole = this.mockData.users[userIdx].role;
                const oldStatus = this.mockData.users[userIdx].status;
                Object.assign(this.mockData.users[userIdx], {
                    teamId: params.teamId,
                    role: params.role,
                    status: params.status
                });

                if (params.role && params.role !== oldRole) {
                    this.addAuditLog('role_changed', params.targetEmail, params.teamId || '', oldRole, params.role);
                }
                if (params.status && params.status !== oldStatus) {
                    const action = params.status === 'blocked' ? 'user_blocked' : 'user_unblocked';
                    this.addAuditLog(action, params.targetEmail, params.teamId || '', oldStatus, params.status);
                }
                return { success: true };

            case 'approveRequest':
                const reqIdx = this.mockData.requests.findIndex(r => r.id === params.requestId);
                if (reqIdx === -1) return { error: 'Запрос не найден' };
                const request = this.mockData.requests[reqIdx];

                // Создаём пользователя
                this.mockData.users.push({
                    email: request.email,
                    name: request.name,
                    reddyId: request.reddyId,
                    picture: request.picture,
                    phone: '',
                    telegram: '',
                    position: '',
                    role: 'sales',
                    teamId: '',
                    status: 'approved_no_team',
                    createdAt: new Date().toISOString()
                });

                // Удаляем запрос
                this.mockData.requests.splice(reqIdx, 1);
                this.addAuditLog('user_approved', request.email, '', '', 'approved_no_team');
                return { success: true };

            case 'rejectRequest':
                const rejIdx = this.mockData.requests.findIndex(r => r.id === params.requestId);
                if (rejIdx === -1) return { error: 'Запрос не найден' };
                const rejRequest = this.mockData.requests[rejIdx];
                this.mockData.requests.splice(rejIdx, 1);
                this.addAuditLog('user_rejected', rejRequest.email, '', '', 'rejected');
                return { success: true };

            case 'savePermissions':
                this.mockData.permissions = JSON.parse(JSON.stringify(params.permissions));
                this.addAuditLog('permissions_changed', '', '', '', 'Все роли');
                return { success: true };

            default:
                return { error: 'Unknown action: ' + action };
        }
    },

    addAuditLog(action, targetEmail, targetTeamId, oldValue, newValue) {
        this.mockData.auditLog.unshift({
            id: 'log-' + Date.now(),
            timestamp: new Date().toISOString(),
            actorEmail: this.currentUser?.email || 'admin@example.com',
            actorRole: 'admin',
            action: action,
            targetEmail: targetEmail,
            targetTeamId: targetTeamId,
            oldValue: oldValue,
            newValue: newValue,
            details: ''
        });
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
        this.renderAuditLog();
        this.populateTeamFilter();
    },

    /**
     * Заполнить все select с ролями из RolesConfig
     */
    populateRoleSelects() {
        const roles = RolesConfig.ALL_ROLES.filter(r => r !== 'guest');

        // Фильтр ролей
        const filterSelect = document.getElementById('filterRole');
        if (filterSelect) {
            const currentValue = filterSelect.value;
            const firstOpt = filterSelect.querySelector('option[value=""]');
            filterSelect.innerHTML = '';
            if (firstOpt) filterSelect.appendChild(firstOpt);
            roles.forEach(role => {
                const opt = document.createElement('option');
                opt.value = role;
                opt.textContent = RolesConfig.getName(role);
                filterSelect.appendChild(opt);
            });
            filterSelect.value = currentValue;
        }

        // Модалка редактирования — заполняется в openEditUserModal
    },

    updateCounts() {
        document.getElementById('teamsCount').textContent = this.teams.filter(t => t.isActive).length;
        document.getElementById('usersCount').textContent = this.users.length;
        document.getElementById('requestsCount').textContent = this.requests.length;
    },

    populateTeamFilter() {
        const select = document.getElementById('filterTeam');
        if (!select) return;

        // Сохранить текущее значение
        const currentValue = select.value;

        // Очистить (кроме первого option)
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Добавить команды
        this.teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            select.appendChild(option);
        });

        // Восстановить значение
        select.value = currentValue;
    },

    // ============ Teams ============

    renderTeams() {
        const grid = document.getElementById('teamsGrid');
        const emptyEl = document.getElementById('emptyTeams');
        const searchValue = document.getElementById('searchTeams')?.value.toLowerCase() || '';

        // Фильтрация
        let filtered = [...this.teams];
        if (searchValue) {
            filtered = filtered.filter(t =>
                t.name.toLowerCase().includes(searchValue) ||
                t.leaderName.toLowerCase().includes(searchValue) ||
                t.leaderEmail.toLowerCase().includes(searchValue)
            );
        }

        // Очистить (кроме empty state)
        const cards = grid.querySelectorAll('.team-card');
        cards.forEach(card => card.remove());

        if (filtered.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }

        emptyEl.classList.add('hidden');

        // Сортировка: активные первые
        filtered.sort((a, b) => {
            if (a.isActive !== b.isActive) return b.isActive - a.isActive;
            return a.name.localeCompare(b.name);
        });

        filtered.forEach(team => {
            const card = this.createTeamCard(team);
            grid.insertBefore(card, emptyEl);
        });
    },

    createTeamCard(team) {
        const card = document.createElement('div');
        card.className = 'team-card' + (team.isActive ? '' : ' inactive');
        card.dataset.action = 'open-edit-team-modal';
        card.dataset.teamId = team.id;

        const initials = this.getInitials(team.leaderName);
        const members = this.users.filter(u => u.teamId === team.id);
        const membersHtml = members.map(m => {
            const mInitials = this.getInitials(m.name);
            const roleName = RolesConfig.getName(m.role);
            return `<div class="team-member">
                <div class="team-member-avatar">${m.picture ? `<img src="${this.escapeHtml(m.picture)}" alt="">` : mInitials}</div>
                <div class="team-member-info">
                    <span class="team-member-name">${this.escapeHtml(m.name || m.email)}</span>
                    <span class="team-member-role">${this.escapeHtml(roleName)}</span>
                </div>
            </div>`;
        }).join('');

        card.innerHTML = `
            <div class="team-card-header">
                <div class="team-name">${this.escapeHtml(team.name)}</div>
                <div class="team-status${team.isActive ? '' : ' inactive'}"></div>
            </div>
            <div class="team-card-body">
                <div class="team-leader">
                    <div class="team-leader-avatar">${initials}</div>
                    <span>${this.escapeHtml(team.leaderName)}</span>
                </div>
                ${members.length > 0 ? `<div class="team-members-list">${membersHtml}</div>` : ''}
                <div class="team-stats">
                    <div class="team-stat">
                        <span class="team-stat-value">${members.length}</span>
                        <span class="team-stat-label">Участников</span>
                    </div>
                </div>
            </div>
        `;

        return card;
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

        try {
            const result = await this.apiCall('createTeam', { name, leaderEmail, description });

            if (result.error) {
                throw new Error(result.error);
            }

            Toast.success('Команда создана');
            this.closeModal('createTeamModal');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
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

        try {
            const result = await this.apiCall('updateTeam', {
                teamId: this.editingTeam.id,
                name,
                description,
                isActive: this.editingTeamActive
            });

            if (result.error) {
                throw new Error(result.error);
            }

            Toast.success('Команда обновлена');
            this.closeModal('editTeamModal');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
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

        try {
            const result = await this.apiCall('deleteTeam', {
                teamId: this.editingTeam.id
            });

            if (result.error) {
                throw new Error(result.error);
            }

            Toast.success('Команда удалена');
            this.closeModal('deleteTeamModal');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
        }
    },

    // ============ Users ============

    renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        const emptyEl = document.getElementById('emptyUsers');
        const pagination = document.getElementById('usersPagination');

        const searchValue = document.getElementById('searchUsers')?.value.toLowerCase() || '';
        const teamFilter = document.getElementById('filterTeam')?.value || '';
        const roleFilter = document.getElementById('filterRole')?.value || '';
        const statusFilter = document.getElementById('filterStatus')?.value || '';

        // Фильтрация
        let filtered = [...this.users];

        // Leader видит только свою команду (admin видит всех)
        const isAdmin = typeof RoleGuard !== 'undefined' && RoleGuard.isAdmin();
        const isLeader = typeof RoleGuard !== 'undefined' && RoleGuard.hasRole('leader');
        const myTeamId = RoleGuard?.user?.teamId;
        if (isLeader && !isAdmin && myTeamId) {
            filtered = filtered.filter(u => u.teamId === myTeamId);
        }

        if (searchValue) {
            filtered = filtered.filter(u =>
                u.name.toLowerCase().includes(searchValue) ||
                u.email.toLowerCase().includes(searchValue) ||
                u.reddyId.includes(searchValue)
            );
        }

        if (teamFilter) {
            filtered = filtered.filter(u => u.teamId === teamFilter);
        }

        if (roleFilter) {
            filtered = filtered.filter(u => u.role === roleFilter);
        }

        if (statusFilter) {
            filtered = filtered.filter(u => u.status === statusFilter);
        }

        // Очистить таблицу
        tbody.innerHTML = '';

        if (filtered.length === 0) {
            emptyEl.classList.remove('hidden');
            pagination.innerHTML = '';
            return;
        }

        emptyEl.classList.add('hidden');

        // Пагинация
        const totalPages = Math.max(1, Math.ceil(filtered.length / this.usersPerPage));
        if (this.usersPage > totalPages) this.usersPage = totalPages;
        if (this.usersPage < 1) this.usersPage = 1;

        const start = (this.usersPage - 1) * this.usersPerPage;
        const end = start + this.usersPerPage;
        const pageUsers = filtered.slice(start, end);

        // Рендер строк
        pageUsers.forEach(user => {
            try {
                const row = this.createUserRow(user);
                tbody.appendChild(row);
            } catch (e) {
                console.error('Error rendering user:', user, e);
            }
        });

        // Рендер пагинации
        this.renderPagination(pagination, this.usersPage, totalPages, (page) => {
            this.usersPage = page;
            this.renderUsers();
        });

        this.applyBadgeColors();
    },

    createUserRow(user) {
        const row = document.createElement('tr');
        const initials = this.getInitials(user.name);
        const roleName = RolesConfig.getName(user.role);
        const team = this.teams.find(t => t.id === user.teamId);
        const teamName = team ? team.name : '';

        let statusClass = user.status;
        let statusText = user.status === 'active' ? 'Активен' :
                        user.status === 'blocked' ? 'Заблокирован' :
                        user.status === 'waiting_invite' ? 'Ожидает' : 'Без команды';

        row.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${user.picture ? `<img src="${this.escapeHtml(user.picture)}" alt="">` : initials}</div>
                    <div class="user-details">
                        <span class="user-name">${this.escapeHtml(user.name)}</span>
                        <span class="user-email">${this.escapeHtml(user.email)}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="user-team${teamName ? '' : ' no-team'}">${this.escapeHtml(teamName) || 'Нет'}</span>
            </td>
            <td>
                <span class="role-badge role-${this.escapeHtml(user.role)}" data-role-color="${RolesConfig.isCustomRole(user.role) ? this.escapeHtml(RolesConfig.getColor(user.role)) : ''}">${roleName}</span>
            </td>
            <td>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td>
                <button class="action-btn" data-action="open-edit-user-modal" data-email="${this.escapeHtml(user.email)}">Изменить</button>
            </td>
        `;

        return row;
    },

    filterUsers() {
        this.usersPage = 1;
        this.renderUsers();
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

        // Заполнить select команды
        const teamSelect = document.getElementById('modalUserTeam');
        teamSelect.innerHTML = '<option value="">Без команды</option>';

        // Leader видит только свою команду
        const isLeader = typeof RoleGuard !== 'undefined' && RoleGuard.hasRole('leader');
        const myTeamId = RoleGuard?.user?.teamId;

        this.teams.forEach(team => {
            // Leader может назначать только в свою команду
            if (isLeader && team.id !== myTeamId) return;

            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            if (team.id === user.teamId) option.selected = true;
            teamSelect.appendChild(option);
        });

        // Заполнить select ролей (только доступные)
        const roleSelect = document.getElementById('modalUserRole');
        roleSelect.innerHTML = '';

        const assignableRoles = typeof RoleGuard !== 'undefined'
            ? RoleGuard.getAssignableRoles()
            : ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'];

        assignableRoles.forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = RolesConfig.getName(role);
            if (role === user.role) option.selected = true;
            roleSelect.appendChild(option);
        });

        // Если текущая роль не в списке - добавить disabled
        if (!assignableRoles.includes(user.role)) {
            const option = document.createElement('option');
            option.value = user.role;
            option.textContent = RolesConfig.getName(user.role);
            option.selected = true;
            option.disabled = true;
            roleSelect.insertBefore(option, roleSelect.firstChild);
        }

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

        const teamId = document.getElementById('modalUserTeam').value;
        const role = document.getElementById('modalUserRole').value;
        const isWaiting = this.editingUserOriginalStatus === 'waiting_invite';
        const status = this.editingStatus === 'blocked' ? 'blocked' :
                      (teamId ? 'active' : (isWaiting ? 'waiting_invite' : 'approved_no_team'));

        try {
            const result = await this.apiCall('updateUser', {
                targetEmail: this.editingUser.email,
                teamId,
                role,
                status
            });

            if (result.error) {
                throw new Error(result.error);
            }

            Toast.success('Пользователь обновлён');
            this.closeModal('editUserModal');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
        }
    },

    confirmDeleteUser() {
        if (!this.editingUser) return;

        document.getElementById('deleteUserName').textContent =
            this.editingUser.name || this.editingUser.email;

        this.closeModal('editUserModal');
        this.openModal('deleteUserModal');
    },

    async deleteUser() {
        if (!this.editingUser) return;

        try {
            const result = await this.apiCall('deleteUser', {
                targetEmail: this.editingUser.email
            });

            if (result.error) {
                throw new Error(result.error);
            }

            Toast.success('Пользователь удалён');
            this.closeModal('deleteUserModal');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
        }
    },

    // ============ Requests ============

    renderRequests() {
        const grid = document.getElementById('requestsGrid');
        const emptyEl = document.getElementById('emptyRequests');

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
        card.className = 'request-card';
        card.id = 'request-' + request.id;

        const initials = this.getInitials(request.name);
        const date = new Date(request.requestedAt).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        card.innerHTML = `
            <div class="request-header">
                <div class="request-avatar">${initials}</div>
                <div class="request-info">
                    <div class="request-name">${this.escapeHtml(request.name)}</div>
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
                <div class="request-date">${date}</div>
            </div>
            <div class="request-actions">
                <button class="btn btn-success btn-sm" data-action="approve-request" data-request-id="${this.escapeHtml(request.id)}">Одобрить</button>
                <button class="btn btn-danger btn-sm" data-action="reject-request" data-request-id="${this.escapeHtml(request.id)}">Отклонить</button>
            </div>
        `;

        return card;
    },

    async approveRequest(requestId) {
        try {
            const result = await this.apiCall('approveRequest', { requestId });

            if (result.error) {
                throw new Error(result.error);
            }

            Toast.success('Пользователь одобрен');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
        }
    },

    confirmRejectRequest(requestId) {
        this._pendingRejectId = requestId;
        this.openModal('confirmRejectModal');
    },

    async executeRejectRequest() {
        const requestId = this._pendingRejectId;
        if (!requestId) return;

        this._pendingRejectId = null;
        this.closeModal('confirmRejectModal');

        try {
            const result = await this.apiCall('rejectRequest', { requestId });

            if (result.error) {
                throw new Error(result.error);
            }

            Toast.success('Запрос отклонён');
            await this.loadAllData();

        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
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

    renderRolesTable() {
        const tbody = document.getElementById('rolesTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        this._pendingColors = {};

        RolesConfig.ALL_ROLES.forEach(role => {
            const color = RolesConfig.getColor(role);
            const isSystem = RolesConfig.isSystemRole(role);
            const row = document.createElement('tr');

            // Color dot
            const tdColor = document.createElement('td');
            const dot = document.createElement('span');
            dot.className = 'role-color-dot';
            dot.style.background = color;
            dot.dataset.role = role;
            dot.addEventListener('click', () => this.pickRoleColor(dot, role));
            tdColor.appendChild(dot);

            // Key
            const tdKey = document.createElement('td');
            const code = document.createElement('code');
            code.className = 'role-key';
            code.textContent = role;
            tdKey.appendChild(code);

            // Name input
            const tdName = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-input role-name-input';
            input.dataset.role = role;
            input.value = RolesConfig.getName(role);
            input.placeholder = RolesConfig.getDefaultName(role);
            if (role === 'admin') input.disabled = true;
            tdName.appendChild(input);

            // Actions
            const tdActions = document.createElement('td');
            if (!isSystem) {
                const btn = document.createElement('button');
                btn.className = 'btn-delete-role';
                btn.dataset.role = role;
                btn.title = 'Удалить роль';
                btn.textContent = '✕';
                btn.addEventListener('click', () => this.openDeleteRoleModal(role));
                tdActions.appendChild(btn);
            }

            row.appendChild(tdColor);
            row.appendChild(tdKey);
            row.appendChild(tdName);
            row.appendChild(tdActions);
            tbody.appendChild(row);
        });
    },

    pickRoleColor(dot, role) {
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.value = this._pendingColors[role] || RolesConfig.getColor(role);
        picker.style.position = 'absolute';
        picker.style.opacity = '0';
        picker.style.width = '0';
        picker.style.height = '0';
        document.body.appendChild(picker);

        picker.addEventListener('input', () => {
            dot.style.background = picker.value;
            this._pendingColors[role] = picker.value;
        });
        picker.addEventListener('change', () => {
            document.body.removeChild(picker);
        });
        picker.addEventListener('blur', () => {
            if (picker.parentNode) document.body.removeChild(picker);
        });
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
        addBtn.className = 'btn-primary btn-sm';
        addBtn.textContent = 'Добавить';
        addBtn.addEventListener('click', () => this.addRole());

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-ghost btn-sm';
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

        // Заполнить select переназначения
        const select = document.getElementById('reassignRoleSelect');
        select.innerHTML = '';
        RolesConfig.ASSIGNABLE_ROLES.filter(r => r !== roleKey).forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = RolesConfig.getName(r);
            select.appendChild(opt);
        });

        this.openModal('deleteRoleModal');

        // Если роль кастомная и ещё не сохранена на бэкенде — пропустить API
        if (RolesConfig.isCustomRole(roleKey)) {
            // Проверяем есть ли она на бэкенде (сохранена ли)
            try {
                const result = await this.apiCall('getUsersByRole', { roleKey });
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
                const result = await this.apiCall('getUsersByRole', { roleKey });
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

        const reassignSelect = document.getElementById('reassignRoleSelect');
        const reassignTo = reassignSelect.value;
        const reassignGroupVisible = document.getElementById('reassignGroup').style.display !== 'none';

        this.closeModal('deleteRoleModal');

        if (reassignGroupVisible && reassignTo) {
            // Есть пользователи — удаляем через API с переназначением
            try {
                const result = await this.apiCall('deleteRole', {
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
                return;
            }
        }

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
            await this.apiCall('saveRoleConfig', { config: RolesConfig.getFullConfig() });
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
            const result = await this.apiCall('saveRoleConfig', { config });

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

        // Получаем права, которые можно назначать
        const assignable = typeof RoleGuard !== 'undefined'
            ? RoleGuard.getAssignablePermissions()
            : null;

        // Роли для настройки — динамически из ASSIGNABLE_ROLES
        const editableRoles = RolesConfig.ASSIGNABLE_ROLES;

        editableRoles.forEach(role => {
            const row = document.createElement('tr');
            const roleName = RolesConfig.getName(role);

            let cells = `
                <td>
                    <div class="role-cell">
                        <span class="role-badge role-${role}" data-role-color="${RolesConfig.isCustomRole(role) ? this.escapeHtml(RolesConfig.getColor(role)) : ''}">${roleName}</span>
                    </div>
                </td>
            `;

            this.modules.forEach(module => {
                const perm = this.permissions[role]?.[module] || { view: false, edit: false, delete: false };

                // Проверка: можно ли назначать это право
                const canAssignView = !assignable || assignable[module]?.canView;
                const canAssignEdit = !assignable || assignable[module]?.canEdit;
                const canAssignDelete = !assignable || assignable[module]?.canDelete;

                cells += `
                    <td>
                        <div class="permission-checkboxes">
                            <div class="permission-cb view${perm.view ? ' checked' : ''}${!canAssignView ? ' disabled' : ''}"
                                 data-role="${role}" data-module="${module}" data-type="view"
                                 ${canAssignView ? 'data-action="toggle-permission"' : ''}
                                 title="Просмотр${!canAssignView ? ' (недоступно)' : ''}">V</div>
                            <div class="permission-cb edit${perm.edit ? ' checked' : ''}${!canAssignEdit ? ' disabled' : ''}"
                                 data-role="${role}" data-module="${module}" data-type="edit"
                                 ${canAssignEdit ? 'data-action="toggle-permission"' : ''}
                                 title="Редактирование${!canAssignEdit ? ' (недоступно)' : ''}">E</div>
                            <div class="permission-cb delete${perm.delete ? ' checked' : ''}${!canAssignDelete ? ' disabled' : ''}"
                                 data-role="${role}" data-module="${module}" data-type="delete"
                                 ${canAssignDelete ? 'data-action="toggle-permission"' : ''}
                                 title="Удаление${!canAssignDelete ? ' (недоступно)' : ''}">D</div>
                        </div>
                    </td>
                `;
            });

            row.innerHTML = cells;
            tbody.appendChild(row);
        });

        this.applyBadgeColors();
    },

    togglePermission(el) {
        if (el.classList.contains('disabled')) return;
        el.classList.toggle('checked');
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
            const result = await this.apiCall('savePermissions', { permissions });

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

            await this.loadAllData();

        } catch (error) {
            btn.disabled = false;
            btn.innerHTML = 'Сохранить';
            Toast.error('Ошибка: ' + error.message);
        }
    },

    // ============ Audit Log ============

    renderAuditLog() {
        const list = document.getElementById('auditList');
        const emptyEl = document.getElementById('emptyAudit');
        const pagination = document.getElementById('auditPagination');

        const searchValue = document.getElementById('searchAudit')?.value.toLowerCase() || '';
        const actionFilter = document.getElementById('filterAction')?.value || '';

        // Фильтрация
        let filtered = [...this.auditLog];

        if (searchValue) {
            filtered = filtered.filter(log =>
                log.targetEmail.toLowerCase().includes(searchValue) ||
                log.actorEmail.toLowerCase().includes(searchValue) ||
                log.details.toLowerCase().includes(searchValue)
            );
        }

        if (actionFilter) {
            filtered = filtered.filter(log => log.action === actionFilter);
        }

        // Очистить (кроме empty state)
        const items = list.querySelectorAll('.audit-item');
        items.forEach(item => item.remove());

        if (filtered.length === 0) {
            emptyEl.classList.remove('hidden');
            pagination.innerHTML = '';
            return;
        }

        emptyEl.classList.add('hidden');

        // Пагинация
        const totalPages = Math.max(1, Math.ceil(filtered.length / this.auditPerPage));
        if (this.auditPage > totalPages) this.auditPage = totalPages;
        if (this.auditPage < 1) this.auditPage = 1;

        const start = (this.auditPage - 1) * this.auditPerPage;
        const end = start + this.auditPerPage;
        const pageItems = filtered.slice(start, end);

        // Рендер
        pageItems.forEach(log => {
            const item = this.createAuditItem(log);
            list.insertBefore(item, emptyEl);
        });

        // Рендер пагинации
        this.renderPagination(pagination, this.auditPage, totalPages, (page) => {
            this.auditPage = page;
            this.renderAuditLog();
        });
    },

    createAuditItem(log) {
        const item = document.createElement('div');
        item.className = 'audit-item';

        const actionName = this.actionNames[log.action] || log.action;
        let iconClass = '';
        let iconSvg = '';

        switch (log.action) {
            case 'user_approved':
                iconClass = 'approved';
                iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>';
                break;
            case 'user_rejected':
                iconClass = 'rejected';
                iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>';
                break;
            case 'user_blocked':
                iconClass = 'blocked';
                iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
                break;
            case 'user_unblocked':
                iconClass = 'unblocked';
                iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
                break;
            case 'role_changed':
                iconClass = 'role_changed';
                iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
                break;
            case 'team_created':
                iconClass = 'team_created';
                iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>';
                break;
            case 'permissions_changed':
                iconClass = 'permissions';
                iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
                break;
            default:
                iconClass = 'permissions';
                iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        }

        let message = '';
        const safeEmail = this.escapeHtml(log.targetEmail);
        switch (log.action) {
            case 'user_approved':
                message = `Пользователь <strong>${safeEmail}</strong> одобрен`;
                break;
            case 'user_rejected':
                message = `Пользователь <strong>${safeEmail}</strong> отклонён`;
                break;
            case 'user_blocked':
                message = `Пользователь <strong>${safeEmail}</strong> заблокирован`;
                break;
            case 'user_unblocked':
                message = `Пользователь <strong>${safeEmail}</strong> разблокирован`;
                break;
            case 'role_changed':
                message = `<strong>${safeEmail}</strong>: ${RolesConfig.getName(log.oldValue) || this.escapeHtml(log.oldValue)} → ${RolesConfig.getName(log.newValue) || this.escapeHtml(log.newValue)}`;
                break;
            case 'team_created':
                message = `Создана команда <strong>${this.escapeHtml(log.newValue)}</strong>`;
                break;
            case 'permissions_changed':
                message = `Изменены права ролей`;
                break;
            default:
                message = `${this.escapeHtml(actionName)}: ${safeEmail || this.escapeHtml(log.details)}`;
        }

        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });

        item.innerHTML = `
            <div class="audit-icon ${iconClass}">${iconSvg}</div>
            <div class="audit-content">
                <div class="audit-message">${message}</div>
                <div class="audit-details">${this.escapeHtml(log.actorEmail)}</div>
            </div>
            <div class="audit-time">${timeStr}</div>
        `;

        return item;
    },

    filterAudit() {
        this.auditPage = 1;
        this.renderAuditLog();
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
    },

    // ============ Modals ============

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    // ============ Helpers ============

    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ').filter(p => p.length > 0);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        if (parts.length === 1 && parts[0].length > 0) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return '?';
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Для отладки Mock API
if (adminApp.USE_MOCK_API) {
    window.adminMock = {
        addTeam: (name, leaderEmail) => {
            adminApp.apiCall('createTeam', { name, leaderEmail }).then(() => adminApp.loadAllData());
        },
        addRequest: (name, email, reddyId) => {
            adminApp.mockData.requests.push({
                id: 'req-' + Date.now(),
                email: email,
                name: name,
                reddyId: reddyId,
                picture: '',
                status: 'pending',
                requestedAt: new Date().toISOString()
            });
            adminApp.loadAllData();
        }
    };
}

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    // Инициализация компонентов
    ComponentLoader.init('../shared');
    await ComponentLoader.load('sidebar', '#sidebar-container', {
        basePath: '..',
        activeModule: 'admin-panel'
    });
    await ComponentLoader.load('about-modal', '#about-modal-container', {
        basePath: '..'
    });
    SidebarController.init({ basePath: '..' });

    // Инициализация приложения
    adminApp.init();
    adminApp.attachEventListeners();
});

// Закрытие модалок по клику на оверлей
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            adminApp.closeModal(this.id);
        }
    });
});
