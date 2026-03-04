import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '../../shared/storage.js'), 'utf-8');

/**
 * StorageManager напрямую обращается к глобальному localStorage и глобальному Toast.
 * Загружаем модуль через new Function, подменяя оба глобала.
 */
function loadStorageManager({ mockLocalStorage = null, mockToast = null } = {}) {
    const store = {};

    const defaultLocalStorage = {
        getItem(key) { return key in store ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
        clear() { Object.keys(store).forEach(k => delete store[k]); },
        _store: store
    };

    const ls = mockLocalStorage || defaultLocalStorage;

    const defaultToast = {
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        success: vi.fn()
    };

    const toast = mockToast || defaultToast;

    const fn = new Function('localStorage', 'Toast', 'console', `
        ${code}
        return StorageManager;
    `);

    const sm = fn(ls, toast, console);
    return { StorageManager: sm, mockLocalStorage: ls, mockToast: toast };
}

// ─────────────────────────────────────────────
// _isAvailable
// ─────────────────────────────────────────────
describe('StorageManager._isAvailable', () => {
    it('should return true when localStorage works normally', () => {
        const { StorageManager } = loadStorageManager();
        expect(StorageManager._isAvailable()).toBe(true);
    });

    it('should return false and call Toast.error when localStorage throws', () => {
        const throwingStorage = {
            getItem() { throw new Error('SecurityError'); },
            setItem() { throw new Error('SecurityError'); },
            removeItem() { throw new Error('SecurityError'); }
        };
        const mockToast = { error: vi.fn(), warning: vi.fn() };

        const { StorageManager } = loadStorageManager({
            mockLocalStorage: throwingStorage,
            mockToast
        });

        expect(StorageManager._isAvailable()).toBe(false);
        expect(mockToast.error).toHaveBeenCalledOnce();
    });
});

// ─────────────────────────────────────────────
// get
// ─────────────────────────────────────────────
describe('StorageManager.get', () => {
    it('should return parsed value for existing key', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['testKey'] = JSON.stringify({ foo: 'bar' });
        expect(StorageManager.get('testKey')).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existing key', () => {
        const { StorageManager } = loadStorageManager();
        expect(StorageManager.get('does_not_exist')).toBeNull();
    });

    it('should return null for invalid JSON and not throw', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['badJson'] = '{invalid json{{';
        expect(StorageManager.get('badJson')).toBeNull();
    });

    it('should return primitive string value', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['strKey'] = JSON.stringify('hello');
        expect(StorageManager.get('strKey')).toBe('hello');
    });

    it('should return array value', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['arrKey'] = JSON.stringify([1, 2, 3]);
        expect(StorageManager.get('arrKey')).toEqual([1, 2, 3]);
    });
});

// ─────────────────────────────────────────────
// set
// ─────────────────────────────────────────────
describe('StorageManager.set', () => {
    it('should return true and persist simple value', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        const result = StorageManager.set('key1', 'value1');
        expect(result).toBe(true);
        expect(JSON.parse(mockLocalStorage._store['key1'])).toBe('value1');
    });

    it('should persist object correctly', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        StorageManager.set('objKey', { a: 1, b: 'test' });
        expect(JSON.parse(mockLocalStorage._store['objKey'])).toEqual({ a: 1, b: 'test' });
    });

    it('should persist array correctly', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        StorageManager.set('arrKey', [10, 20, 30]);
        expect(JSON.parse(mockLocalStorage._store['arrKey'])).toEqual([10, 20, 30]);
    });

    it('should return false and call Toast.warning on QuotaExceededError', () => {
        // _isAvailable() uses __storage_test__ key — allow that to pass,
        // then throw QuotaExceededError on actual data writes
        const quotaStorage = {
            _store: {},
            getItem(key) { return key in this._store ? this._store[key] : null; },
            setItem(key, value) {
                if (key === '__storage_test__') {
                    this._store[key] = String(value);
                    return;
                }
                const err = new Error('QuotaExceededError');
                err.name = 'QuotaExceededError';
                throw err;
            },
            removeItem(key) { delete this._store[key]; }
        };
        const mockToast = { error: vi.fn(), warning: vi.fn() };

        const { StorageManager } = loadStorageManager({
            mockLocalStorage: quotaStorage,
            mockToast
        });

        const result = StorageManager.set('key', 'value');
        expect(result).toBe(false);
        expect(mockToast.warning).toHaveBeenCalledOnce();
    });

    it('should return false when _isAvailable returns false', () => {
        const throwingStorage = {
            getItem() { throw new Error('blocked'); },
            setItem() { throw new Error('blocked'); },
            removeItem() { throw new Error('blocked'); }
        };
        const mockToast = { error: vi.fn(), warning: vi.fn() };

        const { StorageManager } = loadStorageManager({
            mockLocalStorage: throwingStorage,
            mockToast
        });

        expect(StorageManager.set('k', 'v')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// remove
// ─────────────────────────────────────────────
describe('StorageManager.remove', () => {
    it('should remove existing key and return true', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['toDelete'] = '"data"';
        const result = StorageManager.remove('toDelete');
        expect(result).toBe(true);
        expect('toDelete' in mockLocalStorage._store).toBe(false);
    });

    it('should return true when removing non-existing key (no error)', () => {
        const { StorageManager } = loadStorageManager();
        expect(StorageManager.remove('ghost_key')).toBe(true);
    });

    it('should not affect other keys', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['keep'] = '"keep"';
        mockLocalStorage._store['del'] = '"del"';
        StorageManager.remove('del');
        expect('keep' in mockLocalStorage._store).toBe(true);
    });
});

// ─────────────────────────────────────────────
// getArray
// ─────────────────────────────────────────────
describe('StorageManager.getArray', () => {
    it('should return stored array', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['list'] = JSON.stringify([{ id: '1' }, { id: '2' }]);
        expect(StorageManager.getArray('list')).toHaveLength(2);
    });

    it('should return empty array for missing key', () => {
        const { StorageManager } = loadStorageManager();
        expect(StorageManager.getArray('missing')).toEqual([]);
    });

    it('should return empty array when stored value is not an array', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['notArr'] = JSON.stringify({ foo: 'bar' });
        expect(StorageManager.getArray('notArr')).toEqual([]);
    });

    it('should return empty array when stored value is null', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['nullVal'] = JSON.stringify(null);
        expect(StorageManager.getArray('nullVal')).toEqual([]);
    });

    it('should return empty array for invalid JSON', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['bad'] = '{{{';
        expect(StorageManager.getArray('bad')).toEqual([]);
    });
});

