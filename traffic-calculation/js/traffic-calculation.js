// Контроллер модуля управления трафиком
// Модули: TrafficState, TrafficParsers, TrafficNavigation, TrafficUpload,
//         TrafficManualData, TrafficCalculator, TrafficRenderer, TrafficImportExport
const trafficCalc = {
    // === Инициализация ===
    async init() {
        // AuthGuard.checkWithRole() и CloudStorage.init() уже вызваны в PageLifecycle

        // Загружаем партнёров из облака
        await storage.loadPartners();
        this.setupEventListeners();
        TrafficRenderer.renderAnalytics();
    },

    setupEventListeners() {
        // Обработчики событий (если понадобятся)
    },

    // === Proxy-методы для обратной совместимости с data-action ===

    // Navigation
    toggleSidebar() { TrafficNavigation.toggleSidebar(); },
    switchTab(tabName, event) { TrafficNavigation.switchTab(tabName, event); },
    goToStep(step) { TrafficNavigation.goToStep(step); },
    updateStepsIndicator(step) { TrafficNavigation.updateStepsIndicator(step); },
    navigateToStep(step) { TrafficNavigation.navigateToStep(step); },
    skipStep(step) { TrafficNavigation.skipStep(step); },
    completeAnalytics() { TrafficNavigation.completeAnalytics(); },
    confirmResetAnalytics() { TrafficNavigation.confirmResetAnalytics(); },
    resetAnalytics() { TrafficNavigation.resetAnalytics(); },

    // Upload
    handleDepositsUpload(event) { TrafficUpload.handleDepositsUpload(event); },
    handleQualityUpload(event) { TrafficUpload.handleQualityUpload(event); },
    handlePercentUpload(event) { TrafficUpload.handlePercentUpload(event); },
    resetDepositsData() { TrafficUpload.resetDepositsData(); },
    resetQualityData() { TrafficUpload.resetQualityData(); },
    resetPercentData() { TrafficUpload.resetPercentData(); },

    // Manual Data
    prepareStep5PartnersList() { TrafficManualData.prepareStep5PartnersList(); },
    renderStep5PartnersList(filterText) { TrafficManualData.renderStep5PartnersList(filterText); },
    filterPartnersList() { TrafficManualData.filterPartnersList(); },
    loadPartnerManualData() { TrafficManualData.loadPartnerManualData(); },
    saveCurrentManualData() { TrafficManualData.saveCurrentManualData(); },
    checkManualDataCompletion() { TrafficManualData.checkManualDataCompletion(); },
    resetWorkTimeData() { TrafficManualData.resetWorkTimeData(); },
    resetAllWorkTimeData() { TrafficManualData.resetAllWorkTimeData(); },
    prepareStep6PartnersList() { TrafficManualData.prepareStep6PartnersList(); },
    renderStep6PartnersList(filterText) { TrafficManualData.renderStep6PartnersList(filterText); },
    filterPartnersListStep6() { TrafficManualData.filterPartnersListStep6(); },
    loadPartnerManualDataStep6() { TrafficManualData.loadPartnerManualDataStep6(); },
    saveCurrentManualDataStep6() { TrafficManualData.saveCurrentManualDataStep6(); },
    checkManualDataCompletionStep6() { TrafficManualData.checkManualDataCompletionStep6(); },
    resetViolationsData() { TrafficManualData.resetViolationsData(); },
    resetAllViolationsData() { TrafficManualData.resetAllViolationsData(); },
    incrementManualValue(fieldId) { TrafficManualData.incrementManualValue(fieldId); },
    decrementManualValue(fieldId) { TrafficManualData.decrementManualValue(fieldId); },

    // Calculator
    loadTrafficSettings() { return TrafficCalculator.loadTrafficSettings(); },
    getDefaultTrafficSettings() { return TrafficCalculator.getDefaultTrafficSettings(); },
    saveTrafficSettings() { TrafficCalculator.saveTrafficSettings(); },
    renderTrafficSettings() { TrafficCalculator.renderTrafficSettings(); },
    updateTrafficSetting(paramKey, level, field, value) { TrafficCalculator.updateTrafficSetting(paramKey, level, field, value); },
    updateTrafficSettingMultiplier(paramKey, field, value) { TrafficCalculator.updateTrafficSettingMultiplier(paramKey, field, value); },
    toggleHelp() { TrafficCalculator.toggleHelp(); },
    evaluatePartner(partner, settings) { return TrafficCalculator.evaluatePartner(partner, settings); },
    getDaysFromAdded(dateAdded) { return TrafficCalculator.getDaysFromAdded(dateAdded); },
    calculateTrafficPercentages() { TrafficCalculator.calculateTrafficPercentages(); },
    calculateTraffic() { TrafficCalculator.calculateTraffic(); },
    calculateAndShowResults() { TrafficCalculator.calculateAndShowResults(); },
    prepareStep7Report() { TrafficCalculator.prepareStep7Report(); },
    prepareStep8Settings() { TrafficCalculator.prepareStep8Settings(); },

    // Renderer
    renderAnalytics() { TrafficRenderer.renderAnalytics(); },
    updateSelectedPartnersView() { TrafficRenderer.updateSelectedPartnersView(); },
    selectAll() { TrafficRenderer.selectAll(); },
    clearSelection() { TrafficRenderer.clearSelection(); },
    showMethodSelection() { TrafficRenderer.showMethodSelection(); },
    applyMethodSelection() { TrafficRenderer.applyMethodSelection(); },
    showManualSelection() { TrafficRenderer.showManualSelection(); },
    applyManualSelection() { TrafficRenderer.applyManualSelection(); },
    hideAllPanels() { TrafficRenderer.hideAllPanels(); },
    renderPartners() { TrafficRenderer.renderPartners(); },
    loadMethods() { TrafficRenderer.loadMethods(); },
    updateCounts() { TrafficRenderer.updateCounts(); },
    showMethodModal() { TrafficRenderer.showMethodModal(); },
    closeMethodModal() { TrafficRenderer.closeMethodModal(); },
    renderMethodsList() { TrafficRenderer.renderMethodsList(); },
    generateReport() { TrafficRenderer.generateReport(); },
    showTrafficResults() { TrafficRenderer.showTrafficResults(); },
    showTrafficResultsInStep() { TrafficRenderer.showTrafficResultsInStep(); },
    closeTrafficResults() { TrafficRenderer.closeTrafficResults(); },
    openTrafficCalculator() { TrafficRenderer.openTrafficCalculator(); },
    closeTrafficCalculator() { TrafficRenderer.closeTrafficCalculator(); },
    editPartner(id) { TrafficRenderer.editPartner(id); },
    saveEdit() { TrafficRenderer.saveEdit(); },
    closeEditModal() { TrafficRenderer.closeEditModal(); },
    escapeHtml(text) { return TrafficRenderer.escapeHtml(text); },

    // Import/Export
    exportTrafficSettings() { TrafficImportExport.exportTrafficSettings(); },
    importTrafficSettings() { TrafficImportExport.importTrafficSettings(); },
    exportTrafficResults() { TrafficImportExport.exportTrafficResults(); },
    exportReportToExcel() { TrafficImportExport.exportReportToExcel(); },
    exportPartners() { TrafficImportExport.exportPartners(); },
    showImportModal() { TrafficImportExport.showImportModal(); },
    closeImportModal() { TrafficImportExport.closeImportModal(); },
    importPartners() { TrafficImportExport.importPartners(); },
    addPartner() { TrafficImportExport.addPartner(); },
    deletePartner(id) { TrafficImportExport.deletePartner(id); },
    addMethod() { TrafficImportExport.addMethod(); },
    deleteMethod(methodName) { TrafficImportExport.deleteMethod(methodName); },
    updatePartnerStatuses() { TrafficImportExport.updatePartnerStatuses(); },
    filterPartners() { TrafficImportExport.filterPartners(); }
};

