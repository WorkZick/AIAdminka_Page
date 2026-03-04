import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const configCode = readFileSync(
    resolve(__dirname, '../../partner-onboarding/js/modules/onboarding-config.js'),
    'utf-8'
);
const rolesCode = readFileSync(
    resolve(__dirname, '../../partner-onboarding/js/modules/onboarding-roles.js'),
    'utf-8'
);

/**
 * onboarding-roles.js references OnboardingConfig.STEPS at module level inside functions.
 * We load OnboardingConfig first as a real instance, then inject it as a global
 * when loading OnboardingRoles via new Function.
 *
 * Returns a fresh, fully-isolated OnboardingRoles instance each call.
 */
function loadOnboardingRoles(customOnboardingConfig = null) {
    // Build real OnboardingConfig from source
    const configFn = new Function(`${configCode}\nreturn OnboardingConfig;`);
    const OnboardingConfig = customOnboardingConfig || configFn();

    // Inject OnboardingConfig as a global when evaluating the roles module
    const rolesFn = new Function(
        'OnboardingConfig',
        `${rolesCode}\nreturn OnboardingRoles;`
    );
    const OnboardingRoles = rolesFn(OnboardingConfig);
    return { OnboardingRoles, OnboardingConfig };
}

// ─────────────────────────────────────────────
// isExecutorForStep
// ─────────────────────────────────────────────
describe('OnboardingRoles.isExecutorForStep', () => {
    it('should return true for admin regardless of step', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('admin', 1)).toBe(true);
        expect(OnboardingRoles.isExecutorForStep('admin', 5)).toBe(true);
        expect(OnboardingRoles.isExecutorForStep('admin', 8)).toBe(true);
    });

    it('should return true for leader regardless of step', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('leader', 1)).toBe(true);
        expect(OnboardingRoles.isExecutorForStep('leader', 8)).toBe(true);
    });

    it('should return true for "sales" on step 1 (default config)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('sales', 1)).toBe(true);
    });

    it('should return true for "sales" on steps 2, 3, 4, 6, 7 (default executors)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        [2, 3, 4, 6, 7].forEach(step => {
            expect(OnboardingRoles.isExecutorForStep('sales', step)).toBe(true);
        });
    });

    it('should return false for "sales" on step 5 (executor is "assistant")', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('sales', 5)).toBe(false);
    });

    it('should return false for "sales" on step 8 (executor is "assistant")', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('sales', 8)).toBe(false);
    });

    it('should return true for "assistant" on step 5 (default executor)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('assistant', 5)).toBe(true);
    });

    it('should return true for "assistant" on step 8 (default executor)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('assistant', 8)).toBe(true);
    });

    it('should return false for "assistant" on step 1 (not an executor there by default)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('assistant', 1)).toBe(false);
    });

    it('should return false for unknown role on any step', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('payments', 1)).toBe(false);
        expect(OnboardingRoles.isExecutorForStep('tech', 3)).toBe(false);
    });

    it('should reflect updated config after initFromConfig', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        // Make 'payments' an executor for step 1
        OnboardingRoles.initFromConfig({ 1: { executors: ['payments'], reviewer: null } });
        expect(OnboardingRoles.isExecutorForStep('payments', 1)).toBe(true);
        expect(OnboardingRoles.isExecutorForStep('sales', 1)).toBe(false);
    });
});

// ─────────────────────────────────────────────
// isReviewerForStep
// ─────────────────────────────────────────────
describe('OnboardingRoles.isReviewerForStep', () => {
    it('should return true for admin regardless of step', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isReviewerForStep('admin', 2)).toBe(true);
        expect(OnboardingRoles.isReviewerForStep('admin', 5)).toBe(true);
    });

    it('should return true for leader regardless of step', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isReviewerForStep('leader', 3)).toBe(true);
    });

    it('should return true for "assistant" on steps 2, 3, 4, 6, 7 (default reviewer)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        [2, 3, 4, 6, 7].forEach(step => {
            expect(OnboardingRoles.isReviewerForStep('assistant', step)).toBe(true);
        });
    });

    it('should return false for "assistant" on step 1 (no reviewer)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isReviewerForStep('assistant', 1)).toBe(false);
    });

    it('should return false for "assistant" on step 5 (no reviewer)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isReviewerForStep('assistant', 5)).toBe(false);
    });

    it('should return false for "assistant" on step 8 (no reviewer)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isReviewerForStep('assistant', 8)).toBe(false);
    });

    it('should return false for "sales" on any step as reviewer (sales is executor, not reviewer)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        [1, 2, 3, 4, 5, 6, 7, 8].forEach(step => {
            expect(OnboardingRoles.isReviewerForStep('sales', step)).toBe(false);
        });
    });

    it('should reflect updated reviewer after initFromConfig', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        OnboardingRoles.initFromConfig({ 2: { executors: ['sales'], reviewer: 'payments' } });
        expect(OnboardingRoles.isReviewerForStep('payments', 2)).toBe(true);
        expect(OnboardingRoles.isReviewerForStep('assistant', 2)).toBe(false);
    });
});

