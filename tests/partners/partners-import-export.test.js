import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../partners/js/modules/partners-import-export.js'),
    'utf-8'
);

/**
 * Factory: loads PartnersImportExport with all external dependencies injected.
 *
 * PartnersImportExport references:
 *   - PartnersState
 *   - Toast
 *   - PartnersUtils
 *   - CloudStorage
 *   - XLSX  (only in exportAsExcel / downloadExcelTemplate — we stub it)
 *   - document / URL / Blob  (for exportAsJSON, DOM modals)
 *   - PartnersForms, PartnersRenderer, PartnersColumns, PartnersTemplates, SyncManager
 *     (called in importData — we stub them)
 */
function loadPartnersImportExport({
    cachedPartners = [],
    cachedMethods = [],
    cachedTemplates = {},
    pendingImportData = null,
    pendingExtraColumns = null,
    selectedImportTemplateId = null,
    selectedExportTemplateId = null,
    exportType = 'json',
    importType = 'json',
    cloudStorage = null,
    toast = null,
    partnersUtils = null,
    blobCapture = null   // optional array to capture Blob creation
} = {}) {
    const state = {
        cachedPartners: [...cachedPartners],
        cachedMethods: [...cachedMethods],
        cachedTemplates: { ...cachedTemplates },
        pendingImportData,
        pendingExtraColumns,
        selectedImportTemplateId,
        selectedExportTemplateId,
        exportType,
        importType,
        templateFields: [],
        isTemplateMode: false,
        getPartners() { return this.cachedPartners; },
        getMethods() { return this.cachedMethods; }
    };

    const mockToast = toast ?? {
        error: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
        info: vi.fn()
    };

    const mockPartnersUtils = partnersUtils ?? {
        escapeHtml: (t) => String(t),
        showError: vi.fn(),
        showLoading: vi.fn(),
        resetFileLabel: vi.fn(),
        updateFileLabel: vi.fn(),
        showConfirm: vi.fn().mockResolvedValue(true)
    };

    const mockCloudStorage = cloudStorage ?? {
        getMethods: vi.fn().mockResolvedValue([]),
        addMethod: vi.fn().mockResolvedValue({ id: 'new_m' }),
        deleteMethod: vi.fn().mockResolvedValue({}),
        updateMethod: vi.fn().mockResolvedValue({}),
        getPartners: vi.fn().mockResolvedValue([]),
        updatePartner: vi.fn().mockResolvedValue({}),
        deletePartner: vi.fn().mockResolvedValue({}),
        getImageUrl: vi.fn((id) => id ? `https://drive.google.com/thumbnail?id=${id}` : null)
    };

    // Track Blob / URL.createObjectURL calls for exportAsJSON tests
    const capturedBlobs = blobCapture ?? [];
    const createdURLs = [];
    const mockBlob = class {
        constructor(parts, opts) {
            this._parts = parts;
            this._type = opts?.type ?? '';
            capturedBlobs.push(this);
        }
    };
    const mockURL = {
        createObjectURL: vi.fn((blob) => {
            const url = 'blob:mock-' + createdURLs.length;
            createdURLs.push(url);
            return url;
        }),
        revokeObjectURL: vi.fn()
    };

    // Stub out XLSX — not needed for the tests we write
    const mockXLSX = {
        utils: {
            book_new: vi.fn(() => ({})),
            aoa_to_sheet: vi.fn(() => ({})),
            book_append_sheet: vi.fn(),
            sheet_to_json: vi.fn(() => [])
        },
        writeFile: vi.fn(),
        read: vi.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }))
    };

    // Stubs for modules called inside importData / createTemplateFromExtraColumns
    const mockPartnersForms = {
        syncPartnersToLocalStorage: vi.fn(),
        loadDataFromCloud: vi.fn(),
        showAddModal: vi.fn()
    };
    const mockPartnersRenderer = { render: vi.fn() };
    const mockPartnersColumns = {
        renderColumnsMenu: vi.fn(),
        renderTableHeader: vi.fn()
    };
    const mockPartnersTemplates = {
        showTemplateEditor: vi.fn(),
        createTemplateFieldHtml: vi.fn(() => '<div></div>')
    };
    const mockSyncManager = {
        addToQueue: vi.fn(),
        onSyncComplete: null,
        onSyncError: null
    };

    const fn = new Function(
        'PartnersState', 'Toast', 'PartnersUtils', 'CloudStorage', 'XLSX',
        'Blob', 'URL', 'document', 'Date',
        'PartnersForms', 'PartnersRenderer', 'PartnersColumns',
        'PartnersTemplates', 'SyncManager', 'console',
        `${code}\nreturn PartnersImportExport;`
    );

    const importExport = fn(
        state,
        mockToast,
        mockPartnersUtils,
        mockCloudStorage,
        mockXLSX,
        mockBlob,
        mockURL,
        document,
        Date,
        mockPartnersForms,
        mockPartnersRenderer,
        mockPartnersColumns,
        mockPartnersTemplates,
        mockSyncManager,
        console
    );

    return {
        PartnersImportExport: importExport,
        state,
        mockToast,
        mockPartnersUtils,
        mockCloudStorage,
        mockXLSX,
        mockURL,
        capturedBlobs,
        mockPartnersForms,
        mockPartnersRenderer,
        mockPartnersColumns,
        mockSyncManager
    };
}

