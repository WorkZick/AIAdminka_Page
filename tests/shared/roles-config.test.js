import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '../../shared/roles-config.js'), 'utf-8');

/**
 * Загружаем RolesConfig свежей копией для каждого теста.
 * Используем new Function чтобы изолировать состояние (_overrides, _customRoles).
 * window подменяем пустым объектом — нас интересует только сам объект RolesConfig.
 */
function loadRolesConfig() {
    const mockWindow = {};
    const fn = new Function('window', `${code}\nreturn RolesConfig;`);
    const rc = fn(mockWindow);

    // Сбрасываем мутируемое состояние в начальное
    rc._overrides = null;
    rc._customRoles = [];
    rc.ALL_ROLES = ['admin', 'leader', 'assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech', 'guest'];
    rc.ASSIGNABLE_ROLES = ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'];

    return rc;
}

// ─────────────────────────────────────────────
// getName
// ─────────────────────────────────────────────
describe('RolesConfig.getName', () => {
    it('should return Russian name for known default role', () => {
        const rc = loadRolesConfig();
        expect(rc.getName('admin')).toBe('Администратор');
        expect(rc.getName('sales')).toBe('Менеджер по продажам');
        expect(rc.getName('guest')).toBe('Гость');
    });

    it('should return "Неизвестно" for null/undefined/empty role', () => {
        const rc = loadRolesConfig();
        expect(rc.getName(null)).toBe('Неизвестно');
        expect(rc.getName(undefined)).toBe('Неизвестно');
        expect(rc.getName('')).toBe('Неизвестно');
    });

    it('should return the role key itself for unknown role without overrides', () => {
        const rc = loadRolesConfig();
        expect(rc.getName('unknown_role')).toBe('unknown_role');
    });

    it('should return override name when _overrides.names contains the role', () => {
        const rc = loadRolesConfig();
        rc._overrides = { names: { admin: 'Супер-Администратор' } };
        expect(rc.getName('admin')).toBe('Супер-Администратор');
    });

    it('should fall back to default when override does not contain the role', () => {
        const rc = loadRolesConfig();
        rc._overrides = { names: { admin: 'Custom Admin' } };
        expect(rc.getName('sales')).toBe('Менеджер по продажам');
    });
});

// ─────────────────────────────────────────────
// getColor
// ─────────────────────────────────────────────
describe('RolesConfig.getColor', () => {
    it('should return default color for known roles', () => {
        const rc = loadRolesConfig();
        expect(rc.getColor('admin')).toBe('#ff6b6b');
        expect(rc.getColor('leader')).toBe('#4dabf7');
        expect(rc.getColor('guest')).toBe('#868e96');
    });

    it('should return fallback "#868e96" for null/undefined', () => {
        const rc = loadRolesConfig();
        expect(rc.getColor(null)).toBe('#868e96');
        expect(rc.getColor(undefined)).toBe('#868e96');
    });

    it('should return fallback "#868e96" for unknown role', () => {
        const rc = loadRolesConfig();
        expect(rc.getColor('nonexistent')).toBe('#868e96');
    });

    it('should return override color when _overrides.colors is set', () => {
        const rc = loadRolesConfig();
        rc._overrides = { colors: { admin: '#000000' } };
        expect(rc.getColor('admin')).toBe('#000000');
    });

    it('should use custom role color registered via _defaults.colors', () => {
        const rc = loadRolesConfig();
        rc._defaults.colors['custom_role'] = '#aabbcc';
        expect(rc.getColor('custom_role')).toBe('#aabbcc');
    });
});

// ─────────────────────────────────────────────
// getDescription
// ─────────────────────────────────────────────
describe('RolesConfig.getDescription', () => {
    it('should return description for known default role', () => {
        const rc = loadRolesConfig();
        expect(rc.getDescription('admin')).toContain('Полный доступ');
        expect(rc.getDescription('guest')).toContain('Ожидание');
    });

    it('should return empty string for null/undefined', () => {
        const rc = loadRolesConfig();
        expect(rc.getDescription(null)).toBe('');
        expect(rc.getDescription(undefined)).toBe('');
    });

    it('should return empty string for unknown role', () => {
        const rc = loadRolesConfig();
        expect(rc.getDescription('totally_unknown')).toBe('');
    });

    it('should return override description when set', () => {
        const rc = loadRolesConfig();
        rc._overrides = { descriptions: { admin: 'Кастомное описание' } };
        expect(rc.getDescription('admin')).toBe('Кастомное описание');
    });
});

