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

        this.data.sort((a, b) => {
            let aVal, bVal;

            if (field === 'name') {
                aVal = a.fullName || '';
                bVal = b.fullName || '';
            } else if (field === 'status') {
                aVal = a.status || 'Работает';
                bVal = b.status || 'Работает';
            }

            if (this.sortDirection === 'asc') {
                return aVal.localeCompare(bVal);
            } else {
                return bVal.localeCompare(aVal);
            }
        });
    },

    /**
     * Фильтрация таблицы по поисковому запросу
     */
    filterTable() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const rows = document.querySelectorAll('.employees-table tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(search)) {
                row.classList.remove('filtered-hidden');
            } else {
                row.classList.add('filtered-hidden');
            }
        });
    }
};
