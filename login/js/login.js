/**
 * Login Module - AIAdminka Authorization
 * Использует стандартный OAuth для логина
 * Поддерживает систему ролей и регистрацию в команды
 */

const loginApp = {
    CLIENT_ID: '552590459404-muqkuq0qa461763qfdt3ec62mfua49c6.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',

    get REDIRECT_URI() {
        const host = window.location.hostname;
        if (host === '127.0.0.1' || host === 'localhost') {
            return 'http://127.0.0.1:5500/SimpleAIAdminka/login/callback.html';
        }
        return 'https://workzick.github.io/AIAdminka_Page/login/callback.html';
    },

    get SCRIPT_URL() {
        return EnvConfig.getScriptUrl();
    },

    currentUser: null,
    currentRole: null,
    storageReady: false,
    _clickHandler: null,
    _submitHandler: null,

    // ============ SECURITY ============

    _generateState() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    // ============ INITIALIZATION ============

    init() {
        this._bindEvents();

        const hasExistingAuth = this._checkExistingAuth();
        if (!hasExistingAuth) {
            this._checkAuthCallback();
        }
    },

    _bindEvents() {
        this._clickHandler = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            switch (btn.dataset.action) {
                case 'login': this._login(); break;
                case 'logout': this._logout(); break;
                case 'init-storage': this._initStorage(); break;
                case 'retry': this._retry(); break;
                case 'check-status': this._checkStatus(); break;
                case 'create-team': this._createTeam(); break;
                case 'wait-invite': this._waitForInvite(); break;
                case 'show-registration': this._showRegistration(); break;
            }
        };
        document.addEventListener('click', this._clickHandler);

        this._submitHandler = (e) => {
            if (e.target.id === 'registrationForm') {
                this._submitRegistration(e);
            }
        };
        document.addEventListener('submit', this._submitHandler);

        // Leader toggle handler
        const leaderCheckbox = document.getElementById('regIsLeader');
        if (leaderCheckbox) {
            this._leaderToggleHandler = () => {
                const details = document.getElementById('leaderDetails');
                const teamNameInput = document.getElementById('regTeamName');
                if (leaderCheckbox.checked) {
                    details.classList.remove('hidden');
                    teamNameInput.required = true;
                } else {
                    details.classList.add('hidden');
                    teamNameInput.required = false;
                }
            };
            leaderCheckbox.addEventListener('change', this._leaderToggleHandler);
        }
    },

    destroy() {
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }
        if (this._submitHandler) {
            document.removeEventListener('submit', this._submitHandler);
            this._submitHandler = null;
        }
        if (this._leaderToggleHandler) {
            const cb = document.getElementById('regIsLeader');
            if (cb) cb.removeEventListener('change', this._leaderToggleHandler);
            this._leaderToggleHandler = null;
        }
    },

    // ============ AUTH CHECK ============

    _checkExistingAuth() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) {
            this._showLoginForm();
            return false;
        }

        try {
            const auth = JSON.parse(authData);

            if (Date.now() - auth.timestamp > 3500000) {
                localStorage.removeItem('cloud-auth');
                this._showLoginForm();
                return false;
            }

            this.currentUser = {
                email: auth.email,
                name: auth.name,
                picture: auth.picture,
                accessToken: auth.accessToken
            };
        } catch {
            localStorage.removeItem('cloud-auth');
            this._showLoginForm();
            return false;
        }

        this._showLoading('Проверка доступа...');
        this._checkAccess();
        return true;
    },

    _checkAuthCallback() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return;

        try {
            const auth = JSON.parse(authData);
            const isRecent = Date.now() - auth.timestamp < 10000;

            if (isRecent && !this.currentUser) {
                this.currentUser = {
                    email: auth.email,
                    name: auth.name,
                    picture: auth.picture,
                    accessToken: auth.accessToken
                };
                this._showLoading('Проверка доступа...');
                this._checkAccess();
            }
        } catch {
            localStorage.removeItem('cloud-auth');
        }
    },

    // ============ OAUTH ============

    _login() {
        const state = this._generateState();
        sessionStorage.setItem('oauth_state', JSON.stringify({ value: state, created: Date.now() }));

        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
            '?client_id=' + encodeURIComponent(this.CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(this.REDIRECT_URI) +
            '&response_type=token' +
            '&scope=' + encodeURIComponent(this.SCOPES) +
            '&state=' + encodeURIComponent(state) +
            '&prompt=consent';

        window.location.href = authUrl;
    },

    _logout() {
        this.destroy();
        localStorage.removeItem('cloud-auth');
        localStorage.removeItem('cloud-storage-info');
        localStorage.removeItem('partners-data');
        localStorage.removeItem('traffic-analytics-temp');
        localStorage.removeItem('roleGuard');
        this.currentUser = null;
        this.currentRole = null;
        this.storageReady = false;
        this._showLoginForm();
    },

    // ============ API CALLS ============

    async _secureApiCall(action, params = {}) {
        if (!this.currentUser?.accessToken) {
            return { error: 'No access token' };
        }

        try {
            const url = new URL(this.SCRIPT_URL);
            url.searchParams.set('action', action);
            url.searchParams.set('accessToken', this.currentUser.accessToken);

            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
                }
            }

            const response = await fetch(url.toString(), { method: 'GET' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Ошибка сети. Проверьте подключение к интернету.');
            }
            throw error;
        }
    },

    // ============ ACCESS CONTROL ============

    async _checkAccess() {
        try {
            const result = await this._secureApiCall('checkAccess');

            if (result.error) {
                if (result.error.includes('access token') || result.error.includes('Access denied') || result.error.includes('Invalid')) {
                    localStorage.removeItem('cloud-auth');
                    localStorage.removeItem('roleGuard');
                    sessionStorage.removeItem('auth-redirect');
                    this.currentUser = null;
                    this._showLoginForm();
                    return;
                }
                throw new Error(result.error);
            }

            let status;
            const isNewFormat = 'hasAccess' in result || ('status' in result && !('allowed' in result));

            if (isNewFormat) {
                if (result.status === 'waiting_invite') {
                    status = 'waiting_invite';
                } else if (result.status === 'blocked') {
                    status = 'blocked';
                } else if (result.status === 'approved_no_team') {
                    status = 'approved_no_team';
                } else if (result.hasAccess === true) {
                    status = 'approved';
                } else if (!result.email && !result.role) {
                    status = 'new';
                } else {
                    switch (result.status) {
                        case 'active':
                            if (result.role === 'admin' || result.teamId) {
                                status = 'approved';
                            } else {
                                status = 'approved_no_team';
                            }
                            break;
                        case 'pending':
                            status = 'pending';
                            break;
                        default:
                            status = result.status || 'new';
                    }
                }
            } else {
                if (result.allowed === true) {
                    status = 'approved';
                } else if (result.pendingRequest === true) {
                    status = result.status || 'pending';
                } else if (result.allowed === false && result.pendingRequest === false) {
                    status = 'new';
                } else {
                    status = result.status;
                }
            }

            this.currentRole = result.role || null;

            if (result.role === 'guest' && status !== 'approved_no_team') {
                window.location.href = 'waiting-invite.html';
                return;
            }

            switch (status) {
                case 'new':
                    this._showRegistration();
                    break;
                case 'pending':
                    this._showAccessPending();
                    break;
                case 'approved_no_team':
                    this._showChooseRole();
                    break;
                case 'approved':
                    this._showLoading('Проверка хранилища...');
                    this._checkStorage();
                    break;
                case 'rejected':
                    this._showAccessRejected();
                    break;
                case 'blocked':
                    this._showAccessBlocked();
                    break;
                case 'waiting_invite':
                    window.location.href = 'waiting-invite.html';
                    break;
                default:
                    this._showError(`Неизвестное состояние доступа: ${status || 'undefined'}`);
            }

        } catch (error) {
            this._showError('Ошибка проверки доступа: ' + error.message);
        }
    },

    // ============ REGISTRATION ============

    _showRegistration() {
        sessionStorage.removeItem('auth-redirect');
        const input = document.getElementById('regReddyId');
        if (input) input.value = '';

        // Reset leader toggle and fields
        const leaderCb = document.getElementById('regIsLeader');
        if (leaderCb) leaderCb.checked = false;
        const leaderDetails = document.getElementById('leaderDetails');
        if (leaderDetails) leaderDetails.classList.add('hidden');
        const teamName = document.getElementById('regTeamName');
        if (teamName) { teamName.value = ''; teamName.required = false; }
        const teamDesc = document.getElementById('regTeamDesc');
        if (teamDesc) teamDesc.value = '';

        this._hideAll();
        this._showUserInfo();
        document.getElementById('loginRegistration').classList.remove('hidden');
        this._updateStatus('Регистрация', '');
    },

    async _submitRegistration(event) {
        event.preventDefault();

        const form = document.getElementById('registrationForm');
        const btn = document.getElementById('btnSubmitRegistration');
        const formData = new FormData(form);
        const reddyId = formData.get('reddyId').trim();

        if (!reddyId) {
            Toast.warning('Введите Reddy ID');
            return;
        }

        const isLeader = document.getElementById('regIsLeader')?.checked || false;
        const teamName = (formData.get('teamName') || '').trim();
        const teamDescription = (formData.get('teamDescription') || '').trim();

        if (isLeader && (!teamName || teamName.length < 2)) {
            Toast.warning('Укажите название команды (минимум 2 символа)');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Отправка...';

        try {
            const params = {
                reddyId,
                name: this.currentUser?.name || '',
                email: this.currentUser?.email || '',
                picture: this.currentUser?.picture || ''
            };

            if (isLeader) {
                params.isLeaderRequest = 'true';
                params.teamName = teamName;
                params.teamDescription = teamDescription;
            }

            const result = await this._secureApiCall('register', params);

            if (result.error) throw new Error(result.error);
            if (result.success) this._showAccessPending();
        } catch (error) {
            btn.disabled = false;
            btn.textContent = 'Отправить запрос';
            this._showError('Ошибка отправки запроса: ' + error.message);
        }
    },

    // ============ CHOOSE ROLE ============

    _showChooseRole() {
        sessionStorage.removeItem('auth-redirect');
        this._hideAll();
        this._showUserInfo();
        document.getElementById('loginChooseRole').classList.remove('hidden');
        this._updateStatus('Выберите роль', 'success');
    },

    async _createTeam() {
        this._showLoading('Создание команды...');

        try {
            const result = await this._secureApiCall('createTeam');
            if (result.error) throw new Error(result.error);
            if (result.success) this._checkStorage();
        } catch (error) {
            this._showError('Ошибка создания команды: ' + error.message);
        }
    },

    _waitForInvite() {
        this._hideAll();
        this._showUserInfo();

        const pendingEl = document.getElementById('loginAccessPending');
        if (pendingEl) {
            pendingEl.classList.remove('hidden');
            const titleEl = pendingEl.querySelector('.access-title');
            if (titleEl) titleEl.textContent = 'Ожидайте приглашение';
            const descEl = pendingEl.querySelector('.access-description');
            if (descEl) {
                descEl.textContent = '';
                descEl.append('Ваш аккаунт активен.', document.createElement('br'), 'Руководитель пригласит вас в команду по Reddy ID.');
            }
        }

        this._updateStatus('Ожидание приглашения', 'pending');
    },

    // ============ STATUS CHECK ============

    async _checkStatus() {
        this._showLoading('Проверка статуса...');
        await this._checkAccess();
    },

    // ============ STORAGE ============

    async _checkStorage() {
        try {
            const result = await this._secureApiCall('checkStorage');

            if (result.error) {
                if (result.error.includes('Unknown action')) {
                    this.storageReady = true;
                    this._showSuccess();
                    return;
                }
                throw new Error(result.error);
            }

            if (result.exists) {
                this.storageReady = true;
                localStorage.setItem('cloud-storage-info', JSON.stringify({
                    sheetId: result.sheetId,
                    folderId: result.folderId
                }));
                this._showSuccess();
            } else {
                const canInitStorage = this.currentRole === 'admin' || this.currentRole === 'leader';

                if (canInitStorage) {
                    this._showInitStorage();
                } else {
                    this.storageReady = false;
                    this._showSuccess();
                }
            }
        } catch (error) {
            this._showError('Ошибка проверки хранилища: ' + error.message);
        }
    },

    async _initStorage() {
        const btn = document.getElementById('btnInit');
        btn.disabled = true;
        btn.textContent = 'Создание...';

        try {
            const result = await this._secureApiCall('init');
            if (result.error) throw new Error(result.error);

            if (result.success) {
                this.storageReady = true;
                localStorage.setItem('cloud-storage-info', JSON.stringify({
                    sheetId: result.sheetId,
                    folderId: result.folderId,
                    imagesFolderId: result.imagesFolderId
                }));
                this._showSuccess();
            }
        } catch (error) {
            btn.disabled = false;
            btn.textContent = 'Создать хранилище';
            this._showError('Ошибка создания хранилища: ' + error.message);
        }
    },

    // ============ UI STATES ============

    _showLoginForm() {
        this._hideAll();
        document.getElementById('loginContent').classList.remove('hidden');
        this._updateStatus('Требуется авторизация', '');
    },

    _showLoading(text) {
        this._hideAll();
        document.getElementById('loginLoading').classList.remove('hidden');
        document.querySelector('#loginLoading p').textContent = text || 'Загрузка...';
    },

    _showAccessPending() {
        sessionStorage.removeItem('auth-redirect');
        this._hideAll();
        this._showUserInfo();

        const pendingEl = document.getElementById('loginAccessPending');
        if (pendingEl) {
            const titleEl = pendingEl.querySelector('.access-title');
            if (titleEl) titleEl.textContent = 'Запрос отправлен';
            const descEl = pendingEl.querySelector('.access-description');
            if (descEl) {
                descEl.textContent = '';
                descEl.append('Ваш запрос отправлен администратору.', document.createElement('br'), 'Ожидайте одобрения.');
            }
            pendingEl.classList.remove('hidden');
        }

        this._updateStatus('Ожидание одобрения', 'pending');
    },

    _showAccessRejected() {
        sessionStorage.removeItem('auth-redirect');
        this._hideAll();
        this._showUserInfo();
        document.getElementById('loginAccessRejected').classList.remove('hidden');
        this._updateStatus('Запрос отклонён', 'error');
    },

    _showAccessBlocked() {
        sessionStorage.removeItem('auth-redirect');
        this._hideAll();
        this._showUserInfo();
        document.getElementById('loginAccessBlocked').classList.remove('hidden');
        this._updateStatus('Доступ заблокирован', 'error');
    },

    _showInitStorage() {
        this._hideAll();
        this._showUserInfo();
        document.getElementById('loginActions').classList.remove('hidden');
        this._updateStatus('Хранилище не найдено', '');
    },

    _showSuccess() {
        this._hideAll();
        this._showUserInfo();
        document.getElementById('loginContinue').classList.remove('hidden');
        this._updateStatus('Авторизация успешна', 'success');

        setTimeout(() => {
            // Проверяем, есть ли сохранённый URL для возврата
            const redirectUrl = sessionStorage.getItem('auth-redirect');
            if (redirectUrl) {
                sessionStorage.removeItem('auth-redirect');
                // Валидация: только относительные URL (защита от open redirect)
                if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
                    window.location.href = redirectUrl;
                    return;
                }
            }
            window.location.href = '../index.html';
        }, 1500);
    },

    _showError(message) {
        this._hideAll();
        document.getElementById('loginError').classList.remove('hidden');
        document.getElementById('errorText').textContent = message;
        this._updateStatus('Ошибка', 'error');
    },

    _showUserInfo() {
        if (!this.currentUser) return;

        const userEl = document.getElementById('loginUser');
        const avatarEl = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');

        if (this.currentUser.picture) {
            avatarEl.innerHTML = '';
            const pictureUrl = this.currentUser.picture;
            if (pictureUrl && pictureUrl.startsWith('https://lh')) {
                const img = document.createElement('img');
                img.src = pictureUrl;
                img.alt = '';
                img.onerror = () => { avatarEl.textContent = this._getInitials(this.currentUser.name); };
                avatarEl.appendChild(img);
            } else {
                avatarEl.textContent = this._getInitials(this.currentUser.name);
            }
        } else {
            avatarEl.textContent = this._getInitials(this.currentUser.name);
        }

        nameEl.textContent = this.currentUser.name || 'Пользователь';
        emailEl.textContent = this.currentUser.email;
        userEl.classList.remove('hidden');
    },

    _hideAll() {
        const ids = [
            'loginContent', 'loginLoading', 'loginUser', 'loginActions',
            'loginContinue', 'loginError', 'loginRegistration',
            'loginAccessPending', 'loginAccessRejected', 'loginAccessBlocked',
            'loginChooseRole'
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    },

    _updateStatus(text, type) {
        const statusEl = document.getElementById('loginStatus');
        if (!statusEl) return;
        statusEl.className = 'login-status' + (type ? ' ' + type : '');
        const statusText = statusEl.querySelector('.status-text');
        if (statusText) statusText.textContent = text;
    },

    _retry() {
        if (this.currentUser) {
            this._showLoading('Повторная проверка...');
            this._checkAccess();
        } else {
            this._showLoginForm();
        }
    },

    // ============ HELPERS ============

    _getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
};

document.addEventListener('DOMContentLoaded', () => loginApp.init());
window.addEventListener('beforeunload', () => loginApp.destroy());
