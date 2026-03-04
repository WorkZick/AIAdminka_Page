import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../partners/js/modules/partners-utils.js'),
    'utf-8'
);

/**
 * PartnersUtils references:
 *   - document  (for escapeHtml via createElement, and DOM methods in showLoading/showConfirm/showPrompt)
 *   - PartnersState (for isLoading in showLoading)
 *   - Toast (for showError)
 *
 * We inject all dependencies via new Function and use jsdom's document global
 * where DOM access is needed.
 */
function loadPartnersUtils({ mockPartnersState = null, mockToast = null, mockDocument = null } = {}) {
    const defaultState = {
        isLoading: false
    };

    const state = mockPartnersState || defaultState;

    const defaultToast = {
        error: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
        info: vi.fn()
    };

    const toast = mockToast || defaultToast;

    // Use jsdom's real document for DOM-based tests unless overridden
    const doc = mockDocument || document;

    const fn = new Function(
        'PartnersState', 'Toast', 'document', 'setTimeout',
        `${code}\nreturn PartnersUtils;`
    );

    return {
        PartnersUtils: fn(state, toast, doc, setTimeout),
        mockState: state,
        mockToast: toast
    };
}

// ─────────────────────────────────────────────
// escapeHtml
// ─────────────────────────────────────────────
describe('PartnersUtils.escapeHtml', () => {
    it('should escape < and > to HTML entities', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('should escape & to &amp;', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.escapeHtml('AT&T')).toBe('AT&amp;T');
    });

    it('should preserve double quotes (safe in text content)', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const result = PartnersUtils.escapeHtml('"hello"');
        // textContent→innerHTML does not escape quotes (safe in text nodes)
        expect(result).toBe('"hello"');
    });

    it('should return plain text unchanged when no special characters', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.escapeHtml('hello world')).toBe('hello world');
    });

    it('should escape XSS payload', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const input = '<img src=x onerror=alert(1)>';
        const result = PartnersUtils.escapeHtml(input);
        expect(result).not.toContain('<img');
        expect(result).toContain('&lt;img');
    });

    it('should handle empty string without throwing', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.escapeHtml('')).toBe('');
    });

    it('should handle string with only special characters', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const result = PartnersUtils.escapeHtml('<>&"');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
        expect(result).toContain('&amp;');
    });

    it('should handle numeric-coercible values (number as input)', () => {
        const { PartnersUtils } = loadPartnersUtils();
        // document.createElement('div').textContent = 42 sets textContent to "42"
        // and innerHTML returns "42" — no crash
        const mockDoc = {
            createElement: () => {
                let _text = '';
                return {
                    set textContent(v) { _text = String(v); },
                    get innerHTML() { return _text; }
                };
            }
        };
        const { PartnersUtils: pu } = loadPartnersUtils({ mockDocument: mockDoc });
        expect(pu.escapeHtml(42)).toBe('42');
    });
});

// ─────────────────────────────────────────────
// isValidImageUrl
// ─────────────────────────────────────────────
describe('PartnersUtils.isValidImageUrl', () => {
    it('should return true for data URI image', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.isValidImageUrl('data:image/png;base64,abc')).toBe(true);
    });

    it('should return true for http URL', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.isValidImageUrl('http://example.com/img.jpg')).toBe(true);
    });

    it('should return true for https URL', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.isValidImageUrl('https://cdn.example.com/photo.png')).toBe(true);
    });

    it('should return false for null', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.isValidImageUrl(null)).toBe(false);
    });

    it('should return false for empty string', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.isValidImageUrl('')).toBe(false);
    });

    it('should return false for undefined', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.isValidImageUrl(undefined)).toBe(false);
    });

    it('should return false for ftp URL (not supported)', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.isValidImageUrl('ftp://example.com/img.jpg')).toBe(false);
    });

    it('should return false for relative path', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.isValidImageUrl('/images/photo.jpg')).toBe(false);
    });

    it('should return false for arbitrary string', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.isValidImageUrl('not-a-url')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// getStatusColor
// ─────────────────────────────────────────────
describe('PartnersUtils.getStatusColor', () => {
    it('should return "green" for "Открыт"', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.getStatusColor('Открыт')).toBe('green');
    });

    it('should return "red" for "Закрыт"', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.getStatusColor('Закрыт')).toBe('red');
    });

    it('should return "green" for unknown status (fallback)', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.getStatusColor('Unknown')).toBe('green');
    });

    it('should return "green" for null (fallback)', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.getStatusColor(null)).toBe('green');
    });

    it('should return "green" for undefined (fallback)', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.getStatusColor(undefined)).toBe('green');
    });

    it('should return "green" for empty string (fallback)', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(PartnersUtils.getStatusColor('')).toBe('green');
    });
});