// ─────────────────────────────────────────────
// generateExampleRow — pure logic
// ─────────────────────────────────────────────
describe('PartnersImportExport.generateExampleRow', () => {
    it('should generate row 1 with correct Субагент value', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const headers = ['Субагент', 'ID Субагента', 'Метод'];
        const row = PartnersImportExport.generateExampleRow(headers, 1);
        expect(row[0]).toBe('Субагент 1');
    });

    it('should generate row 2 with correct Субагент value', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const headers = ['Субагент'];
        const row = PartnersImportExport.generateExampleRow(headers, 2);
        expect(row[0]).toBe('Субагент 2');
    });

    it('should generate padded "ID Субагента" (SA-0001 for row 1)', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const headers = ['ID Субагента'];
        const row = PartnersImportExport.generateExampleRow(headers, 1);
        expect(row[0]).toBe('SA-0001');
    });

    it('should generate "SA-0002" for row 2', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const headers = ['ID Субагента'];
        const row = PartnersImportExport.generateExampleRow(headers, 2);
        expect(row[0]).toBe('SA-0002');
    });

    it('should generate "Метод A" for row 1', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const headers = ['Метод'];
        const row = PartnersImportExport.generateExampleRow(headers, 1);
        expect(row[0]).toBe('Метод A');
    });

    it('should generate "Метод B" for row 2', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const headers = ['Метод'];
        const row = PartnersImportExport.generateExampleRow(headers, 2);
        expect(row[0]).toBe('Метод B');
    });

    it('should compute DEP as rowNum * 10', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const row1 = PartnersImportExport.generateExampleRow(['DEP'], 1);
        const row3 = PartnersImportExport.generateExampleRow(['DEP'], 3);
        expect(row1[0]).toBe(10);
        expect(row3[0]).toBe(30);
    });

    it('should compute WITH as rowNum * 5', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const row2 = PartnersImportExport.generateExampleRow(['WITH'], 2);
        expect(row2[0]).toBe(10);
    });

    it('should compute COMP as rowNum * 2', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const row4 = PartnersImportExport.generateExampleRow(['COMP'], 4);
        expect(row4[0]).toBe(8);
    });

    it('should return "Открыт" for Статус column', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const row = PartnersImportExport.generateExampleRow(['Статус'], 1);
        expect(row[0]).toBe('Открыт');
    });

    it('should return empty string for Фото column', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const row = PartnersImportExport.generateExampleRow(['Фото'], 1);
        expect(row[0]).toBe('');
    });

    it('should return "Значение N" for unknown/custom column', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const row = PartnersImportExport.generateExampleRow(['CustomField'], 3);
        expect(row[0]).toBe('Значение 3');
    });

    it('should handle all base headers in a single call', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const headers = ['Субагент', 'ID Субагента', 'Метод', 'DEP', 'WITH', 'COMP', 'Статус', 'Фото'];
        const row = PartnersImportExport.generateExampleRow(headers, 1);
        expect(row).toHaveLength(8);
        expect(row[0]).toBe('Субагент 1');
        expect(row[1]).toBe('SA-0001');
        expect(row[2]).toBe('Метод A');
        expect(row[3]).toBe(10);
        expect(row[4]).toBe(5);
        expect(row[5]).toBe(2);
        expect(row[6]).toBe('Открыт');
        expect(row[7]).toBe('');
    });

    it('should return empty array for empty headers', () => {
        const { PartnersImportExport } = loadPartnersImportExport();
        const row = PartnersImportExport.generateExampleRow([], 1);
        expect(row).toEqual([]);
    });
});

