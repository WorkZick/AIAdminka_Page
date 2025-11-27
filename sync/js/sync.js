/**
 * Sync Module - Cloud Synchronization via Google Sheets + Apps Script
 *
 * Работает через открытие в новой вкладке + ручное копирование результата
 */

const syncApp = {
    // Состояние
    scriptUrl: '',
    currentUser: null,
    allUsers: [],
    selectedImportUser: null,
    accessSettings: {},
    logs: [],

    // Данные для синхронизации
    syncData: {
        projectName: 'AIAdminka',
        version: '2.3.0',
        author: '',
        note: 'Тестовые данные для проверки синхронизации.'
    },

    // Инициализация
    init() {
        this.loadConfig();
        this.loadData();
        this.loadLogs();
        this.updateUI();
        this.addLog('info', 'Модуль синхронизации загружен');
    },

    // =============== Sidebar ===============

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    // =============== Config ===============

    loadConfig() {
        const saved = localStorage.getItem('sync-config');
        if (saved) {
            const config = JSON.parse(saved);
            this.scriptUrl = config.scriptUrl || '';
            this.currentUser = config.currentUser || null;
        }
        document.getElementById('configScriptUrl').value = this.scriptUrl;
        this.updateConnectionUI();
    },

    saveConfig() {
        this.scriptUrl = document.getElementById('configScriptUrl').value.trim();
        localStorage.setItem('sync-config', JSON.stringify({
            scriptUrl: this.scriptUrl,
            currentUser: this.currentUser
        }));
        this.updateConnectionUI();
    },

    updateConnectionUI() {
        const statusEl = document.getElementById('connectionStatus');
        const statusValue = document.getElementById('statusValue');
        const userEmail = document.getElementById('userEmail');
        const userName = document.getElementById('userName');
        const btnExport = document.getElementById('btnExport');
        const btnImport = document.getElementById('btnImport');
        const btnAccess = document.getElementById('btnAccess');

        if (this.currentUser) {
            statusEl.className = 'header-status connected';
            statusEl.querySelector('.status-text').textContent = 'Подключено';
            statusValue.textContent = 'Подключено';
            statusValue.className = 'info-value success';
            userEmail.textContent = this.currentUser.email;
            userName.textContent = this.currentUser.name || '-';
            btnExport.disabled = false;
            btnImport.disabled = false;
            btnAccess.disabled = false;
        } else if (this.scriptUrl) {
            statusEl.className = 'header-status pending';
            statusEl.querySelector('.status-text').textContent = 'Требуется проверка';
            statusValue.textContent = 'Нажмите "Проверить"';
            statusValue.className = 'info-value';
            userEmail.textContent = '-';
            userName.textContent = '-';
            btnExport.disabled = true;
            btnImport.disabled = true;
            btnAccess.disabled = true;
        } else {
            statusEl.className = 'header-status';
            statusEl.querySelector('.status-text').textContent = 'Не настроено';
            statusValue.textContent = 'Введите URL';
            statusValue.className = 'info-value';
            userEmail.textContent = '-';
            userName.textContent = '-';
            btnExport.disabled = true;
            btnImport.disabled = true;
            btnAccess.disabled = true;
        }
    },

    // =============== Data ===============

    loadData() {
        const saved = localStorage.getItem('sync-data');
        if (saved) {
            this.syncData = JSON.parse(saved);
        }
        document.getElementById('dataProjectName').value = this.syncData.projectName || '';
        document.getElementById('dataVersion').value = this.syncData.version || '';
        document.getElementById('dataAuthor').value = this.syncData.author || '';
        document.getElementById('dataNote').value = this.syncData.note || '';
    },

    saveData() {
        this.syncData = {
            projectName: document.getElementById('dataProjectName').value,
            version: document.getElementById('dataVersion').value,
            author: document.getElementById('dataAuthor').value,
            note: document.getElementById('dataNote').value
        };
        localStorage.setItem('sync-data', JSON.stringify(this.syncData));
    },

    resetData() {
        this.syncData = {
            projectName: 'AIAdminka',
            version: '2.3.0',
            author: '',
            note: 'Тестовые данные для проверки синхронизации.'
        };
        localStorage.setItem('sync-data', JSON.stringify(this.syncData));
        this.loadData();
        this.addLog('info', 'Данные сброшены');
    },

    // =============== Test Connection ===============

    testConnection() {
        if (!this.scriptUrl) {
            alert('Введите URL Google Apps Script');
            return;
        }

        this.addLog('info', 'Проверка подключения...');

        // Открываем в новой вкладке
        const url = this.scriptUrl + '?action=ping';
        window.open(url, '_blank');

        // Показываем модалку для ввода результата
        this.openModal('resultModal');
        document.getElementById('resultAction').value = 'ping';
        document.getElementById('resultInput').value = '';
        document.getElementById('resultInput').placeholder = '{"success":true,"email":"...","name":"..."}';
    },

    // =============== Export ===============

    showExportModal() {
        const preview = document.getElementById('exportPreview');
        preview.textContent = JSON.stringify(this.syncData, null, 2);
        this.openModal('exportModal');
    },

    doExport() {
        this.closeModal('exportModal');
        this.addLog('info', 'Экспорт данных...');

        const dataToExport = {
            ...this.syncData,
            exportedAt: new Date().toISOString()
        };

        const url = this.scriptUrl + '?action=export&data=' + encodeURIComponent(JSON.stringify(dataToExport));
        window.open(url, '_blank');

        this.openModal('resultModal');
        document.getElementById('resultAction').value = 'export';
        document.getElementById('resultInput').value = '';
        document.getElementById('resultInput').placeholder = '{"success":true}';
    },

    // =============== Import ===============

    showImportModal() {
        this.addLog('info', 'Загрузка списка пользователей...');

        const url = this.scriptUrl + '?action=getAvailableUsers';
        window.open(url, '_blank');

        this.openModal('resultModal');
        document.getElementById('resultAction').value = 'getAvailableUsers';
        document.getElementById('resultInput').value = '';
        document.getElementById('resultInput').placeholder = '{"users":[...]}';
    },

    doImportFromUser(email) {
        this.addLog('info', 'Импорт от ' + email + '...');

        const url = this.scriptUrl + '?action=import&fromEmail=' + encodeURIComponent(email);
        window.open(url, '_blank');

        this.openModal('resultModal');
        document.getElementById('resultAction').value = 'import';
        document.getElementById('resultInput').value = '';
        document.getElementById('resultInput').placeholder = '{"success":true,"data":{...}}';
    },

    // =============== Access Settings ===============

    showAccessModal() {
        this.addLog('info', 'Загрузка настроек доступа...');

        const url = this.scriptUrl + '?action=getAllUsers';
        window.open(url, '_blank');

        this.openModal('resultModal');
        document.getElementById('resultAction').value = 'getAllUsers';
        document.getElementById('resultInput').value = '';
        document.getElementById('resultInput').placeholder = '{"users":[...],"myAllowedViewers":[...]}';
    },

    saveAccessToServer(allowedViewers) {
        this.addLog('info', 'Сохранение настроек доступа...');

        const url = this.scriptUrl + '?action=setAccess&allowedViewers=' + encodeURIComponent(JSON.stringify(allowedViewers));
        window.open(url, '_blank');

        this.openModal('resultModal');
        document.getElementById('resultAction').value = 'setAccess';
        document.getElementById('resultInput').value = '';
        document.getElementById('resultInput').placeholder = '{"success":true}';
    },

    // =============== Result Modal ===============

    applyResult() {
        const action = document.getElementById('resultAction').value;
        const input = document.getElementById('resultInput').value.trim();

        if (!input) {
            alert('Вставьте результат из открывшейся вкладки');
            return;
        }

        let result;
        try {
            result = JSON.parse(input);
        } catch (e) {
            alert('Ошибка: неверный формат JSON\n\nУбедитесь, что скопировали весь текст из вкладки');
            return;
        }

        if (result.error) {
            this.addLog('error', 'Ошибка: ' + result.error);
            alert('Ошибка: ' + result.error);
            this.closeModal('resultModal');
            return;
        }

        this.closeModal('resultModal');

        switch (action) {
            case 'ping':
                this.handlePingResult(result);
                break;
            case 'export':
                this.handleExportResult(result);
                break;
            case 'getAvailableUsers':
                this.handleGetAvailableUsersResult(result);
                break;
            case 'import':
                this.handleImportResult(result);
                break;
            case 'getAllUsers':
                this.handleGetAllUsersResult(result);
                break;
            case 'setAccess':
                this.handleSetAccessResult(result);
                break;
        }
    },

    handlePingResult(result) {
        this.currentUser = {
            email: result.email,
            name: result.name
        };

        localStorage.setItem('sync-config', JSON.stringify({
            scriptUrl: this.scriptUrl,
            currentUser: this.currentUser
        }));

        this.updateConnectionUI();
        this.addLog('success', 'Подключено как ' + result.email);
        alert('Подключено!\n\nВаш email: ' + result.email + '\nИмя: ' + (result.name || '-'));
    },

    handleExportResult(result) {
        if (result.success) {
            this.addLog('success', 'Данные успешно экспортированы');
            alert('Данные успешно экспортированы!');
        }
    },

    handleGetAvailableUsersResult(result) {
        const users = result.users || [];

        if (users.length === 0) {
            alert('Нет доступных пользователей для импорта.\nПопросите коллег дать вам доступ.');
            return;
        }

        this.openModal('importModal');
        this.renderImportUsersList(users);
    },

    handleImportResult(result) {
        if (result.data) {
            this.syncData = {
                projectName: result.data.projectName || '',
                version: result.data.version || '',
                author: result.data.author || '',
                note: result.data.note || ''
            };
            localStorage.setItem('sync-data', JSON.stringify(this.syncData));
            this.loadData();

            this.addLog('success', 'Данные импортированы');
            alert('Данные успешно импортированы!');
        }
    },

    handleGetAllUsersResult(result) {
        this.allUsers = result.users || [];
        this.accessSettings = {};

        const mySettings = result.myAllowedViewers || [];
        const self = this;
        mySettings.forEach(function(email) {
            self.accessSettings[email] = true;
        });

        this.openModal('accessModal');
        this.renderAccessUsersList();
    },

    handleSetAccessResult(result) {
        if (result.success) {
            this.addLog('success', 'Настройки доступа сохранены');
            alert('Настройки доступа сохранены!');
        }
    },

    // =============== Render Lists ===============

    renderImportUsersList(users) {
        const listEl = document.getElementById('importUsersList');
        const self = this;

        if (!users || users.length === 0) {
            listEl.innerHTML = '<div class="empty-list">Нет доступных пользователей</div>';
            return;
        }

        let html = '';
        users.forEach(function(user) {
            const initials = self.getInitials(user.name);
            const hasData = user.hasData;
            const updateText = user.lastUpdate ? self.formatDate(user.lastUpdate) : '';

            html += '<div class="user-item' + (hasData ? '' : ' no-data') + '" data-email="' + user.email + '">';
            html += '  <div class="user-avatar">' + initials + '</div>';
            html += '  <div class="user-info">';
            html += '    <div class="user-name">' + (user.name || user.email) + '</div>';
            html += '    <div class="user-email">' + user.email + '</div>';
            html += '  </div>';
            html += '  <div class="user-meta">';
            if (hasData) {
                html += '    <div class="user-update">' + updateText + '</div>';
            } else {
                html += '    <div class="user-no-data">Нет данных</div>';
            }
            html += '  </div>';
            html += '</div>';
        });

        listEl.innerHTML = html;

        listEl.querySelectorAll('.user-item:not(.no-data)').forEach(function(item) {
            item.addEventListener('click', function() {
                listEl.querySelectorAll('.user-item').forEach(function(i) {
                    i.classList.remove('selected');
                });
                item.classList.add('selected');
                self.selectedImportUser = item.dataset.email;
                document.getElementById('btnDoImport').disabled = false;
            });
        });

        document.getElementById('btnDoImport').disabled = true;
        this.selectedImportUser = null;
    },

    doImport() {
        if (!this.selectedImportUser) {
            alert('Выберите пользователя');
            return;
        }

        this.closeModal('importModal');
        this.doImportFromUser(this.selectedImportUser);
    },

    renderAccessUsersList() {
        const listEl = document.getElementById('accessUsersList');
        const self = this;

        const otherUsers = this.allUsers.filter(function(u) {
            return self.currentUser && u.email.toLowerCase() !== self.currentUser.email.toLowerCase();
        });

        if (otherUsers.length === 0) {
            listEl.innerHTML = '<div class="empty-list">Нет других пользователей</div>';
            return;
        }

        let html = '';
        otherUsers.forEach(function(user) {
            const initials = self.getInitials(user.name);
            const isChecked = self.accessSettings[user.email] === true;

            html += '<div class="user-item" data-email="' + user.email + '">';
            html += '  <div class="user-checkbox' + (isChecked ? ' checked' : '') + '"></div>';
            html += '  <div class="user-avatar">' + initials + '</div>';
            html += '  <div class="user-info">';
            html += '    <div class="user-name">' + (user.name || user.email) + '</div>';
            html += '    <div class="user-email">' + user.email + '</div>';
            html += '  </div>';
            html += '</div>';
        });

        listEl.innerHTML = html;

        listEl.querySelectorAll('.user-item').forEach(function(item) {
            item.addEventListener('click', function() {
                const email = item.dataset.email;
                const checkbox = item.querySelector('.user-checkbox');

                self.accessSettings[email] = !self.accessSettings[email];
                checkbox.classList.toggle('checked', self.accessSettings[email]);
            });
        });
    },

    saveAccess() {
        this.closeModal('accessModal');

        const allowedViewers = [];
        const self = this;

        Object.keys(this.accessSettings).forEach(function(email) {
            if (self.accessSettings[email]) {
                allowedViewers.push(email);
            }
        });

        this.saveAccessToServer(allowedViewers);
    },

    // =============== Modals ===============

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    // =============== Logs ===============

    loadLogs() {
        const saved = localStorage.getItem('sync-logs');
        if (saved) {
            this.logs = JSON.parse(saved);
        }
        this.renderLogs();
    },

    saveLogs() {
        if (this.logs.length > 50) {
            this.logs = this.logs.slice(-50);
        }
        localStorage.setItem('sync-logs', JSON.stringify(this.logs));
    },

    addLog(type, message) {
        this.logs.push({
            time: new Date().toISOString(),
            type: type,
            message: message
        });
        this.saveLogs();
        this.renderLogs();
    },

    clearLog() {
        this.logs = [];
        this.saveLogs();
        this.renderLogs();
    },

    renderLogs() {
        const listEl = document.getElementById('logList');

        if (this.logs.length === 0) {
            listEl.innerHTML = '<div class="log-empty">Нет записей</div>';
            return;
        }

        const self = this;
        let html = '';
        const reversedLogs = this.logs.slice().reverse();

        reversedLogs.forEach(function(entry) {
            html += '<div class="log-item ' + entry.type + '">';
            html += '  <div class="log-time">' + self.formatDate(entry.time) + '</div>';
            html += '  <div class="log-message">' + entry.message + '</div>';
            html += '</div>';
        });

        listEl.innerHTML = html;
    },

    // =============== UI Update ===============

    updateUI() {
        this.updateConnectionUI();
        this.renderLogs();
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

    formatDate(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return day + '.' + month + '.' + year + ' ' + hours + ':' + minutes;
    }
};

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    syncApp.init();
});