// Initialize via PageLifecycle
PageLifecycle.init({
    module: 'traffic',
    async onInit() {
        await trafficCalc.init();
    },
    onDestroy() {
        TrafficParsers.destroy();
    }
});

// Whitelist допустимых действий для event delegation
const _ALLOWED_ACTIONS = new Set([
    // Navigation
    'toggleSidebar', 'goToStep', 'navigateToStep', 'skipStep',
    'completeAnalytics', 'confirmResetAnalytics', 'resetAnalytics',
    // Upload
    'resetDepositsData', 'resetQualityData', 'resetPercentData',
    // Manual Data
    'prepareStep5PartnersList', 'filterPartnersList', 'loadPartnerManualData',
    'saveCurrentManualData', 'checkManualDataCompletion', 'resetWorkTimeData', 'resetAllWorkTimeData',
    'prepareStep6PartnersList', 'filterPartnersListStep6', 'loadPartnerManualDataStep6',
    'saveCurrentManualDataStep6', 'checkManualDataCompletionStep6', 'resetViolationsData', 'resetAllViolationsData',
    'incrementManualValue', 'decrementManualValue',
    // Calculator
    'saveTrafficSettings', 'renderTrafficSettings', 'toggleHelp',
    'calculateTraffic', 'calculateAndShowResults', 'prepareStep7Report', 'prepareStep8Settings',
    // Renderer
    'renderAnalytics', 'updateSelectedPartnersView', 'selectAll', 'clearSelection',
    'showMethodSelection', 'applyMethodSelection', 'showManualSelection', 'applyManualSelection',
    'hideAllPanels', 'renderPartners', 'loadMethods', 'updateCounts',
    'showMethodModal', 'closeMethodModal', 'renderMethodsList',
    'generateReport', 'showTrafficResults', 'showTrafficResultsInStep', 'closeTrafficResults',
    'openTrafficCalculator', 'closeTrafficCalculator', 'saveEdit', 'closeEditModal',
    // Import/Export
    'exportTrafficSettings', 'importTrafficSettings', 'exportTrafficResults', 'exportReportToExcel',
    'exportPartners', 'showImportModal', 'closeImportModal', 'importPartners',
    'addPartner', 'addMethod', 'updatePartnerStatuses', 'filterPartners',
    // Special
    'fileZoneClick'
]);

