/**
 * TokenManager - Управление OAuth токенами
 * Показывает уведомление за 10 минут до истечения токена
 */
const TokenManager = {
    // OAuth Config
    CLIENT_ID: '552590459404-muqkuq0qa461763qfdt3ec62mfua49c6.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',

    // Временные параметры
    TOKEN_LIFETIME: 3500000,       // ~58 минут (Google токен живёт 60 мин)
    WARN_BEFORE: 600000,           // Предупреждать за 10 минут
    CHECK_INTERVAL: 60000,         // Проверять каждую минуту

    // Состояние
    refreshTimer: null,
    visibilityHandler: null,
    warningShown: false,

    /**
     * Получить REDIRECT_URI
     */
    getRedirectUri() {
        const host = window.location.hostname;
        if (host === '127.0.0.1' || host === 'localhost') {
            return 'http://127.0.0.1:5500/SimpleAIAdminka/login/callback.html';
        }
        return 'https://workzick.github.io/AIAdminka_Page/login/callback.html';
    },

    /**
     * Проверить, нужно ли показать предупреждение
     */
    needsWarning() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return false;

        const auth = JSON.parse(authData);
        const elapsed = Date.now() - auth.timestamp;

        return elapsed > (this.TOKEN_LIFETIME - this.WARN_BEFORE);
    },

    /**
     * Проверить, истёк ли токен
     */
    isExpired() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return true;

        const auth = JSON.parse(authData);
        const elapsed = Date.now() - auth.timestamp;

        return elapsed > this.TOKEN_LIFETIME;
    },

    /**
     * Получить оставшееся время (мс)
     */
    getTimeRemaining() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return 0;

        const auth = JSON.parse(authData);
        const elapsed = Date.now() - auth.timestamp;

        return Math.max(0, this.TOKEN_LIFETIME - elapsed);
    },

    /**
     * Генерация state параметра
     */
    generateState() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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
        if (!localStorage.getItem('cloud-auth')) {
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

        // Живой таймер
        this.updateCountdown();
        this.countdownInterval = setInterval(() => this.updateCountdown(), 1000);
    },

    /**
     * Обновить обратный отсчёт
     */
    updateCountdown() {
        const el = document.getElementById('token-countdown');
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
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        // Показать снова через 2 минуты если токен ещё не истёк
        setTimeout(() => {
            if (!this.isExpired() && this.needsWarning()) {
                this.warningShown = false;
                this.checkToken();
            }
        }, 120000);
    },

    /**
     * Продлить сессию через popup
     */
    extendSession() {
        // Убираем уведомление
        const prompt = document.getElementById('token-refresh-prompt');
        if (prompt) prompt.remove();

        const state = this.generateState();
        sessionStorage.setItem('oauth_state', state);
        sessionStorage.setItem('oauth_silent', 'true');

        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
            '?client_id=' + encodeURIComponent(this.CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(this.getRedirectUri()) +
            '&response_type=token' +
            '&scope=' + encodeURIComponent(this.SCOPES) +
            '&state=' + encodeURIComponent(state) +
            '&prompt=none'; // Попробуем без UI

        const width = 500, height = 600;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        const popup = window.open(
            authUrl,
            'oauth_extend',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
            Toast.warning('Popup заблокирован. Разрешите popup для этого сайта.');
            return;
        }

        // Следим за обновлением токена
        const originalTimestamp = this.getAuthTimestamp();
        let attempts = 0;
        const maxAttempts = 150; // 30 секунд (150 * 200ms)

        const checkInterval = setInterval(() => {
            attempts++;
            const newTimestamp = this.getAuthTimestamp();

            // Проверяем, обновился ли токен
            if (newTimestamp > originalTimestamp) {
                clearInterval(checkInterval);
                this.warningShown = false;
                sessionStorage.removeItem('oauth_silent');
                return;
            }

            // Останавливаем проверку после максимального количества попыток
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                sessionStorage.removeItem('oauth_silent');
            }
        }, 200);
    },

    /**
     * Получить timestamp токена
     */
    getAuthTimestamp() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return 0;
        return JSON.parse(authData).timestamp || 0;
    },

    /**
     * Обработка истёкшего токена
     */
    handleExpiredToken() {
        localStorage.removeItem('cloud-auth');
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
        return match ? '/' + match[1] : '';
    },

    get LOGIN_URL() {
        return this.getBasePath() + '/login/index.html';
    },

    check(redirect = true) {
        const authData = localStorage.getItem('cloud-auth');

        if (!authData) {
            if (redirect) this.redirectToLogin();
            return false;
        }

        if (TokenManager.isExpired()) {
            localStorage.removeItem('cloud-auth');
            if (redirect) this.redirectToLogin();
            return false;
        }

        // Создать cloud-storage-info если его нет (для обратной совместимости)
        if (!localStorage.getItem('cloud-storage-info')) {
            try {
                const auth = JSON.parse(authData);
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
                    localStorage.removeItem('cloud-auth');
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
                <button onclick="AuthGuard.logout()">Выйти</button>
            </div>
        `;
        document.body.innerHTML = '';
        document.body.appendChild(overlay);
    },

    getUser() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return null;

        const auth = JSON.parse(authData);
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

        localStorage.removeItem('cloud-auth');
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
        const safeAvatar = user.picture && user.picture.startsWith('https://') ? user.picture : null;
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

        // Добавляем обработчик на кнопку logout
        const logoutBtn = container.querySelector('.auth-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    },

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
};

// Автопроверка при загрузке
(function() {
    AuthGuard.check();
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthGuard;
}
