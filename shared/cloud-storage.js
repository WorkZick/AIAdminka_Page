/**
 * CloudStorage - Adapter for Google Sheets/Drive via Apps Script
 * Замена localStorage для облачного хранения данных
 */

const CloudStorage = {
    // Environment configuration (делегируем в EnvConfig)
    get ENVIRONMENTS() {
        return EnvConfig.ENVIRONMENTS;
    },

    // Current environment
    get currentEnv() {
        return EnvConfig.getCurrentEnv();
    },

    // Apps Script URL (dynamic based on environment)
    get SCRIPT_URL() {
        return EnvConfig.getScriptUrl();
    },

    /**
     * Switch environment (test/prod)
     * @param {string} env - 'test' or 'prod'
     */
    setEnvironment(env) {
        const result = EnvConfig.setEnvironment(env);
        if (result) {
            this.clearCache(); // Clear cache when switching
        }
        return result;
    },

    /**
     * Get current environment info
     */
    getEnvironmentInfo() {
        return EnvConfig.getInfo();
    },

    // Cache settings
    CACHE_TTL: 60000, // 1 минута
    CACHE_PREFIX: 'cs-cache-',
    cache: {}, // In-memory fallback

    // Pending requests для предотвращения race condition
    pendingRequests: new Map(),

    // Request queue для контроля параллельных запросов
    MAX_CONCURRENT_REQUESTS: 5,
    requestQueue: [],
    activeRequests: 0,

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

    // ============ REQUEST QUEUE ============

    /**
     * Добавить запрос в очередь
     * Если есть свободные слоты - выполняет сразу, иначе ставит в очередь
     * @param {Function} requestFn - Функция запроса
     * @returns {Promise} Promise результата запроса
     */
    async enqueueRequest(requestFn) {
        // Если есть свободные слоты - выполняем сразу
        if (this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
            return this.executeRequest(requestFn);
        }

        // Иначе добавляем в очередь и ждём
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                execute: requestFn,
                resolve,
                reject
            });
        });
    },

    /**
     * Выполнить запрос и обработать очередь после завершения
     * @param {Function} requestFn - Функция запроса
     * @returns {Promise} Promise результата запроса
     */
    async executeRequest(requestFn) {
        this.activeRequests++;

        try {
            const result = await requestFn();
            return result;
        } finally {
            this.activeRequests--;
            this.processQueue();
        }
    },

    /**
     * Обработать следующий запрос в очереди
     */
    processQueue() {
        // Если очередь пустая или нет свободных слотов - выходим
        if (this.requestQueue.length === 0 || this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
            return;
        }

        // Берём следующий запрос из очереди
        const queuedRequest = this.requestQueue.shift();

        // Выполняем запрос
        this.executeRequest(queuedRequest.execute)
            .then(queuedRequest.resolve)
            .catch(queuedRequest.reject);
    },

    /**
     * Получить статистику очереди (для отладки)
     */
    getQueueStats() {
        return {
            activeRequests: this.activeRequests,
            queuedRequests: this.requestQueue.length,
            maxConcurrent: this.MAX_CONCURRENT_REQUESTS
        };
    },

    // ============ API CALLS ============

    // Retry settings
    MAX_RETRIES: 3,
    INITIAL_DELAY: 1000, // 1 second

    /**
     * Получение access token для авторизации запросов
     */
    getAccessToken() {
        const auth = this.getAuthData();
        return auth ? auth.accessToken : null;
    },

    /**
     * Sleep helper for retry delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Вызов Apps Script API (GET с URL параметрами или POST с JSON body)
     * GAS теряет POST body при редиректе, поэтому используем GET для малых данных
     * Для больших данных (uploadImage) используем POST с JSON body
     * Включает retry с exponential backoff и request queue
     */
    async callApi(action, params = {}, retryCount = 0, usePost = false) {
        if (!this.isOnline) {
            throw new Error('Нет подключения к интернету');
        }

        const accessToken = this.getAccessToken();
        if (!accessToken) {
            // Токен истёк или отсутствует - редирект на логин
            this.redirectToLogin();
            // Возвращаем Promise, который не разрешится - предотвращает выполнение кода после редиректа
            return new Promise(() => {});
        }

        // Создаём функцию для выполнения запроса
        const executeApiRequest = async () => {
            const url = new URL(this.SCRIPT_URL);

            let fetchOptions;

            if (usePost) {
                // POST запрос с text/plain для больших данных
                // text/plain не вызывает CORS preflight (simple request по спецификации CORS)
                // Бэкенд парсит JSON из text/plain body
                const postData = {
                    action: action,
                    accessToken: accessToken,
                    ...params
                };

                fetchOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: JSON.stringify(postData)
                };
            } else {
                // GET запрос с URL параметрами (для малых данных)
                url.searchParams.set('action', action);

                // ⚠️ CRITICAL SECURITY ISSUE: Access Token в URL параметрах
                // Риски:
                // - Токен логируется в истории браузера (localStorage, browser history)
                // - Токен логируется в серверных access logs
                // - Токен может утечь через Referer header при переходах
                // - Токен уязвим к утечке через XSS (доступ к history.state)
                //
                // Решение (требует изменения бекенда):
                // 1. Apps Script должен читать токен из заголовка Authorization: Bearer <token>
                // 2. Использовать fetch() с headers: { 'Authorization': `Bearer ${accessToken}` }
                // 3. Примечание: Google Apps Script теряет POST body при редиректе,
                //    но headers сохраняются, поэтому можно использовать GET с Authorization
                //
                // TODO: Реализовать после изменения Apps Script бекенда
                url.searchParams.set('accessToken', accessToken);

                // Добавляем остальные параметры
                for (const [key, value] of Object.entries(params)) {
                    if (value !== undefined && value !== null) {
                        url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
                    }
                }

                fetchOptions = {
                    method: 'GET'
                };
            }

            const response = await fetch(url.toString(), fetchOptions);

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            return result;
        };

        try {
            // Выполняем запрос через очередь
            return await this.enqueueRequest(executeApiRequest);
        } catch (error) {
            // Retry logic with exponential backoff
            const isRetryable = error.message.includes('Failed to fetch') ||
                               error.message.includes('NetworkError') ||
                               error.message.includes('timeout') ||
                               error.name === 'TypeError';

            if (isRetryable && retryCount < this.MAX_RETRIES) {
                const delay = this.INITIAL_DELAY * Math.pow(2, retryCount);
                console.warn(`CloudStorage: Retry ${retryCount + 1}/${this.MAX_RETRIES} after ${delay}ms...`);
                await this.sleep(delay);
                return this.callApi(action, params, retryCount + 1, usePost);
            }

            console.error('CloudStorage API error:', error);

            // Если Access denied - пользователь удалён из системы, разлогиниваем
            const errorMessage = error.message || String(error);
            if (errorMessage.includes('Access denied') || errorMessage.includes('User not found')) {
                if (typeof Toast !== 'undefined') {
                    Toast.error('Доступ запрещён. Ваш аккаунт не найден в системе.');
                }
                // Очищаем данные и редиректим на login
                localStorage.removeItem('cloud-auth');
                localStorage.removeItem('roleGuard-cache');
                setTimeout(() => {
                    if (typeof AuthGuard !== 'undefined') {
                        AuthGuard.redirectToLogin();
                    } else {
                        window.location.href = '/SimpleAIAdminka/login/';
                    }
                }, 1500);
            }

            throw error;
        }
    },

    /**
     * POST запрос для больших данных (использует POST с JSON body)
     */
    async postApi(action, data) {
        return this.callApi(action, data, 0, true);
    },

    // ============ CACHE (localStorage с fallback в память) ============

    /**
     * Получение из кэша (localStorage → memory fallback)
     */
    getFromCache(key) {
        // Пробуем localStorage
        try {
            const raw = localStorage.getItem(this.CACHE_PREFIX + key);
            if (raw) {
                const cached = JSON.parse(raw);
                if (Date.now() - cached.timestamp <= this.CACHE_TTL) {
                    return cached.data;
                }
                localStorage.removeItem(this.CACHE_PREFIX + key);
                return null;
            }
        } catch (e) {
            // localStorage недоступен — пробуем memory
        }

        // Fallback: in-memory кеш
        const memCached = this.cache[key];
        if (!memCached) return null;
        if (Date.now() - memCached.timestamp > this.CACHE_TTL) {
            delete this.cache[key];
            return null;
        }
        return memCached.data;
    },

    /**
     * Сохранение в кэш (localStorage с fallback в память)
     */
    setCache(key, data) {
        const entry = { data: data, timestamp: Date.now() };

        try {
            localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(entry));
        } catch (e) {
            // localStorage переполнен — используем memory
            this.cache[key] = entry;
        }
    },

    /**
     * Очистка кэша
     */
    clearCache(key) {
        if (key) {
            delete this.cache[key];
            try { localStorage.removeItem(this.CACHE_PREFIX + key); } catch (e) {}
        } else {
            this.cache = {};
            // Удаляем все cs-cache-* ключи из localStorage
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(this.CACHE_PREFIX)) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
            } catch (e) {}
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

        // Предотвращение race condition: возвращаем существующий Promise если запрос уже в процессе
        if (this.pendingRequests.has('partners')) {
            return this.pendingRequests.get('partners');
        }

        const fetchPromise = (async () => {
            try {
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
            } finally {
                this.pendingRequests.delete('partners');
            }
        })();

        this.pendingRequests.set('partners', fetchPromise);
        return fetchPromise;
    },

    /**
     * Добавить партнёра
     */
    async addPartner(data) {
        const result = await this.callApi('addPartner', { data: data });
        this.clearCache('partners');
        this.pendingRequests.delete('partners'); // Очищаем pending при изменении данных
        return result;
    },

    /**
     * Обновить партнёра
     */
    async updatePartner(id, data) {
        const result = await this.callApi('updatePartner', { id: id, data: data });
        this.clearCache('partners');
        this.pendingRequests.delete('partners');
        return result;
    },

    /**
     * Удалить партнёра
     */
    async deletePartner(id) {
        const result = await this.callApi('deletePartner', { id: id });
        this.clearCache('partners');
        this.pendingRequests.delete('partners');
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

    // ============ STORAGE ============

    /**
     * Инициализировать хранилище для команды/пользователя
     * Должен вызываться leader или admin
     * @returns {Promise<Object>} результат с sheetId, folderId
     */
    async initStorage() {
        const result = await this.callApi('initStorage');
        return result;
    },

    // ============ EMPLOYEES (Team Members) ============

    /**
     * Получить сотрудников команды
     * @param {boolean} useCache - использовать кеш
     * @returns {Promise<Array>} массив сотрудников
     */
    async getEmployees(useCache = true) {
        if (useCache) {
            const cached = this.getFromCache('employees');
            if (cached) return cached;
        }

        // Предотвращение race condition
        if (this.pendingRequests.has('employees')) {
            return this.pendingRequests.get('employees');
        }

        const fetchPromise = (async () => {
            try {
                const result = await this.callApi('getEmployees');
                let employees = result.employees || [];

                // Парсим customFields если они в виде строки
                employees.forEach(emp => {
                    if (emp.customFields && typeof emp.customFields === 'string') {
                        try {
                            emp.customFields = JSON.parse(emp.customFields);
                        } catch (e) {
                            emp.customFields = {};
                        }
                    }
                    if (emp.predefinedFields && typeof emp.predefinedFields === 'string') {
                        try {
                            emp.predefinedFields = JSON.parse(emp.predefinedFields);
                        } catch (e) {
                            emp.predefinedFields = {};
                        }
                    }
                });

                this.setCache('employees', employees);
                return employees;
            } finally {
                this.pendingRequests.delete('employees');
            }
        })();

        this.pendingRequests.set('employees', fetchPromise);
        return fetchPromise;
    },

    /**
     * Сохранить сотрудника (создать или обновить)
     * @param {Object} data - данные сотрудника
     * @returns {Promise<Object>} результат с id сотрудника
     */
    async saveEmployee(data) {
        // Сериализуем customFields и predefinedFields
        const dataToSave = { ...data };
        if (dataToSave.customFields && typeof dataToSave.customFields === 'object') {
            dataToSave.customFields = JSON.stringify(dataToSave.customFields);
        }
        if (dataToSave.predefinedFields && typeof dataToSave.predefinedFields === 'object') {
            dataToSave.predefinedFields = JSON.stringify(dataToSave.predefinedFields);
        }

        const result = await this.postApi('saveEmployee', { data: dataToSave });
        this.clearCache('employees');
        this.pendingRequests.delete('employees');
        return result;
    },

    /**
     * Удалить сотрудника
     * @param {string} id - ID сотрудника
     * @returns {Promise<Object>} результат операции
     */
    async deleteEmployee(id) {
        const result = await this.callApi('deleteEmployee', { id: id });
        this.clearCache('employees');
        this.pendingRequests.delete('employees');
        return result;
    },

    /**
     * Получить шаблоны сотрудников
     * @param {boolean} useCache - использовать кеш
     * @returns {Promise<Array>} массив шаблонов
     */
    async getEmployeeTemplates(useCache = true) {
        if (useCache) {
            const cached = this.getFromCache('employeeTemplates');
            if (cached) return cached;
        }

        const result = await this.callApi('getEmployeeTemplates');
        const templates = result.templates || [];

        this.setCache('employeeTemplates', templates);
        return templates;
    },

    /**
     * Сохранить шаблон сотрудника
     * @param {Object} data - данные шаблона
     */
    async saveEmployeeTemplate(data) {
        const result = await this.postApi('saveEmployeeTemplate', { data: data });
        this.clearCache('employeeTemplates');
        return result;
    },

    /**
     * Удалить шаблон сотрудника
     * @param {string} id - ID шаблона
     */
    async deleteEmployeeTemplate(id) {
        const result = await this.callApi('deleteEmployeeTemplate', { id: id });
        this.clearCache('employeeTemplates');
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
        Toast.error('Нет подключения к интернету. Проверьте соединение и попробуйте снова.');
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
