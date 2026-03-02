import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '../../shared/env-config.js'), 'utf-8');

/**
 * Загружаем EnvConfig с мокнутым window.location и localStorage.
 * EnvConfig обращается к window.location.hostname и localStorage напрямую,
 * поэтому подменяем их через параметры функции-обёртки.
 */
function loadEnvConfig({ hostname = 'example.com', storageValue = null } = {}) {
    const mockLocalStorage = {
        _store: {},
        getItem(key) { return storageValue; },
        setItem(key, value) { this._store[key] = value; },
        removeItem(key) { delete this._store[key]; }
    };

    const mockWindow = {
        location: { hostname }
    };

    // Заменяем глобальные объекты в контексте выполнения
    const fn = new Function(
        'window', 'localStorage', 'console', 'module',
        `${code}\nreturn EnvConfig;`
    );

    return fn(mockWindow, mockLocalStorage, console, { exports: {} });
}

describe('EnvConfig', () => {
    describe('isLocalhost()', () => {
        it('should return true for localhost', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'localhost' });
            expect(EnvConfig.isLocalhost()).toBe(true);
        });

        it('should return true for 127.0.0.1', () => {
            const EnvConfig = loadEnvConfig({ hostname: '127.0.0.1' });
            expect(EnvConfig.isLocalhost()).toBe(true);
        });

        it('should return true for 192.168.x.x network', () => {
            const EnvConfig = loadEnvConfig({ hostname: '192.168.1.100' });
            expect(EnvConfig.isLocalhost()).toBe(true);
        });

        it('should return false for production domain', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'script.google.com' });
            expect(EnvConfig.isLocalhost()).toBe(false);
        });

        it('should return false for custom domain', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'myadmin.example.com' });
            expect(EnvConfig.isLocalhost()).toBe(false);
        });
    });

    describe('getCurrentEnv()', () => {
        it('should return "test" on localhost regardless of localStorage', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'localhost', storageValue: 'prod' });
            expect(EnvConfig.getCurrentEnv()).toBe('test');
        });

        it('should return "test" on 127.0.0.1', () => {
            const EnvConfig = loadEnvConfig({ hostname: '127.0.0.1' });
            expect(EnvConfig.getCurrentEnv()).toBe('test');
        });

        it('should return "prod" on production URL when localStorage is empty', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'script.google.com', storageValue: null });
            expect(EnvConfig.getCurrentEnv()).toBe('prod');
        });

        it('should return "test" on production URL when localStorage has "test"', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'script.google.com', storageValue: 'test' });
            expect(EnvConfig.getCurrentEnv()).toBe('test');
        });

        it('should return default "prod" when localStorage returns null on non-localhost', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'myadmin.company.com', storageValue: null });
            expect(EnvConfig.getCurrentEnv()).toBe('prod');
        });
    });

    describe('isProduction()', () => {
        it('should return false on localhost', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'localhost' });
            expect(EnvConfig.isProduction()).toBe(false);
        });

        it('should return false on 127.0.0.1', () => {
            const EnvConfig = loadEnvConfig({ hostname: '127.0.0.1' });
            expect(EnvConfig.isProduction()).toBe(false);
        });

        it('should return true on production domain with no localStorage override', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'script.google.com', storageValue: null });
            expect(EnvConfig.isProduction()).toBe(true);
        });

        it('should return false on production domain when env set to "test" in localStorage', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'script.google.com', storageValue: 'test' });
            expect(EnvConfig.isProduction()).toBe(false);
        });
    });

    describe('getScriptUrl()', () => {
        it('should return a URL string', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'localhost' });
            const url = EnvConfig.getScriptUrl();
            expect(typeof url).toBe('string');
            expect(url.length).toBeGreaterThan(0);
        });

        it('should return a valid https URL', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'localhost' });
            const url = EnvConfig.getScriptUrl();
            expect(url).toMatch(/^https:\/\//);
        });

        it('should return test URL on localhost', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'localhost' });
            const url = EnvConfig.getScriptUrl();
            expect(url).toBe(EnvConfig.ENVIRONMENTS.test.url);
        });

        it('should return prod URL on production domain with no override', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'script.google.com', storageValue: null });
            const url = EnvConfig.getScriptUrl();
            expect(url).toBe(EnvConfig.ENVIRONMENTS.prod.url);
        });

        it('should return test URL when localStorage has "test" on production domain', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'script.google.com', storageValue: 'test' });
            const url = EnvConfig.getScriptUrl();
            expect(url).toBe(EnvConfig.ENVIRONMENTS.test.url);
        });
    });

    describe('ENVIRONMENTS constants', () => {
        it('should have prod and test environments defined', () => {
            const EnvConfig = loadEnvConfig();
            expect(EnvConfig.ENVIRONMENTS.prod).toBeDefined();
            expect(EnvConfig.ENVIRONMENTS.test).toBeDefined();
        });

        it('should have url field in each environment', () => {
            const EnvConfig = loadEnvConfig();
            expect(typeof EnvConfig.ENVIRONMENTS.prod.url).toBe('string');
            expect(typeof EnvConfig.ENVIRONMENTS.test.url).toBe('string');
        });

        it('should have name field in each environment', () => {
            const EnvConfig = loadEnvConfig();
            expect(EnvConfig.ENVIRONMENTS.prod.name).toBe('Production');
            expect(EnvConfig.ENVIRONMENTS.test.name).toBe('Test');
        });
    });

    describe('DEFAULT_ENV', () => {
        it('should be "prod"', () => {
            const EnvConfig = loadEnvConfig();
            expect(EnvConfig.DEFAULT_ENV).toBe('prod');
        });
    });

    describe('isTestEnv()', () => {
        it('should return true on localhost', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'localhost' });
            expect(EnvConfig.isTestEnv()).toBe(true);
        });

        it('should return false on production domain with no override', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'script.google.com', storageValue: null });
            expect(EnvConfig.isTestEnv()).toBe(false);
        });
    });

    describe('setEnvironment()', () => {
        it('should return true for valid environment', () => {
            const mockLocalStorage = {
                _store: {},
                getItem() { return null; },
                setItem(key, value) { this._store[key] = value; },
                removeItem(key) { delete this._store[key]; }
            };
            const mockWindow = { location: { hostname: 'script.google.com' } };
            const fn = new Function(
                'window', 'localStorage', 'console', 'module',
                `${code}\nreturn EnvConfig;`
            );
            const EnvConfig = fn(mockWindow, mockLocalStorage, console, { exports: {} });

            expect(EnvConfig.setEnvironment('test')).toBe(true);
            expect(mockLocalStorage._store['cloud-storage-env']).toBe('test');
        });

        it('should return false for invalid environment', () => {
            const mockLocalStorage = {
                getItem() { return null; },
                setItem() {},
                removeItem() {}
            };
            const mockWindow = { location: { hostname: 'script.google.com' } };
            const fn = new Function(
                'window', 'localStorage', 'console', 'module',
                `${code}\nreturn EnvConfig;`
            );
            const EnvConfig = fn(mockWindow, mockLocalStorage, console, { exports: {} });

            expect(EnvConfig.setEnvironment('staging')).toBe(false);
            expect(EnvConfig.setEnvironment('')).toBe(false);
            expect(EnvConfig.setEnvironment(null)).toBe(false);
        });
    });

    describe('getInfo()', () => {
        it('should return object with current, name, url fields', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'localhost' });
            const info = EnvConfig.getInfo();
            expect(info).toHaveProperty('current');
            expect(info).toHaveProperty('name');
            expect(info).toHaveProperty('url');
        });

        it('should return test info on localhost', () => {
            const EnvConfig = loadEnvConfig({ hostname: 'localhost' });
            const info = EnvConfig.getInfo();
            expect(info.current).toBe('test');
            expect(info.name).toBe('Test');
        });
    });
});
