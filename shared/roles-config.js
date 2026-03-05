/**
 * RolesConfig - Единый источник правды для конфигурации ролей
 * Все названия, описания и цвета ролей определяются ТОЛЬКО здесь.
 * Поддерживает динамические роли (добавление/удаление через админ-панель).
 * @version 2.0
 */
const RolesConfig = {
    // Дефолтные значения (используются если нет кастомных с бэкенда)
    _defaults: {
        names: {
            admin: 'Администратор',
            leader: 'Руководитель',
            assistant: 'Помощник руководителя',
            sales: 'Менеджер по продажам',
            partners_mgr: 'Менеджер по партнёрам',
            payments: 'Менеджер платежей',
            antifraud: 'Антифрод',
            tech: 'Техспециалист',
            guest: 'Гость'
        },
        descriptions: {
            admin: 'Полный доступ ко всем функциям системы и управление всеми командами.',
            leader: 'Управление своей командой, одобрение запросов и настройка прав сотрудников.',
            assistant: 'Помощь руководителю в управлении командой.',
            sales: 'Работа с партнёрами и продажами.',
            partners_mgr: 'Управление партнёрскими отношениями.',
            payments: 'Работа с платёжными системами и транзакциями.',
            antifraud: 'Мониторинг и предотвращение мошенничества.',
            tech: 'Техническая поддержка и настройка системы.',
            guest: 'Ожидание приглашения в команду.'
        },
        colors: {
            admin: '#ff6b6b',
            leader: '#4dabf7',
            assistant: '#69db7c',
            sales: '#ffd43b',
            partners_mgr: '#da77f2',
            payments: '#38d9a9',
            antifraud: '#ff922b',
            tech: '#748ffc',
            guest: '#868e96'
        }
    },

    // Кастомные переопределения с бэкенда
    _overrides: null,

    // Кастомные роли (добавленные через админ-панель)
    _customRoles: [],

    // Системные роли (нельзя удалить)
    SYSTEM_ROLES: ['admin', 'leader', 'guest'],

    // Дефолтный список ролей (для fallback)
    _defaultRoles: ['admin', 'leader', 'assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech', 'guest'],

    // Все роли системы в порядке отображения (пересобирается при applyOverrides)
    ALL_ROLES: ['admin', 'leader', 'assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech', 'guest'],

    // Роли, которые leader может назначать сотрудникам (пересобирается при applyOverrides)
    ASSIGNABLE_ROLES: ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'],

    /**
     * Получить отображаемое название роли
     */
    getName(role) {
        if (!role) return 'Неизвестно';
        return this._overrides?.names?.[role] || this._defaults.names[role] || role;
    },

    /**
     * Получить описание роли
     */
    getDescription(role) {
        if (!role) return '';
        return this._overrides?.descriptions?.[role] || this._defaults.descriptions[role] || '';
    },

    /**
     * Получить цвет роли
     */
    getColor(role) {
        if (!role) return '#868e96';
        return this._overrides?.colors?.[role] || this._defaults.colors[role] || '#868e96';
    },

    /**
     * Получить маппинг {key: displayName} для набора ролей
     */
    getNameMap(roles) {
        const map = {};
        (roles || this.ALL_ROLES).forEach(r => { map[r] = this.getName(r); });
        return map;
    },

    /**
     * Применить конфигурацию с бэкенда
     * Поддерживает два формата:
     * - Старый: { names: {...} }
     * - Новый: { customRoles: [...], overrides: { names, descriptions, colors } }
     */
    applyOverrides(config) {
        if (!config || typeof config !== 'object') return;

        // Определить формат
        if (config.overrides || config.customRoles) {
            // Новый формат
            this._overrides = config.overrides || null;

            if (Array.isArray(config.customRoles)) {
                this._customRoles = config.customRoles;

                // Добавить кастомные роли в _defaults
                config.customRoles.forEach(cr => {
                    this._defaults.names[cr.key] = cr.name;
                    this._defaults.descriptions[cr.key] = cr.description || '';
                    this._defaults.colors[cr.key] = cr.color || '#868e96';
                });

                this._rebuildRoleLists();
            }
        } else {
            // Старый формат (обратная совместимость): { names: {...} }
            this._overrides = config;
        }
    },

    /**
     * Пересобрать ALL_ROLES и ASSIGNABLE_ROLES с учётом кастомных ролей
     */
    _rebuildRoleLists() {
        const defaultWithoutGuest = this._defaultRoles.filter(r => r !== 'guest');
        const customKeys = this._customRoles.map(r => r.key);
        this.ALL_ROLES = [...defaultWithoutGuest, ...customKeys, 'guest'];
        this.ASSIGNABLE_ROLES = this.ALL_ROLES.filter(r => !this.SYSTEM_ROLES.includes(r));
    },

    /**
     * Проверки типа роли
     */
    isSystemRole(role) {
        return this.SYSTEM_ROLES.includes(role);
    },

    isDefaultRole(role) {
        return this._defaultRoles.includes(role);
    },

    isCustomRole(role) {
        return this._customRoles.some(r => r.key === role);
    },

    /**
     * Получить стиль для badge (для JS-применения, обход CSP)
     * @returns {{ color: string, background: string }}
     */
    getBadgeStyle(role) {
        const color = this.getColor(role);
        return { color: color, background: color + '20' };
    },

    /**
     * Получить полную конфигурацию для сохранения на бэкенд
     */
    getFullConfig() {
        // Собрать overrides: только изменённые относительно _defaults
        const overrides = this._overrides ? { ...this._overrides } : {};
        return {
            customRoles: this._customRoles.map(r => ({ ...r })),
            overrides: overrides
        };
    },

    /**
     * Получить полную информацию о всех ролях (для UI)
     */
    getAll() {
        const result = {};
        this.ALL_ROLES.forEach(role => {
            result[role] = {
                name: this.getName(role),
                description: this.getDescription(role),
                color: this.getColor(role)
            };
        });
        return result;
    },

    /**
     * Получить дефолтное название роли (без учёта overrides)
     */
    getDefaultName(role) {
        return this._defaults.names[role] || role;
    },

    // Старые имена ролей из бэкенда (для обратной совместимости)
    _legacyNames: {
        'Ассистент': 'assistant',
        'Руководитель команды': 'leader',
        'Менеджер партнёров': 'partners_mgr',
        'Отдел платежей': 'payments',
        'Отдел безопасности': 'antifraud',
        'Технический специалист': 'tech'
    },

    /**
     * Обратный маппинг: по отображаемому имени или ключу получить ключ роли.
     * Нужен потому что бэкенд может хранить displayName в position.
     * @param {string} value - ключ роли ИЛИ отображаемое название
     * @returns {string} ключ роли или исходное значение если не найден
     */
    resolveRoleKey(value) {
        if (!value) return '';
        if (this._defaults.names[value] || this.ALL_ROLES.includes(value)) return value;
        if (this._legacyNames[value]) return this._legacyNames[value];
        for (const [key, name] of Object.entries(this._defaults.names)) {
            if (name === value) return key;
        }
        if (this._overrides?.names) {
            for (const [key, name] of Object.entries(this._overrides.names)) {
                if (name === value) return key;
            }
        }
        return value;
    }
};

if (typeof window !== 'undefined') {
    window.RolesConfig = RolesConfig;
}
