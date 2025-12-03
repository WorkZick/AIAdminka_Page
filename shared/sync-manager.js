/**
 * SyncManager - Клиент для SharedWorker синхронизации
 * Вся синхронизация происходит в ОДНОМ SharedWorker процессе
 * Независимо от количества открытых вкладок
 */

const SyncManager = {
    // SharedWorker
    worker: null,
    port: null,
    isConnected: false,

    // Состояние (получаем от воркера)
    queue: [],
    isSyncing: false,
    syncJustCompleted: false, // Флаг для предотвращения race condition
    restoreAttempted: false,  // Восстановление уже пробовали
    lastUserActivity: Date.now(), // Время последней активности пользователя

    // Callbacks
    onProgressChange: null,
    onSyncComplete: null,
    onSyncError: null,

    // ============ ИНИЦИАЛИЗАЦИЯ ============

    init() {
        this.connectToWorker();
        this.trackUserActivity();
        console.log('✅ SyncManager инициализирован');
    },

    // Отслеживаем активность пользователя
    trackUserActivity() {
        const updateActivity = () => {
            this.lastUserActivity = Date.now();
        };

        // Отслеживаем различные типы взаимодействия
        ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
    },

    // Проверяем, неактивен ли пользователь (более 5 секунд)
    isUserIdle(idleTime = 5000) {
        return Date.now() - this.lastUserActivity > idleTime;
    },

    // Обновить страницу если пользователь неактивен
    reloadIfIdle() {
        if (this.isUserIdle()) {
            console.log('🔄 Обновление страницы (пользователь неактивен)...');
            window.location.reload();
        } else {
            console.log('⏳ Пользователь активен, обновление отложено');
            // Пробуем снова через 3 секунды
            setTimeout(() => this.reloadIfIdle(), 3000);
        }
    },

    connectToWorker() {
        try {
            // Используем абсолютный URL для SharedWorker
            const workerUrl = this.getWorkerUrl();

            this.worker = new SharedWorker(workerUrl);
            this.port = this.worker.port;

            this.port.onmessage = (event) => {
                this.handleWorkerMessage(event.data);
            };

            this.worker.onerror = (error) => {
                console.error('SharedWorker ошибка загрузки:', error);
                this.isConnected = false;
            };

            this.port.start();
            this.isConnected = true;

            // Устанавливаем email для воркера
            const email = this.getEmail();
            if (email) {
                this.port.postMessage({ type: 'SET_EMAIL', email: email });
            }

            // Статус приходит автоматически при подключении (onconnect в воркере)
            console.log('✅ Подключено к SharedWorker');

        } catch (e) {
            console.error('Не удалось подключиться к SharedWorker:', e);
            this.isConnected = false;
        }
    },

    getWorkerUrl() {
        // Строим абсолютный URL к воркеру
        const origin = window.location.origin;
        const path = window.location.pathname;

        // Находим путь до SimpleAIAdminka (локальный)
        const localMatch = path.match(/(.*SimpleAIAdminka)/);
        if (localMatch) {
            return origin + localMatch[1] + '/shared/sync-shared-worker.js';
        }

        // Находим путь до AIAdminka_Page (GitHub Pages)
        const prodMatch = path.match(/(.*AIAdminka_Page)/);
        if (prodMatch) {
            return origin + prodMatch[1] + '/shared/sync-shared-worker.js';
        }

        // Fallback: относительный путь
        const basePath = this.getBasePath();
        return basePath + 'shared/sync-shared-worker.js';
    },

    getBasePath() {
        const path = window.location.pathname;
        // Находим базовый путь (до SimpleAIAdminka/ включительно)
        const match = path.match(/(.*SimpleAIAdminka\/)/);
        if (match) {
            return match[1];
        }
        // Fallback - используем относительный путь
        const folders = ['partners', 'methods', 'team-info', 'traffic-calculation', 'documentation', 'feedback', 'login', 'excel-reports', 'sync'];
        for (const folder of folders) {
            if (path.includes('/' + folder + '/')) return '../';
        }
        return './';
    },

    getEmail() {
        try {
            const auth = localStorage.getItem('cloud-auth');
            if (auth) {
                return JSON.parse(auth).email;
            }
        } catch (e) {}
        return null;
    },

    // ============ ОБРАБОТКА СООБЩЕНИЙ ОТ ВОРКЕРА ============

    handleWorkerMessage(data) {
        switch (data.type) {
            case 'STATUS':
                this.queue = data.queue || [];
                this.isSyncing = data.isSyncing;

                // Если воркер пустой и синхронизация не завершилась только что
                // пробуем восстановить из localStorage (только один раз)
                if (this.queue.length === 0 && !this.isSyncing && !this.syncJustCompleted && !this.restoreAttempted) {
                    this.restoreAttempted = true;
                    this.restoreFromLocalStorage();
                }

                if (this.queue.length > 0 || this.isSyncing) {
                    this.showIndicator();
                    this.updateIndicatorCount();
                }
                break;

            case 'QUEUE_UPDATED':
                this.queue = data.queue || [];
                this.updateIndicatorCount();
                if (this.queue.length > 0) {
                    this.showIndicator();
                }
                break;

            case 'SYNC_STARTED':
                this.isSyncing = true;
                this.restoreAttempted = false; // Сбрасываем для следующего цикла
                this.showIndicator();
                console.log('🚀 Синхронизация началась');
                break;

            case 'PROGRESS':
                // Обновляем счётчик - используем remaining из сообщения
                this.updateIndicatorCount(data.remaining);
                if (this.onProgressChange) {
                    this.onProgressChange(data.processed, data.processed + data.remaining);
                }
                break;

            case 'REMOVE_LOCAL':
                // Удаляем из localStorage после успешной синхронизации
                this.removeFromLocalStorage(data.entity + 's-data', data.tempId);
                break;

            case 'SYNC_COMPLETE':
                this.isSyncing = false;
                this.queue = [];
                this.syncJustCompleted = true; // Предотвращаем повторное восстановление
                this.clearQueueStorage();
                // Очищаем ВСЕ локальные данные - они теперь в облаке
                localStorage.removeItem('partners-data');
                localStorage.removeItem('methods-data');
                localStorage.removeItem('templates-data');
                console.log(`🏁 Синхронизация завершена: ${data.processed} операций`);

                this.hideIndicator();

                // Очищаем дубликаты после небольшой задержки (даём время облаку обновиться)
                setTimeout(async () => {
                    await this.cleanupDuplicates();
                    this.syncJustCompleted = false;
                    // Обновляем страницу если пользователь неактивен
                    this.reloadIfIdle();
                }, 2000);

                if (this.onSyncComplete) {
                    this.onSyncComplete({ processed: data.processed, errors: data.errors });
                }

                window.dispatchEvent(new CustomEvent('sync-complete', {
                    detail: { processed: data.processed, errors: data.errors }
                }));

                if (data.errors && data.errors.length > 0 && this.onSyncError) {
                    this.onSyncError(data.errors);
                }
                break;

            case 'CANCELLED':
                this.isSyncing = false;
                this.queue = [];
                this.clearQueueStorage(); // Очищаем localStorage
                this.showCancelled();
                break;
        }
    },

    // ============ ВОССТАНОВЛЕНИЕ ИЗ LOCALSTORAGE ============

    async restoreFromLocalStorage() {
        try {
            // Получаем локальные данные
            const partnersData = localStorage.getItem('partners-data');
            if (!partnersData) return;

            const localPartners = JSON.parse(partnersData);
            if (!localPartners || localPartners.length === 0) return;

            // Загружаем данные из облака для сравнения
            let cloudPartners = [];
            if (typeof CloudStorage !== 'undefined') {
                try {
                    cloudPartners = await CloudStorage.fetchPartnersFromCloud();
                } catch (e) {
                    console.warn('Не удалось загрузить данные из облака:', e);
                }
            }

            // Создаём ключи для быстрого поиска
            const cloudKeys = new Set(cloudPartners.map(p => {
                const subagent = String(p.subagent || '').toLowerCase().trim();
                const subagentId = String(p.subagentId || '').toLowerCase().trim();
                const method = String(p.method || '').toLowerCase().trim();
                return `${subagent}|${subagentId}|${method}`;
            }));

            // Фильтруем - оставляем только те, которых нет в облаке
            const unsyncedPartners = localPartners.filter(p => {
                const subagent = String(p.subagent || '').toLowerCase().trim();
                const subagentId = String(p.subagentId || '').toLowerCase().trim();
                const method = String(p.method || '').toLowerCase().trim();
                const key = `${subagent}|${subagentId}|${method}`;
                return !cloudKeys.has(key);
            });

            // Очищаем уже синхронизированные из localStorage
            if (unsyncedPartners.length !== localPartners.length) {
                if (unsyncedPartners.length === 0) {
                    localStorage.removeItem('partners-data');
                } else {
                    localStorage.setItem('partners-data', JSON.stringify(unsyncedPartners));
                }
            }

            // Если есть несинхронизированные - добавляем в очередь
            if (unsyncedPartners.length > 0) {
                const operations = unsyncedPartners.map(partner => ({
                    type: 'add',
                    entity: 'partner',
                    data: partner,
                    tempId: partner.id
                }));

                this.port.postMessage({
                    type: 'ADD_TO_QUEUE',
                    operations: operations
                });

                this.showIndicator();
            }

        } catch (e) {
            console.error('Ошибка восстановления из localStorage:', e);
        }
    },

    // Очистка дубликатов после синхронизации
    async cleanupDuplicates() {
        try {
            if (typeof CloudStorage === 'undefined') return;

            console.log('🔍 Проверка дубликатов в облаке...');
            const partners = await CloudStorage.fetchPartnersFromCloud();

            if (!partners || partners.length === 0) return;

            // Группируем по ключу
            const groups = new Map();
            partners.forEach(p => {
                const key = `${String(p.subagent || '').toLowerCase().trim()}|${String(p.subagentId || '').toLowerCase().trim()}|${String(p.method || '').toLowerCase().trim()}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(p);
            });

            // Находим дубликаты (группы с более чем 1 элементом)
            const duplicatesToDelete = [];
            groups.forEach((items, key) => {
                if (items.length > 1) {
                    // Оставляем первый (самый старый), удаляем остальные
                    items.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
                    for (let i = 1; i < items.length; i++) {
                        duplicatesToDelete.push(items[i]);
                    }
                }
            });

            if (duplicatesToDelete.length === 0) {
                console.log('✅ Дубликатов не найдено');
                return;
            }

            console.log(`🗑️ Найдено ${duplicatesToDelete.length} дубликатов, удаляем...`);

            // Удаляем дубликаты из облака
            let deleted = 0;
            for (const dup of duplicatesToDelete) {
                try {
                    await CloudStorage.deletePartner(dup.id);
                    deleted++;
                } catch (e) {
                    // Игнорируем "not found" - значит уже удалён
                }
            }

            if (deleted === 0) {
                console.log('✅ Дубликаты уже были удалены');
                return;
            }

            // Очищаем кэш
            CloudStorage.clearCache('partners');
            console.log(`✅ Удалено ${deleted} дубликатов`);

        } catch (e) {
            console.error('Ошибка очистки дубликатов:', e);
        }
    },

    // ============ ОЧЕРЕДЬ ============

    addToQueue(type, entity, data, tempId = null) {
        if (!this.isConnected) {
            console.warn('SharedWorker не подключен');
            return null;
        }

        const operation = {
            type,
            entity,
            data,
            tempId
        };

        this.port.postMessage({
            type: 'ADD_TO_QUEUE',
            operations: [operation]
        });

        this.showIndicator();
        return Date.now().toString();
    },

    hasPendingSync() {
        return this.queue.length > 0 || this.isSyncing;
    },

    // ============ ОТМЕНА ============

    cancelSync() {
        if (this.isConnected) {
            this.port.postMessage({ type: 'CANCEL' });
        }
        console.log('⚠️ Синхронизация отменена');
    },

    // ============ ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ============

    QUEUE_STORAGE_KEY: 'sync-queue-backup',

    clearQueueStorage() {
        localStorage.removeItem(this.QUEUE_STORAGE_KEY);
    },

    removeFromLocalStorage(storageKey, tempId) {
        try {
            const data = localStorage.getItem(storageKey);
            if (!data) return;

            const items = JSON.parse(data);
            const index = items.findIndex(item => item.id === tempId);

            if (index !== -1) {
                items.splice(index, 1);
                localStorage.setItem(storageKey, JSON.stringify(items));
            }
        } catch (e) {
            console.error('Ошибка удаления из localStorage:', e);
        }
    },

    // ============ UI ИНДИКАТОР ============

    showIndicator() {
        let indicator = document.getElementById('sync-indicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'sync-indicator';
            indicator.innerHTML = `
                <div class="sync-indicator-content">
                    <div class="sync-spinner"></div>
                    <span class="sync-text">Синхронизация</span>
                    <span class="sync-count"></span>
                </div>
                <button class="sync-cancel-btn" title="Отменить">Отмена</button>
            `;
            document.body.appendChild(indicator);

            indicator.querySelector('.sync-cancel-btn').addEventListener('click', () => {
                if (confirm('Отменить синхронизацию?')) {
                    this.cancelSync();
                }
            });

            if (!document.getElementById('sync-indicator-styles')) {
                const styles = document.createElement('style');
                styles.id = 'sync-indicator-styles';
                styles.textContent = `
                    #sync-indicator {
                        position: fixed;
                        top: 10px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #2e2e2e;
                        color: #f2f2f2;
                        padding: 6px 14px;
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-family: 'TT Firs Neue', 'Segoe UI', sans-serif;
                        font-size: 12px;
                        animation: syncSlideDown 0.3s ease;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                        border-radius: 6px;
                    }
                    @keyframes syncSlideDown {
                        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                        to { transform: translateX(-50%) translateY(0); opacity: 1; }
                    }
                    @keyframes syncSlideUp {
                        from { transform: translateX(-50%) translateY(0); opacity: 1; }
                        to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                    }
                    .sync-indicator-content { display: flex; align-items: center; gap: 8px; }
                    .sync-spinner {
                        width: 12px; height: 12px;
                        border: 2px solid rgba(253,190,47,0.3);
                        border-top-color: #fdbe2f;
                        border-radius: 50%;
                        animation: syncSpin 1s linear infinite;
                    }
                    @keyframes syncSpin { to { transform: rotate(360deg); } }
                    .sync-count { color: #8d8d8d; font-size: 11px; }
                    .sync-cancel-btn {
                        background: transparent;
                        border: 1px solid #8d8d8d;
                        color: #8d8d8d;
                        font-size: 10px;
                        cursor: pointer;
                        padding: 2px 8px;
                        border-radius: 4px;
                    }
                    .sync-cancel-btn:hover { border-color: #f2f2f2; color: #f2f2f2; }
                    #sync-indicator.sync-complete .sync-spinner { display: none; }
                    #sync-indicator.sync-complete .sync-text { color: #b8e994; }
                    #sync-indicator.sync-complete .sync-cancel-btn { display: none; }
                    #sync-indicator.sync-cancelled .sync-text { color: #fdbe2f; }
                `;
                document.head.appendChild(styles);
            }
        }

        indicator.style.display = 'flex';
        indicator.style.animation = 'syncSlideDown 0.3s ease';
        indicator.className = '';
        indicator.querySelector('.sync-text').textContent = 'Синхронизация';
        indicator.querySelector('.sync-spinner').style.display = 'block';
        indicator.querySelector('.sync-cancel-btn').style.display = 'block';
    },

    updateIndicatorCount(remaining) {
        const indicator = document.getElementById('sync-indicator');
        if (indicator) {
            // Используем переданное значение или fallback на this.queue.length
            const count = remaining !== undefined ? remaining : this.queue.length;
            indicator.querySelector('.sync-count').textContent = count > 0 ? `(${count})` : '';
        }
    },

    hideIndicator() {
        const indicator = document.getElementById('sync-indicator');
        if (indicator) {
            indicator.classList.add('sync-complete');
            indicator.querySelector('.sync-text').textContent = 'Готово';
            indicator.querySelector('.sync-count').textContent = '';

            setTimeout(() => {
                indicator.style.animation = 'syncSlideUp 0.3s ease forwards';
                setTimeout(() => {
                    indicator.style.display = 'none';
                    indicator.style.animation = '';
                    indicator.querySelector('.sync-spinner').style.display = 'block';
                }, 300);
            }, 1500);
        }
    },

    showCancelled() {
        const indicator = document.getElementById('sync-indicator');
        if (indicator) {
            indicator.classList.add('sync-cancelled');
            indicator.querySelector('.sync-text').textContent = 'Отменено';
            indicator.querySelector('.sync-spinner').style.display = 'none';
            indicator.querySelector('.sync-count').textContent = '';
            indicator.querySelector('.sync-cancel-btn').style.display = 'none';

            setTimeout(() => {
                indicator.style.animation = 'syncSlideUp 0.3s ease forwards';
                setTimeout(() => {
                    indicator.style.display = 'none';
                }, 300);
            }, 1500);
        }
    },

    // ============ СЕССИЯ ============

    canLogout() {
        if (this.hasPendingSync()) {
            return `Идёт синхронизация (${this.queue.length} операций). Подождите или отмените.`;
        }
        return true;
    }
};

// Автоинициализация
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SyncManager.init());
} else {
    SyncManager.init();
}

console.log('✅ SyncManager загружен');
