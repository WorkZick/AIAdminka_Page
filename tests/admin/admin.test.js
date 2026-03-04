/**
 * Unit-тесты для admin/js/admin.js
 *
 * Покрываемые функции:
 *   - escapeHtml(str)
 *   - getInitials(name)
 *   - loadUserData()          — читает localStorage['cloud-auth']
 *   - addAuditLog(...)        — добавляет запись в mockData.auditLog
 *   - mockApiCall(action,...) — Mock API (getAdminData, createTeam, updateUser, …)
 *   - USE_MOCK_API flag       — production значение false
 *   - actionNames / moduleNames — справочники
 *   - destroy()               — очистка обработчиков
 *   - pagination расчёт       — usersPage / usersPerPage логика
 *   - role key regex          — /^[a-z][a-z0-9_]{0,19}$/
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const adminCode = readFileSync(
    resolve(__dirname, '../../admin/js/admin.js'),
    'utf-8'
);

// ---------------------------------------------------------------------------
// Загрузчик модуля
// Паттерн: читаем исходный файл, оборачиваем в Function с моками зависимостей,
// возвращаем объект adminApp через return — до вызова PageLifecycle.init.
// ---------------------------------------------------------------------------

function buildMocks(overrides = {}) {
    const mockLocalStorage = (() => {
        let store = {};
        return {
            getItem: vi.fn((key) => store[key] ?? null),
            setItem: vi.fn((key, val) => { store[key] = String(val); }),
            removeItem: vi.fn((key) => { delete store[key]; }),
            clear: vi.fn(() => { store = {}; }),
            _store: store,
            _set(key, val) { store[key] = val; }
        };
    })();

    const mockDocument = {
        getElementById: vi.fn(() => null),
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(() => ({ forEach: vi.fn() })),
        createElement: vi.fn((tag) => ({
            tagName: tag.toUpperCase(),
            className: '',
            id: '',
            innerHTML: '',
            textContent: '',
            dataset: {},
            style: {},
            children: [],
            classList: {
                _classes: new Set(),
                add(...args) { args.forEach(c => this._classes.add(c)); },
                remove(...args) { args.forEach(c => this._classes.delete(c)); },
                toggle(c, force) {
                    if (force === undefined) {
                        this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c);
                    } else {
                        force ? this._classes.add(c) : this._classes.delete(c);
                    }
                },
                contains(c) { return this._classes.has(c); }
            },
            appendChild: vi.fn(),
            addEventListener: vi.fn(),
            click: vi.fn(),
            insertBefore: vi.fn(),
            querySelector: vi.fn(() => null),
            querySelectorAll: vi.fn(() => [])
        })),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        body: {
            appendChild: vi.fn()
        }
    };

    const mockWindow = {
        ADMIN_MOCK_DATA: undefined,
        ...overrides.window
    };

    const mockCloudStorage = {
        callApi: vi.fn().mockResolvedValue({ error: 'mock disabled' }),
        ...overrides.CloudStorage
    };

    const mockPageLifecycle = {
        init: vi.fn(),
        ...overrides.PageLifecycle
    };

    const mockRolesConfig = {
        ALL_ROLES: ['admin', 'leader', 'sales', 'guest'],
        ASSIGNABLE_ROLES: ['sales', 'leader'],
        getName: vi.fn((role) => role),
        getDefaultName: vi.fn((role) => role),
        getColor: vi.fn(() => '#000000'),
        isCustomRole: vi.fn(() => false),
        isSystemRole: vi.fn((role) => role === 'admin' || role === 'guest'),
        _customRoles: [],
        _defaults: { names: {}, descriptions: {}, colors: {} },
        _rebuildRoleLists: vi.fn(),
        applyOverrides: vi.fn(),
        getFullConfig: vi.fn(() => ({})),
        ...overrides.RolesConfig
    };

    const mockRoleGuard = {
        isAdmin: vi.fn(() => true),
        hasRole: vi.fn(() => false),
        canManageRole: vi.fn(() => true),
        getAssignableRoles: vi.fn(() => ['sales', 'leader']),
        getAssignablePermissions: vi.fn(() => null),
        user: { teamId: null },
        ...overrides.RoleGuard
    };

    const mockToast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        ...overrides.Toast
    };

    return {
        localStorage: mockLocalStorage,
        document: mockDocument,
        window: mockWindow,
        CloudStorage: mockCloudStorage,
        PageLifecycle: mockPageLifecycle,
        RolesConfig: mockRolesConfig,
        RoleGuard: mockRoleGuard,
        Toast: mockToast
    };
}

/**
 * Загрузить adminApp с чистыми моками.
 * PageLifecycle.init перехватывается — adminApp возвращается через return
 * до того как скрипт попытается вызвать init().
 */
