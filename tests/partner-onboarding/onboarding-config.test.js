import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../partner-onboarding/js/modules/onboarding-config.js'),
    'utf-8'
);

/**
 * OnboardingConfig is a pure IIFE with no external dependencies.
 * Each call creates an isolated instance via new Function.
 */
function loadOnboardingConfig() {
    const fn = new Function(`${code}\nreturn OnboardingConfig;`);
    return fn();
}

// Shared instance for stateless read-only tests (config data never mutates)
const C = loadOnboardingConfig();

// ─────────────────────────────────────────────
// STEPS structure sanity
// ─────────────────────────────────────────────
describe('OnboardingConfig.STEPS', () => {
    it('should expose 8 steps', () => {
        expect(C.STEPS).toHaveLength(8);
    });

    it('should have steps numbered 1 through 8 in order', () => {
        const numbers = C.STEPS.map(s => s.number);
        expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('each step should have a name and shortName string', () => {
        C.STEPS.forEach(step => {
            expect(typeof step.name).toBe('string');
            expect(step.name.length).toBeGreaterThan(0);
            expect(typeof step.shortName).toBe('string');
            expect(step.shortName.length).toBeGreaterThan(0);
        });
    });

    it('each step should have an executor field', () => {
        C.STEPS.forEach(step => {
            expect(step).toHaveProperty('executor');
        });
    });

    it('each step should have a reviewer field (null or string)', () => {
        C.STEPS.forEach(step => {
            expect(step).toHaveProperty('reviewer');
            const v = step.reviewer;
            expect(v === null || typeof v === 'string').toBe(true);
        });
    });
});

// ─────────────────────────────────────────────
// getStep
// ─────────────────────────────────────────────
describe('OnboardingConfig.getStep', () => {
    it('should return the step object for a valid step number', () => {
        const step = C.getStep(1);
        expect(step).toBeDefined();
        expect(step.number).toBe(1);
        expect(step.name).toBe('Входящий лид');
    });

    it('should return step 5 with executor "reviewer"', () => {
        const step = C.getStep(5);
        expect(step.executor).toBe('reviewer');
    });

    it('should return step 8 with executorFinal set to true', () => {
        const step = C.getStep(8);
        expect(step.executorFinal).toBe(true);
    });

    it('should return undefined for a step number that does not exist', () => {
        expect(C.getStep(0)).toBeUndefined();
        expect(C.getStep(9)).toBeUndefined();
        expect(C.getStep(99)).toBeUndefined();
    });

    it('should return undefined for non-numeric input', () => {
        expect(C.getStep('1')).toBeUndefined(); // strict comparison
        expect(C.getStep(null)).toBeUndefined();
        expect(C.getStep(undefined)).toBeUndefined();
    });
});

// ─────────────────────────────────────────────
// getStepLabel
// ─────────────────────────────────────────────
describe('OnboardingConfig.getStepLabel', () => {
    it('should return the step name for a valid step number', () => {
        expect(C.getStepLabel(1)).toBe('Входящий лид');
        expect(C.getStepLabel(2)).toBe('Полная информация');
        expect(C.getStepLabel(8)).toBe('Финализация карточки');
    });

    it('should return "Шаг N" for an unknown step number', () => {
        expect(C.getStepLabel(99)).toBe('Шаг 99');
        expect(C.getStepLabel(0)).toBe('Шаг 0');
    });
});

// ─────────────────────────────────────────────
// isExecutor
// ─────────────────────────────────────────────
describe('OnboardingConfig.isExecutor', () => {
    it('should return true when the role matches step.executor', () => {
        // Step 1 executor is 'executor'
        expect(C.isExecutor(1, 'executor')).toBe(true);
    });

    it('should return false when the role does not match step.executor', () => {
        expect(C.isExecutor(1, 'reviewer')).toBe(false);
    });

    it('should return true for step 5 where executor is "reviewer"', () => {
        expect(C.isExecutor(5, 'reviewer')).toBe(true);
    });

    it('should return false for step 5 with role "executor"', () => {
        expect(C.isExecutor(5, 'executor')).toBe(false);
    });

    it('should return falsy for a non-existent step', () => {
        expect(C.isExecutor(99, 'executor')).toBeFalsy();
    });
});

// ─────────────────────────────────────────────
// isReviewer
// ─────────────────────────────────────────────
describe('OnboardingConfig.isReviewer', () => {
    it('should return true when the role matches step.reviewer', () => {
        // Step 2 has reviewer: 'reviewer'
        expect(C.isReviewer(2, 'reviewer')).toBe(true);
    });

    it('should return false when the role does not match step.reviewer', () => {
        expect(C.isReviewer(2, 'executor')).toBe(false);
    });

    it('should return falsy for step 1 that has no reviewer (null)', () => {
        expect(C.isReviewer(1, 'reviewer')).toBeFalsy();
    });

    it('should return falsy for step 5 that has no reviewer (null)', () => {
        expect(C.isReviewer(5, 'reviewer')).toBeFalsy();
    });

    it('should return falsy for a non-existent step', () => {
        expect(C.isReviewer(99, 'reviewer')).toBeFalsy();
    });
});

// ─────────────────────────────────────────────
// hasReviewer
// ─────────────────────────────────────────────
describe('OnboardingConfig.hasReviewer', () => {
    it('should return truthy for step 2 which has reviewer: "reviewer"', () => {
        expect(C.hasReviewer(2)).toBeTruthy();
    });

    it('should return truthy for steps 3, 4, 6, 7 which have reviewers', () => {
        [3, 4, 6, 7].forEach(n => {
            expect(C.hasReviewer(n)).toBeTruthy();
        });
    });

    it('should return falsy for step 1 which has reviewer: null', () => {
        expect(C.hasReviewer(1)).toBeFalsy();
    });

    it('should return falsy for step 5 which has reviewer: null', () => {
        expect(C.hasReviewer(5)).toBeFalsy();
    });

    it('should return falsy for step 8 which has reviewer: null', () => {
        expect(C.hasReviewer(8)).toBeFalsy();
    });

    it('should return falsy for non-existent step', () => {
        expect(C.hasReviewer(99)).toBeFalsy();
    });
});

// ─────────────────────────────────────────────
// getStatusLabel
// ─────────────────────────────────────────────
describe('OnboardingConfig.getStatusLabel', () => {
    it('should return "Новая" for status "new"', () => {
        expect(C.getStatusLabel('new')).toBe('Новая');
    });

    it('should return "В работе" for status "in_progress"', () => {
        expect(C.getStatusLabel('in_progress')).toBe('В работе');
    });

    it('should return "На проверке" for status "on_review"', () => {
        expect(C.getStatusLabel('on_review')).toBe('На проверке');
    });

    it('should return "Завершено" for status "completed"', () => {
        expect(C.getStatusLabel('completed')).toBe('Завершено');
    });

    it('should return "Отменено" for status "cancelled"', () => {
        expect(C.getStatusLabel('cancelled')).toBe('Отменено');
    });

    it('should return the status string itself for unknown status', () => {
        expect(C.getStatusLabel('unknown_status')).toBe('unknown_status');
        expect(C.getStatusLabel('')).toBe('');
    });
});

// ─────────────────────────────────────────────
// getStatusClass
// ─────────────────────────────────────────────
describe('OnboardingConfig.getStatusClass', () => {
    it('should return correct CSS class for "new"', () => {
        expect(C.getStatusClass('new')).toBe('status--new');
    });

    it('should return correct CSS class for "in_progress"', () => {
        expect(C.getStatusClass('in_progress')).toBe('status--in-progress');
    });

    it('should return correct CSS class for "on_review"', () => {
        expect(C.getStatusClass('on_review')).toBe('status--on-review');
    });

    it('should return correct CSS class for "completed"', () => {
        expect(C.getStatusClass('completed')).toBe('status--completed');
    });

    it('should return correct CSS class for "cancelled"', () => {
        expect(C.getStatusClass('cancelled')).toBe('status--cancelled');
    });

    it('should return empty string for unknown status', () => {
        expect(C.getStatusClass('ghost')).toBe('');
        expect(C.getStatusClass(null)).toBe('');
    });
});

// ─────────────────────────────────────────────
// getHistoryActionLabel
// ─────────────────────────────────────────────
describe('OnboardingConfig.getHistoryActionLabel', () => {
    it('should return "Создано" for action "create"', () => {
        expect(C.getHistoryActionLabel('create')).toBe('Создано');
    });

    it('should return "Отправлено" for action "submit"', () => {
        expect(C.getHistoryActionLabel('submit')).toBe('Отправлено');
    });

    it('should return "Одобрено" for action "approve"', () => {
        expect(C.getHistoryActionLabel('approve')).toBe('Одобрено');
    });

    it('should return "Возвращено" for action "reject"', () => {
        expect(C.getHistoryActionLabel('reject')).toBe('Возвращено');
    });

    it('should return "Взято в работу" for action "assign"', () => {
        expect(C.getHistoryActionLabel('assign')).toBe('Взято в работу');
    });

    it('should return "Завершено" for action "complete"', () => {
        expect(C.getHistoryActionLabel('complete')).toBe('Завершено');
    });

    it('should return "Отменено" for action "cancel"', () => {
        expect(C.getHistoryActionLabel('cancel')).toBe('Отменено');
    });

    it('should return the action itself for an unknown action', () => {
        expect(C.getHistoryActionLabel('unknown_action')).toBe('unknown_action');
    });
});

// ─────────────────────────────────────────────
// getStepEffectiveExecutor — dynamicExecutor logic
// ─────────────────────────────────────────────
describe('OnboardingConfig.getStepEffectiveExecutor', () => {
    it('should return step.executor for steps without dynamicExecutor', () => {
        // Step 1: no dynamicExecutor, executor = 'executor'
        expect(C.getStepEffectiveExecutor(1, {})).toBe('executor');
    });

    it('should return step.executor when stageData is null', () => {
        expect(C.getStepEffectiveExecutor(1, null)).toBe('executor');
    });

    it('should return step.executor when stageData is undefined', () => {
        expect(C.getStepEffectiveExecutor(2, undefined)).toBe('executor');
    });

    it('should return step.executor for step 5 (executor = "reviewer", no dynamicExecutor)', () => {
        expect(C.getStepEffectiveExecutor(5, {})).toBe('reviewer');
    });

    it('should return "executor" for step 3 when account_creator is "executor"', () => {
        // Step 3 dynamicExecutor: { field: 'account_creator', executorValue: 'executor', reviewerValue: 'reviewer' }
        const stageData = { 3: { account_creator: 'executor' } };
        expect(C.getStepEffectiveExecutor(3, stageData)).toBe('executor');
    });

    it('should return "reviewer" for step 3 when account_creator is "reviewer"', () => {
        const stageData = { 3: { account_creator: 'reviewer' } };
        expect(C.getStepEffectiveExecutor(3, stageData)).toBe('reviewer');
    });

    it('should return step.executor for step 3 when stageData for that step is empty', () => {
        // No data for step 3 → falls back to step.executor which is 'executor'
        const stageData = {};
        expect(C.getStepEffectiveExecutor(3, stageData)).toBe('executor');
    });

    it('should return step.executor for step 3 when _handoff_complete is true', () => {
        // _handoff_complete overrides the dynamic choice
        const stageData = { 3: { account_creator: 'reviewer', _handoff_complete: true } };
        expect(C.getStepEffectiveExecutor(3, stageData)).toBe('executor');
    });

    it('should return "reviewer" for step 7 when messenger_creator is "reviewer"', () => {
        // Step 7 dynamicExecutor: { field: 'messenger_creator', reviewerValue: 'reviewer', defaultValue: 'reviewer' }
        const stageData = { 7: { messenger_creator: 'reviewer' } };
        expect(C.getStepEffectiveExecutor(7, stageData)).toBe('reviewer');
    });

    it('should return step.executor for step 7 when messenger_creator is "executor"', () => {
        const stageData = { 7: { messenger_creator: 'executor' } };
        expect(C.getStepEffectiveExecutor(7, stageData)).toBe('executor');
    });

    it('should return step.executor for step 7 when stageData for step 7 has no field set', () => {
        // No choice made → choice is undefined, not equal to reviewerValue → return step.executor
        const stageData = { 7: {} };
        expect(C.getStepEffectiveExecutor(7, stageData)).toBe('executor');
    });

    it('should return null for a non-existent step', () => {
        expect(C.getStepEffectiveExecutor(99, {})).toBeNull();
    });
});

// ─────────────────────────────────────────────
// getOptionLabel
// ─────────────────────────────────────────────
describe('OnboardingConfig.getOptionLabel', () => {
    it('should return label for a matching value in the options array', () => {
        const options = [
            { value: 'telegram', label: 'Telegram' },
            { value: 'banner', label: 'Баннер' }
        ];
        expect(C.getOptionLabel(options, 'telegram')).toBe('Telegram');
        expect(C.getOptionLabel(options, 'banner')).toBe('Баннер');
    });

    it('should return the value itself when no option matches', () => {
        const options = [{ value: 'a', label: 'Alpha' }];
        expect(C.getOptionLabel(options, 'unknown')).toBe('unknown');
    });

    it('should return empty string when value is empty string and no option has that value', () => {
        const options = [{ value: 'a', label: 'Alpha' }];
        expect(C.getOptionLabel(options, '')).toBe('');
    });

    it('should work with LEAD_SOURCES constant options', () => {
        expect(C.getOptionLabel(C.LEAD_SOURCES, 'telegram')).toBe('Telegram');
        expect(C.getOptionLabel(C.LEAD_SOURCES, 'referral')).toBe('Реферал');
    });

    it('should work with GEO_COUNTRIES options', () => {
        expect(C.getOptionLabel(C.GEO_COUNTRIES, 'kz')).toBe('Казахстан');
        expect(C.getOptionLabel(C.GEO_COUNTRIES, 'uz')).toBe('Узбекистан');
    });
});

// ─────────────────────────────────────────────
// getVisibleSteps
// ─────────────────────────────────────────────
describe('OnboardingConfig.getVisibleSteps', () => {
    it('should return the full STEPS array', () => {
        const steps = C.getVisibleSteps();
        expect(Array.isArray(steps)).toBe(true);
        expect(steps).toHaveLength(8);
    });

    it('should contain step objects with number, name, executor', () => {
        const steps = C.getVisibleSteps();
        steps.forEach(step => {
            expect(typeof step.number).toBe('number');
            expect(typeof step.name).toBe('string');
        });
    });

    it('should be the same reference as STEPS', () => {
        expect(C.getVisibleSteps()).toBe(C.STEPS);
    });
});

// ─────────────────────────────────────────────
// getStepDisplayName
// ─────────────────────────────────────────────
describe('OnboardingConfig.getStepDisplayName', () => {
    it('should return step.name for a normal step regardless of role', () => {
        expect(C.getStepDisplayName(1, 'executor')).toBe('Входящий лид');
        expect(C.getStepDisplayName(2, 'reviewer')).toBe('Полная информация');
    });

    it('should return executorName for step 8 when role is "executor"', () => {
        // Step 8 has executorFinal: true, executorName: 'Партнёр заведён'
        expect(C.getStepDisplayName(8, 'executor')).toBe('Партнёр заведён');
    });

    it('should return regular step name for step 8 when role is "reviewer"', () => {
        expect(C.getStepDisplayName(8, 'reviewer')).toBe('Финализация карточки');
    });

    it('should return "Шаг N" for a non-existent step', () => {
        expect(C.getStepDisplayName(99, 'executor')).toBe('Шаг 99');
    });

    it('should return regular name for steps without executorFinal', () => {
        // Steps 1–7 do not have executorFinal
        [1, 2, 3, 4, 5, 6, 7].forEach(n => {
            const step = C.getStep(n);
            expect(C.getStepDisplayName(n, 'executor')).toBe(step.name);
        });
    });
});

// ─────────────────────────────────────────────
// isExecutorFinalStep
// ─────────────────────────────────────────────
describe('OnboardingConfig.isExecutorFinalStep', () => {
    it('should return true only for step 8 which has executorFinal: true', () => {
        expect(C.isExecutorFinalStep(8)).toBe(true);
    });

    it('should return false for all other steps (1–7)', () => {
        [1, 2, 3, 4, 5, 6, 7].forEach(n => {
            expect(C.isExecutorFinalStep(n)).toBeFalsy();
        });
    });

    it('should return falsy for a non-existent step', () => {
        expect(C.isExecutorFinalStep(0)).toBeFalsy();
        expect(C.isExecutorFinalStep(99)).toBeFalsy();
    });
});

// ─────────────────────────────────────────────
// isExecutorCompleted
// ─────────────────────────────────────────────
describe('OnboardingConfig.isExecutorCompleted', () => {
    it('should return false for null request', () => {
        expect(C.isExecutorCompleted(null)).toBe(false);
    });

    it('should return false for undefined request', () => {
        expect(C.isExecutorCompleted(undefined)).toBe(false);
    });

    it('should return false for cancelled request', () => {
        expect(C.isExecutorCompleted({ status: 'cancelled', currentStep: 8 })).toBe(false);
    });

    it('should return true when request status is "completed"', () => {
        expect(C.isExecutorCompleted({ status: 'completed', currentStep: 8 })).toBe(true);
    });

    it('should return true when currentStep is at or beyond the executorFinal step (8)', () => {
        // currentStep >= 8 means executor work is done
        expect(C.isExecutorCompleted({ status: 'in_progress', currentStep: 8 })).toBe(true);
    });

    it('should return true when currentStep exceeds the executorFinal step', () => {
        expect(C.isExecutorCompleted({ status: 'on_review', currentStep: 9 })).toBe(true);
    });

    it('should return false when currentStep is before the executorFinal step', () => {
        expect(C.isExecutorCompleted({ status: 'in_progress', currentStep: 7 })).toBe(false);
        expect(C.isExecutorCompleted({ status: 'in_progress', currentStep: 1 })).toBe(false);
    });

    it('should return false for new request at step 1', () => {
        expect(C.isExecutorCompleted({ status: 'new', currentStep: 1 })).toBe(false);
    });
});

// ─────────────────────────────────────────────
// Constants sanity checks
// ─────────────────────────────────────────────
describe('OnboardingConfig constants', () => {
    it('LEAD_SOURCES should contain "telegram", "referral", "other"', () => {
        const values = C.LEAD_SOURCES.map(o => o.value);
        expect(values).toContain('telegram');
        expect(values).toContain('referral');
        expect(values).toContain('other');
    });

    it('GEO_COUNTRIES should contain kz, uz, kg', () => {
        const values = C.GEO_COUNTRIES.map(o => o.value);
        expect(values).toContain('kz');
        expect(values).toContain('uz');
        expect(values).toContain('kg');
    });

    it('METHOD_TYPES should contain bank_transfer, crypto, e_wallet', () => {
        const values = C.METHOD_TYPES.map(o => o.value);
        expect(values).toContain('bank_transfer');
        expect(values).toContain('crypto');
        expect(values).toContain('e_wallet');
    });

    it('ANTIFRAUD_RESULTS should have "passed" and "failed"', () => {
        const values = C.ANTIFRAUD_RESULTS.map(o => o.value);
        expect(values).toContain('passed');
        expect(values).toContain('failed');
    });

    it('HISTORY_ACTIONS should include all expected action keys', () => {
        const keys = Object.keys(C.HISTORY_ACTIONS);
        ['create', 'submit', 'approve', 'reject', 'reassign', 'rollback', 'withdraw', 'complete', 'cancel', 'reactivate', 'import', 'assign']
            .forEach(k => expect(keys).toContain(k));
    });
});
