// Контроллер модуля управления трафиком
// Модули: TrafficState, TrafficParsers, TrafficNavigation, TrafficUpload,
//         TrafficManualData, TrafficCalculator, TrafficRenderer, TrafficImportExport

// Маппинг действий на модули (заменяет proxy-методы и whitelist)
const _MODULE_MAP = {
    // Navigation
    toggleSidebar: TrafficNavigation,
    switchTab: TrafficNavigation,
    goToStep: TrafficNavigation,
    updateStepsIndicator: TrafficNavigation,
    navigateToStep: TrafficNavigation,
    skipStep: TrafficNavigation,
    completeAnalytics: TrafficNavigation,
    confirmResetAnalytics: TrafficNavigation,
    resetAnalytics: TrafficNavigation,

    // Upload
    handleDepositsUpload: TrafficUpload,
    handleQualityUpload: TrafficUpload,
    handlePercentUpload: TrafficUpload,
    resetDepositsData: TrafficUpload,
    resetQualityData: TrafficUpload,
    resetPercentData: TrafficUpload,

    // Manual Data
    prepareStep5PartnersList: TrafficManualData,
    renderStep5PartnersList: TrafficManualData,
    filterPartnersList: TrafficManualData,
    loadPartnerManualData: TrafficManualData,
    saveCurrentManualData: TrafficManualData,
    checkManualDataCompletion: TrafficManualData,
    resetWorkTimeData: TrafficManualData,
    resetAllWorkTimeData: TrafficManualData,
    prepareStep6PartnersList: TrafficManualData,
    renderStep6PartnersList: TrafficManualData,
    filterPartnersListStep6: TrafficManualData,
    loadPartnerManualDataStep6: TrafficManualData,
    saveCurrentManualDataStep6: TrafficManualData,
    checkManualDataCompletionStep6: TrafficManualData,
    resetViolationsData: TrafficManualData,
    resetAllViolationsData: TrafficManualData,
    incrementManualValue: TrafficManualData,
    decrementManualValue: TrafficManualData,

    // Calculator
    loadTrafficSettings: TrafficCalculator,
    getDefaultTrafficSettings: TrafficCalculator,
    saveTrafficSettings: TrafficCalculator,
    renderTrafficSettings: TrafficCalculator,
    updateTrafficSetting: TrafficCalculator,
    updateTrafficSettingMultiplier: TrafficCalculator,
    toggleHelp: TrafficCalculator,
    evaluatePartner: TrafficCalculator,
    getDaysFromAdded: TrafficCalculator,
    calculateTrafficPercentages: TrafficCalculator,
    calculateTraffic: TrafficCalculator,
    calculateAndShowResults: TrafficCalculator,
    prepareStep7Report: TrafficCalculator,
    prepareStep8Settings: TrafficCalculator,

    // Renderer
    renderAnalytics: TrafficRenderer,
    updateSelectedPartnersView: TrafficRenderer,
    selectAll: TrafficRenderer,
    clearSelection: TrafficRenderer,
    showMethodSelection: TrafficRenderer,
    applyMethodSelection: TrafficRenderer,
    showManualSelection: TrafficRenderer,
    applyManualSelection: TrafficRenderer,
    hideAllPanels: TrafficRenderer,
    renderPartners: TrafficRenderer,
    loadMethods: TrafficRenderer,
    updateCounts: TrafficRenderer,
    showMethodModal: TrafficRenderer,
    closeMethodModal: TrafficRenderer,
    renderMethodsList: TrafficRenderer,
    generateReport: TrafficRenderer,
    showTrafficResults: TrafficRenderer,
    showTrafficResultsInStep: TrafficRenderer,
    closeTrafficResults: TrafficRenderer,
    openTrafficCalculator: TrafficRenderer,
    closeTrafficCalculator: TrafficRenderer,
    editPartner: TrafficRenderer,
    saveEdit: TrafficRenderer,
    closeEditModal: TrafficRenderer,
    escapeHtml: TrafficRenderer,

    // Import/Export
    exportTrafficSettings: TrafficImportExport,
    importTrafficSettings: TrafficImportExport,
    exportTrafficResults: TrafficImportExport,
    exportReportToExcel: TrafficImportExport,
    exportPartners: TrafficImportExport,
    showImportModal: TrafficImportExport,
    closeImportModal: TrafficImportExport,
    importPartners: TrafficImportExport,
    addPartner: TrafficImportExport,
    deletePartner: TrafficImportExport,
    addMethod: TrafficImportExport,
    deleteMethod: TrafficImportExport,
    updatePartnerStatuses: TrafficImportExport,
    filterPartners: TrafficImportExport
};

// Вызов метода по имени action через маппинг
function _callAction(action, ...args) {
    var mod = _MODULE_MAP[action];
    if (mod && typeof mod[action] === 'function') {
        return mod[action](...args);
    }
}

// Initialize via PageLifecycle
PageLifecycle.init({
    module: 'traffic',
    async onInit() {
        await storage.loadPartners();
        TrafficRenderer.renderAnalytics();
    },
    onDestroy() {
        TrafficParsers.destroy();
    }
});

// Event delegation для всех data-action="traffic-*" атрибутов
document.addEventListener('click', function(e) {
    var target = e.target.closest('[data-action^="traffic-"]');
    if (!target) return;

    var action = target.dataset.action.replace('traffic-', '');

    // fileZoneClick — специальная обработка (не в маппинге)
    if (action === 'fileZoneClick') {
        var fileInputId = target.dataset.fileInputId;
        var allowedInputs = ['depositsFileInput', 'qualityFileInput', 'percentFileInput'];
        if (fileInputId && allowedInputs.indexOf(fileInputId) !== -1) {
            document.getElementById(fileInputId).click();
        }
        return;
    }

    if (!_MODULE_MAP[action]) return;

    // Действия с data-step
    if (action === 'navigateToStep' || action === 'goToStep') {
        var step = parseInt(target.dataset.step, 10);
        if (!isNaN(step)) _callAction(action, step);
        return;
    }

    // increment/decrement с data-field
    if (action === 'incrementManualValue' || action === 'decrementManualValue') {
        var fieldId = target.dataset.field;
        if (fieldId) _callAction(action, fieldId);
        return;
    }

    _callAction(action);
});

// Event delegation для input событий (с debounce 150мс)
var _inputDebounceTimer = null;
document.addEventListener('input', function(e) {
    var target = e.target.closest('[data-action^="traffic-"]');
    if (!target) return;

    var action = target.dataset.action.replace('traffic-', '');
    if (_MODULE_MAP[action]) {
        clearTimeout(_inputDebounceTimer);
        _inputDebounceTimer = setTimeout(function() { _callAction(action); }, 150);
    }
});

// Event delegation для change событий
document.addEventListener('change', function(e) {
    // File inputs
    if (e.target.type === 'file') {
        if (e.target.id === 'depositsFileInput') _callAction('handleDepositsUpload', e);
        else if (e.target.id === 'qualityFileInput') _callAction('handleQualityUpload', e);
        else if (e.target.id === 'percentFileInput') _callAction('handlePercentUpload', e);
        return;
    }

    var target = e.target.closest('[data-action^="traffic-"]');
    if (!target) return;

    var action = target.dataset.action.replace('traffic-', '');
    if (_MODULE_MAP[action]) _callAction(action);
});
