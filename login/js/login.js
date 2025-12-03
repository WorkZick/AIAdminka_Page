/**
 * Login Module - AIAdminka Authorization
 */

const loginApp = {
    // OAuth Config (используем те же данные что в sync)
    CLIENT_ID: '552590459404-muqkuq0qa461763qfdt3ec62mfua49c6.apps.googleusercontent.com',

    // Production REDIRECT_URI (GitHub Pages)
    REDIRECT_URI: 'https://workzick.github.io/AIAdminka_Page/login/callback.html',
    SCOPES: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' '),

    // Apps Script URL
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyeWmZs028zVkzKTrqNTbzTasKK0Z63eCfV1I4RUV6BJWMH8r62kScLh7U5B45bHRRILA/exec',

    // State
    currentUser: null,
    storageReady: false,

    // ============ SECURITY HELPERS ============

    /**
     * Генерация криптографически безопасного state параметра для CSRF защиты
     */
    generateState() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Безопасное экранирование HTML для предотвращения XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ============ INITIALIZATION ============

    init() {
        this.checkExistingAuth();
        this.checkAuthCallback();
    },

    // ============ AUTH CHECK ============

    checkExistingAuth() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) {
            this.showLoginForm();
            return;
        }

        const auth = JSON.parse(authData);

        // Проверяем срок токена (~58 минут, Google токен живёт 60 мин)
        // Silent refresh будет обновлять токен автоматически
        if (Date.now() - auth.timestamp > 3500000) {
            localStorage.removeItem('cloud-auth');
            this.showLoginForm();
            return;
        }

        this.currentUser = {
            email: auth.email,
            name: auth.name,
            picture: auth.picture,
            accessToken: auth.accessToken
        };

        this.showLoading('Проверка доступа...');
        this.checkAccess();
    },

    checkAuthCallback() {
        // Callback теперь сам сохраняет полные данные в cloud-auth
        // Проверяем, был ли свежий логин (токен получен менее 10 секунд назад)
        const authData = localStorage.getItem('cloud-auth');
        if (authData) {
            const auth = JSON.parse(authData);
            const isRecent = Date.now() - auth.timestamp < 10000; // Менее 10 сек назад

            if (isRecent && !this.currentUser) {
                // Свежий логин - загружаем пользователя
                this.currentUser = {
                    email: auth.email,
                    name: auth.name,
                    picture: auth.picture,
                    accessToken: auth.accessToken
                };
                this.showLoading('Проверка доступа...');
                this.checkAccess();
            }
        }
    },

    // ============ OAUTH ============

    login() {
        // Генерируем state параметр для CSRF защиты
        const state = this.generateState();
        sessionStorage.setItem('oauth_state', state);

        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
            '?client_id=' + encodeURIComponent(this.CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(this.REDIRECT_URI) +
            '&response_type=token' +
            '&scope=' + encodeURIComponent(this.SCOPES) +
            '&state=' + encodeURIComponent(state) +
            '&prompt=consent';

        // Открываем в том же окне для лучшего UX
        window.location.href = authUrl;
    },

    logout() {
        localStorage.removeItem('cloud-auth');
        localStorage.removeItem('cloud-storage-info');
        // Очищаем кэш данных пользователя
        localStorage.removeItem('partners-data');
        localStorage.removeItem('traffic-analytics-temp');
        this.currentUser = null;
        this.storageReady = false;
        this.showLoginForm();
    },

    async fetchUserInfo(accessToken) {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': 'Bearer ' + accessToken }
            });

            if (!response.ok) {
                throw new Error('Failed to get user info');
            }

            const userInfo = await response.json();

            // Сохраняем auth данные
            const authData = {
                accessToken: accessToken,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                timestamp: Date.now()
            };
            localStorage.setItem('cloud-auth', JSON.stringify(authData));

            this.currentUser = {
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                accessToken: accessToken
            };

            this.showLoading('Проверка доступа...');
            this.checkAccess();

        } catch (error) {
            console.error('fetchUserInfo error:', error);
            this.showError('Ошибка получения данных пользователя');
        }
    },

    // ============ ACCESS CONTROL ============

    /**
     * Безопасный запрос к API с токеном
     * Данные отправляются в URL параметрах (GAS теряет POST body при редиректе)
     */
    async secureApiCall(action, params = {}) {
        const url = new URL(this.SCRIPT_URL);
        url.searchParams.set('action', action);
        url.searchParams.set('accessToken', this.currentUser.accessToken);

        // Добавляем остальные параметры
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }

        const response = await fetch(url.toString(), {
            method: 'GET'
        });
        return response.json();
    },

    async checkAccess() {
        try {
            const result = await this.secureApiCall('checkAccess');

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.allowed) {
                // Доступ разрешён - проверяем хранилище
                this.showLoading('Проверка хранилища...');
                this.checkStorage();
            } else if (result.pendingRequest) {
                // Запрос уже отправлен
                this.showAccessPending();
            } else {
                // Доступ запрещён - показываем кнопку запроса
                this.showAccessDenied();
            }

        } catch (error) {
            this.showError('Ошибка проверки доступа: ' + error.message);
        }
    },

    async requestAccess() {
        const btn = document.getElementById('btnRequestAccess');
        btn.disabled = true;
        btn.textContent = 'Отправка...';

        try {
            const result = await this.secureApiCall('requestAccess', {
                name: this.currentUser.name || '',
                picture: this.currentUser.picture || ''
            });

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.success) {
                this.showAccessPending();
            }

        } catch (error) {
            btn.disabled = false;
            btn.textContent = 'Запросить доступ';
            this.showError('Ошибка отправки запроса: ' + error.message);
        }
    },

    // ============ STORAGE ============

    async checkStorage() {
        try {
            const result = await this.secureApiCall('checkStorage');

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.exists) {
                // Хранилище существует
                this.storageReady = true;
                localStorage.setItem('cloud-storage-info', JSON.stringify({
                    sheetId: result.sheetId,
                    folderId: result.folderId
                }));
                this.showSuccess();
            } else {
                // Нужно создать хранилище
                this.showInitStorage();
            }

        } catch (error) {
            this.showError('Ошибка проверки хранилища: ' + error.message);
        }
    },

    async initStorage() {
        const btn = document.getElementById('btnInit');
        btn.disabled = true;
        btn.textContent = 'Создание...';

        try {
            const result = await this.secureApiCall('init');

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.success) {
                this.storageReady = true;
                localStorage.setItem('cloud-storage-info', JSON.stringify({
                    sheetId: result.sheetId,
                    folderId: result.folderId,
                    imagesFolderId: result.imagesFolderId
                }));
                this.showSuccess();
            }

        } catch (error) {
            btn.disabled = false;
            btn.textContent = 'Создать хранилище';
            this.showError('Ошибка создания хранилища: ' + error.message);
        }
    },

    // ============ UI STATES ============

    showLoginForm() {
        this.hideAll();
        document.getElementById('loginContent').style.display = 'block';
        this.updateStatus('Требуется авторизация', '');
    },

    showLoading(text) {
        this.hideAll();
        document.getElementById('loginLoading').style.display = 'block';
        document.querySelector('#loginLoading p').textContent = text || 'Загрузка...';
    },

    showAccessDenied() {
        this.hideAll();
        this.showUserInfo();
        document.getElementById('loginAccessDenied').style.display = 'block';
        this.updateStatus('Доступ не разрешён', 'error');
    },

    showAccessPending() {
        this.hideAll();
        this.showUserInfo();
        document.getElementById('loginAccessPending').style.display = 'block';
        this.updateStatus('Запрос отправлен', 'pending');
    },

    showInitStorage() {
        this.hideAll();
        this.showUserInfo();
        document.getElementById('loginActions').style.display = 'block';
        this.updateStatus('Хранилище не найдено', '');
    },

    showSuccess() {
        this.hideAll();
        this.showUserInfo();
        document.getElementById('loginContinue').style.display = 'block';
        this.updateStatus('Авторизация успешна', 'success');
    },

    showError(message) {
        this.hideAll();
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('errorText').textContent = message;
        this.updateStatus('Ошибка', 'error');
    },

    showUserInfo() {
        if (!this.currentUser) return;

        const userEl = document.getElementById('loginUser');
        const avatarEl = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');

        if (this.currentUser.picture) {
            // Безопасное создание img элемента (защита от XSS)
            avatarEl.innerHTML = '';
            const img = document.createElement('img');
            // Валидируем URL - только HTTPS от Google
            const pictureUrl = this.currentUser.picture;
            if (pictureUrl && (pictureUrl.startsWith('https://lh3.googleusercontent.com/') ||
                              pictureUrl.startsWith('https://lh4.googleusercontent.com/') ||
                              pictureUrl.startsWith('https://lh5.googleusercontent.com/') ||
                              pictureUrl.startsWith('https://lh6.googleusercontent.com/'))) {
                img.src = pictureUrl;
                img.alt = '';
                img.onerror = () => { avatarEl.textContent = this.getInitials(this.currentUser.name); };
                avatarEl.appendChild(img);
            } else {
                avatarEl.textContent = this.getInitials(this.currentUser.name);
            }
        } else {
            avatarEl.textContent = this.getInitials(this.currentUser.name);
        }

        nameEl.textContent = this.currentUser.name || 'Пользователь';
        emailEl.textContent = this.currentUser.email;
        userEl.style.display = 'flex';
    },

    hideAll() {
        document.getElementById('loginContent').style.display = 'none';
        document.getElementById('loginLoading').style.display = 'none';
        document.getElementById('loginUser').style.display = 'none';
        document.getElementById('loginActions').style.display = 'none';
        document.getElementById('loginContinue').style.display = 'none';
        document.getElementById('loginError').style.display = 'none';
        document.getElementById('loginAccessDenied').style.display = 'none';
        document.getElementById('loginAccessPending').style.display = 'none';
    },

    updateStatus(text, type) {
        const statusEl = document.getElementById('loginStatus');
        statusEl.className = 'login-status' + (type ? ' ' + type : '');
        statusEl.querySelector('.status-text').textContent = text;
    },

    retry() {
        if (this.currentUser) {
            this.showLoading('Повторная проверка...');
            this.checkAccess();
        } else {
            this.showLoginForm();
        }
    },

    // ============ HELPERS ============

    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    loginApp.init();
});
