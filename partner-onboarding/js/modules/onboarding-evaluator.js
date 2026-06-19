'use strict';

/**
 * OnboardingEvaluator — pure stateless evaluator for declarative field rules.
 *
 * Phase 23 (RULES-01..07). Object-literal pattern (matches shared/js/workflow-machine.js, shared/js/event-manager.js).
 * Used by onboarding-form.js + onboarding-review.js + onboarding-field-renderer.js.
 *
 * 13-operator vocabulary (Phase 51 v2.35: +always for Group D 100% coverage):
 *   eq, neq, notEmpty, empty, role, roleIn, phase, status, flag, always, and, or, not
 *
 * Derivative methods:
 *   isFieldVisible (AND semantics)
 *   isFieldRequired (visibility check baked INSIDE — Pitfall #9 anti-regression, kills bug #8)
 *   isFieldReadonly (OR semantics)
 *   getFieldOptions (optionsSource provider delegation)
 *   getView (first-match step.viewRules[], smart default 'form')
 *   getAvailableButtons (showWhen filter + FSM intersect via WorkflowMachine.availableActions — Pitfall #10/#11 fix)
 *
 * Smart defaults для legacy fields (backwards compat во время per-field миграции):
 *   - field без visibility[] → visible
 *   - field без readonlyWhen[] → editable
 *   - field без requiredWhen[] → field.required boolean fallback
 *   - field без optionsSource → field.options || []
 *
 * @typedef {Object} Rule
 * @property {'eq'|'neq'|'notEmpty'|'empty'|'role'|'roleIn'|'phase'|'status'|'flag'|'always'|'and'|'or'|'not'} type
 * @property {string} [field]
 * @property {string|number|boolean} [value]
 * @property {string[]} [values]
 * @property {string} [flag]
 * @property {Rule[]} [rules]
 * @property {Rule} [rule]
 *
 * @typedef {Object} Field
 * @property {string} id
 * @property {string} type
 * @property {string} label
 * @property {boolean} [required]
 * @property {any[]} [options]
 * @property {Rule[]} [visibility]      — AND semantics
 * @property {Rule[]} [readonlyWhen]    — OR semantics
 * @property {Rule[]} [requiredWhen]    — OR semantics, visibility check baked INSIDE isFieldRequired
 * @property {OptionsSource} [optionsSource]
 *
 * @typedef {Object} OptionsSource
 * @property {string} provider
 * @property {string[]} [args]
 * @property {string[]} [dependsOn]
 * @property {string} [disabledMessage]
 *
 * @typedef {Object} Context
 * @property {Object} [data]
 * @property {string} [role]
 * @property {string} [userId]
 * @property {string} [executorId]
 * @property {string} [status]
 * @property {string} [phase]
 * @property {boolean} [isAdmin]
 * @property {boolean} [hasRequiredFields]
 * @property {boolean} [hasRejectReason]
 * @property {Object} [providers]
 */
