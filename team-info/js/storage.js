/**
 * Гибридное хранилище для Team Info
 * Объединяет данные из API (члены команды) с локальными расширениями
 */
const storage = {
    // Ключи localStorage
    LOCAL_EXTENSIONS_KEY: 'team_info_extensions',  // Локальные дополнения к API данным
    LOCAL_ONLY_KEY: 'team_info_local',             // Полностью локальные сотрудники
    TEAM_SETTINGS_KEY: 'team_settings',            // Настройки команды

    // Кеш данных
    _apiMembers: [],
    _localExtensions: {},
    _localOnly: [],
    _teamData: null,
    _waitingUsers: [],

    // ============ ОСНОВНЫЕ МЕТОДЫ ============

    /**
     * Загрузить все данные (API + локальные)
     * @returns {Array} Объединённый массив сотрудников
     */
    async loadData() {
        // Загружаем локальные данные
        this._localExtensions = this._loadLocalExtensions();
        this._localOnly = this._loadLocalOnly();

        // Загружаем данные из API
        if (typeof TeamAPI !== 'undefined') {
            try {
                const result = await TeamAPI.getTeamData();
                if (result.success) {
                    this._apiMembers = result.members || [];
                    this._teamData = result.team || null;
                    this._waitingUsers = result.waitingUsers || [];
                }
            } catch (e) {
                console.warn('[Storage] API unavailable, using local only:', e);
            }
        }

        // Объединяем данные
        return this._mergeData();
    },

    /**
     * Сохранить данные сотрудника
     * @param {Object} employee - Данные сотрудника
     */
    async saveData(employees) {
        // Разделяем на API-расширения и локальные
        const extensions = {};
        const localOnly = [];

        employees.forEach(emp => {
            if (emp._source === 'local' || !emp.email || !this._isApiMember(emp.email)) {
                // Полностью локальный сотрудник
                localOnly.push(emp);
            } else {
                // Расширение к API данным
                extensions[emp.email] = this._extractLocalFields(emp);
            }
        });

        this._localExtensions = extensions;
        this._localOnly = localOnly;

        StorageManager.set(this.LOCAL_EXTENSIONS_KEY, extensions);
        StorageManager.set(this.LOCAL_ONLY_KEY, localOnly);

        return true;
    },

    /**
     * Сохранить одного сотрудника
     * @param {Object} employee - Данные сотрудника
     */
    async saveEmployee(employee) {
        const data = await this.loadData();
        const index = data.findIndex(e =>
            (e.id && e.id === employee.id) ||
            (e.email && e.email === employee.email)
        );

        if (index >= 0) {
            data[index] = { ...data[index], ...employee };
        } else {
            data.push(employee);
        }

        await this.saveData(data);
        return employee;
    },

    /**
     * Удалить сотрудника
     * @param {string|number} idOrEmail - ID или email сотрудника
     */
    async deleteEmployee(idOrEmail) {
        // Если это API сотрудник - удаляем только локальные расширения
        if (this._isApiMember(idOrEmail)) {
            delete this._localExtensions[idOrEmail];
            StorageManager.set(this.LOCAL_EXTENSIONS_KEY, this._localExtensions);
            return true;
        }

        // Если локальный - удаляем полностью
        this._localOnly = this._localOnly.filter(e =>
            e.id !== idOrEmail && e.email !== idOrEmail
        );
        StorageManager.set(this.LOCAL_ONLY_KEY, this._localOnly);
        return true;
    },

    // ============ ДАННЫЕ КОМАНДЫ ============

    /**
     * Получить данные команды
     */
    getTeamData() {
        return this._teamData;
    },

    /**
     * Получить ожидающих приглашения
     */
    getWaitingUsers() {
        return this._waitingUsers;
    },

    /**
     * Получить API членов (для проверки источника)
     */
    getApiMembers() {
        return this._apiMembers;
    },

    // ============ ВНУТРЕННИЕ МЕТОДЫ ============

    /**
     * Загрузить локальные расширения
     */
    _loadLocalExtensions() {
        return StorageManager.get(this.LOCAL_EXTENSIONS_KEY) || {};
    },

    /**
     * Загрузить полностью локальных сотрудников
     */
    _loadLocalOnly() {
        return StorageManager.getArray(this.LOCAL_ONLY_KEY);
    },

    /**
     * Проверить, является ли email членом API команды
     */
    _isApiMember(email) {
        return this._apiMembers.some(m => m.email === email);
    },

    /**
     * Объединить API данные с локальными расширениями
     */
    _mergeData() {
        const result = [];

        // 1. API сотрудники с локальными расширениями
        this._apiMembers.forEach(apiMember => {
            const localExt = this._localExtensions[apiMember.email] || {};
            result.push(this._mergeEmployee(apiMember, localExt));
        });

        // 2. Полностью локальные сотрудники
        this._localOnly.forEach(localEmp => {
            result.push({
                ...localEmp,
                _source: 'local'
            });
        });

        return result;
    },

    /**
     * Объединить API данные сотрудника с локальными
     */
    _mergeEmployee(apiMember, localExt) {
        // Маппинг API статуса на расширенный
        const extendedStatus = localExt.status ||
            (apiMember.status === 'active' ? 'Работает' : 'Уволен');

        return {
            // ID (используем email как ключ для API, или локальный id)
            id: localExt.id || apiMember.email,

            // Из API (базовые)
            email: apiMember.email,
            reddyId: apiMember.reddyId || localExt.reddyId || '',
            role: apiMember.role,
            apiStatus: apiMember.status,
            picture: apiMember.picture,

            // Переопределяемые (приоритет локальным)
            fullName: localExt.fullName || apiMember.name,
            position: localExt.position || apiMember.position || '',
            avatar: localExt.avatar || apiMember.picture || '',
            status: extendedStatus,

            // Только локальные поля
            corpTelegram: localExt.corpTelegram || apiMember.telegram || '',
            personalTelegram: localExt.personalTelegram || '',
            corpPhone: localExt.corpPhone || apiMember.phone || '',
            personalPhone: localExt.personalPhone || '',
            corpEmail: localExt.corpEmail || '',
            personalEmail: localExt.personalEmail || '',
            birthday: localExt.birthday || '',
            office: localExt.office || '',
            startDate: localExt.startDate || '',
            company: localExt.company || '',
            crmLogin: localExt.crmLogin || '',
            comment: localExt.comment || '',
            customFields: localExt.customFields || {},
            predefinedFields: localExt.predefinedFields || {},

            // Мета
            _source: Object.keys(localExt).length > 0 ? 'hybrid' : 'api',
            _apiData: apiMember,
            createdAt: localExt.createdAt || new Date().toISOString(),
            updatedAt: localExt.updatedAt || new Date().toISOString()
        };
    },

    /**
     * Извлечь только локальные поля для сохранения
     */
    _extractLocalFields(employee) {
        return {
            id: employee.id,
            fullName: employee.fullName,
            position: employee.position,
            avatar: employee.avatar,
            status: employee.status,
            reddyId: employee.reddyId,
            corpTelegram: employee.corpTelegram,
            personalTelegram: employee.personalTelegram,
            corpPhone: employee.corpPhone,
            personalPhone: employee.personalPhone,
            corpEmail: employee.corpEmail,
            personalEmail: employee.personalEmail,
            birthday: employee.birthday,
            office: employee.office,
            startDate: employee.startDate,
            company: employee.company,
            crmLogin: employee.crmLogin,
            comment: employee.comment,
            customFields: employee.customFields,
            predefinedFields: employee.predefinedFields,
            createdAt: employee.createdAt,
            updatedAt: new Date().toISOString()
        };
    },

    // ============ ЭКСПОРТ/ИМПОРТ ============

    /**
     * Экспорт в файл
     */
    async exportToFile(data) {
        try {
            const exportData = {
                data: data,
                apiMembers: this._apiMembers,
                localExtensions: this._localExtensions,
                localOnly: this._localOnly,
                timestamp: new Date().toISOString(),
                version: '2.0'
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `team-info-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            console.error('Export error:', error);
            return false;
        }
    },

    /**
     * Импорт из файла
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = JSON.parse(e.target.result);
                    let data = [];

                    // Новый формат v2.0
                    if (content.version === '2.0') {
                        if (content.localExtensions) {
                            this._localExtensions = content.localExtensions;
                            StorageManager.set(this.LOCAL_EXTENSIONS_KEY, this._localExtensions);
                        }
                        if (content.localOnly) {
                            this._localOnly = content.localOnly;
                            StorageManager.set(this.LOCAL_ONLY_KEY, this._localOnly);
                        }
                        data = content.data || [];
                    }
                    // Старый формат v1.0
                    else if (content.data && Array.isArray(content.data)) {
                        data = this._migrateOldData(content.data);
                    }
                    // Массив напрямую
                    else if (Array.isArray(content)) {
                        data = this._migrateOldData(content);
                    }

                    resolve(data);
                } catch (error) {
                    reject(new Error('Неверный формат файла'));
                }
            };
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsText(file);
        });
    },

    /**
     * Миграция старых данных
     */
    _migrateOldData(data) {
        return data.map(item => {
            // Миграция поля title → fullName
            if (item.title && !item.fullName) {
                return {
                    ...item,
                    fullName: item.title,
                    position: item.position || '',
                    predefinedFields: item.predefinedFields || {},
                    customFields: item.customFields || {},
                    comment: item.comment || '',
                    _source: 'local'
                };
            }
            return {
                ...item,
                _source: item._source || 'local'
            };
        });
    }
};

console.log('✅ Hybrid Storage loaded');
