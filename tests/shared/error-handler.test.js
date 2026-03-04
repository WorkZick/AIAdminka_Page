import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '../../shared/js/error-handler.js'), 'utf-8');

/**
 * ErrorHandler — IIFE, возвращает объект с публичным API.
 * Загружаем свежую копию перед каждым тестом, чтобы errorHistory был пуст.
 * Toast передаётся как глобал через замыкание new Function.
 */
function loadErrorHandler({ mockToast = null } = {}) {
    const defaultToast = {
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        success: vi.fn()
    };
    const toast = mockToast || defaultToast;

    const fn = new Function('Toast', 'window', 'console', `
        ${code}
        return ErrorHandler;
    `);

    const mockWindow = {};
    const eh = fn(toast, mockWindow, console);
    return { ErrorHandler: eh, mockToast: toast };
}

// ─────────────────────────────────────────────
// handle — базовые сценарии
// ─────────────────────────────────────────────
describe('ErrorHandler.handle', () => {
    it('should return errorInfo object with expected fields', () => {
        const { ErrorHandler } = loadErrorHandler();
        const err = new Error('Something broke');
        const info = ErrorHandler.handle(err, {}, { silent: true });

        expect(info).toHaveProperty('timestamp');
        expect(info).toHaveProperty('type');
        expect(info).toHaveProperty('severity');
        expect(info).toHaveProperty('message');
        expect(info).toHaveProperty('context');
        expect(info).toHaveProperty('originalError');
    });

    it('should accept Error object', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('Test error'), {}, { silent: true });
        expect(info.message).toBe('Test error');
    });

    it('should accept string and convert to Error internally', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle('Plain string error', {}, { silent: true });
        expect(info.message).toBe('Plain string error');
        expect(info.originalError).toBeInstanceOf(Error);
    });

    it('should include context module in errorInfo', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('ctx'), { module: 'partners', action: 'load' }, { silent: true });
        expect(info.context.module).toBe('partners');
        expect(info.context.action).toBe('load');
    });

    it('should store error in history', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.handle(new Error('tracked'), {}, { silent: true });
        expect(ErrorHandler.getHistory()).toHaveLength(1);
    });

    it('should call Toast.error for high severity errors', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });
        ErrorHandler.configure({ showToast: true, logToConsole: false });

        ErrorHandler.handle(new Error('network error'), { type: 'network' });
        expect(mockToast.error).toHaveBeenCalled();
    });

    it('should call Toast.warning for medium severity errors', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });
        ErrorHandler.configure({ showToast: true, logToConsole: false });

        ErrorHandler.handle(new Error('validation failed'), { type: 'validation' });
        expect(mockToast.warning).toHaveBeenCalled();
    });

    it('should call Toast.info for low severity errors', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });
        ErrorHandler.configure({ showToast: true, logToConsole: false });

        ErrorHandler.handle(new Error('quota exceeded'), { type: 'quota' });
        expect(mockToast.info).toHaveBeenCalled();
    });

    it('should NOT call Toast when silent:true', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });
        ErrorHandler.handle(new Error('silent'), {}, { silent: true });
        expect(mockToast.error).not.toHaveBeenCalled();
        expect(mockToast.warning).not.toHaveBeenCalled();
        expect(mockToast.info).not.toHaveBeenCalled();
    });

    it('should use context.type when provided instead of auto-detection', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('random'), { type: 'auth' }, { silent: true });
        expect(info.type).toBe('auth');
    });

    it('should use context.severity when provided', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('random'), { severity: 'critical' }, { silent: true });
        expect(info.severity).toBe('critical');
    });
});

// ─────────────────────────────────────────────
// detectErrorType (через публичный handle)
// ─────────────────────────────────────────────
describe('ErrorHandler — detectErrorType', () => {
    it('should detect network type for fetch-related error', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('fetch failed'), {}, { silent: true });
        expect(info.type).toBe('network');
    });

    it('should detect auth type for unauthorized message', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('unauthorized access'), {}, { silent: true });
        expect(info.type).toBe('auth');
    });

    it('should detect auth type for token error', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('token expired'), {}, { silent: true });
        expect(info.type).toBe('auth');
    });

    it('should detect permission type for forbidden message', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('forbidden resource'), {}, { silent: true });
        expect(info.type).toBe('permission');
    });

    it('should detect validation type for invalid input', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('invalid email format'), {}, { silent: true });
        expect(info.type).toBe('validation');
    });

    it('should detect not_found type for "not found" message', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('resource not found'), {}, { silent: true });
        expect(info.type).toBe('not_found');
    });

    it('should detect quota type for QuotaExceededError name', () => {
        const { ErrorHandler } = loadErrorHandler();
        const err = new Error('storage full');
        err.name = 'QuotaExceededError';
        const info = ErrorHandler.handle(err, {}, { silent: true });
        expect(info.type).toBe('quota');
    });

    it('should detect server type for status >= 500', () => {
        const { ErrorHandler } = loadErrorHandler();
        const err = new Error('server error occurred');
        const info = ErrorHandler.handle(err, {}, { silent: true });
        expect(info.type).toBe('server');
    });

    it('should return unknown for unrecognized error', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('something completely random xyz123'), {}, { silent: true });
        expect(info.type).toBe('unknown');
    });

    it('should detect network type by error.name === NetworkError', () => {
        const { ErrorHandler } = loadErrorHandler();
        const err = new Error('connection reset');
        err.name = 'NetworkError';
        const info = ErrorHandler.handle(err, {}, { silent: true });
        expect(info.type).toBe('network');
    });
});

