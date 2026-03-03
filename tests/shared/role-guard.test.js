import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '../../shared/role-guard.js'), 'utf-8');

/**
 * Загружаем RoleGuard с мокнутым localStorage.
 * RoleGuard содержит IIFE при загрузке которая чистит кеш —
 * передаём контролируемый localStorage чтобы избежать побочных эффектов.
 */
function loadRoleGuard(initialStorage = {}) {
    const store = { ...initialStorage };
    const mockLocalStorage = {
        getItem(key) { return key in store ? store[key] : null; },
        setItem(key, value) { store[key] = value; },
        removeItem(key) { delete store[key]; },
        _getStore() { return store; }
    };

    // document нужен для applyUI и initDOMObserver
    const mockDocument = {
        querySelectorAll() { return []; },
        addEventListener() {},
        removeEventListener() {},
        body: {
            classList: { add() {}, contains() { return false; } }
        }
    };

    const fn = new Function(
        'localStorage', 'document', 'console', 'module', 'Date', 'JSON', 'MutationObserver',
        `${code}\nreturn RoleGuard;`
    );

    // MutationObserver нужен initDOMObserver — передаём заглушку
    const MockMutationObserver = class {
        observe() {}
        disconnect() {}
    };

    return {
        RoleGuard: fn(
            mockLocalStorage,
            mockDocument,
            console,
            { exports: {} },
            Date,
            JSON,
            MockMutationObserver
        ),
        mockLocalStorage
    };
}

