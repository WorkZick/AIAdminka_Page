import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '../../shared/js/toast.js'), 'utf-8');

/**
 * Toast обращается к глобальному document и использует module.exports.
 * Загружаем через new Function, передавая jsdom document.
 * Каждый тест получает чистую копию объекта с container: null.
 */
function loadToast() {
    const fn = new Function('document', 'module', `
        ${code}
        return Toast;
    `);
    const mod = { exports: {} };
    const toast = fn(document, mod);
    // Гарантируем чистое состояние для каждого теста
    toast.container = null;
    return toast;
}

// ─────────────────────────────────────────────
// init
// ─────────────────────────────────────────────
describe('Toast.init', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create container element and append to body', () => {
        const Toast = loadToast();
        Toast.init();
        const container = document.querySelector('.toast-container');
        expect(container).not.toBeNull();
    });

    it('should set container property', () => {
        const Toast = loadToast();
        expect(Toast.container).toBeNull();
        Toast.init();
        expect(Toast.container).not.toBeNull();
    });

    it('should not create duplicate container on second init call', () => {
        const Toast = loadToast();
        Toast.init();
        Toast.init();
        const containers = document.querySelectorAll('.toast-container');
        expect(containers.length).toBe(1);
    });

    it('should assign class "toast-container" to created element', () => {
        const Toast = loadToast();
        Toast.init();
        expect(Toast.container.className).toBe('toast-container');
    });
});

// ─────────────────────────────────────────────
// show
// ─────────────────────────────────────────────
describe('Toast.show', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create toast element and append to container', () => {
        const Toast = loadToast();
        Toast.show('Hello');
        const toast = document.querySelector('.toast-notification');
        expect(toast).not.toBeNull();
    });

    it('should apply correct type class', () => {
        const Toast = loadToast();
        Toast.show('Error!', 'error');
        const toast = document.querySelector('.toast-notification');
        expect(toast.classList.contains('toast-error')).toBe(true);
    });

    it('should apply "toast-success" class for success type', () => {
        const Toast = loadToast();
        Toast.show('OK', 'success');
        expect(document.querySelector('.toast-success')).not.toBeNull();
    });

    it('should apply "toast-warning" class for warning type', () => {
        const Toast = loadToast();
        Toast.show('Warn', 'warning');
        expect(document.querySelector('.toast-warning')).not.toBeNull();
    });

    it('should apply "toast-info" class for info type (default)', () => {
        const Toast = loadToast();
        Toast.show('Info msg');
        expect(document.querySelector('.toast-info')).not.toBeNull();
    });

    it('should contain .toast-message element', () => {
        const Toast = loadToast();
        Toast.show('Test message');
        const msg = document.querySelector('.toast-message');
        expect(msg).not.toBeNull();
    });

    it('should contain .toast-close button', () => {
        const Toast = loadToast();
        Toast.show('Test');
        const closeBtn = document.querySelector('.toast-close');
        expect(closeBtn).not.toBeNull();
    });

    it('should return the toast element', () => {
        const Toast = loadToast();
        const el = Toast.show('Return value test');
        expect(el).toBeInstanceOf(HTMLElement);
    });

    it('should auto-init container if not initialized', () => {
        const Toast = loadToast();
        expect(Toast.container).toBeNull();
        Toast.show('Auto init');
        expect(Toast.container).not.toBeNull();
    });

    /*
     * SECURITY BUG: message вставляется через innerHTML (не textContent).
     * Это XSS-уязвимость: злоумышленник может передать HTML/JS в сообщении.
     * Пример: Toast.show('<img src=x onerror=alert(1)>')
     * Рекомендация: использовать textContent или Utils.escapeHtml() перед вставкой.
     *
     * Тест намеренно документирует это поведение как регрессионную проверку:
     * если метод будет исправлен (переход на textContent), тест начнёт падать
     * и напомнит обновить его.
     */
    it('XSS FIXED: message with HTML tags is safely escaped via textContent', () => {
        const Toast = loadToast();
        const malicious = '<b id="injected">injected</b>';
        Toast.show(malicious);
        // After XSS fix: message is set via textContent, HTML tags are NOT parsed
        const injectedEl = document.getElementById('injected');
        expect(injectedEl).toBeNull(); // textContent does not parse HTML
        // Verify the raw HTML string is displayed as text
        const msgEl = document.querySelector('.toast-message');
        expect(msgEl.textContent).toBe(malicious);
    });

    it('should schedule auto-close via setTimeout when duration > 0', () => {
        vi.useFakeTimers();
        const Toast = loadToast();
        const el = Toast.show('Auto close', 'info', 3000);

        expect(el.classList.contains('hide')).toBe(false);

        vi.advanceTimersByTime(3000);
        // После таймера элемент получает класс 'hide'
        expect(el.classList.contains('hide')).toBe(true);

        vi.useRealTimers();
    });

    it('should NOT auto-close when duration is 0', () => {
        vi.useFakeTimers();
        const Toast = loadToast();
        const el = Toast.show('No auto close', 'info', 0);

        vi.advanceTimersByTime(10000);
        expect(el.classList.contains('hide')).toBe(false);

        vi.useRealTimers();
    });
});

