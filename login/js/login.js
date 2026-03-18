/**
 * Login Module - AIAdminka Authorization
 * Использует стандартный OAuth для логина
 * Поддерживает систему ролей и регистрацию в команды
 *
 * Два режима отображения:
 * - Simple card (single column): login form + initial loading
 * - Wide card (two columns): all logged-in states
 */

const loginApp = {
    get SCRIPT_URL() {
        return EnvConfig.getScriptUrl();
    },

    currentUser: null,
    currentRole: null,
    storageReady: false,
    _userInfoPopulated: false,
    _clickHandler: null,
    _submitHandler: null,

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
        this._hideableElements = null;
        this._userInfoPopulated = false;
    },

    // ============ AUTH CHECK ============

    _checkExistingAuth() {
        const authData = sessionStorage.getItem('cloud-auth');
        if (!authData) {
            this._showLoginForm();
            return false;
        }

        try {
            const auth = JSON.parse(authData);

            // TokenManager недоступен на login page (auth-guard.js не подключён)
            const TOKEN_LIFETIME = (typeof TokenManager !== 'undefined') ? TokenManager.TOKEN_LIFETIME : 3500000;
            if (Date.now() - auth.timestamp > TOKEN_LIFETIME) {
                sessionStorage.removeItem('cloud-auth');
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
            sessionStorage.removeItem('cloud-auth');
            this._showLoginForm();
            return false;
        }

        this._showLoading('Проверка доступа...');
        this._checkAccess();
        return true;
    },

    _checkAuthCallback() {
        // currentUser уже проверен в _checkExistingAuth, повторный JSON.parse не нужен
        if (this.currentUser) return;

        const authData = sessionStorage.getItem('cloud-auth');
        if (!authData) return;

        try {
            const auth = JSON.parse(authData);
            const isRecent = Date.now() - auth.timestamp < 10000;

            if (isRecent) {
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
            sessionStorage.removeItem('cloud-auth');
        }
    },

    // ============ OAUTH ============

    _login() {
        const oauth = EnvConfig.OAUTH;
        const state = oauth.generateState();
        sessionStorage.setItem('oauth_state', state);

        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
            '?client_id=' + encodeURIComponent(oauth.CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(oauth.getRedirectUri()) +
            '&response_type=token' +
            '&scope=' + encodeURIComponent(oauth.SCOPES) +
            '&state=' + encodeURIComponent(state) +
            '&prompt=consent';

        window.location.href = authUrl;
    },

    _logout() {
        this.destroy();
        sessionStorage.removeItem('cloud-auth');
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

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Сервер не отвечает. Попробуйте позже.');
            }
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
                    sessionStorage.removeItem('cloud-auth');
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
                    // Проверяем sessionStorage — возможно пользователь только что зарегистрировался,
                    // но бэкенд ещё не возвращает pending статус из checkAccess
                    status = sessionStorage.getItem('registration-pending') ? 'pending' : 'new';
                } else {
                    switch (result.status) {
                        case 'active':
                            if (result.role === 'admin' || result.isAdmin === true || result.teamId) {
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

            // Очищаем флаг pending при одобрении
            if (status !== 'new' && status !== 'pending') {
                sessionStorage.removeItem('registration-pending');
            }

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

        this._switchToWideCard();
        this._hideAllRight();
        document.getElementById('loginRegistration').classList.remove('hidden');
        this._updateStatus('Регистрация', '');
    },

    async _submitRegistration(event) {
        event.preventDefault();

        const form = document.getElementById('registrationForm');
        const btn = document.getElementById('btnSubmitRegistration');
        const formData = new FormData(form);
        const reddyId = formData.get('reddyId').trim();

        if (!reddyId || !/^\d{4,10}$/.test(reddyId)) {
            Toast.warning('Введите корректный Reddy ID (4-10 цифр)');
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

            if (result.error) {
                // Запрос уже существует — показываем экран ожидания
                if (result.status === 'pending') {
                    sessionStorage.setItem('registration-pending', 'true');
                    this._showAccessPending();
                    return;
                }
                throw new Error(result.error);
            }
            if (result.success) {
                sessionStorage.setItem('registration-pending', 'true');
                this._showAccessPending();
            }
        } catch (error) {
            btn.disabled = false;
            btn.textContent = 'Отправить запрос';
            this._showError('Ошибка отправки запроса: ' + error.message);
        }
    },

    // ============ CHOOSE ROLE ============

    _showChooseRole() {
        sessionStorage.removeItem('auth-redirect');
        this._switchToWideCard();
        this._hideAllRight();
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
        this._switchToWideCard();
        this._hideAllRight();

        const pendingEl = document.getElementById('loginAccessPending');
        if (pendingEl) {
            pendingEl.classList.remove('hidden');
            const titleEl = pendingEl.querySelector('.waiting-title');
            if (titleEl) titleEl.textContent = 'Ожидайте приглашение';
            const descEl = pendingEl.querySelector('.waiting-description');
            if (descEl) descEl.innerHTML = 'Ваш аккаунт активен.<br>Руководитель пригласит вас в команду по Reddy ID.';
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
                // Бэкенд без checkStorage endpoint возвращает "Unknown action" —
                // это значит хранилище не нуждается в проверке, считаем готовым
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

    /**
     * Switch to the simple single-column card (login form)
     */
    _showLoginForm() {
        // Show simple card, hide wide card
        document.getElementById('loginCardSimple').classList.remove('hidden');
        document.getElementById('loginFooterSimple').classList.remove('hidden');
        document.getElementById('loginCardWide').classList.add('hidden');

        // Show login form, hide loading
        document.getElementById('loginContent').classList.remove('hidden');
        document.getElementById('loginLoadingSimple').classList.add('hidden');
        document.getElementById('loginStatus').classList.add('hidden');
    },

    /**
     * Switch to the two-column wide card and populate user info
     */
    _switchToWideCard() {
        document.getElementById('loginCardSimple').classList.add('hidden');
        document.getElementById('loginFooterSimple').classList.add('hidden');
        document.getElementById('loginCardWide').classList.remove('hidden');
        this._populateUserInfo();
    },

    /**
     * Show loading state (auto-detects which card to use)
     */
    _showLoading(text) {
        if (this.currentUser) {
            // Wide card mode
            this._switchToWideCard();
            this._hideAllRight();
            const loadingEl = document.getElementById('loginLoading');
            loadingEl.classList.remove('hidden');
            loadingEl.querySelector('p').textContent = text || 'Загрузка...';
        } else {
            // Simple card mode (initial auth check)
            document.getElementById('loginContent').classList.add('hidden');
            const loadingEl = document.getElementById('loginLoadingSimple');
            loadingEl.classList.remove('hidden');
            loadingEl.querySelector('p').textContent = text || 'Загрузка...';
        }
    },

    _showAccessPending() {
        sessionStorage.removeItem('auth-redirect');
        this._switchToWideCard();
        this._hideAllRight();

        const pendingEl = document.getElementById('loginAccessPending');
        if (pendingEl) {
            const titleEl = pendingEl.querySelector('.waiting-title');
            if (titleEl) titleEl.textContent = 'Запрос отправлен';
            const descEl = pendingEl.querySelector('.waiting-description');
            if (descEl) descEl.innerHTML = 'Ваш запрос отправлен администратору.<br>Ожидайте одобрения.';
            pendingEl.classList.remove('hidden');
        }

        this._updateStatus('Ожидание одобрения', 'pending');
    },

    _showAccessRejected() {
        sessionStorage.removeItem('auth-redirect');
        this._switchToWideCard();
        this._hideAllRight();
        document.getElementById('loginAccessRejected').classList.remove('hidden');
        this._updateStatus('Запрос отклонён', 'error');
    },

    _showAccessBlocked() {
        sessionStorage.removeItem('auth-redirect');
        this._switchToWideCard();
        this._hideAllRight();
        document.getElementById('loginAccessBlocked').classList.remove('hidden');
        this._updateStatus('Доступ заблокирован', 'error');
    },

    _showInitStorage() {
        this._switchToWideCard();
        this._hideAllRight();
        document.getElementById('loginActions').classList.remove('hidden');
        this._updateStatus('Хранилище не найдено', '');
    },

    _showSuccess() {
        this._switchToWideCard();
        this._hideAllRight();
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
        if (this.currentUser) {
            this._switchToWideCard();
            this._hideAllRight();
            document.getElementById('loginError').classList.remove('hidden');
            document.getElementById('errorText').textContent = message;
            this._updateStatus('Ошибка', 'error');
        } else {
            // Fallback for errors before login (shouldn't normally happen)
            this._showLoginForm();
        }
    },

    /**
     * Populate user info in the left panel of the wide card
     */
    _populateUserInfo() {
        if (!this.currentUser || this._userInfoPopulated) return;
        this._userInfoPopulated = true;

        const avatarEl = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');

        if (this.currentUser.picture) {
            avatarEl.innerHTML = '';
            const pictureUrl = this.currentUser.picture;
            if (Utils.isGoogleAvatar(pictureUrl)) {
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
    },

    /**
     * Hide all content sections in the right panel of the wide card
     */
    _hideAllRight() {
        if (!this._hideableElements) {
            const ids = [
                'loginLoading', 'loginRegistration', 'loginAccessPending',
                'loginChooseRole', 'loginActions', 'loginContinue',
                'loginError', 'loginAccessRejected', 'loginAccessBlocked'
            ];
            this._hideableElements = ids.map(id => document.getElementById(id)).filter(Boolean);
        }

        this._hideableElements.forEach(el => {
            el.classList.add('hidden');
        });
    },

    _updateStatus(text, type) {
        const statusEl = document.getElementById('loginStatus');
        statusEl.className = 'login-status' + (type ? ' ' + type : '');
        statusEl.querySelector('.status-text').textContent = text;
        statusEl.classList.remove('hidden');
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

    _getInitials(name) { return Utils.getInitials(name); }
};

document.addEventListener('DOMContentLoaded', () => loginApp.init());
window.addEventListener('beforeunload', () => loginApp.destroy());
