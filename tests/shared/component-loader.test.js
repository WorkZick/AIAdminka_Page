import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '../../shared/js/component-loader.js'), 'utf-8');

/**
 * ComponentLoader работает с:
 *   - fetch (глобальный)
 *   - sessionStorage (глобальный)
 *   - document (глобальный)
 *
 * Загружаем изолированную копию через new Function, передавая моки.
 * jsdom предоставляет document через globals: true.
 */
function buildSessionStorage() {
    const store = {};
    return {
        getItem(key) { return key in store ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
        clear() { Object.keys(store).forEach(k => delete store[k]); },
        _store: store
    };
}

function loadComponentLoader({ mockFetch = null, mockSessionStorage = null, mockDocument = null } = {}) {
    const ss = mockSessionStorage || buildSessionStorage();
    const doc = mockDocument || document;
    const fetchFn = mockFetch || vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<div>component</div>'
    });

    const fn = new Function('fetch', 'sessionStorage', 'document', 'console', `
        ${code}
        return ComponentLoader;
    `);

    const loader = fn(fetchFn, ss, doc, console);
    return { ComponentLoader: loader, mockFetch: fetchFn, mockSessionStorage: ss };
}

// ─────────────────────────────────────────────
// load() — основные сценарии
// ─────────────────────────────────────────────
describe('ComponentLoader.load', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="sidebar-container"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return false when target element is not found', async () => {
        const { ComponentLoader } = loadComponentLoader();
        const result = await ComponentLoader.load('sidebar', '#nonexistent');
        expect(result).toBe(false);
    });

    it('should fetch component HTML from correct URL', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<nav>sidebar</nav>'
        });
        const { ComponentLoader } = loadComponentLoader({ mockFetch });
        ComponentLoader.init('../shared');

        await ComponentLoader.load('sidebar', '#sidebar-container');

        expect(mockFetch).toHaveBeenCalledWith('../shared/components/sidebar.html');
    });

    it('should insert fetched HTML into target element', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<nav id="sidebar">Nav content</nav>'
        });
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        await ComponentLoader.load('sidebar', '#sidebar-container');

        const container = document.getElementById('sidebar-container');
        expect(container.innerHTML).toContain('Nav content');
    });

    it('should return true on successful load', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<div>ok</div>'
        });
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        const result = await ComponentLoader.load('sidebar', '#sidebar-container');
        expect(result).toBe(true);
    });

    it('should return false when fetch response is not ok', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            text: async () => 'Not Found'
        });
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        const result = await ComponentLoader.load('sidebar', '#sidebar-container');
        expect(result).toBe(false);
    });

    it('should return false when fetch throws a network error', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        const result = await ComponentLoader.load('sidebar', '#sidebar-container');
        expect(result).toBe(false);
    });

    it('should store fetched HTML in sessionStorage', async () => {
        const html = '<nav>sidebar content</nav>';
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => html
        });
        const ss = buildSessionStorage();
        const { ComponentLoader } = loadComponentLoader({ mockFetch, mockSessionStorage: ss });

        await ComponentLoader.load('sidebar', '#sidebar-container');

        expect(ss.getItem('component-cache-sidebar')).toBe(html);
    });

    it('should use sessionStorage cache on second call without fetching again', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<nav>from network</nav>'
        });
        const ss = buildSessionStorage();
        const { ComponentLoader } = loadComponentLoader({ mockFetch, mockSessionStorage: ss });

        await ComponentLoader.load('sidebar', '#sidebar-container');
        await ComponentLoader.load('sidebar', '#sidebar-container');

        // fetch вызван только один раз — второй раз взято из кеша
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should use cached HTML from sessionStorage on first call if already populated', async () => {
        const cachedHtml = '<nav>cached sidebar</nav>';
        const ss = buildSessionStorage();
        ss.setItem('component-cache-sidebar', cachedHtml);

        const mockFetch = vi.fn();
        const { ComponentLoader } = loadComponentLoader({ mockFetch, mockSessionStorage: ss });

        await ComponentLoader.load('sidebar', '#sidebar-container');

        expect(mockFetch).not.toHaveBeenCalled();
        expect(document.getElementById('sidebar-container').innerHTML).toContain('cached sidebar');
    });

    it('should mark component as loaded after successful load', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<div>x</div>'
        });
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        expect(ComponentLoader.isLoaded('sidebar')).toBe(false);
        await ComponentLoader.load('sidebar', '#sidebar-container');
        expect(ComponentLoader.isLoaded('sidebar')).toBe(true);
    });

    it('should not mark component as loaded when fetch fails', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('fail'));
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        await ComponentLoader.load('sidebar', '#sidebar-container');
        expect(ComponentLoader.isLoaded('sidebar')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// processTemplate()
// ─────────────────────────────────────────────
describe('ComponentLoader.processTemplate', () => {
    it('should replace {{variable}} placeholders with option values', () => {
        const { ComponentLoader } = loadComponentLoader();
        const result = ComponentLoader.processTemplate(
            '<div>Hello {{name}}!</div>',
            { name: 'World' }
        );
        expect(result).toBe('<div>Hello World!</div>');
    });

    it('should leave placeholder unchanged when option key is absent', () => {
        const { ComponentLoader } = loadComponentLoader();
        const result = ComponentLoader.processTemplate(
            '<div>{{missing}}</div>',
            {}
        );
        expect(result).toBe('<div>{{missing}}</div>');
    });

    it('should replace multiple different placeholders', () => {
        const { ComponentLoader } = loadComponentLoader();
        const result = ComponentLoader.processTemplate(
            '{{a}} and {{b}}',
            { a: 'foo', b: 'bar' }
        );
        expect(result).toBe('foo and bar');
    });

    it('should return html unchanged when no placeholders present', () => {
        const { ComponentLoader } = loadComponentLoader();
        const html = '<div>plain html</div>';
        expect(ComponentLoader.processTemplate(html, {})).toBe(html);
    });

    it('should handle empty options object gracefully', () => {
        const { ComponentLoader } = loadComponentLoader();
        expect(() => ComponentLoader.processTemplate('{{x}}', {})).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// executeScripts()
// ─────────────────────────────────────────────
describe('ComponentLoader.executeScripts', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should not execute scripts for non-whitelisted component', () => {
        const { ComponentLoader } = loadComponentLoader();
        const container = document.createElement('div');
        let executed = false;

        // Создаём script-тег вручную и добавляем в container
        const script = document.createElement('script');
        script.textContent = 'executed = true;';
        container.appendChild(script);
        document.body.appendChild(container);

        // 'unknown-widget' не в allowedComponents
        ComponentLoader.executeScripts(container, 'unknown-widget');

        // Скрипт не должен был выполниться через replaceChild
        // (оригинальный script-тег всё ещё там, не заменён)
        expect(container.querySelectorAll('script').length).toBe(1);
    });

    it('should process scripts for whitelisted component "sidebar"', () => {
        const { ComponentLoader } = loadComponentLoader();
        const container = document.createElement('div');

        const script = document.createElement('script');
        script.textContent = '/* sidebar init */';
        container.appendChild(script);
        document.body.appendChild(container);

        // Не должно выбрасывать исключений
        expect(() => ComponentLoader.executeScripts(container, 'sidebar')).not.toThrow();
    });

    it('should process scripts for whitelisted component "about-modal"', () => {
        const { ComponentLoader } = loadComponentLoader();
        const container = document.createElement('div');

        const script = document.createElement('script');
        script.textContent = '/* about-modal init */';
        container.appendChild(script);
        document.body.appendChild(container);

        expect(() => ComponentLoader.executeScripts(container, 'about-modal')).not.toThrow();
    });

    it('should skip script tags that have a src attribute (external scripts)', () => {
        const { ComponentLoader } = loadComponentLoader();
        const container = document.createElement('div');

        const externalScript = document.createElement('script');
        externalScript.src = 'https://evil.example.com/malicious.js';
        container.appendChild(externalScript);
        document.body.appendChild(container);

        ComponentLoader.executeScripts(container, 'sidebar');

        // Внешний script остался нетронутым (не был заменён)
        const remaining = container.querySelectorAll('script[src]');
        expect(remaining.length).toBe(1);
        expect(remaining[0].src).toContain('evil.example.com');
    });

    it('should copy text content from old script to new script', () => {
        const { ComponentLoader } = loadComponentLoader();
        const container = document.createElement('div');

        const script = document.createElement('script');
        const scriptContent = 'var x = 42;';
        script.textContent = scriptContent;
        container.appendChild(script);
        document.body.appendChild(container);

        ComponentLoader.executeScripts(container, 'sidebar');

        const newScript = container.querySelector('script');
        expect(newScript).not.toBeNull();
        expect(newScript.textContent).toBe(scriptContent);
    });

    it('should not modify container when no scripts present', () => {
        const { ComponentLoader } = loadComponentLoader();
        const container = document.createElement('div');
        container.innerHTML = '<p>no scripts here</p>';
        document.body.appendChild(container);

        expect(() => ComponentLoader.executeScripts(container, 'sidebar')).not.toThrow();
        expect(container.querySelector('p').textContent).toBe('no scripts here');
    });
});

// ─────────────────────────────────────────────
// allowedComponents whitelist
// ─────────────────────────────────────────────
describe('ComponentLoader.allowedComponents whitelist', () => {
    it('should contain "sidebar"', () => {
        const { ComponentLoader } = loadComponentLoader();
        expect(ComponentLoader.allowedComponents.has('sidebar')).toBe(true);
    });

    it('should contain "about-modal"', () => {
        const { ComponentLoader } = loadComponentLoader();
        expect(ComponentLoader.allowedComponents.has('about-modal')).toBe(true);
    });

    it('should not contain arbitrary unknown components', () => {
        const { ComponentLoader } = loadComponentLoader();
        expect(ComponentLoader.allowedComponents.has('evil-widget')).toBe(false);
        expect(ComponentLoader.allowedComponents.has('admin-panel')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// loadAll()
// ─────────────────────────────────────────────
describe('ComponentLoader.loadAll', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="sidebar-container"></div>
            <div id="modal-container"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should load multiple components and return results array', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<div>component</div>'
        });
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        const results = await ComponentLoader.loadAll([
            { name: 'sidebar', target: '#sidebar-container' },
            { name: 'about-modal', target: '#modal-container' }
        ]);

        expect(Array.isArray(results)).toBe(true);
        expect(results).toHaveLength(2);
    });

    it('should return true for each successfully loaded component', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<div>ok</div>'
        });
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        const results = await ComponentLoader.loadAll([
            { name: 'sidebar', target: '#sidebar-container' },
            { name: 'about-modal', target: '#modal-container' }
        ]);

        expect(results[0]).toBe(true);
        expect(results[1]).toBe(true);
    });

    it('should return false for component whose target does not exist', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<div>ok</div>'
        });
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        const results = await ComponentLoader.loadAll([
            { name: 'sidebar', target: '#nonexistent' }
        ]);

        expect(results[0]).toBe(false);
    });

    it('should call fetch once per component', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<div>x</div>'
        });
        const ss = buildSessionStorage();
        const { ComponentLoader } = loadComponentLoader({ mockFetch, mockSessionStorage: ss });

        await ComponentLoader.loadAll([
            { name: 'sidebar', target: '#sidebar-container' },
            { name: 'about-modal', target: '#modal-container' }
        ]);

        // Два разных компонента — два разных fetch-вызова
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should pass options to each component load', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<div>{{version}}</div>'
        });
        const { ComponentLoader } = loadComponentLoader({ mockFetch });

        await ComponentLoader.loadAll([
            { name: 'sidebar', target: '#sidebar-container', options: { version: '2.23.2' } }
        ]);

        const container = document.getElementById('sidebar-container');
        expect(container.innerHTML).toContain('2.23.2');
    });

    it('should return empty array when passed empty components list', async () => {
        const { ComponentLoader } = loadComponentLoader();

        const results = await ComponentLoader.loadAll([]);
        expect(results).toEqual([]);
    });
});

// ─────────────────────────────────────────────
// init() and isLoaded()
// ─────────────────────────────────────────────
describe('ComponentLoader.init and isLoaded', () => {
    it('should set basePath via init()', () => {
        const { ComponentLoader } = loadComponentLoader();
        ComponentLoader.init('/custom/path');
        expect(ComponentLoader.basePath).toBe('/custom/path');
    });

    it('should use default basePath "../shared" when init called without args', () => {
        const { ComponentLoader } = loadComponentLoader();
        ComponentLoader.init();
        expect(ComponentLoader.basePath).toBe('../shared');
    });

    it('should return false from isLoaded for a component that was never loaded', () => {
        const { ComponentLoader } = loadComponentLoader();
        expect(ComponentLoader.isLoaded('sidebar')).toBe(false);
        expect(ComponentLoader.isLoaded('about-modal')).toBe(false);
        expect(ComponentLoader.isLoaded('nonexistent')).toBe(false);
    });
});