function loadAdminApp(overrides = {}) {
    const mocks = buildMocks(overrides);

    // Модифицируем код: убираем вызов PageLifecycle.init внизу файла,
    // добавляем явный return adminApp
    const patchedCode = adminCode
        // Убираем блок инициализации PageLifecycle.init(...) в конце
        .replace(
            /\/\/ Initialize via PageLifecycle[\s\S]*$/,
            'return adminApp;'
        );

    const fn = new Function(
        'window',
        'document',
        'localStorage',
        'CloudStorage',
        'PageLifecycle',
        'RolesConfig',
        'RoleGuard',
        'Toast',
        'console',
        patchedCode
    );

    const adminApp = fn(
        mocks.window,
        mocks.document,
        mocks.localStorage,
        mocks.CloudStorage,
        mocks.PageLifecycle,
        mocks.RolesConfig,
        mocks.RoleGuard,
        mocks.Toast,
        console
    );

    return { adminApp, mocks };
}

// ===========================================================================
// 1. escapeHtml
// ===========================================================================

describe('adminApp.escapeHtml — HTML экранирование', () => {
    it('should escape ampersand', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should escape less-than sign', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('should escape greater-than sign', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml('a>b')).toBe('a&gt;b');
    });

    it('should escape double quotes', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('should escape single quotes', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('should escape all special chars in one string', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml('<script>alert("xss&\'")</script>'))
            .toBe('&lt;script&gt;alert(&quot;xss&amp;&#39;&quot;)&lt;/script&gt;');
    });

    it('should return empty string for null', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml('')).toBe('');
    });

    it('should coerce numbers to string', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml(42)).toBe('42');
    });

    it('should not modify plain safe text', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml('Hello World')).toBe('Hello World');
    });

    it('should handle string with multiple & chars', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
    });
});

// ===========================================================================
// 2. getInitials
// ===========================================================================

describe('adminApp.getInitials — инициалы', () => {
    it('should return two uppercase initials for two-word name', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.getInitials('Ivan Petrov')).toBe('IP');
    });

    it('should take first two chars for single word name', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.getInitials('Olga')).toBe('OL');
    });

    it('should return ? for empty string', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.getInitials('')).toBe('?');
    });

    it('should return ? for null', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.getInitials(null)).toBe('?');
    });

    it('should return ? for undefined', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.getInitials(undefined)).toBe('?');
    });

    it('should handle extra spaces between words', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.getInitials('Anna   Smirnova')).toBe('AS');
    });

    it('should return uppercase even for lowercase input', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.getInitials('john doe')).toBe('JD');
    });

    it('should use first two words only even for three-word name', () => {
        const { adminApp } = loadAdminApp();
        const result = adminApp.getInitials('Ivan Ivanovich Petrov');
        expect(result).toBe('II');
    });
});

// ===========================================================================
// 3. loadUserData — читает localStorage['cloud-auth']
// ===========================================================================