// ─────────────────────────────────────────────
// detectSeverity (через handle)
// ─────────────────────────────────────────────
describe('ErrorHandler — detectSeverity', () => {
    it('should assign critical severity for auth type', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('auth error'), { type: 'auth' }, { silent: true });
        expect(info.severity).toBe('critical');
    });

    it('should assign high severity for network type', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('net'), { type: 'network' }, { silent: true });
        expect(info.severity).toBe('high');
    });

    it('should assign high severity for server type', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('srv'), { type: 'server' }, { silent: true });
        expect(info.severity).toBe('high');
    });

    it('should assign high severity for permission type', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('perm'), { type: 'permission' }, { silent: true });
        expect(info.severity).toBe('high');
    });

    it('should assign medium severity for validation type', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('val'), { type: 'validation' }, { silent: true });
        expect(info.severity).toBe('medium');
    });

    it('should assign medium severity for not_found type', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('nf'), { type: 'not_found' }, { silent: true });
        expect(info.severity).toBe('medium');
    });

    it('should assign low severity for quota type', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('q'), { type: 'quota' }, { silent: true });
        expect(info.severity).toBe('low');
    });

    it('should assign low severity for unknown type', () => {
        const { ErrorHandler } = loadErrorHandler();
        const info = ErrorHandler.handle(new Error('something completely xyz'), { type: 'unknown' }, { silent: true });
        expect(info.severity).toBe('low');
    });
});

// ─────────────────────────────────────────────
// getUserMessage (через Toast calls)
// ─────────────────────────────────────────────
describe('ErrorHandler — getUserMessage', () => {
    it('should use context.userMessage when provided', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });
        ErrorHandler.configure({ showToast: true, logToConsole: false });

        ErrorHandler.handle(new Error('net'), {
            type: 'network',
            userMessage: 'Кастомное сообщение'
        });
        expect(mockToast.error).toHaveBeenCalledWith('Кастомное сообщение');
    });

    it('should use error.userMessage when context.userMessage is absent', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });
        ErrorHandler.configure({ showToast: true, logToConsole: false });

        const err = new Error('broken');
        err.userMessage = 'Сообщение из объекта ошибки';
        ErrorHandler.handle(err, { type: 'network' });
        expect(mockToast.error).toHaveBeenCalledWith('Сообщение из объекта ошибки');
    });

    it('should use default message for network type', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });
        ErrorHandler.configure({ showToast: true, logToConsole: false });

        ErrorHandler.handle(new Error('fetch failed hard'), { type: 'network' });
        expect(mockToast.error).toHaveBeenCalledWith('Проблема с подключением к интернету');
    });

    it('should use default message for auth type', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });
        ErrorHandler.configure({ showToast: true, logToConsole: false });

        ErrorHandler.handle(new Error('x'), { type: 'auth' });
        expect(mockToast.error).toHaveBeenCalledWith('Ошибка авторизации. Войдите заново');
    });
});

// ─────────────────────────────────────────────
// handleAsync
// ─────────────────────────────────────────────
describe('ErrorHandler.handleAsync', () => {
    it('should resolve with value when promise resolves', async () => {
        const { ErrorHandler } = loadErrorHandler();
        const result = await ErrorHandler.handleAsync(Promise.resolve(42), {});
        expect(result).toBe(42);
    });

    it('should rethrow error when promise rejects', async () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.configure({ logToConsole: false, showToast: false });

        const failing = Promise.reject(new Error('async fail'));
        await expect(ErrorHandler.handleAsync(failing, {})).rejects.toThrow('async fail');
    });

    it('should add error to history when promise rejects', async () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.configure({ logToConsole: false, showToast: false });

        try {
            await ErrorHandler.handleAsync(Promise.reject(new Error('rejected')), {});
        } catch (e) {
            // expected
        }
        expect(ErrorHandler.getHistory()).toHaveLength(1);
    });

    it('should call handle with provided context on rejection', async () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });
        ErrorHandler.configure({ logToConsole: false, showToast: true });

        try {
            await ErrorHandler.handleAsync(
                Promise.reject(new Error('network issue fetch')),
                { module: 'partners', type: 'network' }
            );
        } catch (e) {
            // expected
        }
        const history = ErrorHandler.getHistory();
        expect(history[history.length - 1].context.module).toBe('partners');
    });
});

