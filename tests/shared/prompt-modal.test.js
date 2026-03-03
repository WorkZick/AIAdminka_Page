import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '../../shared/js/prompt-modal.js'), 'utf-8');

function loadPromptModal() {
    const fn = new Function('document', `${code}\nreturn PromptModal;`);
    return fn(document);
}

describe('PromptModal', () => {
    let PromptModal;

    beforeEach(() => {
        document.body.innerHTML = '';
        PromptModal = loadPromptModal();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        PromptModal._overlay = null;
    });

    describe('show()', () => {
        it('should return a Promise', () => {
            const result = PromptModal.show('Введите имя:');
            expect(result).toBeInstanceOf(Promise);
            PromptModal._remove();
        });

        it('should create overlay in DOM', () => {
            PromptModal.show('Введите имя:');
            const overlay = document.getElementById('promptModalOverlay');
            expect(overlay).not.toBeNull();
            expect(overlay.classList.contains('modal')).toBe(true);
            expect(overlay.classList.contains('active')).toBe(true);
            PromptModal._remove();
        });

        it('should create overlay with input element', () => {
            PromptModal.show('Введите имя:');
            const input = document.querySelector('.prompt-modal-input');
            expect(input).not.toBeNull();
            expect(input.tagName).toBe('INPUT');
            expect(input.type).toBe('text');
            PromptModal._remove();
        });

        it('should render message text in DOM', () => {
            PromptModal.show('Введите название:');
            const msg = document.querySelector('.modal-message');
            expect(msg).not.toBeNull();
            expect(msg.textContent).toBe('Введите название:');
            PromptModal._remove();
        });

        it('should use default confirmText "OK"', () => {
            PromptModal.show('Введите:');
            const okBtn = document.querySelector('[data-prompt="ok"]');
            expect(okBtn.textContent).toBe('OK');
            PromptModal._remove();
        });

        it('should use custom confirmText when provided', () => {
            PromptModal.show('Выберите:', { confirmText: 'Выбрать' });
            const okBtn = document.querySelector('[data-prompt="ok"]');
            expect(okBtn.textContent).toBe('Выбрать');
            PromptModal._remove();
        });

        it('should use default cancelText "Отмена"', () => {
            PromptModal.show('Введите:');
            const cancelBtn = document.querySelector('[data-prompt="cancel"]');
            expect(cancelBtn.textContent).toBe('Отмена');
            PromptModal._remove();
        });
    });

    describe('defaultValue', () => {
        it('should set input value to defaultValue', () => {
            PromptModal.show('Название:', { defaultValue: 'Мой шаблон' });
            const input = document.querySelector('.prompt-modal-input');
            expect(input.value).toBe('Мой шаблон');
            PromptModal._remove();
        });

        it('should set empty string when defaultValue not provided', () => {
            PromptModal.show('Введите:');
            const input = document.querySelector('.prompt-modal-input');
            expect(input.value).toBe('');
            PromptModal._remove();
        });

        it('should set placeholder when provided', () => {
            PromptModal.show('Номер:', { placeholder: '1-5' });
            const input = document.querySelector('.prompt-modal-input');
            expect(input.placeholder).toBe('1-5');
            PromptModal._remove();
        });
    });

    describe('click on "ok" button', () => {
        it('should resolve with input value', async () => {
            const promise = PromptModal.show('Введите имя:');
            const input = document.querySelector('.prompt-modal-input');
            input.value = 'Иван';
            const okBtn = document.querySelector('[data-prompt="ok"]');
            okBtn.click();
            const result = await promise;
            expect(result).toBe('Иван');
        });

        it('should resolve with empty string if input is empty', async () => {
            const promise = PromptModal.show('Введите:');
            const okBtn = document.querySelector('[data-prompt="ok"]');
            okBtn.click();
            const result = await promise;
            expect(result).toBe('');
        });

        it('should resolve with defaultValue if not changed', async () => {
            const promise = PromptModal.show('Название:', { defaultValue: 'Мой шаблон' });
            const okBtn = document.querySelector('[data-prompt="ok"]');
            okBtn.click();
            const result = await promise;
            expect(result).toBe('Мой шаблон');
        });

        it('should remove overlay from DOM after ok click', async () => {
            const promise = PromptModal.show('Введите:');
            document.querySelector('[data-prompt="ok"]').click();
            await promise;
            expect(document.getElementById('promptModalOverlay')).toBeNull();
        });
    });

    describe('click on "cancel" button', () => {
        it('should resolve with null', async () => {
            const promise = PromptModal.show('Введите:');
            document.querySelector('[data-prompt="cancel"]').click();
            const result = await promise;
            expect(result).toBeNull();
        });

        it('should resolve with null even if input has value', async () => {
            const promise = PromptModal.show('Введите:');
            const input = document.querySelector('.prompt-modal-input');
            input.value = 'что-то введено';
            document.querySelector('[data-prompt="cancel"]').click();
            const result = await promise;
            expect(result).toBeNull();
        });

        it('should remove overlay from DOM after cancel click', async () => {
            const promise = PromptModal.show('Введите:');
            document.querySelector('[data-prompt="cancel"]').click();
            await promise;
            expect(document.getElementById('promptModalOverlay')).toBeNull();
        });
    });

    describe('keyboard navigation', () => {
        it('should resolve with null on Escape key', async () => {
            const promise = PromptModal.show('Escape test');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            const result = await promise;
            expect(result).toBeNull();
        });

        it('should resolve with input value on Enter key', async () => {
            const promise = PromptModal.show('Enter test');
            const input = document.querySelector('.prompt-modal-input');
            input.value = 'набрано значение';
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            const result = await promise;
            expect(result).toBe('набрано значение');
        });

        it('should resolve with empty string on Enter when input is empty', async () => {
            const promise = PromptModal.show('Enter test');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            const result = await promise;
            expect(result).toBe('');
        });

        it('should remove overlay after Escape', async () => {
            const promise = PromptModal.show('Escape test');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await promise;
            expect(document.getElementById('promptModalOverlay')).toBeNull();
        });

        it('should remove overlay after Enter', async () => {
            const promise = PromptModal.show('Enter test');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await promise;
            expect(document.getElementById('promptModalOverlay')).toBeNull();
        });
    });

    describe('_escapeAttr()', () => {
        it('should escape double quotes', () => {
            expect(PromptModal._escapeAttr('"quoted"')).toBe('&quot;quoted&quot;');
        });

        it('should escape ampersands', () => {
            expect(PromptModal._escapeAttr('a & b')).toBe('a &amp; b');
        });

        it('should escape angle brackets', () => {
            expect(PromptModal._escapeAttr('<script>')).toBe('&lt;script&gt;');
        });

        it('should escape all special chars together', () => {
            expect(PromptModal._escapeAttr('<a href="test&value">')).toBe(
                '&lt;a href=&quot;test&amp;value&quot;&gt;'
            );
        });

        it('should return empty string for falsy input', () => {
            expect(PromptModal._escapeAttr('')).toBe('');
            expect(PromptModal._escapeAttr(null)).toBe('');
            expect(PromptModal._escapeAttr(undefined)).toBe('');
        });

        it('should return plain text unchanged', () => {
            expect(PromptModal._escapeAttr('hello world')).toBe('hello world');
        });
    });

    describe('_remove()', () => {
        it('should remove overlay from DOM', () => {
            PromptModal.show('test');
            expect(document.getElementById('promptModalOverlay')).not.toBeNull();
            PromptModal._remove();
            expect(document.getElementById('promptModalOverlay')).toBeNull();
        });

        it('should set _overlay to null', () => {
            PromptModal.show('test');
            expect(PromptModal._overlay).not.toBeNull();
            PromptModal._remove();
            expect(PromptModal._overlay).toBeNull();
        });

        it('should not throw if called when no overlay exists', () => {
            PromptModal._overlay = null;
            expect(() => PromptModal._remove()).not.toThrow();
        });
    });

    describe('repeated show() calls', () => {
        it('should remove previous modal when show() is called again', async () => {
            PromptModal.show('First modal');
            const secondPromise = PromptModal.show('Second modal');

            const overlays = document.querySelectorAll('#promptModalOverlay');
            expect(overlays.length).toBe(1);

            document.querySelector('[data-prompt="cancel"]').click();
            await secondPromise;
        });

        it('should show message of second modal, not first', async () => {
            PromptModal.show('First modal');
            const secondPromise = PromptModal.show('Second modal');

            const msg = document.querySelector('.modal-message');
            expect(msg.textContent).toBe('Second modal');

            document.querySelector('[data-prompt="cancel"]').click();
            await secondPromise;
        });

        it('should have correct defaultValue for second modal', async () => {
            PromptModal.show('First', { defaultValue: 'first-value' });
            const secondPromise = PromptModal.show('Second', { defaultValue: 'second-value' });

            const input = document.querySelector('.prompt-modal-input');
            expect(input.value).toBe('second-value');

            document.querySelector('[data-prompt="cancel"]').click();
            await secondPromise;
        });
    });
});