describe('adminApp.loadUserData — загрузка пользователя из localStorage', () => {
    it('should set currentUser from valid cloud-auth JSON', () => {
        const { adminApp, mocks } = loadAdminApp();
        mocks.localStorage._set('cloud-auth', JSON.stringify({
            email: 'admin@test.com',
            name: 'Admin User',
            picture: 'https://example.com/pic.jpg'
        }));

        adminApp.loadUserData();

        expect(adminApp.currentUser).not.toBeNull();
        expect(adminApp.currentUser.email).toBe('admin@test.com');
        expect(adminApp.currentUser.name).toBe('Admin User');
        expect(adminApp.currentUser.picture).toBe('https://example.com/pic.jpg');
    });

    it('should leave currentUser as null if localStorage is empty', () => {
        const { adminApp } = loadAdminApp();
        adminApp.loadUserData();
        expect(adminApp.currentUser).toBeNull();
    });

    it('should not throw and not set currentUser for invalid JSON', () => {
        const { adminApp, mocks } = loadAdminApp();
        mocks.localStorage._set('cloud-auth', 'NOT_VALID_JSON{{{');

        expect(() => adminApp.loadUserData()).not.toThrow();
        expect(adminApp.currentUser).toBeNull();
    });

    it('should not throw for null stored value', () => {
        const { adminApp, mocks } = loadAdminApp();
        mocks.localStorage.getItem.mockReturnValue(null);

        expect(() => adminApp.loadUserData()).not.toThrow();
        expect(adminApp.currentUser).toBeNull();
    });

    it('should set only email/name/picture fields on currentUser', () => {
        const { adminApp, mocks } = loadAdminApp();
        mocks.localStorage._set('cloud-auth', JSON.stringify({
            email: 'x@y.com',
            name: 'X Y',
            picture: '',
            role: 'admin',        // лишнее поле — не должно попасть в currentUser
            token: 'secret-token' // лишнее поле
        }));

        adminApp.loadUserData();

        expect(Object.keys(adminApp.currentUser)).toEqual(['email', 'name', 'picture']);
    });

    it('should handle missing name and picture gracefully', () => {
        const { adminApp, mocks } = loadAdminApp();
        mocks.localStorage._set('cloud-auth', JSON.stringify({ email: 'a@b.com' }));

        adminApp.loadUserData();

        expect(adminApp.currentUser.email).toBe('a@b.com');
        expect(adminApp.currentUser.name).toBeUndefined();
        expect(adminApp.currentUser.picture).toBeUndefined();
    });
});

// ===========================================================================
// 4. USE_MOCK_API — production-значение
// ===========================================================================

describe('adminApp.USE_MOCK_API — production flag', () => {
    it('should be false in production build', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.USE_MOCK_API).toBe(false);
    });

    it('should be a boolean', () => {
        const { adminApp } = loadAdminApp();
        expect(typeof adminApp.USE_MOCK_API).toBe('boolean');
    });
});

// ===========================================================================
// 5. addAuditLog — добавление записей в аудит-лог
// ===========================================================================

describe('adminApp.addAuditLog — запись событий аудита', () => {
    it('should add entry to mockData.auditLog', () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.auditLog = [];

        adminApp.addAuditLog('user_approved', 'user@test.com', 'team-1', '', 'approved');

        expect(adminApp.mockData.auditLog).toHaveLength(1);
    });

    it('should prepend (unshift) new entries so newest is first', () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.auditLog = [];

        adminApp.addAuditLog('user_approved', 'first@test.com', '', '', '');
        adminApp.addAuditLog('user_rejected', 'second@test.com', '', '', '');

        expect(adminApp.mockData.auditLog[0].action).toBe('user_rejected');
        expect(adminApp.mockData.auditLog[1].action).toBe('user_approved');
    });

    it('should store all passed fields in the entry', () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.auditLog = [];
        adminApp.currentUser = { email: 'admin@company.com' };

        adminApp.addAuditLog('role_changed', 'emp@test.com', 'team-2', 'sales', 'leader');

        const entry = adminApp.mockData.auditLog[0];
        expect(entry.action).toBe('role_changed');
        expect(entry.targetEmail).toBe('emp@test.com');
        expect(entry.targetTeamId).toBe('team-2');
        expect(entry.oldValue).toBe('sales');
        expect(entry.newValue).toBe('leader');
        expect(entry.actorEmail).toBe('admin@company.com');
    });

    it('should use fallback actor email when currentUser is null', () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.auditLog = [];
        adminApp.currentUser = null;

        adminApp.addAuditLog('team_created', '', 'team-99', '', 'New Team');

        expect(adminApp.mockData.auditLog[0].actorEmail).toBe('admin@example.com');
    });

    it('should assign id and timestamp to entry', () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.auditLog = [];

        adminApp.addAuditLog('permissions_changed', '', '', '', '');

        const entry = adminApp.mockData.auditLog[0];
        expect(typeof entry.id).toBe('string');
        expect(entry.id).toMatch(/^log-/);
        expect(typeof entry.timestamp).toBe('string');
        expect(() => new Date(entry.timestamp)).not.toThrow();
    });
});

