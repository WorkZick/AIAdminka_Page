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

        const auth = JSON.parse(authData);

        // Проверяем срок токена (8 часов)
        const sessionExpired = Date.now() - auth.timestamp > 28800000;

        if (sessionExpired) {
            // Если идёт синхронизация - продлеваем сессию автоматически
            if (typeof SyncManager !== 'undefined' && SyncManager.hasPendingSync()) {
                auth.timestamp = Date.now();
                localStorage.setItem('cloud-auth', JSON.stringify(auth));
                console.log('⏳ Сессия продлена - идёт синхронизация');
                return true;
            }

            localStorage.removeItem('cloud-auth');
            if (redirect) {
                this.redirectToLogin();
            }
            return false;
        }

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
