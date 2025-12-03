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

        // Проверяем срок токена (~58 минут, Silent Refresh обновляет автоматически)
        if (Date.now() - auth.timestamp > 3500000) {
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
     * Получение access token для авторизации запросов
     */
    getAccessToken() {
        const auth = this.getAuthData();
        return auth ? auth.accessToken : null;
    },

    /**
     * Вызов Apps Script API (GET с URL параметрами)
     * GAS теряет POST body при редиректе, поэтому используем GET
     */
    async callApi(action, params = {}) {
        if (!this.isOnline) {
            throw new Error('Нет подключения к интернету');
        }

        const accessToken = this.getAccessToken();
        if (!accessToken) {
            // Токен истёк или отсутствует - редирект на логин
            this.redirectToLogin();
            throw new Error('Требуется авторизация');
        }

        try {
            const url = new URL(this.SCRIPT_URL);
            url.searchParams.set('action', action);
            url.searchParams.set('accessToken', accessToken);

            // Добавляем остальные параметры
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
                }
            }

            const response = await fetch(url.toString(), {
                method: 'GET'
            });

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
     * POST запрос для больших данных (legacy, использует callApi)
     */
    async postApi(action, data) {
        return this.callApi(action, data);
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
     * Получить локальные несинхронизированные элементы
     * @param {string} storageKey - ключ в localStorage
     * @returns {Array} массив элементов с _synced: false
     */
    getLocalUnsynced(storageKey) {
        try {
            const data = localStorage.getItem(storageKey);
            if (!data) return [];
            const items = JSON.parse(data);
            return items.filter(item => item._synced === false);
        } catch (e) {
            return [];
        }
    },

    /**
     * Получить партнёров ТОЛЬКО из облака (без локальных)
     * Используется для проверки дубликатов при восстановлении
     */
    async fetchPartnersFromCloud() {
        const result = await this.callApi('getPartners');
        return result.partners || [];
    },

    /**
     * Получить всех партнёров
     */
    async getPartners(useCache = true) {
        if (useCache) {
            const cached = this.getFromCache('partners');
            if (cached) return cached;
        }

        const result = await this.callApi('getPartners');
        let partners = result.partners || [];

        // Парсим customFields и маппим поля из Google Sheets формата
        partners.forEach(p => {
            if (p.customFields && typeof p.customFields === 'string') {
                try {
                    p.customFields = JSON.parse(p.customFields);
                } catch (e) {
                    p.customFields = {};
                }
            }
            // Маппинг полей: Google Sheets → локальный формат
            p.dep = p.deposits || p.dep || 0;
            p.with = p.withdrawals || p.with || 0;
            p.comp = p.compensation || p.comp || 0;
            // Помечаем облачные данные как синхронизированные
            p._synced = true;
        });

        // Объединяем с локальными несинхронизированными
        const localUnsynced = this.getLocalUnsynced('partners-data');
        if (localUnsynced.length > 0) {
            const getKey = (p) => `${String(p.subagent || '').toLowerCase().trim()}|${String(p.subagentId || '').toLowerCase().trim()}|${String(p.method || '').toLowerCase().trim()}`;

            // Создаём Set ключей из облачных данных
            const cloudKeys = new Set(partners.map(getKey));

            // Фильтруем локальные - оставляем только те, которых НЕТ в облаке
            const reallyUnsynced = localUnsynced.filter(local => !cloudKeys.has(getKey(local)));

            if (reallyUnsynced.length !== localUnsynced.length) {
                // Есть стейл-данные, которые уже в облаке - очищаем localStorage
                if (reallyUnsynced.length === 0) {
                    localStorage.removeItem('partners-data');
                } else {
                    localStorage.setItem('partners-data', JSON.stringify(reallyUnsynced));
                }
            }

            if (reallyUnsynced.length > 0) {
                partners = [...partners, ...reallyUnsynced];
            }
        }

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

    // ============ TICKETS (Предложения/Баги) ============

    /**
     * Получить все тикеты
     */
    async getTickets(useCache = true) {
        if (useCache) {
            const cached = this.getFromCache('tickets');
            if (cached) return cached;
        }

        const result = await this.callApi('getTickets');
        const tickets = result.tickets || [];

        this.setCache('tickets', tickets);
        return tickets;
    },

    /**
     * Создать тикет
     * @param {Object} data - { title, description, images: [fileId, ...] }
     */
    async createTicket(data) {
        const result = await this.postApi('createTicket', { data: data });
        this.clearCache('tickets');
        return result;
    },

    /**
     * Обновить статус тикета (только админ)
     * @param {string} id - ID тикета
     * @param {string} status - новый статус (new, in_progress, need_info, resolved, closed)
     */
    async updateTicketStatus(id, status) {
        const result = await this.callApi('updateTicketStatus', { id: id, status: status });
        this.clearCache('tickets');
        return result;
    },

    /**
     * Добавить комментарий к тикету
     * @param {string} id - ID тикета
     * @param {string} comment - текст комментария
     */
    async addTicketComment(id, comment) {
        const result = await this.callApi('addTicketComment', { id: id, comment: comment });
        this.clearCache('tickets');
        return result;
    },

    /**
     * Проверить, является ли текущий пользователь админом
     */
    async checkIsAdmin() {
        const cached = this.getFromCache('isAdmin');
        if (cached !== null) return cached;

        const result = await this.callApi('checkIsAdmin');
        const isAdmin = result.isAdmin || false;

        this.setCache('isAdmin', isAdmin);
        return isAdmin;
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
        // Используем AuthGuard если доступен, иначе вычисляем путь
        if (typeof AuthGuard !== 'undefined' && AuthGuard.LOGIN_URL) {
            window.location.href = AuthGuard.LOGIN_URL;
        } else {
            // Fallback: определяем базовый путь из текущего URL
            const match = window.location.pathname.match(/^\/([^\/]+)\//);
            const basePath = match ? '/' + match[1] : '';
            window.location.href = basePath + '/login/index.html';
        }
    }
};

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloudStorage;
}