describe('RoleGuard', () => {
    describe('constants', () => {
        it('STALE_MAX_AGE should equal 600000 (10 minutes)', () => {
            const { RoleGuard } = loadRoleGuard();
            expect(RoleGuard.STALE_MAX_AGE).toBe(600000);
        });

        it('CACHE_TTL should equal 300000 (5 minutes)', () => {
            const { RoleGuard } = loadRoleGuard();
            expect(RoleGuard.CACHE_TTL).toBe(300000);
        });

        it('CACHE_KEY should be "roleGuard"', () => {
            const { RoleGuard } = loadRoleGuard();
            expect(RoleGuard.CACHE_KEY).toBe('roleGuard');
        });
    });

    describe('setCache() and getCache()', () => {
        it('should save data to localStorage via setCache', () => {
            const { RoleGuard, mockLocalStorage } = loadRoleGuard();
            const data = {
                user: { email: 'user@test.com', role: 'admin' },
                permissions: { partners: { canView: true, canEdit: true, canDelete: true } },
                pendingRequestsCount: 0
            };

            RoleGuard.setCache(data);

            const raw = mockLocalStorage.getItem('roleGuard');
            expect(raw).not.toBeNull();

            const parsed = JSON.parse(raw);
            expect(parsed.user.email).toBe('user@test.com');
            expect(parsed.user.role).toBe('admin');
            expect(parsed.timestamp).toBeDefined();
            expect(typeof parsed.timestamp).toBe('number');
        });

        it('should save timestamp to localStorage', () => {
            const { RoleGuard, mockLocalStorage } = loadRoleGuard();
            const before = Date.now();
            RoleGuard.setCache({ user: { role: 'admin' }, permissions: {}, pendingRequestsCount: 0 });
            const after = Date.now();

            const parsed = JSON.parse(mockLocalStorage.getItem('roleGuard'));
            expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
            expect(parsed.timestamp).toBeLessThanOrEqual(after);
        });

        it('getCache() should return null when localStorage is empty', () => {
            const { RoleGuard } = loadRoleGuard();
            expect(RoleGuard.getCache()).toBeNull();
        });

        it('getCache() should return parsed data for fresh cache', () => {
            const { RoleGuard } = loadRoleGuard();
            const userData = { email: 'admin@test.com', role: 'admin' };
            RoleGuard.setCache({
                user: userData,
                permissions: {},
                pendingRequestsCount: 0
            });

            const cached = RoleGuard.getCache();
            expect(cached).not.toBeNull();
            expect(cached.user.email).toBe('admin@test.com');
        });

        it('getCache() should return null and remove stale cache (>TTL)', () => {
            const staleTimestamp = Date.now() - 400000; // 400 сек — больше TTL 300 сек
            const staleData = JSON.stringify({
                user: { email: 'old@test.com', role: 'sales' },
                permissions: {},
                pendingRequestsCount: 0,
                timestamp: staleTimestamp
            });

            const { RoleGuard, mockLocalStorage } = loadRoleGuard({
                roleGuard: staleData
            });

            const result = RoleGuard.getCache();
            expect(result).toBeNull();
            // Кеш должен быть удалён
            expect(mockLocalStorage.getItem('roleGuard')).toBeNull();
        });
    });

    describe('_loadFromCache (getCache)', () => {
        it('should load user data from localStorage for fresh cache', () => {
            const freshTimestamp = Date.now() - 10000; // 10 сек назад — свежий
            const cacheData = JSON.stringify({
                user: { email: 'leader@test.com', role: 'leader' },
                permissions: { partners: { canView: true, canEdit: true, canDelete: false } },
                pendingRequestsCount: 2,
                timestamp: freshTimestamp
            });

            const { RoleGuard } = loadRoleGuard({ roleGuard: cacheData });

            const cached = RoleGuard.getCache();
            expect(cached).not.toBeNull();
            expect(cached.user.role).toBe('leader');
            expect(cached.permissions.partners.canView).toBe(true);
            expect(cached.pendingRequestsCount).toBe(2);
        });

        it('should return null for malformed JSON in localStorage', () => {
            const { RoleGuard } = loadRoleGuard({ roleGuard: 'invalid-json{{{' });
            expect(RoleGuard.getCache()).toBeNull();
        });
    });

    describe('_saveToCache (setCache)', () => {
        it('should persist permissions in localStorage', () => {
            const { RoleGuard, mockLocalStorage } = loadRoleGuard();
            const permissions = {
                partners: { canView: true, canEdit: false, canDelete: false },
                traffic: { canView: true, canEdit: true, canDelete: true }
            };

            RoleGuard.setCache({ user: { role: 'sales' }, permissions, pendingRequestsCount: 0 });

            const saved = JSON.parse(mockLocalStorage.getItem('roleGuard'));
            expect(saved.permissions.partners.canView).toBe(true);
            expect(saved.permissions.partners.canEdit).toBe(false);
            expect(saved.permissions.traffic.canDelete).toBe(true);
        });

        it('should overwrite previous cache on repeated setCache calls', () => {
            const { RoleGuard, mockLocalStorage } = loadRoleGuard();

            RoleGuard.setCache({ user: { role: 'sales' }, permissions: {}, pendingRequestsCount: 0 });
            RoleGuard.setCache({ user: { role: 'admin' }, permissions: {}, pendingRequestsCount: 5 });

            const saved = JSON.parse(mockLocalStorage.getItem('roleGuard'));
            expect(saved.user.role).toBe('admin');
            expect(saved.pendingRequestsCount).toBe(5);
        });
    });

    describe('getStaleCache()', () => {
        it('should return null when localStorage is empty', () => {
            const { RoleGuard } = loadRoleGuard();
            expect(RoleGuard.getStaleCache()).toBeNull();
        });

        it('should return null for fresh cache (within TTL)', () => {
            const freshTimestamp = Date.now() - 10000; // 10 сек назад — свежий
            const cacheData = JSON.stringify({
                user: { role: 'admin' },
                permissions: {},
                pendingRequestsCount: 0,
                timestamp: freshTimestamp
            });

            const { RoleGuard } = loadRoleGuard({ roleGuard: cacheData });
            // Свежий кеш — getStaleCache должен вернуть null (обработает getCache)
            expect(RoleGuard.getStaleCache()).toBeNull();
        });

        it('should return stale data for cache between TTL and STALE_MAX_AGE', () => {
            // 400 сек назад: больше TTL (300 сек), меньше STALE_MAX_AGE (600 сек)
            const staleTimestamp = Date.now() - 400000;
            const cacheData = JSON.stringify({
                user: { email: 'stale@test.com', role: 'leader' },
                permissions: {},
                pendingRequestsCount: 0,
                timestamp: staleTimestamp
            });

            const { RoleGuard } = loadRoleGuard({ roleGuard: cacheData });
            const stale = RoleGuard.getStaleCache();
            expect(stale).not.toBeNull();
            expect(stale.user.email).toBe('stale@test.com');
        });

        it('should return null and remove cache older than STALE_MAX_AGE', () => {
            // 700 сек назад — старше STALE_MAX_AGE (600 сек)
            const veryOldTimestamp = Date.now() - 700000;
            const cacheData = JSON.stringify({
                user: { role: 'admin' },
                permissions: {},
                pendingRequestsCount: 0,
                timestamp: veryOldTimestamp
            });

            const { RoleGuard, mockLocalStorage } = loadRoleGuard({ roleGuard: cacheData });
            const result = RoleGuard.getStaleCache();
            expect(result).toBeNull();
            // Кеш должен быть удалён
            expect(mockLocalStorage.getItem('roleGuard')).toBeNull();
        });

        it('should return null for malformed JSON', () => {
            const { RoleGuard } = loadRoleGuard({ roleGuard: 'bad json' });
            expect(RoleGuard.getStaleCache()).toBeNull();
        });
    });

    describe('clearCache()', () => {
        it('should remove data from localStorage', () => {
            const { RoleGuard, mockLocalStorage } = loadRoleGuard();
            RoleGuard.setCache({ user: { role: 'admin' }, permissions: {}, pendingRequestsCount: 0 });
            expect(mockLocalStorage.getItem('roleGuard')).not.toBeNull();

            RoleGuard.clearCache();
            expect(mockLocalStorage.getItem('roleGuard')).toBeNull();
        });

        it('should reset user to null', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'admin', email: 'admin@test.com' };
            RoleGuard.clearCache();
            expect(RoleGuard.user).toBeNull();
        });

        it('should reset permissions to null', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.permissions = { partners: { canView: true } };
            RoleGuard.clearCache();
            expect(RoleGuard.permissions).toBeNull();
        });

        it('should reset initialized to false', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.initialized = true;
            RoleGuard.clearCache();
            expect(RoleGuard.initialized).toBe(false);
        });
    });

    describe('canAccess()', () => {
        it('should return false when user is null', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = null;
            expect(RoleGuard.canAccess('partners')).toBe(false);
        });

        it('should return true for admin regardless of permissions', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'admin' };
            RoleGuard.permissions = {};
            expect(RoleGuard.canAccess('partners')).toBe(true);
            expect(RoleGuard.canAccess('admin-panel')).toBe(true);
        });

        it('should return true for user with isAdmin=true', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'leader', isAdmin: true };
            RoleGuard.permissions = {};
            expect(RoleGuard.canAccess('admin-panel')).toBe(true);
        });

        it('should return true for "home" module for any user', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales' };
            RoleGuard.permissions = {};
            expect(RoleGuard.canAccess('home')).toBe(true);
        });

        it('should return true for leader accessing team-management', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'leader' };
            RoleGuard.permissions = { 'team-management': { canView: false } };
            expect(RoleGuard.canAccess('team-management')).toBe(true);
        });

        it('should check permissions canView for non-admin user', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales' };
            RoleGuard.permissions = { partners: { canView: true, canEdit: false, canDelete: false } };
            expect(RoleGuard.canAccess('partners')).toBe(true);
        });

        it('should return false when canView is false for non-admin user', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales' };
            RoleGuard.permissions = { 'admin-panel': { canView: false, canEdit: false, canDelete: false } };
            expect(RoleGuard.canAccess('admin-panel')).toBe(false);
        });
    });

    describe('canEdit()', () => {
        it('should return false when user is null', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = null;
            expect(RoleGuard.canEdit('partners')).toBe(false);
        });

        it('should return true for admin', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'admin' };
            expect(RoleGuard.canEdit('partners')).toBe(true);
        });

        it('should check canEdit permission for non-admin', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales' };
            RoleGuard.permissions = { partners: { canView: true, canEdit: true, canDelete: false } };
            expect(RoleGuard.canEdit('partners')).toBe(true);
        });

        it('should return false when canEdit is false', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales' };
            RoleGuard.permissions = { partners: { canView: true, canEdit: false, canDelete: false } };
            expect(RoleGuard.canEdit('partners')).toBe(false);
        });
    });

    describe('canDelete()', () => {
        it('should return false when user is null', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = null;
            expect(RoleGuard.canDelete('partners')).toBe(false);
        });

        it('should return true for admin', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'admin' };
            expect(RoleGuard.canDelete('partners')).toBe(true);
        });

        it('should return false when canDelete is false for non-admin', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales' };
            RoleGuard.permissions = { partners: { canView: true, canEdit: true, canDelete: false } };
            expect(RoleGuard.canDelete('partners')).toBe(false);
        });
    });

    describe('convertApiResponse()', () => {
        it('should convert view/edit/delete to canView/canEdit/canDelete', () => {
            const { RoleGuard } = loadRoleGuard();
            const apiResponse = {
                email: 'user@test.com',
                name: 'Тест',
                role: 'sales',
                isAdmin: false,
                teamId: 'team-1',
                teamName: 'Alpha',
                status: 'active',
                picture: '',
                phone: '',
                telegram: '',
                position: '',
                reddyId: '12345',
                permissions: {
                    partners: { view: true, edit: false, delete: false },
                    traffic: { view: true, edit: true, delete: false }
                }
            };

            const result = RoleGuard.convertApiResponse(apiResponse);
            expect(result.permissions.partners.canView).toBe(true);
            expect(result.permissions.partners.canEdit).toBe(false);
            expect(result.permissions.partners.canDelete).toBe(false);
            expect(result.permissions.traffic.canEdit).toBe(true);
        });

        it('should map user fields correctly', () => {
            const { RoleGuard } = loadRoleGuard();
            const apiResponse = {
                email: 'admin@test.com',
                name: 'Администратор',
                role: 'admin',
                isAdmin: true,
                teamId: null,
                teamName: null,
                status: 'active',
                picture: 'https://pic.url',
                phone: '+7 999',
                telegram: 'admin_tg',
                position: 'Директор',
                reddyId: '99999',
                permissions: {}
            };

            const result = RoleGuard.convertApiResponse(apiResponse);
            expect(result.user.email).toBe('admin@test.com');
            expect(result.user.role).toBe('admin');
            expect(result.user.isAdmin).toBe(true);
        });

        it('should handle empty permissions object', () => {
            const { RoleGuard } = loadRoleGuard();
            const apiResponse = {
                email: 'u@t.com', name: 'U', role: 'guest',
                isAdmin: false, teamId: null, teamName: null,
                status: 'waiting_invite', picture: '', phone: '',
                telegram: '', position: '', reddyId: '',
                permissions: {}
            };
            const result = RoleGuard.convertApiResponse(apiResponse);
            expect(result.permissions).toEqual({});
        });

        it('should handle missing permissions field', () => {
            const { RoleGuard } = loadRoleGuard();
            const apiResponse = {
                email: 'u@t.com', name: 'U', role: 'guest',
                isAdmin: false, teamId: null, teamName: null,
                status: 'active', picture: '', phone: '',
                telegram: '', position: '', reddyId: ''
                // permissions отсутствует
            };
            const result = RoleGuard.convertApiResponse(apiResponse);
            expect(result.permissions).toEqual({});
        });
    });

    describe('buildPermissions()', () => {
        it('should return full permissions for admin (isAdmin=true)', () => {
            const { RoleGuard } = loadRoleGuard();
            const perms = RoleGuard.buildPermissions(true);
            const modules = ['partners', 'partner-onboarding', 'team-info', 'traffic', 'reports',
                            'settings', 'documentation', 'team-management', 'admin-panel'];
            modules.forEach(module => {
                expect(perms[module].canView).toBe(true);
                expect(perms[module].canEdit).toBe(true);
                expect(perms[module].canDelete).toBe(true);
            });
        });

        it('should return view-only permissions for non-admin (isAdmin=false)', () => {
            const { RoleGuard } = loadRoleGuard();
            const perms = RoleGuard.buildPermissions(false);
            const modules = ['partners', 'traffic', 'reports'];
            modules.forEach(module => {
                expect(perms[module].canView).toBe(true);
                expect(perms[module].canEdit).toBe(false);
                expect(perms[module].canDelete).toBe(false);
            });
        });
    });

    describe('getRole() and getCurrentRole()', () => {
        it('should return null when user is null', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = null;
            expect(RoleGuard.getRole()).toBeNull();
            expect(RoleGuard.getCurrentRole()).toBeNull();
        });

        it('should return user role', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'leader' };
            expect(RoleGuard.getRole()).toBe('leader');
            expect(RoleGuard.getCurrentRole()).toBe('leader');
        });
    });

    describe('hasRole()', () => {
        it('should return true when user has matching role', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'admin' };
            expect(RoleGuard.hasRole('admin')).toBe(true);
        });

        it('should return false for non-matching role', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales' };
            expect(RoleGuard.hasRole('admin')).toBe(false);
        });
    });

    describe('isAdminOrLeader()', () => {
        it('should return true for admin role', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'admin', isAdmin: false };
            expect(RoleGuard.isAdminOrLeader()).toBe(true);
        });

        it('should return true for leader role', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'leader', isAdmin: false };
            expect(RoleGuard.isAdminOrLeader()).toBe(true);
        });

        it('should return true for user with isAdmin=true', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'leader', isAdmin: true };
            expect(RoleGuard.isAdminOrLeader()).toBe(true);
        });

        it('should return false for regular employee', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales', isAdmin: false };
            expect(RoleGuard.isAdminOrLeader()).toBe(false);
        });
    });

    describe('isAdmin()', () => {
        it('should return true for role="admin"', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'admin' };
            expect(RoleGuard.isAdmin()).toBe(true);
        });

        it('should return true for isAdmin=true flag', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'leader', isAdmin: true };
            expect(RoleGuard.isAdmin()).toBe(true);
        });

        it('should return false for sales role without isAdmin flag', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales', isAdmin: false };
            expect(RoleGuard.isAdmin()).toBe(false);
        });
    });

    describe('canManageRole()', () => {
        it('should return false when user is null', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = null;
            expect(RoleGuard.canManageRole('sales')).toBe(false);
        });

        it('admin should manage non-admin roles', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'admin' };
            expect(RoleGuard.canManageRole('leader')).toBe(true);
            expect(RoleGuard.canManageRole('sales')).toBe(true);
        });

        it('admin should NOT manage other admins', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'admin' };
            expect(RoleGuard.canManageRole('admin')).toBe(false);
        });

        it('leader should manage employee roles', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'leader' };
            expect(RoleGuard.canManageRole('sales')).toBe(true);
            expect(RoleGuard.canManageRole('assistant')).toBe(true);
        });

        it('leader should NOT manage admin or other leaders', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'leader' };
            expect(RoleGuard.canManageRole('admin')).toBe(false);
            expect(RoleGuard.canManageRole('leader')).toBe(false);
        });
    });

    describe('getStatus() and getTeamId()', () => {
        it('getStatus() should return user status', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales', status: 'active' };
            expect(RoleGuard.getStatus()).toBe('active');
        });

        it('getStatus() should return null when user is null', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = null;
            expect(RoleGuard.getStatus()).toBeNull();
        });

        it('getTeamId() should return team ID', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = { role: 'sales', teamId: 'team-001' };
            expect(RoleGuard.getTeamId()).toBe('team-001');
        });

        it('getTeamId() should return null when user is null', () => {
            const { RoleGuard } = loadRoleGuard();
            RoleGuard.user = null;
            expect(RoleGuard.getTeamId()).toBeNull();
        });
    });
});
