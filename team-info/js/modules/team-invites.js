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
            // Показываем loading state сразу для unified списка
            this._showRequestsLoading();
            // Параллельно загружаем guests (API) + pending (API) — оба обновляют unified render
            Promise.all([
                this.loadGuestUsers().catch(() => {}),
                this.loadPendingInvites().catch(() => {})
            ]).finally(() => this.renderInviteRequests());
            this._bindSendInviteInputs();
            this._refreshSendInviteDisabled();
        }
    },

    /**
     * Фоновое обновление списка гостей (stale-while-revalidate).
     * Вызывается после показа кешированных данных.
     * @private
     */
    async _refreshGuestsInBackground() {
        try {
            const result = await CloudStorage.getGuestUsers();
            if (result && !result.error) {
                const fresh = result.guests || [];
                if (CloudStorage.setCache) {
                    CloudStorage.setCache('guests', { guests: fresh });
                }
                TeamState.availableGuests = fresh;
                this._updateGuestProfileCache(fresh);
                this.renderInviteRequests();
            }
        } catch (_) { /* ignore background errors */ }
    },

    /**
     * Инвалидация кеша гостей — вызывается после sendInvite/cancelInvite.
     * @private
     */
    _invalidateGuestsCache() {
        if (CloudStorage.clearCacheNamespace) {
            CloudStorage.clearCacheNamespace('guests');
        }
    },

    /**
     * Resolve teamId: RoleGuard или admin-селектор команды.
     * @private
     */
    _resolveTeamId() {
        let teamId = RoleGuard.getTeamId && RoleGuard.getTeamId();
        if (!teamId) {
            const teamInput = document.getElementById('adminTeamSelectValue');
            if (teamInput && teamInput.value) teamId = teamInput.value;
        }
        return teamId || '';
    },

    /**
     * Инвалидирует кеш и параллельно перезагружает guests + pending.
     * @private
     */
    async _refreshInviteLists() {
        this._invalidateGuestsCache();
        await Promise.all([
            this.loadGuestUsers(),
            this.loadPendingInvites()
        ]);
    },

    /**
     * Enrichment-кеш: email → { picture, name, reddyId } для
     * отображения полных данных в pending items, даже когда
     * backend getTeamPendingInvites возвращает только email.
     * Заполняется при loadGuestUsers + сохраняется в localStorage через CloudStorage.
     * @private
     */
    _updateGuestProfileCache(guests) {
        if (!guests || !guests.length) return;
        const cache = TeamState._guestProfileCache || {};
        guests.forEach(g => {
            if (!g || !g.email) return;
            const key = String(g.email).toLowerCase();
            cache[key] = {
                picture: g.picture || '',
                name: g.name || '',
                reddyId: g.reddyId || ''
            };
        });
        TeamState._guestProfileCache = cache;
    },

    /**
     * Получить enrichment-данные для email.
     * @private
     */
    _getGuestProfile(email) {
        if (!email || !TeamState._guestProfileCache) return null;
        return TeamState._guestProfileCache[String(email).toLowerCase()] || null;
    },

    /**
     * Показать loading state в unified списке запросов (пока guests + pending загружаются)
     */
    _showRequestsLoading() {
        const container = document.getElementById('inviteRequestsList');
        if (!container) return;
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <div class="loading-text">Загрузка запросов...</div>
            </div>
        `;
    },

    /**
     * UNIFIED RENDERER: merge approved guests (API) + manual pending (API) в один список.
     * Тип элемента определяет иконку, бейдж и доступные actions.
     *
     * Data sources:
     * - TeamState.availableGuests — одобренные гости (type: 'guest')
     * - TeamState.pendingInvites — отправленные вручную приглашения (type: 'manual')
     */
    renderInviteRequests() {
        const container = document.getElementById('inviteRequestsList');
        const countEl = document.getElementById('inviteRequestsCount');
        if (!container) return;

        const visibleGuests = this._getVisibleGuests();
        const pendingInvites = TeamState.pendingInvites || [];

        // Обновить счётчик
        const total = visibleGuests.length + pendingInvites.length;
        if (countEl) {
            countEl.textContent = String(total);
            countEl.classList.toggle('hidden', total === 0);
        }

        // Empty state
        if (total === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <img src="../shared/icons/add.svg" width="48" height="48" alt="">
                    </div>
                    <div class="empty-state-title">Нет запросов и приглашений</div>
                    <div class="empty-state-text">Запросы на регистрацию и отправленные приглашения появятся здесь</div>
                </div>
            `;
            return;
        }

        // Проверка необходимости team selector для admin без команды
        const currentRole = RoleGuard.getCurrentRole();
        const teamId = RoleGuard.getTeamId();
        const isAdmin = currentRole === 'admin' || (RoleGuard.isAdmin && RoleGuard.isAdmin());
        const hasTeam = !!teamId;
        const needsTeamSelector = isAdmin && !hasTeam && TeamState.availableTeams.length > 0;

        // Team selector для admin без команды (рендерим ОДИН раз сверху списка)
        let teamSelectorHtml = '';
        if (needsTeamSelector) {
            const teamItems = TeamState.availableTeams
                .map(t => `<div class="dropdown-item" data-action="team-selectFormDropdown" data-value="${TeamUtils.escapeHtml(t.id)}">${TeamUtils.escapeHtml(t.name)}</div>`)
                .join('');
            teamSelectorHtml = `
                <div class="team-selector-wrapper">
                    <label class="form-label">Команда для приглашения:</label>
                    <div class="dropdown-wrap dropdown-wrap--form" id="adminTeamSelectWrap">
                        <button class="dropdown-trigger dropdown-trigger--form placeholder" type="button"
                                data-action="team-toggleFormDropdown" data-target="adminTeamMenu">
                            <span id="adminTeamLabel">Выберите команду</span>
                        </button>
                        <div class="dropdown-menu hidden" id="adminTeamMenu">${teamItems}</div>
                        <input type="hidden" id="adminTeamSelectValue" value="">
                    </div>
                </div>
            `;
        } else if (isAdmin && !hasTeam && TeamState.availableTeams.length === 0) {
            teamSelectorHtml = `
                <div class="team-selector-wrapper warning">
                    <p>⚠️ Нет активных команд. Создайте команду в админ-панели.</p>
                </div>
            `;
        }

        // Default role для guest actions
        const firstRole = Object.keys(TeamState.assignableRoles)[0]
            || (typeof RolesConfig !== 'undefined' ? RolesConfig.ASSIGNABLE_ROLES[0] : 'sales');
        const firstRoleLabel = TeamState.assignableRoles[firstRole] || firstRole;

        // Build items: guests first (actionable), then pending (waiting)
        const guestItems = visibleGuests.map(guest => this._renderGuestRequestItem(guest, firstRole, firstRoleLabel)).join('');
        const pendingItems = pendingInvites.map(inv => this._renderManualRequestItem(inv)).join('');

        container.innerHTML = teamSelectorHtml + guestItems + pendingItems;

        // CSP-safe onerror для аватаров
        container.querySelectorAll('.invite-request-avatar img').forEach(img => {
            img.onerror = () => { img.src = '../shared/icons/add.svg'; img.onerror = null; };
        });

        // Обновить disable-state кнопки отправки (может быть дубликат)
        this._refreshSendInviteDisabled();
    },

    /**
     * Форматирование даты запроса.
     * @private
     */
    _formatRequestDate(raw) {
        if (!raw) return '';
        try {
            if (typeof Utils !== 'undefined' && Utils.formatDate) {
                return Utils.formatDate(raw);
            }
            return new Date(raw).toLocaleDateString('ru-RU');
        } catch (_) { return ''; }
    },

    /**
     * Рендер одного элемента-запроса от API (approved guest).
     * Layout идентичный manual: badge | avatar+name+meta | actions (dropdown + кнопка).
     * @private
     */
    _renderGuestRequestItem(guest, defaultRole, defaultRoleLabel) {
        const email = TeamUtils.escapeHtml(guest.email || '');
        const name = TeamUtils.escapeHtml(guest.name || guest.email || '');
        const picture = TeamUtils.isValidImageUrl(guest.picture)
            ? TeamUtils.escapeHtml(guest.picture)
            : '../shared/icons/add.svg';
        const dateStr = this._formatRequestDate(guest.createdAt || guest.ts);
        const dateHtml = dateStr ? `<span class="invite-request-date">${TeamUtils.escapeHtml(dateStr)}</span>` : '';
        const reddy = guest.reddyId ? TeamUtils.escapeHtml(guest.reddyId) : '';
        const reddyHtml = reddy ? `<span class="invite-request-reddy">Reddy ID: ${reddy}</span>` : '';

        // Dropdown role items
        const roleItems = Object.entries(TeamState.assignableRoles).map(([value, label], i) =>
            `<div class="dropdown-item${i === 0 ? ' active' : ''}" data-action="team-selectFormDropdown" data-value="${TeamUtils.escapeHtml(value)}">${TeamUtils.escapeHtml(label)}</div>`
        ).join('');

        return `
            <div class="invite-request-item invite-request-item--guest" data-email="${email}">
                <div class="invite-request-header">
                    <div class="invite-request-type">
                        <span class="invite-type-badge invite-type-badge--guest" title="Запрос на регистрацию">Запрос</span>
                    </div>
                    <div class="invite-request-info">
                        <div class="invite-request-avatar">
                            <img src="${picture}" alt="${name}">
                        </div>
                        <div class="invite-request-details">
                            <div class="invite-request-name">${name}</div>
                            <div class="invite-request-meta">
                                <span class="invite-request-email">${email}</span>
                                ${reddyHtml}
                                ${dateHtml}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="invite-request-footer">
                    <div class="dropdown-wrap dropdown-wrap--form" data-email="${email}">
                        <button class="dropdown-trigger dropdown-trigger--form" type="button"
                                data-action="team-toggleFormDropdown" data-target="roleMenu_${email}">
                            <span id="roleLabel_${email}">${TeamUtils.escapeHtml(defaultRoleLabel)}</span>
                        </button>
                        <div class="dropdown-menu hidden" id="roleMenu_${email}">${roleItems}</div>
                        <input type="hidden" id="roleValue_${email}" value="${TeamUtils.escapeHtml(defaultRole)}">
                    </div>
                    <button class="btn btn-primary btn-sm" data-action="team-inviteGuest" data-email="${email}">Пригласить</button>
                </div>
            </div>
        `;
    },

    /**
     * Рендер одного элемента-запроса отправленного вручную (pending invite).
     * Layout идентичный guest: badge | avatar+name+meta | actions (только cancel).
     * @private
     */
    _renderManualRequestItem(invite) {
        const typeLabel = invite.type === 'reddyId' ? 'Reddy ID' : 'Email';
        const value = invite.value || '';
        const roleName = invite.role
            ? (typeof RolesConfig !== 'undefined' ? RolesConfig.getName(invite.role) : invite.role)
            : '';
        const dateStr = this._formatRequestDate(invite.createdAt);
        const dateHtml = dateStr ? `<span class="invite-request-date">${TeamUtils.escapeHtml(dateStr)}</span>` : '';

        // Enrichment: пытаемся достать профиль из кеша guests
        // Используем reddyId из invite или value для reddyId типа, иначе email
        const profile = this._getGuestProfile(value) || (invite.reddyId ? this._getGuestProfile(invite.reddyId) : null);
        const picture = profile && profile.picture && TeamUtils.isValidImageUrl(profile.picture) ? profile.picture : '';
        const displayName = profile && profile.name ? profile.name : value;
        const secondaryEmail = profile && profile.name ? value : ''; // если есть имя — email в meta
        const reddyIdFromProfile = profile && profile.reddyId ? profile.reddyId : '';
        const reddyIdFromInvite = invite.reddyId || (invite.type === 'reddyId' ? value : '');
        const reddy = reddyIdFromProfile || reddyIdFromInvite;

        // Avatar: фото (если есть) или icon placeholder
        const avatarHtml = picture
            ? `<div class="invite-request-avatar"><img src="${TeamUtils.escapeHtml(picture)}" alt="${TeamUtils.escapeHtml(displayName)}"></div>`
            : `<div class="invite-request-avatar invite-request-avatar--icon"><img src="../shared/icons/team_info.svg" alt=""></div>`;

        // Meta: email (если отличается от name), reddy, дата
        const metaParts = [];
        if (secondaryEmail && secondaryEmail !== displayName) {
            metaParts.push(`<span class="invite-request-email">${TeamUtils.escapeHtml(secondaryEmail)}</span>`);
        }
        if (reddy && String(reddy) !== String(displayName)) {
            metaParts.push(`<span class="invite-request-reddy">Reddy ID: ${TeamUtils.escapeHtml(reddy)}</span>`);
        }
        if (dateHtml) metaParts.push(dateHtml);

        // Disabled dropdown — роль уже выбрана при отправке, показываем её read-only
        const roleLabel = roleName
            ? TeamUtils.escapeHtml(roleName)
            : 'Без роли';

        return `
            <div class="invite-request-item invite-request-item--manual">
                <div class="invite-request-header">
                    <div class="invite-request-type">
                        <span class="invite-type-badge invite-type-badge--manual" title="Отправлено вручную">${typeLabel}</span>
                    </div>
                    <div class="invite-request-info">
                        ${avatarHtml}
                        <div class="invite-request-details">
                            <div class="invite-request-name">${TeamUtils.escapeHtml(displayName)}</div>
                            <div class="invite-request-meta">
                                ${metaParts.join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="invite-request-footer">
                    <div class="dropdown-wrap dropdown-wrap--form disabled" aria-disabled="true">
                        <button class="dropdown-trigger dropdown-trigger--form" type="button" disabled>
                            <span>${roleLabel}</span>
                        </button>
                    </div>
                    <button class="btn btn-danger btn-sm" data-action="team-cancelInvite" data-invite-id="${TeamUtils.escapeHtml(String(invite.id))}">Отменить</button>
                </div>
            </div>
        `;
    },

    /**
     * Одноразовая привязка input-листенеров к полям Reddy ID / Email
     * для disable-состояния кнопки "Отправить приглашение" при пустом значении.
     * Идемпотентно — повторные вызовы безопасны.
     */
    _bindSendInviteInputs() {
        if (this._sendInviteInputsBound) return;
        const reddy = document.getElementById('inviteReddyId');
        const email = document.getElementById('inviteEmail');
        if (!reddy || !email) return;
        const handler = () => this._refreshSendInviteDisabled();
        reddy.addEventListener('input', handler);
        email.addEventListener('input', handler);
        this._sendInviteInputsBound = true;
    },

    /**
     * Обновить disabled-состояние shared-кнопки "Отправить приглашение"
     * в зависимости от пустоты активного поля ввода.
     * Не трогает кнопку, если она в loading-state.
     */
    _refreshSendInviteDisabled() {
        const btn = document.querySelector('[data-action="team-sendInvite"]');
        if (!btn || btn.classList.contains('btn-loading')) return;
        const reddySection = document.getElementById('inviteByReddyId');
        const emailSection = document.getElementById('inviteByEmail');
        let value = '';
        let type = '';
        if (reddySection && !reddySection.classList.contains('hidden')) {
            type = 'reddyId';
            const el = document.getElementById('inviteReddyId');
            value = el ? el.value.trim() : '';
        } else if (emailSection && !emailSection.classList.contains('hidden')) {
            type = 'email';
            const el = document.getElementById('inviteEmail');
            value = el ? el.value.trim() : '';
        }
        const isDuplicate = value.length > 0 && this._isDuplicateInvite(type, value);
        btn.disabled = value.length === 0 || isDuplicate;
        btn.title = isDuplicate ? 'Такое приглашение уже отправлено' : '';
    },

    /**
     * Проверка дубликата ТОЛЬКО в pending (отправленные приглашения).
     * Approved guests — это ещё НЕ отправленные запросы, их блокировать нельзя:
     * юзер как раз должен иметь возможность пригласить через форму,
     * если по какой-то причине не видит кнопку «Пригласить» в списке.
     * @param {string} type — 'reddyId' | 'email'
     * @param {string} value — введённое значение
     * @returns {boolean}
     * @private
     */
    _isDuplicateInvite(type, value) {
        if (!value) return false;
        const v = String(value).toLowerCase();
        const pending = TeamState.pendingInvites || [];
        return pending.some(inv => {
            if (inv.value && String(inv.value).toLowerCase() === v) return true;
            if (inv.reddyId && String(inv.reddyId).toLowerCase() === v) return true;
            return false;
        });
    },

    /**
     * Переключение типа приглашения (API гости / ручной ввод)
     * @param {string} type - Тип ('guests' или 'manual')
     */
    switchInviteType(type) {
        // Toggle: Reddy ID / Email (inline toggle buttons)
        if (type === 'reddyId' || type === 'email') {
            TeamState.currentInviteType = type;

            document.querySelectorAll('.invite-type-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === type);
            });

            const reddySection = document.getElementById('inviteByReddyId');
            const emailSection = document.getElementById('inviteByEmail');
            if (reddySection && emailSection) {
                reddySection.classList.toggle('hidden', type !== 'reddyId');
                emailSection.classList.toggle('hidden', type !== 'email');
            }
            this._refreshSendInviteDisabled();
            return;
        }

        // Legacy: guests/manual sub-tab switch (если кто-то вызовет программно)
        TeamState.currentInviteType = type;
        if (type === 'manual') {
            this.populateManualRoleSelect();
        }
    },

    /**
     * Заполнить select роли в ручном приглашении из RolesConfig
     */
    populateManualRoleSelect() {
        const menu = document.getElementById('inviteManualRoleMenu');
        const input = document.getElementById('inviteManualRoleValue');
        const label = document.getElementById('inviteManualRoleLabel');
        const trigger = document.getElementById('inviteManualRoleTrigger');
        if (!menu || menu.dataset.populated) return;

        const firstRole = RolesConfig.ASSIGNABLE_ROLES[0] || 'sales';
        let html = '';
        RolesConfig.ASSIGNABLE_ROLES.forEach(role => {
            const isActive = role === firstRole ? ' active' : '';
            html += '<div class="dropdown-item' + isActive + '" data-action="team-selectFormDropdown" data-value="' + Utils.escapeHtml(role) + '">' + Utils.escapeHtml(RolesConfig.getName(role)) + '</div>';
        });
        menu.innerHTML = html;
        menu.dataset.populated = '1';
        if (input) input.value = firstRole;
        if (label) label.textContent = RolesConfig.getName(firstRole);
        if (trigger) trigger.classList.remove('placeholder');
    },

    /**
     * Загрузка списка гостей с сервера (пользователи со статусом waiting_invite)
     */
    async loadGuestUsers() {
        // Unified список: loading state показывается из switchSubtab / renderInviteRequests
        // Кеш-стратегия: TTL + invalidate после mutations. Используем localStorage через CloudStorage
        const CACHE_KEY = 'guests';
        try {
            // 1. Попытка из кеша (5 мин TTL — дефолт CloudStorage)
            const cached = CloudStorage.getFromCache && CloudStorage.getFromCache(CACHE_KEY);
            if (cached && Array.isArray(cached.guests)) {
                TeamState.availableGuests = cached.guests;
                this._updateGuestProfileCache(cached.guests);
                this.renderInviteRequests();
                // Stale-while-revalidate: в фоне дёргаем свежие данные
                this._refreshGuestsInBackground();
                return;
            }

            // 2. Fresh fetch
            const result = await CloudStorage.getGuestUsers();

            if (result.error) {
                const container = document.getElementById('inviteRequestsList');
                if (container) {
                    // Phase 27 MIG-02: surgical XSS fix (Pitfall #6 — XSS-proof)
                    // textContent + DOM construction; идентичный CSS .empty-state визуал
                    container.replaceChildren();
                    const wrapper = document.createElement('div');
                    wrapper.className = 'empty-state';
                    const text = document.createElement('div');
                    text.className = 'empty-state-text';
                    text.textContent = result.error;
                    wrapper.appendChild(text);
                    container.appendChild(wrapper);
                }
                return;
            }

            // Сохранить в кеш
            if (CloudStorage.setCache) {
                CloudStorage.setCache(CACHE_KEY, { guests: result.guests || [] });
            }

            TeamState.availableGuests = result.guests || [];
            this._updateGuestProfileCache(result.guests || []);

            // Если пользователь - Admin без команды, загружаем список команд
            const currentRole = RoleGuard.getCurrentRole();
            const currentTeamId = RoleGuard.getTeamId();
            const isAdminUser = currentRole === 'admin' || (RoleGuard.isAdmin && RoleGuard.isAdmin());
            const hasTeamAssigned = !!currentTeamId;

            if (isAdminUser && !hasTeamAssigned) {
                try {
                    const adminData = await CloudStorage.getAdminData({});
                    if (adminData.teams && !adminData.error) {
                        TeamState.availableTeams = adminData.teams.filter(t => t.isActive);
                    }
                } catch (e) {
                    // Teams load failed, admin will see empty selector
                }
            }

            this.renderInviteRequests();

        } catch (error) {
            console.error('Load guest users error:', error);
            const cont = document.getElementById('inviteRequestsList');
            if (cont) {
                cont.innerHTML = '<div class="empty-state"><div class="empty-state-text">Ошибка загрузки списка гостей</div></div>';
            }
        }
    },

    /**
     * Рендеринг списка гостей
     */
    /**
     * Отфильтровать гостей, у которых уже есть pending-приглашение
     * (чтобы не дублировать их в "Одобренных гостях" и "Ожидают подтверждения")
     * @returns {Array} Гости без активных pending-инвайтов
     */
    _getVisibleGuests() {
        // Все значения pending — email ИЛИ reddyId (в зависимости от поля backend).
        // value = userEmail (всегда), поэтому сравниваем guest.email с pending.value.
        // Также учитываем pending.reddyId если backend его вернул.
        const pendingEmails = new Set();
        const pendingReddy = new Set();
        (TeamState.pendingInvites || []).forEach(inv => {
            if (inv.value) pendingEmails.add(String(inv.value).toLowerCase());
            if (inv.reddyId) pendingReddy.add(String(inv.reddyId).toLowerCase());
            // Если type=reddyId и value содержит только цифры — это Reddy ID, не email
            if (inv.type === 'reddyId' && inv.value && /^\d+$/.test(inv.value)) {
                pendingReddy.add(String(inv.value).toLowerCase());
            }
        });
        return (TeamState.availableGuests || []).filter(g => {
            const email = g && g.email ? String(g.email).toLowerCase() : '';
            const reddy = g && g.reddyId ? String(g.reddyId).toLowerCase() : '';
            if (email && pendingEmails.has(email)) return false;
            if (reddy && pendingReddy.has(reddy)) return false;
            return true;
        });
    },

    /**
     * Распознать "мягкие" ошибки бэкенда, которые не должны показываться как ошибка.
     * Возвращает { soft: true, message } если ошибка — мягкая, иначе null.
     * @param {string|Error} error
     * @returns {{soft: boolean, message: string}|null}
     */
    _classifyInviteError(error) {
        const raw = (error && error.message) ? error.message : String(error || '');
        const msg = raw.toLowerCase();

        // Примечание: 'already has pending invite' больше НЕ считается мягкой ошибкой —
        // после перехода на серверный pending-список это реальный баг синхронизации
        // (pending-список должен быть актуален и блокировать повторную отправку в UI).
        if (msg.includes('already accepted')) {
            return { soft: true, message: 'Пользователь уже принял приглашение' };
        }
        if (msg.includes('already in team') || msg.includes('user already in team')) {
            return { soft: true, message: 'Пользователь уже состоит в команде' };
        }
        return null;
    },

    /**
     * Отправка приглашения гостю (из списка)
     * @param {string} email - Email гостя
     */
    async inviteGuest(email) {
        // Защита от дабл-клика
        if (this._inflightGuestInvites && this._inflightGuestInvites.has(email)) return;
        this._inflightGuestInvites = this._inflightGuestInvites || new Set();
        this._inflightGuestInvites.add(email);

        // Loading state на кнопке — item остаётся в DOM до ответа сервера
        const btn = document.querySelector(
            '.invite-request-item--guest[data-email="' +
            (window.CSS && CSS.escape ? CSS.escape(email) : email) +
            '"] [data-action="team-inviteGuest"]'
        );
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        // Роль
        const roleInput = document.getElementById('roleValue_' + email);
        const assignedRole = roleInput ? roleInput.value : (RolesConfig.ASSIGNABLE_ROLES[0] || 'sales');

        const teamId = this._resolveTeamId();
        if (!teamId) {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
            this._inflightGuestInvites.delete(email);
            Toast.show('Выберите команду для приглашения', 'error');
            return;
        }

        // Сохранить снимок guest для enrichment (будет нужен для manual item)
        const guest = (TeamState.availableGuests || []).find(g => g.email === email);
        if (guest) this._updateGuestProfileCache([guest]);

        try {
            const result = await CloudStorage.sendInvite({
                userEmail: email,
                teamId: teamId,
                assignedRole: assignedRole
            });

            if (result && result.error) {
                const soft = this._classifyInviteError(result.error);
                if (soft) {
                    await this._refreshInviteLists();
                    Toast.show(soft.message, 'info');
                    return;
                }
                Toast.error('Ошибка приглашения: ' + result.error, 6000, {
                    action: { label: 'Повторить', callback: () => TeamInvites.inviteGuest(email) }
                });
                return;
            }

            await this._refreshInviteLists();
            Toast.show('Приглашение отправлено!', 'success');
        } catch (error) {
            const soft = this._classifyInviteError(error);
            if (soft) {
                await this._refreshInviteLists();
                Toast.show(soft.message, 'info');
                return;
            }
            Toast.error('Ошибка приглашения: ' + (error && error.message || 'network'), 6000, {
                action: { label: 'Повторить', callback: () => TeamInvites.inviteGuest(email) }
            });
        } finally {
            this._inflightGuestInvites.delete(email);
            // Кнопка снимается loading через render после refresh
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
        }
    },

    /**
     * Отправка приглашения (ручной ввод).
     * По Email — через sendInvite, по Reddy ID — через inviteByReddyId.
     * Оба варианта используют серверный pending-список.
     */
    async sendInvite() {
        const btn = document.querySelector('[data-action="team-sendInvite"]');
        // Защита от дабл-клика (кнопка уже в loading)
        if (btn && btn.classList.contains('btn-loading')) return;

        let value = '';
        // Определяем активную секцию по DOM (а не по TeamState.currentInviteType,
        // который может быть legacy 'guests' до первого клика по toggle)
        const reddySection = document.getElementById('inviteByReddyId');
        const emailSection = document.getElementById('inviteByEmail');
        let type;
        if (emailSection && !emailSection.classList.contains('hidden')) {
            type = 'email';
        } else if (reddySection && !reddySection.classList.contains('hidden')) {
            type = 'reddyId';
        } else {
            type = TeamState.currentInviteType === 'email' ? 'email' : 'reddyId';
        }
        TeamState.currentInviteType = type;

        if (type === 'reddyId') {
            value = document.getElementById('inviteReddyId').value.trim();
            if (!value) {
                Toast.show('Введите Reddy ID', 'error');
                return;
            }
            if (!Utils.isValidReddyId(value)) {
                Toast.show(Utils.REDDY_ID_ERROR, 'error');
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

        // Dedup guard: если уже есть pending/guest с этим значением — не отправляем
        if (this._isDuplicateInvite(type, value)) {
            Toast.show('Такое приглашение уже отправлено', 'warning');
            return;
        }

        // По Email — отправляем через API
        if (type === 'email') {
            await this.sendInviteByEmail(value);
            return;
        }

        // По Reddy ID — отправляем через серверный endpoint inviteByReddyId
        // Получить роль из селектора ручного ввода
        const roleInput = document.getElementById('inviteManualRoleValue');
        const assignedRole = roleInput ? roleInput.value : (RolesConfig.ASSIGNABLE_ROLES[0] || 'sales');

        const teamId = this._resolveTeamId();
        if (!teamId) {
            Toast.show('Команда не определена', 'error');
            return;
        }

        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }
        try {
            const result = await CloudStorage.inviteByReddyId(teamId, value, assignedRole);

            if (result && result.error) {
                const rawMsg = String(result.error);
                if (/не найден|not found/i.test(rawMsg)) {
                    Toast.show('Пользователь с таким Reddy ID не найден', 'error');
                } else {
                    Toast.show(rawMsg, 'error');
                }
                return;
            }

            this._invalidateGuestsCache();
            await this.loadPendingInvites();
            const reddyInput = document.getElementById('inviteReddyId');
            if (reddyInput) reddyInput.value = '';
            Toast.show('Приглашение отправлено!', 'success');
            this._refreshSendInviteDisabled();
        } catch (error) {
            const rawMsg = (error && error.message) ? error.message : String(error || '');
            if (/не найден|not found/i.test(rawMsg)) {
                Toast.show('Пользователь с таким Reddy ID не найден', 'error');
            } else {
                Toast.show('Ошибка отправки приглашения: ' + rawMsg, 'error');
            }
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
            this._refreshSendInviteDisabled();
        }
    },

    /**
     * Отправка приглашения по Email через backend API
     * @param {string} email - Email пользователя
     */
    async sendInviteByEmail(email) {
        const btn = document.querySelector('[data-action="team-sendInvite"]');
        if (btn && btn.classList.contains('btn-loading')) return;

        // Получить роль из селектора
        const roleInput = document.getElementById('inviteManualRoleValue');
        const assignedRole = roleInput ? roleInput.value : (RolesConfig.ASSIGNABLE_ROLES[0] || 'sales');

        const teamId = this._resolveTeamId();
        if (!teamId) {
            Toast.show('Команда не определена', 'error');
            return;
        }

        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }
        try {
            const result = await CloudStorage.sendInvite({
                userEmail: email,
                teamId: teamId,
                assignedRole: assignedRole
            });

            if (result.error) {
                const soft = this._classifyInviteError(result.error);
                if (soft) {
                    await this.loadPendingInvites();
                    Toast.show(soft.message, 'info');
                    document.getElementById('inviteEmail').value = '';
                    return;
                }
                Toast.show(result.error, 'error');
                return;
            }

            this._invalidateGuestsCache();
            await this.loadPendingInvites();
            Toast.show('Приглашение отправлено!', 'success');
            document.getElementById('inviteEmail').value = '';

        } catch (error) {
            const soft = this._classifyInviteError(error);
            if (soft) {
                await this.loadPendingInvites();
                Toast.show(soft.message, 'info');
                const input = document.getElementById('inviteEmail');
                if (input) input.value = '';
                return;
            }
            Toast.show('Ошибка отправки приглашения', 'error');
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
            this._refreshSendInviteDisabled();
        }
    },

    /**
     * Отмена приглашения (серверный cancelTeamInvite + optimistic rollback).
     * @param {string} inviteId - ID приглашения ('inv-...')
     */
    async cancelInvite(inviteId) {
        const id = String(inviteId);
        // Защита от дабл-клика
        if (this._inflightCancels && this._inflightCancels.has(id)) return;
        this._inflightCancels = this._inflightCancels || new Set();
        this._inflightCancels.add(id);

        // Loading state на кнопке — item остаётся в DOM до ответа сервера
        const btn = document.querySelector(
            '[data-action="team-cancelInvite"][data-invite-id="' +
            (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'
        );
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        try {
            const result = await CloudStorage.cancelTeamInvite(id);
            if (result && result.error) {
                throw new Error(result.error);
            }
            Toast.show('Приглашение отменено', 'info');
            await this._refreshInviteLists();
        } catch (error) {
            const msg = (error && error.message) ? error.message : 'ошибка сети';
            Toast.error('Не удалось отменить приглашение: ' + msg);
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
        } finally {
            this._inflightCancels.delete(id);
        }
    },

    /**
     * Загрузка pending-приглашений с сервера (getTeamPendingInvites).
     * Заменяет старую реализацию на основе localStorage.
     */
    async loadPendingInvites() {
        // Одноразовая миграция: убрать старый ключ localStorage
        try { localStorage.removeItem('team-pending-invites'); } catch (_) {}

        const teamId = this._resolveTeamId();
        if (!teamId) {
            TeamState.pendingInvites = [];
            this.renderInviteRequests();
            return;
        }

        try {
            const res = await CloudStorage.getTeamPendingInvites(teamId);
            if (res && res.error) {
                throw new Error(res.error);
            }
            const rawInvites = (res && res.invites) || [];
            TeamState.pendingInvites = rawInvites.map(inv => ({
                id: String(inv.inviteId),
                type: inv.inviteType || 'email',
                value: inv.userEmail,
                role: inv.assignedRole,
                roleName: inv.assignedRoleName,
                createdAt: inv.createdDate,
                status: 'pending'
            }));
            this.renderInviteRequests();
        } catch (err) {
            console.error('[TeamInvites] loadPendingInvites failed', err);
            TeamState.pendingInvites = [];
            this.renderInviteRequests();
            if (typeof Toast !== 'undefined' && Toast.error) {
                Toast.error('Не удалось загрузить список приглашений');
            }
        }
    },

    /** @deprecated Use renderInviteRequests() — legacy alias сохранён для совместимости. */
    renderPendingInvites() {
        this.renderInviteRequests();
    }
};
