/**
 * Sync Module - Cloud Synchronization via Google Sheets + OAuth
 * С контролем доступа через лист Approved
 */

const syncApp = {
    // OAuth Config
    CLIENT_ID: '552590459404-muqkuq0qa461763qfdt3ec62mfua49c6.apps.googleusercontent.com',
    REDIRECT_URI: 'https://workzick.github.io/AIAdminka_Page/sync/callback.html',
    SCOPES: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',

    // URL скрипта (базовый для проверки доступа)
    BASE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwowqwa2j0so4q7PTnlCRUOUH-8lhsVK1cpGC3Si2v3HvKEHL2pzLHV1uwLvmO2pxQM/exec',

    // Состояние
    scriptUrl: '',
    currentUser: null,
    isApproved: false,
    pendingRequest: false,
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
        this.loadData();
        this.loadLogs();
        this.checkAuth();
        this.updateUI();
        this.addLog('info', 'Модуль синхронизации загружен');

        // Проверяем авторизацию каждые 2 секунды (для callback)
        const self = this;
        setInterval(function() {
            self.checkAuthCallback();
        }, 2000);
    },

    // =============== OAuth ===============

    login() {
        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
            '?client_id=' + encodeURIComponent(this.CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(this.REDIRECT_URI) +
            '&response_type=token' +
            '&scope=' + encodeURIComponent(this.SCOPES);

        window.open(authUrl, '_blank', 'width=500,height=600');
        this.addLog('info', 'Открыто окно авторизации Google');
    },

    logout() {
        localStorage.removeItem('sync-auth');
        localStorage.removeItem('sync-access-status');
        this.currentUser = null;
        this.isApproved = false;
        this.pendingRequest = false;
        this.scriptUrl = '';
        this.updateUI();
        this.addLog('info', 'Вы вышли из аккаунта');
    },

    checkAuth() {
        const authData = localStorage.getItem('sync-auth');
        if (authData) {
            const auth = JSON.parse(authData);
            // Проверяем, не истёк ли токен (1 час)
            if (Date.now() - auth.timestamp < 3600000) {
                this.currentUser = {
                    email: auth.email,
                    name: auth.name,
                    picture: auth.picture,
                    accessToken: auth.accessToken
                };
                // Загружаем статус доступа
                this.loadAccessStatus();
            } else {
                localStorage.removeItem('sync-auth');
                localStorage.removeItem('sync-access-status');
            }
        }
    },

    checkAuthCallback() {
        const authData = localStorage.getItem('sync-auth');
        if (authData && !this.currentUser) {
            const auth = JSON.parse(authData);
            this.currentUser = {
                email: auth.email,
                name: auth.name,
                picture: auth.picture,
                accessToken: auth.accessToken
            };
            this.addLog('success', 'Авторизован как ' + auth.email);

            // Проверяем доступ после авторизации
            this.checkAccessStatus();
        }
    },

    // =============== Access Control ===============

    loadAccessStatus() {
        const statusData = localStorage.getItem('sync-access-status');
        if (statusData) {
            const status = JSON.parse(statusData);
            // Проверяем актуальность (кэш на 5 минут)
            if (Date.now() - status.timestamp < 300000) {
                this.isApproved = status.approved;
                this.pendingRequest = status.pendingRequest;
                if (status.scriptUrl) {
                    this.scriptUrl = status.scriptUrl;
                }
                this.updateUI();
                return;
            }
        }
        // Если кэш устарел - проверяем заново
        this.checkAccessStatus();
    },

    checkAccessStatus() {
        if (!this.currentUser || !this.currentUser.email) {
            return;
        }

        this.addLog('info', 'Проверка доступа...');

        const url = this.BASE_SCRIPT_URL + '?action=checkAccess&email=' + encodeURIComponent(this.currentUser.email);
        const self = this;

        fetch(url)
            .then(function(response) {
                return response.json();
            })
            .then(function(result) {
                if (result.error) {
                    self.addLog('error', 'Ошибка: ' + result.error);
                    return;
                }

                self.isApproved = result.approved;
                self.pendingRequest = result.pendingRequest || false;

                if (result.approved && result.scriptUrl) {
                    self.scriptUrl = result.scriptUrl;
                    self.addLog('success', 'Доступ подтверждён');
                } else if (result.pendingRequest) {
                    self.addLog('info', 'Запрос на рассмотрении');
                } else {
                    self.addLog('info', 'Требуется запрос доступа');
                }

                // Сохраняем в кэш
                localStorage.setItem('sync-access-status', JSON.stringify({
                    approved: self.isApproved,
                    pendingRequest: self.pendingRequest,
                    scriptUrl: self.scriptUrl,
                    timestamp: Date.now()
                }));

                self.updateUI();
            })
            .catch(function(err) {
                self.addLog('error', 'Ошибка проверки: ' + err.message);
            });
    },

    requestAccess() {
        if (!this.currentUser || !this.currentUser.email) {
            alert('Сначала авторизуйтесь через Google');
            return;
        }

        this.addLog('info', 'Отправка запроса на доступ...');

        const url = this.BASE_SCRIPT_URL +
            '?action=requestAccess' +
            '&email=' + encodeURIComponent(this.currentUser.email) +
            '&name=' + encodeURIComponent(this.currentUser.name || '');

        const self = this;

        fetch(url)
            .then(function(response) {
                return response.json();
            })
            .then(function(result) {
                if (result.error) {
                    self.addLog('error', 'Ошибка: ' + result.error);
                    alert('Ошибка: ' + result.error);
                    return;
                }

                if (result.alreadyApproved) {
                    self.addLog('success', 'Вы уже одобрены!');
                    self.checkAccessStatus();
                } else if (result.alreadyRequested) {
                    self.addLog('info', 'Запрос уже отправлен ранее');
                    alert('Ваш запрос уже отправлен и ожидает рассмотрения.');
                    self.pendingRequest = true;
                } else {
                    self.addLog('success', 'Запрос отправлен!');
                    alert('Запрос на доступ отправлен!\nАдминистратор рассмотрит его в ближайшее время.');
                    self.pendingRequest = true;
                }

                // Обновляем кэш
                localStorage.setItem('sync-access-status', JSON.stringify({
                    approved: self.isApproved,
                    pendingRequest: self.pendingRequest,
                    scriptUrl: self.scriptUrl,
                    timestamp: Date.now()
                }));

                self.updateUI();
            })
            .catch(function(err) {
                self.addLog('error', 'Ошибка запроса: ' + err.message);
                alert('Ошибка отправки запроса');
            });
    },

    // =============== Sidebar ===============

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
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

    // =============== UI ===============

    updateUI() {
        this.updateConnectionUI();
        this.renderLogs();
    },

    updateConnectionUI() {
        const statusEl = document.getElementById('connectionStatus');
        const statusValue = document.getElementById('statusValue');
        const userEmail = document.getElementById('userEmail');
        const userName = document.getElementById('userName');
        const btnExport = document.getElementById('btnExport');
        const btnImport = document.getElementById('btnImport');
        const btnAccess = document.getElementById('btnAccess');
        const btnLogin = document.getElementById('btnLogin');
        const btnLogout = document.getElementById('btnLogout');
        const btnRequestAccess = document.getElementById('btnRequestAccess');
        const configField = document.querySelector('.config-field');

        // Скрываем поле URL (оно теперь автоматическое)
        if (configField) {
            configField.style.display = 'none';
        }

        if (!this.currentUser) {
            // Не авторизован
            statusEl.className = 'header-status';
            statusEl.querySelector('.status-text').textContent = 'Не авторизован';
            statusValue.textContent = 'Требуется вход';
            statusValue.className = 'info-value';
            userEmail.textContent = '-';
            userName.textContent = '-';

            if (btnLogin) btnLogin.style.display = 'block';
            if (btnLogout) btnLogout.style.display = 'none';
            if (btnRequestAccess) btnRequestAccess.style.display = 'none';

            btnExport.disabled = true;
            btnImport.disabled = true;
            btnAccess.disabled = true;

        } else if (!this.isApproved) {
            // Авторизован, но не одобрен
            statusEl.className = 'header-status pending';
            statusEl.querySelector('.status-text').textContent = this.pendingRequest ? 'Ожидание' : 'Нет доступа';
            statusValue.textContent = this.pendingRequest ? 'Запрос на рассмотрении' : 'Требуется запрос';
            statusValue.className = 'info-value warning';
            userEmail.textContent = this.currentUser.email;
            userName.textContent = this.currentUser.name || '-';

            if (btnLogin) btnLogin.style.display = 'none';
            if (btnLogout) btnLogout.style.display = 'block';
            if (btnRequestAccess) {
                btnRequestAccess.style.display = 'block';
                btnRequestAccess.disabled = this.pendingRequest;
                btnRequestAccess.textContent = this.pendingRequest ? 'Запрос отправлен' : 'Запросить доступ';
            }

            btnExport.disabled = true;
            btnImport.disabled = true;
            btnAccess.disabled = true;

        } else {
            // Авторизован и одобрен
            statusEl.className = 'header-status connected';
            statusEl.querySelector('.status-text').textContent = 'Подключено';
            statusValue.textContent = 'Доступ разрешён';
            statusValue.className = 'info-value success';
            userEmail.textContent = this.currentUser.email;
            userName.textContent = this.currentUser.name || '-';

            if (btnLogin) btnLogin.style.display = 'none';
            if (btnLogout) btnLogout.style.display = 'block';
            if (btnRequestAccess) btnRequestAccess.style.display = 'none';

            btnExport.disabled = false;
            btnImport.disabled = false;
            btnAccess.disabled = false;
        }
    },

    // =============== API Calls ===============

    callApi(action, params) {
        if (!this.scriptUrl) {
            alert('Нет доступа к облаку');
            return Promise.reject('No script URL');
        }

        if (!this.currentUser || !this.currentUser.email) {
            alert('Необходимо авторизоваться');
            return Promise.reject('Not authorized');
        }

        let url = this.scriptUrl + '?action=' + action + '&email=' + encodeURIComponent(this.currentUser.email);

        if (params) {
            Object.keys(params).forEach(function(key) {
                url += '&' + key + '=' + encodeURIComponent(params[key]);
            });
        }

        const self = this;

        return fetch(url)
            .then(function(response) {
                return response.json();
            })
            .then(function(result) {
                if (result.error) {
                    self.addLog('error', 'Ошибка: ' + result.error);
                    throw new Error(result.error);
                }
                return result;
            })
            .catch(function(err) {
                self.addLog('error', 'Ошибка запроса: ' + err.message);
                throw err;
            });
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

        const self = this;
        this.callApi('export', {
            data: JSON.stringify(dataToExport),
            name: this.currentUser.name || ''
        })
        .then(function() {
            self.addLog('success', 'Данные успешно экспортированы');
            alert('Данные успешно экспортированы!');
        })
        .catch(function(err) {
            alert('Ошибка экспорта: ' + err.message);
        });
    },

    // =============== Import ===============

    showImportModal() {
        this.addLog('info', 'Загрузка списка пользователей...');

        const self = this;
        this.callApi('getAvailableUsers')
            .then(function(result) {
                const users = result.users || [];
                if (users.length === 0) {
                    alert('Нет доступных пользователей для импорта.\nПопросите коллег дать вам доступ.');
                    return;
                }
                self.openModal('importModal');
                self.renderImportUsersList(users);
            })
            .catch(function(err) {
                alert('Ошибка загрузки: ' + err.message);
            });
    },

    doImport() {
        if (!this.selectedImportUser) {
            alert('Выберите пользователя');
            return;
        }

        this.closeModal('importModal');
        this.addLog('info', 'Импорт от ' + this.selectedImportUser + '...');

        const self = this;
        this.callApi('import', { fromEmail: this.selectedImportUser })
            .then(function(result) {
                if (result.data) {
                    self.syncData = {
                        projectName: result.data.projectName || '',
                        version: result.data.version || '',
                        author: result.data.author || '',
                        note: result.data.note || ''
                    };
                    localStorage.setItem('sync-data', JSON.stringify(self.syncData));
                    self.loadData();
                    self.addLog('success', 'Данные импортированы');
                    alert('Данные успешно импортированы!');
                }
            })
            .catch(function(err) {
                alert('Ошибка импорта: ' + err.message);
            });
    },

    // =============== Access Settings ===============

    showAccessModal() {
        this.addLog('info', 'Загрузка настроек доступа...');

        const self = this;
        this.callApi('getAllUsers')
            .then(function(result) {
                self.allUsers = result.users || [];
                self.accessSettings = {};

                const mySettings = result.myAllowedViewers || [];
                mySettings.forEach(function(email) {
                    self.accessSettings[email] = true;
                });

                self.openModal('accessModal');
                self.renderAccessUsersList();
            })
            .catch(function(err) {
                alert('Ошибка загрузки: ' + err.message);
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

        this.addLog('info', 'Сохранение настроек доступа...');

        this.callApi('setAccess', { allowedViewers: JSON.stringify(allowedViewers) })
            .then(function() {
                self.addLog('success', 'Настройки доступа сохранены');
                alert('Настройки доступа сохранены!');
            })
            .catch(function(err) {
                alert('Ошибка сохранения: ' + err.message);
            });
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
