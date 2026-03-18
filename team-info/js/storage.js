/**
 * Storage для Team Info - Cloud-based версия
 * Использует CloudStorage для синхронизации с Google Sheets
 * @version 3.0
 */
const storage = {
    // Кеш данных
    _employees: [],
    _templates: [],
    _loadingPromise: null,

    // ============ ОСНОВНЫЕ МЕТОДЫ ============

    /**
     * Загрузить всех сотрудников из облака
     * @returns {Promise<Array>} массив сотрудников
     */
    async loadData() {
        if (this._loadingPromise) {
            return this._loadingPromise;
        }

        this._loadingPromise = this._doLoadData();
        try {
            return await this._loadingPromise;
        } finally {
            this._loadingPromise = null;
        }
    },

    async _doLoadData() {
        try {
            const employees = await CloudStorage.getEmployees();
            this._employees = employees || [];
            return this._employees;
        } catch (error) {
            console.error('[Storage] Error loading employees:', error);
            // Fallback на localStorage
            return this._loadFromLocalStorage();
        }
    },

    /**
     * Сохранить все данные в облако
     * @param {Array} employees - массив сотрудников
     */
    async saveData(employees) {
        this._employees = employees;

        // Сохраняем каждого сотрудника
        const promises = employees.map(emp => this.saveEmployee(emp));
        await Promise.all(promises);

        return true;
    },

    /**
     * Сохранить одного сотрудника
     * @param {Object} employee - данные сотрудника
     * @returns {Promise<Object>} результат с id
     */
    async saveEmployee(employee) {
        try {
            const result = await CloudStorage.saveEmployee(employee);

            if (result.error) {
                throw new Error(result.error);
            }

            // Обновляем локальный кеш
            const index = this._employees.findIndex(e => e.id === employee.id);
            if (index >= 0) {
                this._employees[index] = { ...employee, id: result.id || employee.id };
            } else {
                this._employees.push({ ...employee, id: result.id || employee.id });
            }

            return result;
        } catch (error) {
            console.error('[Storage] Error saving employee:', error);
            // Fallback: сохраняем локально
            this._saveToLocalStorage();
            return { success: false, error: error.message };
        }
    },

    /**
     * Удалить сотрудника
     * @param {string} id - ID сотрудника
     */
    async deleteEmployee(id) {
        try {
            const result = await CloudStorage.deleteEmployee(id);

            if (result.error) {
                throw new Error(result.error);
            }

            // Обновляем локальный кеш
            this._employees = this._employees.filter(e => e.id !== id);

            return result;
        } catch (error) {
            console.error('[Storage] Error deleting employee:', error);
            return { success: false, error: error.message };
        }
    },

    // ============ ШАБЛОНЫ ============

    /**
     * Загрузить шаблоны сотрудников
     * @returns {Promise<Array>} массив шаблонов
     */
    async loadTemplates() {
        try {
            const templates = await CloudStorage.getEmployeeTemplates();
            this._templates = templates || [];

            // Парсим fields если строка
            this._templates.forEach(t => {
                if (t.fields && typeof t.fields === 'string') {
                    try {
                        t.fields = JSON.parse(t.fields);
                    } catch (e) {
                        t.fields = [];
                    }
                }
            });

            return this._templates;
        } catch (error) {
            console.error('[Storage] Error loading templates:', error);
            return this._loadTemplatesFromLocalStorage();
        }
    },

    /**
     * Сохранить шаблон
     * @param {Object} template - данные шаблона
     */
    async saveTemplate(template) {
        try {
            const result = await CloudStorage.saveEmployeeTemplate(template);

            if (result.error) {
                throw new Error(result.error);
            }

            // Обновляем кеш
            const index = this._templates.findIndex(t => t.id === template.id);
            if (index >= 0) {
                this._templates[index] = { ...template, id: result.id || template.id };
            } else {
                this._templates.push({ ...template, id: result.id || template.id });
            }

            return result;
        } catch (error) {
            console.error('[Storage] Error saving template:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Удалить шаблон
     * @param {string} id - ID шаблона
     */
    async deleteTemplate(id) {
        try {
            const result = await CloudStorage.deleteEmployeeTemplate(id);

            if (result.error) {
                throw new Error(result.error);
            }

            this._templates = this._templates.filter(t => t.id !== id);

            return result;
        } catch (error) {
            console.error('[Storage] Error deleting template:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Получить шаблон по ID
     * @param {string} id - ID шаблона
     */
    getTemplate(id) {
        return this._templates.find(t => t.id === id) || null;
    },

    /**
     * Получить все шаблоны (из кеша)
     */
    getTemplates() {
        return this._templates;
    },

    // ============ FALLBACK НА LOCALSTORAGE ============

    /**
     * Загрузить из localStorage (fallback)
     */
    _loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('team_info_employees');
            this._employees = saved ? JSON.parse(saved) : [];
            return this._employees;
        } catch (e) {
            console.error('[Storage] Error loading from localStorage:', e);
            return [];
        }
    },

    /**
     * Сохранить в localStorage (fallback)
     */
    _saveToLocalStorage() {
        try {
            localStorage.setItem('team_info_employees', JSON.stringify(this._employees));
        } catch (e) {
            console.error('[Storage] Error saving to localStorage:', e);
        }
    },

    /**
     * Загрузить шаблоны из localStorage
     */
    _loadTemplatesFromLocalStorage() {
        try {
            const saved = localStorage.getItem('team_info_templates');
            this._templates = saved ? JSON.parse(saved) : [];
            return this._templates;
        } catch (e) {
            return [];
        }
    },

    // ============ ЭКСПОРТ/ИМПОРТ ============

    /**
     * Экспорт в файл
     */
    async exportToFile(data) {
        try {
            const exportData = {
                employees: data || this._employees,
                templates: this._templates,
                timestamp: new Date().toISOString(),
                version: '3.0'
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
            reader.onload = async (e) => {
                try {
                    const content = JSON.parse(e.target.result);
                    let employees = [];

                    // v3.0 формат
                    if (content.version === '3.0') {
                        employees = content.employees || [];
                        // Импортируем шаблоны если есть
                        if (content.templates && content.templates.length > 0) {
                            for (const template of content.templates) {
                                await this.saveTemplate(template);
                            }
                        }
                    }
                    // v2.0 формат
                    else if (content.version === '2.0') {
                        employees = content.data || [];
                    }
                    // Старый формат или массив
                    else if (content.data && Array.isArray(content.data)) {
                        employees = content.data;
                    } else if (Array.isArray(content)) {
                        employees = content;
                    }

                    // Сохраняем импортированных сотрудников
                    for (const emp of employees) {
                        // Генерируем новый ID для импортируемых
                        const newEmp = { ...emp, id: 'emp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5) };
                        await this.saveEmployee(newEmp);
                    }

                    resolve(employees);
                } catch (error) {
                    reject(new Error('Неверный формат файла'));
                }
            };
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsText(file);
        });
    },

    // ============ ХЕЛПЕРЫ ============

    /**
     * Получить сотрудников из кеша
     */
    getEmployees() {
        return this._employees;
    },

    /**
     * Найти сотрудника по ID
     * @param {string} id - ID сотрудника
     */
    getEmployee(id) {
        return this._employees.find(e => e.id === id) || null;
    },

    /**
     * Очистить кеш
     */
    clearCache() {
        this._employees = [];
        this._templates = [];
        CloudStorage.clearCache('employees');
        CloudStorage.clearCache('employeeTemplates');
    }
};
