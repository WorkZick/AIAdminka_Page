// Partners App - Controller (delegates to modules)
const partnersApp = {
    // ==================== INITIALIZATION ====================
    async init() {
        // AuthGuard.checkWithRole() и CloudStorage.init() уже вызваны в PageLifecycle

        // Show loading
        PartnersUtils.showLoading(true);

        try {
            // Load data from cloud
            await PartnersForms.loadAllData();

            // Render UI
            PartnersColumns.renderTableHeader();
            PartnersRenderer.render();
            PartnersRenderer.updateStats();
            PartnersImportExport.setupImportHandler();
            PartnersAvatars.setupCropHandlers();
            PartnersColumns.renderColumnsMenu();

        } catch (error) {
            console.error('Init error:', error);
            PartnersUtils.showError('Ошибка загрузки данных: ' + error.message);
        } finally {
            PartnersUtils.showLoading(false);
        }

        // Слушаем завершение синхронизации для обновления данных
        window.addEventListener('sync-complete', () => {
            PartnersForms.loadDataFromCloud();
        });
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

    // Methods
    loadMethods: (...args) => PartnersMethods.loadMethods(...args),
    showMethodsDialog: (...args) => PartnersMethods.showMethodsDialog(...args),
    closeMethodsDialog: (...args) => PartnersMethods.closeMethodsDialog(...args),
    addMethod: (...args) => PartnersMethods.addMethod(...args),
    deleteMethod: (...args) => PartnersMethods.deleteMethod(...args),
    startEditMethod: (...args) => PartnersMethods.startEditMethod(...args),
    saveEditMethod: (...args) => PartnersMethods.saveEditMethod(...args),
    cancelEditMethod: (...args) => PartnersMethods.cancelEditMethod(...args),
    renderMethodsList: (...args) => PartnersMethods.renderMethodsList(...args),
    populateMethodsSelect: (...args) => PartnersMethods.populateMethodsSelect(...args),
    updateMethodsCount: (...args) => PartnersMethods.updateMethodsCount(...args),

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

    // State accessors (for backward compatibility)
    getPartners: () => PartnersState.getPartners(),
    getMethods: () => PartnersState.getMethods()
};

// ==================== PageLifecycle ====================
PageLifecycle.init({
    module: 'partners',
    async onInit() {
        partnersApp.init();
    },
    modals: {
        '#importModal': () => partnersApp.closeImportDialog(),
        '#cropModal': () => partnersApp.closeCropModal()
    }
});

// ==================== Global Event Listeners ====================

// Event delegation for table row clicks
document.getElementById('partnersTableBody').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-partner-id]');
    if (row) {
        PartnersNavigation.selectPartner(row.dataset.partnerId);
    }
});

// Close dropdowns and menus when clicking outside
document.addEventListener('click', (e) => {
    const cardStatusBadge = document.getElementById('cardStatusBadge');
    const cardStatusDropdown = document.getElementById('cardStatusDropdown');
    const formStatusBadge = document.getElementById('formStatusBadge');
    const formStatusDropdown = document.getElementById('formStatusDropdown');
    const columnsSettings = document.querySelector('.columns-settings');
    const columnsMenu = document.getElementById('columnsMenu');

    if (cardStatusBadge && cardStatusDropdown && !cardStatusBadge.contains(e.target)) {
        cardStatusDropdown.classList.add('hidden');
        const arrow = cardStatusBadge.querySelector('.status-dropdown-icon');
        if (arrow) {
            arrow.classList.add('dropdown-arrow-closed');
            arrow.classList.remove('dropdown-arrow-open');
        }
    }
    if (formStatusBadge && formStatusDropdown && !formStatusBadge.contains(e.target)) {
        formStatusDropdown.classList.add('hidden');
        const arrow = formStatusBadge.querySelector('.status-dropdown-icon');
        if (arrow) {
            arrow.classList.add('dropdown-arrow-closed');
            arrow.classList.remove('dropdown-arrow-open');
        }
    }
    if (columnsSettings && columnsMenu && !columnsSettings.contains(e.target)) {
        columnsMenu.classList.remove('active');
    }
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

    if (action === 'methodInputKeypress' && e.key === 'Enter') {
        partnersApp.addMethod();
    }
});
