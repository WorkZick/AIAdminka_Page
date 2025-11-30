/**
 * CloudStorage - Adapter for Google Sheets/Drive via Apps Script
 * Замена localStorage для облачного хранения данных
 */

const CloudStorage = {
    // Apps Script URL
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyeWmZs028zVkzKTrqNTbzTasKK0Z63eCfV1I4RUV6BJWMH8r62kScLh7U5B45bHRRILA/exec',

    // Cache settings
    CACHE_TTL: 60000, // 1 минута
    cache: {},

    // State
    isOnline: navigator.onLine,
    userEmail: null,
    isInitialized: false,

    // ============ INITIALIZATION ============

    /**
     * Инициализация CloudStorage
     * @returns {Promise<boolean>} true если авторизован и хранилище готово
     */
    async init() {
        // Проверяем онлайн статус
        this.isOnline = navigator.onLine;
        window.addEventListener('online', () => this.isOnline = true);
        window.addEventListener('offline', () => this.isOnline = false);

        // Проверяем авторизацию
        const auth = this.getAuthData();
        if (!auth) {
            return false;
        }

        this.userEmail = auth.email;
        this.isInitialized = true;
        return true;
    },

    /**
     * Проверка авторизации
     */
    isAuthenticated() {
        const auth = this.getAuthData();
        return auth !== null;
    },

    /**
     * Получение данных авторизации
     */
    getAuthData() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return null;

        const auth = JSON.parse(authData);

        // Проверяем срок токена (1 час)
        if (Date.now() - auth.timestamp > 3600000) {
            localStorage.removeItem('cloud-auth');
            return null;
        }

        return auth;
    },

    /**
     * Получение email текущего пользователя
     */
    getUserEmail() {
        const auth = this.getAuthData();
        return auth ? auth.email : null;
    },

    /**
     * Получение данных пользователя
     */
    getUserInfo() {
        const auth = this.getAuthData();
        if (!auth) return null;
        return {
            email: auth.email,
            name: auth.name,
            picture: auth.picture
        };
    },

    // ============ API CALLS ============

    /**
     * Вызов Apps Script API
     */
    async callApi(action, params = {}) {
        if (!this.isOnline) {
            throw new Error('Нет подключения к интернету');
        }

        const email = this.getUserEmail();
        if (!email) {
            throw new Error('Требуется авторизация');
        }

        let url = this.SCRIPT_URL + '?action=' + action + '&email=' + encodeURIComponent(email);

        // Добавляем параметры
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url += '&' + key + '=' + encodeURIComponent(
                    typeof value === 'object' ? JSON.stringify(value) : value
                );
            }
        }

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            return result;
        } catch (error) {
            console.error('CloudStorage API error:', error);
            throw error;
        }
    },

    /**
     * POST запрос для больших данных
     */
    async postApi(action, data) {
        if (!this.isOnline) {
            throw new Error('Нет подключения к интернету');
        }

        const email = this.getUserEmail();
        if (!email) {
            throw new Error('Требуется авторизация');
        }

        try {
            const response = await fetch(this.SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: action,
                    email: email,
                    ...data
                })
            });

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            return result;
        } catch (error) {
            console.error('CloudStorage POST error:', error);
            throw error;
        }
    },

    // ============ CACHE ============

    /**
     * Получение из кэша
     */
    getFromCache(key) {
        const cached = this.cache[key];
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            delete this.cache[key];
            return null;
        }

        return cached.data;
    },

    /**
     * Сохранение в кэш
     */
    setCache(key, data) {
        this.cache[key] = {
            data: data,
            timestamp: Date.now()
        };
    },

    /**
     * Очистка кэша
     */
    clearCache(key) {
        if (key) {
            delete this.cache[key];
        } else {
            this.cache = {};
        }
    },

    // ============ PARTNERS ============

    /**
     * Получить всех партнёров
     */
    async getPartners(useCache = true) {
        if (useCache) {
            const cached = this.getFromCache('partners');
            if (cached) return cached;
        }

        const result = await this.callApi('getPartners');
        const partners = result.partners || [];

        // Парсим customFields
        partners.forEach(p => {
            if (p.customFields && typeof p.customFields === 'string') {
                try {
                    p.customFields = JSON.parse(p.customFields);
                } catch (e) {
                    p.customFields = {};
                }
            }
        });

        this.setCache('partners', partners);
        return partners;
    },

    /**
     * Добавить партнёра
     */
    async addPartner(data) {
        const result = await this.callApi('addPartner', { data: data });
        this.clearCache('partners');
        return result;
    },

    /**
     * Обновить партнёра
     */
    async updatePartner(id, data) {
        const result = await this.callApi('updatePartner', { id: id, data: data });
        this.clearCache('partners');
        return result;
    },

    /**
     * Удалить партнёра
     */
    async deletePartner(id) {
        const result = await this.callApi('deletePartner', { id: id });
        this.clearCache('partners');
        return result;
    },

    // ============ TEMPLATES ============

    /**
     * Получить шаблоны партнёров
     */
    async getTemplates(useCache = true) {
        if (useCache) {
            const cached = this.getFromCache('templates');
            if (cached) return cached;
        }

        const result = await this.callApi('getTemplates');
        const templates = result.templates || [];

        this.setCache('templates', templates);
        return templates;
    },

    /**
     * Сохранить шаблон
     */
    async saveTemplate(data) {
        const result = await this.callApi('saveTemplate', { data: data });
        this.clearCache('templates');
        return result;
    },

    /**
     * Удалить шаблон
     */
    async deleteTemplate(id) {
        const result = await this.callApi('deleteTemplate', { id: id });
        this.clearCache('templates');
        return result;
    },

    // ============ METHODS ============

    /**
     * Получить методы партнёров
     */
    async getMethods(useCache = true) {
        if (useCache) {
            const cached = this.getFromCache('methods');
            if (cached) return cached;
        }

        const result = await this.callApi('getMethods');
        const methods = result.methods || [];

        this.setCache('methods', methods);
        return methods;
    },

    /**
     * Добавить метод
     */
    async addMethod(data) {
        const result = await this.callApi('addMethod', { data: data });
        this.clearCache('methods');
        return result;
    },

    /**
     * Обновить метод
     */
    async updateMethod(id, data) {
        const result = await this.callApi('updateMethod', { id: id, data: data });
        this.clearCache('methods');
        return result;
    },

    /**
     * Удалить метод
     */
    async deleteMethod(id) {
        const result = await this.callApi('deleteMethod', { id: id });
        this.clearCache('methods');
        return result;
    },

    // ============ IMAGES ============

    /**
     * Загрузить изображение
     * @param {string} folder - папка (partners, team)
     * @param {string} fileName - имя файла
     * @param {string} base64 - base64 данные изображения (без префикса data:image...)
     */
    async uploadImage(folder, fileName, base64) {
        // Убираем data:image prefix если есть
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

        const result = await this.postApi('uploadImage', {
            folder: folder,
            fileName: fileName,
            base64: cleanBase64
        });

        return result;
    },

    /**
     * Удалить изображение
     */
    async deleteImage(fileId) {
        return await this.callApi('deleteImage', { fileId: fileId });
    },

    /**
     * Получить URL изображения по fileId
     */
    getImageUrl(fileId) {
        if (!fileId) return null;
        return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400';
    },

    // ============ BULK OPERATIONS ============

    /**
     * Получить все данные
     */
    async getAllData() {
        const result = await this.callApi('getAllData');
        return result.data || {};
    },

    /**
     * Импортировать все данные
     */
    async importAll(data) {
        const result = await this.postApi('importAll', { data: data });
        this.clearCache();
        return result;
    },

    // ============ LOGS ============

    /**
     * Получить логи
     */
    async getLogs(limit = 50) {
        const result = await this.callApi('getLogs', { limit: limit });
        return result.logs || [];
    },

    // ============ HELPERS ============

    /**
     * Проверка онлайн статуса
     */
    checkOnline() {
        if (!navigator.onLine) {
            this.showOfflineMessage();
            return false;
        }
        return true;
    },

    /**
     * Показать сообщение об отсутствии интернета
     */
    showOfflineMessage() {
        // Можно переопределить в конкретном модуле
        alert('Нет подключения к интернету. Проверьте соединение и попробуйте снова.');
    },

    /**
     * Редирект на страницу входа
     */
    redirectToLogin() {
        window.location.href = '/SimpleAIAdminka/login/index.html';
    }
};

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloudStorage;
}