// ─────────────────────────────────────────────
// wrap
// ─────────────────────────────────────────────
describe('ErrorHandler.wrap', () => {
    it('should return a function', () => {
        const { ErrorHandler } = loadErrorHandler();
        const wrapped = ErrorHandler.wrap(async () => {}, {});
        expect(typeof wrapped).toBe('function');
    });

    it('should return result when wrapped function resolves', async () => {
        const { ErrorHandler } = loadErrorHandler();
        const fn = async (x) => x * 2;
        const wrapped = ErrorHandler.wrap(fn, {});
        expect(await wrapped(5)).toBe(10);
    });

    it('should rethrow when wrapped function throws', async () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.configure({ logToConsole: false, showToast: false });

        const fn = async () => { throw new Error('wrap error'); };
        const wrapped = ErrorHandler.wrap(fn, {});
        await expect(wrapped()).rejects.toThrow('wrap error');
    });

    it('should record error in history when wrapped function throws', async () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.configure({ logToConsole: false, showToast: false });

        const fn = async () => { throw new Error('tracked wrap'); };
        const wrapped = ErrorHandler.wrap(fn, { module: 'wrapTest' });

        try { await wrapped(); } catch (e) { /* expected */ }

        const history = ErrorHandler.getHistory({ module: 'wrapTest' });
        expect(history).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────
// getHistory
// ─────────────────────────────────────────────
describe('ErrorHandler.getHistory', () => {
    it('should return all errors without filter', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.handle(new Error('e1'), { type: 'network' }, { silent: true });
        ErrorHandler.handle(new Error('e2'), { type: 'validation' }, { silent: true });
        expect(ErrorHandler.getHistory()).toHaveLength(2);
    });

    it('should filter by type', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.handle(new Error('net'), { type: 'network' }, { silent: true });
        ErrorHandler.handle(new Error('val'), { type: 'validation' }, { silent: true });
        ErrorHandler.handle(new Error('net2'), { type: 'network' }, { silent: true });

        const nets = ErrorHandler.getHistory({ type: 'network' });
        expect(nets).toHaveLength(2);
        nets.forEach(e => expect(e.type).toBe('network'));
    });

    it('should filter by severity', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.handle(new Error('x'), { type: 'auth' }, { silent: true });     // critical
        ErrorHandler.handle(new Error('y'), { type: 'validation' }, { silent: true }); // medium

        const criticals = ErrorHandler.getHistory({ severity: 'critical' });
        expect(criticals).toHaveLength(1);
        expect(criticals[0].severity).toBe('critical');
    });

    it('should filter by module', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.handle(new Error('p'), { module: 'partners' }, { silent: true });
        ErrorHandler.handle(new Error('t'), { module: 'traffic' }, { silent: true });

        const partnerErrors = ErrorHandler.getHistory({ module: 'partners' });
        expect(partnerErrors).toHaveLength(1);
        expect(partnerErrors[0].context.module).toBe('partners');
    });

    it('should filter by since date', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();

        ErrorHandler.handle(new Error('recent'), {}, { silent: true });

        const since = new Date(Date.now() - 5000).toISOString(); // 5 секунд назад
        const results = ErrorHandler.getHistory({ since });
        expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when no errors match filter', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.handle(new Error('e'), { type: 'validation' }, { silent: true });

        expect(ErrorHandler.getHistory({ type: 'network' })).toHaveLength(0);
    });

    it('should not mutate internal history when filtering', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.handle(new Error('e'), {}, { silent: true });

        const filtered = ErrorHandler.getHistory({ type: 'nonexistent' });
        filtered.push({ fake: true });

        expect(ErrorHandler.getHistory()).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────
// clearHistory
// ─────────────────────────────────────────────
describe('ErrorHandler.clearHistory', () => {
    it('should empty errorHistory', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.handle(new Error('e1'), {}, { silent: true });
        ErrorHandler.handle(new Error('e2'), {}, { silent: true });
        ErrorHandler.clearHistory();
        expect(ErrorHandler.getHistory()).toHaveLength(0);
    });

    it('should allow adding errors after clear', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.handle(new Error('old'), {}, { silent: true });
        ErrorHandler.clearHistory();
        ErrorHandler.handle(new Error('new'), {}, { silent: true });
        expect(ErrorHandler.getHistory()).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────
// configure
// ─────────────────────────────────────────────
describe('ErrorHandler.configure', () => {
    it('should change showToast setting', () => {
        const mockToast = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
        const { ErrorHandler } = loadErrorHandler({ mockToast });

        ErrorHandler.configure({ showToast: false, logToConsole: false });
        ErrorHandler.handle(new Error('no toast'), { type: 'auth' });
        expect(mockToast.error).not.toHaveBeenCalled();
    });

    it('should apply multiple config options at once', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.configure({ maxStoredErrors: 2, logToConsole: false });

        ErrorHandler.clearHistory();
        // Добавляем 3 ошибки, но лимит 2 → история должна содержать 2
        ErrorHandler.handle(new Error('1'), {}, { silent: true });
        ErrorHandler.handle(new Error('2'), {}, { silent: true });
        ErrorHandler.handle(new Error('3'), {}, { silent: true });
        expect(ErrorHandler.getHistory()).toHaveLength(2);
    });
});

// ─────────────────────────────────────────────
// createModuleHandler
// ─────────────────────────────────────────────
describe('ErrorHandler.createModuleHandler', () => {
    it('should return object with handle, handleAsync, wrap methods', () => {
        const { ErrorHandler } = loadErrorHandler();
        const handler = ErrorHandler.createModuleHandler('myModule');
        expect(typeof handler.handle).toBe('function');
        expect(typeof handler.handleAsync).toBe('function');
        expect(typeof handler.wrap).toBe('function');
    });

    it('should automatically set module in context for handle', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        const handler = ErrorHandler.createModuleHandler('autoModule');

        handler.handle(new Error('module error'), {}, { silent: true });
        const history = ErrorHandler.getHistory({ module: 'autoModule' });
        expect(history).toHaveLength(1);
    });

    it('should allow context override while keeping module name', () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        const handler = ErrorHandler.createModuleHandler('myMod');

        handler.handle(new Error('err'), { action: 'save' }, { silent: true });
        const history = ErrorHandler.getHistory({ module: 'myMod' });
        expect(history[0].context.action).toBe('save');
    });

    it('should propagate module for handleAsync on rejection', async () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.configure({ logToConsole: false, showToast: false });
        const handler = ErrorHandler.createModuleHandler('asyncMod');

        try {
            await handler.handleAsync(Promise.reject(new Error('async')), {});
        } catch (e) { /* expected */ }

        const history = ErrorHandler.getHistory({ module: 'asyncMod' });
        expect(history).toHaveLength(1);
    });

    it('should propagate module for wrap on throw', async () => {
        const { ErrorHandler } = loadErrorHandler();
        ErrorHandler.clearHistory();
        ErrorHandler.configure({ logToConsole: false, showToast: false });
        const handler = ErrorHandler.createModuleHandler('wrapMod');

        const wrapped = handler.wrap(async () => { throw new Error('wrap'); }, {});
        try { await wrapped(); } catch (e) { /* expected */ }

        const history = ErrorHandler.getHistory({ module: 'wrapMod' });
        expect(history).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────
// ErrorType и ErrorSeverity constants
// ─────────────────────────────────────────────
describe('ErrorHandler.ErrorType constants', () => {
    it('should expose all expected error types', () => {
        const { ErrorHandler } = loadErrorHandler();
        const { ErrorType } = ErrorHandler;
        expect(ErrorType.NETWORK).toBe('network');
        expect(ErrorType.AUTH).toBe('auth');
        expect(ErrorType.VALIDATION).toBe('validation');
        expect(ErrorType.PERMISSION).toBe('permission');
        expect(ErrorType.NOT_FOUND).toBe('not_found');
        expect(ErrorType.SERVER).toBe('server');
        expect(ErrorType.QUOTA).toBe('quota');
        expect(ErrorType.UNKNOWN).toBe('unknown');
    });

    it('should expose all expected severity levels', () => {
        const { ErrorHandler } = loadErrorHandler();
        const { ErrorSeverity } = ErrorHandler;
        expect(ErrorSeverity.LOW).toBe('low');
        expect(ErrorSeverity.MEDIUM).toBe('medium');
        expect(ErrorSeverity.HIGH).toBe('high');
        expect(ErrorSeverity.CRITICAL).toBe('critical');
    });
});
