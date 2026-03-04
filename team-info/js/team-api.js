/**
 * Team API - AIAdminka
 * API для работы с командой
 * Поддерживает Mock API для тестирования
 */

const TeamAPI = {
    // Mock API режим
    USE_MOCK_API: false,

    // ============ MOCK DATA ============
    // Mock данные вынесены в team-mock-data.js для удобства поддержки
    // Для использования: подключите <script src="js/team-mock-data.js"></script> в index.html

    mockData: window.TEAM_MOCK_DATA || {
        team: {},
        members: [],
        waitingUsers: []
    },

    // Названия ролей — из RolesConfig (shared/roles-config.js)

    // ============ INITIALIZATION ============

    /**
     * Инициализация API - обновить mock данные текущим пользователем
     */
    init() {
        const authData = localStorage.getItem('cloud-auth');
        if (authData && this.USE_MOCK_API) {
            let auth;
            try {
                auth = JSON.parse(authData);
            } catch (e) {
                console.error('Invalid cloud-auth data:', e);
                return;
            }
            this.mockData.team.leaderEmail = auth.email;
            this.mockData.members[0].email = auth.email;
            this.mockData.members[0].name = auth.name || this.mockData.members[0].name;
            this.mockData.members[0].picture = auth.picture || '';
        }
    },

    // ============ API CALLS ============

    /**
     * Основной метод API вызова
     */
    async call(action, params = {}) {
        if (this.USE_MOCK_API) {
            return this.mockApiCall(action, params);
        }

        // Реальный API через Google Apps Script
        const url = new URL(CloudStorage.SCRIPT_URL);
        url.searchParams.set('action', action);

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }

        const response = await fetch(url.toString(), { method: 'GET' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        try {
            return await response.json();
        } catch (e) {
            throw new Error('Неверный формат ответа сервера');
        }
    },

    /**
     * Mock API для тестирования
     */
    async mockApiCall(action, params = {}) {
        await new Promise(resolve => setTimeout(resolve, 200));

        switch (action) {
            case 'getTeamData':
                return {
                    success: true,
                    team: { ...this.mockData.team },
                    members: [...this.mockData.members],
                    waitingUsers: [...this.mockData.waitingUsers]
                };

            case 'getTeamMembers':
                return {
                    success: true,
                    members: [...this.mockData.members]
                };

            case 'updateTeamSettings':
                Object.assign(this.mockData.team, params);
                return { success: true };

            case 'inviteMember':
                const user = this.mockData.waitingUsers.find(u => u.reddyId === params.reddyId);
                if (!user) {
                    return { error: 'Пользователь с таким Reddy ID не найден или не ожидает приглашения' };
                }
                const newMember = {
                    ...user,
                    phone: '',
                    telegram: '',
                    position: '',
                    role: 'sales',
                    status: 'active'
                };
                this.mockData.members.push(newMember);
                this.mockData.waitingUsers = this.mockData.waitingUsers.filter(u => u.reddyId !== params.reddyId);
                return { success: true, userName: user.name, member: newMember };

            case 'updateMember':
                const memberIndex = this.mockData.members.findIndex(m => m.email === params.email);
                if (memberIndex === -1) {
                    return { error: 'Сотрудник не найден' };
                }
                Object.assign(this.mockData.members[memberIndex], params);
                return { success: true };

            case 'removeMember':
                const removeIndex = this.mockData.members.findIndex(m => m.email === params.email);
                if (removeIndex === -1) {
                    return { error: 'Сотрудник не найден' };
                }
                this.mockData.members.splice(removeIndex, 1);
                return { success: true };

            case 'toggleSetting':
                this.mockData.team[params.setting] = params.value;
                return { success: true };

            case 'getWaitingUsers':
                return {
                    success: true,
                    waitingUsers: [...this.mockData.waitingUsers]
                };

            default:
                return { error: 'Unknown action: ' + action };
        }
    },

    // ============ CONVENIENCE METHODS ============

    /**
     * Получить данные команды
     */
    async getTeamData() {
        return this.call('getTeamData');
    },

    /**
     * Получить список членов команды
     */
    async getTeamMembers() {
        return this.call('getTeamMembers');
    },

    /**
     * Получить ожидающих приглашения
     */
    async getWaitingUsers() {
        return this.call('getWaitingUsers');
    },

    /**
     * Пригласить пользователя по Reddy ID
     */
    async inviteMember(reddyId) {
        return this.call('inviteMember', { reddyId });
    },

    /**
     * Обновить данные члена команды (роль, статус)
     */
    async updateMember(email, data) {
        return this.call('updateMember', { email, ...data });
    },

    /**
     * Исключить члена из команды
     */
    async removeMember(email) {
        return this.call('removeMember', { email });
    },

    /**
     * Обновить настройки команды
     */
    async updateTeamSettings(settings) {
        return this.call('updateTeamSettings', settings);
    },

    /**
     * Переключить настройку команды
     */
    async toggleSetting(setting, value) {
        return this.call('toggleSetting', { setting, value });
    },

    // ============ HELPERS ============

    /**
     * Получить название роли
     */
    getRoleName(role) {
        return RolesConfig.getName(role);
    }
};

// Инициализация при загрузке
TeamAPI.init();

// Для отладки
if (TeamAPI.USE_MOCK_API) {
    window.teamApiMock = {
        addMember: (name, role = 'sales') => {
            const id = Math.random().toString(36).substr(2, 6);
            TeamAPI.mockData.members.push({
                email: `${id}@example.com`,
                name: name,
                reddyId: id,
                picture: '',
                phone: '',
                telegram: '',
                position: '',
                role: role,
                status: 'active'
            });
        },
        addWaiting: (name) => {
            const id = Math.random().toString(36).substr(2, 6);
            TeamAPI.mockData.waitingUsers.push({
                email: `${id}@example.com`,
                name: name,
                reddyId: id,
                picture: ''
            });
        }
    };
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeamAPI;
}
