import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../partners/js/modules/partners-methods.js'),
    'utf-8'
);

/**
 * Factory: loads PartnersMethods with all external dependencies injected.
 * Returns the object together with the mocks so tests can spy on calls.
 */
function loadPartnersMethods({
    cachedMethods = [],
    cachedPartners = [],
    cloudStorage = null,
    toast = null,
    partnersUtils = null,
    // Extra modules referenced in saveEditMethod
    partnersForms = null,
    partnersRenderer = null
} = {}) {
    const state = {
        cachedMethods: [...cachedMethods],
        cachedPartners: [...cachedPartners],
        getPartners() { return this.cachedPartners; },
        getMethods() { return this.cachedMethods; }
    };

    const mockToast = toast ?? {
        error: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
        info: vi.fn()
    };

    const mockCloudStorage = cloudStorage ?? {
        getMethods: vi.fn().mockResolvedValue([]),
        addMethod: vi.fn().mockResolvedValue({ id: 'new_id' }),
        deleteMethod: vi.fn().mockResolvedValue({}),
        updateMethod: vi.fn().mockResolvedValue({}),
        getPartners: vi.fn().mockResolvedValue([]),
        updatePartner: vi.fn().mockResolvedValue({})
    };

    const mockPartnersUtils = partnersUtils ?? {
        escapeHtml: (text) => String(text),
        showError: vi.fn(),
        showLoading: vi.fn()
    };

    // Stub out modules that are referenced inside saveEditMethod but are out of scope
    const mockPartnersForms = partnersForms ?? {
        syncPartnersToLocalStorage: vi.fn()
    };

    const mockPartnersRenderer = partnersRenderer ?? {
        render: vi.fn()
    };

    // PartnersMethods references these globals directly — inject via new Function
    const fn = new Function(
        'PartnersState', 'CloudStorage', 'Toast', 'PartnersUtils',
        'PartnersForms', 'PartnersRenderer', 'document',
        `${code}\nreturn PartnersMethods;`
    );

    const methods = fn(
        state,
        mockCloudStorage,
        mockToast,
        mockPartnersUtils,
        mockPartnersForms,
        mockPartnersRenderer,
        document
    );

    return { PartnersMethods: methods, state, mockToast, mockCloudStorage, mockPartnersUtils };
}

// Helper: creates a minimal DOM structure needed for addMethod / deleteMethod
function setupMethodsDOM({ inputValue = '', methodId = null } = {}) {
    document.body.innerHTML = `
        <input id="newMethodInput" value="${inputValue}" />
        <div id="methodsList"></div>
        <span id="methodsCountBadge"></span>
        ${methodId ? `<button data-action="partners-addMethod"></button>` : ''}
        ${methodId ? `<button data-action="partners-deleteMethod" data-method-id="${methodId}"></button>` : ''}
    `;
}

function teardownDOM() {
    document.body.innerHTML = '';
}

