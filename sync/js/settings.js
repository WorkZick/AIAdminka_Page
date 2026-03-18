/**
 * Settings Module - AIAdminka Settings Page
 * Работает с cloud-auth системой авторизации
 * Поддерживает систему ролей
 */

const settingsApp = {
    // Состояние
    currentUser: null,
    userProfile: null,

    // Названия и описания ролей — из RolesConfig (shared/roles-config.js)

    // ============ INITIALIZATION ============

    async init() {
        const loadingState = document.getElementById('settingsLoadingState');
        const layout = document.getElementById('settingsLayout');
        this.loadUserData();
        try {
            await this.loadProfile();
        } finally {
            if (loadingState) loadingState.classList.add('hidden');
            if (layout) layout.classList.remove('hidden');
        }
    },

    attachEventListeners() {
        // Profile form submit
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.saveProfile(e));
        }

        // Team name modal input - Enter key
        const teamNameInput = document.getElementById('teamNameModalInput');
        if (teamNameInput) {
            teamNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveTeamNameFromModal();
                }
            });
        }

        // Delegate clicks for data-action buttons
        this._clickHandler = (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const modal = target.dataset.modal;

            switch (action) {
                case 'edit-team-name':
                    this.editTeamName();
                    break;
                case 'clear-cache':
                    this.openModal('clearCacheModal');
                    break;
                case 'logout':
                    this.logout();
                    break;
                case 'close-modal':
                    if (modal) this.closeModal(modal);
                    break;
                case 'confirm-logout':
                    this.confirmLogout();
                    break;
                case 'confirm-clear-cache':
                    this.confirmClearCache();
                    break;
                case 'save-team-name':
                    this.saveTeamNameFromModal();
                    break;
            }
        };
        document.addEventListener('click', this._clickHandler);
    },

    // ============ User Data ============

    loadUserData() {
        const authData = sessionStorage.getItem('cloud-auth');
        if (authData) {
            try {
                const auth = JSON.parse(authData);
                this.currentUser = {
                    email: auth.email,
                    name: auth.name,
                    picture: auth.picture,
                    timestamp: auth.timestamp
                };
            } catch (e) {
                sessionStorage.removeItem('cloud-auth');
                this.currentUser = null;
            }
        }
    },

    async loadProfile() {
        try {
            // RoleGuard уже инициализирован через PageLifecycle → AuthGuard.checkWithRole()
            const roleGuardUser = typeof RoleGuard !== 'undefined' ? RoleGuard.user : null;

            // 1. Мгновенно формируем профиль из RoleGuard (без API-вызовов)
            this.userProfile = {
                email: this.currentUser?.email || '',
                name: roleGuardUser?.name || this.currentUser?.name || '',
                picture: this.currentUser?.picture || '',
                role: roleGuardUser?.role || 'user',
                reddyId: roleGuardUser?.reddyId || '',
                teamId: roleGuardUser?.teamId || '',
                teamName: roleGuardUser?.teamName || 'Команда',
                teamLeader: roleGuardUser?.teamLeader || null,
                status: roleGuardUser?.status || 'active',
                position: roleGuardUser?.position || '',
                crmLogin: '',
                corpTelegram: '',
                personalTelegram: '',
                corpEmail: this.currentUser?.email || '',
                personalEmail: '',
                corpPhone: '',
                personalPhone: '',
                birthday: '',
                startDate: '',
                office: '',
                company: '',
                comment: ''
            };

            // 2. Показываем UI сразу с базовыми данными
            this.updateUI();
            this.fillProfileForm();

            // 3. Детальные данные (контакты) — фоновая загрузка, не блокирует UI
            this._detailedLoading = this._loadDetailedProfile(roleGuardUser).catch(() => {});

        } catch (error) {
            ErrorHandler.handle(error, {
                module: 'settings',
                action: 'loadProfile'
            });
            this.updateUI();
        }
    },

    /**
     * Фоновая загрузка детальных данных профиля (контакты из Employees)
     * initStorage и getEmployees запускаются параллельно
     */
    async _loadDetailedProfile(roleGuardUser) {
        const currentEmail = this.currentUser?.email;
        if (!currentEmail) return;

        // initStorage — только при первом входе leader/admin
        const storageInitKey = 'storage-initialized-' + (roleGuardUser?.teamId || 'personal');
        const needsInit = roleGuardUser && !localStorage.getItem(storageInitKey) &&
            (roleGuardUser.role === 'leader' || roleGuardUser.role === 'admin' || roleGuardUser.isAdmin === true);

        // getEmployees — для ролей с доступом к сотрудникам
        const canViewEmployees = roleGuardUser && (
            roleGuardUser.role === 'leader' || roleGuardUser.role === 'admin' ||
            roleGuardUser.role === 'assistant' || roleGuardUser.isAdmin === true
        );
        const needsEmployees = canViewEmployees &&
            typeof CloudStorage !== 'undefined' && CloudStorage.isAuthenticated();

        if (!needsInit && !needsEmployees) return;

        try {
            // Запускаем параллельно
            const [, employees] = await Promise.all([
                needsInit
                    ? CloudStorage.initStorage()
                        .then(() => localStorage.setItem(storageInitKey, '1'))
                        .catch(() => {})
                    : Promise.resolve(),
                needsEmployees
                    ? CloudStorage.getEmployees().catch(() => null)
                    : Promise.resolve(null)
            ]);

            // Обновляем профиль из данных сотрудника
            if (Array.isArray(employees)) {
                const emp = employees.find(e =>
                    e.email === currentEmail || e.corpEmail === currentEmail || e.id === currentEmail
                );
                if (emp) {
                    Object.assign(this.userProfile, {
                        name: emp.fullName || this.userProfile.name,
                        picture: emp.avatar || this.userProfile.picture,
                        reddyId: emp.reddyId || this.userProfile.reddyId,
                        status: emp.status || this.userProfile.status,
                        position: emp.position || this.userProfile.position,
                        crmLogin: emp.crmLogin || '',
                        corpTelegram: emp.corpTelegram || '',
                        personalTelegram: emp.personalTelegram || '',
                        personalEmail: emp.personalEmail || '',
                        corpPhone: emp.corpPhone || '',
                        personalPhone: emp.personalPhone || '',
                        birthday: emp.birthday || '',
                        startDate: emp.startDate || '',
                        office: emp.office || '',
                        company: emp.company || '',
                        comment: emp.comment || ''
                    });
                    this.updateUI();
                    this.fillProfileForm();
                }
            }
        } catch (e) {
            // Детальные данные не загрузились — продолжаем с базовыми
        }
    },

    // ============ UI ============

    updateUI() {
        this.updateUserProfile();
        this.updateTeamInfo();
        this.updateConnectionStatus();
        this.updateSessionInfo();
        this.calculateStorageSize();
    },

    updateUserProfile() {
        const avatarEl = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');

        const profile = this.userProfile || this.currentUser;

        if (profile) {
            nameEl.textContent = profile.name || 'Пользователь';
            emailEl.textContent = profile.email || this.currentUser?.email || '-';

            const pictureUrl = profile.picture || this.currentUser?.picture;
            if (pictureUrl) {
                avatarEl.innerHTML = '';
                const img = document.createElement('img');
                if (Utils.isGoogleAvatar(pictureUrl)) {
                    img.src = pictureUrl;
                    img.alt = '';
                    img.onerror = () => { avatarEl.textContent = this.getInitials(profile.name); };
                    avatarEl.appendChild(img);
                } else {
                    avatarEl.textContent = this.getInitials(profile.name);
                }
            } else {
                avatarEl.textContent = this.getInitials(profile.name);
            }
        } else {
            nameEl.textContent = '-';
            emailEl.textContent = '-';
            avatarEl.textContent = '?';
        }
    },

    updateTeamInfo() {
        const roleEl = document.getElementById('userRole');
        const teamInfoSection = document.getElementById('teamInfoSection');
        const teamNameDisplay = document.getElementById('teamNameDisplay');
        const teamNameText = document.getElementById('teamNameText');
        const leaderEl = document.getElementById('teamLeader');
        const descEl = document.getElementById('roleDescription');

        if (this.userProfile) {
            // Роль
            const roleName = RolesConfig.getName(this.userProfile.role);
            roleEl.textContent = roleName;
            roleEl.className = 'role-badge role-' + this.userProfile.role;

            // Применить цвет для кастомных ролей
            if (typeof RolesConfig !== 'undefined' && RolesConfig.isCustomRole(this.userProfile.role)) {
                const color = RolesConfig.getColor(this.userProfile.role);
                roleEl.style.color = color;
                roleEl.style.background = color + '20';
            }

            // Название команды (для руководителей и админов)
            if (teamNameDisplay && teamNameText) {
                const savedTeamName = localStorage.getItem('team-name');
                const teamName = savedTeamName || this.userProfile.teamName || 'Команда';
                teamNameText.textContent = teamName;

                if (this.userProfile.role === 'leader' || this.userProfile.role === 'admin' || this.userProfile.isAdmin === true) {
                    teamNameDisplay.classList.remove('hidden');
                } else {
                    teamNameDisplay.classList.add('hidden');
                }
            }

            // Секция команды (показываем если не руководитель и не админ)
            if (teamInfoSection) {
                if (this.userProfile.teamLeader && this.userProfile.role !== 'leader' && this.userProfile.role !== 'admin' && this.userProfile.isAdmin !== true) {
                    teamInfoSection.classList.remove('hidden');
                    leaderEl.textContent = this.userProfile.teamLeader;
                    descEl.textContent = RolesConfig.getDescription(this.userProfile.role);
                } else {
                    teamInfoSection.classList.add('hidden');
                }
            }

        } else {
            roleEl.textContent = '-';
            if (teamInfoSection) teamInfoSection.classList.add('hidden');
            if (teamNameDisplay) teamNameDisplay.classList.add('hidden');
        }
    },

    _populateRoleSelect(selectedRole) {
        const input = document.getElementById('profilePositionValue');
        const label = document.getElementById('profilePositionLabel');
        if (!input) return;

        input.value = selectedRole || '';
        const roleName = selectedRole && typeof RolesConfig !== 'undefined'
            ? RolesConfig.getName(selectedRole)
            : (selectedRole || 'Роль');
        if (label) label.textContent = roleName;
    },

    fillProfileForm() {
        if (!this.userProfile) return;

        const p = this.userProfile;

        // Основная информация
        document.getElementById('profileName').value = p.name || '';
        this._populateRoleSelect(p.role || p.position || '');

        // Идентификация
        document.getElementById('profileReddyId').value = p.reddyId || '';
        document.getElementById('profileCrmLogin').value = p.crmLogin || '';

        // Контакты
        document.getElementById('profileCorpTelegram').value = p.corpTelegram || '';
        document.getElementById('profilePersonalTelegram').value = p.personalTelegram || '';
        document.getElementById('profileCorpEmail').value = this.currentUser?.email || p.corpEmail || '';
        document.getElementById('profilePersonalEmail').value = p.personalEmail || '';
        document.getElementById('profileCorpPhone').value = p.corpPhone || '';
        document.getElementById('profilePersonalPhone').value = p.personalPhone || '';

        // Информация о работе (input[type=date] требует формат yyyy-MM-dd)
        document.getElementById('profileBirthday').value = (p.birthday || '').substring(0, 10);
        document.getElementById('profileStartDate').value = (p.startDate || '').substring(0, 10);
        document.getElementById('profileOffice').value = p.office || '';
        document.getElementById('profileCompany').value = p.company || '';

        // Дополнительно
        document.getElementById('profileComment').value = p.comment || '';
    },

    updateConnectionStatus() {
        const statusEl = document.getElementById('connectionStatus');
        const storageStatusEl = document.getElementById('storageStatus');
        const storageInfo = localStorage.getItem('cloud-storage-info');

        if (this.currentUser && storageInfo) {
            statusEl.className = 'header-status connected';
            statusEl.querySelector('.status-text').textContent = 'Подключено';
            if (storageStatusEl) storageStatusEl.textContent = 'Подключено';
        } else if (this.currentUser) {
            statusEl.className = 'header-status pending';
            statusEl.querySelector('.status-text').textContent = 'Нет хранилища';
            if (storageStatusEl) storageStatusEl.textContent = 'Не настроено';
        } else {
            statusEl.className = 'header-status';
            statusEl.querySelector('.status-text').textContent = 'Не авторизован';
            if (storageStatusEl) storageStatusEl.textContent = 'Не подключено';
        }
    },

    updateSessionInfo() {
        const sessionExpiryEl = document.getElementById('sessionExpiry');
        if (!sessionExpiryEl) return;

        if (this.currentUser && this.currentUser.timestamp) {
            const expiryTime = new Date(this.currentUser.timestamp + TokenManager.TOKEN_LIFETIME);
            sessionExpiryEl.textContent = this.formatDateTime(expiryTime);
        } else {
            sessionExpiryEl.textContent = '-';
        }
    },

    calculateStorageSize() {
        const cacheKeys = ['partners', 'templates', 'methods', 'cache', 'partners-data'];
        let cacheSize = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            const size = (key.length + value.length) * 2;

            if (cacheKeys.some(k => key.includes(k))) {
                cacheSize += size;
            }
        }

        const cacheEl = document.getElementById('localCacheSize');
        if (cacheEl) {
            cacheEl.textContent = this.formatBytes(cacheSize);
        }
    },

    // ============ Profile Actions ============

    async saveProfile(event) {
        event.preventDefault();

        // Дождаться фоновой загрузки, чтобы не затереть контакты пустыми значениями
        if (this._detailedLoading) await this._detailedLoading;

        const form = document.getElementById('profileForm');
        const btn = document.getElementById('btnSaveProfile');
        const formData = new FormData(form);

        const profileData = {
            // Основная информация
            name: (formData.get('name') || '').trim(),
            position: document.getElementById('profilePositionValue')?.value || '',

            // Идентификация (reddyId не редактируется)
            crmLogin: (formData.get('crmLogin') || '').trim(),

            // Контакты
            corpTelegram: (formData.get('corpTelegram') || '').trim(),
            personalTelegram: (formData.get('personalTelegram') || '').trim(),
            corpEmail: this.currentUser?.email || '',
            personalEmail: (formData.get('personalEmail') || '').trim(),
            corpPhone: (formData.get('corpPhone') || '').trim(),
            personalPhone: (formData.get('personalPhone') || '').trim(),

            // Информация о работе
            birthday: (formData.get('birthday') || '').trim(),
            startDate: (formData.get('startDate') || '').trim(),
            office: (formData.get('office') || '').trim(),
            company: (formData.get('company') || '').trim(),

            // Дополнительно
            comment: (formData.get('comment') || '').trim()
        };

        btn.disabled = true;
        btn.textContent = 'Сохранение...';

        try {
            // Обновляем локальный объект профиля
            Object.assign(this.userProfile, profileData);
            this.updateUserProfile();

            // Синхронизируем профиль с облаком (модуль "Сотрудники")
            await this.syncToTeamInfo(profileData);

            btn.textContent = 'Сохранено';
            btn.classList.add('success');
            Toast.success('Профиль синхронизирован');

            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('success');
                btn.textContent = 'Сохранить изменения';
            }, 2000);

        } catch (error) {
            btn.disabled = false;
            btn.textContent = 'Сохранить изменения';
            ErrorHandler.handle(error, {
                module: 'settings',
                action: 'saveProfile'
            });
        }

        return false;
    },

    // ============ Auth Actions ============

    logout() {
        this.openModal('logoutModal');
    },

    confirmLogout() {
        this.closeModal('logoutModal');

        sessionStorage.removeItem('cloud-auth');
        localStorage.removeItem('cloud-storage-info');
        localStorage.removeItem('partners-data');
        localStorage.removeItem('traffic-analytics-temp');
        localStorage.removeItem('roleGuard');

        window.location.href = '../login/index.html';
    },

    confirmClearCache() {
        this.closeModal('clearCacheModal');

        localStorage.removeItem('partners-data');
        localStorage.removeItem('traffic-analytics-temp');
        localStorage.removeItem('roleGuard');

        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('cache') || key === 'partners' || key === 'templates' || key === 'methods' || key.startsWith('storage-initialized-')) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));

        this.calculateStorageSize();
        Toast.success('Кэш очищен');
    },

    // ============ Modals ============

    openModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.classList.add('active');
    },

    closeModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.classList.remove('active');
    },

    // ============ Helpers ============

    getInitials(name) { return Utils.getInitials(name); },
    formatDateTime(date) { return Utils.formatDateTime(date); },
    formatBytes(bytes) { return Utils.formatBytes(bytes); },

    // ============ Team Settings ============

    editTeamName() {
        // TODO: Редактирование названия команды требует API метода updateTeam
        // Пока показываем информационное сообщение
        Toast.info('Изменение названия команды доступно в админ-панели');
    },

    saveTeamNameFromModal() {
        // TODO: Реализовать через API
        this.closeModal('teamNameModal');
    },

    // ============ Sync to Team Info ============

    /**
     * Синхронизация профиля с модулем "Сотрудники" (team-info)
     * Создаёт или обновляет карточку сотрудника в CloudStorage
     */
    destroy() {
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }
    },

    async syncToTeamInfo(profileData) {
        // Получаем текущий email пользователя
        const userEmail = this.currentUser?.email || this.userProfile?.email;
        if (!userEmail) return;

        // Проверяем что пользователь в команде (не guest без команды)
        const teamId = this.userProfile?.teamId;
        if (!teamId && this.userProfile?.role !== 'admin') return;

        // Формируем данные сотрудника для облака
        const employeeData = {
            email: userEmail,
            fullName: profileData.name || this.userProfile?.name || '',
            position: profileData.position || this.userProfile?.position || '',
            avatar: this.userProfile?.picture || this.currentUser?.picture || '',
            status: 'Работает',
            reddyId: this.userProfile?.reddyId || '',
            crmLogin: profileData.crmLogin || '',
            corpTelegram: profileData.corpTelegram || '',
            personalTelegram: profileData.personalTelegram || '',
            corpEmail: this.currentUser?.email || '',
            personalEmail: profileData.personalEmail || '',
            corpPhone: profileData.corpPhone || '',
            personalPhone: profileData.personalPhone || '',
            birthday: profileData.birthday || '',
            startDate: profileData.startDate || '',
            office: profileData.office || '',
            company: profileData.company || '',
            comment: profileData.comment || '',
            predefinedFields: {},
            customFields: {}
        };

        // Добавляем предопределённые поля для совместимости
        if (employeeData.reddyId) {
            employeeData.predefinedFields['Reddy'] = employeeData.reddyId;
        }
        if (employeeData.corpTelegram) {
            employeeData.predefinedFields['Корп. Telegram'] = employeeData.corpTelegram;
        }
        if (employeeData.corpEmail) {
            employeeData.predefinedFields['Корп. e-mail'] = employeeData.corpEmail;
        }
        if (employeeData.corpPhone) {
            employeeData.predefinedFields['Корп. телефон'] = employeeData.corpPhone;
        }

        try {
            // Проверяем инициализирован ли CloudStorage
            if (typeof CloudStorage === 'undefined' || !CloudStorage.isAuthenticated()) {
                console.error('[Settings] CloudStorage not available');
                Toast.error('Облачное хранилище недоступно');
                return;
            }

            // Получаем текущих сотрудников чтобы найти существующего
            const employees = await CloudStorage.getEmployees();
            const existing = employees.find(emp => emp.email === userEmail || emp.corpEmail === userEmail);

            if (existing) {
                // Обновляем существующего - сохраняем его id
                employeeData.id = existing.id;
            }

            // Сохраняем в облако
            const result = await CloudStorage.saveEmployee(employeeData);

            if (!result.success && !result.id) {
                console.error('[Settings] Cloud sync failed:', result.error);
                Toast.error('Ошибка синхронизации: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('[Settings] Failed to sync to cloud:', error);
            Toast.error('Ошибка сохранения профиля');
        }
    }
};

// Initialize via PageLifecycle
PageLifecycle.init({
    module: 'settings',
    async onInit() {
        await settingsApp.init();
        settingsApp.attachEventListeners();
    },
    onDestroy() {
        settingsApp.destroy();
    }
});
