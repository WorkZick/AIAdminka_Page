import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../partners/js/modules/partners-state.js'),
    'utf-8'
);

/**
 * PartnersState is a plain object literal assigned to a const.
 * We load it fresh per test via new Function, injecting a mock window.
 * Because it's a plain object (not an IIFE that attaches to window) we
 * return it directly from the function body.
 */
function loadPartnersState() {
    const mockWindow = {};
    const fn = new Function('window', `${code}\nreturn PartnersState;`);
    const state = fn(mockWindow);
    return state;
}

// ─────────────────────────────────────────────
// Initial values
// ─────────────────────────────────────────────
describe('PartnersState — initial values', () => {
    it('should have selectedPartnerId as null', () => {
        const state = loadPartnersState();
        expect(state.selectedPartnerId).toBeNull();
    });

    it('should have editingPartnerId as null', () => {
        const state = loadPartnersState();
        expect(state.editingPartnerId).toBeNull();
    });

    it('should have sortField as null', () => {
        const state = loadPartnersState();
        expect(state.sortField).toBeNull();
    });

    it('should have sortDirection as "asc"', () => {
        const state = loadPartnersState();
        expect(state.sortDirection).toBe('asc');
    });

    it('should have pendingImportData as null', () => {
        const state = loadPartnersState();
        expect(state.pendingImportData).toBeNull();
    });

    it('should have pendingExtraColumns as null', () => {
        const state = loadPartnersState();
        expect(state.pendingExtraColumns).toBeNull();
    });

    it('should have importType as "json"', () => {
        const state = loadPartnersState();
        expect(state.importType).toBe('json');
    });

    it('should have selectedImportTemplateId as null', () => {
        const state = loadPartnersState();
        expect(state.selectedImportTemplateId).toBeNull();
    });

    it('should have cachedPartners as empty array', () => {
        const state = loadPartnersState();
        expect(Array.isArray(state.cachedPartners)).toBe(true);
        expect(state.cachedPartners).toHaveLength(0);
    });

    it('should have cachedMethods as empty array', () => {
        const state = loadPartnersState();
        expect(Array.isArray(state.cachedMethods)).toBe(true);
        expect(state.cachedMethods).toHaveLength(0);
    });

    it('should have cachedTemplates as empty object', () => {
        const state = loadPartnersState();
        expect(typeof state.cachedTemplates).toBe('object');
        expect(Array.isArray(state.cachedTemplates)).toBe(false);
        expect(Object.keys(state.cachedTemplates)).toHaveLength(0);
    });

    it('should have isLoading as false', () => {
        const state = loadPartnersState();
        expect(state.isLoading).toBe(false);
    });

    it('should have isTemplateMode as false', () => {
        const state = loadPartnersState();
        expect(state.isTemplateMode).toBe(false);
    });

    it('should have editingTemplateId as null', () => {
        const state = loadPartnersState();
        expect(state.editingTemplateId).toBeNull();
    });

    it('should have currentTemplateId as null', () => {
        const state = loadPartnersState();
        expect(state.currentTemplateId).toBeNull();
    });

    it('should have templateFields as empty array', () => {
        const state = loadPartnersState();
        expect(Array.isArray(state.templateFields)).toBe(true);
        expect(state.templateFields).toHaveLength(0);
    });

    it('should have formStatus as "Открыт"', () => {
        const state = loadPartnersState();
        expect(state.formStatus).toBe('Открыт');
    });

    it('should have exportType as "json"', () => {
        const state = loadPartnersState();
        expect(state.exportType).toBe('json');
    });

    it('should have selectedExportTemplateId as null', () => {
        const state = loadPartnersState();
        expect(state.selectedExportTemplateId).toBeNull();
    });

    it('should have draggedColumnIndex as null', () => {
        const state = loadPartnersState();
        expect(state.draggedColumnIndex).toBeNull();
    });
});

// ─────────────────────────────────────────────
// cropData initial values
// ─────────────────────────────────────────────
describe('PartnersState.cropData — initial values', () => {
    it('should have scale = 1', () => {
        const state = loadPartnersState();
        expect(state.cropData.scale).toBe(1);
    });

    it('should have offsetX = 0', () => {
        const state = loadPartnersState();
        expect(state.cropData.offsetX).toBe(0);
    });

    it('should have offsetY = 0', () => {
        const state = loadPartnersState();
        expect(state.cropData.offsetY).toBe(0);
    });

    it('should have isDragging = false', () => {
        const state = loadPartnersState();
        expect(state.cropData.isDragging).toBe(false);
    });

    it('should have startX = 0', () => {
        const state = loadPartnersState();
        expect(state.cropData.startX).toBe(0);
    });

    it('should have startY = 0', () => {
        const state = loadPartnersState();
        expect(state.cropData.startY).toBe(0);
    });

    it('should have originalSrc = null', () => {
        const state = loadPartnersState();
        expect(state.cropData.originalSrc).toBeNull();
    });
});

