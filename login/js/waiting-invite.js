/**
 * Waiting Invite Page - Logic
 * Экран ожидания приглашения для пользователей со статусом 'waiting_invite'
 */

const WaitingInvite = {
    REFRESH_INTERVAL: 30000,

    _refreshIntervalId: null,
    _clickHandler: null,
    _beforeUnloadHandler: null,
    _keydownHandler: null,
    _confirmResolve: null,
    isLoading: false,
    isRedirecting: false,
    user: null,
    invites: [],

    async init() {
        const authData = localStorage.getItem('cloud-auth');
        if (!authData) {
            window.location.href = '/SimpleAIAdminka/login/';
            return;
        }

        try {
            const auth = JSON.parse(authData);
            if (Date.now() - auth.timestamp > 3500000) {
                localStorage.removeItem('cloud-auth');
                window.location.href = '/SimpleAIAdminka/login/';
                return;
            }

            this.user = {
                email: auth.email,
                name: auth.name || auth.email.split('@')[0],
                picture: auth.picture || ''
            };
        } catch {
            window.location.href = '/SimpleAIAdminka/login/';
            return;
        }

        this._renderUserInfo();
        this._bindEvents();
        await this.loadInvites();
        this._startAutoRefresh();
    },

    _escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    _bindEvents() {
        this._clickHandler = (e) => {
            // Backdrop click — close confirm modal
            if (e.target.id === 'confirmModal') {
                this._resolveConfirm(false);
                return;
            }

            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const inviteId = btn.dataset.inviteId;

            switch (action) {
                case 'refresh': this.loadInvites(); break;
                case 'logout': this._logout(); break;
                case 'accept': if (inviteId) this._acceptInvite(inviteId); break;
                case 'reject': if (inviteId) this._rejectInvite(inviteId); break;
                case 'confirm-ok': this._resolveConfirm(true); break;
                case 'confirm-cancel': this._resolveConfirm(false); break;
            }
        };
        document.addEventListener('click', this._clickHandler);

        this._keydownHandler = (e) => {
            if (e.key === 'Escape') this._resolveConfirm(false);
        };
        document.addEventListener('keydown', this._keydownHandler);

        this._beforeUnloadHandler = () => this.destroy();
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
    },

    destroy() {
        this._stopAutoRefresh();
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }
        if (this._beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            this._beforeUnloadHandler = null;
        }
    },

    _startAutoRefresh() {
        this._stopAutoRefresh();
        this._refreshIntervalId = setInterval(() => this.loadInvites(), this.REFRESH_INTERVAL);
    },

    _stopAutoRefresh() {
        if (this._refreshIntervalId) {
            clearInterval(this._refreshIntervalId);
            this._refreshIntervalId = null;
        }
    },

    _renderUserInfo() {
        const avatar = document.getElementById('userAvatar');
        const name = document.getElementById('userName');
        const email = document.getElementById('userEmail');

        if (name) name.textContent = this.user.name;
        if (email) email.textContent = this.user.email;

        if (avatar) {
            if (this.user.picture && this.user.picture.startsWith('https://lh')) {
                const img = document.createElement('img');
                img.src = this.user.picture;
                img.alt = '';
                img.onerror = () => { avatar.textContent = this.user.name.charAt(0).toUpperCase(); };
                avatar.appendChild(img);
            } else {
                avatar.textContent = this.user.name.charAt(0).toUpperCase();
            }
        }
    },

    async loadInvites() {
        if (this.isLoading || this.isRedirecting) return;

        this.isLoading = true;
        this._showLoading(true);

        try {
            const result = await CloudStorage.callApi('getInvites');

            if (result.success) {
                this.invites = result.invites || [];
                this._renderInvites();
            } else {
                throw new Error(result.error || 'Ошибка загрузки приглашений');
            }
        } catch (error) {
            if (error.message.includes('Only guests can view invites')) {
                this.isRedirecting = true;
                this._stopAutoRefresh();
                localStorage.removeItem('roleGuard');
                Toast.success('Вы уже в команде!');
                setTimeout(() => { window.location.href = '/SimpleAIAdminka/'; }, 1500);
                return;
            }

            if (error.message.includes('Access denied') || error.message.includes('Invalid access token')) {
                this.isRedirecting = true;
                this._stopAutoRefresh();
                Toast.error('Сессия истекла. Войдите снова.');
                setTimeout(() => { window.location.href = '/SimpleAIAdminka/login/'; }, 1500);
                return;
            }

            Toast.error('Ошибка: ' + error.message);
            this._renderNoInvites();
        } finally {
            this.isLoading = false;
            this._showLoading(false);
        }
    },

    _showLoading(show) {
        const loading = document.getElementById('invitesLoading');
        const noInvites = document.getElementById('noInvites');
        const invitesSection = document.getElementById('invitesSection');
        const waitingContent = document.getElementById('waitingContent');
        const refreshBtn = document.getElementById('btnRefresh');

        if (loading) loading.classList.toggle('hidden', !show);

        if (show) {
            if (waitingContent) waitingContent.classList.add('hidden');
            if (noInvites) noInvites.classList.add('hidden');
            if (invitesSection) invitesSection.classList.add('hidden');
        }

        if (refreshBtn) {
            refreshBtn.disabled = show;
            refreshBtn.classList.toggle('loading', show);
        }
    },

    _renderInvites() {
        const invitesSection = document.getElementById('invitesSection');
        const invitesList = document.getElementById('invitesList');
        const noInvites = document.getElementById('noInvites');
        const waitingContent = document.getElementById('waitingContent');

        if (!this.invites || this.invites.length === 0) {
            this._renderNoInvites();
            return;
        }

        if (waitingContent) waitingContent.classList.add('hidden');
        if (noInvites) noInvites.classList.add('hidden');
        if (invitesSection) invitesSection.classList.remove('hidden');
        if (!invitesList) return;

        invitesList.innerHTML = this.invites.map(invite => this._renderInviteCard(invite)).join('');
    },

    _renderInviteCard(invite) {
        const expiresDate = new Date(invite.expiresDate);
        const daysLeft = Math.ceil((expiresDate - new Date()) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = daysLeft <= 2;
        const id = this._escapeHtml(invite.inviteId);

        const expiresText = daysLeft <= 0
            ? 'Истекает сегодня'
            : daysLeft === 1
                ? 'Истекает завтра'
                : `Истекает через ${daysLeft} дн.`;

        return `
            <div class="invite-card" data-invite-id="${id}">
                <div class="invite-header">
                    <div class="invite-team-name">${this._escapeHtml(invite.teamName)}</div>
                    <div class="invite-role">${this._escapeHtml(invite.assignedRoleName || invite.assignedRole)}</div>
                </div>
                <div class="invite-body">
                    <div class="invite-info-row">
                        <span class="label">Пригласил:</span>
                        <span class="value">${this._escapeHtml(invite.inviterName || invite.invitedBy)}</span>
                    </div>
                    <div class="invite-info-row">
                        <span class="label">Дата:</span>
                        <span class="value">${Utils.formatDate(invite.createdDate)}</span>
                    </div>
                    <div class="invite-expires ${isExpiringSoon ? 'expiring-soon' : ''}">
                        ${expiresText}
                    </div>
                </div>
                <div class="invite-actions">
                    <button class="btn btn-primary" data-action="accept" data-invite-id="${id}">
                        Принять
                    </button>
                    <button class="btn btn-danger" data-action="reject" data-invite-id="${id}">
                        Отклонить
                    </button>
                </div>
            </div>`;
    },

    _renderNoInvites() {
        const invitesSection = document.getElementById('invitesSection');
        const noInvites = document.getElementById('noInvites');
        const waitingContent = document.getElementById('waitingContent');

        if (waitingContent) waitingContent.classList.add('hidden');
        if (invitesSection) invitesSection.classList.add('hidden');
        if (noInvites) noInvites.classList.remove('hidden');
    },

    _confirm(message, description, btnClass) {
        return new Promise(resolve => {
            this._confirmResolve = resolve;
            const modal = document.getElementById('confirmModal');
            const msgEl = document.getElementById('confirmMessage');
            const descEl = document.getElementById('confirmDescription');
            const okBtn = document.getElementById('confirmAcceptBtn');

            if (msgEl) msgEl.textContent = message;
            if (descEl) {
                descEl.textContent = description || '';
                descEl.classList.toggle('hidden', !description);
            }
            if (okBtn) {
                okBtn.className = `btn-sm ${btnClass || 'btn-primary'}`;
            }
            if (modal) modal.classList.add('active');
        });
    },

    _resolveConfirm(result) {
        const modal = document.getElementById('confirmModal');
        if (!modal || !modal.classList.contains('active')) return;
        modal.classList.remove('active');
        if (this._confirmResolve) {
            this._confirmResolve(result);
            this._confirmResolve = null;
        }
    },

    async _acceptInvite(inviteId) {
        if (this.isLoading) return;

        const invite = this.invites.find(i => i.inviteId === inviteId);
        const teamName = invite ? invite.teamName : 'команду';

        const confirmed = await this._confirm(`Принять приглашение в ${teamName}?`);
        if (!confirmed) return;

        this.isLoading = true;
        this._setInviteButtonsDisabled(inviteId, true);

        try {
            const result = await CloudStorage.callApi('acceptInvite', { inviteId });

            if (result.success) {
                Toast.success('Приглашение принято! Добро пожаловать в команду!');
                localStorage.removeItem('roleGuard');
                this.isRedirecting = true;
                this._stopAutoRefresh();
                setTimeout(() => { window.location.href = '/SimpleAIAdminka/'; }, 1500);
            } else {
                throw new Error(result.error || 'Ошибка принятия приглашения');
            }
        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
            this._setInviteButtonsDisabled(inviteId, false);
        } finally {
            this.isLoading = false;
        }
    },

    async _rejectInvite(inviteId) {
        if (this.isLoading) return;

        const invite = this.invites.find(i => i.inviteId === inviteId);
        const teamName = invite ? invite.teamName : 'эту команду';

        const confirmed = await this._confirm(
            `Отклонить приглашение от ${teamName}?`,
            'Вы сможете принять другое приглашение позже.',
            'btn-danger'
        );
        if (!confirmed) return;

        this.isLoading = true;
        this._setInviteButtonsDisabled(inviteId, true);

        try {
            const result = await CloudStorage.callApi('rejectInvite', { inviteId });

            if (result.success) {
                Toast.success('Приглашение отклонено');
                this.isLoading = false;
                await this.loadInvites();
            } else {
                throw new Error(result.error || 'Ошибка отклонения приглашения');
            }
        } catch (error) {
            Toast.error('Ошибка: ' + error.message);
            this._setInviteButtonsDisabled(inviteId, false);
            this.isLoading = false;
        }
    },

    _setInviteButtonsDisabled(inviteId, disabled) {
        const card = document.querySelector(`[data-invite-id="${inviteId}"]`);
        if (!card) return;
        card.querySelectorAll('button').forEach(btn => { btn.disabled = disabled; });
    },

    _logout() {
        this.destroy();
        localStorage.removeItem('cloud-auth');
        localStorage.removeItem('roleGuard');
        Toast.info('Выход из аккаунта...');
        setTimeout(() => { window.location.href = '/SimpleAIAdminka/login/'; }, 500);
    }
};

document.addEventListener('DOMContentLoaded', () => WaitingInvite.init());
