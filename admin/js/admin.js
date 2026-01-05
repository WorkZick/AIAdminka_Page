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
    USE_MOCK_API: true,

    // ============ MOCK DATA ============

    mockData: {
        teams: [
            {
                id: 'team-001',
                name: 'Команда Alpha',
                leaderEmail: 'leader1@example.com',
                leaderName: 'Иван Петров',
                leaderReddyId: '111111',
                description: 'Основная команда по работе с партнёрами',
                membersCount: 5,
                isActive: true,
                createdAt: '2025-11-01T10:00:00Z'
            },
            {
                id: 'team-002',
                name: 'Команда Beta',
                leaderEmail: 'leader2@example.com',
                leaderName: 'Мария Сидорова',
                leaderReddyId: '222222',
                description: 'Команда продаж',
                membersCount: 3,
                isActive: true,
                createdAt: '2025-12-15T14:30:00Z'
            },
            {
                id: 'team-003',
                name: 'Архив команда',
                leaderEmail: 'leader3@example.com',
                leaderName: 'Сергей Козлов',
                leaderReddyId: '333333',
                description: 'Неактивная команда',
                membersCount: 0,
                isActive: false,
                createdAt: '2025-06-20T09:00:00Z'
            }
        ],
        users: [
            {
                email: 'admin@example.com',
                name: 'Администратор Системы',
                reddyId: '000001',
                picture: '',
                phone: '+7 999 000-00-01',
                telegram: 'admin_sys',
                position: 'Системный администратор',
                role: 'admin',
                teamId: '',
                status: 'active',
                createdAt: '2025-01-01T00:00:00Z'
            },
            {
                email: 'leader1@example.com',
                name: 'Иван Петров',
                reddyId: '111111',
                picture: '',
                phone: '+7 999 111-11-11',
                telegram: 'ivan_p',
                position: 'Руководитель',
                role: 'leader',
                teamId: 'team-001',
                status: 'active',
                createdAt: '2025-11-01T10:00:00Z'
            },
            {
                email: 'leader2@example.com',
                name: 'Мария Сидорова',
                reddyId: '222222',
                picture: '',
                phone: '+7 999 222-22-22',
                telegram: 'maria_s',
                position: 'Руководитель отдела',
                role: 'leader',
                teamId: 'team-002',
                status: 'active',
                createdAt: '2025-12-15T14:30:00Z'
            },
            {
                email: 'assistant1@example.com',
                name: 'Анна Волкова',
                reddyId: '111222',
                picture: '',
                phone: '+7 999 111-22-33',
                telegram: 'anna_v',
                position: 'Помощник',
                role: 'assistant',
                teamId: 'team-001',
                status: 'active',
                createdAt: '2025-11-10T12:00:00Z'
            },
            {
                email: 'sales1@example.com',
                name: 'Алексей Новиков',
                reddyId: '111333',
                picture: '',
                phone: '+7 999 111-33-44',
                telegram: 'alex_n',
                position: 'Менеджер',
                role: 'sales',
                teamId: 'team-001',
                status: 'active',
                createdAt: '2025-11-15T09:00:00Z'
            },
            {
                email: 'sales2@example.com',
                name: 'Елена Белова',
                reddyId: '111444',
                picture: '',
                phone: '',
                telegram: 'elena_b',
                position: 'Менеджер по продажам',
                role: 'sales',
                teamId: 'team-001',
                status: 'active',
                createdAt: '2025-11-20T11:00:00Z'
            },
            {
                email: 'blocked@example.com',
                name: 'Заблокированный Пользователь',
                reddyId: '999999',
                picture: '',
                phone: '',
                telegram: '',
                position: '',
                role: 'sales',
                teamId: 'team-001',
                status: 'blocked',
                createdAt: '2025-10-01T08:00:00Z'
            },
            {
                email: 'waiting@example.com',
                name: 'Ожидающий Приглашения',
                reddyId: '888888',
                picture: '',
                phone: '+7 999 888-88-88',
                telegram: 'waiting_user',
                position: '',
                role: 'sales',
                teamId: '',
                status: 'approved_no_team',
                createdAt: '2025-12-28T16:00:00Z'
            }
        ],
        requests: [
            {
                id: 'req-001',
                email: 'newuser1@example.com',
                name: 'Дмитрий Кузнецов',
                reddyId: '777001',
                picture: '',
                status: 'pending',
                requestedAt: '2026-01-02T14:30:00Z'
            },
            {
                id: 'req-002',
                email: 'newuser2@example.com',
                name: 'Ольга Морозова',
                reddyId: '777002',
                picture: '',
                status: 'pending',
                requestedAt: '2026-01-03T09:15:00Z'
            },
            {
                id: 'req-003',
                email: 'newuser3@example.com',
                name: 'Павел Соколов',
                reddyId: '777003',
                picture: '',
                status: 'pending',
                requestedAt: '2026-01-03T11:45:00Z'
            }
        ],
        permissions: {
            assistant: {
                partners: { view: true, edit: true, delete: false },
                'team-info': { view: true, edit: false, delete: false },
                traffic: { view: true, edit: true, delete: false },
                reports: { view: true, edit: false, delete: false },
                settings: { view: true, edit: true, delete: false },
                documentation: { view: true, edit: false, delete: false },
                'team-management': { view: false, edit: false, delete: false }
            },
            sales: {
                partners: { view: true, edit: true, delete: false },
                'team-info': { view: true, edit: false, delete: false },
                traffic: { view: true, edit: false, delete: false },
                reports: { view: true, edit: false, delete: false },
                settings: { view: true, edit: false, delete: false },
                documentation: { view: true, edit: false, delete: false },
                'team-management': { view: false, edit: false, delete: false }
            },
            partners_mgr: {
                partners: { view: true, edit: true, delete: true },
                'team-info': { view: true, edit: false, delete: false },
                traffic: { view: true, edit: false, delete: false },
                reports: { view: true, edit: true, delete: false },
                settings: { view: true, edit: false, delete: false },
                documentation: { view: true, edit: false, delete: false },
                'team-management': { view: false, edit: false, delete: false }
            },
            payments: {
                partners: { view: true, edit: false, delete: false },
                'team-info': { view: true, edit: false, delete: false },
                traffic: { view: true, edit: true, delete: false },
                reports: { view: true, edit: true, delete: false },
                settings: { view: true, edit: false, delete: false },
                documentation: { view: true, edit: false, delete: false },
                'team-management': { view: false, edit: false, delete: false }
            },
            antifraud: {
                partners: { view: true, edit: true, delete: false },
                'team-info': { view: true, edit: false, delete: false },
                traffic: { view: true, edit: false, delete: false },
                reports: { view: true, edit: false, delete: false },
                settings: { view: true, edit: false, delete: false },
                documentation: { view: true, edit: false, delete: false },
                'team-management': { view: false, edit: false, delete: false }
            },
            tech: {
                partners: { view: true, edit: false, delete: false },
                'team-info': { view: true, edit: false, delete: false },
                traffic: { view: true, edit: false, delete: false },
                reports: { view: true, edit: false, delete: false },
                settings: { view: true, edit: true, delete: false },
                documentation: { view: true, edit: true, delete: false },
                'team-management': { view: false, edit: false, delete: false }
            }
        },
        auditLog: [
            {
                id: 'log-001',
                timestamp: '2026-01-03T12:00:00Z',
                actorEmail: 'admin@example.com',
                actorRole: 'admin',
                action: 'user_approved',
                targetEmail: 'waiting@example.com',
                targetTeamId: '',
                oldValue: '',
                newValue: 'approved_no_team',
                details: 'Пользователь одобрен'
            },
            {
                id: 'log-002',
                timestamp: '2026-01-02T15:30:00Z',
                actorEmail: 'admin@example.com',
                actorRole: 'admin',
                action: 'role_changed',
                targetEmail: 'assistant1@example.com',
                targetTeamId: 'team-001',
                oldValue: 'sales',
                newValue: 'assistant',
                details: 'Повышение до помощника'
            },
            {
                id: 'log-003',
                timestamp: '2026-01-02T10:00:00Z',
                actorEmail: 'admin@example.com',
                actorRole: 'admin',
                action: 'user_blocked',
                targetEmail: 'blocked@example.com',
                targetTeamId: 'team-001',
                oldValue: 'active',
                newValue: 'blocked',
                details: 'Заблокирован за нарушения'
            },
            {
                id: 'log-004',
                timestamp: '2025-12-28T14:00:00Z',
                actorEmail: 'admin@example.com',
                actorRole: 'admin',
                action: 'team_created',
                targetEmail: 'leader2@example.com',
                targetTeamId: 'team-002',
                oldValue: '',
                newValue: 'Команда Beta',
                details: 'Создана новая команда'
            },
            {
                id: 'log-005',
                timestamp: '2025-12-20T09:00:00Z',
                actorEmail: 'admin@example.com',
                actorRole: 'admin',
                action: 'permissions_changed',
                targetEmail: '',
                targetTeamId: '',
                oldValue: '',
                newValue: 'sales',
                details: 'Изменены права роли sales'
            }
        ]
    },

    // Названия ролей
    roleNames: {
        'admin': 'Администратор',
        'leader': 'Руководитель',
        'assistant': 'Помощник руководителя',
        'sales': 'Менеджер по продажам',
        'partners_mgr': 'Менеджер по партнёрам',
        'payments': 'Менеджер платежей',
        'antifraud': 'Антифрод',
        'tech': 'Техспециалист'
    },

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
        this.loadUserData();

        // Инициализация RoleGuard
        if (typeof RoleGuard !== 'undefined') {
            await RoleGuard.init();
        }

        this.loadAllData();
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
        }
    },

    // ============ API ============

    async apiCall(action, params = {}) {
        if (this.USE_MOCK_API) {
            return this.mockApiCall(action, params);
        }

        // Реальный API (будет реализован позже)
        const url = new URL(CloudStorage.SCRIPT_URL);
        url.searchParams.set('action', action);

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }

        const response = await fetch(url.toString(), { method: 'GET' });
        return response.json();
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
                const userIdx = this.mockData.users.findIndex(u => u.email === params.email);
                if (userIdx === -1) return { error: 'Пользователь не найден' };
                const oldRole = this.mockData.users[userIdx].role;
                const oldStatus = this.mockData.users[userIdx].status;
                Object.assign(this.mockData.users[userIdx], params);

                if (params.role && params.role !== oldRole) {
                    this.addAuditLog('role_changed', params.email, params.teamId || '', oldRole, params.role);
                }
                if (params.status && params.status !== oldStatus) {
                    const action = params.status === 'blocked' ? 'user_blocked' : 'user_unblocked';
                    this.addAuditLog(action, params.email, params.teamId || '', oldStatus, params.status);
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
        this.updateCounts();
        this.renderTeams();
        this.renderUsers();
        this.renderRequests();
        this.renderPermissions();
        this.renderAuditLog();
        this.populateTeamFilter();
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
            emptyEl.style.display = '';
            return;
        }

        emptyEl.style.display = 'none';

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
        card.onclick = () => this.openEditTeamModal(team);

        const initials = this.getInitials(team.leaderName);

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
                <div class="team-stats">
                    <div class="team-stat">
                        <span class="team-stat-value">${team.membersCount}</span>
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

        if (!name || !leaderEmail) return false;

        try {
            const result = await this.apiCall('createTeam', { name, leaderEmail, description });

            if (result.error) {
                throw new Error(result.error);
            }

            this.closeModal('createTeamModal');
            await this.loadAllData();

        } catch (error) {
            alert('Ошибка: ' + error.message);
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
            const btnActive = btn.dataset.status === 'active';
            btn.classList.toggle('active', btnActive === isActive);
        });
    },

    async saveTeam(event) {
        event.preventDefault();

        if (!this.editingTeam) return false;

        const name = document.getElementById('editTeamName').value.trim();
        const description = document.getElementById('editTeamDescription').value.trim();

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

            this.closeModal('editTeamModal');
            await this.loadAllData();

        } catch (error) {
            alert('Ошибка: ' + error.message);
        }

        return false;
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

        // Leader видит только свою команду
        const isLeader = typeof RoleGuard !== 'undefined' && RoleGuard.hasRole('leader');
        const myTeamId = RoleGuard?.user?.teamId;
        if (isLeader && myTeamId) {
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
            emptyEl.style.display = '';
            pagination.innerHTML = '';
            return;
        }

        emptyEl.style.display = 'none';

        // Пагинация
        const totalPages = Math.ceil(filtered.length / this.usersPerPage);
        if (this.usersPage > totalPages) this.usersPage = totalPages;
        if (this.usersPage < 1) this.usersPage = 1;

        const start = (this.usersPage - 1) * this.usersPerPage;
        const end = start + this.usersPerPage;
        const pageUsers = filtered.slice(start, end);

        // Рендер строк
        pageUsers.forEach(user => {
            const row = this.createUserRow(user);
            tbody.appendChild(row);
        });

        // Рендер пагинации
        this.renderPagination(pagination, this.usersPage, totalPages, (page) => {
            this.usersPage = page;
            this.renderUsers();
        });
    },

    createUserRow(user) {
        const row = document.createElement('tr');
        const initials = this.getInitials(user.name);
        const roleName = this.roleNames[user.role] || user.role;
        const team = this.teams.find(t => t.id === user.teamId);
        const teamName = team ? team.name : '';

        let statusClass = user.status;
        let statusText = user.status === 'active' ? 'Активен' :
                        user.status === 'blocked' ? 'Заблокирован' : 'Без команды';

        row.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${user.picture ? `<img src="${user.picture}" alt="">` : initials}</div>
                    <div class="user-details">
                        <span class="user-name">${this.escapeHtml(user.name)}</span>
                        <span class="user-email">${this.escapeHtml(user.email)}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="user-team${teamName ? '' : ' no-team'}">${teamName || 'Нет'}</span>
            </td>
            <td>
                <span class="role-badge role-${user.role}">${roleName}</span>
            </td>
            <td>
                <span class="status-badge ${statusClass}">
                    <span class="status-dot"></span>
                    ${statusText}
                </span>
            </td>
            <td>
                <button class="action-btn" onclick="adminApp.openEditUserModal('${user.email}')">Изменить</button>
            </td>
        `;

        return row;
    },

    filterUsers() {
        this.usersPage = 1;
        this.renderUsers();
    },

    openEditUserModal(email) {
        const user = this.users.find(u => u.email === email);
        if (!user) return;

        // Проверка: можем ли редактировать этого пользователя
        if (typeof RoleGuard !== 'undefined' && !RoleGuard.canManageRole(user.role)) {
            alert('У вас нет прав для редактирования этого пользователя');
            return;
        }

        this.editingUser = user;
        this.editingStatus = user.status;

        // Заполнить модалку
        document.getElementById('modalUserAvatar').innerHTML = user.picture
            ? `<img src="${user.picture}" alt="">`
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
            option.textContent = this.roleNames[role] || role;
            if (role === user.role) option.selected = true;
            roleSelect.appendChild(option);
        });

        // Если текущая роль не в списке - добавить disabled
        if (!assignableRoles.includes(user.role)) {
            const option = document.createElement('option');
            option.value = user.role;
            option.textContent = this.roleNames[user.role] || user.role;
            option.selected = true;
            option.disabled = true;
            roleSelect.insertBefore(option, roleSelect.firstChild);
        }

        this.setModalStatus(user.status === 'blocked' ? 'blocked' : 'active');

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
        const status = this.editingStatus === 'blocked' ? 'blocked' :
                      (teamId ? 'active' : 'approved_no_team');

        try {
            const result = await this.apiCall('updateUser', {
                email: this.editingUser.email,
                teamId,
                role,
                status
            });

            if (result.error) {
                throw new Error(result.error);
            }

            this.closeModal('editUserModal');
            await this.loadAllData();

        } catch (error) {
            alert('Ошибка: ' + error.message);
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
            emptyEl.style.display = '';
            return;
        }

        emptyEl.style.display = 'none';

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
                <button class="btn btn-success btn-sm" onclick="adminApp.approveRequest('${request.id}')">Одобрить</button>
                <button class="btn btn-danger btn-sm" onclick="adminApp.rejectRequest('${request.id}')">Отклонить</button>
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

            await this.loadAllData();

        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    },

    async rejectRequest(requestId) {
        if (!confirm('Отклонить запрос на регистрацию?')) return;

        try {
            const result = await this.apiCall('rejectRequest', { requestId });

            if (result.error) {
                throw new Error(result.error);
            }

            await this.loadAllData();

        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    },

    // ============ Permissions ============

    renderPermissions() {
        const tbody = document.getElementById('permissionsTableBody');
        tbody.innerHTML = '';

        // Получаем права, которые можно назначать
        const assignable = typeof RoleGuard !== 'undefined'
            ? RoleGuard.getAssignablePermissions()
            : null;

        // Роли для настройки (без admin и leader)
        const editableRoles = ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'];

        editableRoles.forEach(role => {
            const row = document.createElement('tr');
            const roleName = this.roleNames[role];

            let cells = `
                <td>
                    <div class="role-cell">
                        <span class="role-badge role-${role}">${roleName}</span>
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
                                 ${canAssignView ? 'onclick="adminApp.togglePermission(this)"' : ''}
                                 title="Просмотр${!canAssignView ? ' (недоступно)' : ''}">V</div>
                            <div class="permission-cb edit${perm.edit ? ' checked' : ''}${!canAssignEdit ? ' disabled' : ''}"
                                 data-role="${role}" data-module="${module}" data-type="edit"
                                 ${canAssignEdit ? 'onclick="adminApp.togglePermission(this)"' : ''}
                                 title="Редактирование${!canAssignEdit ? ' (недоступно)' : ''}">E</div>
                            <div class="permission-cb delete${perm.delete ? ' checked' : ''}${!canAssignDelete ? ' disabled' : ''}"
                                 data-role="${role}" data-module="${module}" data-type="delete"
                                 ${canAssignDelete ? 'onclick="adminApp.togglePermission(this)"' : ''}
                                 title="Удаление${!canAssignDelete ? ' (недоступно)' : ''}">D</div>
                        </div>
                    </td>
                `;
            });

            row.innerHTML = cells;
            tbody.appendChild(row);
        });
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
        const editableRoles = ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'];

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
            alert('Ошибка: ' + error.message);
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
            emptyEl.style.display = '';
            pagination.innerHTML = '';
            return;
        }

        emptyEl.style.display = 'none';

        // Пагинация
        const totalPages = Math.ceil(filtered.length / this.auditPerPage);
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
        switch (log.action) {
            case 'user_approved':
                message = `Пользователь <strong>${log.targetEmail}</strong> одобрен`;
                break;
            case 'user_rejected':
                message = `Пользователь <strong>${log.targetEmail}</strong> отклонён`;
                break;
            case 'user_blocked':
                message = `Пользователь <strong>${log.targetEmail}</strong> заблокирован`;
                break;
            case 'user_unblocked':
                message = `Пользователь <strong>${log.targetEmail}</strong> разблокирован`;
                break;
            case 'role_changed':
                message = `<strong>${log.targetEmail}</strong>: ${this.roleNames[log.oldValue] || log.oldValue} → ${this.roleNames[log.newValue] || log.newValue}`;
                break;
            case 'team_created':
                message = `Создана команда <strong>${log.newValue}</strong>`;
                break;
            case 'permissions_changed':
                message = `Изменены права ролей`;
                break;
            default:
                message = `${actionName}: ${log.targetEmail || log.details}`;
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

        // Prev button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '←';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => onPageChange(currentPage - 1);
        container.appendChild(prevBtn);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = 'page-btn' + (i === currentPage ? ' active' : '');
                pageBtn.textContent = i;
                pageBtn.onclick = () => onPageChange(i);
                container.appendChild(pageBtn);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '0 8px';
                dots.style.color = 'var(--gray)';
                container.appendChild(dots);
            }
        }

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '→';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => onPageChange(currentPage + 1);
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

    // ============ Sidebar ============

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
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
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
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
    console.log('Mock API enabled. Use adminMock.addTeam(name, email) or adminMock.addRequest(name, email, reddyId)');
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    adminApp.init();
});

// Закрытие модалок по клику на оверлей
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            adminApp.closeModal(this.id);
        }
    });
});

// CSS для спиннера
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