(function () {
    'use strict';

    var OnboardingEvaluator = {
        /**
         * Pure 12-operator rule evaluator.
         * Defensive defaults: null/undefined rule → true, unknown type → true.
         *
         * @param {Rule|null|undefined} rule
         * @param {Context} ctx
         * @returns {boolean}
         */
        _evaluate: function (rule, ctx) {
            if (!rule) return true;
            if (!ctx) ctx = {};
            var data = ctx.data || {};
            switch (rule.type) {
                case 'eq':       return data[rule.field] === rule.value;
                case 'neq':      return data[rule.field] !== rule.value;
                case 'notEmpty': return !OnboardingEvaluator._isEmpty(data[rule.field]);
                case 'empty':    return OnboardingEvaluator._isEmpty(data[rule.field]);
                case 'role':     return ctx.role === rule.value;
                case 'roleIn':   return Array.isArray(rule.values) && rule.values.indexOf(ctx.role) !== -1;
                case 'phase':
                    // Phase 47 (v2.34) RULES-MIG Group C — extended `phase` operator.
                    // Backward-compatible: `value` (single string) continues работать. NEW: `values`
                    // (array of strings) — phase matches if ctx.phase ∈ rule.values (parallel `roleIn`
                    // pattern). Allows fields shown during multiple phases (e.g. fill-phase fields
                    // remain visible after handoff_complete to render readonly view of executor's data
                    // — matched by values:['fill','confirm']).
                    if (Array.isArray(rule.values)) return rule.values.indexOf(ctx.phase) !== -1;
                    return ctx.phase === rule.value;
                case 'status':   return ctx.status === rule.value;
                case 'flag':
                    // Phase 36 (v2.32) RULES-MIG Group A — extended `flag` operator.
                    // Backward-compatible: checks data['_' + rule.flag] first (legacy semantics),
                    // THEN falls back to ctx.flags array containing rule.flag (NEW semantics for
                    // request-metadata flags like `readonlyForImport` populated by form.js from
                    // request._meta.flags || derived from request.createdBy === 'import:google-sheets').
                    if (data['_' + rule.flag]) return true;
                    return Array.isArray(ctx.flags) && ctx.flags.indexOf(rule.flag) !== -1;
                case 'always':
                    // Phase 51 (v2.35) RULES-MIG Group D — `always` operator unlocker.
                    // Returns true unconditionally — used as declarative marker для always-required
                    // / always-visible Group D fields without conditional logic. Migration definition
                    // (Phase 23-07 audit § 21): a field is "migrated" if it has any of visibility[] /
                    // requiredWhen[] / readonlyWhen[] / optionsSource. `always` operator allows pure
                    // tautological migration (e.g. `visibility: [{type:'always'}]`) для Group D fields
                    // что unlocks 100% coverage milestone (43/43 = последний Group D).
                    // Backward-compatible: zero impact на existing 12 operators + Phase 36/41/47 extensions.
                    return true;
                case 'and':      return Array.isArray(rule.rules) && rule.rules.every(function (r) { return OnboardingEvaluator._evaluate(r, ctx); });
                case 'or':       return Array.isArray(rule.rules) && rule.rules.some(function (r) { return OnboardingEvaluator._evaluate(r, ctx); });
                case 'not':      return !OnboardingEvaluator._evaluate(rule.rule, ctx);
                default:         return true;  // unknown type — defensive default per CONTEXT.md
            }
        },

        /**
         * Empty check: null/undefined, empty string (after trim), empty array.
         * @param {*} value
         * @returns {boolean}
         */
        _isEmpty: function (value) {
            if (value === null || value === undefined) return true;
            if (typeof value === 'string') return value.trim() === '';
            if (Array.isArray(value)) return value.length === 0;
            return false;
        },

        /**
         * AND semantics: все visibility[] rules должны быть true. Без visibility[] → visible.
         * @param {Field} field
         * @param {Context} ctx
         * @returns {boolean}
         */
        isFieldVisible: function (field, ctx) {
            if (!field || !field.visibility) return true;
            if (!Array.isArray(field.visibility) || field.visibility.length === 0) return true;
            return field.visibility.every(function (rule) { return OnboardingEvaluator._evaluate(rule, ctx); });
        },

        /**
         * RULES-03 / Pitfall #9: visibility check FIRST — hidden field cannot be required.
         * Kills bug #8 reintroduction (hidden+requiredWhen blocking submit).
         * Затем: field.required boolean OR любое requiredWhen[] rule true.
         *
         * @param {Field} field
         * @param {Context} ctx
         * @returns {boolean}
         */
        isFieldRequired: function (field, ctx) {
            if (!field) return false;
            // CRITICAL Pitfall #9 anti-regression: visibility check FIRST.
            if (!OnboardingEvaluator.isFieldVisible(field, ctx)) return false;
            if (field.required) return true;
            if (!Array.isArray(field.requiredWhen) || field.requiredWhen.length === 0) return false;
            return field.requiredWhen.some(function (rule) { return OnboardingEvaluator._evaluate(rule, ctx); });
        },

        /**
         * OR semantics: любое readonlyWhen[] true → readonly. Без readonlyWhen[] → editable.
         * @param {Field} field
         * @param {Context} ctx
         * @returns {boolean}
         */
        isFieldReadonly: function (field, ctx) {
            if (!field || !Array.isArray(field.readonlyWhen) || field.readonlyWhen.length === 0) return false;
            return field.readonlyWhen.some(function (rule) { return OnboardingEvaluator._evaluate(rule, ctx); });
        },

        /**
         * Returns options array OR `{ disabled: true, message }` если dependsOn пуст.
         * Provider lookup: ctx.providers[name] (test injection) → window.OnboardingProviders[name] (browser).
         * Без optionsSource → field.options || [].
         *
         * @param {Field} field
         * @param {Context} ctx
         * @returns {Array|{disabled: boolean, message: string}}
         */
        getFieldOptions: function (field, ctx) {
            if (!field) return [];
            if (!field.optionsSource) return field.options || [];
            var src = field.optionsSource;
            var deps = src.dependsOn || [];
            ctx = ctx || {};
            var data = ctx.data || {};
            // Any dependsOn empty → disabled + message
            for (var i = 0; i < deps.length; i++) {
                if (OnboardingEvaluator._isEmpty(data[deps[i]])) {
                    return { disabled: true, message: src.disabledMessage || 'Заполните зависимые поля' };
                }
            }
            // Provider lookup: ctx.providers (test injection) → window.OnboardingProviders (browser)
            var providerFn = null;
            if (ctx.providers && typeof ctx.providers[src.provider] === 'function') {
                providerFn = ctx.providers[src.provider];
            } else if (typeof window !== 'undefined' && window.OnboardingProviders && typeof window.OnboardingProviders[src.provider] === 'function') {
                providerFn = window.OnboardingProviders[src.provider];
            }
            if (typeof providerFn === 'function') {
                var args = (src.args || []).map(function (argKey) { return data[argKey]; });
                // Phase 41 (v2.33) RULES-MIG Group B: include `field` in ctx for providers that
                // need to self-identify (e.g. generic getConditionField provider used by deal_1/2/3,
                // prepayment_method, prepayment_amount — all share one provider but resolve different
                // condition record fields based on field.id). Backward-compatible: existing providers
                // ignoring ctx.field continue working.
                var ctxWithField = ctx;
                if (ctx.field !== field) {
                    ctxWithField = {};
                    for (var key in ctx) { if (Object.prototype.hasOwnProperty.call(ctx, key)) ctxWithField[key] = ctx[key]; }
                    ctxWithField.field = field;
                }
                return providerFn.apply(null, args.concat([ctxWithField]));
            }
            return field.options || [];
        },

        // ===================== VIEW + BUTTONS (RULES-07) =====================

        /**
         * Returns first-match view from step.viewRules[].
         * Smart default: 'form'.
         *
         * @param {Object} step
         * @param {Context} ctx
         * @returns {'form'|'review'|'readonly'}
         */
        getView: function (step, ctx) {
            if (!step || !Array.isArray(step.viewRules) || step.viewRules.length === 0) return 'form';
            for (var i = 0; i < step.viewRules.length; i++) {
                var rule = step.viewRules[i];
                if (rule && OnboardingEvaluator._evaluate(rule.when, ctx)) {
                    return rule.view || 'form';
                }
            }
            return 'form';
        },

        /**
         * Filters step.buttons[] by showWhen rule, THEN intersects with WorkflowMachine.availableActions().
         *
         * **CRITICAL (Pitfall #10/#11 fix):** FSM dominates. Rules can SUBTRACT (showWhen=false hides
         * FSM-allowed button) but cannot ADD (cannot show FSM-forbidden action even if showWhen=true).
         *
         * Buttons without showWhen are considered always-allowed by rules; only FSM filter applies.
         *
         * @param {Object} step — { buttons?: Button[] }
         * @param {Context} ctx — { status, role, data, ... } — passed to WorkflowMachine via getCtx closure
         * @returns {Array}
         */
        getAvailableButtons: function (step, ctx) {
            if (!step || !Array.isArray(step.buttons) || step.buttons.length === 0) return [];
            ctx = ctx || {};

            // Stage 1: filter by showWhen rule
            var ruleAllowed = step.buttons.filter(function (btn) {
                if (!btn) return false;
                if (!btn.showWhen) return true;  // no rule → always-allowed by rules
                return OnboardingEvaluator._evaluate(btn.showWhen, ctx);
            });

            // Stage 2: intersect with FSM availableActions (Phase 22)
            // Defensive: if WorkflowMachine global missing → return ruleAllowed (degraded mode for test/edge envs)
            var WM = (typeof WorkflowMachine !== 'undefined' && WorkflowMachine) ||
                     (typeof window !== 'undefined' && window.WorkflowMachine) ||
                     null;
            if (!WM || typeof WM.availableActions !== 'function') return ruleAllowed;

            // Pass getCtx getter (Pitfall #7 anti-stale-closure) — WM guards re-read ctx at evaluation time
            var fsmActions = WM.availableActions(ctx.status, function () { return ctx; }) || [];
            return ruleAllowed.filter(function (btn) {
                // Buttons without action — bypass FSM (action-less = pure UI like "Cancel modal" — out of FSM scope)
                if (!btn.action) return true;
                return fsmActions.indexOf(btn.action) !== -1;
            });
        },

        // ===================== CASCADE (RULES-06) =====================

        /**
         * Pure cascade diff — TEST-ONLY API per Pitfall #10.
         * Production callers MUST use applyCascadeWithConfirm.
         *
         * Phase 23 v1 — autofills are inline-provided via cascadeDef.autofillsData (Object<fieldId,value>)
         * OR returned empty if cascadeDef.autofill: true без autofillsData. Provider indirection
         * (window.OnboardingProviders) deferred — caller in 23-06 builds autofillsData inline based
         * on METHOD_NAMES lookup before calling applyCascadeWithConfirm.
         *
         * @param {Object} cascadeDef — { trigger, clears: string[], autofill?: bool, autofillsData?: Object<string,*> }
         * @param {*} triggerValue — new value of the trigger field
         * @param {Object} currentData — current form data
         * @returns {{ clears: Object, autofills: Object }}
         */
        applyCascade: function (cascadeDef, triggerValue, currentData) {
            var diff = { clears: {}, autofills: {} };
            if (!cascadeDef) return diff;
            currentData = currentData || {};

            // Clears: fields listed in cascadeDef.clears that have non-empty current values
            if (Array.isArray(cascadeDef.clears)) {
                cascadeDef.clears.forEach(function (fieldId) {
                    if (!OnboardingEvaluator._isEmpty(currentData[fieldId])) {
                        diff.clears[fieldId] = undefined;
                    }
                });
            }

            // Autofills: inline-provided via cascadeDef.autofillsData (caller responsibility).
            // Phase 23 v1 — no provider indirection. Caller (form.js _handleCascadeChange in 23-06)
            // builds autofillsData based on triggerValue lookup в METHOD_NAMES BEFORE calling.
            if (cascadeDef.autofill && cascadeDef.autofillsData && typeof cascadeDef.autofillsData === 'object') {
                Object.keys(cascadeDef.autofillsData).forEach(function (k) {
                    diff.autofills[k] = cascadeDef.autofillsData[k];
                });
            }

            return diff;
        },

        /**
         * DEFAULT cascade API per Pitfall #10. Shows ConfirmModal listing field labels + values
         * before applying clears/overwrites. Cancel triggers opts.onReverted (caller restores trigger).
         *
         * Silent autofills (empty target) apply IMMEDIATELY via opts.onApplied — independent of
         * modal confirm/cancel (per CONTEXT.md §Cascade UX — autofill applies silent if target empty).
         * Overwrite autofills (non-empty target) gated behind confirm modal.
         *
         * Uses POSITIONAL ConfirmModal.show signature (verified против shared/js/confirm-modal.js строка 23).
         *
         * @param {Object} cascadeDef
         * @param {*} triggerValue
         * @param {Object} currentData
         * @param {Object} [opts]
         * @param {Object<string, string>} [opts.labelLookup] — fieldId → human label map
         * @param {Function} [opts.onApplied] — called with {clears, autofills} after silent apply OR after confirm
         * @param {Function} [opts.onReverted] — called when user cancels modal
         * @returns {Promise<{clears, autofills, applied: boolean}>}
         */
        applyCascadeWithConfirm: function (cascadeDef, triggerValue, currentData, opts) {
            opts = opts || {};
            currentData = currentData || {};
            var diff = OnboardingEvaluator.applyCascade(cascadeDef, triggerValue, currentData);

            // Split autofills into silent (target empty) vs overwrite (target non-empty)
            var silentAutofills = {};
            var overwriteAutofills = {};
            Object.keys(diff.autofills).forEach(function (fid) {
                if (OnboardingEvaluator._isEmpty(currentData[fid])) {
                    silentAutofills[fid] = diff.autofills[fid];
                } else {
                    overwriteAutofills[fid] = diff.autofills[fid];
                }
            });

            var clearFieldIds = Object.keys(diff.clears);
            var overwriteFieldIds = Object.keys(overwriteAutofills);
            var silentFieldIds = Object.keys(silentAutofills);

            // ALWAYS apply silent autofills first — independent of modal/confirm
            // Per CONTEXT.md: empty-target autofills apply silent regardless of cancel
            if (silentFieldIds.length > 0 && typeof opts.onApplied === 'function') {
                opts.onApplied({ clears: {}, autofills: silentAutofills });
            }

            // No destructive changes (no clears, no overwrites) → resolve immediately as applied
            if (clearFieldIds.length === 0 && overwriteFieldIds.length === 0) {
                return Promise.resolve({ clears: diff.clears, autofills: diff.autofills, applied: true });
            }

            // Build modal body — ONLY clears + overwrites (silent autofills NOT shown — they're already applied)
            var labelLookup = opts.labelLookup || {};
            var body = OnboardingEvaluator._buildCascadeConfirmBody(diff.clears, overwriteAutofills, currentData, labelLookup);

            // Defensive: ConfirmModal not loaded → apply destructive changes silently rather than no-op.
            // No-op would hide real bugs and re-introduce Pitfall #10 (silent loss). Better: explicit log + apply.
            // Resolve reference once: prefer global ConfirmModal (test sandbox + browser script tag), fallback window.ConfirmModal.
            if ((typeof ConfirmModal === 'undefined' || !ConfirmModal || typeof ConfirmModal.show !== 'function')
                && (typeof window === 'undefined' || !window.ConfirmModal || typeof window.ConfirmModal.show !== 'function')) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[OnboardingEvaluator] ConfirmModal not loaded — applying cascade silently');
                }
                if (typeof opts.onApplied === 'function') {
                    opts.onApplied({ clears: diff.clears, autofills: overwriteAutofills });
                }
                return Promise.resolve({ clears: diff.clears, autofills: diff.autofills, applied: true });
            }

            // POSITIONAL ConfirmModal.show signature — verified против shared/js/confirm-modal.js:23
            return ConfirmModal.show('Подтвердите изменение', {
                description: body,
                confirmText: 'Очистить и продолжить',
                cancelText: 'Отменить',
                danger: clearFieldIds.length > 0
            }).then(function (confirmed) {
                if (confirmed) {
                    if (typeof opts.onApplied === 'function') {
                        opts.onApplied({ clears: diff.clears, autofills: overwriteAutofills });
                    }
                    return { clears: diff.clears, autofills: diff.autofills, applied: true };
                } else {
                    if (typeof opts.onReverted === 'function') opts.onReverted();
                    return { clears: diff.clears, autofills: diff.autofills, applied: false };
                }
            });
        },

        /**
         * Builds confirm modal body string listing clears + overwrites with labels + truncated values.
         * Silent autofills (empty target) NOT included — they're already applied before modal.
         *
         * @param {Object} clears — fieldId → undefined map
         * @param {Object} overwriteAutofills — fieldId → newValue map (target non-empty)
         * @param {Object} currentData
         * @param {Object<string,string>} labelLookup
         * @returns {string}
         */
        _buildCascadeConfirmBody: function (clears, overwriteAutofills, currentData, labelLookup) {
            var bodyLines = [];
            var clearFieldIds = Object.keys(clears);
            var overwriteFieldIds = Object.keys(overwriteAutofills);

            if (clearFieldIds.length > 0) {
                var clearedDescriptions = clearFieldIds.map(function (fid) {
                    var label = labelLookup[fid] || fid;
                    var val = OnboardingEvaluator._truncate(currentData[fid], 30);
                    return '«' + label + '» ("' + val + '")';
                });
                bodyLines.push('Будут очищены поля: ' + clearedDescriptions.join(', ') + '.');
            }
            if (overwriteFieldIds.length > 0) {
                var owDescriptions = overwriteFieldIds.map(function (fid) {
                    var label = labelLookup[fid] || fid;
                    var oldVal = OnboardingEvaluator._truncate(currentData[fid], 30);
                    var newVal = OnboardingEvaluator._truncate(overwriteAutofills[fid], 30);
                    return '«' + label + '»: "' + oldVal + '" → "' + newVal + '"';
                });
                bodyLines.push('Будут перезаписаны поля: ' + owDescriptions.join(', ') + '.');
            }
            return bodyLines.join(' ') + ' Продолжить?';
        },

        /**
         * Truncates value to maxLen chars + ellipsis if longer.
         * @param {*} value
         * @param {number} maxLen
         * @returns {string}
         */
        _truncate: function (value, maxLen) {
            if (value === null || value === undefined) return '';
            var s = String(value);
            if (s.length <= maxLen) return s;
            return s.slice(0, maxLen) + '…';
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = OnboardingEvaluator;
    }
    if (typeof window !== 'undefined') {
        window.OnboardingEvaluator = OnboardingEvaluator;
    }
})();