// ===========================================================================
// 6. mockApiCall — Mock API (синхронная логика без await delay)
// ===========================================================================

describe('adminApp.mockApiCall — Mock API логика', () => {
    it('getAdminData should return teams/users/requests/permissions/auditLog copies', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData = {
            teams: [{ id: 't1', name: 'Alpha' }],
            users: [{ email: 'u@u.com' }],
            requests: [],
            permissions: { sales: { partners: { view: true } } },
            auditLog: []
        };

        const result = await adminApp.mockApiCall('getAdminData');

        expect(result.success).toBe(true);
        expect(result.teams).toHaveLength(1);
        expect(result.teams[0].name).toBe('Alpha');
        // Должна быть копия, а не ссылка
        expect(result.teams).not.toBe(adminApp.mockData.teams);
    });

    it('createTeam should add team to mockData.teams', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.teams = [];
        adminApp.mockData.auditLog = [];
        adminApp.currentUser = { email: 'admin@x.com' };

        const result = await adminApp.mockApiCall('createTeam', {
            name: 'Beta',
            leaderEmail: 'leader@x.com'
        });

        expect(result.success).toBe(true);
        expect(typeof result.teamId).toBe('string');
        expect(adminApp.mockData.teams).toHaveLength(1);
        expect(adminApp.mockData.teams[0].name).toBe('Beta');
    });

    it('updateTeam should return error when team not found', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.teams = [];

        const result = await adminApp.mockApiCall('updateTeam', { teamId: 'nonexistent' });

        expect(result.error).toBeDefined();
    });

    it('updateTeam should update existing team fields', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.teams = [{ id: 'team-1', name: 'Old Name', isActive: true }];
        adminApp.mockData.auditLog = [];

        const result = await adminApp.mockApiCall('updateTeam', {
            teamId: 'team-1',
            name: 'New Name',
            isActive: false
        });

        expect(result.success).toBe(true);
        expect(adminApp.mockData.teams[0].name).toBe('New Name');
        expect(adminApp.mockData.teams[0].isActive).toBe(false);
    });

    it('updateUser should return error when user not found', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.users = [];

        const result = await adminApp.mockApiCall('updateUser', { targetEmail: 'ghost@x.com' });

        expect(result.error).toBeDefined();
    });

    it('updateUser should update role and status', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.users = [{ email: 'u@x.com', role: 'sales', status: 'active', teamId: '' }];
        adminApp.mockData.auditLog = [];
        adminApp.currentUser = { email: 'admin@x.com' };

        const result = await adminApp.mockApiCall('updateUser', {
            targetEmail: 'u@x.com',
            teamId: 'team-5',
            role: 'leader',
            status: 'active'
        });

        expect(result.success).toBe(true);
        expect(adminApp.mockData.users[0].role).toBe('leader');
        expect(adminApp.mockData.users[0].teamId).toBe('team-5');
    });

    it('approveRequest should move request to users and remove from requests', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.requests = [{
            id: 'req-1',
            email: 'new@x.com',
            name: 'New User',
            reddyId: 'R001',
            picture: ''
        }];
        adminApp.mockData.users = [];
        adminApp.mockData.auditLog = [];
        adminApp.currentUser = { email: 'admin@x.com' };

        const result = await adminApp.mockApiCall('approveRequest', { requestId: 'req-1' });

        expect(result.success).toBe(true);
        expect(adminApp.mockData.requests).toHaveLength(0);
        expect(adminApp.mockData.users).toHaveLength(1);
        expect(adminApp.mockData.users[0].email).toBe('new@x.com');
    });

    it('approveRequest should return error for unknown request', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.requests = [];

        const result = await adminApp.mockApiCall('approveRequest', { requestId: 'no-such-id' });

        expect(result.error).toBeDefined();
    });

    it('rejectRequest should remove request and add audit entry', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.requests = [{
            id: 'req-2',
            email: 'rej@x.com'
        }];
        adminApp.mockData.auditLog = [];
        adminApp.currentUser = { email: 'admin@x.com' };

        const result = await adminApp.mockApiCall('rejectRequest', { requestId: 'req-2' });

        expect(result.success).toBe(true);
        expect(adminApp.mockData.requests).toHaveLength(0);
        expect(adminApp.mockData.auditLog[0].action).toBe('user_rejected');
    });

    it('savePermissions should save deep copy to mockData', async () => {
        const { adminApp } = loadAdminApp();
        adminApp.mockData.permissions = {};
        adminApp.mockData.auditLog = [];
        adminApp.currentUser = { email: 'admin@x.com' };

        const permissions = { sales: { partners: { view: true, edit: false, delete: false } } };
        const result = await adminApp.mockApiCall('savePermissions', { permissions });

        expect(result.success).toBe(true);
        expect(adminApp.mockData.permissions.sales.partners.view).toBe(true);
        // Должна быть копия
        expect(adminApp.mockData.permissions).not.toBe(permissions);
    });

    it('unknown action should return error', async () => {
        const { adminApp } = loadAdminApp();

        const result = await adminApp.mockApiCall('nonExistentAction', {});

        expect(result.error).toBeDefined();
        expect(result.error).toContain('Unknown action');
    });
});