// ─────────────────────────────────────────────
// exportAsJSON — data structure and Blob creation
// ─────────────────────────────────────────────
describe('PartnersImportExport.exportAsJSON', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create a Blob with the correct JSON structure', () => {
        const partners = [
            { id: 'p1', subagent: 'Alpha', subagentId: 'SA-0001', method: 'Crypto' }
        ];
        const capturedBlobs = [];
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: partners,
            blobCapture: capturedBlobs
        });

        PartnersImportExport.exportAsJSON();

        expect(capturedBlobs).toHaveLength(1);
        const blobContent = JSON.parse(capturedBlobs[0]._parts[0]);
        expect(blobContent.type).toBe('partners-export');
        expect(blobContent.version).toBe('1.0');
        expect(blobContent.data).toEqual(partners);
        expect(blobContent.exportDate).toBeDefined();
    });

    it('should call URL.createObjectURL with the Blob', () => {
        const capturedBlobs = [];
        const { PartnersImportExport, mockURL } = loadPartnersImportExport({
            cachedPartners: [{ id: 'p1', subagent: 'Test' }],
            blobCapture: capturedBlobs
        });

        PartnersImportExport.exportAsJSON();

        expect(mockURL.createObjectURL).toHaveBeenCalledOnce();
        expect(mockURL.createObjectURL).toHaveBeenCalledWith(capturedBlobs[0]);
    });

    it('should call URL.revokeObjectURL to free memory', () => {
        const { PartnersImportExport, mockURL } = loadPartnersImportExport({
            cachedPartners: [{ id: 'p1', subagent: 'Test' }]
        });

        PartnersImportExport.exportAsJSON();

        expect(mockURL.revokeObjectURL).toHaveBeenCalledOnce();
    });

    it('should include exportDate as valid ISO string', () => {
        const capturedBlobs = [];
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: [{ id: 'p1' }],
            blobCapture: capturedBlobs
        });

        PartnersImportExport.exportAsJSON();

        const blobContent = JSON.parse(capturedBlobs[0]._parts[0]);
        // ISO 8601 check
        expect(() => new Date(blobContent.exportDate)).not.toThrow();
        expect(new Date(blobContent.exportDate).toISOString()).toBe(blobContent.exportDate);
    });

    it('should export all partners in state.cachedPartners', () => {
        const partners = [
            { id: 'p1', subagent: 'A' },
            { id: 'p2', subagent: 'B' },
            { id: 'p3', subagent: 'C' }
        ];
        const capturedBlobs = [];
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: partners,
            blobCapture: capturedBlobs
        });

        PartnersImportExport.exportAsJSON();

        const blobContent = JSON.parse(capturedBlobs[0]._parts[0]);
        expect(blobContent.data).toHaveLength(3);
    });

    it('should export empty data array when no partners exist', () => {
        const capturedBlobs = [];
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: [],
            blobCapture: capturedBlobs
        });

        PartnersImportExport.exportAsJSON();

        const blobContent = JSON.parse(capturedBlobs[0]._parts[0]);
        expect(blobContent.data).toEqual([]);
    });
});

