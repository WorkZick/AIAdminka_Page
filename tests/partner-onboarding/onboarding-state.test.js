import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../partner-onboarding/js/modules/onboarding-state.js'),
    'utf-8'
);

/**
 * OnboardingState is a self-contained IIFE with private _state and _subscribers.
 * Each call to loadOnboardingState() gives a fully isolated instance.
 */
function loadOnboardingState() {
    const fn = new Function(`${code}\nreturn OnboardingState;`);
    return fn();
}

// ─────────────────────────────────────────────
// Initial state values
// ─────────────────────────────────────────────
describe('OnboardingState — initial state', () => {
    it('should have requests as empty array', () => {
        const s = loadOnboardingState();
        expect(s.get('requests')).toEqual([]);
    });

    it('should have filteredRequests as empty array', () => {
        const s = loadOnboardingState();
        expect(s.get('filteredRequests')).toEqual([]);
    });

    it('should have currentRequest as null', () => {
        const s = loadOnboardingState();
        expect(s.get('currentRequest')).toBeNull();
    });

    it('should have currentStep equal to 1', () => {
        const s = loadOnboardingState();
        expect(s.get('currentStep')).toBe(1);
    });

    it('should have view equal to "list"', () => {
        const s = loadOnboardingState();
        expect(s.get('view')).toBe('list');
    });

    it('should have filters.ownership equal to "my"', () => {
        const s = loadOnboardingState();
        expect(s.get('filters.ownership')).toBe('my');
    });

    it('should have filters.status as empty string', () => {
        const s = loadOnboardingState();
        expect(s.get('filters.status')).toBe('');
    });

    it('should have filters.search as empty string', () => {
        const s = loadOnboardingState();
        expect(s.get('filters.search')).toBe('');
    });

    it('should have userRole equal to "executor"', () => {
        const s = loadOnboardingState();
        expect(s.get('userRole')).toBe('executor');
    });

    it('should have userEmail as empty string', () => {
        const s = loadOnboardingState();
        expect(s.get('userEmail')).toBe('');
    });

    it('should have loading as false', () => {
        const s = loadOnboardingState();
        expect(s.get('loading')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// get — dot-path access
// ─────────────────────────────────────────────
describe('OnboardingState.get', () => {
    it('should return top-level state value for a simple key', () => {
        const s = loadOnboardingState();
        expect(s.get('view')).toBe('list');
    });

    it('should return nested value via dot path', () => {
        const s = loadOnboardingState();
        expect(s.get('filters.ownership')).toBe('my');
    });

    it('should return undefined for a non-existent top-level key', () => {
        const s = loadOnboardingState();
        expect(s.get('nonexistent')).toBeUndefined();
    });

    it('should return undefined for a non-existent nested key', () => {
        const s = loadOnboardingState();
        expect(s.get('filters.nonexistent')).toBeUndefined();
    });

    it('should return undefined when traversing through null', () => {
        const s = loadOnboardingState();
        // currentRequest is null — further traversal should not throw
        expect(s.get('currentRequest.id')).toBeUndefined();
    });

    it('should return the full filters object for path "filters"', () => {
        const s = loadOnboardingState();
        const filters = s.get('filters');
        expect(filters).toEqual({ ownership: 'my', status: '', search: '' });
    });
});

// ─────────────────────────────────────────────
// set — dot-path mutation
// ─────────────────────────────────────────────
describe('OnboardingState.set', () => {
    it('should update a top-level primitive value', () => {
        const s = loadOnboardingState();
        s.set('view', 'form');
        expect(s.get('view')).toBe('form');
    });

    it('should update a nested value via dot path', () => {
        const s = loadOnboardingState();
        s.set('filters.status', 'in_progress');
        expect(s.get('filters.status')).toBe('in_progress');
    });

    it('should update filters.ownership without touching other filter fields', () => {
        const s = loadOnboardingState();
        s.set('filters.ownership', 'all');
        expect(s.get('filters.ownership')).toBe('all');
        expect(s.get('filters.status')).toBe('');
        expect(s.get('filters.search')).toBe('');
    });

    it('should set currentStep to a new number', () => {
        const s = loadOnboardingState();
        s.set('currentStep', 5);
        expect(s.get('currentStep')).toBe(5);
    });

    it('should set currentRequest to an object', () => {
        const s = loadOnboardingState();
        const req = { id: 'r1', status: 'new' };
        s.set('currentRequest', req);
        expect(s.get('currentRequest')).toEqual(req);
    });

    it('should set loading to true', () => {
        const s = loadOnboardingState();
        s.set('loading', true);
        expect(s.get('loading')).toBe(true);
    });

    it('should set requests to an array of items', () => {
        const s = loadOnboardingState();
        const reqs = [{ id: 'r1' }, { id: 'r2' }];
        s.set('requests', reqs);
        expect(s.get('requests')).toEqual(reqs);
    });

    it('should create intermediate objects for deeply nested paths that do not exist', () => {
        const s = loadOnboardingState();
        // Set a path that does not exist in the initial state
        s.set('userEmail', 'qa@test.com');
        expect(s.get('userEmail')).toBe('qa@test.com');
    });
});

// ─────────────────────────────────────────────
// subscribe / notify
// ─────────────────────────────────────────────
describe('OnboardingState.subscribe', () => {
    it('should call subscriber when the matching top-level key is changed', () => {
        const s = loadOnboardingState();
        const cb = vi.fn();
        s.subscribe('view', cb);
        s.set('view', 'review');
        expect(cb).toHaveBeenCalledOnce();
        expect(cb).toHaveBeenCalledWith('review');
    });

    it('should call subscriber with the updated value when nested key is set', () => {
        const s = loadOnboardingState();
        const cb = vi.fn();
        // nested set of filters.status notifies 'filters' subscribers
        s.subscribe('filters', cb);
        s.set('filters.status', 'completed');
        expect(cb).toHaveBeenCalledOnce();
        // The callback receives the whole filters object (value of _state['filters'])
        expect(cb.mock.calls[0][0]).toMatchObject({ status: 'completed' });
    });

    it('should support multiple subscribers for the same key', () => {
        const s = loadOnboardingState();
        const cb1 = vi.fn();
        const cb2 = vi.fn();
        s.subscribe('loading', cb1);
        s.subscribe('loading', cb2);
        s.set('loading', true);
        expect(cb1).toHaveBeenCalledOnce();
        expect(cb2).toHaveBeenCalledOnce();
    });

    it('should NOT call a subscriber for a different key', () => {
        const s = loadOnboardingState();
        const cb = vi.fn();
        s.subscribe('currentStep', cb);
        s.set('view', 'form');
        expect(cb).not.toHaveBeenCalled();
    });

    it('should call subscriber each time the value is set, not just on change', () => {
        const s = loadOnboardingState();
        const cb = vi.fn();
        s.subscribe('currentStep', cb);
        s.set('currentStep', 2);
        s.set('currentStep', 2); // same value again
        expect(cb).toHaveBeenCalledTimes(2);
    });

    it('should deliver correct value to subscriber on multiple successive sets', () => {
        const s = loadOnboardingState();
        const received = [];
        s.subscribe('view', val => received.push(val));
        s.set('view', 'form');
        s.set('view', 'review');
        s.set('view', 'list');
        expect(received).toEqual(['form', 'review', 'list']);
    });

    it('should not call subscriber when a different top-level key is set', () => {
        const s = loadOnboardingState();
        const requestsCb = vi.fn();
        s.subscribe('requests', requestsCb);
        s.set('loading', true);
        expect(requestsCb).not.toHaveBeenCalled();
    });

    it('should handle multiple independent subscriptions independently', () => {
        const s = loadOnboardingState();
        const viewCb = vi.fn();
        const loadCb = vi.fn();
        s.subscribe('view', viewCb);
        s.subscribe('loading', loadCb);
        s.set('view', 'form');
        expect(viewCb).toHaveBeenCalledOnce();
        expect(loadCb).not.toHaveBeenCalled();
        s.set('loading', true);
        expect(loadCb).toHaveBeenCalledOnce();
        expect(viewCb).toHaveBeenCalledTimes(1); // unchanged
    });
});

// ─────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────
describe('OnboardingState — edge cases', () => {
    it('should allow setting a value to null', () => {
        const s = loadOnboardingState();
        s.set('currentRequest', { id: 'x' });
        s.set('currentRequest', null);
        expect(s.get('currentRequest')).toBeNull();
    });

    it('should allow setting a value to 0', () => {
        const s = loadOnboardingState();
        s.set('currentStep', 0);
        expect(s.get('currentStep')).toBe(0);
    });

    it('should allow setting a value to an empty array', () => {
        const s = loadOnboardingState();
        s.set('requests', [{ id: 'r1' }]);
        s.set('requests', []);
        expect(s.get('requests')).toEqual([]);
    });

    it('should allow setting a value to false (boolean)', () => {
        const s = loadOnboardingState();
        s.set('loading', true);
        s.set('loading', false);
        expect(s.get('loading')).toBe(false);
    });

    it('each loaded instance should be fully isolated', () => {
        const s1 = loadOnboardingState();
        const s2 = loadOnboardingState();
        s1.set('view', 'form');
        // s2 should remain at its initial state
        expect(s2.get('view')).toBe('list');
    });
});