// ─────────────────────────────────────────────
// getNameMap
// ─────────────────────────────────────────────
describe('RolesConfig.getNameMap', () => {
    it('should return object with display names for provided roles array', () => {
        const rc = loadRolesConfig();
        const map = rc.getNameMap(['admin', 'sales']);
        expect(map).toEqual({
            admin: 'Администратор',
            sales: 'Менеджер по продажам'
        });
    });

    it('should use ALL_ROLES when no argument provided', () => {
        const rc = loadRolesConfig();
        const map = rc.getNameMap();
        expect(Object.keys(map)).toEqual(rc.ALL_ROLES);
    });

    it('should return empty object for empty array', () => {
        const rc = loadRolesConfig();
        expect(rc.getNameMap([])).toEqual({});
    });

    it('should include override names in map', () => {
        const rc = loadRolesConfig();
        rc._overrides = { names: { leader: 'Главный' } };
        const map = rc.getNameMap(['leader', 'guest']);
        expect(map.leader).toBe('Главный');
        expect(map.guest).toBe('Гость');
    });
});

// ─────────────────────────────────────────────
// applyOverrides
// ─────────────────────────────────────────────
describe('RolesConfig.applyOverrides', () => {
    it('should apply new format with overrides and customRoles', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({
            overrides: { names: { admin: 'Главный' } },
            customRoles: [
                { key: 'analyst', name: 'Аналитик', description: 'Аналитика', color: '#123456' }
            ]
        });
        expect(rc._overrides.names.admin).toBe('Главный');
        expect(rc._customRoles).toHaveLength(1);
        expect(rc._customRoles[0].key).toBe('analyst');
    });

    it('should register custom role in _defaults', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({
            customRoles: [
                { key: 'analyst', name: 'Аналитик', description: 'Desc', color: '#abcdef' }
            ]
        });
        expect(rc._defaults.names['analyst']).toBe('Аналитик');
        expect(rc._defaults.descriptions['analyst']).toBe('Desc');
        expect(rc._defaults.colors['analyst']).toBe('#abcdef');
    });

    it('should apply old format (plain names object) for backward compatibility', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({ names: { sales: 'Продавец' } });
        expect(rc._overrides.names.sales).toBe('Продавец');
        expect(rc._customRoles).toHaveLength(0);
    });

    it('should do nothing for null input', () => {
        const rc = loadRolesConfig();
        expect(() => rc.applyOverrides(null)).not.toThrow();
        expect(rc._overrides).toBeNull();
    });

    it('should do nothing for undefined input', () => {
        const rc = loadRolesConfig();
        expect(() => rc.applyOverrides(undefined)).not.toThrow();
    });

    it('should do nothing for non-object input', () => {
        const rc = loadRolesConfig();
        expect(() => rc.applyOverrides('string')).not.toThrow();
        expect(() => rc.applyOverrides(42)).not.toThrow();
    });

    it('should use default color "#868e96" when custom role has no color', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({
            customRoles: [{ key: 'nocolor', name: 'Без цвета' }]
        });
        expect(rc._defaults.colors['nocolor']).toBe('#868e96');
    });

    it('should set _overrides to null when new format has no overrides field', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({ customRoles: [] });
        expect(rc._overrides).toBeNull();
    });
});