// ─────────────────────────────────────────────
// showExportDialog — guards
// ─────────────────────────────────────────────
describe('PartnersImportExport.showExportDialog', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should call Toast.warning and return early when no partners', () => {
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: [],
            toast: mockToast
        });

        PartnersImportExport.showExportDialog();

        expect(mockToast.warning).toHaveBeenCalledWith('Нет данных для экспорта');
    });

    it('should not call Toast.warning when partners exist', () => {
        // Set up minimal DOM required by showExportDialog
        document.body.innerHTML = `
            <div id="exportModal" class="modal">
                <select id="exportTemplateSelect"></select>
                <span id="exportCount"></span>
                <button class="import-type-btn" data-type="json"></button>
                <div id="jsonExportSection"></div>
                <div id="excelExportSection"></div>
            </div>
        `;
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: [{ id: 'p1', subagent: 'Alpha' }],
            toast: mockToast
        });

        PartnersImportExport.showExportDialog();

        expect(mockToast.warning).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────
// cancelImport
// ─────────────────────────────────────────────
describe('PartnersImportExport.cancelImport', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should remove active class from progress modal', () => {
        document.body.innerHTML = `<div id="importProgressModal" class="modal active"></div>`;
        const { PartnersImportExport } = loadPartnersImportExport();

        PartnersImportExport.cancelImport();

        const modal = document.getElementById('importProgressModal');
        expect(modal.classList.contains('active')).toBe(false);
    });

    it('should not throw when progress modal element is absent', () => {
        document.body.innerHTML = '';
        const { PartnersImportExport } = loadPartnersImportExport();
        expect(() => PartnersImportExport.cancelImport()).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// ignoreExtraColumns
// ─────────────────────────────────────────────
describe('PartnersImportExport.ignoreExtraColumns', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should set pendingExtraColumns to null', () => {
        document.body.innerHTML = `<div class="extra-columns-warning"></div>`;
        const { PartnersImportExport, state } = loadPartnersImportExport({
            pendingExtraColumns: ['Custom1', 'Custom2']
        });

        PartnersImportExport.ignoreExtraColumns();

        expect(state.pendingExtraColumns).toBeNull();
    });

    it('should remove the warning element from DOM', () => {
        document.body.innerHTML = `<div class="extra-columns-warning"></div>`;
        const { PartnersImportExport } = loadPartnersImportExport();

        PartnersImportExport.ignoreExtraColumns();

        expect(document.querySelector('.extra-columns-warning')).toBeNull();
    });

    it('should not throw when warning element is absent', () => {
        document.body.innerHTML = '';
        const { PartnersImportExport } = loadPartnersImportExport({
            pendingExtraColumns: ['X']
        });
        expect(() => PartnersImportExport.ignoreExtraColumns()).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// showImportProgress
// ─────────────────────────────────────────────
describe('PartnersImportExport.showImportProgress', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create the progress modal when it does not exist', () => {
        document.body.innerHTML = '';
        const { PartnersImportExport } = loadPartnersImportExport();

        PartnersImportExport.showImportProgress(5, 10, 'Импорт...');

        const modal = document.getElementById('importProgressModal');
        expect(modal).not.toBeNull();
    });

    it('should display correct progress count text (current / total)', () => {
        document.body.innerHTML = '';
        const { PartnersImportExport } = loadPartnersImportExport();

        PartnersImportExport.showImportProgress(3, 10, 'Загрузка');

        const countEl = document.getElementById('importProgressCount');
        expect(countEl.textContent).toBe('3 / 10 (30%)');
    });

    it('should display status text', () => {
        document.body.innerHTML = '';
        const { PartnersImportExport } = loadPartnersImportExport();

        PartnersImportExport.showImportProgress(0, 5, 'Подготовка...');

        const statusEl = document.getElementById('importProgressStatus');
        expect(statusEl.textContent).toBe('Подготовка...');
    });

    it('should show 0% when total is 0 (no division by zero)', () => {
        document.body.innerHTML = '';
        const { PartnersImportExport } = loadPartnersImportExport();

        PartnersImportExport.showImportProgress(0, 0, 'Старт');

        const countEl = document.getElementById('importProgressCount');
        expect(countEl.textContent).toBe('0 / 0 (0%)');
    });

    it('should show 100% when current equals total', () => {
        document.body.innerHTML = '';
        const { PartnersImportExport } = loadPartnersImportExport();

        PartnersImportExport.showImportProgress(10, 10, 'Готово');

        const countEl = document.getElementById('importProgressCount');
        expect(countEl.textContent).toBe('10 / 10 (100%)');
    });

    it('should reuse existing modal if it already exists', () => {
        document.body.innerHTML = `
            <div id="importProgressModal" class="modal">
                <div class="import-progress-status" id="importProgressStatus"></div>
                <div class="import-progress-bar-container">
                    <div class="import-progress-bar" id="importProgressBar"></div>
                </div>
                <div class="import-progress-count" id="importProgressCount"></div>
            </div>
        `;
        const { PartnersImportExport } = loadPartnersImportExport();

        PartnersImportExport.showImportProgress(2, 4, 'Продолжение');

        // Should only be one modal
        const modals = document.querySelectorAll('#importProgressModal');
        expect(modals).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────
// hideImportProgress
// ─────────────────────────────────────────────
describe('PartnersImportExport.hideImportProgress', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should remove active class from progress modal', () => {
        document.body.innerHTML = `<div id="importProgressModal" class="modal active"></div>`;
        const { PartnersImportExport } = loadPartnersImportExport();

        PartnersImportExport.hideImportProgress();

        const modal = document.getElementById('importProgressModal');
        expect(modal.classList.contains('active')).toBe(false);
    });

    it('should not throw when modal does not exist', () => {
        document.body.innerHTML = '';
        const { PartnersImportExport } = loadPartnersImportExport();
        expect(() => PartnersImportExport.hideImportProgress()).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// importData — core logic (without file reading)
// ─────────────────────────────────────────────
describe('PartnersImportExport.importData', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return early without error when pendingImportData is null', async () => {
        const { PartnersImportExport, mockToast } = loadPartnersImportExport({
            pendingImportData: null
        });

        await expect(PartnersImportExport.importData()).resolves.toBeUndefined();
        expect(mockToast.success).not.toHaveBeenCalled();
    });

    it('should add new partners to cachedPartners', async () => {
        // Provide minimal DOM for closeImportDialog and other UI calls
        document.body.innerHTML = `
            <div id="importModal" class="modal active"></div>
            <div id="importPreview"></div>
            <button id="importBtn"></button>
            <input id="importFileInput" value="" />
            <input id="importExcelInput" value="" />
            <label id="jsonFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
            <label id="excelFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
        `;
        const importData = [
            { subagent: 'Alpha', subagentId: 'SA-001', method: 'Crypto', dep: 100, with: 50, comp: 10, status: 'Открыт', avatar: '', customFields: {} }
        ];
        const { PartnersImportExport, state } = loadPartnersImportExport({
            cachedPartners: [],
            cachedMethods: [{ id: 'm1', name: 'Crypto' }],
            pendingImportData: importData
        });

        await PartnersImportExport.importData();

        // One new partner should have been pushed into cachedPartners
        expect(state.cachedPartners).toHaveLength(1);
        expect(state.cachedPartners[0].subagent).toBe('Alpha');
    });

    it('should update existing partner when key matches (subagent|subagentId|method)', async () => {
        document.body.innerHTML = `
            <div id="importModal" class="modal active"></div>
            <div id="importPreview"></div>
            <button id="importBtn"></button>
            <input id="importFileInput" value="" />
            <input id="importExcelInput" value="" />
            <label id="jsonFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
            <label id="excelFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
        `;
        const existingPartner = {
            id: 'existing_p1',
            subagent: 'Alpha',
            subagentId: 'SA-001',
            method: 'Crypto',
            deposits: 0, withdrawals: 0, compensation: 0,
            status: 'Открыт', avatar: '', customFields: {}
        };
        const importData = [
            { subagent: 'Alpha', subagentId: 'SA-001', method: 'Crypto', dep: 200, with: 100, comp: 20, status: 'Закрыт', avatar: '', customFields: {} }
        ];
        const { PartnersImportExport, state } = loadPartnersImportExport({
            cachedPartners: [existingPartner],
            cachedMethods: [{ id: 'm1', name: 'Crypto' }],
            pendingImportData: importData
        });

        await PartnersImportExport.importData();

        // No new partner should be added — existing one updated
        expect(state.cachedPartners).toHaveLength(1);
        expect(state.cachedPartners[0].id).toBe('existing_p1');
        expect(state.cachedPartners[0].status).toBe('Закрыт');
    });

    it('should add new methods from import when they do not exist', async () => {
        document.body.innerHTML = `
            <div id="importModal" class="modal active"></div>
            <div id="importPreview"></div>
            <button id="importBtn"></button>
            <input id="importFileInput" value="" />
            <input id="importExcelInput" value="" />
            <label id="jsonFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
            <label id="excelFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
        `;
        const importData = [
            { subagent: 'Beta', subagentId: 'SA-002', method: 'NewMethod', dep: 0, with: 0, comp: 0, status: 'Открыт', avatar: '', customFields: {} }
        ];
        const { PartnersImportExport, state } = loadPartnersImportExport({
            cachedPartners: [],
            cachedMethods: [],
            pendingImportData: importData
        });

        await PartnersImportExport.importData();

        // 'NewMethod' should have been added to cachedMethods with a temp ID
        const newMethod = state.cachedMethods.find(m => m.name === 'NewMethod');
        expect(newMethod).toBeDefined();
        expect(newMethod.id.startsWith('temp_method_')).toBe(true);
    });

    it('should not add duplicate methods (case-insensitive) during import', async () => {
        document.body.innerHTML = `
            <div id="importModal" class="modal active"></div>
            <div id="importPreview"></div>
            <button id="importBtn"></button>
            <input id="importFileInput" value="" />
            <input id="importExcelInput" value="" />
            <label id="jsonFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
            <label id="excelFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
        `;
        const importData = [
            { subagent: 'A', subagentId: 'SA-001', method: 'crypto', dep: 0, with: 0, comp: 0, status: 'Открыт', avatar: '', customFields: {} },
            { subagent: 'B', subagentId: 'SA-002', method: 'CRYPTO', dep: 0, with: 0, comp: 0, status: 'Открыт', avatar: '', customFields: {} }
        ];
        const { PartnersImportExport, state } = loadPartnersImportExport({
            cachedPartners: [],
            cachedMethods: [],
            pendingImportData: importData
        });

        await PartnersImportExport.importData();

        // Only one method entry for "crypto" (case-insensitive)
        const cryptoMethods = state.cachedMethods.filter(m => m.name.toLowerCase() === 'crypto');
        expect(cryptoMethods).toHaveLength(1);
    });

    it('should call Toast.success after successful import', async () => {
        document.body.innerHTML = `
            <div id="importModal" class="modal active"></div>
            <div id="importPreview"></div>
            <button id="importBtn"></button>
            <input id="importFileInput" value="" />
            <input id="importExcelInput" value="" />
            <label id="jsonFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
            <label id="excelFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
        `;
        const importData = [
            { subagent: 'Gamma', subagentId: 'SA-003', method: 'Card', dep: 0, with: 0, comp: 0, status: 'Открыт', avatar: '', customFields: {} }
        ];
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: [],
            cachedMethods: [{ id: 'm1', name: 'Card' }],
            pendingImportData: importData,
            toast: mockToast
        });

        await PartnersImportExport.importData();

        expect(mockToast.success).toHaveBeenCalledOnce();
        expect(mockToast.success.mock.calls[0][0]).toContain('Добавлено: 1');
    });

    it('should mark new partner as _synced: false', async () => {
        document.body.innerHTML = `
            <div id="importModal" class="modal active"></div>
            <div id="importPreview"></div>
            <button id="importBtn"></button>
            <input id="importFileInput" value="" />
            <input id="importExcelInput" value="" />
            <label id="jsonFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
            <label id="excelFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
        `;
        const importData = [
            { subagent: 'Delta', subagentId: 'SA-004', method: 'Wire', dep: 50, with: 0, comp: 0, status: 'Открыт', avatar: '', customFields: {} }
        ];
        const { PartnersImportExport, state } = loadPartnersImportExport({
            cachedPartners: [],
            cachedMethods: [{ id: 'm1', name: 'Wire' }],
            pendingImportData: importData
        });

        await PartnersImportExport.importData();

        expect(state.cachedPartners[0]._synced).toBe(false);
    });
});

