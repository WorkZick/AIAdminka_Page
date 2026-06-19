/**
 * Team Info - Main Controller
 * Главный контроллер, объединяющий все модули
 *
 * Модульная архитектура:
 * - team-state.js: Состояние приложения
 * - team-utils.js: Утилиты
 * - team-renderer.js: Рендеринг UI
 * - team-navigation.js: Навигация
 * - team-forms.js: Формы сотрудников
 * - team-templates.js: Система шаблонов
 * - team-avatars.js: Аватары и crop
 * - team-import-export.js: Импорт/Экспорт
 * - team-invites.js: Приглашения
 */

async function goToTeamPage(page) {
    const reqId = ++TeamState._currentRequestId;
    TeamRenderer.renderSkeletonCards();
    try {
        const result = await CloudStorage.getEmployees({ page, pageSize: TeamState.pageSize });
        if (reqId !== TeamState._currentRequestId) return; // stale discard
        // result: { employees, totalCount, page, pageSize }
        TeamState.data = result.employees || [];
        TeamState.totalCount = result.totalCount || 0;
        TeamState.currentPage = result.page || page;
        TeamRenderer.render();
        TeamRenderer.renderPagination();
    } catch (error) {
        if (reqId !== TeamState._currentRequestId) return;
        Toast.error('Ошибка загрузки: ' + error.message);
    }
}

async function loadTeamDataWithPagination() {
    // Step 1: load first page to check totalCount
    const firstPage = await CloudStorage.getEmployees({ page: 1, pageSize: 20 });

    if (firstPage && firstPage.totalCount !== undefined && firstPage.totalCount >= 50) {
        // Large team — server pagination mode
        TeamState.serverPaginationEnabled = true;
        TeamState.data = firstPage.employees || [];
        TeamState.totalCount = firstPage.totalCount;
        TeamState.currentPage = 1;
        TeamState.pageSize = 20;
        TeamRenderer.render();
        TeamRenderer.renderPagination();
    } else {
        // Small team (< 50) — load all, no pagination
        TeamState.serverPaginationEnabled = false;
        const allData = Array.isArray(firstPage) ? firstPage : (firstPage.employees || []);
        TeamState.data = allData;
        TeamState.totalCount = allData.length;
        TeamRenderer.render();
        // Hide pagination container
        const paginationEl = document.getElementById('teamPagination');
        if (paginationEl) paginationEl.innerHTML = '';
    }
}

