/**
 * TokenManager - Управление OAuth токенами
 * Показывает уведомление за 10 минут до истечения токена
 */
const TokenManager = {
    // Временные параметры
    TOKEN_LIFETIME: 3500000,       // ~58 минут (Google токен живёт 60 мин)
    WARN_BEFORE: 600000,           // Предупреждать за 10 минут
    CHECK_INTERVAL: 60000,         // Проверять каждую минуту

    // Состояние
    refreshTimer: null,
    visibilityHandler: null,
    warningShown: false,
    _countdownEl: null,

    // Кеш auth-данных (избегаем повторных localStorage.getItem + JSON.parse)
    _authCache: null,
    _authCacheTime: 0,
    _AUTH_CACHE_TTL: 1000, // 1 секунда

    /**
     * Кешированное чтение auth-данных (1 localStorage + JSON.parse вместо 3)
     */
    _getAuth() {
        const now = Date.now();
        if (this._authCache && (now - this._authCacheTime) < this._AUTH_CACHE_TTL) {
            return this._authCache;
        }
        const raw = sessionStorage.getItem('cloud-auth');
        if (!raw) { this._authCache = null; return null; }
        try {
            this._authCache = JSON.parse(raw);
            this._authCacheTime = now;
            return this._authCache;
        } catch (e) { sessionStorage.removeItem('cloud-auth'); this._authCache = null; this._authCacheTime = 0; return null; }
    },

    /**
     * Сбросить кеш (при logout/login)
     */
    _invalidateAuthCache() {
        this._authCache = null;
        this._authCacheTime = 0;
    },

    needsWarning() {
        const auth = this._getAuth();
        if (!auth) return false;
        return (Date.now() - auth.timestamp) > (this.TOKEN_LIFETIME - this.WARN_BEFORE);
    },

    isExpired() {
        const auth = this._getAuth();
        if (!auth) return true;
        return (Date.now() - auth.timestamp) > this.TOKEN_LIFETIME;
    },

    getTimeRemaining() {
        const auth = this._getAuth();
        if (!auth) return 0;
        return Math.max(0, this.TOKEN_LIFETIME - (Date.now() - auth.timestamp));
    },

    /**
     * Запуск автоматической проверки
     */
    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        this.warningShown = false;

        // Периодическая проверка
        this.refreshTimer = setInterval(() => {
            this.checkToken();
        }, this.CHECK_INTERVAL);

        // Проверка при возврате на вкладку
        if (!this.visibilityHandler) {
            this.visibilityHandler = () => {
                if (document.visibilityState === 'visible') {
                    this.checkToken();
                }
            };
            document.addEventListener('visibilitychange', this.visibilityHandler);
        }
    },

    /**
     * Проверка токена
     */
    checkToken() {
        if (!this._getAuth()) {
            return;
        }

        // Токен истёк
        if (this.isExpired()) {
            console.error('[TokenManager] ❌ Токен истёк! Редирект на логин...');
            this.handleExpiredToken();
            return;
        }

        // Скоро истечёт - показываем предупреждение
        if (this.needsWarning() && !this.warningShown) {
            const timeRemaining = Math.floor(this.getTimeRemaining() / 60000);
            this.showRefreshPrompt(timeRemaining);
            this.warningShown = true;
        }
    },

    /**
     * Показать уведомление о продлении сессии с живым таймером
     */
    showRefreshPrompt(minutesLeft) {
        if (document.getElementById('token-refresh-prompt')) return;

        const prompt = document.createElement('div');
        prompt.id = 'token-refresh-prompt';
        prompt.innerHTML = `
            <div class="token-prompt-box">
                <div class="token-prompt-content">
                    <div class="token-prompt-icon">
                        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H9l4-6v4h2l-4 6z"/></svg>
                    </div>
                    <div class="token-prompt-text">
                        <div class="token-prompt-title">Сессия истекает</div>
                        <div class="token-prompt-subtitle">Осталось <span id="token-countdown" class="token-prompt-time"></span></div>
                    </div>
                </div>
                <div class="token-prompt-actions">
                    <button class="token-prompt-btn token-prompt-btn-primary">Продлить</button>
                    <button class="token-prompt-btn token-prompt-btn-secondary">Позже</button>
                </div>
            </div>
        `;
        document.body.appendChild(prompt);

        // Добавляем обработчики для кнопок
        const extendBtn = prompt.querySelector('.token-prompt-btn-primary');
        const dismissBtn = prompt.querySelector('.token-prompt-btn-secondary');

        if (extendBtn) {
            extendBtn.addEventListener('click', () => this.extendSession());
        }
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => this.dismissPrompt());
        }

        // Кешируем ссылку на countdown элемент (вместо getElementById каждую секунду)
        this._countdownEl = prompt.querySelector('#token-countdown');

        // Живой таймер (очистка предыдущего интервала для защиты от утечки)
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.updateCountdown();
        this.countdownInterval = setInterval(() => this.updateCountdown(), 1000);
    },

    /**
     * Обновить обратный отсчёт
     */
    updateCountdown() {
        const el = this._countdownEl || document.getElementById('token-countdown');
        if (!el) {
            if (this.countdownInterval) clearInterval(this.countdownInterval);
            return;
        }

        const remaining = this.getTimeRemaining();
        if (remaining <= 0) {
            el.textContent = '0:00';
            el.className = 'token-prompt-time warning';
            return;
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        el.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Красный цвет когда меньше 2 минут
        if (minutes < 2) {
            el.className = 'token-prompt-time warning';
        } else {
            el.className = 'token-prompt-time';
        }
    },

    /**
     * Закрыть уведомление (покажем снова через 2 мин)
     */
    dismissPrompt() {
        const prompt = document.getElementById('token-refresh-prompt');
        if (prompt) prompt.remove();
        this._countdownEl = null;
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        // Показать снова через 2 минуты если токен ещё не истёк
        setTimeout(() => {
            if (!this.isExpired() && this.needsWarning()) {
                this.warningShown = false;
                this.checkToken();
            }
        }, 120000);
    },

    // Флаг: silent refresh не сработал, следующий клик → interactive
    _needsInteractive: false,
    // Mutex: предотвращает параллельные вызовы extendSession (double-click protection)
    _extending: false,

    /**
     * Продлить сессию через redirect
     * Стратегия: сначала prompt=none (тихий redirect), при неудаче → prompt=consent (интерактивный)
     * Полный редирект на Google OAuth — не требует popup/iframe
     * @param {boolean} [interactive=false] - использовать интерактивный режим
     */
    extendSession(interactive) {
        // Предотвращаем параллельные вызовы (double-click, concurrent timers)
        if (this._extending) return;
        this._extending = true;

        // Если предыдущий silent не сработал — форсируем interactive
        if (this._needsInteractive) {
            interactive = true;
            this._needsInteractive = false;
        }

        // Убираем уведомление
        const prompt = document.getElementById('token-refresh-prompt');
        if (prompt) prompt.remove();
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        // Сохраняем текущую страницу для возврата
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('auth-redirect', currentPath);

        const state = EnvConfig.OAUTH.generateState();
        sessionStorage.setItem('oauth_state', state);

        const promptParam = interactive ? 'consent' : 'none';

        if (!interactive) {
            // Redirect refresh: callback.js вернёт напрямую на auth-redirect
            sessionStorage.setItem('oauth_redirect_refresh', 'true');
        }
        sessionStorage.removeItem('oauth_silent');

        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
            '?client_id=' + encodeURIComponent(EnvConfig.OAUTH.CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(EnvConfig.OAUTH.getRedirectUri()) +
            '&response_type=token' +
            '&scope=' + encodeURIComponent(EnvConfig.OAUTH.SCOPES) +
            '&state=' + encodeURIComponent(state) +
            '&prompt=' + promptParam;

        window.location.href = authUrl;
        // Safety: сбросить флаг если навигация не произошла за 3 секунды
        setTimeout(() => { this._extending = false; }, 3000);
    },

    /**
     * Получить timestamp токена
     */
    getAuthTimestamp() {
        const auth = this._getAuth();
        if (!auth) return 0;
        return auth.timestamp || 0;
    },

    /**
     * Обработка истёкшего токена
     */
    handleExpiredToken() {
        this._invalidateAuthCache();
        sessionStorage.removeItem('cloud-auth');
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('auth-redirect', currentPath);
        window.location.href = AuthGuard.LOGIN_URL;
    },

    /**
     * Остановка мониторинга
     */
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }
        this.warningShown = false;
    }
};