// ─────────────────────────────────────────────
// loadMethods
// ─────────────────────────────────────────────
describe('PartnersMethods.loadMethods', () => {
    it('should call CloudStorage.getMethods and return its result', async () => {
        const expectedMethods = [{ id: 'm1', name: 'Crypto' }, { id: 'm2', name: 'Card' }];
        const cloudStorage = {
            getMethods: vi.fn().mockResolvedValue(expectedMethods),
            addMethod: vi.fn(),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods, state } = loadPartnersMethods({ cloudStorage });

        const result = await PartnersMethods.loadMethods();

        expect(cloudStorage.getMethods).toHaveBeenCalledOnce();
        expect(result).toEqual(expectedMethods);
        expect(state.cachedMethods).toEqual(expectedMethods);
    });

    it('should update PartnersState.cachedMethods with the returned data', async () => {
        const methods = [{ id: 'm1', name: 'Bank Transfer' }];
        const cloudStorage = {
            getMethods: vi.fn().mockResolvedValue(methods),
            addMethod: vi.fn(),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods, state } = loadPartnersMethods({ cloudStorage });

        await PartnersMethods.loadMethods();

        expect(state.cachedMethods).toHaveLength(1);
        expect(state.cachedMethods[0].name).toBe('Bank Transfer');
    });

    it('should return empty array when CloudStorage returns nothing', async () => {
        const cloudStorage = {
            getMethods: vi.fn().mockResolvedValue([]),
            addMethod: vi.fn(),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods, state } = loadPartnersMethods({ cloudStorage });

        const result = await PartnersMethods.loadMethods();

        expect(result).toEqual([]);
        expect(state.cachedMethods).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────
// updateMethodsCount
// ─────────────────────────────────────────────
describe('PartnersMethods.updateMethodsCount', () => {
    beforeEach(() => {
        document.body.innerHTML = `<span id="methodsCountBadge"></span>`;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should set badge text to current methods count', () => {
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [{ id: 'm1', name: 'A' }, { id: 'm2', name: 'B' }]
        });
        PartnersMethods.updateMethodsCount();
        expect(document.getElementById('methodsCountBadge').textContent).toBe('2');
    });

    it('should show 0 when no methods', () => {
        const { PartnersMethods } = loadPartnersMethods({ cachedMethods: [] });
        PartnersMethods.updateMethodsCount();
        expect(document.getElementById('methodsCountBadge').textContent).toBe('0');
    });

    it('should not throw when badge element is missing', () => {
        document.body.innerHTML = ''; // no badge
        const { PartnersMethods } = loadPartnersMethods();
        expect(() => PartnersMethods.updateMethodsCount()).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// addMethod
// ─────────────────────────────────────────────
describe('PartnersMethods.addMethod', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should call Toast.warning and not call CloudStorage if input is empty', async () => {
        setupMethodsDOM({ inputValue: '' });
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn(),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods } = loadPartnersMethods({ toast: mockToast, cloudStorage });

        await PartnersMethods.addMethod();

        expect(mockToast.warning).toHaveBeenCalledOnce();
        expect(cloudStorage.addMethod).not.toHaveBeenCalled();
    });

    it('should call Toast.warning if method with same name already exists (case-insensitive)', async () => {
        setupMethodsDOM({ inputValue: 'crypto' });
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn(),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [{ id: 'm1', name: 'Crypto' }],
            toast: mockToast,
            cloudStorage
        });

        await PartnersMethods.addMethod();

        expect(mockToast.warning).toHaveBeenCalledWith('Метод с таким названием уже существует');
        expect(cloudStorage.addMethod).not.toHaveBeenCalled();
    });

    it('should call CloudStorage.addMethod with new method name', async () => {
        setupMethodsDOM({ inputValue: 'Wire Transfer' });
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn().mockResolvedValue({ id: 'new_id_123' }),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [],
            cloudStorage
        });

        await PartnersMethods.addMethod();

        expect(cloudStorage.addMethod).toHaveBeenCalledWith({ name: 'Wire Transfer' });
    });

    it('should push new method into cachedMethods after successful add', async () => {
        setupMethodsDOM({ inputValue: 'PayPal' });
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn().mockResolvedValue({ id: 'paypal_id' }),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods, state } = loadPartnersMethods({
            cachedMethods: [],
            cloudStorage
        });

        await PartnersMethods.addMethod();

        expect(state.cachedMethods).toHaveLength(1);
        expect(state.cachedMethods[0].id).toBe('paypal_id');
        expect(state.cachedMethods[0].name).toBe('PayPal');
    });

    it('should clear input after successful add', async () => {
        setupMethodsDOM({ inputValue: 'Skrill' });
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn().mockResolvedValue({ id: 'skrill_id' }),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods } = loadPartnersMethods({ cloudStorage });

        await PartnersMethods.addMethod();

        expect(document.getElementById('newMethodInput').value).toBe('');
    });

    it('should call showError when CloudStorage.addMethod throws', async () => {
        setupMethodsDOM({ inputValue: 'Neteller' });
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn().mockRejectedValue(new Error('Network error')),
            deleteMethod: vi.fn(),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const partnersUtils = {
            escapeHtml: (t) => String(t),
            showError: vi.fn(),
            showLoading: vi.fn()
        };
        const { PartnersMethods } = loadPartnersMethods({ cloudStorage, partnersUtils });

        await PartnersMethods.addMethod();

        expect(partnersUtils.showError).toHaveBeenCalledOnce();
        expect(partnersUtils.showError.mock.calls[0][0]).toContain('Network error');
    });
});

