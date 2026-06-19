'use strict';

/**
 * WorkflowMachine — pure finite state machine for partner-onboarding workflow.
 *
 * Phase 22 (WMACH-01). Frontend UX optimization (button visibility, action validity).
 * Backend keeps inline status checks as authoritative source of truth.
 *
 * 8 actions × 7 source statuses. Guards take getContext getter (Pitfall #7 anti-stale-closure).
 *
 * Public API:
 *   canTransition(currentStatus, action, getContext) → {allowed, nextStatus?, reason?}
 *   availableActions(currentStatus, getContext) → Array<action>
 *
 * Status enum (verified Task 0 grep + AppsScript_Test.js:5181-5212):
 *   new, in_progress, on_review, approved, revision_needed, cancelled, completed
 *   NOT 'rejected' (invites only, line 2744), NOT 'draft' (tasks only, line 4496)
 *
 * Actions (mirror backend dispatcher AppsScript_Test.js:5573-5670):
 *   SUBMIT, APPROVE, REJECT, CANCEL, REACTIVATE, REASSIGN, ROLLBACK, WITHDRAW
 *   (excluded: SAVE_DRAFT — always valid in working states; COMPLETE — backend-derived)
 */
(function () {
    'use strict';

    const WorkflowMachine = {
        // 8 actions × valid source → next status mappings
        transitions: {
            SUBMIT: {
                in_progress: 'on_review',
                revision_needed: 'on_review',
                new: 'on_review',
                approved: 'on_review'  // re-submit after approve (multi-step)
            },
            APPROVE: {
                on_review: 'approved'
            },
            REJECT: {
                on_review: 'revision_needed'
            },
            CANCEL: {
                in_progress: 'cancelled',
                on_review: 'cancelled',
                new: 'cancelled',
                approved: 'cancelled',
                revision_needed: 'cancelled'
            },
            REACTIVATE: {
                cancelled: 'in_progress'
            },
            REASSIGN: {
                in_progress: 'in_progress',
                on_review: 'on_review',
                new: 'new',
                approved: 'approved',
                revision_needed: 'revision_needed'
            },
            WITHDRAW: {
                on_review: 'in_progress'
            },
            ROLLBACK: {
                approved: 'in_progress',
                on_review: 'in_progress',
                revision_needed: 'in_progress'
            }
        },

        // Guards: (getContext) => boolean
        // getContext is a getter — re-read at evaluation time to avoid stale closure (Pitfall #7)
        // Context shape: { role: 'executor'|'reviewer'|'admin'|...|guest, isAdmin: bool, executorId, userId, hasRequiredFields, hasRejectReason }
        guards: {
            SUBMIT: function (getCtx) {
                const c = getCtx();
                return (c.role === 'executor' || c.isAdmin) && c.hasRequiredFields !== false;
            },
            APPROVE: function (getCtx) {
                const c = getCtx();
                return c.role === 'reviewer' || c.isAdmin;
            },
            REJECT: function (getCtx) {
                const c = getCtx();
                return (c.role === 'reviewer' || c.isAdmin) && !!c.hasRejectReason;
            },
            REASSIGN: function (getCtx) {
                const c = getCtx();
                // BFIX (audit 2026-05-19): reviewer тоже может reassign во время on_review.
                // UI logic в onboarding-review.js:197 говорит canManage=true для reviewer
                // при on_review — FSM guard был более узким → кнопка "Передать" disabled,
                // tooltip "Guard failed". Бизнес-смысл: ревьюер, получив плохо заполненную
                // заявку, может передать её другому executor вместо reject+rework cycle.
                return c.role === 'executor' || c.role === 'reviewer' || c.isAdmin;
            },
            CANCEL: function (getCtx) {
                const c = getCtx();
                return c.isAdmin;
            },
            REACTIVATE: function (getCtx) {
                const c = getCtx();
                return c.isAdmin;
            },
            WITHDRAW: function (getCtx) {
                const c = getCtx();
                return c.role === 'executor' || c.isAdmin;
            },
            ROLLBACK: function (getCtx) {
                const c = getCtx();
                return c.role === 'reviewer' || c.isAdmin;
            }
        },

        /**
         * canTransition — check if action is allowed from currentStatus в given context.
         * @param {string} currentStatus
         * @param {string} action — one of 8 actions
         * @param {function} getContext — getter returning context object
         * @returns {{allowed: boolean, nextStatus?: string, reason?: string}}
         */
        canTransition: function (currentStatus, action, getContext) {
            const fromMap = this.transitions[action];
            if (!fromMap) {
                return { allowed: false, reason: 'Unknown action: ' + action };
            }
            const nextStatus = fromMap[currentStatus];
            if (!nextStatus) {
                return { allowed: false, reason: 'No transition from ' + currentStatus + ' via ' + action };
            }
            const guard = this.guards[action];
            if (guard && typeof getContext === 'function' && !guard(getContext)) {
                return { allowed: false, reason: 'Guard failed for ' + action };
            }
            return { allowed: true, nextStatus: nextStatus };
        },

        /**
         * availableActions — list all actions valid from currentStatus в given context.
         * @param {string} currentStatus
         * @param {function} getContext — getter returning context object
         * @returns {Array<string>}
         */
        availableActions: function (currentStatus, getContext) {
            const self = this;
            return Object.keys(this.transitions).filter(function (action) {
                return self.canTransition(currentStatus, action, getContext).allowed;
            });
        }
    };

    // Browser global export
    if (typeof window !== 'undefined') {
        window.WorkflowMachine = WorkflowMachine;
    }

    // CommonJS export для vitest
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WorkflowMachine;
    }
})();