// Event delegation для всех data-action="traffic-*" атрибутов
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action^="traffic-"]');
    if (!target) return;

    const action = target.dataset.action.replace('traffic-', '');

    if (!_ALLOWED_ACTIONS.has(action)) return;

    // Специальная обработка для fileZoneClick
    if (action === 'fileZoneClick') {
        const fileInputId = target.dataset.fileInputId;
        if (fileInputId) {
            document.getElementById(fileInputId).click();
        }
        return;
    }

    // Специальная обработка для navigateToStep
    if (action === 'navigateToStep') {
        const step = parseInt(target.dataset.step, 10);
        if (!isNaN(step)) {
            trafficCalc.navigateToStep(step);
        }
        return;
    }

    // Специальная обработка для goToStep
    if (action === 'goToStep') {
        const step = parseInt(target.dataset.step, 10);
        if (!isNaN(step)) {
            trafficCalc.goToStep(step);
        }
        return;
    }

    // Специальная обработка для increment/decrement
    if (action === 'incrementManualValue' || action === 'decrementManualValue') {
        const fieldId = target.dataset.field;
        if (fieldId) {
            trafficCalc[action](fieldId);
        }
        return;
    }

    // Стандартный вызов метода
    if (typeof trafficCalc[action] === 'function') {
        trafficCalc[action]();
    }
});

// Event delegation для input событий (с debounce 150мс)
let _inputDebounceTimer = null;
document.addEventListener('input', (e) => {
    const target = e.target.closest('[data-action^="traffic-"]');
    if (!target) return;

    const action = target.dataset.action.replace('traffic-', '');

    if (_ALLOWED_ACTIONS.has(action) && typeof trafficCalc[action] === 'function') {
        clearTimeout(_inputDebounceTimer);
        _inputDebounceTimer = setTimeout(() => trafficCalc[action](), 150);
    }
});

// Event delegation для change событий
document.addEventListener('change', (e) => {
    // Обработка file inputs
    if (e.target.type === 'file') {
        if (e.target.id === 'depositsFileInput') {
            trafficCalc.handleDepositsUpload(e);
        } else if (e.target.id === 'qualityFileInput') {
            trafficCalc.handleQualityUpload(e);
        } else if (e.target.id === 'percentFileInput') {
            trafficCalc.handlePercentUpload(e);
        }
        return;
    }

    const target = e.target.closest('[data-action^="traffic-"]');
    if (!target) return;

    const action = target.dataset.action.replace('traffic-', '');

    if (_ALLOWED_ACTIONS.has(action) && typeof trafficCalc[action] === 'function') {
        trafficCalc[action]();
    }
});
