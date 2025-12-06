/**
 * TokenManager - Управление OAuth токенами с автоматическим обновлением
 */
const TokenManager = {
    // OAuth Config
    CLIENT_ID: '552590459404-muqkuq0qa461763qfdt3ec62mfua49c6.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',

    // Временные параметры
    TOKEN_LIFETIME: 3500000,       // ~58 минут (Google токен живёт 60 мин, обновляем раньше)
    REFRESH_BEFORE: 600000,        // Обновлять за 10 минут до истечения (более безопасно)
    CHECK_INTERVAL: 30000,         // Проверять каждые 30 секунд (чаще)

    // Состояние
    refreshInProgress: false,
    refreshTimer: null,
    visibilityHandler: null,
    failedRefreshCount: 0,

    /**
     * Получить REDIRECT_URI в зависимости от окружения
     */
    getRedirectUri() {
        const host = window.location.hostname;
        if (host === '127.0.0.1' || host === 'localhost') {
            return 'http://127.0.0.1:5500/SimpleAIAdminka/login/callback.html';
        }
        return 'https://workzick.github.io/AIAdminka_Page/login/callback.html';
    },

    /**
     * Проверить, нужно ли обновить токен
     */
    needsRefresh() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return false;

        const auth = JSON.parse(authData);
        const elapsed = Date.now() - auth.timestamp;

        return elapsed > (this.TOKEN_LIFETIME - this.REFRESH_BEFORE);
    },

    /**
     * Проверить, истёк ли токен полностью
     */
    isExpired() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return true;

        const auth = JSON.parse(authData);
        const elapsed = Date.now() - auth.timestamp;

        return elapsed > this.TOKEN_LIFETIME;
    },

    /**
     * Получить оставшееся время жизни токена (мс)
     */
    getTimeRemaining() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return 0;

        const auth = JSON.parse(authData);
        const elapsed = Date.now() - auth.timestamp;

        return Math.max(0, this.TOKEN_LIFETIME - elapsed);
    },

    /**
     * Silent Refresh - обновление токена через скрытый iframe
     */
    silentRefresh() {
        return new Promise((resolve) => {
            if (this.refreshInProgress) {
                console.log('[TokenManager] Silent refresh уже выполняется');
                resolve(false);
                return;
            }

            console.log('[TokenManager] Запуск silent refresh...');
            this.refreshInProgress = true;

            // Генерируем state для silent refresh
            const state = this.generateState();
            sessionStorage.setItem('oauth_state', state);
            sessionStorage.setItem('oauth_silent', 'true'); // Маркер silent режима

            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.id = 'silent-refresh-iframe';

            const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
                '?client_id=' + encodeURIComponent(this.CLIENT_ID) +
                '&redirect_uri=' + encodeURIComponent(this.getRedirectUri()) +
                '&response_type=token' +
                '&scope=' + encodeURIComponent(this.SCOPES) +
                '&state=' + encodeURIComponent(state) +
                '&prompt=none';  // Ключевой параметр - без UI

            // Таймаут на случай ошибки
            const timeout = setTimeout(() => {
                console.warn('[TokenManager] ⚠️ Silent refresh timeout (10s)');
                this.cleanupRefresh(iframe);
                sessionStorage.removeItem('oauth_silent');
                resolve(false);
            }, 10000);

            // Слушаем обновление токена
            const originalTimestamp = this.getAuthTimestamp();
            const checkInterval = setInterval(() => {
                const newTimestamp = this.getAuthTimestamp();
                if (newTimestamp && newTimestamp > originalTimestamp) {
                    console.log('[TokenManager] ✅ Silent refresh успешен! Новый timestamp:', new Date(newTimestamp).toLocaleTimeString());
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    this.cleanupRefresh(iframe);
                    sessionStorage.removeItem('oauth_silent');
                    resolve(true);
                }
            }, 200);

            iframe.src = authUrl;
            document.body.appendChild(iframe);
        });
    },

    /**
     * Очистка после refresh
     */
    cleanupRefresh(iframe) {
        this.refreshInProgress = false;
        if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
    },

    /**
     * Получить timestamp текущего токена
     */
    getAuthTimestamp() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return 0;
        return JSON.parse(authData).timestamp || 0;
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
     * Проверка и автоматическое обновление токена
     */
    async ensureValidToken() {
        if (!localStorage.getItem('cloud-auth')) {
            return false;
        }

        // Если токен скоро истечёт - пробуем обновить
        if (this.needsRefresh()) {
            const refreshed = await this.silentRefresh();
            if (!refreshed && this.isExpired()) {
                // Токен истёк и не удалось обновить
                return false;
            }
        }

        return true;
    },

    /**
     * Запуск автоматического обновления токена
     */
    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        // Сбрасываем счётчик неудач
        this.failedRefreshCount = 0;

        const timeRemaining = Math.floor(this.getTimeRemaining() / 60000); // в минутах
        console.log(`[TokenManager] 🔄 Автообновление токена запущено. Осталось: ${timeRemaining} мин`);

        // Периодическая проверка
        this.refreshTimer = setInterval(async () => {
            await this.tryRefreshIfNeeded();
        }, this.CHECK_INTERVAL);

        // Обработчик возврата на вкладку
        if (!this.visibilityHandler) {
            this.visibilityHandler = async () => {
                if (document.visibilityState === 'visible') {
                    console.log('[TokenManager] 👁️ Вкладка активна, проверяем токен...');
                    // При возврате на вкладку - сразу проверяем токен
                    await this.tryRefreshIfNeeded();
                }
            };
            document.addEventListener('visibilitychange', this.visibilityHandler);
        }
    },

    /**
     * Попытка обновить токен если нужно
     */
    async tryRefreshIfNeeded() {
        if (!localStorage.getItem('cloud-auth')) {
            return;
        }

        const timeRemaining = Math.floor(this.getTimeRemaining() / 60000);

        // Если токен уже истёк - редирект на логин
        if (this.isExpired()) {
            console.error('[TokenManager] ❌ Токен истёк! Редирект на логин...');
            this.handleExpiredToken();
            return;
        }

        // Если нужно обновить
        if (this.needsRefresh()) {
            console.log(`[TokenManager] ⏰ Токен нужно обновить (осталось ${timeRemaining} мин)`);
            const refreshed = await this.silentRefresh();
            if (refreshed) {
                this.failedRefreshCount = 0;
                console.log('[TokenManager] ✅ Токен успешно обновлён');
            } else {
                this.failedRefreshCount++;
                console.warn(`[TokenManager] ⚠️ Попытка ${this.failedRefreshCount}/5 не удалась`);

                // После 3 неудачных попыток - пробуем интерактивный refresh
                if (this.failedRefreshCount === 3) {
                    console.log('[TokenManager] 🔄 Попытка интерактивного обновления...');
                    const interactiveRefreshed = await this.interactiveRefresh();
                    if (interactiveRefreshed) {
                        this.failedRefreshCount = 0;
                        console.log('[TokenManager] ✅ Интерактивное обновление успешно');
                        return;
                    }
                }

                // После 5 неудачных попыток - показываем предупреждение
                if (this.failedRefreshCount >= 5) {
                    console.error('[TokenManager] ❌ 5 неудачных попыток обновления токена');
                    // Показываем предупреждение пользователю
                    if (confirm('Не удалось автоматически обновить сессию. Требуется повторный вход. Перейти на страницу входа?')) {
                        this.handleExpiredToken();
                    }
                }
            }
        }
    },

    /**
     * Интерактивное обновление токена (fallback для silent refresh)
     */
    interactiveRefresh() {
        return new Promise((resolve) => {
            // Генерируем state
            const state = this.generateState();
            sessionStorage.setItem('oauth_state', state);
            sessionStorage.setItem('oauth_silent', 'true');

            const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
                '?client_id=' + encodeURIComponent(this.CLIENT_ID) +
                '&redirect_uri=' + encodeURIComponent(this.getRedirectUri()) +
                '&response_type=token' +
                '&scope=' + encodeURIComponent(this.SCOPES) +
                '&state=' + encodeURIComponent(state) +
                '&prompt=none&include_granted_scopes=true';

            // Открываем в popup окне
            const width = 500;
            const height = 600;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;

            const popup = window.open(
                authUrl,
                'oauth_popup',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no`
            );

            if (!popup) {
                console.warn('[TokenManager] ⚠️ Popup заблокирован браузером');
                resolve(false);
                return;
            }

            // Слушаем обновление токена
            const originalTimestamp = this.getAuthTimestamp();
            let checkCount = 0;
            const maxChecks = 100; // 20 секунд

            const checkInterval = setInterval(() => {
                checkCount++;

                // Проверяем закрыто ли окно
                if (popup.closed) {
                    clearInterval(checkInterval);
                    sessionStorage.removeItem('oauth_silent');
                    resolve(false);
                    return;
                }

                // Проверяем обновление токена
                const newTimestamp = this.getAuthTimestamp();
                if (newTimestamp && newTimestamp > originalTimestamp) {
                    clearInterval(checkInterval);
                    popup.close();
                    sessionStorage.removeItem('oauth_silent');
                    resolve(true);
                    return;
                }

                // Timeout
                if (checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                    popup.close();
                    sessionStorage.removeItem('oauth_silent');
                    resolve(false);
                }
            }, 200);
        });
    },

    /**
     * Обработка истёкшего токена
     */
    handleExpiredToken() {
        localStorage.removeItem('cloud-auth');
        // Сохраняем текущий URL для возврата
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('auth-redirect', currentPath);
        // Редирект на логин
        window.location.href = AuthGuard.LOGIN_URL;
    },

    /**
     * Остановка автоматического обновления
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
        this.failedRefreshCount = 0;
    }
};

/**
 * AuthGuard - Проверка авторизации на страницах
 * Подключается на всех страницах, требующих авторизации
 */

const AuthGuard = {
    // Определяем базовый путь динамически (для локальной разработки и GitHub Pages)
    getBasePath() {
        const path = window.location.pathname;
        // Ищем первый сегмент пути (SimpleAIAdminka или AIAdminka_Page)
        const match = path.match(/^\/([^\/]+)\//);
        return match ? '/' + match[1] : '';
    },

    // URL страницы входа (динамический)
    get LOGIN_URL() {
        return this.getBasePath() + '/login/index.html';
    },

    /**
     * Проверка авторизации
     * Если не авторизован - редирект на login
     * @param {boolean} redirect - делать ли редирект (по умолчанию true)
     * @returns {boolean} true если авторизован
     */
    check(redirect = true) {
        const authData = localStorage.getItem('cloud-auth');

        if (!authData) {
            if (redirect) {
                this.redirectToLogin();
            }
            return false;
        }

        // Проверяем срок токена через TokenManager (1 час реальный срок Google)
        if (TokenManager.isExpired()) {
            // Если идёт синхронизация - пробуем silent refresh
            if (typeof SyncManager !== 'undefined' && SyncManager.hasPendingSync()) {
                // Запускаем async refresh, но не блокируем
                TokenManager.silentRefresh().then(refreshed => {
                    if (!refreshed) {
                        console.warn('⚠️ Не удалось обновить токен во время синхронизации');
                    }
                });
                return true; // Позволяем продолжить синхронизацию
            }

            localStorage.removeItem('cloud-auth');
            if (redirect) {
                this.redirectToLogin();
            }
            return false;
        }

        // Запускаем автоматическое обновление токена
        TokenManager.startAutoRefresh();

        return true;
    },

    /**
     * Проверка авторизации (async версия)
     * Можно использовать в init() модулей
     */
    async checkAsync(redirect = true) {
        return this.check(redirect);
    },

    /**
     * Получить данные текущего пользователя
     */
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

    /**
     * Выход из системы
     */
    logout() {
        // Проверяем, идёт ли синхронизация
        if (typeof SyncManager !== 'undefined' && SyncManager.hasPendingSync()) {
            const canLogout = SyncManager.canLogout();
            if (canLogout !== true) {
                alert(canLogout);
                return false;
            }
        }

        // Очищаем очередь синхронизации
        if (typeof SyncManager !== 'undefined') {
            localStorage.removeItem('sync-queue');
        }

        // Очищаем данные авторизации
        localStorage.removeItem('cloud-auth');
        localStorage.removeItem('cloud-storage-info');

        // Очищаем все кэшированные данные пользователя
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

        // Очищаем кэш CloudStorage
        if (typeof CloudStorage !== 'undefined' && CloudStorage.clearCache) {
            CloudStorage.clearCache();
        }

        this.redirectToLogin();
    },

    /**
     * Редирект на страницу входа
     */
    redirectToLogin() {
        // Сохраняем текущий URL для возврата после логина
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('auth-redirect', currentPath);

        window.location.href = this.LOGIN_URL;
    },

    /**
     * Получить URL для редиректа после логина
     */
    getRedirectUrl() {
        return sessionStorage.getItem('auth-redirect') || (this.getBasePath() + '/index.html');
    },

    /**
     * Очистить сохранённый URL редиректа
     */
    clearRedirectUrl() {
        sessionStorage.removeItem('auth-redirect');
    },

    /**
     * Добавить информацию о пользователе в header/sidebar
     * @param {string} containerId - ID контейнера для вставки
     */
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
                <button class="auth-logout-btn" onclick="AuthGuard.logout()" title="Выйти">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16,17 21,12 16,7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                </button>
            </div>
        `;
    },

    /**
     * Получить инициалы из имени
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
};

// CSS стили для user info (добавляются автоматически)
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

        /* Скрываем детали в свёрнутом сайдбаре */
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

// Автоматическая проверка при загрузке страницы
(function() {
    // Проверяем сразу при загрузке скрипта
    AuthGuard.check();
})();

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthGuard;
}