// ─────────────────────────────────────────────
// deleteMethod
// ─────────────────────────────────────────────
describe('PartnersMethods.deleteMethod', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should call CloudStorage.deleteMethod with the method ID', async () => {
        document.body.innerHTML = `
            <div id="methodsList"></div>
            <span id="methodsCountBadge"></span>
        `;
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn(),
            deleteMethod: vi.fn().mockResolvedValue({}),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [{ id: 'm1', name: 'Crypto' }],
            cloudStorage
        });

        await PartnersMethods.deleteMethod('m1');

        expect(cloudStorage.deleteMethod).toHaveBeenCalledWith('m1');
    });

    it('should remove deleted method from cachedMethods', async () => {
        document.body.innerHTML = `
            <div id="methodsList"></div>
            <span id="methodsCountBadge"></span>
        `;
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn(),
            deleteMethod: vi.fn().mockResolvedValue({}),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const { PartnersMethods, state } = loadPartnersMethods({
            cachedMethods: [{ id: 'm1', name: 'Crypto' }, { id: 'm2', name: 'Card' }],
            cloudStorage
        });

        await PartnersMethods.deleteMethod('m1');

        expect(state.cachedMethods).toHaveLength(1);
        expect(state.cachedMethods[0].id).toBe('m2');
    });

    it('should call Toast.success after successful delete', async () => {
        document.body.innerHTML = `
            <div id="methodsList"></div>
            <span id="methodsCountBadge"></span>
        `;
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn(),
            deleteMethod: vi.fn().mockResolvedValue({}),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [{ id: 'm1', name: 'Crypto' }],
            cloudStorage,
            toast: mockToast
        });

        await PartnersMethods.deleteMethod('m1');

        expect(mockToast.success).toHaveBeenCalledWith('Метод удален');
    });

    it('should refresh methods from cloud when "Method not found" error is thrown', async () => {
        document.body.innerHTML = `
            <div id="methodsList"></div>
            <span id="methodsCountBadge"></span>
        `;
        const freshMethods = [{ id: 'm2', name: 'Card' }];
        const cloudStorage = {
            getMethods: vi.fn().mockResolvedValue(freshMethods),
            addMethod: vi.fn(),
            deleteMethod: vi.fn().mockRejectedValue(new Error('Method not found')),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const mockToast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersMethods, state } = loadPartnersMethods({
            cachedMethods: [{ id: 'm1', name: 'Old' }],
            cloudStorage,
            toast: mockToast
        });

        await PartnersMethods.deleteMethod('m1');

        expect(cloudStorage.getMethods).toHaveBeenCalled();
        expect(state.cachedMethods).toEqual(freshMethods);
        expect(mockToast.warning).toHaveBeenCalledOnce();
    });

    it('should call showError for non-"not found" errors', async () => {
        document.body.innerHTML = `
            <div id="methodsList"></div>
            <span id="methodsCountBadge"></span>
        `;
        const cloudStorage = {
            getMethods: vi.fn(),
            addMethod: vi.fn(),
            deleteMethod: vi.fn().mockRejectedValue(new Error('Internal server error')),
            updateMethod: vi.fn(),
            getPartners: vi.fn(),
            updatePartner: vi.fn()
        };
        const partnersUtils = {
            escapeHtml: (t) => String(t),
            showError: vi.fn(),
            showLoading: vi.fn()
        };
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [{ id: 'm1', name: 'Crypto' }],
            cloudStorage,
            partnersUtils
        });

        await PartnersMethods.deleteMethod('m1');

        expect(partnersUtils.showError).toHaveBeenCalledOnce();
        expect(partnersUtils.showError.mock.calls[0][0]).toContain('Internal server error');
    });
});

// ─────────────────────────────────────────────
// renderMethodsList
// ─────────────────────────────────────────────
describe('PartnersMethods.renderMethodsList', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should render empty state HTML when no methods', () => {
        document.body.innerHTML = `<div id="methodsList"></div>`;
        const { PartnersMethods } = loadPartnersMethods({ cachedMethods: [] });
        PartnersMethods.renderMethodsList();
        const container = document.getElementById('methodsList');
        expect(container.innerHTML).toContain('Нет методов');
    });

    it('should render a list item for each method', () => {
        document.body.innerHTML = `<div id="methodsList"></div>`;
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [
                { id: 'm1', name: 'Crypto' },
                { id: 'm2', name: 'Card' }
            ]
        });
        PartnersMethods.renderMethodsList();
        const items = document.querySelectorAll('.method-item');
        expect(items).toHaveLength(2);
    });

    it('should include method name in rendered HTML', () => {
        document.body.innerHTML = `<div id="methodsList"></div>`;
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [{ id: 'm1', name: 'Wire Transfer' }]
        });
        PartnersMethods.renderMethodsList();
        const container = document.getElementById('methodsList');
        expect(container.innerHTML).toContain('Wire Transfer');
    });

    it('should include method id in data attributes', () => {
        document.body.innerHTML = `<div id="methodsList"></div>`;
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [{ id: 'method_abc', name: 'PayPal' }]
        });
        PartnersMethods.renderMethodsList();
        const item = document.querySelector('[data-method-id="method_abc"]');
        expect(item).not.toBeNull();
    });
});

// ─────────────────────────────────────────────
// populateMethodsSelect
// ─────────────────────────────────────────────
describe('PartnersMethods.populateMethodsSelect', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should populate select with method options', () => {
        document.body.innerHTML = `<select id="formMethod"></select>`;
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [
                { id: 'm1', name: 'Crypto' },
                { id: 'm2', name: 'Card' }
            ]
        });
        PartnersMethods.populateMethodsSelect();
        const select = document.getElementById('formMethod');
        // 1 placeholder + 2 methods
        expect(select.options).toHaveLength(3);
    });

    it('should include a placeholder "Выберите метод" as first option', () => {
        document.body.innerHTML = `<select id="formMethod"></select>`;
        const { PartnersMethods } = loadPartnersMethods({ cachedMethods: [] });
        PartnersMethods.populateMethodsSelect();
        const select = document.getElementById('formMethod');
        expect(select.options[0].textContent).toBe('Выберите метод');
    });

    it('should pre-select the option matching selectedValue', () => {
        document.body.innerHTML = `<select id="formMethod"></select>`;
        const { PartnersMethods } = loadPartnersMethods({
            cachedMethods: [
                { id: 'm1', name: 'Crypto' },
                { id: 'm2', name: 'Card' }
            ]
        });
        PartnersMethods.populateMethodsSelect('Card');
        const select = document.getElementById('formMethod');
        expect(select.value).toBe('Card');
    });

    it('should not throw when formMethod element does not exist', () => {
        document.body.innerHTML = '';
        const { PartnersMethods } = loadPartnersMethods();
        expect(() => PartnersMethods.populateMethodsSelect()).not.toThrow();
    });
});
