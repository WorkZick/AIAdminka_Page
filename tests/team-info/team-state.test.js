import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const teamStateCode = readFileSync(
    resolve(__dirname, '../../team-info/js/modules/team-state.js'),
    'utf-8'
);

/**
 * TeamState depends on RolesConfig (external global).
 * We inject a mock RolesConfig into the function scope via the window object.
 * The module assigns itself to a const — we return it directly.
 */
function loadTeamState({ mockRolesConfig, withoutRolesConfig } = {}) {
    const defaultMockRolesConfig = {
        ASSIGNABLE_ROLES: ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'],
        getNameMap(roles) {
            const map = {};
            const names = {
                assistant: 'Помощник руководителя',
                sales: 'Менеджер по продажам',
                partners_mgr: 'Менеджер по партнёрам',
                payments: 'Менеджер платежей',
                antifraud: 'Антифрод',
                tech: 'Техспециалист'
            };
            (roles || []).forEach(r => { map[r] = names[r] || r; });
            return map;
        }
    };

    const fn = new Function(
        'RolesConfig',
        `${teamStateCode}\nreturn TeamState;`
    );

    if (withoutRolesConfig) {
        // Call without argument so typeof RolesConfig === 'undefined' inside the module
        return fn();
    }

    const rc = mockRolesConfig !== undefined ? mockRolesConfig : defaultMockRolesConfig;
    return fn(rc);
}