// ─────────────────────────────────────────────
// getPartners()
// ─────────────────────────────────────────────
describe('PartnersState.getPartners()', () => {
    it('should return cachedPartners array (initially empty)', () => {
        const state = loadPartnersState();
        const result = state.getPartners();
        expect(result).toBe(state.cachedPartners);
        expect(result).toHaveLength(0);
    });

    it('should reflect mutations to cachedPartners', () => {
        const state = loadPartnersState();
        state.cachedPartners.push({ id: '1', subagent: 'Alpha' });
        expect(state.getPartners()).toHaveLength(1);
        expect(state.getPartners()[0].subagent).toBe('Alpha');
    });

    it('should return the same reference as cachedPartners', () => {
        const state = loadPartnersState();
        expect(state.getPartners()).toBe(state.cachedPartners);
    });

    it('should reflect replacement of cachedPartners array', () => {
        const state = loadPartnersState();
        state.cachedPartners = [{ id: 'p1' }, { id: 'p2' }];
        expect(state.getPartners()).toHaveLength(2);
    });
});

// ─────────────────────────────────────────────
// getMethods()
// ─────────────────────────────────────────────
describe('PartnersState.getMethods()', () => {
    it('should return cachedMethods array (initially empty)', () => {
        const state = loadPartnersState();
        const result = state.getMethods();
        expect(result).toBe(state.cachedMethods);
        expect(result).toHaveLength(0);
    });

    it('should reflect mutations to cachedMethods', () => {
        const state = loadPartnersState();
        state.cachedMethods.push({ id: 'm1', name: 'Crypto' });
        expect(state.getMethods()).toHaveLength(1);
        expect(state.getMethods()[0].name).toBe('Crypto');
    });

    it('should return the same reference as cachedMethods', () => {
        const state = loadPartnersState();
        expect(state.getMethods()).toBe(state.cachedMethods);
    });

    it('should reflect replacement of cachedMethods array', () => {
        const state = loadPartnersState();
        state.cachedMethods = [{ id: 'm1', name: 'A' }, { id: 'm2', name: 'B' }];
        expect(state.getMethods()).toHaveLength(2);
    });
});

// ─────────────────────────────────────────────
// State mutation
// ─────────────────────────────────────────────
describe('PartnersState — direct property mutation', () => {
    it('should allow setting selectedPartnerId', () => {
        const state = loadPartnersState();
        state.selectedPartnerId = 'p42';
        expect(state.selectedPartnerId).toBe('p42');
    });

    it('should allow setting sortField and sortDirection', () => {
        const state = loadPartnersState();
        state.sortField = 'subagent';
        state.sortDirection = 'desc';
        expect(state.sortField).toBe('subagent');
        expect(state.sortDirection).toBe('desc');
    });

    it('should allow setting isLoading flag', () => {
        const state = loadPartnersState();
        state.isLoading = true;
        expect(state.isLoading).toBe(true);
    });

    it('should allow setting pendingImportData', () => {
        const state = loadPartnersState();
        const data = [{ subagent: 'X', subagentId: 'S1', method: 'M1' }];
        state.pendingImportData = data;
        expect(state.pendingImportData).toEqual(data);
    });

    it('should allow replacing cropData fields', () => {
        const state = loadPartnersState();
        state.cropData.scale = 2.5;
        state.cropData.isDragging = true;
        expect(state.cropData.scale).toBe(2.5);
        expect(state.cropData.isDragging).toBe(true);
    });

    it('should allow setting cachedTemplates', () => {
        const state = loadPartnersState();
        const template = { id: 'tmpl1', name: 'Main', isDefault: true, fields: [] };
        state.cachedTemplates['tmpl1'] = template;
        expect(state.cachedTemplates['tmpl1']).toEqual(template);
    });

    it('should allow setting isTemplateMode to true', () => {
        const state = loadPartnersState();
        state.isTemplateMode = true;
        expect(state.isTemplateMode).toBe(true);
    });
});

// ─────────────────────────────────────────────
// State isolation between loads
// ─────────────────────────────────────────────
describe('PartnersState — isolation between loads', () => {
    it('each load should produce an independent state object', () => {
        const state1 = loadPartnersState();
        const state2 = loadPartnersState();

        state1.selectedPartnerId = 'mutated';
        expect(state2.selectedPartnerId).toBeNull();
    });

    it('mutations to cachedPartners in one instance should not affect another', () => {
        const state1 = loadPartnersState();
        const state2 = loadPartnersState();

        state1.cachedPartners.push({ id: 'p99' });
        expect(state2.cachedPartners).toHaveLength(0);
    });
});
