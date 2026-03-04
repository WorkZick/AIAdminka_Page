import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '../../shared/js/sidebar-controller.js'), 'utf-8');

/**
 * SidebarController использует:
 *   - document (getElementById, querySelector, createElement, addEventListener)
 *   - localStorage (getItem, setItem)
 *   - requestAnimationFrame (для restoreState)
 *
 * Загружаем через new Function, передавая мок-окружение.
 * jsdom уже предоставляет document через globals: true.
 */
function buildLocalStorage() {
    const store = {};
    return {
        getItem(key) { return key in store ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
        clear() { Object.keys(store).forEach(k => delete store[k]); },
        _store: store
    };
}

/**
 * Создаём базовую DOM-структуру sidebar.
 * Возвращает корневой элемент #sidebar.
 */
function buildSidebarDOM() {
    document.body.innerHTML = `
        <nav id="sidebar">
            <button id="sidebarToggleBtn">Toggle</button>
            <div class="sidebar-menu">
                <a class="menu-item" data-module="home" href="/index.html">Главная</a>
                <a class="menu-item" data-module="reports" href="/excel-reports/index.html">Отчеты</a>
                <a class="menu-item" data-module="partners" href="/partners/index.html">Партнеры</a>
            </div>
        </nav>
    `;
    return document.getElementById('sidebar');
}

function loadSidebarController({ mockLocalStorage = null, extraGlobals = {} } = {}) {
    const ls = mockLocalStorage || buildLocalStorage();

    // requestAnimationFrame не нужен для логики — мокаем чтобы не вешать таймеры
    const mockRAF = (cb) => { cb(); };

    const fn = new Function(
        'localStorage',
        'requestAnimationFrame',
        'document',
        'console',
        ...Object.keys(extraGlobals),
        `
        ${code}
        return SidebarController;
        `
    );

    const controller = fn(
        ls,
        mockRAF,
        document,
        console,
        ...Object.values(extraGlobals)
    );

    return { SidebarController: controller, mockLocalStorage: ls };
}

// ─────────────────────────────────────────────
// MODULES_CONFIG — структура конфигурации
// ─────────────────────────────────────────────
describe('SidebarController.MODULES_CONFIG', () => {
    it('should be a non-empty array', () => {
        const { SidebarController } = loadSidebarController();
        expect(Array.isArray(SidebarController.MODULES_CONFIG)).toBe(true);
        expect(SidebarController.MODULES_CONFIG.length).toBeGreaterThan(0);
    });

    it('should contain at least 5 module entries (excluding separators)', () => {
        const { SidebarController } = loadSidebarController();
        const modules = SidebarController.MODULES_CONFIG.filter(m => m.type !== 'separator');
        expect(modules.length).toBeGreaterThanOrEqual(5);
    });

    it('should have required fields id, name, icon, href for each non-separator entry', () => {
        const { SidebarController } = loadSidebarController();
        const modules = SidebarController.MODULES_CONFIG.filter(m => m.type !== 'separator');

        modules.forEach(mod => {
            expect(mod).toHaveProperty('id');
            expect(mod).toHaveProperty('name');
            expect(mod).toHaveProperty('icon');
            expect(mod).toHaveProperty('href');
        });
    });

    it('should contain entry with id "home" marked as alwaysVisible', () => {
        const { SidebarController } = loadSidebarController();
        const home = SidebarController.MODULES_CONFIG.find(m => m.id === 'home');
        expect(home).toBeDefined();
        expect(home.alwaysVisible).toBe(true);
    });

    it('should contain entries for reports, team-info, traffic, partners', () => {
        const { SidebarController } = loadSidebarController();
        const ids = SidebarController.MODULES_CONFIG.map(m => m.id);
        expect(ids).toContain('reports');
        expect(ids).toContain('team-info');
        expect(ids).toContain('traffic');
        expect(ids).toContain('partners');
    });

    it('should have a separator entry with type "separator"', () => {
        const { SidebarController } = loadSidebarController();
        const sep = SidebarController.MODULES_CONFIG.find(m => m.type === 'separator');
        expect(sep).toBeDefined();
    });

    it('should contain admin-panel entry with hasBadge true', () => {
        const { SidebarController } = loadSidebarController();
        const admin = SidebarController.MODULES_CONFIG.find(m => m.id === 'admin-panel');
        expect(admin).toBeDefined();
        expect(admin.hasBadge).toBe(true);
    });

    it('should have href fields starting with "/"', () => {
        const { SidebarController } = loadSidebarController();
        const modules = SidebarController.MODULES_CONFIG.filter(m => m.type !== 'separator');
        modules.forEach(mod => {
            expect(mod.href.startsWith('/')).toBe(true);
        });
    });
});

// ─────────────────────────────────────────────
// escapeHtml()
// ─────────────────────────────────────────────
describe('SidebarController.escapeHtml', () => {
    beforeEach(() => {
        buildSidebarDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should escape < and > characters', () => {
        const { SidebarController } = loadSidebarController();
        const result = SidebarController.escapeHtml('<script>');
        expect(result).toBe('&lt;script&gt;');
    });

    it('should escape ampersand &', () => {
        const { SidebarController } = loadSidebarController();
        const result = SidebarController.escapeHtml('a & b');
        expect(result).toBe('a &amp; b');
    });

    it('should preserve double quotes (DOM-based textContent→innerHTML does not encode them)', () => {
        const { SidebarController } = loadSidebarController();
        const result = SidebarController.escapeHtml('"quoted"');
        // DOM-based escapeHtml only encodes <, >, & — quotes are safe in text context
        expect(result).toBe('"quoted"');
    });

    it('should return empty string for null input', () => {
        const { SidebarController } = loadSidebarController();
        expect(SidebarController.escapeHtml(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
        const { SidebarController } = loadSidebarController();
        expect(SidebarController.escapeHtml(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
        const { SidebarController } = loadSidebarController();
        expect(SidebarController.escapeHtml('')).toBe('');
    });

    it('should return plain text unchanged', () => {
        const { SidebarController } = loadSidebarController();
        expect(SidebarController.escapeHtml('Партнеры')).toBe('Партнеры');
    });

    it('should escape full XSS payload', () => {
        const { SidebarController } = loadSidebarController();
        const result = SidebarController.escapeHtml('<img src=x onerror=alert(1)>');
        expect(result).not.toContain('<img');
        expect(result).toContain('&lt;img');
    });
});

// ─────────────────────────────────────────────
// init()
// ─────────────────────────────────────────────
describe('SidebarController.init', () => {
    beforeEach(() => {
        buildSidebarDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should find and store sidebar element by id "sidebar"', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        expect(SidebarController.sidebar).not.toBeNull();
        expect(SidebarController.sidebar.id).toBe('sidebar');
    });

    it('should return early without error when sidebar element is absent', () => {
        document.body.innerHTML = '';
        const { SidebarController } = loadSidebarController();
        expect(() => SidebarController.init({})).not.toThrow();
        expect(SidebarController.sidebar).toBeNull();
    });

    it('should set activeModule from options', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({ activeModule: 'reports' });
        expect(SidebarController.activeModule).toBe('reports');
    });

    it('should set activeModule to null when not provided in options', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        expect(SidebarController.activeModule).toBeNull();
    });

    it('should set basePath from options', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({ basePath: '/app' });
        expect(SidebarController.basePath).toBe('/app');
    });

    it('should use empty string as default basePath', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        expect(SidebarController.basePath).toBe('');
    });

    it('should restore collapsed state from localStorage when sidebar-collapsed is "true"', () => {
        const ls = buildLocalStorage();
        ls.setItem('sidebar-collapsed', 'true');
        const { SidebarController } = loadSidebarController({ mockLocalStorage: ls });

        SidebarController.init({});

        expect(SidebarController.sidebar.classList.contains('collapsed')).toBe(true);
    });

    it('should not add collapsed class when localStorage value is "false"', () => {
        const ls = buildLocalStorage();
        ls.setItem('sidebar-collapsed', 'false');
        const { SidebarController } = loadSidebarController({ mockLocalStorage: ls });

        SidebarController.init({});

        expect(SidebarController.sidebar.classList.contains('collapsed')).toBe(false);
    });

    it('should not add collapsed class when localStorage has no sidebar-collapsed entry', () => {
        const ls = buildLocalStorage();
        const { SidebarController } = loadSidebarController({ mockLocalStorage: ls });

        SidebarController.init({});

        expect(SidebarController.sidebar.classList.contains('collapsed')).toBe(false);
    });

    it('should set active menu item when activeModule is provided', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({ activeModule: 'reports' });

        const activeItem = document.querySelector('[data-module="reports"]');
        expect(activeItem).not.toBeNull();
        expect(activeItem.classList.contains('active')).toBe(true);
    });
});

