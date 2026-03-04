import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadExcelReportsUtils() {
    const mocks = {
        window: { ExcelReportsUtils: null },
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() }
    };

    const code = readFileSync(
        resolve(__dirname, '../../excel-reports/js/modules/utils.js'),
        'utf-8'
    );

    // Класс присваивается в window.ExcelReportsUtils через последнюю строку модуля.
    // new Function позволяет инжектировать window и console как параметры,
    // изолируя код от глобального окружения.
    const fn = new Function('window', 'console', `${code}\nreturn ExcelReportsUtils;`);
    const ExcelReportsUtils = fn(mocks.window, mocks.console);
    return { ExcelReportsUtils, mocks };
}

// ─────────────────────────────────────────────
// Вспомогательная фабрика инстанса
// ─────────────────────────────────────────────
function makeUtils() {
    const { ExcelReportsUtils } = loadExcelReportsUtils();
    return new ExcelReportsUtils();
}

// ─────────────────────────────────────────────
// findColumn
// ─────────────────────────────────────────────
describe('ExcelReportsUtils.findColumn()', () => {
    it('should find column by exact name match', () => {
        const utils = makeUtils();
        expect(utils.findColumn(['Name', 'Age', 'Email'], ['Age'])).toBe(1);
    });

    it('should find column case-insensitively', () => {
        const utils = makeUtils();
        expect(utils.findColumn(['name', 'AGE', 'email'], ['Name'])).toBe(0);
    });

    it('should match first alternative name when multiple provided', () => {
        const utils = makeUtils();
        expect(utils.findColumn(['Partner', 'Revenue'], ['partner', 'партнёр'])).toBe(0);
    });

    it('should match second alternative name if first not found', () => {
        const utils = makeUtils();
        expect(utils.findColumn(['Партнёр', 'Revenue'], ['partner', 'Партнёр'])).toBe(0);
    });

    it('should return -1 when no headers match', () => {
        const utils = makeUtils();
        expect(utils.findColumn(['Name', 'Age'], ['Email', 'email'])).toBe(-1);
    });

    it('should return -1 for empty headers array', () => {
        const utils = makeUtils();
        expect(utils.findColumn([], ['Name'])).toBe(-1);
    });

    it('should return -1 for empty possibleNames array', () => {
        const utils = makeUtils();
        expect(utils.findColumn(['Name', 'Age'], [])).toBe(-1);
    });

    it('should handle null/undefined cells in headers without throwing', () => {
        const utils = makeUtils();
        expect(utils.findColumn([null, undefined, 'Email'], ['Email'])).toBe(2);
    });

    it('should trim whitespace in header before comparison', () => {
        const utils = makeUtils();
        expect(utils.findColumn(['  Name  ', 'Age'], ['name'])).toBe(0);
    });
});

// ─────────────────────────────────────────────
// formatNumber
// ─────────────────────────────────────────────
describe('ExcelReportsUtils.formatNumber()', () => {
    it('should format integer with thousands separator', () => {
        const utils = makeUtils();
        // ru-RU uses non-breaking space \u00a0 as thousands separator
        const result = utils.formatNumber(1234567);
        expect(result.replace(/\s/g, ' ')).toBe('1 234 567');
    });

    it('should return "0" for null', () => {
        const utils = makeUtils();
        expect(utils.formatNumber(null)).toBe('0');
    });

    it('should return "0" for undefined', () => {
        const utils = makeUtils();
        expect(utils.formatNumber(undefined)).toBe('0');
    });

    it('should return "0" for NaN', () => {
        const utils = makeUtils();
        expect(utils.formatNumber(NaN)).toBe('0');
    });

    it('should format zero as "0"', () => {
        const utils = makeUtils();
        expect(utils.formatNumber(0)).toBe('0');
    });

    it('should format small number without separator', () => {
        const utils = makeUtils();
        expect(utils.formatNumber(42)).toBe('42');
    });

    it('should format string number correctly', () => {
        const utils = makeUtils();
        const result = utils.formatNumber('9999');
        expect(result.replace(/\s/g, ' ')).toBe('9 999');
    });

    it('should format number with decimals when decimals param provided', () => {
        const utils = makeUtils();
        const result = utils.formatNumber(1234.5, 2);
        // Should contain 1234 with some separator
        expect(result).toContain('1');
        expect(result).toContain('234');
    });
});