// ─────────────────────────────────────────────
// getGlobalModuleRole
// ─────────────────────────────────────────────
describe('OnboardingRoles.getGlobalModuleRole', () => {
    it('should return "admin" for systemRole "admin"', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.getGlobalModuleRole('admin')).toBe('admin');
    });

    it('should return "leader" for systemRole "leader"', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.getGlobalModuleRole('leader')).toBe('leader');
    });

    it('should return "reviewer" for "assistant" (default: reviewer on multiple steps)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        // assistant is reviewer on steps 2, 3, 4, 6, 7 by default → isReviewer wins
        expect(OnboardingRoles.getGlobalModuleRole('assistant')).toBe('reviewer');
    });

    it('should return "executor" for "sales" (default: executor on steps 1-4, 6, 7)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.getGlobalModuleRole('sales')).toBe('executor');
    });

    it('should return systemRole unchanged for a role with no config assignment', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        // 'payments' is not in any step by default
        expect(OnboardingRoles.getGlobalModuleRole('payments')).toBe('payments');
    });

    it('should return "reviewer" for a role that is reviewer on at least one step, even if also executor', () => {
        // reviewer priority > executor priority in the implementation
        const { OnboardingRoles } = loadOnboardingRoles();
        // Configure assistant as both executor and reviewer on different steps
        const config = {};
        for (let i = 1; i <= 8; i++) {
            config[i] = { executors: ['assistant'], reviewer: 'assistant' };
        }
        OnboardingRoles.initFromConfig(config);
        expect(OnboardingRoles.getGlobalModuleRole('assistant')).toBe('reviewer');
    });

    it('should return "executor" after initFromConfig where the role is only an executor', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        const config = {};
        for (let i = 1; i <= 8; i++) {
            config[i] = { executors: ['tech'], reviewer: null };
        }
        OnboardingRoles.initFromConfig(config);
        expect(OnboardingRoles.getGlobalModuleRole('tech')).toBe('executor');
    });
});

// ─────────────────────────────────────────────
// initFromConfig
// ─────────────────────────────────────────────
describe('OnboardingRoles.initFromConfig', () => {
    it('should use defaults when called with null', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        OnboardingRoles.initFromConfig(null);
        // defaults: step 1 executor is 'sales'
        expect(OnboardingRoles.isExecutorForStep('sales', 1)).toBe(true);
    });

    it('should use defaults when called with empty object', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        OnboardingRoles.initFromConfig({});
        expect(OnboardingRoles.isExecutorForStep('sales', 1)).toBe(true);
        expect(OnboardingRoles.isReviewerForStep('assistant', 2)).toBe(true);
    });

    it('should override step 1 executor when called with custom config', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        OnboardingRoles.initFromConfig({
            1: { executors: ['antifraud'], reviewer: null }
        });
        expect(OnboardingRoles.isExecutorForStep('antifraud', 1)).toBe(true);
        expect(OnboardingRoles.isExecutorForStep('sales', 1)).toBe(false);
    });

    it('should fall back to defaults for steps not mentioned in the config', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        OnboardingRoles.initFromConfig({
            // Only override step 1; step 2 should stay at defaults
            1: { executors: ['antifraud'], reviewer: null }
        });
        // Step 2 default: executors=['sales'], reviewer='assistant'
        expect(OnboardingRoles.isExecutorForStep('sales', 2)).toBe(true);
        expect(OnboardingRoles.isReviewerForStep('assistant', 2)).toBe(true);
    });

    it('should handle a saved config that has non-array executors by falling back to defaults', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        // Pass a step config with invalid (non-array) executors
        OnboardingRoles.initFromConfig({
            1: { executors: 'not-an-array', reviewer: null }
        });
        // _mergeWithDefaults: Array.isArray fails → uses defaults for step 1
        expect(OnboardingRoles.isExecutorForStep('sales', 1)).toBe(true);
    });

    it('should allow multiple executors for a step', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        OnboardingRoles.initFromConfig({
            3: { executors: ['sales', 'payments'], reviewer: 'assistant' }
        });
        expect(OnboardingRoles.isExecutorForStep('sales', 3)).toBe(true);
        expect(OnboardingRoles.isExecutorForStep('payments', 3)).toBe(true);
    });

    it('should keep reviewer from saved config when provided', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        OnboardingRoles.initFromConfig({
            2: { executors: ['sales'], reviewer: 'payments' }
        });
        expect(OnboardingRoles.isReviewerForStep('payments', 2)).toBe(true);
        expect(OnboardingRoles.isReviewerForStep('assistant', 2)).toBe(false);
    });
});

