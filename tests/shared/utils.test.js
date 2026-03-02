import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Определяем путь к shared/utils.js
const __dirname = dirname(fileURLToPath(import.meta.url));
const utilsPath = resolve(__dirname, '../../shared/utils.js');
const utilsCode = readFileSync(utilsPath, 'utf-8');

// Выполняем vanilla JS код Utils в контексте jsdom (глобальные document, crypto доступны)
const scriptFn = new Function('document', 'crypto', 'navigator', 'fetch', 'console', `
    ${utilsCode}
    return Utils;
`);

const Utils = scriptFn(document, crypto, navigator, globalThis.fetch, console);

describe('Utils.escapeHtml', () => {
    it('escapes HTML special characters', () => {
        expect(Utils.escapeHtml('<script>alert("xss")</script>')).toBe(
            '&lt;script&gt;alert("xss")&lt;/script&gt;'
        );
    });

    it('escapes ampersands', () => {
        expect(Utils.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('handles empty string', () => {
        expect(Utils.escapeHtml('')).toBe('');
    });

    it('returns plain text unchanged', () => {
        expect(Utils.escapeHtml('hello world')).toBe('hello world');
    });
});

describe('Utils.generateId', () => {
    it('returns 24 char hex string', () => {
        const id = Utils.generateId();
        expect(id).toMatch(/^[0-9a-f]{24}$/);
    });

    it('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => Utils.generateId()));
        expect(ids.size).toBe(100);
    });
});

describe('Utils.isValidEmail', () => {
    it('accepts valid emails', () => {
        expect(Utils.isValidEmail('test@example.com')).toBe(true);
        expect(Utils.isValidEmail('user.name@domain.co')).toBe(true);
    });

    it('rejects invalid emails', () => {
        expect(Utils.isValidEmail('')).toBe(false);
        expect(Utils.isValidEmail('notanemail')).toBe(false);
        expect(Utils.isValidEmail('@domain.com')).toBe(false);
        expect(Utils.isValidEmail('user@')).toBe(false);
        expect(Utils.isValidEmail('user @domain.com')).toBe(false);
    });
});

describe('Utils.formatDate', () => {
    it('formats Date object', () => {
        const date = new Date('2026-01-15T00:00:00');
        const result = Utils.formatDate(date);
        expect(result).not.toBe('Неверная дата');
        expect(result).toContain('2026');
    });

    it('formats ISO string', () => {
        const result = Utils.formatDate('2026-03-01');
        expect(result).not.toBe('Неверная дата');
    });

    it('handles invalid date', () => {
        expect(Utils.formatDate('not-a-date')).toBe('Неверная дата');
    });
});

describe('Utils.debounce', () => {
    it('delays execution', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = Utils.debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('resets timer on repeated calls', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = Utils.debounce(fn, 100);

        debounced();
        vi.advanceTimersByTime(50);
        debounced();
        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });
});