// ===========================================================================
// 7. apiCall — роутинг: mock vs real
// ===========================================================================

describe('adminApp.apiCall — роутинг запросов', () => {
    it('should call CloudStorage.callApi when USE_MOCK_API is false', async () => {
        const { adminApp, mocks } = loadAdminApp();
        adminApp.USE_MOCK_API = false;
        mocks.CloudStorage.callApi.mockResolvedValue({ success: true, data: [] });

        await adminApp.apiCall('getAdminData', {});

        expect(mocks.CloudStorage.callApi).toHaveBeenCalledWith('getAdminData', {});
    });

    it('should NOT call CloudStorage when USE_MOCK_API is true', async () => {
        const { adminApp, mocks } = loadAdminApp();
        adminApp.USE_MOCK_API = true;
        adminApp.mockData = {
            teams: [], users: [], requests: [], permissions: {}, auditLog: []
        };

        await adminApp.apiCall('getAdminData', {});

        expect(mocks.CloudStorage.callApi).not.toHaveBeenCalled();
    });

    it('should return error object if CloudStorage throws', async () => {
        const { adminApp, mocks } = loadAdminApp();
        adminApp.USE_MOCK_API = false;
        mocks.CloudStorage.callApi.mockRejectedValue(new Error('Network error'));

        const result = await adminApp.apiCall('getAdminData', {});

        expect(result.error).toBe('Network error');
    });
});

// ===========================================================================
// 8. Role key validation regex
// ===========================================================================

