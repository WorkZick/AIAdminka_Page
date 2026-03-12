/**
 * Team State Module
 * Управление состоянием приложения
 */

const TeamState = {
    // Данные сотрудников
    data: [],

    // Текущий выбранный сотрудник
    currentEmployeeId: null,

    // Сортировка
    sortField: null,
    sortDirection: 'asc',

    // Название команды
    teamName: 'Моя команда',

    // Состояние формы
    formChanged: false,
    originalFormData: null,
    currentFormStatus: 'Работает',

    // Режим удаления
    isDeleteMode: false,

    // История навигации
    navigationStack: [],

    // Временные данные
    tempImageData: null,
    currentAvatar: null,

    // Настройки обрезки аватара
    cropSettings: {
        scale: 1,
        posX: 0,
        posY: 0
    },
    isDragging: false,
    dragStart: { x: 0, y: 0 },

    // Настройки приглашений
    currentInviteType: 'guests', // По умолчанию показываем список гостей
    pendingInvites: [],

    // Гости (пользователи waiting_invite для приглашения)
    availableGuests: [],
    selectedGuestEmail: null,
    selectedRole: null, // Устанавливается динамически из RolesConfig

    // Команды (для Admin при приглашении)
    availableTeams: [],
    selectedTeamId: null,

    // Доступные роли для назначения — из RolesConfig (shared/roles-config.js)
    get assignableRoles() {
        if (typeof RolesConfig !== 'undefined') {
            return RolesConfig.getNameMap(RolesConfig.ASSIGNABLE_ROLES);
        }
        return {};
    },

    // Шаблоны
    currentTemplateId: undefined,
    isTemplateMode: false,
    editingTemplateId: null,
    templateFields: [],

    // Event handlers для очистки (предотвращение memory leaks)
    eventHandlers: {},

    /**
     * Загрузка названия команды из RoleGuard (API)
     */
    loadTeamName() {
        // Название команды только из API
        if (typeof RoleGuard !== 'undefined' && RoleGuard.initialized) {
            const apiTeamName = RoleGuard.getTeamName();
            if (apiTeamName) {
                this.teamName = apiTeamName;
            }
        }

        const teamNameElement = document.getElementById('teamName');
        if (teamNameElement) {
            teamNameElement.textContent = this.teamName;
        }
    },

    /**
     * Сортировка данных по полю
     * @param {string} field - Поле для сортировки ('name' или 'status')
     */
    sortBy(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
    },

    // Pagination & filtering
    currentPage: 1,
    perPage: 50,
    searchQuery: '',
    _filterTimer: null,
    _filteredCache: null,

    _invalidateFiltered() {
        this._filteredCache = null;
    },

    getFilteredData() {
        if (this._filteredCache) return this._filteredCache;

        let data = [...this.data];

        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            data = data.filter(emp => {
                const searchable = [
                    emp.fullName, emp.position, emp.status,
                    emp.crmLogin, emp.reddyId,
                    emp.predefinedFields?.['Reddy'],
                    emp.corpTelegram, emp.personalTelegram,
                    emp.corpEmail, emp.personalEmail
                ].filter(Boolean).join(' ').toLowerCase();
                return searchable.includes(q);
            });
        }

        if (this.sortField) {
            data.sort((a, b) => {
                let aVal, bVal;
                if (this.sortField === 'name') {
                    aVal = a.fullName || '';
                    bVal = b.fullName || '';
                } else if (this.sortField === 'status') {
                    aVal = a.status || 'Работает';
                    bVal = b.status || 'Работает';
                }
                return this.sortDirection === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            });
        }

        this._filteredCache = data;
        return data;
    },

    getTotalPages() {
        return Math.max(1, Math.ceil(this.getFilteredData().length / this.perPage));
    },

    getPagedData() {
        const filtered = this.getFilteredData();
        const start = (this.currentPage - 1) * this.perPage;
        return filtered.slice(start, start + this.perPage);
    },

    filterTable() {
        clearTimeout(TeamState._filterTimer);
        TeamState._filterTimer = setTimeout(() => {
            TeamState.searchQuery = document.getElementById('searchInput').value;
            TeamState.currentPage = 1;
            TeamRenderer.render();
        }, 150);
    }
};