// ─────────────────────────────────────────────
// addItem
// ─────────────────────────────────────────────
describe('StorageManager.addItem', () => {
    it('should add item to empty array and return item with id', () => {
        const { StorageManager } = loadStorageManager();
        const result = StorageManager.addItem('items', { name: 'Test' });
        expect(result).not.toBeNull();
        expect(result.name).toBe('Test');
        expect(result.id).toBeDefined();
    });

    it('should preserve existing id if item already has one', () => {
        const { StorageManager } = loadStorageManager();
        const result = StorageManager.addItem('items', { id: 'myid', name: 'Test' });
        expect(result.id).toBe('myid');
    });

    it('should assign id when item has no id', () => {
        const { StorageManager } = loadStorageManager();
        const result = StorageManager.addItem('items', { name: 'NoId' });
        expect(typeof result.id).toBe('string');
        expect(result.id.length).toBeGreaterThan(0);
    });

    it('should append to existing array', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['items'] = JSON.stringify([{ id: 'existing', name: 'First' }]);
        StorageManager.addItem('items', { id: 'new', name: 'Second' });
        const stored = JSON.parse(mockLocalStorage._store['items']);
        expect(stored).toHaveLength(2);
        expect(stored[1].id).toBe('new');
    });

    it('should return null when set fails (storage unavailable)', () => {
        const throwingStorage = {
            getItem() { return null; },
            setItem() {
                const e = new Error('QuotaExceededError');
                e.name = 'QuotaExceededError';
                throw e;
            },
            removeItem() {}
        };
        const mockToast = { error: vi.fn(), warning: vi.fn() };

        const { StorageManager } = loadStorageManager({
            mockLocalStorage: throwingStorage,
            mockToast
        });

        // _isAvailable uses setItem/removeItem for test — will throw → returns false → set returns false
        const result = StorageManager.addItem('items', { name: 'Fail' });
        expect(result).toBeNull();
    });
});

// ─────────────────────────────────────────────
// updateItem
// ─────────────────────────────────────────────
describe('StorageManager.updateItem', () => {
    it('should update existing item and return true', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['items'] = JSON.stringify([
            { id: '1', name: 'Old Name', value: 10 }
        ]);

        const result = StorageManager.updateItem('items', '1', { name: 'New Name' });
        expect(result).toBe(true);

        const stored = JSON.parse(mockLocalStorage._store['items']);
        expect(stored[0].name).toBe('New Name');
        expect(stored[0].value).toBe(10); // Остальные поля сохранены
    });

    it('should return false for non-existing id', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['items'] = JSON.stringify([{ id: '1', name: 'Item' }]);

        const result = StorageManager.updateItem('items', 'nonexistent', { name: 'X' });
        expect(result).toBe(false);
    });

    it('should return false for empty array', () => {
        const { StorageManager } = loadStorageManager();
        expect(StorageManager.updateItem('empty', 'any_id', { name: 'X' })).toBe(false);
    });

    it('should merge data — not replace — existing fields', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['items'] = JSON.stringify([
            { id: '1', a: 'A', b: 'B' }
        ]);
        StorageManager.updateItem('items', '1', { b: 'Updated' });
        const stored = JSON.parse(mockLocalStorage._store['items']);
        expect(stored[0].a).toBe('A');
        expect(stored[0].b).toBe('Updated');
    });
});

// ─────────────────────────────────────────────
// deleteItem
// ─────────────────────────────────────────────
describe('StorageManager.deleteItem', () => {
    it('should remove item with matching id and return true', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['items'] = JSON.stringify([
            { id: '1', name: 'Keep' },
            { id: '2', name: 'Delete' }
        ]);

        const result = StorageManager.deleteItem('items', '2');
        expect(result).toBe(true);

        const stored = JSON.parse(mockLocalStorage._store['items']);
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe('1');
    });

    it('should return true even when id does not exist (filter returns same array)', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['items'] = JSON.stringify([{ id: '1', name: 'Item' }]);
        const result = StorageManager.deleteItem('items', 'ghost');
        expect(result).toBe(true);
        const stored = JSON.parse(mockLocalStorage._store['items']);
        expect(stored).toHaveLength(1);
    });

    it('should work on empty array without throwing', () => {
        const { StorageManager } = loadStorageManager();
        expect(() => StorageManager.deleteItem('emptyKey', 'any')).not.toThrow();
    });

    it('should not affect other items in array', () => {
        const { StorageManager, mockLocalStorage } = loadStorageManager();
        mockLocalStorage._store['items'] = JSON.stringify([
            { id: '1', name: 'A' },
            { id: '2', name: 'B' },
            { id: '3', name: 'C' }
        ]);
        StorageManager.deleteItem('items', '2');
        const stored = JSON.parse(mockLocalStorage._store['items']);
        expect(stored.map(i => i.id)).toEqual(['1', '3']);
    });
});
