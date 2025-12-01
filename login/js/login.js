/**
 * Login Module - AIAdminka Authorization
 */

const loginApp = {
    // OAuth Config (используем те же данные что в sync)
    CLIENT_ID: '552590459404-muqkuq0qa461763qfdt3ec62mfua49c6.apps.googleusercontent.com',

    // Динамический REDIRECT_URI в зависимости от окружения
    get REDIRECT_URI() {
        const host = window.location.hostname;
        if (host === '127.0.0.1' || host === 'localhost') {
            return 'http://127.0.0.1:5500/SimpleAIAdminka/login/callback.html';
        }
        // GitHub Pages
        return 'https://workzick.github.io/AIAdminka_Page/login/callback.html';
    },
    SCOPES: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' '),

    // Apps Script URL
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyeWmZs028zVkzKTrqNTbzTasKK0Z63eCfV1I4RUV6BJWMH8r62kScLh7U5B45bHRRILA/exec',

    // State
    currentUser: null,
    storageReady: false,

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

        // Проверяем срок токена (8 часов)
        if (Date.now() - auth.timestamp > 28800000) {
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
        // Проверяем pending токен от callback
        const pendingData = localStorage.getItem('cloud-auth-pending');
        if (pendingData) {
            const pending = JSON.parse(pendingData);
            localStorage.removeItem('cloud-auth-pending');
            this.showLoading('Получение данных пользователя...');
            this.fetchUserInfo(pending.accessToken);
        }
    },

    // ============ OAUTH ============

    login() {
        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
            '?client_id=' + encodeURIComponent(this.CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(this.REDIRECT_URI) +
            '&response_type=token' +
            '&scope=' + encodeURIComponent(this.SCOPES) +
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

    async checkAccess() {
        try {
            const url = this.SCRIPT_URL +
                '?action=checkAccess' +
                '&email=' + encodeURIComponent(this.currentUser.email);

            const response = await fetch(url);
            const result = await response.json();

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
            console.error('checkAccess error:', error);
            this.showError('Ошибка проверки доступа: ' + error.message);
        }
    },

    async requestAccess() {
        const btn = document.getElementById('btnRequestAccess');
        btn.disabled = true;
        btn.textContent = 'Отправка...';

        try {
            const url = this.SCRIPT_URL +
                '?action=requestAccess' +
                '&email=' + encodeURIComponent(this.currentUser.email) +
                '&name=' + encodeURIComponent(this.currentUser.name || '') +
                '&picture=' + encodeURIComponent(this.currentUser.picture || '');

            const response = await fetch(url);
            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.success) {
                this.showAccessPending();
            }

        } catch (error) {
            console.error('requestAccess error:', error);
            btn.disabled = false;
            btn.textContent = 'Запросить доступ';
            this.showError('Ошибка отправки запроса: ' + error.message);
        }
    },

    // ============ STORAGE ============

    async checkStorage() {
        try {
            const url = this.SCRIPT_URL +
                '?action=checkStorage' +
                '&email=' + encodeURIComponent(this.currentUser.email);

            const response = await fetch(url);
            const result = await response.json();

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
            console.error('checkStorage error:', error);
            this.showError('Ошибка проверки хранилища: ' + error.message);
        }
    },

    async initStorage() {
        const btn = document.getElementById('btnInit');
        btn.disabled = true;
        btn.textContent = 'Создание...';

        try {
            const url = this.SCRIPT_URL +
                '?action=init' +
                '&email=' + encodeURIComponent(this.currentUser.email);

            const response = await fetch(url);
            const result = await response.json();

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
            console.error('initStorage error:', error);
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
            avatarEl.innerHTML = '<img src="' + this.currentUser.picture + '" alt="">';
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