// ─────────────────────────────────────────────
// close
// ─────────────────────────────────────────────
describe('Toast.close', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should add "hide" class and remove "show" class from element', () => {
        const Toast = loadToast();
        const el = Toast.show('Close me');
        Toast.close(el);
        expect(el.classList.contains('hide')).toBe(true);
        expect(el.classList.contains('show')).toBe(false);
    });

    it('should remove element from DOM after 300ms animation delay', () => {
        vi.useFakeTimers();
        const Toast = loadToast();
        const el = Toast.show('Remove me');

        Toast.close(el);
        expect(el.parentElement).not.toBeNull(); // Ещё в DOM

        vi.advanceTimersByTime(300);
        expect(el.parentElement).toBeNull(); // Удалён

        vi.useRealTimers();
    });

    it('should not throw when called with null', () => {
        const Toast = loadToast();
        expect(() => Toast.close(null)).not.toThrow();
    });

    it('should not double-close: skip if already has "hide" class', () => {
        vi.useFakeTimers();
        const Toast = loadToast();
        const el = Toast.show('Double close test');

        Toast.close(el);
        // Элемент уже в состоянии hide — повторный вызов не должен ничего делать
        expect(() => Toast.close(el)).not.toThrow();

        vi.useRealTimers();
    });

    it('should close toast when close button is clicked', () => {
        const Toast = loadToast();
        const el = Toast.show('Click close');
        const closeBtn = el.querySelector('.toast-close');
        closeBtn.click();
        expect(el.classList.contains('hide')).toBe(true);
    });
});

// ─────────────────────────────────────────────
// success / error / warning / info shortcuts
// ─────────────────────────────────────────────
describe('Toast.success', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('should call show with type "success"', () => {
        const Toast = loadToast();
        const spy = vi.spyOn(Toast, 'show');
        Toast.success('All good');
        expect(spy).toHaveBeenCalledWith('All good', 'success', expect.any(Number));
    });

    it('should create element with toast-success class', () => {
        const Toast = loadToast();
        Toast.success('Done');
        expect(document.querySelector('.toast-success')).not.toBeNull();
    });

    it('should use default duration 4000ms', () => {
        const Toast = loadToast();
        const spy = vi.spyOn(Toast, 'show');
        Toast.success('ok');
        expect(spy).toHaveBeenCalledWith('ok', 'success', 4000);
    });
});

describe('Toast.error', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('should call show with type "error"', () => {
        const Toast = loadToast();
        const spy = vi.spyOn(Toast, 'show');
        Toast.error('Broke');
        expect(spy).toHaveBeenCalledWith('Broke', 'error', expect.any(Number));
    });

    it('should create element with toast-error class', () => {
        const Toast = loadToast();
        Toast.error('Oops');
        expect(document.querySelector('.toast-error')).not.toBeNull();
    });

    it('should use default duration 5000ms (longer than others)', () => {
        const Toast = loadToast();
        const spy = vi.spyOn(Toast, 'show');
        Toast.error('err');
        expect(spy).toHaveBeenCalledWith('err', 'error', 5000);
    });
});

describe('Toast.warning', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('should call show with type "warning"', () => {
        const Toast = loadToast();
        const spy = vi.spyOn(Toast, 'show');
        Toast.warning('Watch out');
        expect(spy).toHaveBeenCalledWith('Watch out', 'warning', expect.any(Number));
    });

    it('should create element with toast-warning class', () => {
        const Toast = loadToast();
        Toast.warning('Careful');
        expect(document.querySelector('.toast-warning')).not.toBeNull();
    });
});

describe('Toast.info', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('should call show with type "info"', () => {
        const Toast = loadToast();
        const spy = vi.spyOn(Toast, 'show');
        Toast.info('FYI');
        expect(spy).toHaveBeenCalledWith('FYI', 'info', expect.any(Number));
    });

    it('should create element with toast-info class', () => {
        const Toast = loadToast();
        Toast.info('Note');
        expect(document.querySelector('.toast-info')).not.toBeNull();
    });
});

// ─────────────────────────────────────────────
// multiple toasts
// ─────────────────────────────────────────────
describe('Toast — multiple notifications', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('should allow multiple simultaneous toast notifications', () => {
        const Toast = loadToast();
        Toast.show('First', 'info', 0);
        Toast.show('Second', 'error', 0);
        Toast.show('Third', 'success', 0);

        const toasts = document.querySelectorAll('.toast-notification');
        expect(toasts.length).toBe(3);
    });

    it('should have separate close buttons for each notification', () => {
        const Toast = loadToast();
        Toast.show('A', 'info', 0);
        Toast.show('B', 'info', 0);

        const closeBtns = document.querySelectorAll('.toast-close');
        expect(closeBtns.length).toBe(2);
    });
});