// ─────────────────────────────────────────────
// Initial values — primitive fields
// ─────────────────────────────────────────────
describe('TeamState — initial values (primitives)', () => {
    it('should have data as empty array', () => {
        const state = loadTeamState();
        expect(Array.isArray(state.data)).toBe(true);
        expect(state.data).toHaveLength(0);
    });

    it('should have currentEmployeeId as null', () => {
        const state = loadTeamState();
        expect(state.currentEmployeeId).toBeNull();
    });

    it('should have sortField as null', () => {
        const state = loadTeamState();
        expect(state.sortField).toBeNull();
    });

    it('should have sortDirection as "asc"', () => {
        const state = loadTeamState();
        expect(state.sortDirection).toBe('asc');
    });

    it('should have teamName as "Моя команда"', () => {
        const state = loadTeamState();
        expect(state.teamName).toBe('Моя команда');
    });

    it('should have formChanged as false', () => {
        const state = loadTeamState();
        expect(state.formChanged).toBe(false);
    });

    it('should have originalFormData as null', () => {
        const state = loadTeamState();
        expect(state.originalFormData).toBeNull();
    });

    it('should have currentFormStatus as "Работает"', () => {
        const state = loadTeamState();
        expect(state.currentFormStatus).toBe('Работает');
    });

    it('should have isDeleteMode as false', () => {
        const state = loadTeamState();
        expect(state.isDeleteMode).toBe(false);
    });

    it('should have navigationStack as empty array', () => {
        const state = loadTeamState();
        expect(Array.isArray(state.navigationStack)).toBe(true);
        expect(state.navigationStack).toHaveLength(0);
    });

    it('should have tempImageData as null', () => {
        const state = loadTeamState();
        expect(state.tempImageData).toBeNull();
    });

    it('should have currentAvatar as null', () => {
        const state = loadTeamState();
        expect(state.currentAvatar).toBeNull();
    });

    it('should have isDragging as false', () => {
        const state = loadTeamState();
        expect(state.isDragging).toBe(false);
    });

    it('should have currentInviteType as "guests"', () => {
        const state = loadTeamState();
        expect(state.currentInviteType).toBe('guests');
    });

    it('should have pendingInvites as empty array', () => {
        const state = loadTeamState();
        expect(Array.isArray(state.pendingInvites)).toBe(true);
        expect(state.pendingInvites).toHaveLength(0);
    });

    it('should have availableGuests as empty array', () => {
        const state = loadTeamState();
        expect(Array.isArray(state.availableGuests)).toBe(true);
        expect(state.availableGuests).toHaveLength(0);
    });

    it('should have selectedGuestEmail as null', () => {
        const state = loadTeamState();
        expect(state.selectedGuestEmail).toBeNull();
    });

    it('should have selectedRole as null', () => {
        const state = loadTeamState();
        expect(state.selectedRole).toBeNull();
    });

    it('should have availableTeams as empty array', () => {
        const state = loadTeamState();
        expect(Array.isArray(state.availableTeams)).toBe(true);
        expect(state.availableTeams).toHaveLength(0);
    });

    it('should have selectedTeamId as null', () => {
        const state = loadTeamState();
        expect(state.selectedTeamId).toBeNull();
    });

    it('should have isTemplateMode as false', () => {
        const state = loadTeamState();
        expect(state.isTemplateMode).toBe(false);
    });

    it('should have editingTemplateId as null', () => {
        const state = loadTeamState();
        expect(state.editingTemplateId).toBeNull();
    });

    it('should have templateFields as empty array', () => {
        const state = loadTeamState();
        expect(Array.isArray(state.templateFields)).toBe(true);
        expect(state.templateFields).toHaveLength(0);
    });

    it('should have eventHandlers as empty object', () => {
        const state = loadTeamState();
        expect(typeof state.eventHandlers).toBe('object');
        expect(state.eventHandlers).not.toBeNull();
        expect(Object.keys(state.eventHandlers)).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────
// Initial values — nested objects
// ─────────────────────────────────────────────
describe('TeamState.cropSettings — initial values', () => {
    it('should have scale = 1', () => {
        const state = loadTeamState();
        expect(state.cropSettings.scale).toBe(1);
    });

    it('should have posX = 0', () => {
        const state = loadTeamState();
        expect(state.cropSettings.posX).toBe(0);
    });

    it('should have posY = 0', () => {
        const state = loadTeamState();
        expect(state.cropSettings.posY).toBe(0);
    });
});

describe('TeamState.dragStart — initial values', () => {
    it('should have x = 0', () => {
        const state = loadTeamState();
        expect(state.dragStart.x).toBe(0);
    });

    it('should have y = 0', () => {
        const state = loadTeamState();
        expect(state.dragStart.y).toBe(0);
    });
});

// ─────────────────────────────────────────────
// assignableRoles getter
// ─────────────────────────────────────────────
describe('TeamState.assignableRoles (getter)', () => {
    it('should return name map from RolesConfig when RolesConfig is defined', () => {
        const state = loadTeamState();
        const roles = state.assignableRoles;
        expect(typeof roles).toBe('object');
        expect(roles).not.toBeNull();
        expect(roles.assistant).toBe('Помощник руководителя');
        expect(roles.sales).toBe('Менеджер по продажам');
        expect(roles.tech).toBe('Техспециалист');
    });

    it('should include all default assignable roles', () => {
        const state = loadTeamState();
        const roles = state.assignableRoles;
        expect(Object.keys(roles)).toHaveLength(6);
        ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'].forEach(key => {
            expect(roles).toHaveProperty(key);
        });
    });

    it('should return empty object when RolesConfig is not provided', () => {
        const state = loadTeamState({ withoutRolesConfig: true });
        const roles = state.assignableRoles;
        expect(roles).toEqual({});
    });

    it('should call RolesConfig.getNameMap with ASSIGNABLE_ROLES list', () => {
        let capturedRoles = null;
        const spyRolesConfig = {
            ASSIGNABLE_ROLES: ['sales', 'tech'],
            getNameMap(roles) {
                capturedRoles = roles;
                return { sales: 'Продажи', tech: 'Тех' };
            }
        };
        const state = loadTeamState({ mockRolesConfig: spyRolesConfig });
        state.assignableRoles; // trigger getter
        expect(capturedRoles).toEqual(['sales', 'tech']);
    });
});

// ─────────────────────────────────────────────
// sortBy()
// ─────────────────────────────────────────────
describe('TeamState.sortBy()', () => {
    it('should set sortField on first call', () => {
        const state = loadTeamState();
        state.sortBy('name');
        expect(state.sortField).toBe('name');
        expect(state.sortDirection).toBe('asc');
    });

    it('should toggle sortDirection to desc on second call with same field', () => {
        const state = loadTeamState();
        state.sortBy('name');
        state.sortBy('name');
        expect(state.sortDirection).toBe('desc');
    });

    it('should toggle sortDirection back to asc on third call', () => {
        const state = loadTeamState();
        state.sortBy('name');
        state.sortBy('name');
        state.sortBy('name');
        expect(state.sortDirection).toBe('asc');
    });

    it('should reset sortDirection to asc when switching to a different field', () => {
        const state = loadTeamState();
        state.sortBy('name');
        state.sortBy('name'); // now desc
        state.sortBy('status'); // switch field — should reset to asc
        expect(state.sortField).toBe('status');
        expect(state.sortDirection).toBe('asc');
    });

    it('should sort data by name ascending', () => {
        const state = loadTeamState();
        state.data = [
            { fullName: 'Зайцев Пётр' },
            { fullName: 'Алексеев Иван' },
            { fullName: 'Морозов Сергей' }
        ];
        state.sortBy('name');
        expect(state.data[0].fullName).toBe('Алексеев Иван');
        expect(state.data[1].fullName).toBe('Зайцев Пётр');
        expect(state.data[2].fullName).toBe('Морозов Сергей');
    });

    it('should sort data by name descending on second call', () => {
        const state = loadTeamState();
        state.data = [
            { fullName: 'Зайцев Пётр' },
            { fullName: 'Алексеев Иван' },
            { fullName: 'Морозов Сергей' }
        ];
        state.sortBy('name');
        state.sortBy('name');
        expect(state.data[0].fullName).toBe('Морозов Сергей');
        expect(state.data[2].fullName).toBe('Алексеев Иван');
    });

    it('should sort data by status ascending', () => {
        const state = loadTeamState();
        state.data = [
            { fullName: 'Б', status: 'Уволен' },
            { fullName: 'А', status: 'Болеет' },
            { fullName: 'В', status: 'Работает' }
        ];
        state.sortBy('status');
        expect(state.data[0].status).toBe('Болеет');
        expect(state.data[1].status).toBe('Работает');
        expect(state.data[2].status).toBe('Уволен');
    });

    it('should treat missing fullName as empty string when sorting by name', () => {
        const state = loadTeamState();
        state.data = [
            { fullName: 'Яковлев' },
            {},
            { fullName: 'Андреев' }
        ];
        state.sortBy('name');
        expect(state.data[0].fullName).toBeUndefined(); // empty string sorts first
        expect(state.data[1].fullName).toBe('Андреев');
        expect(state.data[2].fullName).toBe('Яковлев');
    });

    it('should treat missing status as "Работает" when sorting by status', () => {
        const state = loadTeamState();
        state.data = [
            { fullName: 'А', status: 'Уволен' },
            { fullName: 'Б' } // no status — defaults to 'Работает'
        ];
        state.sortBy('status');
        expect(state.data[0].fullName).toBe('Б'); // Работает < Уволен
    });

    it('should not throw when data array is empty', () => {
        const state = loadTeamState();
        expect(() => state.sortBy('name')).not.toThrow();
        expect(state.data).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────
// Direct property mutation
// ─────────────────────────────────────────────
describe('TeamState — direct property mutation', () => {
    it('should allow setting currentEmployeeId', () => {
        const state = loadTeamState();
        state.currentEmployeeId = 'emp-42';
        expect(state.currentEmployeeId).toBe('emp-42');
    });

    it('should allow pushing to data array', () => {
        const state = loadTeamState();
        state.data.push({ id: '1', fullName: 'Иванов Иван' });
        expect(state.data).toHaveLength(1);
    });

    it('should allow setting formChanged', () => {
        const state = loadTeamState();
        state.formChanged = true;
        expect(state.formChanged).toBe(true);
    });

    it('should allow setting isDeleteMode', () => {
        const state = loadTeamState();
        state.isDeleteMode = true;
        expect(state.isDeleteMode).toBe(true);
    });

    it('should allow mutating cropSettings', () => {
        const state = loadTeamState();
        state.cropSettings.scale = 2.5;
        state.cropSettings.posX = 100;
        expect(state.cropSettings.scale).toBe(2.5);
        expect(state.cropSettings.posX).toBe(100);
    });

    it('should allow setting isTemplateMode', () => {
        const state = loadTeamState();
        state.isTemplateMode = true;
        expect(state.isTemplateMode).toBe(true);
    });

    it('should allow pushing to navigationStack', () => {
        const state = loadTeamState();
        state.navigationStack.push('list');
        state.navigationStack.push('detail');
        expect(state.navigationStack).toHaveLength(2);
        expect(state.navigationStack[1]).toBe('detail');
    });
});

// ─────────────────────────────────────────────
// State isolation between loads
// ─────────────────────────────────────────────
describe('TeamState — isolation between loads', () => {
    it('each load should produce an independent state object', () => {
        const state1 = loadTeamState();
        const state2 = loadTeamState();

        state1.currentEmployeeId = 'mutated';
        expect(state2.currentEmployeeId).toBeNull();
    });

    it('mutations to data in one instance should not affect another', () => {
        const state1 = loadTeamState();
        const state2 = loadTeamState();

        state1.data.push({ id: '99' });
        expect(state2.data).toHaveLength(0);
    });

    it('mutations to cropSettings in one instance should not affect another', () => {
        const state1 = loadTeamState();
        const state2 = loadTeamState();

        state1.cropSettings.scale = 5;
        expect(state2.cropSettings.scale).toBe(1);
    });
});
