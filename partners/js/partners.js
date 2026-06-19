// Partners App - Controller (delegates to modules) + Phase 25 LIT-06 ModuleFactory + Lit bridge
//
// Phase 25 LIT-06 (Plan 25-07) bridge strategy:
// — partnersApp.init() создаёт ModuleFactory.create({optimistic:true}) внутри PageLifecycle.onInit
// — <app-table id="partners-table"> mount node для Lit consumers / E2E selectors
// — window.effect() bind: signals → Lit prop assignment (Option A — direct prop)
// — _disposers tracked для PageLifecycle.onDestroy cleanup (Pitfall C)
// — Existing PartnersState/Renderer/Forms/etc. preserved (full атомic-rewrite deferred to Phase 27 mass migration)
// Reference: 25-RESEARCH.md §"Pattern 2: ModuleFactory + Lit binding (Option A)" + 25-CONTEXT.md.
const partnersApp = {
    // ==================== ModuleFactory + Lit bridge state ====================
    mod: null,
    _disposers: [],
    _partnersTablePendingMount: false,

    // ==================== INITIALIZATION ====================
    async init() {
        // AuthGuard.checkWithRole() и CloudStorage.init() уже вызваны в PageLifecycle
        // Полноэкранный спиннер (.page-loading) показывается PageLifecycle на время onInit()

        // Phase 25 LIT-06: ждём Lit ready (cdn-deps.js loaded) до mounting
        if (!window.__LIT_LOADED__) {
            await new Promise((resolve) => {
                const t = setTimeout(resolve, 3000); // safety timeout
                window.addEventListener('lit-ready', () => { clearTimeout(t); resolve(); }, { once: true });
            });
        }

        // Phase 25 LIT-06: ModuleFactory.create — replaces partners-state.js patterns
        // (existing PartnersState preserved для legacy code; mod.items mirrors PartnersState.cachedPartners)
        try {
            if (typeof window.ModuleFactory?.create === 'function' && typeof window.signal === 'function') {
                this.mod = window.ModuleFactory.create({
                    name: 'partners',
                    entity: 'partners',
                    pageSize: 20,
                    optimistic: true
                });
                window.partnersModule = this.mod;
            }
        } catch (e) {
            console.warn('[partners] ModuleFactory.create failed (non-fatal):', e?.message);
            this.mod = null;
        }

        // Phase 25 LIT-06: <app-table> mount + effect bind (quick 260619-q8h: Lit-readiness guarded)
        this._setupPartnersTable();

        // Event delegation for table row clicks (legacy table — preserved)
        const tableBody = document.getElementById('partnersTableBody');
        if (tableBody) {
            tableBody.addEventListener('click', (e) => {
                const row = e.target.closest('tr[data-partner-id]');
                if (row) {
                    PartnersNavigation.selectPartner(row.dataset.partnerId);
                }
            });
        }

        // Слушаем завершение синхронизации для обновления данных (с cleanup)
        this._syncHandler = () => { PartnersForms.loadDataFromCloud(); };
        window.addEventListener('sync-complete', this._syncHandler);
        PageLifecycle.addCleanup(() => {
            if (partnersApp._syncHandler) {
                window.removeEventListener('sync-complete', partnersApp._syncHandler);
            }
        });

        // Phase 25 LIT-06: dispose cleanup at PageLifecycle teardown (Pitfall C)
        PageLifecycle.addCleanup(() => {
            partnersApp.destroy();
        });

        try {
            // Show skeleton before loading
            PartnersRenderer.renderSkeletonRows();

            // Create optimistic manager instance for partners module (legacy — preserved)
            PartnersState._optimistic = OptimisticManager.create('partners');

            // Load data from cloud
            await PartnersForms.loadAllData();

            // Mirror PartnersState.cachedPartners → ModuleFactory.items signal (bridge)
            partnersApp._mirrorStateToModuleFactory();

            // Render UI
            PartnersColumns.renderTableHeader();
            PartnersRenderer.render();
            PartnersImportExport.setupImportHandler();
            PartnersAvatars.setupCropHandlers();
            PartnersColumns.renderColumnsMenu();

        } catch (error) {
            console.error('Init error:', error);
            PartnersUtils.showError('Ошибка загрузки данных: ' + error.message);
        }
    },

    // Phase 25 LIT-06: <app-table> columns/effect setup (quick 260619-q8h: Lit-readiness guarded)
    _setupPartnersTable() {
        // Phase 25 LIT-06: <app-table> mount + effect-based prop assignment (Option A)
        const tableEl = document.getElementById('partners-table');
        if (!tableEl || !this.mod || typeof window.effect !== 'function') return;

        // Lit-readiness guard (quick 260619-q8h): litHtml может быть ещё не готов на медленном
        // прод-CDN (safety-timeout init() мог сработать раньше lit-ready). Откладываем настройку
        // колонок до lit-ready, иначе render-коллбэки (item) => html... упадут с html=undefined.
        if (!window.litHtml) {
            if (!this._partnersTablePendingMount) {
                this._partnersTablePendingMount = true;
                window.addEventListener('lit-ready', () => {
                    this._partnersTablePendingMount = false;
                    partnersApp._setupPartnersTable();
                }, { once: true });
            }
            return;
        }

        // Configure columns once (Lit html cell renderers с auto-escape)
        try {
            const html = window.litHtml;
            tableEl.columns = [
                { key: 'method',     label: 'Метод',       sortable: true,
                  render: (item) => html`<span class="method-badge">${item.method ?? ''}</span>` },
                { key: 'subagent',   label: 'Субагент',    sortable: true,
                  render: (item) => html`${item.subagent ?? ''}` },
                { key: 'subagentId', label: 'ID Субагента', sortable: true,
                  render: (item) => html`${item.subagentId ?? ''}` },
                { key: 'status',     label: 'Статус',      sortable: true,
                  render: (item) => {
                      const s = item.status || 'Открыт';
                      const cls = s === 'Открыт' ? 'status-open' : 'status-closed';
                      return html`<span class="${cls}">${s}</span>`;
                  } }
            ];
            tableEl.emptyMessage = 'Нет партнёров';

            // Reactive prop assignment via effect (Option A — direct prop)
            this._disposers.push(this.mod.effect(() => {
                tableEl.items = this.mod.items.value || [];
            }));

            // Component event subscriptions
            tableEl.addEventListener('row-click', (e) => {
                if (e.detail && e.detail.id) {
                    PartnersNavigation.selectPartner(e.detail.id);
                }
            });
            tableEl.addEventListener('sort-change', (e) => {
                if (e.detail && e.detail.field) {
                    PartnersRenderer.sortBy(e.detail.field);
                }
            });
        } catch (e) {
            console.warn('[partners] <app-table> bridge setup failed (non-fatal):', e?.message);
        }
    },

    // Phase 25 LIT-06: bridge — sync existing PartnersState.cachedPartners → mod.items signal
    _mirrorStateToModuleFactory() {
        if (!this.mod || typeof window.batch !== 'function') return;
        try {
            window.batch(() => {
                this.mod.items.value = (PartnersState.cachedPartners || []).slice();
                if (this.mod.totalCount) {
                    this.mod.totalCount.value = PartnersState.totalCount || PartnersState.cachedPartners.length;
                }
            });
        } catch (e) {
            console.warn('[partners] _mirrorStateToModuleFactory failed:', e?.message);
        }
    },

    // Phase 25 LIT-06: explicit destroy для PageLifecycle.onDestroy
    destroy() {
        try {
            this._disposers.forEach((d) => { try { d(); } catch (_) {} });
        } finally {
            this._disposers = [];
        }
        if (this.mod && typeof this.mod.destroy === 'function') {
            try { this.mod.destroy(); } catch (_) {}
        }
        this.mod = null;
        window.partnersModule = null;
    },

    // ==================== PROXY METHODS (for data-action compatibility) ====================

    // Utils
    showConfirm: (...args) => PartnersUtils.showConfirm(...args),
    showPrompt: (...args) => PartnersUtils.showPrompt(...args),
    showLoading: (...args) => PartnersUtils.showLoading(...args),
    showError: (...args) => PartnersUtils.showError(...args),
    escapeHtml: (...args) => PartnersUtils.escapeHtml(...args),
    isValidImageUrl: (...args) => PartnersUtils.isValidImageUrl(...args),
    getStatusColor: (...args) => PartnersUtils.getStatusColor(...args),
    incrementCounter: (...args) => PartnersUtils.incrementCounter(...args),
    decrementCounter: (...args) => PartnersUtils.decrementCounter(...args),
    updateFileLabel: (...args) => PartnersUtils.updateFileLabel(...args),
    resetFileLabel: (...args) => PartnersUtils.resetFileLabel(...args),

    // Methods (inline dropdown management)
    loadMethods: (...args) => PartnersMethods.loadMethods(...args),
    populateMethodsSelect: (...args) => PartnersMethods.populateMethodsSelect(...args),
    showAddMethodInput: (...args) => PartnersMethods.showAddMethodInput(...args),
    addMethodInline: (...args) => PartnersMethods.addMethodInline(...args),
    deleteMethodInline: (...args) => PartnersMethods.deleteMethodInline(...args),
    startEditMethodInline: (...args) => PartnersMethods.startEditMethodInline(...args),
    saveEditMethodInline: (...args) => PartnersMethods.saveEditMethodInline(...args),
    cancelEditMethodInline: (...args) => PartnersMethods.cancelEditMethodInline(...args),

    // Columns
    getColumnsConfig: (...args) => PartnersColumns.getColumnsConfig(...args),
    collectCustomFieldNames: (...args) => PartnersColumns.collectCustomFieldNames(...args),
    saveColumnsConfig: (...args) => PartnersColumns.saveColumnsConfig(...args),
    resetColumnsConfig: (...args) => PartnersColumns.resetColumnsConfig(...args),
    toggleColumnsMenu: (...args) => PartnersColumns.toggleColumnsMenu(...args),
    closeColumnsMenu: (...args) => PartnersColumns.closeColumnsMenu(...args),
    toggleColumn: (...args) => PartnersColumns.toggleColumn(...args),
    handleColumnDragStart: (...args) => PartnersColumns.handleColumnDragStart(...args),
    handleColumnDragOver: (...args) => PartnersColumns.handleColumnDragOver(...args),
    handleColumnDrop: (...args) => PartnersColumns.handleColumnDrop(...args),
    handleColumnDragEnd: (...args) => PartnersColumns.handleColumnDragEnd(...args),
    renderColumnsMenu: (...args) => PartnersColumns.renderColumnsMenu(...args),
    renderTableHeader: (...args) => PartnersColumns.renderTableHeader(...args),
    renderColumnCell: (...args) => PartnersColumns.renderColumnCell(...args),
    cleanupUnusedColumns: (...args) => PartnersColumns.cleanupUnusedColumns(...args),

    // Renderer
    render: (...args) => PartnersRenderer.render(...args),
    updateStats: (...args) => PartnersRenderer.updateStats(...args),
    sortBy: (...args) => PartnersRenderer.sortBy(...args),
    filterTable: (...args) => PartnersRenderer.filterTable(...args),
    goToPage: (page) => PartnersForms.goToPage(page),
    toggleSidebar: (...args) => PartnersRenderer.toggleSidebar(...args),

    // Navigation
    selectPartner: (...args) => PartnersNavigation.selectPartner(...args),
    deselectPartner: (...args) => PartnersNavigation.deselectPartner(...args),
    closeCard: (...args) => PartnersNavigation.closeCard(...args),
    showHintPanel: (...args) => PartnersNavigation.showHintPanel(...args),
    showPartnerCard: (...args) => PartnersNavigation.showPartnerCard(...args),
    generateCardInfo: (...args) => PartnersNavigation.generateCardInfo(...args),
    toggleStatusDropdown: (...args) => PartnersNavigation.toggleStatusDropdown(...args),
    changeStatus: (...args) => PartnersNavigation.changeStatus(...args),
    toggleFormStatusDropdown: (...args) => PartnersNavigation.toggleFormStatusDropdown(...args),
    changeFormStatus: (...args) => PartnersNavigation.changeFormStatus(...args),

    // Forms
    showAddModal: (...args) => PartnersForms.showAddModal(...args),
    editFromCard: (...args) => PartnersForms.editFromCard(...args),
    closeForm: (...args) => PartnersForms.closeForm(...args),
    removeDynamicFields: (...args) => PartnersForms.removeDynamicFields(...args),
    saveFromForm: (...args) => PartnersForms.saveFromForm(...args),
    deleteFromCard: (...args) => PartnersForms.deleteFromCard(...args),
    deleteFromForm: (...args) => PartnersForms.deleteFromForm(...args),
    loadAllData: (...args) => PartnersForms.loadAllData(...args),
    syncPartnersToLocalStorage: (...args) => PartnersForms.syncPartnersToLocalStorage(...args),
    loadDataFromCloud: (...args) => PartnersForms.loadDataFromCloud(...args),

    // Avatars
    avatarClick: (...args) => PartnersAvatars.avatarClick(...args),
    handleAvatarUpload: (...args) => PartnersAvatars.handleAvatarUpload(...args),
    showCropModal: (...args) => PartnersAvatars.showCropModal(...args),
    closeCropModal: (...args) => PartnersAvatars.closeCropModal(...args),
    setupCropHandlers: (...args) => PartnersAvatars.setupCropHandlers(...args),
    updateCropTransform: (...args) => PartnersAvatars.updateCropTransform(...args),
    applyCrop: (...args) => PartnersAvatars.applyCrop(...args),
    compressImage: (...args) => PartnersAvatars.compressImage(...args),

    // Templates
    handleTemplateChange: (...args) => PartnersTemplates.handleTemplateChange(...args),
    resetToDefaultFields: (...args) => PartnersTemplates.resetToDefaultFields(...args),
    restoreTemplateSelection: (...args) => PartnersTemplates.restoreTemplateSelection(...args),
    showDeleteTemplateDialog: (...args) => PartnersTemplates.showDeleteTemplateDialog(...args),
    showRenameTemplateDialog: (...args) => PartnersTemplates.showRenameTemplateDialog(...args),
    showEditTemplateDialog: (...args) => PartnersTemplates.showEditTemplateDialog(...args),
    showTemplateEditor: (...args) => PartnersTemplates.showTemplateEditor(...args),
    createTemplateFieldHtml: (...args) => PartnersTemplates.createTemplateFieldHtml(...args),
    addTemplateField: (...args) => PartnersTemplates.addTemplateField(...args),
    updateTemplateFieldLabel: (...args) => PartnersTemplates.updateTemplateFieldLabel(...args),
    updateTemplateFieldType: (...args) => PartnersTemplates.updateTemplateFieldType(...args),
    removeTemplateField: (...args) => PartnersTemplates.removeTemplateField(...args),
    applyTemplate: (...args) => PartnersTemplates.applyTemplate(...args),
    saveTemplate: (...args) => PartnersTemplates.saveTemplate(...args),
    updateTemplateList: (...args) => PartnersTemplates.updateTemplateList(...args),

    // Import/Export
    showExportDialog: (...args) => PartnersImportExport.showExportDialog(...args),
    closeExportDialog: (...args) => PartnersImportExport.closeExportDialog(...args),
    setExportType: (...args) => PartnersImportExport.setExportType(...args),
    populateExportTemplateSelect: (...args) => PartnersImportExport.populateExportTemplateSelect(...args),
    updateExportPreview: (...args) => PartnersImportExport.updateExportPreview(...args),
    doExport: (...args) => PartnersImportExport.doExport(...args),
    exportAsJSON: (...args) => PartnersImportExport.exportAsJSON(...args),
    exportAsExcel: (...args) => PartnersImportExport.exportAsExcel(...args),
    showImportDialog: (...args) => PartnersImportExport.showImportDialog(...args),
    closeImportDialog: (...args) => PartnersImportExport.closeImportDialog(...args),
    setImportType: (...args) => PartnersImportExport.setImportType(...args),
    goToImportStep1: (...args) => PartnersImportExport.goToImportStep1(...args),
    goToImportStep2: (...args) => PartnersImportExport.goToImportStep2(...args),
    populateImportTemplateSelect: (...args) => PartnersImportExport.populateImportTemplateSelect(...args),
    updateExcelHint: (...args) => PartnersImportExport.updateExcelHint(...args),
    downloadExcelTemplate: (...args) => PartnersImportExport.downloadExcelTemplate(...args),
    generateExampleRow: (...args) => PartnersImportExport.generateExampleRow(...args),
    setupImportHandler: (...args) => PartnersImportExport.setupImportHandler(...args),
    openTemplateFromImport: (...args) => PartnersImportExport.openTemplateFromImport(...args),
    createTemplateFromExtraColumns: (...args) => PartnersImportExport.createTemplateFromExtraColumns(...args),
    ignoreExtraColumns: (...args) => PartnersImportExport.ignoreExtraColumns(...args),
    importData: (...args) => PartnersImportExport.importData(...args),
    showImportProgress: (...args) => PartnersImportExport.showImportProgress(...args),
    hideImportProgress: (...args) => PartnersImportExport.hideImportProgress(...args),
    cancelImport: (...args) => PartnersImportExport.cancelImport(...args),
    removeDuplicates: (...args) => PartnersImportExport.removeDuplicates(...args),

    // Form Dropdowns — QWIN-03: делегируем в shared/js/dropdown-helper.js
    // BFIX-15: evt передаётся для touchend.preventDefault внутри DropdownHelper.toggle
    toggleFormDropdown(target, evt) {
        DropdownHelper.toggle(target, evt);
    },
    selectFormDropdown(target) {
        DropdownHelper.select(target, target.dataset.value ?? '', target.textContent);
        // Page-specific post-callbacks (template change, export preview, excel hint)
        const wrap = target.closest('.dropdown-wrap--form');
        const wrapId = wrap?.id;
        if (wrapId === 'templateSelectWrap') {
            PartnersTemplates.handleTemplateChange();
        } else if (wrapId === 'exportTemplateSelectWrap') {
            PartnersImportExport.updateExportPreview();
        } else if (wrapId === 'importTemplateSelectWrap') {
            PartnersImportExport.updateExcelHint();
        }
    },

    // State accessors (for backward compatibility)
    getPartners: () => PartnersState.getPartners(),
    getMethods: () => PartnersState.getMethods()
};

