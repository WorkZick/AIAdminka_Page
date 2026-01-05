/**
 * Settings Module - AIAdminka Settings Page
 * Работает с cloud-auth системой авторизации
 * Поддерживает систему ролей
 */

const settingsApp = {
    // Состояние
    currentUser: null,
    userProfile: null,

    // Mock API режим (для тестирования без backend)
    USE_MOCK_API: true,

    // ============ MOCK API DATA ============

    mockData: {
        profile: {
            email: '',
            name: 'Тестовый Пользователь',
            position: 'Менеджер по продажам',
            reddyId: '123456',
            crmLogin: 'test.user',
            corpTelegram: 'work_user',
            personalTelegram: 'test_user',
            corpEmail: 'work@company.com',
            personalEmail: 'personal@mail.com',
            corpPhone: '+7 999 123-45-67',
            personalPhone: '+7 999 765-43-21',
            birthday: '1990-01-15',
            startDate: '2023-06-01',
            office: 'Москва',
            company: 'ООО "Компания"',
            comment: '',
            picture: '',
            role: 'leader',
            teamId: 'team-001',
            teamName: 'Команда Alpha',
            teamLeader: null, // null = сам руководитель
            status: 'active'
        }
    },

    // Названия ролей
    roleNames: {
        'admin': 'Администратор',
        'leader': 'Руководитель',
        'assistant': 'Помощник руководителя',
        'sales': 'Менеджер по продажам',
        'partners_mgr': 'Менеджер по партнёрам',
        'payments': 'Менеджер платёжных систем',
        'antifraud': 'Специалист по антифроду',
        'tech': 'Технический специалист'
    },

    // Описания ролей
    roleDescriptions: {
        'admin': 'Полный доступ ко всем функциям системы и управление всеми командами.',
        'leader': 'Управление своей командой, одобрение запросов и настройка прав сотрудников.',
        'assistant': 'Помощь руководителю в управлении командой.',
        'sales': 'Работа с партнёрами и продажами.',
        'partners_mgr': 'Управление партнёрскими отношениями.',
        'payments': 'Работа с платёжными системами и транзакциями.',
        'antifraud': 'Мониторинг и предотвращение мошенничества.',
        'tech': 'Техническая поддержка и настройка системы.'
    },

    // ============ INITIALIZATION ============

    init() {
        this.loadUserData();
        this.loadProfile();
    },

    // ============ User Data ============

    loadUserData() {
        const authData = localStorage.getItem('cloud-auth');
        if (authData) {
            const auth = JSON.parse(authData);
            this.currentUser = {
                email: auth.email,
                name: auth.name,
                picture: auth.picture,
                timestamp: auth.timestamp
            };

            // Обновить mock данные с реальным email
            if (this.USE_MOCK_API) {
                this.mockData.profile.email = auth.email;
                this.mockData.profile.name = auth.name || this.mockData.profile.name;
                this.mockData.profile.picture = auth.picture || '';
            }
        }
    },

    async loadProfile() {
        try {
            const result = await this.apiCall('getProfile');

            if (result.error) {
                console.error('Error loading profile:', result.error);
                this.updateUI();
                return;
            }

            this.userProfile = result.profile;
            this.updateUI();
            this.fillProfileForm();

        } catch (error) {
            console.error('Error loading profile:', error);
            this.updateUI();
        }
    },

    // ============ API ============

    async apiCall(action, params = {}) {
        if (this.USE_MOCK_API) {
            return this.mockApiCall(action, params);
        }

        // Реальный API call (будет реализован позже)
        const url = new URL(CloudStorage.SCRIPT_URL);
        url.searchParams.set('action', action);

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }

        const response = await fetch(url.toString(), { method: 'GET' });
        return response.json();
    },

    async mockApiCall(action, params = {}) {
        // Имитация задержки сети
        await new Promise(resolve => setTimeout(resolve, 300));

        switch (action) {
            case 'getProfile':
                return {
                    success: true,
                    profile: { ...this.mockData.profile }
                };

            case 'updateProfile':
                // Обновляем mock данные
                Object.assign(this.mockData.profile, params);
                return {
                    success: true,
                    message: 'Профиль обновлён'
                };

            default:
                return { error: 'Unknown action: ' + action };
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
                if (pictureUrl.startsWith('https://lh')) {
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
        const teamEl = document.getElementById('userTeam');
        const teamInfoSection = document.getElementById('teamInfoSection');
        const leaderEl = document.getElementById('teamLeader');
        const descEl = document.getElementById('roleDescription');

        if (this.userProfile) {
            // Роль
            const roleName = this.roleNames[this.userProfile.role] || this.userProfile.role;
            roleEl.textContent = roleName;
            roleEl.className = 'role-badge role-' + this.userProfile.role;

            // Команда
            if (this.userProfile.teamName) {
                teamEl.textContent = this.userProfile.teamName;
            } else if (this.userProfile.role === 'admin') {
                teamEl.textContent = 'Все команды';
            } else {
                teamEl.textContent = '';
            }

            // Секция команды (показываем если не руководитель и не админ)
            if (teamInfoSection) {
                if (this.userProfile.teamLeader && this.userProfile.role !== 'leader' && this.userProfile.role !== 'admin') {
                    teamInfoSection.style.display = '';
                    leaderEl.textContent = this.userProfile.teamLeader;
                    descEl.textContent = this.roleDescriptions[this.userProfile.role] || '';
                } else {
                    teamInfoSection.style.display = 'none';
                }
            }

        } else {
            roleEl.textContent = '-';
            teamEl.textContent = '';
            if (teamInfoSection) teamInfoSection.style.display = 'none';
        }
    },

    fillProfileForm() {
        if (!this.userProfile) return;

        const p = this.userProfile;

        // Основная информация
        document.getElementById('profileName').value = p.name || '';
        document.getElementById('profilePosition').value = p.position || '';

        // Идентификация
        document.getElementById('profileReddyId').value = p.reddyId || '';
        document.getElementById('profileCrmLogin').value = p.crmLogin || '';

        // Контакты
        document.getElementById('profileCorpTelegram').value = p.corpTelegram || '';
        document.getElementById('profilePersonalTelegram').value = p.personalTelegram || '';
        document.getElementById('profileCorpEmail').value = p.corpEmail || '';
        document.getElementById('profilePersonalEmail').value = p.personalEmail || '';
        document.getElementById('profileCorpPhone').value = p.corpPhone || '';
        document.getElementById('profilePersonalPhone').value = p.personalPhone || '';

        // Информация о работе
        document.getElementById('profileBirthday').value = p.birthday || '';
        document.getElementById('profileStartDate').value = p.startDate || '';
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
            const expiryTime = new Date(this.currentUser.timestamp + 3500000);
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

        const form = document.getElementById('profileForm');
        const btn = document.getElementById('btnSaveProfile');
        const formData = new FormData(form);

        const profileData = {
            // Основная информация
            name: (formData.get('name') || '').trim(),
            position: (formData.get('position') || '').trim(),

            // Идентификация (reddyId не редактируется)
            crmLogin: (formData.get('crmLogin') || '').trim(),

            // Контакты
            corpTelegram: (formData.get('corpTelegram') || '').trim(),
            personalTelegram: (formData.get('personalTelegram') || '').trim(),
            corpEmail: (formData.get('corpEmail') || '').trim(),
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
            const result = await this.apiCall('updateProfile', profileData);

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.success) {
                Object.assign(this.userProfile, profileData);
                this.updateUserProfile();

                btn.textContent = 'Сохранено';
                btn.classList.add('success');

                setTimeout(() => {
                    btn.disabled = false;
                    btn.classList.remove('success');
                    btn.textContent = 'Сохранить изменения';
                }, 2000);
            }

        } catch (error) {
            btn.disabled = false;
            btn.textContent = 'Сохранить изменения';
            alert('Ошибка сохранения: ' + error.message);
        }

        return false;
    },

    // ============ Auth Actions ============

    logout() {
        this.openModal('logoutModal');
    },

    confirmLogout() {
        this.closeModal('logoutModal');

        localStorage.removeItem('cloud-auth');
        localStorage.removeItem('cloud-storage-info');
        localStorage.removeItem('partners-data');
        localStorage.removeItem('traffic-analytics-temp');
        localStorage.removeItem('roleGuard');

        window.location.href = '../login/index.html';
    },

    clearCache() {
        if (!confirm('Очистить кэш данных? Данные будут загружены заново из облака при следующем посещении.')) {
            return;
        }

        localStorage.removeItem('partners-data');
        localStorage.removeItem('traffic-analytics-temp');
        localStorage.removeItem('roleGuard');

        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('cache') || key === 'partners' || key === 'templates' || key === 'methods') {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));

        this.calculateStorageSize();
        alert('Кэш очищен');
    },

    // ============ Sidebar ============

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    // ============ Modals ============

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    // ============ Helpers ============

    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },

    formatDateTime(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return day + '.' + month + '.' + year + ' ' + hours + ':' + minutes;
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 Б';
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    }
};

// Для отладки: переключение роли через консоль
if (settingsApp.USE_MOCK_API) {
    window.setMockRole = (role) => {
        settingsApp.mockData.profile.role = role;
        console.log('Mock role set to:', role);
        console.log('Available roles:', Object.keys(settingsApp.roleNames).join(', '));
        settingsApp.loadProfile();
    };
    window.setMockTeam = (teamName, leaderName = null) => {
        settingsApp.mockData.profile.teamName = teamName;
        settingsApp.mockData.profile.teamLeader = leaderName;
        console.log('Mock team set to:', teamName);
        settingsApp.loadProfile();
    };
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    settingsApp.init();
});
