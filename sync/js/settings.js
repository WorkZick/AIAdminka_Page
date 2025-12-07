/**
 * Settings Module - AIAdminka Settings Page
 * Работает с cloud-auth системой авторизации
 */

const settingsApp = {
    // Состояние
    currentUser: null,

    // Инициализация
    init() {
        this.loadUserData();
        this.updateUI();
        this.calculateStorageSize();
    },

    // =============== User Data ===============

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
        }
    },

    // =============== UI ===============

    updateUI() {
        this.updateUserProfile();
        this.updateConnectionStatus();
        this.updateSessionInfo();
    },

    updateUserProfile() {
        const avatarEl = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');

        if (this.currentUser) {
            nameEl.textContent = this.currentUser.name || 'Пользователь';
            emailEl.textContent = this.currentUser.email;

            if (this.currentUser.picture) {
                // Безопасное создание img элемента (защита от XSS)
                avatarEl.innerHTML = '';
                const img = document.createElement('img');
                // Валидируем URL - только HTTPS от Google
                const pictureUrl = this.currentUser.picture;
                if (pictureUrl && (pictureUrl.startsWith('https://lh3.googleusercontent.com/') ||
                                  pictureUrl.startsWith('https://lh4.googleusercontent.com/') ||
                                  pictureUrl.startsWith('https://lh5.googleusercontent.com/') ||
                                  pictureUrl.startsWith('https://lh6.googleusercontent.com/'))) {
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
        } else {
            nameEl.textContent = '-';
            emailEl.textContent = '-';
            avatarEl.textContent = '?';
        }
    },

    updateConnectionStatus() {
        const statusEl = document.getElementById('connectionStatus');
        const storageStatusEl = document.getElementById('storageStatus');
        const storageInfo = localStorage.getItem('cloud-storage-info');

        if (this.currentUser && storageInfo) {
            statusEl.className = 'header-status connected';
            statusEl.querySelector('.status-text').textContent = 'Подключено';
            storageStatusEl.textContent = 'Подключено';
            storageStatusEl.className = 'info-value status-ok';
        } else if (this.currentUser) {
            statusEl.className = 'header-status pending';
            statusEl.querySelector('.status-text').textContent = 'Нет хранилища';
            storageStatusEl.textContent = 'Не настроено';
            storageStatusEl.className = 'info-value status-warning';
        } else {
            statusEl.className = 'header-status';
            statusEl.querySelector('.status-text').textContent = 'Не авторизован';
            storageStatusEl.textContent = 'Не подключено';
            storageStatusEl.className = 'info-value status-error';
        }
    },

    updateSessionInfo() {
        const sessionExpiryEl = document.getElementById('sessionExpiry');

        if (this.currentUser && this.currentUser.timestamp) {
            // Токен живёт ~58 мин, но Silent Refresh обновляет автоматически
            const expiryTime = new Date(this.currentUser.timestamp + 3500000);
            sessionExpiryEl.textContent = this.formatDateTime(expiryTime);
        } else {
            sessionExpiryEl.textContent = '-';
        }
    },

    calculateStorageSize() {
        const settingsKeys = ['sidebar-collapsed', 'partnersColumnsConfig', 'excelReportsSettings'];
        const cacheKeys = ['partners', 'templates', 'methods'];

        let settingsSize = 0;
        let cacheSize = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            const size = (key.length + value.length) * 2; // UTF-16

            if (settingsKeys.some(k => key.includes(k))) {
                settingsSize += size;
            } else if (cacheKeys.some(k => key.includes(k))) {
                cacheSize += size;
            }
        }

        document.getElementById('localSettingsSize').textContent = this.formatBytes(settingsSize);
        document.getElementById('localCacheSize').textContent = this.formatBytes(cacheSize);
    },

    // =============== Actions ===============

    logout() {
        this.openModal('logoutModal');
    },

    confirmLogout() {
        this.closeModal('logoutModal');

        // Очищаем данные авторизации
        localStorage.removeItem('cloud-auth');
        localStorage.removeItem('cloud-storage-info');

        // Очищаем кэш данных пользователя
        localStorage.removeItem('partners-data');
        localStorage.removeItem('traffic-analytics-temp');

        // Редирект на страницу входа
        window.location.href = '../login/index.html';
    },

    clearCache() {
        if (!confirm('Очистить кэш данных? Данные будут загружены заново из облака при следующем посещении.')) {
            return;
        }

        // Очищаем кэш данных
        localStorage.removeItem('partners-data');
        localStorage.removeItem('traffic-analytics-temp');

        // Очищаем остальной кэш
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

    // =============== Sidebar ===============

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    // =============== Modals ===============

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    // =============== Helpers ===============

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

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    settingsApp.init();
});