// ─────────────────────────────────────────────
// isSystemRole
// ─────────────────────────────────────────────
describe('RolesConfig.isSystemRole', () => {
    it('should return true for admin, leader, guest', () => {
        const rc = loadRolesConfig();
        expect(rc.isSystemRole('admin')).toBe(true);
        expect(rc.isSystemRole('leader')).toBe(true);
        expect(rc.isSystemRole('guest')).toBe(true);
    });

    it('should return false for non-system roles', () => {
        const rc = loadRolesConfig();
        expect(rc.isSystemRole('sales')).toBe(false);
        expect(rc.isSystemRole('assistant')).toBe(false);
        expect(rc.isSystemRole('payments')).toBe(false);
        expect(rc.isSystemRole('antifraud')).toBe(false);
        expect(rc.isSystemRole('tech')).toBe(false);
    });

    it('should return false for unknown role', () => {
        const rc = loadRolesConfig();
        expect(rc.isSystemRole('superuser')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// isDefaultRole
// ─────────────────────────────────────────────
describe('RolesConfig.isDefaultRole', () => {
    it('should return true for all built-in default roles', () => {
        const rc = loadRolesConfig();
        const defaults = ['admin', 'leader', 'assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech', 'guest'];
        defaults.forEach(role => expect(rc.isDefaultRole(role)).toBe(true));
    });

    it('should return false for custom/unknown role', () => {
        const rc = loadRolesConfig();
        expect(rc.isDefaultRole('analyst')).toBe(false);
        expect(rc.isDefaultRole('custom_xyz')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// isCustomRole
// ─────────────────────────────────────────────
describe('RolesConfig.isCustomRole', () => {
    it('should return false when no custom roles registered', () => {
        const rc = loadRolesConfig();
        expect(rc.isCustomRole('admin')).toBe(false);
        expect(rc.isCustomRole('analyst')).toBe(false);
    });

    it('should return true after adding custom role via applyOverrides', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({
            customRoles: [{ key: 'analyst', name: 'Аналитик' }]
        });
        expect(rc.isCustomRole('analyst')).toBe(true);
    });

    it('should return false for default roles even after adding custom roles', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({
            customRoles: [{ key: 'analyst', name: 'Аналитик' }]
        });
        expect(rc.isCustomRole('admin')).toBe(false);
        expect(rc.isCustomRole('sales')).toBe(false);
    });

    it('should return false for role that was not registered', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({
            customRoles: [{ key: 'analyst', name: 'Аналитик' }]
        });
        expect(rc.isCustomRole('designer')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// getBadgeStyle
// ─────────────────────────────────────────────
describe('RolesConfig.getBadgeStyle', () => {
    it('should return object with color and background properties', () => {
        const rc = loadRolesConfig();
        const style = rc.getBadgeStyle('admin');
        expect(style).toHaveProperty('color');
        expect(style).toHaveProperty('background');
    });

    it('should return color equal to role color', () => {
        const rc = loadRolesConfig();
        const adminColor = rc.getColor('admin');
        const style = rc.getBadgeStyle('admin');
        expect(style.color).toBe(adminColor);
    });

    it('should return background as color + "20" (20% opacity suffix)', () => {
        const rc = loadRolesConfig();
        const adminColor = rc.getColor('admin');
        const style = rc.getBadgeStyle('admin');
        expect(style.background).toBe(adminColor + '20');
    });

    it('should use fallback color for null role', () => {
        const rc = loadRolesConfig();
        const style = rc.getBadgeStyle(null);
        expect(style.color).toBe('#868e96');
        expect(style.background).toBe('#868e9620');
    });
});

// ─────────────────────────────────────────────
// getFullConfig
// ─────────────────────────────────────────────
describe('RolesConfig.getFullConfig', () => {
    it('should return object with customRoles array and overrides object', () => {
        const rc = loadRolesConfig();
        const config = rc.getFullConfig();
        expect(config).toHaveProperty('customRoles');
        expect(config).toHaveProperty('overrides');
        expect(Array.isArray(config.customRoles)).toBe(true);
        expect(typeof config.overrides).toBe('object');
    });

    it('should return empty customRoles when no custom roles added', () => {
        const rc = loadRolesConfig();
        expect(rc.getFullConfig().customRoles).toHaveLength(0);
    });

    it('should include custom roles in customRoles array', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({
            customRoles: [{ key: 'analyst', name: 'Аналитик', color: '#111' }]
        });
        const config = rc.getFullConfig();
        expect(config.customRoles).toHaveLength(1);
        expect(config.customRoles[0].key).toBe('analyst');
    });

    it('should return copies of custom roles (not references)', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({
            customRoles: [{ key: 'analyst', name: 'Аналитик' }]
        });
        const config = rc.getFullConfig();
        config.customRoles[0].key = 'MODIFIED';
        // Оригинал не должен измениться
        expect(rc._customRoles[0].key).toBe('analyst');
    });
});

// ─────────────────────────────────────────────
// getAll
// ─────────────────────────────────────────────
describe('RolesConfig.getAll', () => {
    it('should return object with keys for all roles in ALL_ROLES', () => {
        const rc = loadRolesConfig();
        const all = rc.getAll();
        rc.ALL_ROLES.forEach(role => {
            expect(all).toHaveProperty(role);
        });
    });

    it('should each role entry contain name, description, color', () => {
        const rc = loadRolesConfig();
        const all = rc.getAll();
        const entry = all['admin'];
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('description');
        expect(entry).toHaveProperty('color');
    });

    it('should include custom role after applyOverrides', () => {
        const rc = loadRolesConfig();
        rc.applyOverrides({
            customRoles: [{ key: 'analyst', name: 'Аналитик', color: '#abc' }]
        });
        const all = rc.getAll();
        expect(all).toHaveProperty('analyst');
        expect(all['analyst'].name).toBe('Аналитик');
    });
});

// ─────────────────────────────────────────────
// getDefaultName
// ─────────────────────────────────────────────
describe('RolesConfig.getDefaultName', () => {
    it('should return default name ignoring overrides', () => {
        const rc = loadRolesConfig();
        rc._overrides = { names: { admin: 'Override Admin' } };
        // getDefaultName должен возвращать из _defaults, не из _overrides
        expect(rc.getDefaultName('admin')).toBe('Администратор');
    });

    it('should return role key itself for unknown role', () => {
        const rc = loadRolesConfig();
        expect(rc.getDefaultName('no_such_role')).toBe('no_such_role');
    });

    it('should return default name for all built-in roles', () => {
        const rc = loadRolesConfig();
        expect(rc.getDefaultName('leader')).toBe('Руководитель');
        expect(rc.getDefaultName('guest')).toBe('Гость');
        expect(rc.getDefaultName('payments')).toBe('Менеджер платежей');
    });
});

// ─────────────────────────────────────────────
// _rebuildRoleLists
// ─────────────────────────────────────────────
describe('RolesConfig._rebuildRoleLists', () => {
    it('should rebuild ALL_ROLES to include custom roles before guest', () => {
        const rc = loadRolesConfig();
        rc._customRoles = [{ key: 'analyst', name: 'Аналитик' }];
        rc._rebuildRoleLists();

        const lastTwo = rc.ALL_ROLES.slice(-2);
        expect(lastTwo).toEqual(['analyst', 'guest']);
    });

    it('should set ASSIGNABLE_ROLES to ALL_ROLES minus system roles', () => {
        const rc = loadRolesConfig();
        rc._customRoles = [{ key: 'analyst', name: 'Аналитик' }];
        rc._rebuildRoleLists();

        expect(rc.ASSIGNABLE_ROLES).not.toContain('admin');
        expect(rc.ASSIGNABLE_ROLES).not.toContain('leader');
        expect(rc.ASSIGNABLE_ROLES).not.toContain('guest');
        expect(rc.ASSIGNABLE_ROLES).toContain('analyst');
        expect(rc.ASSIGNABLE_ROLES).toContain('sales');
    });

    it('should not duplicate guest in ALL_ROLES', () => {
        const rc = loadRolesConfig();
        rc._customRoles = [];
        rc._rebuildRoleLists();

        const guestCount = rc.ALL_ROLES.filter(r => r === 'guest').length;
        expect(guestCount).toBe(1);
    });

    it('should place multiple custom roles before guest', () => {
        const rc = loadRolesConfig();
        rc._customRoles = [
            { key: 'analyst', name: 'Аналитик' },
            { key: 'designer', name: 'Дизайнер' }
        ];
        rc._rebuildRoleLists();

        const lastThree = rc.ALL_ROLES.slice(-3);
        expect(lastThree).toEqual(['analyst', 'designer', 'guest']);
    });
});

// ─────────────────────────────────────────────
// ASSIGNABLE_ROLES does not include system roles
// ─────────────────────────────────────────────
describe('RolesConfig.ASSIGNABLE_ROLES', () => {
    it('should not include admin, leader, or guest by default', () => {
        const rc = loadRolesConfig();
        expect(rc.ASSIGNABLE_ROLES).not.toContain('admin');
        expect(rc.ASSIGNABLE_ROLES).not.toContain('leader');
        expect(rc.ASSIGNABLE_ROLES).not.toContain('guest');
    });

    it('should contain all non-system default roles', () => {
        const rc = loadRolesConfig();
        ['assistant', 'sales', 'partners_mgr', 'payments', 'antifraud', 'tech'].forEach(role => {
            expect(rc.ASSIGNABLE_ROLES).toContain(role);
        });
    });
});