describe('Role key validation — /^[a-z][a-z0-9_]{0,19}$/', () => {
    const ROLE_KEY_REGEX = /^[a-z][a-z0-9_]{0,19}$/;

    // Valid cases
    it('should accept simple lowercase key', () => {
        expect(ROLE_KEY_REGEX.test('sales')).toBe(true);
    });

    it('should accept key with underscore', () => {
        expect(ROLE_KEY_REGEX.test('partner_mgr')).toBe(true);
    });

    it('should accept key with digits', () => {
        expect(ROLE_KEY_REGEX.test('role2')).toBe(true);
    });

    it('should accept single char key', () => {
        expect(ROLE_KEY_REGEX.test('a')).toBe(true);
    });

    it('should accept exactly 20 chars key', () => {
        expect(ROLE_KEY_REGEX.test('a' + 'b'.repeat(19))).toBe(true);
    });

    // Invalid cases
    it('should reject key starting with digit', () => {
        expect(ROLE_KEY_REGEX.test('1sales')).toBe(false);
    });

    it('should reject key starting with underscore', () => {
        expect(ROLE_KEY_REGEX.test('_sales')).toBe(false);
    });

    it('should reject key with uppercase letters', () => {
        expect(ROLE_KEY_REGEX.test('Sales')).toBe(false);
    });

    it('should reject key longer than 20 chars', () => {
        expect(ROLE_KEY_REGEX.test('a' + 'b'.repeat(20))).toBe(false);
    });

    it('should reject empty string', () => {
        expect(ROLE_KEY_REGEX.test('')).toBe(false);
    });

    it('should reject key with spaces', () => {
        expect(ROLE_KEY_REGEX.test('my role')).toBe(false);
    });

    it('should reject key with dash', () => {
        expect(ROLE_KEY_REGEX.test('my-role')).toBe(false);
    });

    it('should reject key with special characters', () => {
        expect(ROLE_KEY_REGEX.test('role@admin')).toBe(false);
    });
});

// ===========================================================================
// 9. destroy — очистка обработчиков событий
// ===========================================================================

describe('adminApp.destroy — очистка обработчиков', () => {
    it('should null out _inputHandler after destroy', () => {
        const { adminApp } = loadAdminApp();
        adminApp._inputHandler = vi.fn();
        adminApp._changeHandler = vi.fn();
        adminApp._clickHandler = vi.fn();

        adminApp.destroy();

        expect(adminApp._inputHandler).toBeNull();
    });

    it('should null out _changeHandler after destroy', () => {
        const { adminApp } = loadAdminApp();
        adminApp._inputHandler = vi.fn();
        adminApp._changeHandler = vi.fn();
        adminApp._clickHandler = vi.fn();

        adminApp.destroy();

        expect(adminApp._changeHandler).toBeNull();
    });

    it('should null out _clickHandler after destroy', () => {
        const { adminApp } = loadAdminApp();
        adminApp._inputHandler = vi.fn();
        adminApp._changeHandler = vi.fn();
        adminApp._clickHandler = vi.fn();

        adminApp.destroy();

        expect(adminApp._clickHandler).toBeNull();
    });

    it('should null out _paginationCallbacks after destroy', () => {
        const { adminApp } = loadAdminApp();
        adminApp._paginationCallbacks = { 'pag-1': vi.fn() };

        adminApp.destroy();

        expect(adminApp._paginationCallbacks).toBeNull();
    });

    it('should call document.removeEventListener for each handler', () => {
        const { adminApp, mocks } = loadAdminApp();
        const inputFn = vi.fn();
        const changeFn = vi.fn();
        const clickFn = vi.fn();
        adminApp._inputHandler = inputFn;
        adminApp._changeHandler = changeFn;
        adminApp._clickHandler = clickFn;

        adminApp.destroy();

        expect(mocks.document.removeEventListener).toHaveBeenCalledWith('input', inputFn);
        expect(mocks.document.removeEventListener).toHaveBeenCalledWith('change', changeFn);
        expect(mocks.document.removeEventListener).toHaveBeenCalledWith('click', clickFn);
    });

    it('should not throw if handlers are already null', () => {
        const { adminApp } = loadAdminApp();
        adminApp._inputHandler = null;
        adminApp._changeHandler = null;
        adminApp._clickHandler = null;

        expect(() => adminApp.destroy()).not.toThrow();
    });
});