// ─────────────────────────────────────────────
// destroy
// ─────────────────────────────────────────────
describe('OnboardingRoles.destroy', () => {
    it('should reset internal config to null, causing defaults to be used on next call', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        // Apply a custom config
        OnboardingRoles.initFromConfig({
            1: { executors: ['antifraud'], reviewer: null }
        });
        expect(OnboardingRoles.isExecutorForStep('antifraud', 1)).toBe(true);

        // Destroy resets _config = null
        OnboardingRoles.destroy();

        // After destroy, _getConfig() will call _cloneDefaults() → 'sales' is default executor for step 1
        expect(OnboardingRoles.isExecutorForStep('sales', 1)).toBe(true);
        expect(OnboardingRoles.isExecutorForStep('antifraud', 1)).toBe(false);
    });

    it('should not throw when called without prior initFromConfig', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(() => OnboardingRoles.destroy()).not.toThrow();
    });

    it('should allow re-initialization after destroy', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        OnboardingRoles.destroy();
        OnboardingRoles.initFromConfig({
            1: { executors: ['tech'], reviewer: null }
        });
        expect(OnboardingRoles.isExecutorForStep('tech', 1)).toBe(true);
    });

    it('getGlobalModuleRole should return defaults after destroy', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        // Set custom config where 'payments' is executor for all steps
        const config = {};
        for (let i = 1; i <= 8; i++) config[i] = { executors: ['payments'], reviewer: null };
        OnboardingRoles.initFromConfig(config);
        expect(OnboardingRoles.getGlobalModuleRole('payments')).toBe('executor');

        OnboardingRoles.destroy();

        // After destroy defaults apply: sales is executor, payments is not assigned
        expect(OnboardingRoles.getGlobalModuleRole('payments')).toBe('payments');
        expect(OnboardingRoles.getGlobalModuleRole('sales')).toBe('executor');
    });
});

// ─────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────
describe('OnboardingRoles — edge cases', () => {
    it('isExecutorForStep for step 0 (non-existent) should return false for non-admin', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isExecutorForStep('sales', 0)).toBe(false);
    });

    it('isReviewerForStep for step 99 (non-existent) should return false for non-admin', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isReviewerForStep('assistant', 99)).toBe(false);
    });

    it('isExecutorForStep with null role should return false (null is not admin/leader)', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        // null !== 'admin' and null !== 'leader'; indexOf(null) on executors array returns -1
        expect(OnboardingRoles.isExecutorForStep(null, 1)).toBe(false);
    });

    it('isReviewerForStep with undefined role should return false', () => {
        const { OnboardingRoles } = loadOnboardingRoles();
        expect(OnboardingRoles.isReviewerForStep(undefined, 2)).toBe(false);
    });

    it('each loaded instance should have isolated state', () => {
        const { OnboardingRoles: r1 } = loadOnboardingRoles();
        const { OnboardingRoles: r2 } = loadOnboardingRoles();
        r1.initFromConfig({ 1: { executors: ['tech'], reviewer: null } });
        // r2 should still use defaults
        expect(r2.isExecutorForStep('sales', 1)).toBe(true);
        expect(r2.isExecutorForStep('tech', 1)).toBe(false);
    });
});
