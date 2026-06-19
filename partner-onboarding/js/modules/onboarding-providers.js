'use strict';

/**
 * OnboardingProviders — registry of named option-providers for declarative `optionsSource`.
 *
 * Phase 41 (v2.33) RULES-MIG Group B unblocker. Wires the cascade dropdowns
 * (condition_country → method_type → method_name → deal_X / prepayment_X) to declarative
 * `optionsSource` config in onboarding-config.js, replacing imperative branches in
 * onboarding-form.js _renderFields.
 *
 * Each provider is invoked by OnboardingEvaluator.getFieldOptions with:
 *   provider(...resolvedArgs, ctxWithField)
 *
 * where `resolvedArgs` are values from `data[argKey]` for each `argKey` in optionsSource.args
 * and `ctxWithField` is the eval ctx augmented with `ctx.field = field` (Phase 41 ext.).
 *
 * Provider return shapes (interpreted by form.js _renderFields):
 *   - Array<{value,label}> — render as <select> dropdown (incl. pipe-split deal options)
 *   - { disabled: true, message } — render disabled placeholder (cascade dependency missing)
 *   - { hidden: true } — render '' (skip entirely — no condition record matches)
 *   - { readonlyValue: 'X' } — render readonly input with value 'X' (single condition value)
 *
 * Smart defaults:
 *   - Provider missing → evaluator falls back к field.options || []
 *   - Provider throws → caller swallows (form.js wraps в try/catch defensively)
 */
(function () {
    'use strict';

    var OnboardingProviders = {
        /**
         * Returns list of countries from active OnboardingSource conditions table.
         * Used by condition_country select (step 2).
         *
         * @param {Object} ctx
         * @returns {Array<{value:string,label:string}>}
         */
        getCountries: function (ctx) {
            if (typeof OnboardingSource === 'undefined' || !OnboardingSource || typeof OnboardingSource.getCountries !== 'function') return [];
            return OnboardingSource.getCountries() || [];
        },

        /**
         * Returns list of method types filtered by selected country.
         * Used by method_type select (step 2). dependsOn ['condition_country'] — evaluator
         * guards against empty country before invoking this provider.
         *
         * @param {string} country
         * @param {Object} ctx
         * @returns {Array<{value:string,label:string}>}
         */
        getMethodTypes: function (country, ctx) {
            if (typeof OnboardingSource === 'undefined' || !OnboardingSource || typeof OnboardingSource.getMethodTypes !== 'function') return [];
            return OnboardingSource.getMethodTypes(country) || [];
        },

        /**
         * Returns list of method names filtered by country + type.
         * Used by method_name select (step 2). dependsOn ['condition_country', 'method_type'].
         *
         * @param {string} country
         * @param {string} methodType
         * @param {Object} ctx
         * @returns {Array<{value:string,label:string}>}
         */
        getMethodNames: function (country, methodType, ctx) {
            if (typeof OnboardingSource === 'undefined' || !OnboardingSource || typeof OnboardingSource.getMethodNames !== 'function') return [];
            return OnboardingSource.getMethodNames(country, methodType) || [];
        },

        /**
         * Generic provider for deal_1/2/3 + prepayment_method/amount.
         * Looks up condition record by (country, type, name) and returns the field-id-keyed value
         * shaped per pipe-split semantics:
         *
         *   - condition not found OR field empty → { hidden: true }   (form.js renders '')
         *   - value contains '|' → Array<{value,label}> (multi-option dropdown)
         *   - single value (no pipe) → { readonlyValue: 'X' }
         *
         * Self-identifies via ctx.field.id (Phase 41 evaluator extension).
         *
         * @param {string} country
         * @param {string} methodType
         * @param {string} methodName
         * @param {Object} ctx
         * @returns {Array|{hidden:boolean}|{readonlyValue:string}}
         */
        getConditionField: function (country, methodType, methodName, ctx) {
            if (typeof OnboardingSource === 'undefined' || !OnboardingSource || typeof OnboardingSource.getCondition !== 'function') return { hidden: true };
            if (!ctx || !ctx.field || !ctx.field.id) return { hidden: true };
            var cond = OnboardingSource.getCondition(country, methodType, methodName);
            if (!cond || !cond[ctx.field.id]) return { hidden: true };

            var raw = String(cond[ctx.field.id]);
            var parts = raw.split('|').map(function (s) { return s.trim(); }).filter(Boolean);

            if (parts.length > 1) {
                return parts.map(function (p) { return { value: p, label: p }; });
            }
            return { readonlyValue: raw };
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = OnboardingProviders;
    }
    if (typeof window !== 'undefined') {
        window.OnboardingProviders = OnboardingProviders;
    }
})();
