import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadStateManager() {
    const mockWindow = { StateManager: null };

    const code = readFileSync(
        resolve(__dirname, '../../excel-reports/js/modules/state-manager.js'),
        'utf-8'
    );

    const fn = new Function('window', `${code}\nreturn StateManager;`);
    const StateManager = fn(mockWindow);
    return StateManager;
}

describe('StateManager', () => {
    let StateManager;
    let sm;

    beforeEach(() => {
        StateManager = loadStateManager();
        sm = new StateManager();
    });

    describe('constructor', () => {
        it('should initialize with default state', () => {
            expect(sm.state.currentStep).toBe('template');
            expect(sm.state.selectedTemplate).toBeNull();
            expect(sm.state.steps.template.completed).toBe(false);
        });

        it('should have empty listeners map', () => {
            expect(sm.listeners.size).toBe(0);
        });
    });

    describe('get()', () => {
        it('should return entire state when no path', () => {
            const state = sm.get();
            expect(state).toBe(sm.state);
        });

        it('should return entire state when path is empty string', () => {
            const state = sm.get('');
            expect(state).toBe(sm.state);
        });

        it('should get top-level value', () => {
            expect(sm.get('currentStep')).toBe('template');
        });

        it('should get nested value with dot notation', () => {
            expect(sm.get('steps.template.completed')).toBe(false);
        });

        it('should return undefined for non-existent path', () => {
            expect(sm.get('nonExistent.deep.path')).toBeUndefined();
        });

        it('should return undefined when traversing through null', () => {
            expect(sm.get('selectedTemplate.name')).toBeUndefined();
        });
    });

    describe('set()', () => {
        it('should set top-level value', () => {
            sm.set('currentStep', 'step1');
            expect(sm.state.currentStep).toBe('step1');
        });

        it('should set nested value with dot notation', () => {
            sm.set('steps.template.completed', true);
            expect(sm.state.steps.template.completed).toBe(true);
        });

        it('should create intermediate objects if they do not exist', () => {
            sm.set('steps.step1.data', [1, 2, 3]);
            expect(sm.state.steps.step1.data).toEqual([1, 2, 3]);
        });

        it('should notify subscribers when value changes', () => {
            const callback = vi.fn();
            sm.subscribe('currentStep', callback);
            sm.set('currentStep', 'step1');
            expect(callback).toHaveBeenCalledWith('step1');
        });
    });

    describe('subscribe()', () => {
        it('should call callback when subscribed path changes', () => {
            const callback = vi.fn();
            sm.subscribe('currentStep', callback);
            sm.set('currentStep', 'step1');
            expect(callback).toHaveBeenCalledWith('step1');
        });

        it('should support multiple subscribers on same path', () => {
            const cb1 = vi.fn();
            const cb2 = vi.fn();
            sm.subscribe('currentStep', cb1);
            sm.subscribe('currentStep', cb2);
            sm.set('currentStep', 'step1');
            expect(cb1).toHaveBeenCalledWith('step1');
            expect(cb2).toHaveBeenCalledWith('step1');
        });

        it('should return unsubscribe function', () => {
            const callback = vi.fn();
            const unsubscribe = sm.subscribe('currentStep', callback);
            unsubscribe();
            sm.set('currentStep', 'step1');
            expect(callback).not.toHaveBeenCalled();
        });

        it('should not affect other subscribers when unsubscribing', () => {
            const cb1 = vi.fn();
            const cb2 = vi.fn();
            const unsub1 = sm.subscribe('currentStep', cb1);
            sm.subscribe('currentStep', cb2);
            unsub1();
            sm.set('currentStep', 'step1');
            expect(cb1).not.toHaveBeenCalled();
            expect(cb2).toHaveBeenCalledWith('step1');
        });

        it('should support wildcard * subscriber', () => {
            const callback = vi.fn();
            sm.subscribe('*', callback);
            sm.set('currentStep', 'step1');
            expect(callback).toHaveBeenCalledWith({ path: 'currentStep', value: 'step1' });
        });
    });

    describe('notify()', () => {
        it('should call exact path subscribers', () => {
            const callback = vi.fn();
            sm.subscribe('myPath', callback);
            sm.notify('myPath', 'myValue');
            expect(callback).toHaveBeenCalledWith('myValue');
        });

        it('should call wildcard subscribers', () => {
            const callback = vi.fn();
            sm.subscribe('*', callback);
            sm.notify('anyPath', 'anyValue');
            expect(callback).toHaveBeenCalledWith({ path: 'anyPath', value: 'anyValue' });
        });

        it('should not throw if no subscribers exist', () => {
            expect(() => sm.notify('noSubscribers', 'value')).not.toThrow();
        });
    });

    describe('reset()', () => {
        it('should reset state to initial values', () => {
            sm.set('currentStep', 'step3');
            sm.set('selectedTemplate', { id: 'test' });
            sm.reset();
            expect(sm.state.currentStep).toBe('template');
            expect(sm.state.selectedTemplate).toBeNull();
            expect(sm.state.steps.template.completed).toBe(false);
        });

        it('should notify reset subscribers', () => {
            const callback = vi.fn();
            sm.subscribe('reset', callback);
            sm.reset();
            expect(callback).toHaveBeenCalledWith(null);
        });

        it('should notify wildcard subscribers on reset', () => {
            const callback = vi.fn();
            sm.subscribe('*', callback);
            sm.reset();
            // Two calls: one from notify('reset', null), one from notify('*', ...)
            expect(callback).toHaveBeenCalledWith({ path: 'reset', value: null });
        });
    });

    describe('initializeSteps()', () => {
        it('should set template step as completed with data', () => {
            const template = { id: 'test', filesConfig: { step1: {} } };
            sm.initializeSteps(template);
            expect(sm.get('steps.template.completed')).toBe(true);
            expect(sm.get('steps.template.data')).toBe(template);
        });

        it('should create file steps from filesConfig', () => {
            const template = {
                id: 'test',
                filesConfig: { step1: { name: 'File 1' }, step2: { name: 'File 2' } }
            };
            sm.initializeSteps(template);
            expect(sm.get('steps.step1.completed')).toBe(false);
            expect(sm.get('steps.step1.files')).toEqual([]);
            expect(sm.get('steps.step2.completed')).toBe(false);
        });

        it('should create process step', () => {
            const template = { id: 'test', filesConfig: { step1: {} } };
            sm.initializeSteps(template);
            expect(sm.get('steps.process.completed')).toBe(false);
            expect(sm.get('steps.process.result')).toBeNull();
        });

        it('should set selectedTemplate', () => {
            const template = { id: 'test', filesConfig: {} };
            sm.initializeSteps(template);
            expect(sm.get('selectedTemplate')).toBe(template);
        });

        it('should notify stepsInitialized', () => {
            const callback = vi.fn();
            sm.subscribe('stepsInitialized', callback);
            const template = { id: 'test', filesConfig: {} };
            sm.initializeSteps(template);
            expect(callback).toHaveBeenCalledWith(template);
        });

        it('should handle template without filesConfig', () => {
            const template = { id: 'test' };
            sm.initializeSteps(template);
            expect(sm.get('steps.process')).toBeDefined();
        });
    });

    describe('isStepCompleted()', () => {
        it('should return false for incomplete step', () => {
            expect(sm.isStepCompleted('template')).toBe(false);
        });

        it('should return true for completed step', () => {
            sm.set('steps.template.completed', true);
            expect(sm.isStepCompleted('template')).toBe(true);
        });

        it('should return false for non-existent step', () => {
            expect(sm.isStepCompleted('nonExistent')).toBe(false);
        });
    });

    describe('markStepCompleted()', () => {
        it('should mark step as completed', () => {
            sm.markStepCompleted('template');
            expect(sm.isStepCompleted('template')).toBe(true);
        });

        it('should set data when provided', () => {
            sm.markStepCompleted('template', { result: 'ok' });
            expect(sm.getStepData('template')).toEqual({ result: 'ok' });
        });

        it('should not set data when null', () => {
            const template = { id: 'test', filesConfig: { step1: {} } };
            sm.initializeSteps(template);
            sm.markStepCompleted('step1');
            expect(sm.get('steps.step1.completed')).toBe(true);
        });
    });

    describe('areAllFileStepsCompleted()', () => {
        it('should return false when no template selected', () => {
            expect(sm.areAllFileStepsCompleted()).toBe(false);
        });

        it('should return false when file steps are not completed', () => {
            const template = { id: 'test', filesConfig: { step1: {}, step2: {} } };
            sm.initializeSteps(template);
            expect(sm.areAllFileStepsCompleted()).toBe(false);
        });

        it('should return true when all file steps are completed', () => {
            const template = { id: 'test', filesConfig: { step1: {}, step2: {} } };
            sm.initializeSteps(template);
            sm.markStepCompleted('step1');
            sm.markStepCompleted('step2');
            expect(sm.areAllFileStepsCompleted()).toBe(true);
        });

        it('should return false when only some file steps completed', () => {
            const template = { id: 'test', filesConfig: { step1: {}, step2: {} } };
            sm.initializeSteps(template);
            sm.markStepCompleted('step1');
            expect(sm.areAllFileStepsCompleted()).toBe(false);
        });
    });

    describe('getStepData() / setStepData()', () => {
        it('should set and get step data', () => {
            const template = { id: 'test', filesConfig: { step1: {} } };
            sm.initializeSteps(template);
            sm.setStepData('step1', [1, 2, 3]);
            expect(sm.getStepData('step1')).toEqual([1, 2, 3]);
        });

        it('should return undefined for non-existent step data', () => {
            expect(sm.getStepData('nonExistent')).toBeUndefined();
        });
    });

    describe('getStepFiles() / setStepFiles()', () => {
        it('should set and get step files', () => {
            const template = { id: 'test', filesConfig: { step1: {} } };
            sm.initializeSteps(template);
            const files = [{ name: 'test.xlsx' }];
            sm.setStepFiles('step1', files);
            expect(sm.getStepFiles('step1')).toEqual(files);
        });

        it('should return empty array for step with no files', () => {
            expect(sm.getStepFiles('nonExistent')).toEqual([]);
        });
    });
});
