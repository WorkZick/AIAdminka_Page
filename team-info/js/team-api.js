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
        return CloudStorage.callApi(action, params);
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
