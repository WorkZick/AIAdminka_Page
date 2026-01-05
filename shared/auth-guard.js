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

        const timeRemaining = Math.floor(this.getTimeRemaining() / 60000);
        console.log(`[TokenManager] 🔄 Мониторинг токена запущен. Истекает через ${timeRemaining} мин`);

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
            console.log(`[TokenManager] ⏰ Сессия истекает через ${timeRemaining} мин`);
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
            <style>
                .token-prompt-box {
                    position: fixed;
                    top: 16px;
                    right: 16px;
                    z-index: 99999;
                    background: rgba(30, 30, 30, 0.85);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 14px 16px;
                    min-width: 240px;
                    font-family: 'TT Firs Neue', 'Segoe UI', system-ui, sans-serif;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                .token-prompt-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .token-prompt-icon {
                    width: 32px;
                    height: 32px;
                    background: rgba(253, 190, 47, 0.15);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .token-prompt-icon svg {
                    width: 16px;
                    height: 16px;
                    fill: #fdbe2f;
                }
                .token-prompt-text {
                    flex: 1;
                }
                .token-prompt-title {
                    color: #f2f2f2;
                    font-weight: 600;
                    font-size: 13px;
                    margin-bottom: 2px;
                }
                .token-prompt-subtitle {
                    color: #6b6b6b;
                    font-size: 11px;
                }
                .token-prompt-time {
                    color: #fdbe2f;
                    font-weight: 600;
                }
                .token-prompt-time.warning {
                    color: #ff6b6b;
                }
                .token-prompt-actions {
                    display: flex;
                    gap: 8px;
                }
                .token-prompt-btn {
                    flex: 1;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-family: inherit;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border: none;
                }
                .token-prompt-btn-primary {
                    background: rgba(253, 190, 47, 0.15);
                    color: #fdbe2f;
                    border: 1px solid rgba(253, 190, 47, 0.3);
                }
                .token-prompt-btn-primary:hover {
                    background: rgba(253, 190, 47, 0.25);
                    border-color: rgba(253, 190, 47, 0.5);
                }
                .token-prompt-btn-secondary {
                    background: rgba(255, 255, 255, 0.05);
                    color: #6b6b6b;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }
                .token-prompt-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.08);
                    color: #a0a0a0;
                }
            </style>
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
                    <button class="token-prompt-btn token-prompt-btn-primary" onclick="TokenManager.extendSession()">Продлить</button>
                    <button class="token-prompt-btn token-prompt-btn-secondary" onclick="TokenManager.dismissPrompt()">Позже</button>
                </div>
            </div>
        `;
        document.body.appendChild(prompt);

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
            alert('Popup заблокирован. Разрешите popup для этого сайта.');
            return;
        }

        // Следим за обновлением токена
        const originalTimestamp = this.getAuthTimestamp();
        const checkInterval = setInterval(() => {
            try {
                if (popup.closed) {
                    clearInterval(checkInterval);
                    const newTimestamp = this.getAuthTimestamp();
                    if (newTimestamp > originalTimestamp) {
                        this.warningShown = false;
                        console.log('[TokenManager] ✅ Сессия продлена на 1 час');
                    }
                    sessionStorage.removeItem('oauth_silent');
                }
            } catch(e) {}
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

        TokenManager.startAutoRefresh();
        return true;
    },

    async checkAsync(redirect = true) {
        return this.check(redirect);
    },

    /**
     * Проверка авторизации + инициализация RoleGuard
     * Используется для страниц, требующих проверки прав доступа
     */
    async checkWithRole(redirect = true) {
        // Сначала обычная проверка токена
        if (!this.check(redirect)) return false;

        // Затем инициализация RoleGuard
        if (typeof RoleGuard !== 'undefined') {
            await RoleGuard.init();
        }

        return true;
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
                alert(canLogout);
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

        container.innerHTML = `
            <div class="auth-user-info">
                <div class="auth-user-avatar">
                    ${user.picture
                        ? `<img src="${user.picture}" alt="">`
                        : initials
                    }
                </div>
                <div class="auth-user-details">
                    <div class="auth-user-name">${user.name || 'Пользователь'}</div>
                    <div class="auth-user-email">${user.email}</div>
                </div>
                <button class="auth-logout-btn" onclick="AuthGuard.logout()" title="Выйти">Выйти</button>
            </div>
        `;
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

// CSS стили
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .auth-user-info {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            margin: 10px;
        }
        .auth-user-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #fdbe2f;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 600;
            color: #1a1a1a;
            overflow: hidden;
        }
        .auth-user-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .auth-user-details {
            flex: 1;
            min-width: 0;
        }
        .auth-user-name {
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .auth-user-email {
            font-size: 11px;
            opacity: 0.7;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .auth-logout-btn {
            background: none;
            border: none;
            padding: 6px;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.2s;
            color: inherit;
        }
        .auth-logout-btn:hover {
            opacity: 1;
        }
        .sidebar.collapsed .auth-user-details,
        .sidebar.collapsed .auth-logout-btn {
            display: none;
        }
        .sidebar.collapsed .auth-user-info {
            justify-content: center;
            padding: 10px;
        }
    `;
    document.head.appendChild(style);
})();

// Автопроверка при загрузке
(function() {
    AuthGuard.check();
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthGuard;
}