// ─────────────────────────────────────────────
// showError — calls Toast.error
// ─────────────────────────────────────────────
describe('PartnersUtils.showError', () => {
    it('should call Toast.error with the message', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersUtils } = loadPartnersUtils({ mockToast });
        PartnersUtils.showError('Something went wrong');
        expect(mockToast.error).toHaveBeenCalledOnce();
        expect(mockToast.error).toHaveBeenCalledWith('Something went wrong');
    });

    it('should call Toast.error with empty string without throwing', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() };
        const { PartnersUtils } = loadPartnersUtils({ mockToast });
        expect(() => PartnersUtils.showError('')).not.toThrow();
        expect(mockToast.error).toHaveBeenCalledWith('');
    });
});

// ─────────────────────────────────────────────
// showLoading — interacts with PartnersState.isLoading
// ─────────────────────────────────────────────
describe('PartnersUtils.showLoading', () => {
    it('should set PartnersState.isLoading = true when show=true', () => {
        const state = { isLoading: false };
        const { PartnersUtils } = loadPartnersUtils({ mockPartnersState: state });
        // DOM elements will be null in jsdom unless created — that's fine,
        // showLoading guards with "if (el)" checks
        PartnersUtils.showLoading(true);
        expect(state.isLoading).toBe(true);
    });

    it('should set PartnersState.isLoading = false when show=false', () => {
        const state = { isLoading: true };
        const { PartnersUtils } = loadPartnersUtils({ mockPartnersState: state });
        PartnersUtils.showLoading(false);
        expect(state.isLoading).toBe(false);
    });

    it('should not throw when DOM elements are absent', () => {
        const state = { isLoading: false };
        const { PartnersUtils } = loadPartnersUtils({ mockPartnersState: state });
        expect(() => PartnersUtils.showLoading(true)).not.toThrow();
        expect(() => PartnersUtils.showLoading(false)).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// updateFileLabel
// ─────────────────────────────────────────────
describe('PartnersUtils.updateFileLabel', () => {
    it('should add "has-file" class to label', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const label = document.createElement('label');
        const mainText = document.createElement('span');
        mainText.className = 'main-text';
        const subText = document.createElement('span');
        subText.className = 'sub-text';
        label.appendChild(mainText);
        label.appendChild(subText);

        PartnersUtils.updateFileLabel(label, 'myfile.json');
        expect(label.classList.contains('has-file')).toBe(true);
    });

    it('should set main-text to the file name', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const label = document.createElement('label');
        const mainText = document.createElement('span');
        mainText.className = 'main-text';
        label.appendChild(mainText);

        PartnersUtils.updateFileLabel(label, 'report.xlsx');
        expect(mainText.textContent).toBe('report.xlsx');
    });

    it('should set sub-text to "Файл выбран"', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const label = document.createElement('label');
        const subText = document.createElement('span');
        subText.className = 'sub-text';
        label.appendChild(subText);

        PartnersUtils.updateFileLabel(label, 'data.json');
        expect(subText.textContent).toBe('Файл выбран');
    });

    it('should not throw when label is null', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(() => PartnersUtils.updateFileLabel(null, 'file.json')).not.toThrow();
    });

    it('should not throw when main-text or sub-text children are absent', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const label = document.createElement('label');
        expect(() => PartnersUtils.updateFileLabel(label, 'file.json')).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// resetFileLabel
// ─────────────────────────────────────────────
describe('PartnersUtils.resetFileLabel', () => {
    it('should remove "has-file" class from label', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const label = document.createElement('label');
        label.classList.add('has-file');
        PartnersUtils.resetFileLabel(label, 'Pick file', 'or drag here');
        expect(label.classList.contains('has-file')).toBe(false);
    });

    it('should restore main-text content', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const label = document.createElement('label');
        const mainText = document.createElement('span');
        mainText.className = 'main-text';
        mainText.textContent = 'old text';
        label.appendChild(mainText);

        PartnersUtils.resetFileLabel(label, 'Select JSON file', 'or drag here');
        expect(mainText.textContent).toBe('Select JSON file');
    });

    it('should restore sub-text content', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const label = document.createElement('label');
        const subText = document.createElement('span');
        subText.className = 'sub-text';
        subText.textContent = 'old sub';
        label.appendChild(subText);

        PartnersUtils.resetFileLabel(label, 'Select', 'hint text');
        expect(subText.textContent).toBe('hint text');
    });

    it('should not throw when label is null', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(() => PartnersUtils.resetFileLabel(null, 'main', 'sub')).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// incrementCounter / decrementCounter
// ─────────────────────────────────────────────
describe('PartnersUtils.incrementCounter', () => {
    it('should increment the input value by 1', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const input = document.createElement('input');
        input.id = 'testCounter';
        input.type = 'number';
        input.value = '5';
        document.body.appendChild(input);

        PartnersUtils.incrementCounter('testCounter');
        expect(input.value).toBe('6');

        document.body.removeChild(input);
    });

    it('should start from 0 when value is empty', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const input = document.createElement('input');
        input.id = 'testCounterEmpty';
        input.type = 'number';
        input.value = '';
        document.body.appendChild(input);

        PartnersUtils.incrementCounter('testCounterEmpty');
        expect(input.value).toBe('1');

        document.body.removeChild(input);
    });

    it('should not throw when element does not exist', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(() => PartnersUtils.incrementCounter('nonexistent')).not.toThrow();
    });
});

