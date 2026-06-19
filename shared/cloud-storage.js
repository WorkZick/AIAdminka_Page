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
    CACHE_TTL: 300000, // 5 минут (fresh)
    STALE_MAX_AGE: 1800000, // 30 минут (stale-while-revalidate)
    get CACHE_PREFIX() {
        const env = typeof EnvConfig !== 'undefined' ? EnvConfig.getCurrentEnv() : 'default';
        return 'cs-cache-' + env + '-';
    },
    // Cache envelope version (Phase 62 — bump to 2 auto-invalidates v2.35 envelopes)
    // 3 — flush pre-i45 отравленных sort/filter-ключей (частичные/1-строчные envelopes из бага потери строк)
    CACHE_VERSION: 3,
    // Phase 62 (CACHE-03): in-memory namespace timestamp map.
    // Seeded из localStorage в init() через _loadNsTsFromLocalStorage().
    // Key: namespace (например 'partners'), Value: epoch ms (server-returned ts)
    _lastKnownNsTs: {},
    _storageListenerAttached: false,    // Phase 65 (MULTI-TAB-04) idempotency guard
    _broadcastDebounceMap: {},          // Phase 65 (MULTI-TAB-04) per-ns debounce timers
    // Phase 66 (METRICS-02): observability surface для DevTools
    // Initialized to zero-shape; incremented в getFromCache + getX response handlers
    // По-namespace breakdown в byNs для granular per-entity observability
    // DevTools usage: console.table(window.__cacheStats.byNs)
    _cacheStatsInitialized: false,
    cache: {}, // In-memory fallback
    _staleKeys: new Set(), // Ключи, отданные как stale
    _rateLimitCooldownUntil: 0, // Глобальный cooldown при rate limit

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
        if (this.isInitialized) return this.isAuthenticated();

        // Проверяем онлайн статус
        this.isOnline = navigator.onLine;
        this._onlineHandler = () => this.isOnline = true;
        this._offlineHandler = () => this.isOnline = false;
        window.addEventListener('online', this._onlineHandler);
        window.addEventListener('offline', this._offlineHandler);

        // Проверяем авторизацию
        const auth = this.getAuthData();
        if (!auth) {
            return false;
        }

        this.userEmail = auth.email;
        // Phase 62 (CACHE-03): seed namespace timestamp map из localStorage
        this._loadNsTsFromLocalStorage();

        // Phase 66 (METRICS-02): observability surface init
        this._initCacheStats();

        // Phase 65 (MULTI-TAB-04): localStorage `storage` event fallback для cross-tab invalidation.
        // Defense in depth: SharedWorker primary path; storage event backup для Safari <15 + edge cases.
        // Storage event fires только в OTHER tabs (не в sender) — exactly what we want.
        if (typeof window !== 'undefined' && !this._storageListenerAttached) {
            this._storageListenerAttached = true;
            const self = this;
            window.addEventListener('storage', function (event) {
                // Only react to our broadcast keys: 'cs-broadcast-{env}'
                if (!event.key || event.key.indexOf('cs-broadcast-') !== 0) return;
                if (!event.newValue) return; // ignore deletes

                let payload;
                try {
                    payload = JSON.parse(event.newValue);
                } catch (e) { return; }

                if (!payload || typeof payload.ns !== 'string') return;

                // Debounce per-ns (если несколько quick mutations) — 500ms (per CONTEXT.md decision)
                if (self._broadcastDebounceMap[payload.ns]) {
                    clearTimeout(self._broadcastDebounceMap[payload.ns]);
                }
                self._broadcastDebounceMap[payload.ns] = setTimeout(function () {
                    self.clearCacheNamespace(payload.ns);
                    if (self._lastKnownNsTs) {
                        delete self._lastKnownNsTs[payload.ns];
                    }
                    delete self._broadcastDebounceMap[payload.ns];
                    // Phase 67 SYNC-FIX-03: notify page-level subscribers (parity с SyncManager TS_UPDATED handler)
                    try {
                        window.dispatchEvent(new CustomEvent('cs-ts-updated', {
                            detail: { ns: payload.ns, ts: payload.ts, source: 'storage-fallback' }
                        }));
                    } catch (e) { /* graceful */ }
                }, 500);
            });
        }

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
        const authData = sessionStorage.getItem('cloud-auth');
        if (!authData) return null;

        try {
            const auth = JSON.parse(authData);

            // Проверяем срок токена (~58 минут, Silent Refresh обновляет автоматически)
            // Используем TokenManager.TOKEN_LIFETIME если доступен, иначе 3500000 (~58 мин)
            const tokenLifetime = (typeof TokenManager !== 'undefined' && TokenManager.TOKEN_LIFETIME)
                ? TokenManager.TOKEN_LIFETIME
                : 3500000;
            if (Date.now() - auth.timestamp > tokenLifetime) {
                sessionStorage.removeItem('cloud-auth');
                return null;
            }

            return auth;
        } catch (e) {
            sessionStorage.removeItem('cloud-auth');
            return null;
        }
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
     *
     * @param {string} action - имя GAS action
     * @param {Object} params - параметры запроса
     * @param {number} retryCount - текущий счётчик retry (internal)
     * @param {boolean} usePost - использовать POST с JSON body
     * @param {Object} options - Phase 22 BFIX-12: дополнительные опции (например, options.signal — AbortSignal)
     */
    async callApi(action, params = {}, retryCount = 0, usePost = false, options = {}) {
        if (!this.isOnline) {
            throw new Error('Нет подключения к интернету');
        }

        const accessToken = this.getAccessToken();
        if (!accessToken) {
            // Токен истёк или отсутствует - редирект на логин
            this.redirectToLogin();
            // Halt execution — page is navigating away
            throw Object.assign(new Error('auth_redirect'), { _silentRedirect: true });
        }

        // Global rate-limit cooldown: ждём оставшееся время если были rate-limited
        const cooldownRemaining = this._rateLimitCooldownUntil - Date.now();
        if (cooldownRemaining > 0) {
            console.warn(`CloudStorage: Rate limit cooldown, waiting ${Math.ceil(cooldownRemaining / 1000)}s...`);
            await this.sleep(cooldownRemaining);
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

            // keepalive limits body to ~64KB — skip for POST with large payloads
            if (!usePost) fetchOptions.keepalive = true;
            // Phase 22 BFIX-12: thread AbortSignal для устранения orphaned promise toasts
            if (options && options.signal) fetchOptions.signal = options.signal;
            const response = await fetch(url.toString(), fetchOptions);

            const result = await response.json();

            // Phase 22 (WMACH-04): CONFLICT auto-reload detection
            // Backend returns { error: 'CONFLICT', currentVersion: number, message: '...' }
            // when payload.version !== row.version (optimistic locking conflict).
            // Handler invalidates cache, refetches fresh state, re-applies dirty fields,
            // shows Toast.warning. Caller catches Error('CONFLICT') silently via _conflictHandled flag.
            if (result && result.error === 'CONFLICT' && typeof result.currentVersion === 'number') {
                try {
                    await this._handleConflict(action, params, result);
                } catch (handlerErr) {
                    console.warn('[CloudStorage] CONFLICT handler failed:', handlerErr);
                }
                const conflictErr = new Error('CONFLICT');
                conflictErr._conflictHandled = true;
                conflictErr.currentVersion = result.currentVersion;
                throw conflictErr;
            }

            if (result.error) {
                // Токен истёк или невалиден — помечаем для редиректа
                const errMsg = result.error;
                if (errMsg.includes('Invalid access token') || errMsg.includes('token expired') || errMsg.includes('Token expired')) {
                    const err = new Error(errMsg);
                    err._authRedirect = true;
                    throw err;
                }
                throw new Error(errMsg);
            }

            return result;
        };

        try {
            // Выполняем запрос через очередь
            return await this.enqueueRequest(executeApiRequest);
        } catch (error) {
            // Токен невалиден — редирект на логин без retry
            if (error._authRedirect) {
                this.redirectToLogin();
                // Halt execution — page is navigating away
                throw Object.assign(new Error('auth_redirect'), { _silentRedirect: true });
            }

            // Retry logic with exponential backoff
            const errorMsg = error.message || '';
            const isRateLimit = errorMsg.includes('Rate limit');

            // Если rate limit — устанавливаем глобальный cooldown на 30 секунд
            if (isRateLimit) {
                this._rateLimitCooldownUntil = Date.now() + 30000;
            }

            // GAS transient: 404 на script.googleusercontent.com redirect возвращает HTML вместо JSON
            // → SyntaxError "Unexpected token '<'". Это известная проблема Google Apps Script.
            const isTransientGasHtmlError = errorMsg.includes("Unexpected token '<'") ||
                                            errorMsg.includes('is not valid JSON') ||
                                            errorMsg.includes('<!DOCTYPE');
            // BFIX (audit 2026-05-20): GAS 500 "Internal server error" тоже транзитный —
            // sheet lock contention после write, concurrent deploy, quota spike, etc.
            // Retry с backoff даёт backend'у восстановиться. После exhaust → warn (не error).
            const isTransientGas500 = errorMsg.includes('Internal server error');

            const isRetryable = isRateLimit ||
                               errorMsg.includes('Failed to fetch') ||
                               errorMsg.includes('NetworkError') ||
                               errorMsg.includes('timeout') ||
                               isTransientGasHtmlError ||
                               isTransientGas500 ||
                               error.name === 'TypeError';

            if (isRetryable && retryCount < this.MAX_RETRIES) {
                const baseDelay = isRateLimit ? 2000 : this.INITIAL_DELAY;
                const delay = baseDelay * Math.pow(2, retryCount);
                if (!isTransientGasHtmlError && !isTransientGas500) {
                    console.warn(`CloudStorage: Retry ${retryCount + 1}/${this.MAX_RETRIES} after ${delay}ms${isRateLimit ? ' (rate limit)' : ''}...`);
                }
                await this.sleep(delay);
                return this.callApi(action, params, retryCount + 1, usePost, options);
            }

            // Phase 44 fix: CONFLICT errors handled silently by _handleConflict (Toast + reload)
            // — не загрязнять console.error для expected optimistic-locking conflicts.
            // Также silent для transient GAS 404→HTML errors (известная проблема, retry exhausted).
            // BFIX (audit 2026-05-20): transient 500 после exhaust → warn (не error) —
            // alarm в DevTools console красным цветом избыточен для известных GAS капризов.
            if (!(error && error._conflictHandled) && !isTransientGasHtmlError && !isTransientGas500) {
                console.error('CloudStorage API error:', error);
            } else if (isTransientGas500) {
                console.warn('CloudStorage: transient 500 после ' + this.MAX_RETRIES + ' retries:', errorMsg);
            }

            const errorMessage = error.message || String(error);

            // Permission denied — роль могла смениться, принудительно перепроверяем
            // Ожидаем завершения ревалидации (RoleGuard может сделать редирект)
            // Деdup: делимся промисом если ревалидация уже запущена
            if (errorMessage.includes('Permission denied') && typeof RoleGuard !== 'undefined') {
                if (!this._revalidatingPromise) {
                    this._revalidatingPromise = RoleGuard.revalidateInBackground()
                        .finally(() => { this._revalidatingPromise = null; });
                }
                await this._revalidatingPromise;
            }

            // Если Access denied - пользователь удалён из системы, разлогиниваем
            if (errorMessage.includes('Access denied') || errorMessage.includes('User not found')) {
                if (typeof Toast !== 'undefined') {
                    Toast.error('Доступ запрещён. Ваш аккаунт не найден в системе.');
                }
                // Очищаем данные и редиректим на login
                sessionStorage.removeItem('cloud-auth');
                localStorage.removeItem('roleGuard');
                setTimeout(() => {
                    if (typeof AuthGuard !== 'undefined') {
                        AuthGuard.redirectToLogin();
                    } else {
                        // Определяем базовый путь динамически (как AuthGuard.getBasePath)
                        const pathMatch = window.location.pathname.match(/^\/([^\/]+)\//);
                        const basePath = pathMatch ? '/' + pathMatch[1] : '';
                        window.location.href = basePath + '/login/index.html';
                    }
                }, 1500);
            }

            throw error;
        }
    },

    /**
     * POST запрос для больших данных (использует POST с JSON body)
     * @param {string} action - имя GAS action
     * @param {Object} data - данные запроса
     * @param {Object} options - Phase 22 BFIX-12: дополнительные опции (например, options.signal — AbortSignal)
     */
    async postApi(action, data, options = {}) {
        return this.callApi(action, data, 0, true, options);
    },

    // ============ CACHE (localStorage с fallback в память) ============

    /**
     * Получение из кэша (localStorage → memory fallback)
     * Phase 62 (CACHE-01): валидация envelope version (Pitfall #4 cache poisoning prevention).
     * Возвращает raw data (не envelope) — callers ожидают данные как раньше.
     */
    getFromCache(key) {
        // Phase 66 (METRICS-02): namespace для byNs counter (extracted ONCE)
        const _statsNs = this._extractNsFromKey(key);
        // Пробуем localStorage
        try {
            const raw = localStorage.getItem(this.CACHE_PREFIX + key);
            if (raw) {
                const cached = JSON.parse(raw);
                // Pitfall #4 prevention: проверяем версию envelope
                if (cached.v !== this.CACHE_VERSION) {
                    // v2.35 envelope (нет поля v) или future version mismatch — auto-invalidate
                    localStorage.removeItem(this.CACHE_PREFIX + key);
                    this._incCacheStat('misses', _statsNs);
                    return null;
                }
                const age = Date.now() - cached.timestamp;
                if (age <= this.STALE_MAX_AGE) {
                    if (age > this.CACHE_TTL) {
                        this._staleKeys.add(key);
                    }
                    this._incCacheStat('hits', _statsNs);
                    return cached.data;
                }
                localStorage.removeItem(this.CACHE_PREFIX + key);
                this._incCacheStat('misses', _statsNs);
                return null;
            }
        } catch (e) {
            // localStorage недоступен — пробуем memory
        }

        // Fallback: in-memory кеш (тоже versioned)
        const memCached = this.cache[key];
        if (!memCached) {
            this._incCacheStat('misses', _statsNs);
            return null;
        }
        if (memCached.v !== this.CACHE_VERSION) {
            delete this.cache[key];
            this._incCacheStat('misses', _statsNs);
            return null;
        }
        const age = Date.now() - memCached.timestamp;
        if (age > this.STALE_MAX_AGE) {
            delete this.cache[key];
            this._incCacheStat('misses', _statsNs);
            return null;
        }
        if (age > this.CACHE_TTL) {
            this._staleKeys.add(key);
        }
        this._incCacheStat('hits', _statsNs);
        return memCached.data;
    },

    /**
     * Сохранение в кэш (localStorage с fallback в память)
     * Phase 62 (CACHE-02): envelope shape {v, data, nsTs, timestamp}.
     * Backward compat: callers без 3rd arg → nsTs undefined (сохраняется как есть).
     * @param {string} key
     * @param {*} data
     * @param {number} [nsTs] - server-returned namespace timestamp (epoch ms)
     */
    setCache(key, data, nsTs) {
        const entry = {
            v: this.CACHE_VERSION,
            data: data,
            nsTs: nsTs,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(entry));
        } catch (e) {
            // localStorage переполнен — используем memory
            this.cache[key] = entry;
        }
    },

    /**
     * Построение составного ключа кэша на основе параметров запроса
     * @param {string} entity - имя сущности (partners, employees, auditLog и т.д.)
     * @param {Object} [options] - параметры пагинации и фильтрации
     * @returns {string} составной ключ для использования в setCache/getFromCache
     */
    _buildCacheKey(entity, options) {
        if (!options || typeof options !== 'object') return entity;
        const { page, pageSize, filter, filterStatus, sortBy, order, cursor, dateFrom, dateTo, actor, action } = options;
        // Нет параметров пагинации — backward compat базовый ключ
        if (page === undefined && pageSize === undefined && !filter && !filterStatus && !sortBy && !cursor && !dateFrom && !dateTo && !actor && !action) {
            return entity;
        }
        let key = entity;
        if (page !== undefined)     key += ':p' + page;
        if (pageSize !== undefined) key += ':ps' + pageSize;
        if (cursor)                 key += ':cursor=' + cursor;
        if (filter)                 key += ':f=' + filter;
        if (dateFrom || dateTo || actor) {
            const parts = [dateFrom || '', dateTo || '', actor || ''].filter(Boolean).join('-');
            if (parts) key += ':f=' + parts;
        }
        if (filterStatus)           key += ':fs=' + filterStatus;
        if (action)                 key += ':act=' + action;
        if (sortBy)                 key += ':s=' + sortBy + ':' + (order || 'asc');
        return key;
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

    /**
     * Инвалидация всех записей кэша для заданного namespace (префикса)
     * Удаляет совпадающие ключи из localStorage, in-memory cache, pendingRequests и _staleKeys
     * @param {string} prefix - префикс namespace (например 'partners', 'employees')
     */
    clearCacheNamespace(prefix) {
        const fullPrefix = this.CACHE_PREFIX + prefix;
        // 1. localStorage — собираем ключи сначала, потом удаляем (избегаем смещения индексов)
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(fullPrefix)) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) { /* localStorage недоступен */ }

        // 2. in-memory кэш (ключи хранятся БЕЗ CACHE_PREFIX)
        for (const k of Object.keys(this.cache)) {
            if (k.startsWith(prefix)) {
                delete this.cache[k];
            }
        }

        // 3. pendingRequests Map (ключи хранятся БЕЗ CACHE_PREFIX)
        for (const k of this.pendingRequests.keys()) {
            if (k.startsWith(prefix)) {
                this.pendingRequests.delete(k);
            }
        }

        // 4. _staleKeys Set
        for (const k of this._staleKeys) {
            if (k.startsWith(prefix)) {
                this._staleKeys.delete(k);
            }
        }
    },

    // ============ PHASE 62 (CACHE-03): NAMESPACE TIMESTAMP MAP ============

    /**
     * TS prefix для localStorage keys (env-aware, parallel to CACHE_PREFIX).
     * Format: 'cs-ts-{env}-' (e.g. 'cs-ts-prod-', 'cs-ts-test-').
     */
    get TS_PREFIX() {
        const env = typeof EnvConfig !== 'undefined' ? EnvConfig.getCurrentEnv() : 'default';
        return 'cs-ts-' + env + '-';
    },

    /**
     * Чтение namespace timestamp — сначала из in-memory карты, затем из localStorage.
     * @param {string} ns - namespace (например 'partners')
     * @returns {number|undefined} epoch ms или undefined если ts не установлен
     */
    _readNsTs(ns) {
        if (this._lastKnownNsTs[ns] !== undefined) {
            return this._lastKnownNsTs[ns];
        }
        try {
            const raw = localStorage.getItem(this.TS_PREFIX + ns);
            if (raw) {
                const ts = parseInt(raw, 10);
                if (Number.isFinite(ts) && ts > 0) {
                    this._lastKnownNsTs[ns] = ts;
                    return ts;
                }
            }
        } catch (e) { /* localStorage недоступен */ }
        return undefined;
    },

    /**
     * Запись namespace timestamp в обе локации (in-memory + localStorage).
     * Graceful: invalid ts (NaN, negative, undefined, non-number) игнорируется (Pitfall #4).
     * @param {string} ns - namespace
     * @param {number} ts - epoch ms (server-returned)
     */
    /**
     * Phase 65 (MULTI-TAB-03): unified mutation post-write hook —
     * (1) обновить _writeNsTs locally, (2) clearCacheNamespace, (3) broadcast TS_UPDATED other tabs.
     * Используется в каждом addX/updateX/deleteX после API success.
     *
     * @param {string} ns - namespace ('partners', 'employees', etc)
     * @param {number} [ts] - server-returned ts; fallback Date.now() если backend omits
     */
    _onMutationSuccess(ns, ts) {
        const effectiveTs = (typeof ts === 'number' && Number.isFinite(ts)) ? ts : Date.now();
        if (typeof this._writeNsTs === 'function') {
            this._writeNsTs(ns, effectiveTs);
        }
        this.clearCacheNamespace(ns);
        if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
            SyncManager.sendTsUpdate(ns, effectiveTs);
        }
    },

    _writeNsTs(ns, ts) {
        if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) {
            return; // graceful: ignore invalid ts
        }
        this._lastKnownNsTs[ns] = ts;
        try {
            localStorage.setItem(this.TS_PREFIX + ns, String(ts));
        } catch (e) { /* localStorage переполнен — in-memory only */ }
    },

    /**
     * Сидинг _lastKnownNsTs из localStorage при старте.
     * Итерирует все keys с TS_PREFIX, парсит ts значения в _lastKnownNsTs map.
     */
    _loadNsTsFromLocalStorage() {
        try {
            const prefix = this.TS_PREFIX;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(prefix)) {
                    const ns = k.slice(prefix.length);
                    const ts = parseInt(localStorage.getItem(k), 10);
                    if (Number.isFinite(ts) && ts > 0) {
                        this._lastKnownNsTs[ns] = ts;
                    }
                }
            }
        } catch (e) {
            // graceful: localStorage недоступен / corrupt — стартуем с пустой картой
            this._lastKnownNsTs = {};
        }
    },

    /**
     * Phase 66 (METRICS-02): инициализация window.__cacheStats observability surface.
     * Idempotent — safe to call повторно (preserves existing counters если уже initialized).
     * Pitfall #4 prevention: даже если CACHE_VERSION mismatch очистил envelopes — counter init OK.
     */
    _initCacheStats() {
        if (this._cacheStatsInitialized) return;
        if (typeof window === 'undefined') return;  // SSR / test environment guard
        if (!window.__cacheStats) {
            window.__cacheStats = {
                hits: 0,
                misses: 0,
                deltas: 0,
                fullRefetches: 0,
                conditionalHits: 0,
                byNs: {}
            };
        }
        this._cacheStatsInitialized = true;
    },

    /**
     * Phase 66 (METRICS-02): increment helper — flat counter + per-ns counter.
     * Fire-and-forget — try/catch protects от crash если window недоступен.
     */
    _incCacheStat(metric, ns) {
        try {
            if (typeof window === 'undefined' || !window.__cacheStats) return;
            window.__cacheStats[metric] = (window.__cacheStats[metric] || 0) + 1;
            if (ns) {
                if (!window.__cacheStats.byNs[ns]) {
                    window.__cacheStats.byNs[ns] = {
                        hits: 0, misses: 0, deltas: 0, fullRefetches: 0, conditionalHits: 0
                    };
                }
                window.__cacheStats.byNs[ns][metric] = (window.__cacheStats.byNs[ns][metric] || 0) + 1;
            }
        } catch (e) {
            // observability never crashes app
        }
    },

    /**
     * Phase 66 (METRICS-02): extract namespace из cache key для byNs grouping.
     * Cache keys: "partners", "partners:p1:s10", "employees", "auditLog:cursor:..."
     * Returns base ns (everything before first ":").
     */
    _extractNsFromKey(key) {
        if (!key || typeof key !== 'string') return null;
        const colonIdx = key.indexOf(':');
        return colonIdx === -1 ? key : key.substring(0, colonIdx);
    },

    /**
     * Phase 62 (CACHE-04): merge server delta в текущий cached array.
     *
     * Алгоритм:
     * 1. Build deletedSet из deletedIds (O(1) lookup)
     * 2. Build deltaMap из deltaArr keyed by identityKey (O(1) lookup)
     * 3. Filter currentArr: drop items в deletedSet
     * 4. Map remaining: replace items present в deltaMap with delta version
     * 5. Append deltaArr items NOT в currentArr (new records)
     *
     * @param {Array} currentArr - текущий cached array (например cached partners)
     * @param {Array} deltaArr - server delta array (changed records since clientTs)
     * @param {Array<string>} deletedIds - tombstone deletedIds (records to remove)
     * @param {string} [identityKey='id'] - имя поля как identity (default 'id')
     * @returns {Array} merged result (НЕ мутирует inputs)
     */
    _mergeDelta(currentArr, deltaArr, deletedIds, identityKey) {
        identityKey = identityKey || 'id';
        const currentSafe = Array.isArray(currentArr) ? currentArr : [];
        const deltaSafe = Array.isArray(deltaArr) ? deltaArr : [];
        const deletedSafe = Array.isArray(deletedIds) ? deletedIds : [];

        const deletedSet = new Set(deletedSafe);
        const deltaMap = new Map();
        deltaSafe.forEach(item => {
            if (item && item[identityKey] !== undefined) {
                deltaMap.set(item[identityKey], item);
            }
        });

        // Phase 65 (OPTIMISTIC-01): MergeGuard — skip server-side update for items с pending optimistic ops.
        // Если OptimisticManager.isPendingGlobal(id) === true → keep current item (preserve dirty/optimistic state).
        // Backwards compat: если OptimisticManager не loaded (e.g. login pages) → skip check, full merge as before.
        const optimisticAvailable = (typeof OptimisticManager !== 'undefined'
            && typeof OptimisticManager.isPendingGlobal === 'function');

        // Filter deleted + replace updated — но SKIP replacement / dropping для pending items
        const result = currentSafe
            .filter(item => {
                if (!item) return false;
                const id = item[identityKey];
                // Phase 65: NEVER drop pending items даже если в deletedSet — preserve user state
                if (deletedSet.has(id) && optimisticAvailable && OptimisticManager.isPendingGlobal(id)) {
                    return true; // keep — pending op в полёте, нельзя dropping
                }
                return !deletedSet.has(id);
            })
            .map(item => {
                const id = item[identityKey];
                // Phase 65: SKIP server replacement если у item есть pending op
                if (optimisticAvailable && OptimisticManager.isPendingGlobal(id)) {
                    return item; // preserve current (optimistic state), ignore delta
                }
                return deltaMap.has(id) ? deltaMap.get(id) : item;
            });

        // Append new items (в delta но не в current)
        const currentIds = new Set(currentSafe.map(item => item && item[identityKey]));
        deltaSafe.forEach(item => {
            if (item && item[identityKey] !== undefined && !currentIds.has(item[identityKey])) {
                result.push(item);
            }
        });

        return result;
    },

    // ============ PHASE 22 (WMACH-04): CONFLICT HANDLER ============

    /**
     * Phase 22 (WMACH-04): обработчик CONFLICT-ответа от backend.
     *
     * Backend (Plan 22-04) возвращает { error: 'CONFLICT', currentVersion, message }
     * когда payload.version !== row.version (optimistic locking conflict).
     *
     * Flow:
     * 1. Snapshot dirty data через OnboardingForm.collectFormData ДО invalidate cache (Phase 21 mechanism)
     * 2. Capture dirtyFields через OnboardingForm.getDirtyFields()
     * 3. clearCacheNamespace('onboardingRequests') — invalidate composite cache
     * 4. Refetch через OnboardingList.goToOnboardingPage(currentPage)
     * 5. Re-apply dirty values поверх freshRequest.stageData[currentStep] (Set membership)
     * 6. OnboardingForm.render(freshRequest, currentStep) — Phase 21 wrap merges DOM data
     * 7. Toast.warning «Карточка изменена…» (5s)
     *
     * Defensive: каждый шаг защищён typeof check + try/catch — handler не должен падать
     * если onboarding-модуль не загружен (другие страницы вызывают callApi для других entities).
     *
     * Caller обрабатывает Error('CONFLICT') с _conflictHandled: true silently
     * (без duplicate Toast.error).
     *
     * @param {string} action - имя GAS action (для логирования)
     * @param {Object} params - параметры запроса (для логирования)
     * @param {Object} response - { error: 'CONFLICT', currentVersion, message }
     */
    async _handleConflict(action, params, response) {
        // Capture dirty state BEFORE invalidating cache (Phase 21 mechanism)
        let dirtySnapshot = null;
        let dirtyFields = null;
        let currentRequestId = null;
        let currentStep = null;

        if (typeof OnboardingState !== 'undefined' && typeof OnboardingForm !== 'undefined') {
            try {
                const currentReq = OnboardingState.get('currentRequest');
                if (currentReq) {
                    currentRequestId = currentReq.id;
                    currentStep = OnboardingState.get('currentStep') || currentReq.currentStep;
                    if (OnboardingForm.collectFormData) {
                        dirtySnapshot = OnboardingForm.collectFormData(currentStep, { excludeFiles: true });
                    }
                    if (OnboardingForm.getDirtyFields) {
                        dirtyFields = new Set(OnboardingForm.getDirtyFields());
                    }
                }
            } catch (_) { /* defensive — capture не должен ломать reload */ }
        }

        // Invalidate composite cache (verified key: onboardingRequests namespace)
        this.clearCacheNamespace('onboardingRequests');

        // Refetch via existing pagination mechanism (same path as polling)
        if (typeof OnboardingList !== 'undefined' && OnboardingList.goToOnboardingPage) {
            const currentPage = OnboardingList.getCurrentPage ? OnboardingList.getCurrentPage() : 1;
            try {
                await OnboardingList.goToOnboardingPage(currentPage);
            } catch (_) { /* defensive — re-fetch может не быть доступен */ }

            // Re-apply dirty values поверх fresh data
            // VERIFIED OnboardingState key: 'requests' (grep confirmed: 'currentRequest', 'requests', 'history')
            if (dirtyFields && dirtyFields.size > 0 && dirtySnapshot && currentRequestId &&
                typeof OnboardingState !== 'undefined') {
                try {
                    const requests = OnboardingState.get('requests') || [];
                    const fresh = requests.find(r => r.id === currentRequestId);
                    if (fresh) {
                        if (!fresh.stageData) fresh.stageData = {};
                        if (!fresh.stageData[currentStep]) fresh.stageData[currentStep] = {};
                        dirtyFields.forEach(fieldId => {
                            if (fieldId in dirtySnapshot) {
                                fresh.stageData[currentStep][fieldId] = dirtySnapshot[fieldId];
                            }
                        });
                        // Update currentRequest reference + re-render via Phase 21 collectFormData wrap
                        if (OnboardingState.set) {
                            OnboardingState.set('currentRequest', fresh);
                        }
                        if (typeof OnboardingForm !== 'undefined' && OnboardingForm.render) {
                            OnboardingForm.render(fresh, currentStep);
                        }
                    }
                } catch (_) { /* defensive — re-apply не должен ломать Toast */ }
            }
        }

        // User-visible warning (5s — per CONTEXT.md decision)
        if (typeof Toast !== 'undefined' && Toast.warning) {
            Toast.warning('Карточка изменена другим пользователем. Обновлено автоматически. Ваши правки сохранены', 5000);
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
     * @param {Object|boolean} options - опции запроса: {page, pageSize, filter, sortBy, order, useCache}
     *        boolean поддерживается для обратной совместимости (migration shim)
     */
    async getPartners(options) {
        // Migration shim для boolean вызовов (обратная совместимость)
        if (typeof options === 'boolean') { options = { useCache: options }; }
        if (!options || typeof options !== 'object') { options = {}; }

        const useCache = options.useCache !== false;
        const cacheKey = this._buildCacheKey('partners', options);

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                if (this._staleKeys.delete(cacheKey)) {
                    this.getPartners({ ...options, useCache: false }).catch(() => {});
                }
                return cached;
            }
        }

        // Предотвращение race condition: возвращаем существующий Promise если запрос уже в процессе
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                // Phase 62 (CACHE-05): собираем API params + thread clientTs из _lastKnownNsTs
                const apiParams = {};
                if (options.page !== undefined) apiParams.page = options.page;
                if (options.pageSize !== undefined) apiParams.pageSize = options.pageSize;
                if (options.filter !== undefined) apiParams.filter = options.filter;
                if (options.sortBy !== undefined) { apiParams.sortBy = options.sortBy; apiParams.order = options.order || 'asc'; }

                // CACHE-05 / TS-PROTO-01: send clientTs только если known
                // (cold cache → omit → backend full refetch path = existing v2.35 behavior)
                // Phase 66.1 (FRONTEND-REQUIREFULLREFETCH-MISSING): skip clientTs при _forceFullRefetch
                const hasCacheForKey = this.getFromCache(cacheKey) != null;
                // list views: всегда full — conditional-GET/delta давал интермиттентную потерю строк (см. sort-rowloss-repro.spec.js)
                const isPaginated = options.page !== undefined || options.pageSize !== undefined;
                const clientTs = (options._forceFullRefetch || isPaginated || !hasCacheForKey) ? undefined : this._readNsTs('partners');
                if (clientTs !== undefined) {
                    apiParams.clientTs = clientTs;
                }

                const result = await this.callApi('getPartners', apiParams);

                // CACHE-05: capture server ts FIRST (до branching на shape)
                if (result && typeof result.ts === 'number') {
                    this._writeNsTs('partners', result.ts);
                }

                // Phase 66.1 (FRONTEND-REQUIREFULLREFETCH-MISSING + TOMBSTONE-04): backend сигналит
                // requireFullRefetch:true для stale clients (>30d tombstone GC window) — нужно
                // полностью сбросить cache + nsTs и перезапросить без clientTs
                if (result && result.requireFullRefetch === true && !options._forceFullRefetch) {
                    delete this._lastKnownNsTs.partners;
                    this.clearCacheNamespace('partners');
                    return this.getPartners({ ...options, _forceFullRefetch: true, useCache: false });
                }

                // Phase 62 (TS-PROTO-02): handle 3 response shapes

                // Phase 65 (OPTIMISTIC-02): если есть pending optimistic writes для этого ns,
                // НЕ доверяем notModified short-circuit (server могла обновить smth pending'ом overlapping).
                // Force fall-through к full data path для conflict detection.
                const pendingCountForNs = (typeof OptimisticManager !== 'undefined'
                    && typeof OptimisticManager.getPendingCountGlobal === 'function')
                    ? OptimisticManager.getPendingCountGlobal('partners')
                    : 0;

                // Shape A: {notModified: true, ts} — short-circuit, return cached data
                if (result && result.notModified === true && pendingCountForNs === 0) {
                    this._incCacheStat('conditionalHits', 'partners');
                    const cachedData = this.getFromCache(cacheKey);
                    if (cachedData) {
                        return cachedData;
                    }
                    // Edge case: notModified но cache empty — возвращаем пустой envelope
                    const isPaginatedEmpty = options.page !== undefined || options.pageSize !== undefined;
                    return isPaginatedEmpty
                        ? { partners: [], totalCount: 0, page: options.page || 1, pageSize: options.pageSize || 0 }
                        : [];
                }

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

                // Shape C: {partners: [delta], deletedIds, ts} — apply _mergeDelta
                // Detection: result.deletedIds present (даже если empty array) signals delta response
                const isDelta = result && Array.isArray(result.deletedIds);

                if (isDelta) {
                    this._incCacheStat('deltas', 'partners');
                    const cachedExisting = this.getFromCache(cacheKey);
                    // cachedExisting может быть paginated envelope OR raw array (backward compat)
                    const existingArr = Array.isArray(cachedExisting)
                        ? cachedExisting
                        : (cachedExisting && Array.isArray(cachedExisting.partners) ? cachedExisting.partners : []);
                    const merged = this._mergeDelta(existingArr, partners, result.deletedIds, 'id');

                    const isPaginatedDelta = options.page !== undefined || options.pageSize !== undefined;
                    if (isPaginatedDelta) {
                        const envelope = {
                            partners: merged,
                            totalCount: result.totalCount !== undefined ? result.totalCount : merged.length,
                            page: result.page || options.page || 1,
                            pageSize: result.pageSize || options.pageSize || merged.length
                        };
                        this.setCache(cacheKey, envelope, result.ts);
                        return envelope;
                    }
                    this.setCache(cacheKey, merged, result.ts);
                    return merged;
                }

                // Shape B: {partners, totalCount, ...} — existing full data path
                this._incCacheStat('fullRefetches', 'partners');
                if (isPaginated) {
                    const envelope = {
                        partners,
                        totalCount: result.totalCount || partners.length,
                        page: result.page || options.page || 1,
                        pageSize: result.pageSize || options.pageSize || partners.length
                    };
                    this.setCache(cacheKey, envelope, result.ts);
                    return envelope;
                }

                // Unpaginated: объединяем с локальными несинхронизированными (backward compat)
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

                this.setCache(cacheKey, partners, result.ts);
                return partners;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        })();

        this.pendingRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    /**
     * Добавить партнёра
     * Phase 62 (TS-PROTO-04): после успешной mutation — capture server ts
     * чтобы next read мог short-circuit через conditional GET.
     */
    async addPartner(data) {
        const result = await this.callApi('addPartner', { data: data });
        this.clearCacheNamespace('partners');
        // Phase 62 (TS-PROTO-04): capture server ts so next read can short-circuit
        const ts = (result && typeof result.ts === 'number') ? result.ts : Date.now();
        this._writeNsTs('partners', ts);
        // Phase 65 (MULTI-TAB-03): broadcast TS_UPDATED to other tabs after mutation success
        if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
            SyncManager.sendTsUpdate('partners', ts);
        }
        return result;
    },

    /**
     * Обновить партнёра
     * Phase 62 (TS-PROTO-04): после успешной mutation — capture server ts.
     */
    async updatePartner(id, data) {
        const result = await this.callApi('updatePartner', { id: id, data: data });
        this.clearCacheNamespace('partners');
        // Phase 62 (TS-PROTO-04): capture server ts so next read can short-circuit
        const ts = (result && typeof result.ts === 'number') ? result.ts : Date.now();
        this._writeNsTs('partners', ts);
        // Phase 65 (MULTI-TAB-03): broadcast TS_UPDATED to other tabs after mutation success
        if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
            SyncManager.sendTsUpdate('partners', ts);
        }
        return result;
    },

    /**
     * Удалить партнёра
     * Phase 62 (TS-PROTO-05): backend пишет _Tombstones row + bumps nsTs;
     * frontend captures ts, next read получит tombstone через deletedIds delta path.
     */
    async deletePartner(id) {
        const result = await this.callApi('deletePartner', { id: id });
        this.clearCacheNamespace('partners');
        // Phase 62 (TS-PROTO-05): backend writes _Tombstones row + bumps nsTs;
        // capture so next read receives the tombstone via deletedIds delta path
        const ts = (result && typeof result.ts === 'number') ? result.ts : Date.now();
        this._writeNsTs('partners', ts);
        // Phase 65 (MULTI-TAB-03): broadcast TS_UPDATED to other tabs after mutation success
        if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
            SyncManager.sendTsUpdate('partners', ts);
        }
        return result;
    },

    // ============ ENTITY FACTORY (QWIN-04) ============

    /**
     * Создаёт CRUD API объект для простой non-paginated entity.
     * Используется для Methods + Templates. НЕ применять к Partners/Employees/Onboarding —
     * они имеют composite cache + pagination + customFields parsing (out of scope, см. CONTEXT.md QWIN-04).
     *
     * Returned API:
     *   getAll(useCache=true) — кешированный getEntity список (массив)
     *   save(data)            — Methods: data.id → updateMethod, без id → addMethod
     *                           Templates: всегда saveTemplate (backend имеет один endpoint)
     *   delete(id)            — deleteEntity + clearCache
     *
     * @param {string} entityName - 'method' | 'template' (singular, lowercase)
     * @returns {{getAll: Function, save: Function, delete: Function}}
     */
    _createEntityApi(entityName) {
        const cap = entityName.charAt(0).toUpperCase() + entityName.slice(1);
        const cacheKey = entityName + 's'; // 'methods', 'templates'
        const self = this;

        // Templates имеет один endpoint saveTemplate; Methods имеет add/update split
        const useUnifiedSave = entityName === 'template';

        return {
            async getAll(useCache = true, _forceFullRefetch = false) {
                if (useCache) {
                    const cached = self.getFromCache(cacheKey);
                    if (cached) {
                        if (self._staleKeys && self._staleKeys.delete(cacheKey)) {
                            this.getAll(false).catch(() => {});
                        }
                        return cached;
                    }
                }
                // Phase 63 (TS-PROTO-06, CACHE-06): thread clientTs from _lastKnownNsTs[cacheKey]
                // Phase 66.1: skip clientTs при _forceFullRefetch (после requireFullRefetch retry)
                const apiParams = {};
                const clientTs = (!_forceFullRefetch && typeof self._readNsTs === 'function') ? self._readNsTs(cacheKey) : undefined;
                if (clientTs !== undefined) {
                    apiParams.clientTs = clientTs;
                }
                const result = await self.callApi('get' + cap + 's', apiParams);

                // Capture server ts FIRST (single source of truth)
                if (result && typeof result.ts === 'number' && typeof self._writeNsTs === 'function') {
                    self._writeNsTs(cacheKey, result.ts);
                }

                // Phase 66.1 (FRONTEND-REQUIREFULLREFETCH-MISSING): handler stale clients (>30d tombstone GC window)
                if (result && result.requireFullRefetch === true && !_forceFullRefetch) {
                    if (self._lastKnownNsTs) delete self._lastKnownNsTs[cacheKey];
                    self.clearCacheNamespace(cacheKey);
                    return this.getAll(false, true);
                }

                // Phase 65 (OPTIMISTIC-02): skip notModified short-circuit когда есть pending writes для ns
                const pendingCountForFactoryNs = (typeof OptimisticManager !== 'undefined'
                    && typeof OptimisticManager.getPendingCountGlobal === 'function')
                    ? OptimisticManager.getPendingCountGlobal(cacheKey)
                    : 0;

                // Shape A (notModified) — return cached or empty array
                if (result && result.notModified === true && pendingCountForFactoryNs === 0) {
                    self._incCacheStat('conditionalHits', cacheKey);
                    const cachedAgain = self.getFromCache(cacheKey);
                    return cachedAgain || [];
                }

                // Shape B (full refetch) — settings full refetch path; NO _mergeDelta
                self._incCacheStat('fullRefetches', cacheKey);
                const items = result[cacheKey] || [];
                self.setCache(cacheKey, items, result && typeof result.ts === 'number' ? result.ts : undefined);
                return items;
            },

            async save(data) {
                let action;
                let params;
                if (useUnifiedSave) {
                    action = 'save' + cap;
                    params = { data: data };
                } else if (data && data.id) {
                    action = 'update' + cap;
                    params = { id: data.id, data: data };
                } else {
                    action = 'add' + cap;
                    params = { data: data };
                }
                const result = await self.callApi(action, params);
                self.clearCache(cacheKey);
                // Phase 63 (TS-PROTO-06, CACHE-06): capture server ts so next read can short-circuit
                if (typeof self._writeNsTs === 'function') {
                    const ts = (result && typeof result.ts === 'number') ? result.ts : Date.now();
                    self._writeNsTs(cacheKey, ts);
                    // Phase 65 (MULTI-TAB-03): broadcast TS_UPDATED to other tabs after mutation success
                    if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
                        SyncManager.sendTsUpdate(cacheKey, ts);
                    }
                }
                return result;
            },

            async delete(id) {
                const result = await self.callApi('delete' + cap, { id: id });
                self.clearCache(cacheKey);
                // Phase 63 (TS-PROTO-06, CACHE-06): capture server ts
                if (typeof self._writeNsTs === 'function') {
                    const ts = (result && typeof result.ts === 'number') ? result.ts : Date.now();
                    self._writeNsTs(cacheKey, ts);
                    // Phase 65 (MULTI-TAB-03): broadcast TS_UPDATED to other tabs after mutation success
                    if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
                        SyncManager.sendTsUpdate(cacheKey, ts);
                    }
                }
                return result;
            }
        };
    },

    // ============ ENTITY API INSTANCES (QWIN-04) ============

    get methods() {
        if (!this._methodsApi) this._methodsApi = this._createEntityApi('method');
        return this._methodsApi;
    },

    get templates() {
        if (!this._templatesApi) this._templatesApi = this._createEntityApi('template');
        return this._templatesApi;
    },

    // ============ TEMPLATES (aliases since QWIN-04, removed in Phase 27) ============

    /**
     * Получить шаблоны партнёров (alias → this.templates.getAll)
     */
    async getTemplates(useCache = true) {
        return this.templates.getAll(useCache);
    },

    /**
     * Сохранить шаблон (alias → this.templates.save)
     */
    async saveTemplate(data) {
        return this.templates.save(data);
    },

    /**
     * Удалить шаблон (alias → this.templates.delete)
     */
    async deleteTemplate(id) {
        return this.templates.delete(id);
    },

    // ============ METHODS (aliases since QWIN-04, removed in Phase 27) ============

    /**
     * Получить методы партнёров (alias → this.methods.getAll)
     */
    async getMethods(useCache = true) {
        return this.methods.getAll(useCache);
    },

    /**
     * Добавить метод (alias → this.methods.save без data.id → addMethod)
     */
    async addMethod(data) {
        return this.methods.save(data);
    },

    /**
     * Обновить метод (alias → this.methods.save с data.id → updateMethod)
     */
    async updateMethod(id, data) {
        return this.methods.save({ ...data, id: id });
    },

    /**
     * Удалить метод (alias → this.methods.delete)
     */
    async deleteMethod(id) {
        return this.methods.delete(id);
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
    async getEmployees(options) {
        // Migration shim для boolean вызовов (обратная совместимость)
        if (typeof options === 'boolean') { options = { useCache: options }; }
        if (!options || typeof options !== 'object') { options = {}; }

        const useCache = options.useCache !== false;
        const cacheKey = this._buildCacheKey('employees', options);

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                if (this._staleKeys.delete(cacheKey)) {
                    this.getEmployees({ ...options, useCache: false }).catch(() => {});
                }
                return cached;
            }
        }

        // Предотвращение race condition
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                // Phase 63 (TS-PROTO-06): собираем API params + thread clientTs из _lastKnownNsTs
                const apiParams = {};
                if (options.page !== undefined) apiParams.page = options.page;
                if (options.pageSize !== undefined) apiParams.pageSize = options.pageSize;
                if (options.filter !== undefined) apiParams.filter = options.filter;

                // TS-PROTO-06: send clientTs only when warm (cold cache → omit → backend full refetch)
                // Phase 66.1: skip clientTs при _forceFullRefetch (после requireFullRefetch retry)
                const hasCacheForKey = this.getFromCache(cacheKey) != null;
                // list views: всегда full — conditional-GET/delta давал интермиттентную потерю строк (см. sort-rowloss-repro.spec.js)
                const isPaginated = options.page !== undefined || options.pageSize !== undefined;
                const clientTs = (options._forceFullRefetch || isPaginated || !hasCacheForKey) ? undefined : this._readNsTs('employees');
                if (clientTs !== undefined) {
                    apiParams.clientTs = clientTs;
                }

                const result = await this.callApi('getEmployees', apiParams);

                // Capture server ts FIRST (single source of truth)
                if (result && typeof result.ts === 'number') {
                    this._writeNsTs('employees', result.ts);
                }

                // Phase 66.1 (FRONTEND-REQUIREFULLREFETCH-MISSING): handler stale clients
                if (result && result.requireFullRefetch === true && !options._forceFullRefetch) {
                    delete this._lastKnownNsTs.employees;
                    this.clearCacheNamespace('employees');
                    return this.getEmployees({ ...options, _forceFullRefetch: true, useCache: false });
                }

                // Phase 63 (TS-PROTO-06): handle 3 response shapes

                // Phase 65 (OPTIMISTIC-02): skip notModified short-circuit когда есть pending writes
                const pendingCountForEmployees = (typeof OptimisticManager !== 'undefined'
                    && typeof OptimisticManager.getPendingCountGlobal === 'function')
                    ? OptimisticManager.getPendingCountGlobal('employees')
                    : 0;

                // Shape A: {notModified: true, ts} — short-circuit, return cached data
                if (result && result.notModified === true && pendingCountForEmployees === 0) {
                    this._incCacheStat('conditionalHits', 'employees');
                    const cachedData = this.getFromCache(cacheKey);
                    if (cachedData) {
                        return cachedData;
                    }
                    // Edge case: notModified но cache empty
                    const isPaginatedEmpty = options.page !== undefined || options.pageSize !== undefined;
                    return isPaginatedEmpty
                        ? { employees: [], totalCount: 0, page: options.page || 1, pageSize: options.pageSize || 0 }
                        : [];
                }

                const employees = result.employees || [];

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

                // Shape C: {employees: [delta], deletedIds, ts} — apply _mergeDelta
                const isDelta = result && Array.isArray(result.deletedIds);

                if (isDelta) {
                    this._incCacheStat('deltas', 'employees');
                    const cachedExisting = this.getFromCache(cacheKey);
                    const existingArr = Array.isArray(cachedExisting)
                        ? cachedExisting
                        : (cachedExisting && Array.isArray(cachedExisting.employees) ? cachedExisting.employees : []);
                    const merged = this._mergeDelta(existingArr, employees, result.deletedIds, 'id');

                    const isPaginatedDelta = options.page !== undefined || options.pageSize !== undefined;
                    if (isPaginatedDelta) {
                        const envelope = {
                            employees: merged,
                            totalCount: result.totalCount !== undefined ? result.totalCount : merged.length,
                            page: result.page || options.page || 1,
                            pageSize: result.pageSize || options.pageSize || merged.length
                        };
                        this.setCache(cacheKey, envelope, result.ts);
                        return envelope;
                    }
                    this.setCache(cacheKey, merged, result.ts);
                    return merged;
                }

                // Shape B: {employees, totalCount, ...} — existing full data path
                this._incCacheStat('fullRefetches', 'employees');
                if (isPaginated) {
                    const envelope = {
                        employees,
                        totalCount: result.totalCount || employees.length,
                        page: result.page || options.page || 1,
                        pageSize: result.pageSize || options.pageSize || employees.length
                    };
                    this.setCache(cacheKey, envelope, result.ts);
                    return envelope;
                }

                // backward compat: plain array for calls without pagination params
                this.setCache(cacheKey, employees, result.ts);
                return employees;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        })();

        this.pendingRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    /**
     * Сохранить сотрудника (создать или обновить)
     * Phase 63 (TS-PROTO-06): после успешной mutation — capture server ts.
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
        this.clearCacheNamespace('employees');
        // Phase 63 (TS-PROTO-06): capture server ts so next read can short-circuit
        const ts = (result && typeof result.ts === 'number') ? result.ts : Date.now();
        this._writeNsTs('employees', ts);
        // Phase 65 (MULTI-TAB-03): broadcast TS_UPDATED to other tabs after mutation success
        if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
            SyncManager.sendTsUpdate('employees', ts);
        }
        return result;
    },

    /**
     * Удалить сотрудника
     * Phase 63 (TS-PROTO-06): backend пишет _Tombstones row + bumps nsTs;
     * frontend captures ts, next read получит tombstone через deletedIds delta path.
     * @param {string} id - ID сотрудника
     * @returns {Promise<Object>} результат операции
     */
    async deleteEmployee(id) {
        const result = await this.callApi('deleteEmployee', { id: id });
        this.clearCacheNamespace('employees');
        // Phase 63 (TS-PROTO-06): backend writes _Tombstones row + bumps nsTs
        const ts = (result && typeof result.ts === 'number') ? result.ts : Date.now();
        this._writeNsTs('employees', ts);
        // Phase 65 (MULTI-TAB-03): broadcast TS_UPDATED to other tabs after mutation success
        if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
            SyncManager.sendTsUpdate('employees', ts);
        }
        return result;
    },

    /**
     * Phase 63 (TS-PROTO-06): syncMyProfile wrapper — captures server ts.
     * Called from shared/js/page-lifecycle.js auto-sync flow.
     * NOTE: page-lifecycle.js still uses callApi('syncMyProfile') directly (Phase 65 may consolidate);
     * This wrapper provides fallback path для callers wanting ts capture.
     * @param {Object} profileData - данные профиля
     * @returns {Promise<Object>} результат операции
     */
    async syncMyProfile(profileData) {
        const result = await this.callApi('syncMyProfile', { data: profileData });
        this.clearCacheNamespace('employees');
        const ts = (result && typeof result.ts === 'number') ? result.ts : Date.now();
        this._writeNsTs('employees', ts);
        // Phase 65 (MULTI-TAB-03): broadcast TS_UPDATED to other tabs after mutation success
        if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
            SyncManager.sendTsUpdate('employees', ts);
        }
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
            if (cached) {
                if (this._staleKeys.delete('employeeTemplates')) {
                    this.getEmployeeTemplates(false).catch(() => {});
                }
                return cached;
            }
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

    // ============ ONBOARDING ============

    /**
     * Получить заявки на онбординг
     * @param {boolean} useCache - использовать кеш
     * @returns {Promise<Array>} массив заявок
     */
    async getOnboardingRequests(options) {
        // Migration shim для boolean вызовов (обратная совместимость)
        if (typeof options === 'boolean') { options = { useCache: options }; }
        if (!options || typeof options !== 'object') { options = {}; }

        const useCache = options.useCache !== false;
        const cacheKey = this._buildCacheKey('onboardingRequests', options);

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            // Phase 67 (CACHE-POISON-01): защита от cache poisoning пустым списком.
            // {requests:[]} truthy, но означает что кеш "отравлён" — не возвращать как hit.
            const cachedHasData = cached && (
                (Array.isArray(cached.requests) && cached.requests.length > 0) ||
                (typeof cached.totalCount === 'number' && cached.totalCount > 0)
            );
            if (cachedHasData) {
                if (this._staleKeys.delete(cacheKey)) {
                    this.getOnboardingRequests({ ...options, useCache: false }).catch(() => {});
                }
                return cached;
            }
            // Если кеш существует но пустой (отравлён) — явно удалить чтобы следующий
            // запрос с clientTs не получил notModified + вернул тот же пустой кеш.
            if (cached) {
                try { localStorage.removeItem(this.CACHE_PREFIX + cacheKey); } catch (e) {}
                delete this.cache[cacheKey];
            }
        }

        // Предотвращение race condition
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                // Phase 63 (TS-PROTO-06): собираем API params + thread clientTs из _lastKnownNsTs
                const apiParams = {};
                if (options.page !== undefined) apiParams.page = options.page;
                if (options.pageSize !== undefined) apiParams.pageSize = options.pageSize;
                if (options.filter !== undefined) apiParams.filter = options.filter;
                if (options.filterStatus !== undefined) apiParams.filter_status = options.filterStatus;
                if (options.sortBy !== undefined) { apiParams.sortBy = options.sortBy; apiParams.order = options.order || 'asc'; }

                // TS-PROTO-06: send clientTs only when warm
                // Phase 66.1: skip clientTs при _forceFullRefetch (после requireFullRefetch retry)
                const hasCacheForKey = this.getFromCache(cacheKey) != null;
                // list views: всегда full — conditional-GET/delta давал интермиттентную потерю строк (см. sort-rowloss-repro.spec.js)
                const isPaginated = options.page !== undefined || options.pageSize !== undefined;
                const clientTs = (options._forceFullRefetch || isPaginated || !hasCacheForKey) ? undefined : this._readNsTs('onboardings');
                if (clientTs !== undefined) {
                    apiParams.clientTs = clientTs;
                }

                const result = await this.callApi('getOnboardingRequests', apiParams);

                // Capture server ts FIRST (single source of truth)
                if (result && typeof result.ts === 'number') {
                    this._writeNsTs('onboardings', result.ts);
                }

                // Phase 66.1 (FRONTEND-REQUIREFULLREFETCH-MISSING): handler stale clients
                if (result && result.requireFullRefetch === true && !options._forceFullRefetch) {
                    delete this._lastKnownNsTs.onboardings;
                    this.clearCacheNamespace('onboardingRequests');
                    return this.getOnboardingRequests({ ...options, _forceFullRefetch: true, useCache: false });
                }

                // Phase 63 (TS-PROTO-06): handle 3 response shapes

                // Phase 65 (OPTIMISTIC-02): skip notModified short-circuit когда есть pending writes для onboarding.
                // Note: OptimisticManager instance name = 'onboarding' (singular, per partner-onboarding.js:92).
                const pendingCountForOnboarding = (typeof OptimisticManager !== 'undefined'
                    && typeof OptimisticManager.getPendingCountGlobal === 'function')
                    ? OptimisticManager.getPendingCountGlobal('onboarding')
                    : 0;

                // Shape A: {notModified: true, ts} — short-circuit, return cached envelope
                if (result && result.notModified === true && pendingCountForOnboarding === 0) {
                    this._incCacheStat('conditionalHits', 'onboardingRequests');
                    const cachedData = this.getFromCache(cacheKey);
                    // Phase 67 (CACHE-POISON-01): не доверять пустому кешу как валидному hit.
                    // {requests:[]} truthy, но означает отравлённый кеш — падаем в edge case для full-refetch.
                    const cachedHasData = cachedData && (
                        (Array.isArray(cachedData.requests) && cachedData.requests.length > 0) ||
                        (typeof cachedData.totalCount === 'number' && cachedData.totalCount > 0)
                    );
                    if (cachedHasData) {
                        return cachedData;
                    }
                    // Edge case: notModified но cache empty или отравлён (после clearCacheNamespace, смены фильтра,
                    // свежей сессии, или cache poisoning пустым списком после CONFLICT серии).
                    // nsTs пережила сессию/очистку кеша — сбрасываем nsTs и делаем повторный запрос без clientTs
                    // напрямую (без рекурсии, чтобы не попасть в pendingRequests deadlock).
                    delete this._lastKnownNsTs.onboardings;
                    try { localStorage.removeItem(this.TS_PREFIX + 'onboardings'); } catch (e) {}
                    const fallbackParams = {};
                    if (options.page !== undefined) fallbackParams.page = options.page;
                    if (options.pageSize !== undefined) fallbackParams.pageSize = options.pageSize;
                    if (options.filter !== undefined) fallbackParams.filter = options.filter;
                    if (options.filterStatus !== undefined) fallbackParams.filter_status = options.filterStatus;
                    // Critical: sortBy/order должны пробрасываться в fallback иначе backend вернёт данные
                    // в порядке вставки в Sheet, ломая порядок пагинации (баг с overlap страниц)
                    if (options.sortBy !== undefined) { fallbackParams.sortBy = options.sortBy; fallbackParams.order = options.order || 'asc'; }
                    // clientTs намеренно не передаём — принудительный full-refetch
                    const fallbackResult = await this.callApi('getOnboardingRequests', fallbackParams);
                    if (fallbackResult && typeof fallbackResult.ts === 'number') {
                        this._writeNsTs('onboardings', fallbackResult.ts);
                    }
                    const fallbackData = {
                        requests: fallbackResult.requests || [],
                        history: fallbackResult.history || {},
                        totalCount: fallbackResult.totalCount !== undefined ? fallbackResult.totalCount : (fallbackResult.requests ? fallbackResult.requests.length : 0),
                        page: fallbackResult.page || options.page,
                        pageSize: fallbackResult.pageSize || options.pageSize
                    };
                    this.setCache(cacheKey, fallbackData, fallbackResult && fallbackResult.ts);
                    this._incCacheStat('fullRefetches', 'onboardingRequests');
                    return fallbackData;
                }

                // Shape C: {requests: [delta], deletedIds, ts} — apply _mergeDelta to data.requests
                const isDelta = result && Array.isArray(result.deletedIds);

                if (isDelta) {
                    this._incCacheStat('deltas', 'onboardingRequests');
                    const cachedExisting = this.getFromCache(cacheKey);
                    const existingRequests = (cachedExisting && Array.isArray(cachedExisting.requests))
                        ? cachedExisting.requests
                        : [];
                    const mergedRequests = this._mergeDelta(existingRequests, result.requests || [], result.deletedIds, 'id');
                    const data = {
                        requests: mergedRequests,
                        // history merge: prefer server response, fallback to cached (preserve append-only audit)
                        history: result.history || (cachedExisting && cachedExisting.history) || {},
                        totalCount: result.totalCount !== undefined ? result.totalCount : mergedRequests.length,
                        page: result.page || options.page,
                        pageSize: result.pageSize || options.pageSize
                    };
                    this.setCache(cacheKey, data, result.ts);
                    return data;
                }

                // Shape B: {requests, history, totalCount, ...} — existing full data path
                this._incCacheStat('fullRefetches', 'onboardingRequests');
                const data = {
                    requests: result.requests || [],
                    history: result.history || {},
                    totalCount: result.totalCount || (result.requests ? result.requests.length : 0),
                    page: result.page || options.page,
                    pageSize: result.pageSize || options.pageSize
                };
                this.setCache(cacheKey, data, result.ts);
                return data;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        })();

        this.pendingRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    /**
     * Получить настройки онбординга (источники, условия, роли)
     * @param {boolean} useCache - использовать кеш
     * @returns {Promise<Object>} объект настроек
     */
    async getOnboardingSettings(useCache = true) {
        if (useCache) {
            const cached = this.getFromCache('onboardingSettings');
            if (cached) {
                if (this._staleKeys.delete('onboardingSettings')) {
                    this.getOnboardingSettings(false).catch(() => {});
                }
                return cached;
            }
        }
        const result = await this.callApi('getOnboardingSettings');
        this.setCache('onboardingSettings', result);
        return result;
    },

    /**
     * Получить данные администратора (пользователи, команды)
     * @param {Object} options - {usersPage, usersPageSize, teamsPage, teamsPageSize, useCache}
     */
    async getAdminData(options) {
        if (!options || typeof options !== 'object') { options = {}; }
        const useCache = options.useCache !== false;

        // Составной ключ для admin-specific pagination (usersPage/teamsPage вместо page)
        let cacheKey = 'adminData';
        const parts = [];
        if (options.usersPage !== undefined) parts.push('up' + options.usersPage);
        if (options.usersPageSize !== undefined) parts.push('ups' + options.usersPageSize);
        if (options.teamsPage !== undefined) parts.push('tp' + options.teamsPage);
        if (options.teamsPageSize !== undefined) parts.push('tps' + options.teamsPageSize);
        if (options.filter_team) parts.push('ft=' + options.filter_team);
        if (options.filter_role) parts.push('fr=' + options.filter_role);
        if (options.filter_status) parts.push('fs=' + options.filter_status);
        if (parts.length > 0) cacheKey += ':' + parts.join(':');

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                if (this._staleKeys.delete(cacheKey)) {
                    this.getAdminData({ ...options, useCache: false }).catch(() => {});
                }
                return cached;
            }
        }

        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const apiParams = {};
                if (options.usersPage !== undefined) apiParams.usersPage = options.usersPage;
                if (options.usersPageSize !== undefined) apiParams.usersPageSize = options.usersPageSize;
                if (options.teamsPage !== undefined) apiParams.teamsPage = options.teamsPage;
                if (options.teamsPageSize !== undefined) apiParams.teamsPageSize = options.teamsPageSize;
                if (options.filter_team !== undefined) apiParams.filter_team = options.filter_team;
                if (options.filter_role !== undefined) apiParams.filter_role = options.filter_role;
                if (options.filter_status !== undefined) apiParams.filter_status = options.filter_status;

                // v2.27 FIXES-CACHE-02: conditional GET via clientTs.
                // AdminData aggregates users + teams + pendingRequests, so we send the OLDEST
                // ts из тех трёх namespaces — если ЛЮБОЙ изменился, backend ответит full data.
                // Backend short-circuits только если clientTs >= max(users, teams, pendingRequests).
                if (this._readNsTs) {
                    const tsUsers = this._readNsTs('users');
                    const tsTeams = this._readNsTs('teams');
                    const tsRequests = this._readNsTs('pendingRequests');
                    const candidates = [tsUsers, tsTeams, tsRequests].filter(v => typeof v === 'number');
                    if (candidates.length > 0) {
                        apiParams.clientTs = Math.min.apply(null, candidates);
                    }
                }

                const result = await this.callApi('getAdminData', apiParams);

                // Phase 63 pattern: capture per-namespace ts если backend their вернул
                if (result && typeof result.ts === 'object' && result.ts) {
                    if (this._writeNsTs) {
                        if (typeof result.ts.users === 'number') this._writeNsTs('users', result.ts.users);
                        if (typeof result.ts.teams === 'number') this._writeNsTs('teams', result.ts.teams);
                        if (typeof result.ts.pendingRequests === 'number') this._writeNsTs('pendingRequests', result.ts.pendingRequests);
                    }
                }

                // Handle notModified short-circuit
                if (result && result.notModified === true) {
                    if (this._incCacheStat) this._incCacheStat('conditionalHits', 'adminData');
                    const cachedData = this.getFromCache(cacheKey);
                    if (cachedData) return cachedData;
                    // fallback if cache evicted between calls
                    return result;
                }

                if (this._incCacheStat) this._incCacheStat('fullRefetches', 'adminData');
                this.setCache(cacheKey, result);
                return result;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        })();

        this.pendingRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    /**
     * Получить лог аудита (cursor pagination)
     * @param {Object} options - {cursor, pageSize, dateFrom, dateTo, actor, useCache}
     */
    async getAuditLog(options) {
        if (!options || typeof options !== 'object') { options = {}; }
        const useCache = options.useCache !== false;
        const cacheKey = this._buildCacheKey('auditLog', options);

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                if (this._staleKeys.delete(cacheKey)) {
                    this.getAuditLog({ ...options, useCache: false }).catch(() => {});
                }
                return cached;
            }
        }

        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const apiParams = {};
                if (options.cursor !== undefined) apiParams.cursor = options.cursor;
                if (options.pageSize !== undefined) apiParams.pageSize = options.pageSize;
                if (options.dateFrom !== undefined) apiParams.dateFrom = options.dateFrom;
                if (options.dateTo !== undefined) apiParams.dateTo = options.dateTo;
                if (options.actor !== undefined) apiParams.actor = options.actor;
                if (options.action !== undefined) apiParams.action_filter = options.action;

                // Phase 63 (TS-PROTO-06): thread clientTs from _lastKnownNsTs.auditLog
                const clientTs = this._readNsTs('auditLog');
                if (clientTs !== undefined) {
                    apiParams.clientTs = clientTs;
                }

                const result = await this.callApi('getAuditLog', apiParams);

                // Capture server ts FIRST (single source of truth)
                if (result && typeof result.ts === 'number') {
                    this._writeNsTs('auditLog', result.ts);
                }

                // Phase 63 (TS-PROTO-06): handle notModified short-circuit (cursor preserves)
                if (result && result.notModified === true) {
                    this._incCacheStat('conditionalHits', 'auditLog');
                    const cachedData = this.getFromCache(cacheKey);
                    if (cachedData) return cachedData;
                    // Edge case: notModified но cache empty
                    return { data: [], nextCursor: null, totalCount: 0 };
                }

                // Shape B (full cursor-paginated response — preserved as-is for AuditLog)
                // NO _mergeDelta для append-only AuditLog — cursor pagination is the watermark
                this._incCacheStat('fullRefetches', 'auditLog');
                this.setCache(cacheKey, result, result && typeof result.ts === 'number' ? result.ts : undefined);
                return result;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        })();

        this.pendingRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    // ============ TEAM INVITES (server-side pending list) ============

    /**
     * Получить pending-инвайты команды (leader/admin).
     * @param {string} teamId - ID команды (для admin обязателен, для leader игнорируется)
     * @returns {Promise<{success:boolean, invites?:Array, error?:string}>}
     */
    async getTeamPendingInvites(teamId) {
        return this.callApi('getTeamPendingInvites', { teamId: teamId });
    },

    /**
     * Отменить pending-инвайт команды (leader/admin).
     * @param {string} inviteId - ID инвайта ('inv-...')
     */
    async cancelTeamInvite(inviteId) {
        const result = await this.callApi('cancelTeamInvite', { inviteId: inviteId });
        // Инвалидировать кеш pending-списка
        this.clearCache('getTeamPendingInvites');
        return result;
    },

    /**
     * Отправить приглашение по Reddy ID.
     * @param {string} teamId
     * @param {string} reddyId
     * @param {string} assignedRole
     */
    async inviteByReddyId(teamId, reddyId, assignedRole) {
        const result = await this.callApi('inviteByReddyId', {
            teamId: teamId,
            reddyId: reddyId,
            assignedRole: assignedRole
        });
        // Инвалидировать кеш pending-списка
        this.clearCache('getTeamPendingInvites');
        return result;
    },

    // ============ INVITES (guest-flow) ============

    /**
     * Получить приглашения для текущего пользователя (guest/waiting_invite).
     * @returns {Promise<{success:boolean, invites?:Array, error?:string}>}
     */
    async getInvites() {
        return this.callApi('getInvites');
    },

    /**
     * Принять приглашение в команду.
     * @param {string} inviteId - ID приглашения
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async acceptInvite(inviteId) {
        return this.callApi('acceptInvite', { inviteId });
    },

    /**
     * Отклонить приглашение в команду.
     * @param {string} inviteId - ID приглашения
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async rejectInvite(inviteId) {
        return this.callApi('rejectInvite', { inviteId });
    },

    /**
     * Получить список гостей (пользователи без команды).
     * Pass-through: team-invites.js управляет собственным SWR-кешем.
     * @returns {Promise<{success:boolean, guests?:Array, error?:string}>}
     */
    async getGuestUsers() {
        return this.callApi('getGuestUsers');
    },

    /**
     * Отправить приглашение гостю в команду.
     * @param {Object} params - { userEmail, teamId, assignedRole }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async sendInvite(params) {
        return this.callApi('sendInvite', params);
    },

    // ============ ADMIN — USERS / TEAMS / REQUESTS / ROLES ============

    /**
     * Обновить данные пользователя (роль, статус, команда).
     * Принимает единый params-объект для совместимости admin.js и team-forms.js.
     * @param {Object} params - { targetEmail, teamId?, role?, status? }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async updateUser(params) {
        const result = await this.callApi('updateUser', params);
        this.clearCacheNamespace('adminData');
        return result;
    },

    /**
     * Создать команду.
     * @param {Object} params - { name, leaderEmail, description }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async createTeam(params) {
        const result = await this.callApi('createTeam', params);
        this.clearCacheNamespace('adminData');
        return result;
    },

    /**
     * Обновить команду.
     * @param {Object} params - { teamId, name, description, isActive }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async updateTeam(params) {
        const result = await this.callApi('updateTeam', params);
        this.clearCacheNamespace('adminData');
        return result;
    },

    /**
     * Удалить команду.
     * @param {Object} params - { teamId }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async deleteTeam(params) {
        const result = await this.callApi('deleteTeam', params);
        this.clearCacheNamespace('adminData');
        return result;
    },

    /**
     * Удалить пользователя.
     * @param {Object} params - { targetEmail }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async deleteUser(params) {
        const result = await this.callApi('deleteUser', params);
        this.clearCacheNamespace('adminData');
        return result;
    },

    /**
     * Одобрить заявку на вступление в команду.
     * @param {Object} params - { requestId }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async approveRequest(params) {
        const result = await this.callApi('approveRequest', params);
        this.clearCacheNamespace('adminData');
        return result;
    },

    /**
     * Отклонить заявку на вступление в команду.
     * @param {Object} params - { requestId }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async rejectRequest(params) {
        const result = await this.callApi('rejectRequest', params);
        this.clearCacheNamespace('adminData');
        return result;
    },

    /**
     * Получить пользователей по роли (для модального поиска).
     * @param {Object} params - { roleKey }
     * @returns {Promise<{success:boolean, users?:Array, error?:string}>}
     */
    async getUsersByRole(params) {
        return this.callApi('getUsersByRole', params);
    },

    /**
     * Удалить роль с переназначением пользователей.
     * @param {Object} params - { roleKey, reassignTo }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async deleteRole(params) {
        const result = await this.callApi('deleteRole', params);
        this.clearCacheNamespace('adminData');
        return result;
    },

    /**
     * Сохранить конфигурацию роли.
     * @param {Object} params - { config }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async saveRoleConfig(params) {
        return this.callApi('saveRoleConfig', params);
    },

    /**
     * Сохранить права доступа.
     * @param {Object} params - { permissions }
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async savePermissions(params) {
        return this.callApi('savePermissions', params);
    },

    // ============ HELPERS ============

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
