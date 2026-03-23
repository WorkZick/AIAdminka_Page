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

    // Pagination & filtering
    currentPage: 1,
    perPage: 50,
    searchQuery: '',
    _filteredCache: null,

    _invalidateFiltered() {
        this._filteredCache = null;
    },

    getFilteredPartners() {
        if (this._filteredCache) return this._filteredCache;

        let data = [...this.cachedPartners];

        // Filter by search query
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            data = data.filter(p => {
                const searchable = [
                    p.subagent, p.subagentId, p.method,
                    p.status, p.contact, p.comment
                ].filter(Boolean).join(' ').toLowerCase();
                return searchable.includes(q);
            });
        }

        // Sort
        if (this.sortField) {
            data.sort((a, b) => {
                const valA = (a[this.sortField] || '').toString().toLowerCase();
                const valB = (b[this.sortField] || '').toString().toLowerCase();
                if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        this._filteredCache = data;
        return data;
    },

    getTotalPages() {
        return Math.max(1, Math.ceil(this.getFilteredPartners().length / this.perPage));
    },

    getPagedPartners() {
        const filtered = this.getFilteredPartners();
        const start = (this.currentPage - 1) * this.perPage;
        return filtered.slice(start, start + this.perPage);
    },

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

    // Import state
    importCancelled: false,

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