// ─────────────────────────────────────────────
// toggle()
// ─────────────────────────────────────────────
describe('SidebarController.toggle', () => {
    beforeEach(() => {
        buildSidebarDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should add "collapsed" class when sidebar is expanded', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});

        SidebarController.toggle();

        expect(SidebarController.sidebar.classList.contains('collapsed')).toBe(true);
    });

    it('should remove "collapsed" class when sidebar is already collapsed', () => {
        const ls = buildLocalStorage();
        ls.setItem('sidebar-collapsed', 'true');
        const { SidebarController } = loadSidebarController({ mockLocalStorage: ls });
        SidebarController.init({});

        SidebarController.toggle();

        expect(SidebarController.sidebar.classList.contains('collapsed')).toBe(false);
    });

    it('should persist collapsed=true to localStorage after toggling from expanded', () => {
        const ls = buildLocalStorage();
        const { SidebarController } = loadSidebarController({ mockLocalStorage: ls });
        SidebarController.init({});

        SidebarController.toggle();

        expect(ls.getItem('sidebar-collapsed')).toBe('true');
    });

    it('should persist collapsed=false to localStorage after toggling from collapsed', () => {
        const ls = buildLocalStorage();
        ls.setItem('sidebar-collapsed', 'true');
        const { SidebarController } = loadSidebarController({ mockLocalStorage: ls });
        SidebarController.init({});

        SidebarController.toggle();

        expect(ls.getItem('sidebar-collapsed')).toBe('false');
    });

    it('should not throw when sidebar is null (init not called)', () => {
        const { SidebarController } = loadSidebarController();
        // sidebar не инициализирован — должен упасть без ошибок
        expect(() => SidebarController.toggle()).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// collapse() and expand()
// ─────────────────────────────────────────────
describe('SidebarController.collapse and expand', () => {
    beforeEach(() => {
        buildSidebarDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('collapse() should add "collapsed" class', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        SidebarController.collapse();
        expect(SidebarController.sidebar.classList.contains('collapsed')).toBe(true);
    });

    it('collapse() should save "true" to localStorage', () => {
        const ls = buildLocalStorage();
        const { SidebarController } = loadSidebarController({ mockLocalStorage: ls });
        SidebarController.init({});
        SidebarController.collapse();
        expect(ls.getItem('sidebar-collapsed')).toBe('true');
    });

    it('expand() should remove "collapsed" class', () => {
        const ls = buildLocalStorage();
        ls.setItem('sidebar-collapsed', 'true');
        const { SidebarController } = loadSidebarController({ mockLocalStorage: ls });
        SidebarController.init({});
        SidebarController.expand();
        expect(SidebarController.sidebar.classList.contains('collapsed')).toBe(false);
    });

    it('expand() should save "false" to localStorage', () => {
        const ls = buildLocalStorage();
        const { SidebarController } = loadSidebarController({ mockLocalStorage: ls });
        SidebarController.init({});
        SidebarController.expand();
        expect(ls.getItem('sidebar-collapsed')).toBe('false');
    });

    it('isCollapsed() should return true after collapse()', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        SidebarController.collapse();
        expect(SidebarController.isCollapsed()).toBe(true);
    });

    it('isCollapsed() should return false after expand()', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        SidebarController.collapse();
        SidebarController.expand();
        expect(SidebarController.isCollapsed()).toBe(false);
    });

    it('isCollapsed() should return false when sidebar is null', () => {
        const { SidebarController } = loadSidebarController();
        // sidebar не инициализирован
        expect(SidebarController.isCollapsed()).toBe(false);
    });
});

// ─────────────────────────────────────────────
// setActiveItem()
// ─────────────────────────────────────────────
describe('SidebarController.setActiveItem', () => {
    beforeEach(() => {
        buildSidebarDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should add "active" class to the matching menu item', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        SidebarController.setActiveItem('partners');

        const partnersItem = document.querySelector('[data-module="partners"]');
        expect(partnersItem.classList.contains('active')).toBe(true);
    });

    it('should remove "active" from previously active item', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({ activeModule: 'home' });

        // Сначала home активен
        expect(document.querySelector('[data-module="home"]').classList.contains('active')).toBe(true);

        // Переключаем на reports
        SidebarController.setActiveItem('reports');

        expect(document.querySelector('[data-module="home"]').classList.contains('active')).toBe(false);
        expect(document.querySelector('[data-module="reports"]').classList.contains('active')).toBe(true);
    });

    it('should not throw for nonexistent module id', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        expect(() => SidebarController.setActiveItem('does-not-exist')).not.toThrow();
    });

    it('should not throw when sidebar is null', () => {
        document.body.innerHTML = '';
        const { SidebarController } = loadSidebarController();
        expect(() => SidebarController.setActiveItem('home')).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// updateRequestsBadge()
// ─────────────────────────────────────────────
describe('SidebarController.updateRequestsBadge', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <nav id="sidebar">
                <span class="requests-badge"></span>
            </nav>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should display badge with count when count > 0', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        SidebarController.updateRequestsBadge(5);

        const badge = document.querySelector('.requests-badge');
        expect(badge.textContent).toBe('5');
        expect(badge.style.display).toBe('flex');
    });

    it('should show "99+" when count exceeds 99', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        SidebarController.updateRequestsBadge(150);

        const badge = document.querySelector('.requests-badge');
        expect(badge.textContent).toBe('99+');
    });

    it('should hide badge when count is 0', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        SidebarController.updateRequestsBadge(0);

        const badge = document.querySelector('.requests-badge');
        expect(badge.style.display).toBe('none');
    });

    it('should show exactly "99" when count is exactly 99', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        SidebarController.updateRequestsBadge(99);

        const badge = document.querySelector('.requests-badge');
        expect(badge.textContent).toBe('99');
    });

    it('should not throw when badge element is absent', () => {
        document.body.innerHTML = '<nav id="sidebar"></nav>';
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        expect(() => SidebarController.updateRequestsBadge(3)).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// renderDynamicModules()
// ─────────────────────────────────────────────
describe('SidebarController.renderDynamicModules', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <nav id="sidebar">
                <button id="sidebarToggleBtn">Toggle</button>
                <div class="sidebar-menu"></div>
            </nav>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should populate .sidebar-menu with menu items', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({ dynamicModules: true, basePath: '' });

        const menuItems = document.querySelectorAll('.menu-item');
        expect(menuItems.length).toBeGreaterThan(0);
    });

    it('should create anchor elements with data-module attribute', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({ dynamicModules: true });

        const homeItem = document.querySelector('[data-module="home"]');
        expect(homeItem).not.toBeNull();
        expect(homeItem.tagName.toLowerCase()).toBe('a');
    });

    it('should include separator element with class menu-separator', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({ dynamicModules: true });

        const sep = document.querySelector('.menu-separator');
        expect(sep).not.toBeNull();
    });

    it('should prefix hrefs with basePath', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({ dynamicModules: true, basePath: '/app' });

        const homeItem = document.querySelector('[data-module="home"]');
        expect(homeItem.href).toContain('/app/index.html');
    });

    it('should not throw when .sidebar-menu element is absent', () => {
        document.body.innerHTML = '<nav id="sidebar"></nav>';
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});
        expect(() => SidebarController.renderDynamicModules()).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// Toggle button wiring
// ─────────────────────────────────────────────
describe('SidebarController toggle button', () => {
    beforeEach(() => {
        buildSidebarDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should toggle sidebar when toggle button is clicked', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});

        const btn = document.getElementById('sidebarToggleBtn');
        btn.click();

        expect(SidebarController.sidebar.classList.contains('collapsed')).toBe(true);
    });

    it('should toggle back to expanded on second click', () => {
        const { SidebarController } = loadSidebarController();
        SidebarController.init({});

        const btn = document.getElementById('sidebarToggleBtn');
        btn.click();
        btn.click();

        expect(SidebarController.sidebar.classList.contains('collapsed')).toBe(false);
    });
});