// Expose для inline event handlers (HTML data-action attribute legacy)
window.partnersApp = partnersApp;

// ==================== PageLifecycle ====================
PageLifecycle.init({
    module: 'partners',
    async onInit() {
        await partnersApp.init();
    },
    onDestroy() {
        partnersApp.destroy();
    },
    modals: {
        '#importModal': () => partnersApp.closeImportDialog(),
        '#cropModal': () => partnersApp.closeCropModal()
    }
});

// ==================== Global Event Listeners ====================

// Close dropdowns and menus when clicking outside
const _dropdownRefs = { columnsMenu: null, _init: false };
function _ensureDropdownRefs() {
    if (_dropdownRefs._init) return;
    _dropdownRefs.columnsMenu = document.getElementById('columnsMenu');
    _dropdownRefs._init = true;
}
document.addEventListener('click', (e) => {
    _ensureDropdownRefs();
    const r = _dropdownRefs;

    // Закрыть меню «Колонки» при клике вне меню и не по кнопке-триггеру
    if (r.columnsMenu && r.columnsMenu.classList.contains('active')) {
        const onToggleBtn = e.target.closest('[data-action="partners-toggleColumnsMenu"]');
        if (!r.columnsMenu.contains(e.target) && !onToggleBtn) {
            r.columnsMenu.classList.remove('active');
        }
    }
    // Close all custom dropdowns (form + status) when clicking outside
    // Exception: formMethodMenu stays open if click is inside it (for inline edit/add/delete)
    document.querySelectorAll('.dropdown-wrap--form .dropdown-menu:not(.hidden), .dropdown-wrap--status .dropdown-menu:not(.hidden)').forEach(menu => {
        const wrap = menu.closest('.dropdown-wrap--form, .dropdown-wrap--status');
        if (wrap && !wrap.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
});

// Event delegation для всех data-action="partners-*" атрибутов
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action^="partners-"]');
    if (!target) return;

    // Игнорируем file input - он обрабатывается через change event
    if (target.type === 'file') return;

    const action = target.dataset.action.replace('partners-', '');
    const value = target.dataset.value;
    const methodId = target.dataset.methodId;
    const columnId = target.dataset.columnId;
    const fieldId = target.dataset.fieldId;

    // Для status dropdown нужно остановить всплытие
    if (action.includes('changeStatus') || action.includes('changeFormStatus')) {
        e.stopPropagation();
    }

    // Inline method management actions — stop propagation to prevent selectFormDropdown/toggleFormDropdown
    if (action === 'startEditMethodInline' || action === 'deleteMethodInline'
        || action === 'saveEditMethodInline' || action === 'cancelEditMethodInline'
        || action === 'addMethodInline' || action === 'showAddMethodInput') {
        e.stopPropagation();
    }

    // Form dropdowns — передаём DOM-элемент И event (BFIX-15: для touchend handling в DropdownHelper.toggle)
    if (action === 'toggleFormDropdown' || action === 'selectFormDropdown') {
        partnersApp[action](target, e);
        return;
    }

    // Для toggleColumn нужно получить columnId из data-column-id родителя
    if (action === 'toggleColumn') {
        const columnItem = target.closest('.column-item');
        if (columnItem) {
            partnersApp[action](columnItem.dataset.columnId);
        }
        return;
    }

    // Вызов соответствующего метода
    if (typeof partnersApp[action] === 'function') {
        // Передаем параметры в зависимости от того, что есть
        if (methodId !== undefined) {
            partnersApp[action](methodId);
        } else if (columnId !== undefined) {
            partnersApp[action](columnId);
        } else if (fieldId !== undefined) {
            partnersApp[action](fieldId);
        } else if (value !== undefined) {
            partnersApp[action](value);
        } else {
            partnersApp[action]();
        }
    }
});

// Event delegation для input событий
document.addEventListener('input', (e) => {
    const target = e.target.closest('[data-action^="partners-"]');
    if (!target) return;

    // Игнорируем file input - он обрабатывается через change event
    if (target.type === 'file') return;

    const action = target.dataset.action.replace('partners-', '');

    if (typeof partnersApp[action] === 'function') {
        partnersApp[action]();
    }
});

// Event delegation для change событий
document.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action^="partners-"]');
    if (!target) return;

    const action = target.dataset.action.replace('partners-', '');

    if (action === 'handleAvatarUpload') {
        partnersApp.handleAvatarUpload(e);
    } else if (typeof partnersApp[action] === 'function') {
        partnersApp[action]();
    }
});

// Event delegation для keypress событий
document.addEventListener('keypress', (e) => {
    const target = e.target.closest('[data-action^="partners-"]');
    if (!target) return;

    const action = target.dataset.action.replace('partners-', '');

    if (typeof partnersApp[action] === 'function' && e.key === 'Enter') {
        partnersApp[action]();
    }
});