const teamInfo = {
    /**
     * Инициализация приложения
     */
    async init() {
        try {
            // Параллельная загрузка: шаблоны + оптимистичный менеджер
            await storage.loadTemplates();
            // Create optimistic manager instances for team module
            TeamState._optimistic = OptimisticManager.create('team');
            TeamState._optimisticInvites = OptimisticManager.create('team-invites');
            TeamState.loadTeamName();

            this.setupTextareaAutoResize();
            await loadTeamDataWithPagination();
            TeamRenderer.updateStats();
            TeamInvites.populateManualRoleSelect();
            // Phase 67 SYNC-FIX-01: pending-инвайты + гости — только для admin/leader (avoid 4 backend "Permission denied" errors на init для assistant/sales/etc)
            if (typeof RoleGuard !== 'undefined' && RoleGuard.isAdminOrLeader && RoleGuard.isAdminOrLeader()) {
                // Загрузка pending-инвайтов и гостей в фоне (не блокирует init)
                Promise.allSettled([
                    TeamInvites.loadPendingInvites(),
                    TeamInvites.loadGuestUsers()
                ]);
            }

            // Phase 67 SYNC-FIX-03: cross-tab subscribe — auto-refresh employees + invites при TS_UPDATED от других tabs/users
            // (срабатывает после accept invite другим пользователем, send/cancel invite в другом табе)

            // Idempotent re-init safety net: removeEventListener ДО переприсвоения handler reference.
            // Если init() runs повторно (SPA re-mount, hot reload, programmatic re-call) — старый handler unsubscribed FIRST,
            // потом создаётся новый handler reference, потом attach. Это предотвращает duplicate handlers + memory leak.
            if (this._tsUpdatedHandler) {
                window.removeEventListener('cs-ts-updated', this._tsUpdatedHandler);
            }

            this._tsUpdatedHandler = (e) => {
                if (!e || !e.detail || typeof e.detail.ns !== 'string') return;
                const ns = e.detail.ns;
                if (ns === 'employees') {
                    // Always refresh employees при TS_UPDATED (любая роль может видеть таблицу — Pitfall: assistant тоже rendered)
                    loadTeamDataWithPagination().catch(err => {
                        console.warn('[team-info] cs-ts-updated employees refetch failed:', err && err.message);
                    });
                } else if (ns === 'invites') {
                    // Refresh invites ТОЛЬКО для admin/leader (защита от backend "Permission denied" — parity SYNC-FIX-01)
                    if (typeof RoleGuard !== 'undefined' && RoleGuard.isAdminOrLeader && RoleGuard.isAdminOrLeader()) {
                        if (typeof TeamInvites !== 'undefined' && typeof TeamInvites._refreshInviteLists === 'function') {
                            TeamInvites._refreshInviteLists().catch(err => {
                                console.warn('[team-info] cs-ts-updated invites refetch failed:', err && err.message);
                            });
                        }
                    }
                }
            };
            window.addEventListener('cs-ts-updated', this._tsUpdatedHandler);

            // Phase 67 SYNC-FIX-05: cross-USER polling — Phase 67 SYNC-FIX-03 покрывал
            // только cross-TAB (одного юзера через SharedWorker). Между разными
            // user-сессиями (другой leader/админ принимает invite, добавляет employee)
            // SharedWorker не работает — нужен polling. Phase 66 conditional GET делает
            // его дешёвым: backend возвращает {notModified} за ~50ms если данных нет.
            this._startCrossUserPoll();
            if (typeof PageLifecycle !== 'undefined' && typeof PageLifecycle.addCleanup === 'function') {
                PageLifecycle.addCleanup(() => {
                    window.removeEventListener('cs-ts-updated', this._tsUpdatedHandler);
                    this._stopCrossUserPoll();
                });
            }
        } catch (error) {
            console.error('Init error:', error);
            Toast.error('Ошибка загрузки данных: ' + error.message);
        }
    },

    // Phase 67 SYNC-FIX-05: cross-user polling state + helpers
    _crossUserPollIntervalId: null,
    _crossUserPollVisibilityHandler: null,
    CROSS_USER_POLL_INTERVAL: 20000, // 20s — баланс между свежестью данных и quota usage

    _startCrossUserPoll() {
        this._stopCrossUserPoll();
        // Активировать polling сразу при init + ставить interval
        const tick = () => this._crossUserPollTick();
        this._crossUserPollIntervalId = setInterval(tick, this.CROSS_USER_POLL_INTERVAL);

        // Pause polling когда вкладка скрыта (экономия quota). Возобновить + сразу
        // дёрнуть refresh при возврате — пользователь увидит свежие данные мгновенно.
        this._crossUserPollVisibilityHandler = () => {
            if (document.hidden) {
                this._stopCrossUserPollInterval();
            } else {
                tick(); // immediate refresh on visible
                if (!this._crossUserPollIntervalId) {
                    this._crossUserPollIntervalId = setInterval(tick, this.CROSS_USER_POLL_INTERVAL);
                }
            }
        };
        document.addEventListener('visibilitychange', this._crossUserPollVisibilityHandler);
    },

    _stopCrossUserPollInterval() {
        if (this._crossUserPollIntervalId) {
            clearInterval(this._crossUserPollIntervalId);
            this._crossUserPollIntervalId = null;
        }
    },

    _stopCrossUserPoll() {
        this._stopCrossUserPollInterval();
        if (this._crossUserPollVisibilityHandler) {
            document.removeEventListener('visibilitychange', this._crossUserPollVisibilityHandler);
            this._crossUserPollVisibilityHandler = null;
        }
    },

    _crossUserPollTick() {
        // Skip если есть pending optimistic операции — иначе server delta может
        // перезаписать pending UI state (Phase 65 MergeGuard уже защищает на cache-level,
        // но дополнительная защита на polling-level снижает спорные ситуации).
        if (TeamState._optimistic && TeamState._optimistic.getPendingCount() > 0) return;

        // Employees refresh (для всех ролей — таблица видна всем)
        loadTeamDataWithPagination().catch(err => {
            console.warn('[team-info] cross-user poll employees failed:', err && err.message);
        });

        // Invites refresh только для admin/leader (parity с SYNC-FIX-01 role guard)
        if (typeof RoleGuard !== 'undefined' && RoleGuard.isAdminOrLeader && RoleGuard.isAdminOrLeader()) {
            if (typeof TeamInvites !== 'undefined' && typeof TeamInvites._refreshInviteLists === 'function') {
                TeamInvites._refreshInviteLists().catch(err => {
                    console.warn('[team-info] cross-user poll invites failed:', err && err.message);
                });
            }
        }
    },


    // ========== Проксирование методов модулей ==========
    // (для обратной совместимости с HTML onclick атрибутами)

    // TeamState
    get data() { return TeamState.data; },
    set data(value) { TeamState.data = value; },
    get currentEmployeeId() { return TeamState.currentEmployeeId; },
    set currentEmployeeId(value) { TeamState.currentEmployeeId = value; },
    loadTeamName: () => TeamState.loadTeamName(),
    sortBy: (field) => { TeamState.sortBy(field); TeamState.currentPage = 1; TeamRenderer.render(); },
    filterTable: () => TeamState.filterTable(),
    goToPage: (page) => TeamRenderer.goToPage(page), // delegates to goToTeamPage in server mode

    // TeamRenderer
    render: () => TeamRenderer.render(),
    updateStats: () => TeamRenderer.updateStats(),
    generateCardInfo: (employee) => TeamRenderer.generateCardInfo(employee),

    // TeamNavigation
    openCard: (id) => TeamNavigation.openCard(id),
    closeCard: () => TeamNavigation.closeCard(),
    editFromCard: () => TeamNavigation.editFromCard(),

    // TeamForms
    showAddModal: () => TeamForms.showAddModal(),
    showEditForm: (id) => TeamForms.showEditForm(id),
    closeForm: () => TeamForms.closeForm(),
    saveFromForm: () => TeamForms.saveFromForm(),
    deleteFromForm: () => TeamForms.deleteFromForm(),
    deleteFromCard: () => TeamForms.deleteFromCard(),
    changeFormStatus: (status) => TeamForms.changeFormStatus(status),
    changeStatus: (status) => TeamForms.changeStatus(status),
    toggleStatusDropdown: () => TeamForms.toggleStatusDropdown(),
    toggleFormStatusDropdown: () => TeamForms.toggleFormStatusDropdown(),
    setupTextareaAutoResize: () => TeamForms.setupTextareaAutoResize(),
    cleanup: () => TeamForms.cleanup(),
    getFormData: () => TeamForms.getFormData(),
    attachFormChangeListeners: () => TeamForms.attachFormChangeListeners(),
    onFormChange: () => TeamForms.onFormChange(),
    attachAutoResizeListeners: () => TeamForms.attachAutoResizeListeners(),
    syncToProfile: (employee) => TeamForms.syncToProfile(employee),

    // TeamTemplates
    handleTemplateChange: () => TeamTemplates.handleTemplateChange(),
    restoreTemplateSelection: () => TeamTemplates.restoreTemplateSelection(),
    showDeleteTemplateDialog: () => TeamTemplates.showDeleteTemplateDialog(),
    showRenameTemplateDialog: () => TeamTemplates.showRenameTemplateDialog(),
    showEditTemplateDialog: () => TeamTemplates.showEditTemplateDialog(),
    showTemplateEditor: (existingTemplate) => TeamTemplates.showTemplateEditor(existingTemplate),
    addTemplateField: () => TeamTemplates.addTemplateField(),
    updateTemplateFieldLabel: (fieldId, label) => TeamTemplates.updateTemplateFieldLabel(fieldId, label),
    updateTemplateFieldType: (fieldId, type) => TeamTemplates.updateTemplateFieldType(fieldId, type),
    removeTemplateField: (fieldId) => TeamTemplates.removeTemplateField(fieldId),
    applyTemplate: (templateId) => TeamTemplates.applyTemplate(templateId),
    saveTemplate: () => TeamTemplates.saveTemplate(),
    updateTemplateList: () => TeamTemplates.updateTemplateList(),

    // TeamAvatars
    handleAvatarUpload: (event) => TeamAvatars.handleAvatarUpload(event),
    showCropModal: (imageData) => TeamAvatars.showCropModal(imageData),
    closeCropModal: () => TeamAvatars.closeCropModal(),
    updateCropPreview: () => TeamAvatars.updateCropPreview(),
    applyCrop: () => TeamAvatars.applyCrop(),

    // TeamImportExport
    showExportDialog: () => TeamImportExport.showExportDialog(),
    closeExportDialog: () => TeamImportExport.closeExportDialog(),

    // Helper для клика по аватару
    avatarClick: () => {
        const input = document.getElementById('formAvatarInput');
        // Прямой listener вместо delegation — click() на hidden input триггерит delegation ошибочно
        if (!input._hasChangeListener) {
            input.addEventListener('change', (e) => TeamAvatars.handleAvatarUpload(e));
            input._hasChangeListener = true;
        }
        input.click();
    },
    doExport: () => TeamImportExport.doExport(),
    showImportDialog: () => TeamImportExport.showImportDialog(),
    closeImportDialog: () => TeamImportExport.closeImportDialog(),
    importData: () => TeamImportExport.importData(),

    // TeamInvites
    switchSubtab: (subtab) => TeamInvites.switchSubtab(subtab),
    switchInviteType: (type) => TeamInvites.switchInviteType(type),
    sendInvite: () => TeamInvites.sendInvite(),
    cancelInvite: (inviteId) => TeamInvites.cancelInvite(inviteId),
    loadPendingInvites: () => TeamInvites.loadPendingInvites(),
    savePendingInvites: () => TeamInvites.savePendingInvites(),
    renderPendingInvites: () => TeamInvites.renderPendingInvites(),
    loadGuestUsers: () => TeamInvites.loadGuestUsers(),
    inviteGuest: (email) => TeamInvites.inviteGuest(email),

    // Form Dropdowns — QWIN-03: делегируем в shared/js/dropdown-helper.js
    // BFIX-15: evt передаётся для touchend.preventDefault внутри DropdownHelper.toggle
    toggleFormDropdown(target, evt) {
        // Авто-flip для dropdown'ов внутри invite-hub (открывается вверх при нехватке места).
        // Делать ДО toggle потому что autoFlip нужно знать что menu сейчас hidden.
        const menuId = target.dataset?.target;
        const menu = menuId ? document.getElementById(menuId) : null;
        if (menu) {
            const wrap = menu.closest('.dropdown-wrap');
            if (wrap && wrap.closest('.invite-hub') && menu.classList.contains('hidden')) {
                DropdownHelper.autoFlip(wrap);
            }
        }
        DropdownHelper.toggle(target, evt);
    },
    selectFormDropdown(target) {
        DropdownHelper.select(target, target.dataset.value ?? '', target.textContent);
        // Page-specific post-callback: template change
        const wrap = target.closest('.dropdown-wrap--form');
        if (wrap?.id === 'templateSelectWrap') {
            TeamTemplates.handleTemplateChange();
        }
    },

    // TeamUtils (редко используются напрямую, но для полноты)
    escapeHtml: (text) => TeamUtils.escapeHtml(text),
    isValidImageUrl: (url) => TeamUtils.isValidImageUrl(url),
    formatDate: (isoString) => isoString ? new Date(isoString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
    getStatusClass: (status) => TeamUtils.getStatusClass(status),
    formatFullNameForTable: (fullName) => TeamUtils.formatFullNameForTable(fullName)
};

// ========== Инициализация через PageLifecycle ==========

PageLifecycle.init({
    module: 'team-info',
    async onInit() {
        if (typeof DatePicker !== 'undefined') DatePicker.initAll();
        await teamInfo.init();
    },
    onDestroy() {
        // Phase 50 LIT-CONT-04: dispose Lit effects (Pitfall C — no memory leak)
        if (typeof TeamRenderer.destroy === 'function') {
            TeamRenderer.destroy();
        }
        // Если есть pending saves — сбросить кеш чтобы при возврате загрузились свежие данные с сервера
        if (TeamState._optimistic && TeamState._optimistic.getPendingCount() > 0) {
            CloudStorage.clearCacheNamespace('employees');
        }
    },
    modals: {
        '#exportModal': () => teamInfo.closeExportDialog(),
        '#importModal': () => teamInfo.closeImportDialog(),
        '#cropModal': () => teamInfo.closeCropModal()
    }
});

// ========== Глобальные event listeners ==========

// Закрытие status dropdowns при клике вне (DOM refs cached)
const _teamDropdownRefs = { _init: false };
function _ensureTeamDropdownRefs() {
    if (_teamDropdownRefs._init) return;
    _teamDropdownRefs.cardDropdown = document.getElementById('cardStatusDropdown');
    _teamDropdownRefs.cardBadge = document.getElementById('cardStatusBadge');
    _teamDropdownRefs.formDropdown = document.getElementById('formStatusDropdown');
    _teamDropdownRefs.formBadge = document.getElementById('formStatusBadge');
    _teamDropdownRefs._init = true;
}
document.addEventListener('click', (e) => {
    _ensureTeamDropdownRefs();
    const r = _teamDropdownRefs;

    if (r.cardDropdown && !r.cardDropdown.classList.contains('hidden')) {
        if (!r.cardDropdown.contains(e.target) && !r.cardBadge.contains(e.target)) {
            r.cardDropdown.classList.add('hidden');
        }
    }

    if (r.formDropdown && !r.formDropdown.classList.contains('hidden')) {
        if (!r.formDropdown.contains(e.target) && !r.formBadge.contains(e.target)) {
            r.formDropdown.classList.add('hidden');
        }
    }
    // Close form dropdowns
    document.querySelectorAll('.dropdown-wrap--form .dropdown-menu:not(.hidden)').forEach(menu => {
        if (!e.target.closest('.dropdown-wrap--form') || e.target.closest('.dropdown-wrap--form') !== menu.closest('.dropdown-wrap--form')) {
            menu.classList.add('hidden');
        }
    });
});

// Event delegation для всех data-action атрибутов
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action^="team-"]');
    if (!target) return;

    const action = target.dataset.action.replace('team-', '');
    const value = target.dataset.value;
    const fieldId = target.dataset.fieldId;
    const inviteId = target.dataset.inviteId;
    const email = target.dataset.email;

    // Для status dropdown нужно остановить всплытие
    if (action.includes('changeStatus') || action.includes('changeFormStatus')) {
        e.stopPropagation();
    }

    // Form dropdowns — передаём DOM-элемент И event (BFIX-15: для touchend handling в DropdownHelper.toggle)
    if (action === 'toggleFormDropdown' || action === 'selectFormDropdown') {
        teamInfo[action](target, e);
        return;
    }

    // Вызов соответствующего метода
    if (typeof teamInfo[action] === 'function') {
        if (action === 'removeTemplateField' && fieldId) {
            teamInfo[action](fieldId);
        } else if (action === 'cancelInvite' && inviteId) {
            // inviteId — строка вида 'inv-...' после рефакторинга v2, parseInt сломал бы её
            teamInfo[action](inviteId);
        } else if (action === 'inviteGuest' && email) {
            teamInfo[action](email);
        } else if (value !== undefined) {
            teamInfo[action](value);
        } else {
            teamInfo[action]();
        }
    } else {
        console.warn('Метод не найден:', action);
    }
});

// Event delegation для input событий
document.addEventListener('input', (e) => {
    const target = e.target.closest('[data-action^="team-"]');
    if (!target) return;

    const action = target.dataset.action.replace('team-', '');
    const fieldId = target.dataset.fieldId;

    if (typeof teamInfo[action] === 'function') {
        if (action === 'handleAvatarUpload') {
            return; // handled by change event, not input
        } else if (action === 'updateTemplateFieldLabel' && fieldId) {
            teamInfo[action](fieldId, target.value);
        } else {
            teamInfo[action]();
        }
    }
});

// Event delegation для change событий (file input, select)
document.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action^="team-"]');
    if (!target) return;

    const action = target.dataset.action.replace('team-', '');
    const fieldId = target.dataset.fieldId;

    if (action === 'updateTemplateFieldType' && fieldId) {
        teamInfo.updateTemplateFieldType(fieldId, target.value);
    } else if (typeof teamInfo[action] === 'function') {
        teamInfo[action]();
    }
});