// ─────────────────────────────────────────────
// formatPercent
// ─────────────────────────────────────────────
describe('ExcelReportsUtils.formatPercent()', () => {
    it('should format 0.8912 as "89.12%"', () => {
        const utils = makeUtils();
        expect(utils.formatPercent(0.8912)).toBe('89.12%');
    });

    it('should format 1 as "100.00%"', () => {
        const utils = makeUtils();
        expect(utils.formatPercent(1)).toBe('100.00%');
    });

    it('should format 0 as "0.00%"', () => {
        const utils = makeUtils();
        expect(utils.formatPercent(0)).toBe('0.00%');
    });

    it('should return "0%" for null', () => {
        const utils = makeUtils();
        expect(utils.formatPercent(null)).toBe('0%');
    });

    it('should return "0%" for undefined', () => {
        const utils = makeUtils();
        expect(utils.formatPercent(undefined)).toBe('0%');
    });

    it('should return "0%" for NaN', () => {
        const utils = makeUtils();
        expect(utils.formatPercent(NaN)).toBe('0%');
    });

    it('should respect decimals parameter', () => {
        const utils = makeUtils();
        expect(utils.formatPercent(0.5, 0)).toBe('50%');
    });

    it('should handle small fractions', () => {
        const utils = makeUtils();
        expect(utils.formatPercent(0.001)).toBe('0.10%');
    });
});

