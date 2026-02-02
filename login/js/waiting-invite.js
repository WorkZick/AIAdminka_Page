/**
 * Waiting Invite Page - Logic
 * Экран ожидания приглашения для пользователей со статусом 'waiting_invite'
 */

const WaitingInvite = {
    // Интервал автоматического обновления (30 секунд)
    REFRESH_INTERVAL: 30000,

    // ID интервала
    refreshIntervalId: null,

    // Состояние
    isLoading: false,
    isRedirecting: false,  // Флаг редиректа - предотвращает повторные вызовы
    user: null,
    invites: [],

    /**
     * Инициализация страницы
     */
    async init() {
        // Проверить авторизацию
        const auth = this.getAuthData();
        if (!auth) {
            this.redirectToLogin();
            return;
        }

        // Отобразить информацию о пользователе
        this.user = {
            email: auth.email,
            name: auth.name || auth.email.split('@')[0],
            picture: auth.picture || ''
        };
        this.renderUserInfo();

        // Привязать события
        this.bindEvents();

        // Загрузить приглашения
        await this.loadInvites();

        // Запустить автоматическое обновление
        this.startAutoRefresh();
    },

    /**
     * Получение данных авторизации из localStorage
     */
    getAuthData() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) return null;

        try {
            const auth = JSON.parse(authData);

            // Проверить срок токена
            if (Date.now() - auth.timestamp > 3500000) {
                localStorage.removeItem('cloud-auth');
                return null;
            }

            return auth;
        } catch (e) {
            console.error('WaitingInvite: Failed to parse auth data:', e);
            return null;
        }
    },

    /**
     * Получение access token
     */
    getAccessToken() {
        const auth = this.getAuthData();
        return auth ? auth.access_token : null;
    },

    /**
     * Редирект на страницу логина
     */
    redirectToLogin() {
        window.location.href = '/SimpleAIAdminka/login/';
    },

    /**
     * Редирект на главную
     */
    redirectToHome() {
        window.location.href = '/SimpleAIAdminka/';
    },

    /**
     * Привязка событий
     */
    bindEvents() {
        // Кнопка обновления
        const btnRefresh = document.getElementById('btnRefresh');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => this.loadInvites());
        }

        // Кнопка выхода
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => this.logout());
        }
    },

    /**
     * Запуск автоматического обновления
     */
    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshIntervalId = setInterval(() => {
            this.loadInvites();
        }, this.REFRESH_INTERVAL);
    },

    /**
     * Остановка автоматического обновления
     */
    stopAutoRefresh() {
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId);
            this.refreshIntervalId = null;
        }
    },

    /**
     * Отображение информации о пользователе
     */
    renderUserInfo() {
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');

        if (userName) {
            userName.textContent = this.user.name;
        }

        if (userEmail) {
            userEmail.textContent = this.user.email;
        }

        if (userAvatar) {
            if (this.user.picture) {
                userAvatar.innerHTML = `<img src="${this.escapeHtml(this.user.picture)}" alt="${this.escapeHtml(this.user.name)}">`;
            } else {
                userAvatar.textContent = this.user.name.charAt(0).toUpperCase();
            }
        }
    },

    /**
     * Загрузка приглашений
     */
    async loadInvites() {
        if (this.isLoading || this.isRedirecting) return;

        this.isLoading = true;
        this.showLoading(true);

        try {
            const result = await CloudStorage.callApi('getInvites');

            if (result.success) {
                this.invites = result.invites || [];
                this.renderInvites();
            } else {
                throw new Error(result.error || 'Ошибка загрузки приглашений');
            }
        } catch (error) {
            console.error('WaitingInvite: Failed to load invites:', error);

            // Проверить тип ошибки
            if (error.message.includes('Only guests can view invites')) {
                // Пользователь уже не guest - редирект на главную
                this.isRedirecting = true;
                this.stopAutoRefresh();
                Toast.success('Вы уже в команде!');
                setTimeout(() => this.redirectToHome(), 1500);
                return;
            }

            if (error.message.includes('Access denied') || error.message.includes('Invalid access token')) {
                this.isRedirecting = true;
                this.stopAutoRefresh();
                Toast.error('Сессия истекла. Войдите снова.');
                setTimeout(() => this.redirectToLogin(), 1500);
                return;
            }

            Toast.error('Ошибка: ' + error.message);
            this.renderNoInvites();
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    },

    /**
     * Отображение состояния загрузки
     */
    showLoading(show) {
        const loading = document.getElementById('invitesLoading');
        const noInvites = document.getElementById('noInvites');
        const invitesSection = document.getElementById('invitesSection');
        const refreshBtn = document.getElementById('btnRefresh');

        if (loading) {
            loading.classList.toggle('hidden', !show);
        }

        if (show) {
            if (noInvites) noInvites.classList.add('hidden');
            if (invitesSection) invitesSection.classList.add('hidden');
        }

        if (refreshBtn) {
            refreshBtn.disabled = show;
            refreshBtn.classList.toggle('loading', show);
        }
    },

    /**
     * Отображение списка приглашений
     */
    renderInvites() {
        const invitesSection = document.getElementById('invitesSection');
        const invitesList = document.getElementById('invitesList');
        const noInvites = document.getElementById('noInvites');

        if (!this.invites || this.invites.length === 0) {
            this.renderNoInvites();
            return;
        }

        // Скрыть "нет приглашений", показать секцию
        if (noInvites) noInvites.classList.add('hidden');
        if (invitesSection) invitesSection.classList.remove('hidden');

        if (!invitesList) return;

        // Генерировать HTML карточек
        invitesList.innerHTML = this.invites.map(invite => this.renderInviteCard(invite)).join('');
    },

    /**
     * Отображение одной карточки приглашения
     */
    renderInviteCard(invite) {
        const expiresDate = new Date(invite.expiresDate);
        const now = new Date();
        const daysLeft = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = daysLeft <= 2;

        const expiresText = daysLeft <= 0
            ? 'Истекает сегодня'
            : daysLeft === 1
                ? 'Истекает завтра'
                : `Истекает через ${daysLeft} дн.`;

        return `
            <div class="invite-card" data-invite-id="${this.escapeHtml(invite.inviteId)}">
                <div class="invite-header">
                    <div class="invite-team-name">${this.escapeHtml(invite.teamName)}</div>
                    <div class="invite-role">${this.escapeHtml(invite.assignedRoleName || invite.assignedRole)}</div>
                </div>
                <div class="invite-body">
                    <div class="invite-info-row">
                        <span class="label">Пригласил:</span>
                        <span class="value">${this.escapeHtml(invite.inviterName || invite.invitedBy)}</span>
                    </div>
                    <div class="invite-info-row">
                        <span class="label">Дата:</span>
                        <span class="value">${this.formatDate(invite.createdDate)}</span>
                    </div>
                    <div class="invite-expires ${isExpiringSoon ? 'expiring-soon' : ''}">
                        ${expiresText}
                    </div>
                </div>
                <div class="invite-actions">
                    <button class="btn-accept" onclick="WaitingInvite.acceptInvite('${this.escapeHtml(invite.inviteId)}')">
                        Принять
                    </button>
                    <button class="btn-reject" onclick="WaitingInvite.rejectInvite('${this.escapeHtml(invite.inviteId)}')">
                        Отклонить
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Отображение состояния "нет приглашений"
     */
    renderNoInvites() {
        const invitesSection = document.getElementById('invitesSection');
        const noInvites = document.getElementById('noInvites');

        if (invitesSection) invitesSection.classList.add('hidden');
        if (noInvites) noInvites.classList.remove('hidden');
    },

    /**
     * Принятие приглашения
     */
    async acceptInvite(inviteId) {
        if (this.isLoading) return;

        const invite = this.invites.find(i => i.inviteId === inviteId);
        const teamName = invite ? invite.teamName : 'команду';

        if (!confirm(`Принять приглашение в ${teamName}?`)) {
            return;
        }

        this.isLoading = true;
        this.setInviteButtonsDisabled(inviteId, true);

        try {
            const result = await CloudStorage.callApi('acceptInvite', { inviteId });

            if (result.success) {
                Toast.success('Приглашение принято! Добро пожаловать в команду!');

                // Очистить кеш роли
                localStorage.removeItem('roleGuard-cache');

                // Редирект на главную
                setTimeout(() => this.redirectToHome(), 1500);
            } else {
                throw new Error(result.error || 'Ошибка принятия приглашения');
            }
        } catch (error) {
            console.error('WaitingInvite: Failed to accept invite:', error);
            Toast.error('Ошибка: ' + error.message);
            this.setInviteButtonsDisabled(inviteId, false);
        } finally {
            this.isLoading = false;
        }
    },

    /**
     * Отклонение приглашения
     */
    async rejectInvite(inviteId) {
        if (this.isLoading) return;

        const invite = this.invites.find(i => i.inviteId === inviteId);
        const teamName = invite ? invite.teamName : 'эту команду';

        if (!confirm(`Отклонить приглашение от ${teamName}?\n\nВы сможете принять другое приглашение позже.`)) {
            return;
        }

        this.isLoading = true;
        this.setInviteButtonsDisabled(inviteId, true);

        try {
            const result = await CloudStorage.callApi('rejectInvite', { inviteId });

            if (result.success) {
                Toast.success('Приглашение отклонено');

                // Обновить список
                await this.loadInvites();
            } else {
                throw new Error(result.error || 'Ошибка отклонения приглашения');
            }
        } catch (error) {
            console.error('WaitingInvite: Failed to reject invite:', error);
            Toast.error('Ошибка: ' + error.message);
            this.setInviteButtonsDisabled(inviteId, false);
        } finally {
            this.isLoading = false;
        }
    },

    /**
     * Блокировка кнопок карточки приглашения
     */
    setInviteButtonsDisabled(inviteId, disabled) {
        const card = document.querySelector(`[data-invite-id="${inviteId}"]`);
        if (!card) return;

        const buttons = card.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = disabled;
        });
    },

    /**
     * Выход из аккаунта
     */
    logout() {
        // Остановить автообновление
        this.stopAutoRefresh();

        // Очистить данные авторизации
        localStorage.removeItem('cloud-auth');
        localStorage.removeItem('roleGuard-cache');

        Toast.info('Выход из аккаунта...');
        setTimeout(() => this.redirectToLogin(), 500);
    },

    /**
     * Форматирование даты
     */
    formatDate(dateInput) {
        if (!dateInput) return '';

        try {
            const date = new Date(dateInput);
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return String(dateInput);
        }
    },

    /**
     * Экранирование HTML (XSS защита)
     */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    WaitingInvite.init();
});

// Очистка при уходе со страницы
window.addEventListener('beforeunload', () => {
    WaitingInvite.stopAutoRefresh();
});
