import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const teamUtilsCode = readFileSync(
    resolve(__dirname, '../../team-info/js/modules/team-utils.js'),
    'utf-8'
);

/**
 * TeamUtils uses document.createElement internally in escapeHtml.
 * We run in jsdom environment (vitest.config.js), so the global document is available.
 * We inject it explicitly via new Function to match the module's lexical scope.
 */
function loadTeamUtils() {
    const fn = new Function('document', `${teamUtilsCode}\nreturn TeamUtils;`);
    return fn(document);
}

// ─────────────────────────────────────────────
// escapeHtml
// ─────────────────────────────────────────────
describe('TeamUtils.escapeHtml()', () => {
    it('should return plain text unchanged', () => {
        const utils = loadTeamUtils();
        expect(utils.escapeHtml('Hello world')).toBe('Hello world');
    });

    it('should escape < and > characters', () => {
        const utils = loadTeamUtils();
        const result = utils.escapeHtml('<script>alert(1)</script>');
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
    });

    it('should escape & ampersand', () => {
        const utils = loadTeamUtils();
        const result = utils.escapeHtml('foo & bar');
        expect(result).toContain('&amp;');
    });

    it('should preserve double quotes (safe in text content)', () => {
        const utils = loadTeamUtils();
        const result = utils.escapeHtml('"quoted"');
        // textContent→innerHTML pattern does not escape quotes (safe in text nodes)
        expect(result).toBe('"quoted"');
    });

    it('should handle XSS vector: img onerror', () => {
        const utils = loadTeamUtils();
        const result = utils.escapeHtml('<img src=x onerror=alert(1)>');
        expect(result).not.toContain('<img');
        expect(result).toContain('&lt;');
    });

    it('should handle XSS vector: javascript: href', () => {
        const utils = loadTeamUtils();
        const result = utils.escapeHtml('<a href="javascript:void(0)">click</a>');
        expect(result).toContain('&lt;');
        expect(result).not.toContain('<a ');
    });

    it('should handle XSS vector: svg onload', () => {
        const utils = loadTeamUtils();
        const result = utils.escapeHtml('<svg onload=alert(1)>');
        expect(result).not.toContain('<svg');
    });

    it('should return empty string for null input', () => {
        const utils = loadTeamUtils();
        expect(utils.escapeHtml(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
        const utils = loadTeamUtils();
        expect(utils.escapeHtml(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
        const utils = loadTeamUtils();
        expect(utils.escapeHtml('')).toBe('');
    });

    it('should handle numeric input coerced via || ""', () => {
        const utils = loadTeamUtils();
        // Numbers are truthy — they get set as textContent and come back as string
        expect(utils.escapeHtml(42)).toBe('42');
    });

    it('should preserve cyrillic characters', () => {
        const utils = loadTeamUtils();
        expect(utils.escapeHtml('Иванов Иван Иванович')).toBe('Иванов Иван Иванович');
    });

    it('should handle multiple special characters', () => {
        const utils = loadTeamUtils();
        const result = utils.escapeHtml('<b>bold</b> & "quoted"');
        expect(result).toContain('&lt;b&gt;');
        expect(result).toContain('&amp;');
    });
});

// ─────────────────────────────────────────────
// isValidImageUrl
// ─────────────────────────────────────────────
describe('TeamUtils.isValidImageUrl()', () => {
    it('should return true for https:// URL', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('https://example.com/avatar.png')).toBe(true);
    });

    it('should return true for http:// URL', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('http://example.com/avatar.jpg')).toBe(true);
    });

    it('should return true for data:image/ URL', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('data:image/png;base64,abc123')).toBe(true);
    });

    it('should return true for data:image/jpeg URL', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('data:image/jpeg;base64,/9j/4AA')).toBe(true);
    });

    it('should return false for empty string', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('')).toBe(false);
    });

    it('should return false for null', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl(null)).toBe(false);
    });

    it('should return false for undefined', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl(undefined)).toBe(false);
    });

    it('should return false for javascript: protocol (XSS vector)', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('javascript:alert(1)')).toBe(false);
    });

    it('should return false for ftp:// URL', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('ftp://files.example.com/img.png')).toBe(false);
    });

    it('should return false for relative path', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('/images/avatar.png')).toBe(false);
    });

    it('should return false for data: URL that is not an image', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('data:text/html;<script>alert(1)</script>')).toBe(false);
    });

    it('should return false for blob: URL (not in allowed list)', () => {
        const utils = loadTeamUtils();
        expect(utils.isValidImageUrl('blob:https://example.com/some-uuid')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// formatDate
// ─────────────────────────────────────────────
describe('TeamUtils.formatDate()', () => {
    it('should return empty string for null', () => {
        const utils = loadTeamUtils();
        expect(utils.formatDate(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
        const utils = loadTeamUtils();
        expect(utils.formatDate(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
        const utils = loadTeamUtils();
        expect(utils.formatDate('')).toBe('');
    });

    it('should format ISO date string to dd.mm.yyyy', () => {
        const utils = loadTeamUtils();
        const result = utils.formatDate('2024-03-15');
        expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
        expect(result).toContain('2024');
    });

    it('should format full ISO datetime string', () => {
        const utils = loadTeamUtils();
        const result = utils.formatDate('2024-06-01T10:30:00Z');
        expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
        expect(result).toContain('2024');
    });

    it('should handle year-only edge date 2000-01-01', () => {
        const utils = loadTeamUtils();
        const result = utils.formatDate('2000-01-01');
        expect(result).toContain('2000');
    });

    it('should produce two-digit day and month', () => {
        const utils = loadTeamUtils();
        // 2024-03-05 should give 05.03.2024
        const result = utils.formatDate('2024-03-05T12:00:00');
        expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    });
});

// ─────────────────────────────────────────────
// getStatusClass
// ─────────────────────────────────────────────
describe('TeamUtils.getStatusClass()', () => {
    it('should return "green" for "Работает"', () => {
        const utils = loadTeamUtils();
        expect(utils.getStatusClass('Работает')).toBe('green');
    });

    it('should return "yellow" for "В отпуске"', () => {
        const utils = loadTeamUtils();
        expect(utils.getStatusClass('В отпуске')).toBe('yellow');
    });

    it('should return "blue" for "Командировка"', () => {
        const utils = loadTeamUtils();
        expect(utils.getStatusClass('Командировка')).toBe('blue');
    });

    it('should return "red" for "Уволен"', () => {
        const utils = loadTeamUtils();
        expect(utils.getStatusClass('Уволен')).toBe('red');
    });

    it('should return "purple" for "Болеет"', () => {
        const utils = loadTeamUtils();
        expect(utils.getStatusClass('Болеет')).toBe('purple');
    });

    it('should return "green" as default for unknown status', () => {
        const utils = loadTeamUtils();
        expect(utils.getStatusClass('Неизвестный статус')).toBe('green');
    });

    it('should return "green" for null', () => {
        const utils = loadTeamUtils();
        expect(utils.getStatusClass(null)).toBe('green');
    });

    it('should return "green" for undefined', () => {
        const utils = loadTeamUtils();
        expect(utils.getStatusClass(undefined)).toBe('green');
    });

    it('should return "green" for empty string', () => {
        const utils = loadTeamUtils();
        expect(utils.getStatusClass('')).toBe('green');
    });

    it('should be case-sensitive (lowercase does not match)', () => {
        const utils = loadTeamUtils();
        // 'работает' !== 'Работает' → fallback green
        expect(utils.getStatusClass('работает')).toBe('green');
    });
});

// ─────────────────────────────────────────────
// formatFullNameForTable
// ─────────────────────────────────────────────
describe('TeamUtils.formatFullNameForTable()', () => {
    it('should return empty string for null', () => {
        const utils = loadTeamUtils();
        expect(utils.formatFullNameForTable(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
        const utils = loadTeamUtils();
        expect(utils.formatFullNameForTable(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
        const utils = loadTeamUtils();
        expect(utils.formatFullNameForTable('')).toBe('');
    });

    it('should return single word as-is (escaped)', () => {
        const utils = loadTeamUtils();
        expect(utils.formatFullNameForTable('Иванов')).toBe('Иванов');
    });

    it('should return two words joined by space (no <br>)', () => {
        const utils = loadTeamUtils();
        const result = utils.formatFullNameForTable('Иванов Иван');
        expect(result).toBe('Иванов Иван');
        expect(result).not.toContain('<br>');
    });

    it('should split three-part name: first two words then <br> then patronymic', () => {
        const utils = loadTeamUtils();
        const result = utils.formatFullNameForTable('Иванов Иван Иванович');
        expect(result).toBe('Иванов Иван<br>Иванович');
    });

    it('should handle extra whitespace between parts', () => {
        const utils = loadTeamUtils();
        const result = utils.formatFullNameForTable('  Иванов   Иван   Иванович  ');
        expect(result).toBe('Иванов Иван<br>Иванович');
    });

    it('should handle four-part name: patronymic includes third and fourth words', () => {
        const utils = loadTeamUtils();
        const result = utils.formatFullNameForTable('Де Ла Круз Иван');
        // parts: ['Де', 'Ла', 'Круз', 'Иван'] → lastName=Де, firstName=Ла, patronymic=Круз Иван
        expect(result).toBe('Де Ла<br>Круз Иван');
    });

    it('should escape HTML in single-word name', () => {
        const utils = loadTeamUtils();
        const result = utils.formatFullNameForTable('<script>');
        expect(result).toContain('&lt;');
        expect(result).not.toContain('<script>');
    });

    it('should escape HTML in three-part name parts', () => {
        const utils = loadTeamUtils();
        const result = utils.formatFullNameForTable('<b> Иван <b>');
        expect(result).not.toContain('<b>');
    });

    it('should handle name with only whitespace as empty', () => {
        const utils = loadTeamUtils();
        // trim() + split(/\s+/) on whitespace-only → [''] → length 1 → escapeHtml('') = ''
        expect(utils.formatFullNameForTable('   ')).toBe('');
    });
});