/**
 * AuthGuard - Проверка авторизации
 */
const AuthGuard = {
    getBasePath() {
        const path = window.location.pathname;
        const match = path.match(/^\/([^\/]+)\//);
        if (!match) return '';
        // Known app modules — if first segment is a module, basePath is empty (root = app)
        const appModules = ['login', 'admin', 'partners', 'partner-onboarding', 'team-info',
            'traffic-calculation', 'excel-reports', 'sync', 'documentation', 'shared'];
        if (appModules.includes(match[1])) return '';
        return '/' + match[1];
    },

    get LOGIN_URL() {
        return this.getBasePath() + '/login/index.html';
    },

    check(redirect = true) {
        const auth = TokenManager._getAuth();

        if (!auth) {
            if (redirect) this.redirectToLogin();
            return false;
        }

        if (TokenManager.isExpired()) {
            sessionStorage.removeItem('cloud-auth');
            if (redirect) this.redirectToLogin();
            return false;
        }

        // Создать cloud-storage-info если его нет (для обратной совместимости)
        if (!localStorage.getItem('cloud-storage-info')) {
            try {
                localStorage.setItem('cloud-storage-info', JSON.stringify({
                    connected: true,
                    email: auth.email,
                    timestamp: Date.now()
                }));
            } catch (e) {
                // Ignore - cloud-storage-info creation failed
            }
        }

        TokenManager.startAutoRefresh();
        return true;
    },

    async checkAsync(redirect = true) {
        return this.check(redirect);
    },

    /**
     * Проверка авторизации + инициализация RoleGuard + проверка статуса
     * Используется для страниц, требующих проверки прав доступа
     * Автоматически редиректит на соответствующий экран в зависимости от статуса
     */
    async checkWithRole(redirect = true) {
        // Сначала обычная проверка токена
        if (!this.check(redirect)) return false;

        // Затем инициализация RoleGuard
        if (typeof RoleGuard !== 'undefined') {
            try {
                await RoleGuard.init();

                // Проверяем статус пользователя
                const status = RoleGuard.getStatus ? RoleGuard.getStatus() : null;
                const role = RoleGuard.getCurrentRole ? RoleGuard.getCurrentRole() : null;

                if (role) {
                    // Blocked - показываем экран блокировки
                    if (status === 'blocked') {
                        this.showBlockedScreen();
                        return false;
                    }

                    // Guest без команды: если approved_no_team — на выбор роли (login),
                    // иначе — на экран ожидания приглашения
                    if (role === 'guest') {
                        if (status === 'approved_no_team') {
                            this.redirectToLogin();
                        } else {
                            window.location.href = this.getBasePath() + '/login/waiting-invite.html';
                        }
                        return false;
                    }
                }
            } catch (error) {
                console.error('[AuthGuard] RoleGuard init failed:', error);

                // Если Access denied - пользователь удалён из системы, разлогиниваем
                const errorMessage = error.message || String(error);
                if (errorMessage.includes('Access denied') || errorMessage.includes('not found')) {
                    if (typeof Toast !== 'undefined') {
                        Toast.error('Доступ запрещён. Ваш аккаунт не найден в системе.');
                    }
                    // Очищаем данные и редиректим на login
                    sessionStorage.removeItem('cloud-auth');
                    localStorage.removeItem('roleGuard');
                    setTimeout(() => this.redirectToLogin(), 1500);
                    return false;
                }
                // Продолжаем без проверки роли - возможно бэкенд недоступен временно
            }
        }

        return true;
    },

    /**
     * Показать экран блокировки (для заблокированных пользователей)
     */
    showBlockedScreen() {
        // Останавливаем таймеры до уничтожения DOM
        TokenManager.stopAutoRefresh();

        // Создаём overlay блокировки
        const overlay = document.createElement('div');
        overlay.id = 'auth-blocked-overlay';
        overlay.innerHTML = `
            <div class="auth-blocked-card">
                <div class="auth-blocked-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        <line x1="12" y1="15" x2="12" y2="17"/>
                    </svg>
                </div>
                <h2>Доступ заблокирован</h2>
                <p>Ваш аккаунт заблокирован администратором.<br>Обратитесь к руководителю вашей команды.</p>
                <button id="auth-blocked-logout">Выйти</button>
            </div>
        `;
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '99999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'var(--bg-black, #0d0d0d)';
        document.body.appendChild(overlay);
        overlay.querySelector('#auth-blocked-logout').addEventListener('click', () => AuthGuard.logout());
    },

    getUser() {
        const auth = TokenManager._getAuth();
        if (!auth) return null;

        return {
            email: auth.email,
            name: auth.name,
            picture: auth.picture
        };
    },

    logout() {
        if (typeof SyncManager !== 'undefined' && SyncManager.hasPendingSync()) {
            const canLogout = SyncManager.canLogout();
            if (canLogout !== true) {
                Toast.warning(canLogout);
                return false;
            }
        }

        if (typeof SyncManager !== 'undefined') {
            localStorage.removeItem('sync-queue');
        }

        TokenManager._invalidateAuthCache();
        TokenManager.stopAutoRefresh();
        sessionStorage.removeItem('cloud-auth');
        localStorage.removeItem('cloud-storage-info');
        localStorage.removeItem('partners-data');
        localStorage.removeItem('partnersColumnsConfig');
        localStorage.removeItem('traffic-analytics-temp');
        localStorage.removeItem('trafficSettings');
        localStorage.removeItem('team_info_data');
        localStorage.removeItem('teamInfoTemplates');
        localStorage.removeItem('team-name');
        localStorage.removeItem('sync-data');
        localStorage.removeItem('sync-logs');
        localStorage.removeItem('sync-auth');
        localStorage.removeItem('sync-access-status');
        localStorage.removeItem('roleGuard');

        if (typeof CloudStorage !== 'undefined' && CloudStorage.clearCache) {
            CloudStorage.clearCache();
        }

        if (typeof RoleGuard !== 'undefined' && RoleGuard.clearCache) {
            RoleGuard.clearCache();
        }

        this.redirectToLogin();
    },

    redirectToLogin() {
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('auth-redirect', currentPath);
        window.location.href = this.LOGIN_URL;
    },

    getRedirectUrl() {
        return sessionStorage.getItem('auth-redirect') || (this.getBasePath() + '/index.html');
    },

    clearRedirectUrl() {
        sessionStorage.removeItem('auth-redirect');
    },

    renderUserInfo(containerId) {
        const user = this.getUser();
        if (!user) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const initials = this.getInitials(user.name);

        const esc = this._escapeHtml.bind(this);
        const safeAvatar = Utils.isGoogleAvatar(user.picture) ? user.picture : null;
        container.innerHTML = `
            <div class="auth-user-info">
                <div class="auth-user-avatar">
                    ${safeAvatar
                        ? `<img src="${esc(safeAvatar)}" alt="">`
                        : initials
                    }
                </div>
                <div class="auth-user-details">
                    <div class="auth-user-name">${esc(user.name) || 'Пользователь'}</div>
                    <div class="auth-user-email">${esc(user.email)}</div>
                </div>
                <button class="auth-logout-btn" title="Выйти">Выйти</button>
            </div>
        `;

        // Event delegation на container — работает при повторном вызове renderUserInfo
        if (!container._logoutHandlerAttached) {
            container.addEventListener('click', (e) => {
                if (e.target.closest('.auth-logout-btn')) this.logout();
            });
            container._logoutHandlerAttached = true;
        }
    },

    _escapeHtml(text) { return Utils.escapeHtml(text); },
    getInitials(name) { return Utils.getInitials(name); }
};

// Автопроверка при загрузке
(function() {
    AuthGuard.check();
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthGuard;
}