describe('PartnersUtils.decrementCounter', () => {
    it('should decrement the input value by 1', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const input = document.createElement('input');
        input.id = 'testDecCounter';
        input.type = 'number';
        input.value = '10';
        document.body.appendChild(input);

        PartnersUtils.decrementCounter('testDecCounter');
        expect(input.value).toBe('9');

        document.body.removeChild(input);
    });

    it('should not go below min when min is set', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const input = document.createElement('input');
        input.id = 'testDecCounterMin';
        input.type = 'number';
        input.value = '0';
        input.min = '0';
        document.body.appendChild(input);

        PartnersUtils.decrementCounter('testDecCounterMin');
        // value is 0, min is 0, new would be -1 < min → stays at 0
        expect(input.value).toBe('0');

        document.body.removeChild(input);
    });

    it('should decrement below 0 when no min is set', () => {
        const { PartnersUtils } = loadPartnersUtils();
        const input = document.createElement('input');
        input.id = 'testDecCounterNoMin';
        input.type = 'number';
        input.value = '0';
        document.body.appendChild(input);

        PartnersUtils.decrementCounter('testDecCounterNoMin');
        expect(input.value).toBe('-1');

        document.body.removeChild(input);
    });

    it('should not throw when element does not exist', () => {
        const { PartnersUtils } = loadPartnersUtils();
        expect(() => PartnersUtils.decrementCounter('nonexistent')).not.toThrow();
    });
});
