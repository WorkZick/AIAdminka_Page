// Partners State - all state properties
const PartnersState = {
    selectedPartnerId: null,
    editingPartnerId: null,
    sortField: null,
    sortDirection: 'asc',
    pendingImportData: null,
    pendingExtraColumns: null,
    importType: 'json',
    selectedImportTemplateId: null,

    // Cached data
    cachedPartners: [],
    cachedMethods: [],
    cachedTemplates: {},

    // Loading state
    isLoading: false,

    // Template system
    isTemplateMode: false,
    editingTemplateId: null,
    currentTemplateId: null,
    templateFields: [],

    // Form status
    formStatus: 'Открыт',

    // Avatar/crop system
    cropData: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        startX: 0,
        startY: 0,
        originalSrc: null
    },

    // Export state
    exportType: 'json',
    selectedExportTemplateId: null,

    // Column drag state
    draggedColumnIndex: null,

    // Helper: get partners
    getPartners() {
        return this.cachedPartners;
    },

    // Helper: get methods
    getMethods() {
        return this.cachedMethods;
    }
};