// ─────────────────────────────────────────────
// removeDuplicates — logic
// ─────────────────────────────────────────────
describe('PartnersImportExport.removeDuplicates', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should call Toast.warning when no partners exist', async () => {
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: [],
            toast: mockToast
        });

        await PartnersImportExport.removeDuplicates();

        expect(mockToast.warning).toHaveBeenCalledWith('Нет партнёров');
    });

    it('should call Toast.info when no duplicates found', async () => {
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: [
                { id: 'p1', subagent: 'Alpha', subagentId: 'SA-001', method: 'Crypto' },
                { id: 'p2', subagent: 'Beta', subagentId: 'SA-002', method: 'Card' }
            ],
            toast: mockToast
        });

        await PartnersImportExport.removeDuplicates();

        expect(mockToast.info).toHaveBeenCalledWith('Дубликатов не найдено');
    });

    it('should detect duplicates by subagent+subagentId+method (case-insensitive)', async () => {
        document.body.innerHTML = `<div id="methodsList"></div>`;
        const partnersUtils = {
            escapeHtml: (t) => String(t),
            showError: vi.fn(),
            showLoading: vi.fn(),
            showConfirm: vi.fn().mockResolvedValue(false) // user cancels
        };
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: [
                { id: 'p1', subagent: 'Alpha', subagentId: 'SA-001', method: 'Crypto' },
                { id: 'p2', subagent: 'alpha', subagentId: 'SA-001', method: 'CRYPTO' } // duplicate
            ],
            toast: mockToast,
            partnersUtils
        });

        await PartnersImportExport.removeDuplicates();

        // showConfirm should be called because duplicates were found
        expect(partnersUtils.showConfirm).toHaveBeenCalledOnce();
        expect(partnersUtils.showConfirm.mock.calls[0][0]).toContain('1');
    });

    it('should remove duplicate partners from cachedPartners when user confirms', async () => {
        document.body.innerHTML = `
            <div id="importModal" class="modal active"></div>
            <div id="methodsList"></div>
        `;
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn(),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn(),
            deletePartner: vi.fn().mockResolvedValue({}),
            getImageUrl: vi.fn()
        };
        const partnersUtils = {
            escapeHtml: (t) => String(t),
            showError: vi.fn(),
            showLoading: vi.fn(),
            showConfirm: vi.fn().mockResolvedValue(true) // user confirms
        };
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersImportExport, state } = loadPartnersImportExport({
            cachedPartners: [
                { id: 'p1', subagent: 'Alpha', subagentId: 'SA-001', method: 'Crypto' },
                { id: 'p2', subagent: 'Alpha', subagentId: 'SA-001', method: 'Crypto' } // exact duplicate
            ],
            cloudStorage,
            toast: mockToast,
            partnersUtils
        });

        await PartnersImportExport.removeDuplicates();

        // p2 should have been deleted (it's the second occurrence)
        expect(cloudStorage.deletePartner).toHaveBeenCalledWith('p2');
        expect(state.cachedPartners).toHaveLength(1);
        expect(state.cachedPartners[0].id).toBe('p1');
    });

    it('should not delete anything when user cancels confirmation', async () => {
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn(),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn(),
            deletePartner: vi.fn(),
            getImageUrl: vi.fn()
        };
        const partnersUtils = {
            escapeHtml: (t) => String(t),
            showError: vi.fn(),
            showLoading: vi.fn(),
            showConfirm: vi.fn().mockResolvedValue(false) // user cancels
        };
        const { PartnersImportExport } = loadPartnersImportExport({
            cachedPartners: [
                { id: 'p1', subagent: 'A', subagentId: 'S1', method: 'M' },
                { id: 'p2', subagent: 'A', subagentId: 'S1', method: 'M' }
            ],
            cloudStorage,
            partnersUtils
        });

        await PartnersImportExport.removeDuplicates();

        expect(cloudStorage.deletePartner).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────
// setExportType — state mutation
// ─────────────────────────────────────────────
describe('PartnersImportExport.setExportType', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should set exportType on state to "json"', () => {
        document.body.innerHTML = `
            <div id="exportModal">
                <button class="import-type-btn" data-type="json"></button>
            </div>
            <div id="jsonExportSection"></div>
            <div id="excelExportSection"></div>
        `;
        const { PartnersImportExport, state } = loadPartnersImportExport({ exportType: 'excel' });
        PartnersImportExport.setExportType('json');
        expect(state.exportType).toBe('json');
    });

    it('should set exportType on state to "excel"', () => {
        document.body.innerHTML = `
            <div id="exportModal">
                <button class="import-type-btn" data-type="excel"></button>
            </div>
            <div id="jsonExportSection"></div>
            <div id="excelExportSection"></div>
            <select id="exportTemplateSelect"></select>
            <div id="exportPreviewInfo"></div>
        `;
        const { PartnersImportExport, state } = loadPartnersImportExport({ exportType: 'json' });
        PartnersImportExport.setExportType('excel');
        expect(state.exportType).toBe('excel');
    });

    it('should show jsonExportSection and hide excelExportSection for json type', () => {
        document.body.innerHTML = `
            <div id="exportModal">
                <button class="import-type-btn" data-type="json"></button>
            </div>
            <div id="jsonExportSection" class="hidden"></div>
            <div id="excelExportSection"></div>
        `;
        const { PartnersImportExport } = loadPartnersImportExport();
        PartnersImportExport.setExportType('json');
        expect(document.getElementById('jsonExportSection').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('excelExportSection').classList.contains('hidden')).toBe(true);
    });
});