// ===========================================================================
// 10. Pagination logic — usersPage / usersPerPage
// ===========================================================================

describe('adminApp — pagination state logic', () => {
    it('should have initial usersPage = 1', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.usersPage).toBe(1);
    });

    it('should have initial usersPerPage = 10', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.usersPerPage).toBe(10);
    });

    it('should have initial auditPage = 1', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.auditPage).toBe(1);
    });

    it('should have initial auditPerPage = 15', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.auditPerPage).toBe(15);
    });

    it('totalPages formula: ceil(items / perPage) should be correct for 25 items / 10 perPage', () => {
        const totalItems = 25;
        const perPage = 10;
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
        expect(totalPages).toBe(3);
    });

    it('totalPages formula: should return 1 for empty list', () => {
        const totalPages = Math.max(1, Math.ceil(0 / 10));
        expect(totalPages).toBe(1);
    });

    it('totalPages formula: exact division should not add extra page', () => {
        const totalPages = Math.max(1, Math.ceil(20 / 10));
        expect(totalPages).toBe(2);
    });

    it('page slice: should return correct window for page 2, perPage 10, 25 items', () => {
        const page = 2;
        const perPage = 10;
        const items = Array.from({ length: 25 }, (_, i) => i + 1);
        const start = (page - 1) * perPage;
        const pageItems = items.slice(start, start + perPage);
        expect(pageItems).toHaveLength(10);
        expect(pageItems[0]).toBe(11);
        expect(pageItems[9]).toBe(20);
    });

    it('page slice: last page may have fewer items', () => {
        const page = 3;
        const perPage = 10;
        const items = Array.from({ length: 25 }, (_, i) => i + 1);
        const start = (page - 1) * perPage;
        const pageItems = items.slice(start, start + perPage);
        expect(pageItems).toHaveLength(5);
    });
});

// ===========================================================================
// 11. Static state / справочники
// ===========================================================================

describe('adminApp — initial state and dictionaries', () => {
    it('should have currentTab = "teams" by default', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.currentTab).toBe('teams');
    });

    it('should have empty teams array by default', () => {
        const { adminApp } = loadAdminApp();
        expect(Array.isArray(adminApp.teams)).toBe(true);
        expect(adminApp.teams).toHaveLength(0);
    });

    it('should have empty users array by default', () => {
        const { adminApp } = loadAdminApp();
        expect(Array.isArray(adminApp.users)).toBe(true);
        expect(adminApp.users).toHaveLength(0);
    });

    it('should have empty requests array by default', () => {
        const { adminApp } = loadAdminApp();
        expect(Array.isArray(adminApp.requests)).toBe(true);
        expect(adminApp.requests).toHaveLength(0);
    });

    it('actionNames should contain user_approved entry', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.actionNames['user_approved']).toBeDefined();
        expect(typeof adminApp.actionNames['user_approved']).toBe('string');
    });

    it('actionNames should contain role_changed entry', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.actionNames['role_changed']).toBeDefined();
    });

    it('moduleNames should have entry for "partners"', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.moduleNames['partners']).toBeDefined();
        expect(typeof adminApp.moduleNames['partners']).toBe('string');
    });

    it('modules array should contain "partners"', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.modules).toContain('partners');
    });

    it('modules array should contain all 8 expected modules', () => {
        const { adminApp } = loadAdminApp();
        const expected = [
            'partners', 'partner-onboarding', 'team-info', 'traffic',
            'reports', 'settings', 'documentation', 'team-management'
        ];
        expected.forEach(m => expect(adminApp.modules).toContain(m));
    });

    it('editingUser should be null by default', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.editingUser).toBeNull();
    });

    it('editingTeam should be null by default', () => {
        const { adminApp } = loadAdminApp();
        expect(adminApp.editingTeam).toBeNull();
    });
});
