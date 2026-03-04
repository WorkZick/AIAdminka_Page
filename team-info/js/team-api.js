/**
 * Team API - AIAdminka
 * API для работы с командой
 */

const TeamAPI = {

    // ============ API CALLS ============

    /**
     * Основной метод API вызова
     */
    async call(action, params = {}) {
        // API через Google Apps Script
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

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeamAPI;
}