// ─────────────────────────────────────────────
// setImportType — state mutation
// ─────────────────────────────────────────────
describe('PartnersImportExport.setImportType', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should set importType on state', () => {
        document.body.innerHTML = `
            <button class="import-type-btn" data-type="json"></button>
            <div id="jsonImportSection"></div>
            <div id="excelImportSection"></div>
            <input id="importFileInput" />
            <input id="importExcelInput" />
            <div id="importPreview"></div>
            <button id="importBtn"></button>
            <label id="jsonFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
            <label id="excelFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
        `;
        const { PartnersImportExport, state } = loadPartnersImportExport({ importType: 'excel' });
        PartnersImportExport.setImportType('json');
        expect(state.importType).toBe('json');
    });

    it('should clear pendingImportData when type changes', () => {
        document.body.innerHTML = `
            <button class="import-type-btn" data-type="json"></button>
            <div id="jsonImportSection"></div>
            <div id="excelImportSection"></div>
            <input id="importFileInput" />
            <input id="importExcelInput" />
            <div id="importPreview"></div>
            <button id="importBtn"></button>
            <label id="jsonFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
            <label id="excelFileLabel"><span class="main-text"></span><span class="sub-text"></span></label>
        `;
        const { PartnersImportExport, state } = loadPartnersImportExport({
            pendingImportData: [{ id: 'p1' }]
        });
        PartnersImportExport.setImportType('json');
        expect(state.pendingImportData).toBeNull();
    });
});

// ─────────────────────────────────────────────
// doExport — delegates to correct method
// ─────────────────────────────────────────────
describe('PartnersImportExport.doExport', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should call exportAsJSON when exportType is "json"', () => {
        document.body.innerHTML = `<div id="exportModal" class="modal active"></div>`;
        const capturedBlobs = [];
        const { PartnersImportExport } = loadPartnersImportExport({
            exportType: 'json',
            cachedPartners: [{ id: 'p1', subagent: 'Alpha' }],
            blobCapture: capturedBlobs
        });

        PartnersImportExport.doExport();

        // exportAsJSON creates a Blob
        expect(capturedBlobs).toHaveLength(1);
    });

    it('should call exportAsExcel when exportType is "excel"', () => {
        document.body.innerHTML = `<div id="exportModal" class="modal active"></div>`;
        const { PartnersImportExport, mockXLSX } = loadPartnersImportExport({
            exportType: 'excel',
            cachedPartners: [{ id: 'p1', subagent: 'Alpha' }]
        });

        PartnersImportExport.doExport();

        // exportAsExcel calls XLSX.writeFile
        expect(mockXLSX.writeFile).toHaveBeenCalledOnce();
    });
});
