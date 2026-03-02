/**
 * Team Invites Module
 * Система приглашений новых сотрудников
 * Интегрировано с реальным API (sendInvite, getGuestUsers)
 */

const TeamInvites = {
    /**
     * Переключение sub-tab (список сотрудников / приглашения)
     * @param {string} subtab - 'employees' или 'invites'
     */
    switchSubtab(subtab) {
        document.querySelectorAll('.sub-tabs .sub-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === subtab);
        });

        document.querySelectorAll('.content-area > .sub-tab-content').forEach(el => {
            el.classList.remove('active');
        });

        const target = document.getElementById('subtab-' + subtab);
        if (target) target.classList.add('active');

        if (subtab === 'invites') {
            this.loadGuestUsers();
        }
    },

    /**
     * Переключение типа приглашения (API гости / ручной ввод)
     * @param {string} type - Тип ('guests' или 'manual')
     */
    switchInviteType(type) {
        // Внутренние табы: По Reddy ID / По Email
        if (type === 'reddyId' || type === 'email') {
            TeamState.currentInviteType = type;

            document.querySelectorAll('.invite-manual-toggle .tab').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === type);
            });

            const reddySection = document.getElementById('inviteByReddyId');
            const emailSection = document.getElementById('inviteByEmail');
            if (reddySection && emailSection) {
                reddySection.classList.toggle('hidden', type !== 'reddyId');
                emailSection.classList.toggle('hidden', type !== 'email');
            }
            return;
        }

        // Внешние табы: Одобренные гости / Ручной ввод
        TeamState.currentInviteType = type;

        // Обновить кнопки переключения
        document.querySelectorAll('.invite-mode-toggle .invite-mode').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Показать/скрыть секции
        const guestsSection = document.getElementById('inviteFromGuests');
        const manualSection = document.getElementById('inviteManual');

        if (guestsSection && manualSection) {
            guestsSection.classList.toggle('hidden', type !== 'guests');
            manualSection.classList.toggle('hidden', type !== 'manual');

            if (type === 'manual') {
                this.populateManualRoleSelect();
            }
        }
    },

    /**
     * Заполнить select роли в ручном приглашении из RolesConfig
     */
    populateManualRoleSelect() {
        const select = document.getElementById('inviteManualRole');
        if (!select || select.options.length > 1) return; // уже заполнен

        select.innerHTML = '';
        const firstRole = RolesConfig.ASSIGNABLE_ROLES[0] || 'sales';
        RolesConfig.ASSIGNABLE_ROLES.forEach(role => {
            const opt = document.createElement('option');
            opt.value = role;
            opt.textContent = RolesConfig.getName(role);
            if (role === firstRole) opt.selected = true;
            select.appendChild(opt);
        });
    },

    /**
     * Загрузка списка гостей с сервера (пользователи со статусом waiting_invite)
     */
    async loadGuestUsers() {
        const container = document.getElementById('guestsList');
        if (!container) return;

        // Показать loading state
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><div class="loading-text">Загрузка списка гостей...</div></div>';

        try {
            // Загружаем гостей
            const result = await CloudStorage.callApi('getGuestUsers');

            if (result.error) {
                container.innerHTML = `<div class="error-text">${TeamUtils.escapeHtml(result.error)}</div>`;
                return;
            }

            TeamState.availableGuests = result.guests || [];

            // Если пользователь - Admin без команды, загружаем список команд
            const currentRole = RoleGuard.getCurrentRole();
            const currentTeamId = RoleGuard.getTeamId();
            const isAdminUser = currentRole === 'admin';
            const hasTeamAssigned = !!currentTeamId;

            if (isAdminUser && !hasTeamAssigned) {
                try {
                    const adminData = await CloudStorage.callApi('getAdminData');
                    if (adminData.teams && !adminData.error) {
                        TeamState.availableTeams = adminData.teams.filter(t => t.isActive);
                    }
                } catch (e) {
                    // Teams load failed, admin will see empty selector
                }
            }

            this.renderGuestsList();

        } catch (error) {
            console.error('Load guest users error:', error);
            container.innerHTML = '<div class="error-text">Ошибка загрузки списка гостей</div>';
        }
    },

    /**
     * Рендеринг списка гостей
     */
    renderGuestsList() {
        const container = document.getElementById('guestsList');
        if (!container) return;

        // Обновить счётчик гостей
        const countEl = document.getElementById('guestsCount');
        if (countEl) countEl.textContent = TeamState.availableGuests.length;

        // Проверяем, нужен ли селектор команд (для Admin без команды)
        const currentRole = RoleGuard.getCurrentRole();
        const teamId = RoleGuard.getTeamId();
        const isAdmin = currentRole === 'admin';
        const hasTeam = !!teamId;
        const needsTeamSelector = isAdmin && !hasTeam && TeamState.availableTeams.length > 0;

        if (TeamState.availableGuests.length === 0) {
            container.innerHTML = `
                <div class="no-guests">
                    <img src="../shared/icons/add.svg" width="48" height="48" alt="">
                    <p>Нет пользователей, ожидающих приглашения</p>
                    <p class="hint">Администратор должен одобрить запросы на регистрацию</p>
                </div>
            `;
            return;
        }

        // Селектор команды для админа
        let teamSelectorHtml = '';
        if (needsTeamSelector) {
            const teamOptions = TeamState.availableTeams
                .map(t => `<option value="${t.id}">${TeamUtils.escapeHtml(t.name)}</option>`)
                .join('');
            teamSelectorHtml = `
                <div class="team-selector-wrapper">
                    <label class="form-label">Команда для приглашения:</label>
                    <select class="form-select team-select" id="adminTeamSelect">
                        <option value="">Выберите команду</option>
                        ${teamOptions}
                    </select>
                </div>
            `;
        } else if (isAdmin && !hasTeam && TeamState.availableTeams.length === 0) {
            teamSelectorHtml = `
                <div class="team-selector-wrapper warning">
                    <p>⚠️ Нет активных команд. Создайте команду в админ-панели.</p>
                </div>
            `;
        }

        const roleOptions = Object.entries(TeamState.assignableRoles)
            .map(([value, label]) => `<option value="${value}">${label}</option>`)
            .join('');

        const guestsHtml = TeamState.availableGuests.map(guest => `
            <div class="guest-card" data-email="${TeamUtils.escapeHtml(guest.email)}">
                <div class="guest-info">
                    <img src="${guest.picture || '../shared/icons/add.svg'}"
                         alt="${TeamUtils.escapeHtml(guest.name)}"
                         class="guest-avatar">
                    <div class="guest-details">
                        <div class="guest-name">${TeamUtils.escapeHtml(guest.name)}</div>
                        <div class="guest-email">${TeamUtils.escapeHtml(guest.email)}</div>
                        ${guest.reddyId ? `<div class="guest-reddy">Reddy ID: ${TeamUtils.escapeHtml(guest.reddyId)}</div>` : ''}
                    </div>
                </div>
                <div class="guest-actions">
                    <select class="form-select role-select" data-email="${TeamUtils.escapeHtml(guest.email)}">
                        ${roleOptions}
                    </select>
                    <button class="btn btn-primary btn-sm"
                            data-action="team-inviteGuest"
                            data-email="${TeamUtils.escapeHtml(guest.email)}">
                        Пригласить
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = teamSelectorHtml + guestsHtml;

        // CSP-safe: назначаем onerror программно вместо inline handler
        container.querySelectorAll('.guest-avatar').forEach(img => {
            img.onerror = () => { img.src = '../shared/icons/add.svg'; img.onerror = null; };
        });
    },

    /**
     * Отправка приглашения гостю (из списка)
     * @param {string} email - Email гостя
     */
    async inviteGuest(email) {
        // Получить выбранную роль для этого гостя
        const roleSelect = document.querySelector(`.role-select[data-email="${email}"]`);
        const assignedRole = roleSelect ? roleSelect.value : (RolesConfig.ASSIGNABLE_ROLES[0] || 'sales');

        // Получить teamId
        let teamId = RoleGuard.getTeamId();

        // Если админ без команды - берём из селектора
        if (!teamId) {
            const teamSelect = document.getElementById('adminTeamSelect');
            if (teamSelect) {
                teamId = teamSelect.value;
            }
        }

        if (!teamId) {
            Toast.show('Выберите команду для приглашения', 'error');
            return;
        }

        try {
            const result = await CloudStorage.callApi('sendInvite', {
                userEmail: email,
                teamId: teamId,
                assignedRole: assignedRole
            });

            if (result.error) {
                Toast.show(result.error, 'error');
                return;
            }

            Toast.show('Приглашение отправлено!', 'success');

            // Убрать гостя из списка
            TeamState.availableGuests = TeamState.availableGuests.filter(g => g.email !== email);
            this.renderGuestsList();

        } catch (error) {
            console.error('Send invite error:', error);
            Toast.show('Ошибка отправки приглашения', 'error');
        }
    },

    /**
     * Отправка приглашения (ручной ввод)
     * По Email — отправляет через API (sendInvite)
     * По Reddy ID — сохраняет локально (нет API для поиска по Reddy ID)
     */
    async sendInvite() {
        let value = '';
        let type = TeamState.currentInviteType;

        // Если выбран режим гостей, ничего не делаем здесь
        if (type === 'guests') {
            Toast.show('Выберите гостя из списка', 'info');
            return;
        }

        if (type === 'reddyId') {
            value = document.getElementById('inviteReddyId').value.trim();
            if (!value) {
                Toast.show('Введите Reddy ID', 'error');
                return;
            }
            if (!/^\d{11}$/.test(value)) {
                Toast.show('Reddy ID должен содержать 11 цифр', 'error');
                return;
            }
        } else {
            value = document.getElementById('inviteEmail').value.trim();
            if (!value) {
                Toast.show('Введите email', 'error');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                Toast.show('Некорректный формат email', 'error');
                return;
            }
        }

        // По Email — отправляем через API
        if (type === 'email') {
            await this.sendInviteByEmail(value);
            return;
        }

        // По Reddy ID — локальное сохранение (нет API для поиска по Reddy ID)
        const existingInvite = TeamState.pendingInvites.find(inv =>
            inv.value === value && inv.type === type
        );
        if (existingInvite) {
            Toast.show('Приглашение уже отправлено', 'warning');
            return;
        }

        try {
            const invite = {
                id: Date.now(),
                type: type,
                value: value,
                createdAt: new Date().toISOString(),
                status: 'pending'
            };

            TeamState.pendingInvites.push(invite);
            this.savePendingInvites();
            this.renderPendingInvites();

            document.getElementById('inviteReddyId').value = '';
            Toast.show('Приглашение сохранено локально', 'success');
        } catch (error) {
            Toast.show('Ошибка сохранения приглашения', 'error');
        }
    },

    /**
     * Отправка приглашения по Email через backend API
     * @param {string} email - Email пользователя
     */
    async sendInviteByEmail(email) {
        // Получить роль из селектора
        const roleSelect = document.getElementById('inviteManualRole');
        const assignedRole = roleSelect ? roleSelect.value : (RolesConfig.ASSIGNABLE_ROLES[0] || 'sales');

        // Получить teamId
        let teamId = RoleGuard.getTeamId();

        if (!teamId) {
            const teamSelect = document.getElementById('adminTeamSelect');
            if (teamSelect) {
                teamId = teamSelect.value;
            }
        }

        if (!teamId) {
            Toast.show('Команда не определена', 'error');
            return;
        }

        try {
            const result = await CloudStorage.callApi('sendInvite', {
                userEmail: email,
                teamId: teamId,
                assignedRole: assignedRole
            });

            if (result.error) {
                Toast.show(result.error, 'error');
                return;
            }

            Toast.show('Приглашение отправлено!', 'success');
            document.getElementById('inviteEmail').value = '';

        } catch (error) {
            Toast.show('Ошибка отправки приглашения', 'error');
        }
    },

    /**
     * Отмена приглашения
     * @param {number} inviteId - ID приглашения
     */
    cancelInvite(inviteId) {
        TeamState.pendingInvites = TeamState.pendingInvites.filter(inv => inv.id !== inviteId);
        this.savePendingInvites();
        this.renderPendingInvites();
        Toast.show('Приглашение отменено', 'info');
    },

    /**
     * Загрузка ожидающих приглашений из localStorage
     */
    loadPendingInvites() {
        try {
            const saved = localStorage.getItem('team-pending-invites');
            TeamState.pendingInvites = saved ? JSON.parse(saved) : [];
            this.renderPendingInvites();
        } catch (e) {
            TeamState.pendingInvites = [];
        }
    },

    /**
     * Сохранение ожидающих приглашений в localStorage
     */
    savePendingInvites() {
        localStorage.setItem('team-pending-invites', JSON.stringify(TeamState.pendingInvites));
    },

    /**
     * Рендеринг списка ожидающих приглашений (локальные)
     */
    renderPendingInvites() {
        const container = document.getElementById('pendingInvites');
        const list = document.getElementById('pendingInvitesList');
        const countEl = document.getElementById('pendingCount');

        if (!container || !list) return;

        if (TeamState.pendingInvites.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        countEl.textContent = TeamState.pendingInvites.length;

        list.innerHTML = TeamState.pendingInvites.map(invite => `
            <div class="pending-invite-item">
                <div class="pending-invite-info">
                    <span class="pending-invite-value">${TeamUtils.escapeHtml(invite.value)}</span>
                    <span class="pending-invite-type">${invite.type === 'reddyId' ? 'Reddy ID' : 'Email'}</span>
                </div>
                <div class="pending-invite-actions">
                    <button class="pending-invite-cancel" data-action="team-cancelInvite" data-invite-id="${invite.id}" title="Отменить">
                        <img src="../shared/icons/cross.svg" alt="Отменить">
                    </button>
                </div>
            </div>
        `).join('');
    }
};
