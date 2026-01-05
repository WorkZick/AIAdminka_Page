/**
 * Login Module - AIAdminka Authorization
 * Использует стандартный OAuth для логина
 * Поддерживает систему ролей и регистрацию в команды
 */

const loginApp = {
    // OAuth Config
    CLIENT_ID: '552590459404-muqkuq0qa461763qfdt3ec62mfua49c6.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',

    // Динамический REDIRECT_URI
    get REDIRECT_URI() {
        const host = window.location.hostname;
        if (host === '127.0.0.1' || host === 'localhost') {
            return 'http://127.0.0.1:5500/SimpleAIAdminka/login/callback.html';
        }
        return 'https://workzick.github.io/AIAdminka_Page/login/callback.html';
    },

    // Apps Script URL
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyeWmZs028zVkzKTrqNTbzTasKK0Z63eCfV1I4RUV6BJWMH8r62kScLh7U5B45bHRRILA/exec',

    // Mock API режим (для тестирования без backend)
    USE_MOCK_API: true,

    // State
    currentUser: null,
    storageReady: false,
    pendingRequest: null,

    // ============ MOCK API DATA ============

    mockData: {
        // Состояния пользователей для тестирования (переключаются через консоль)
        // 'new' - новый пользователь (форма регистрации)
        // 'pending' - ожидает одобрения админа
        // 'approved_no_team' - одобрен, но не в команде (выбор роли)
        // 'approved' - одобрен и в команде (имеет доступ)
        // 'rejected' - отклонён админом
        // 'blocked' - заблокирован
        userState: 'new'
    },

    // ============ SECURITY ============

    generateState() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    // ============ INITIALIZATION ============

    init() {
        this.checkExistingAuth();
        this.checkAuthCallback();

        // Для отладки: переключение состояний через консоль
        if (this.USE_MOCK_API) {
            window.setMockState = (state) => {
                this.mockData.userState = state;
                console.log('Mock state set to:', state);
                console.log('Available states: new, pending, approved, rejected, blocked');
                this.retry();
            };
            console.log('Mock API enabled. Use setMockState("state") to test different states.');
            console.log('Available states: new, pending, approved, rejected, blocked');
        }
    },

    // ============ AUTH CHECK ============

    checkExistingAuth() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) {
            this.showLoginForm();
            return;
        }

        const auth = JSON.parse(authData);

        // Проверяем срок токена (~58 минут)
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
        const authData = localStorage.getItem('cloud-auth');
        if (authData) {
            const auth = JSON.parse(authData);
            const isRecent = Date.now() - auth.timestamp < 10000;

            if (isRecent && !this.currentUser) {
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
        const state = this.generateState();
        sessionStorage.setItem('oauth_state', state);

        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
            '?client_id=' + encodeURIComponent(this.CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(this.REDIRECT_URI) +
            '&response_type=token' +
            '&scope=' + encodeURIComponent(this.SCOPES) +
            '&state=' + encodeURIComponent(state) +
            '&prompt=consent';

        window.location.href = authUrl;
    },

    logout() {
        localStorage.removeItem('cloud-auth');
        localStorage.removeItem('cloud-storage-info');
        localStorage.removeItem('partners-data');
        localStorage.removeItem('traffic-analytics-temp');
        localStorage.removeItem('roleGuard');
        this.currentUser = null;
        this.storageReady = false;
        this.pendingRequest = null;
        this.showLoginForm();
    },

    // ============ API CALLS ============

    async secureApiCall(action, params = {}) {
        // Mock API для тестирования
        if (this.USE_MOCK_API) {
            return this.mockApiCall(action, params);
        }

        const url = new URL(this.SCRIPT_URL);
        url.searchParams.set('action', action);
        url.searchParams.set('accessToken', this.currentUser.accessToken);

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }

        const response = await fetch(url.toString(), { method: 'GET' });
        return response.json();
    },

    // ============ MOCK API ============

    async mockApiCall(action, params = {}) {
        // Имитация задержки сети
        await new Promise(resolve => setTimeout(resolve, 500));

        switch (action) {
            case 'checkAccess':
                return this.mockCheckAccess();

            case 'register':
                // Регистрация - только Reddy ID
                this.mockData.userState = 'pending';
                return {
                    success: true,
                    message: 'Запрос отправлен администратору'
                };

            case 'createTeam':
                // Создание команды - становимся руководителем
                this.mockData.userState = 'approved';
                return {
                    success: true,
                    teamId: 'team-' + Date.now(),
                    message: 'Команда создана'
                };

            case 'checkStorage':
                return { exists: true, sheetId: 'mock-sheet', folderId: 'mock-folder' };

            case 'init':
                return { success: true, sheetId: 'mock-sheet', folderId: 'mock-folder' };

            default:
                return { error: 'Unknown action: ' + action };
        }
    },

    mockCheckAccess() {
        const state = this.mockData.userState;

        switch (state) {
            case 'new':
                return {
                    allowed: false,
                    user: null,
                    status: 'new'
                };

            case 'pending':
                return {
                    allowed: false,
                    user: null,
                    status: 'pending'
                };

            case 'approved_no_team':
                return {
                    allowed: false,
                    user: {
                        email: this.currentUser?.email || 'test@example.com',
                        name: this.currentUser?.name || 'Тестовый Пользователь',
                        reddyId: '123456',
                        status: 'active',
                        teamId: null
                    },
                    status: 'approved_no_team'
                };

            case 'approved':
                return {
                    allowed: true,
                    user: {
                        email: this.currentUser?.email || 'test@example.com',
                        name: this.currentUser?.name || 'Тестовый Пользователь',
                        reddyId: '123456',
                        role: 'leader',
                        teamId: 'team-001',
                        status: 'active'
                    },
                    status: 'approved'
                };

            case 'rejected':
                return {
                    allowed: false,
                    user: null,
                    status: 'rejected'
                };

            case 'blocked':
                return {
                    allowed: false,
                    user: {
                        email: this.currentUser?.email || 'test@example.com',
                        name: this.currentUser?.name || 'Тестовый Пользователь',
                        status: 'blocked'
                    },
                    status: 'blocked'
                };

            default:
                return { allowed: false, status: 'new' };
        }
    },

    // ============ ACCESS CONTROL ============

    async checkAccess() {
        try {
            const result = await this.secureApiCall('checkAccess');

            if (result.error) {
                throw new Error(result.error);
            }

            switch (result.status) {
                case 'new':
                    this.showRegistration();
                    break;

                case 'pending':
                    this.showAccessPending();
                    break;

                case 'approved_no_team':
                    this.showChooseRole();
                    break;

                case 'approved':
                    this.showLoading('Проверка хранилища...');
                    this.checkStorage();
                    break;

                case 'rejected':
                    this.showAccessRejected();
                    break;

                case 'blocked':
                    this.showAccessBlocked();
                    break;

                default:
                    this.showError('Неизвестное состояние доступа');
            }

        } catch (error) {
            this.showError('Ошибка проверки доступа: ' + error.message);
        }
    },

    // ============ REGISTRATION ============

    showRegistration() {
        // Сброс формы
        document.getElementById('regReddyId').value = '';

        this.hideAll();
        this.showUserInfo();
        document.getElementById('loginRegistration').style.display = 'block';
        this.updateStatus('Регистрация', '');
    },

    async submitRegistration(event) {
        event.preventDefault();

        const form = document.getElementById('registrationForm');
        const btn = document.getElementById('btnSubmitRegistration');
        const formData = new FormData(form);

        const reddyId = formData.get('reddyId').trim();

        if (!reddyId) {
            alert('Введите Reddy ID');
            return false;
        }

        btn.disabled = true;
        btn.textContent = 'Отправка...';

        try {
            const result = await this.secureApiCall('register', {
                reddyId: reddyId,
                name: this.currentUser?.name || '',
                email: this.currentUser?.email || '',
                picture: this.currentUser?.picture || ''
            });

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.success) {
                this.showAccessPending();
            }

        } catch (error) {
            btn.disabled = false;
            btn.textContent = 'Отправить запрос';
            this.showError('Ошибка отправки запроса: ' + error.message);
        }

        return false;
    },

    // ============ CHOOSE ROLE ============

    showChooseRole() {
        this.hideAll();
        this.showUserInfo();
        document.getElementById('loginChooseRole').style.display = 'block';
        this.updateStatus('Выберите роль', 'success');
    },

    async createTeam() {
        this.showLoading('Создание команды...');

        try {
            const result = await this.secureApiCall('createTeam');

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.success) {
                this.checkStorage();
            }

        } catch (error) {
            this.showError('Ошибка создания команды: ' + error.message);
        }
    },

    waitForInvite() {
        this.hideAll();
        this.showUserInfo();

        // Показываем специальный экран ожидания приглашения
        document.getElementById('loginAccessPending').style.display = 'block';
        document.querySelector('#loginAccessPending .access-title').textContent = 'Ожидайте приглашение';
        document.querySelector('#loginAccessPending .access-description').innerHTML =
            'Ваш аккаунт активен.<br>Руководитель пригласит вас в команду по Reddy ID.';
        this.updateStatus('Ожидание приглашения', 'pending');
    },

    // ============ STATUS CHECK ============

    async checkStatus() {
        this.showLoading('Проверка статуса...');
        await this.checkAccess();
    },

    // ============ STORAGE ============

    async checkStorage() {
        try {
            const result = await this.secureApiCall('checkStorage');

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.exists) {
                this.storageReady = true;
                localStorage.setItem('cloud-storage-info', JSON.stringify({
                    sheetId: result.sheetId,
                    folderId: result.folderId
                }));
                this.showSuccess();
            } else {
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

    showAccessPending() {
        this.hideAll();
        this.showUserInfo();

        // Сбросить текст на дефолтный
        document.querySelector('#loginAccessPending .access-title').textContent = 'Запрос отправлен';
        document.querySelector('#loginAccessPending .access-description').innerHTML =
            'Ваш запрос отправлен администратору.<br>Ожидайте одобрения.';

        document.getElementById('loginAccessPending').style.display = 'block';
        this.updateStatus('Ожидание одобрения', 'pending');
    },

    showAccessRejected() {
        this.hideAll();
        this.showUserInfo();
        document.getElementById('loginAccessRejected').style.display = 'block';
        this.updateStatus('Запрос отклонён', 'error');
    },

    showAccessBlocked() {
        this.hideAll();
        this.showUserInfo();
        document.getElementById('loginAccessBlocked').style.display = 'block';
        this.updateStatus('Доступ заблокирован', 'error');
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
            avatarEl.innerHTML = '';
            const img = document.createElement('img');
            const pictureUrl = this.currentUser.picture;
            if (pictureUrl && pictureUrl.startsWith('https://lh')) {
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
        const elements = [
            'loginContent',
            'loginLoading',
            'loginUser',
            'loginActions',
            'loginContinue',
            'loginError',
            'loginRegistration',
            'loginAccessPending',
            'loginAccessRejected',
            'loginAccessBlocked',
            'loginChooseRole'
        ];

        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
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