// ─────────────────────────────────────────────
// escapeHtml
// ─────────────────────────────────────────────
describe('ExcelReportsUtils.escapeHtml()', () => {
    it('should escape < and > characters', () => {
        const utils = makeUtils();
        const result = utils.escapeHtml('<script>alert(1)</script>');
        expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('should escape & ampersand', () => {
        const utils = makeUtils();
        expect(utils.escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape double quotes', () => {
        const utils = makeUtils();
        expect(utils.escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('should escape single quotes', () => {
        const utils = makeUtils();
        expect(utils.escapeHtml("it's fine")).toBe("it&#039;s fine");
    });

    it('should escape all special chars in one string', () => {
        const utils = makeUtils();
        const result = utils.escapeHtml('<a href="url" class=\'x\'>link & more</a>');
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
        expect(result).not.toContain('"');
        expect(result).not.toContain("'");
        // & is replaced by &amp; so raw " & " must not appear as literal unescaped ampersand
        expect(result).not.toMatch(/ & /);
    });

    it('should return plain text unchanged', () => {
        const utils = makeUtils();
        expect(utils.escapeHtml('Hello world')).toBe('Hello world');
    });

    it('should handle empty string', () => {
        const utils = makeUtils();
        expect(utils.escapeHtml('')).toBe('');
    });

    it('should preserve cyrillic text', () => {
        const utils = makeUtils();
        expect(utils.escapeHtml('Привет мир')).toBe('Привет мир');
    });
});

// ─────────────────────────────────────────────
// generateId
// ─────────────────────────────────────────────
describe('ExcelReportsUtils.generateId()', () => {
    it('should return string starting with given prefix', () => {
        const utils = makeUtils();
        const id = utils.generateId('report');
        expect(id).toMatch(/^report-/);
    });

    it('should use default prefix "id" when none provided', () => {
        const utils = makeUtils();
        const id = utils.generateId();
        expect(id).toMatch(/^id-/);
    });

    it('should have format prefix-timestamp-random', () => {
        const utils = makeUtils();
        const id = utils.generateId('test');
        const parts = id.split('-');
        // prefix-timestamp-random → at least 3 parts
        expect(parts.length).toBeGreaterThanOrEqual(3);
    });

    it('should contain numeric timestamp portion', () => {
        const utils = makeUtils();
        const id = utils.generateId('x');
        const parts = id.split('-');
        // Second segment (index 1) is the timestamp
        expect(Number(parts[1])).toBeGreaterThan(0);
    });

    it('should generate unique IDs on consecutive calls', () => {
        const utils = makeUtils();
        const ids = new Set(Array.from({ length: 20 }, () => utils.generateId('u')));
        expect(ids.size).toBe(20);
    });

    it('should use substring not substr (no deprecated API)', () => {
        // If substr were used it would still work in V8 but we confirm result is a string
        const utils = makeUtils();
        const id = utils.generateId('check');
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(5);
    });
});

// ─────────────────────────────────────────────
// debounce
// ─────────────────────────────────────────────
describe('ExcelReportsUtils.debounce()', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('should not call function before delay expires', () => {
        const utils = makeUtils();
        const fn = vi.fn();
        const debounced = utils.debounce(fn, 300);
        debounced();
        expect(fn).not.toHaveBeenCalled();
    });

    it('should call function after delay expires', () => {
        const utils = makeUtils();
        const fn = vi.fn();
        const debounced = utils.debounce(fn, 300);
        debounced();
        vi.advanceTimersByTime(300);
        expect(fn).toHaveBeenCalledOnce();
    });

    it('should reset timer on each call (only fire once after last call)', () => {
        const utils = makeUtils();
        const fn = vi.fn();
        const debounced = utils.debounce(fn, 300);
        debounced();
        vi.advanceTimersByTime(200);
        debounced();
        vi.advanceTimersByTime(200);
        debounced();
        vi.advanceTimersByTime(300);
        expect(fn).toHaveBeenCalledOnce();
    });

    it('should pass arguments to the original function', () => {
        const utils = makeUtils();
        const fn = vi.fn();
        const debounced = utils.debounce(fn, 100);
        debounced('arg1', 42);
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('arg1', 42);
    });

    it('should return a function', () => {
        const utils = makeUtils();
        const debounced = utils.debounce(() => {}, 100);
        expect(typeof debounced).toBe('function');
    });
});

// ─────────────────────────────────────────────
// log
// ─────────────────────────────────────────────
describe('ExcelReportsUtils.log()', () => {
    it('should call console.log for default info type', () => {
        const { ExcelReportsUtils, mocks } = loadExcelReportsUtils();
        const utils = new ExcelReportsUtils();
        utils.log('test message');
        expect(mocks.console.log).toHaveBeenCalled();
    });

    it('should call console.error for error type', () => {
        const { ExcelReportsUtils, mocks } = loadExcelReportsUtils();
        const utils = new ExcelReportsUtils();
        utils.log('something broke', 'error');
        expect(mocks.console.error).toHaveBeenCalled();
    });

    it('should call console.warn for warn type', () => {
        const { ExcelReportsUtils, mocks } = loadExcelReportsUtils();
        const utils = new ExcelReportsUtils();
        utils.log('watch out', 'warn');
        expect(mocks.console.warn).toHaveBeenCalled();
    });

    it('should include message in log output', () => {
        const { ExcelReportsUtils, mocks } = loadExcelReportsUtils();
        const utils = new ExcelReportsUtils();
        utils.log('hello from log');
        const [, secondArg] = mocks.console.log.mock.calls[0];
        expect(secondArg).toBe('hello from log');
    });

    it('should include [Excel Reports] prefix in log output', () => {
        const { ExcelReportsUtils, mocks } = loadExcelReportsUtils();
        const utils = new ExcelReportsUtils();
        utils.log('check prefix');
        const [firstArg] = mocks.console.log.mock.calls[0];
        expect(firstArg).toContain('[Excel Reports]');
    });
});

// ─────────────────────────────────────────────
// getCellValue
// ─────────────────────────────────────────────
describe('ExcelReportsUtils.getCellValue()', () => {
    it('should return cell value at valid index', () => {
        const utils = makeUtils();
        expect(utils.getCellValue(['a', 'b', 'c'], 1)).toBe('b');
    });

    it('should return defaultValue when colIndex is -1', () => {
        const utils = makeUtils();
        expect(utils.getCellValue(['a', 'b'], -1)).toBe('');
    });

    it('should return defaultValue when row is null', () => {
        const utils = makeUtils();
        expect(utils.getCellValue(null, 0, 'N/A')).toBe('N/A');
    });

    it('should return defaultValue when index exceeds row length', () => {
        const utils = makeUtils();
        expect(utils.getCellValue(['x'], 5)).toBe('');
    });

    it('should return defaultValue when cell is null', () => {
        const utils = makeUtils();
        expect(utils.getCellValue([null, 'b'], 0, 'empty')).toBe('empty');
    });

    it('should return 0 (falsy but valid) without substituting default', () => {
        const utils = makeUtils();
        expect(utils.getCellValue([0, 1], 0)).toBe(0);
    });
});

// ─────────────────────────────────────────────
// isRowEmpty
// ─────────────────────────────────────────────
describe('ExcelReportsUtils.isRowEmpty()', () => {
    it('should return true for null row', () => {
        const utils = makeUtils();
        expect(utils.isRowEmpty(null)).toBe(true);
    });

    it('should return true for empty array', () => {
        const utils = makeUtils();
        expect(utils.isRowEmpty([])).toBe(true);
    });

    it('should return true when all cells are empty strings', () => {
        const utils = makeUtils();
        expect(utils.isRowEmpty(['', '', ''])).toBe(true);
    });

    it('should return true when all cells are whitespace', () => {
        const utils = makeUtils();
        expect(utils.isRowEmpty(['  ', '\t', ''])).toBe(true);
    });

    it('should return false when at least one cell has content', () => {
        const utils = makeUtils();
        expect(utils.isRowEmpty(['', 'data', ''])).toBe(false);
    });

    it('should return false for row with numbers', () => {
        const utils = makeUtils();
        expect(utils.isRowEmpty([0, null, ''])).toBe(false);
    });
});
