/* onboarding-review.js — Просмотр и проверка (reviewer) — readonly + approve/reject */

const OnboardingReview = (() => {
    'use strict';

    let _reviewChecklistFields = [];
    let _commentListenerAttached = false;

    function render(request, stepNumber) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return;

        _reviewChecklistFields = [];

        // Sidebar: vertical steps + info
        OnboardingSteps.renderVertical('reviewSteps', stepNumber);
        OnboardingSteps.renderInfo('reviewInfo', request);

        // Main: header + current step data + actions
        _renderHeader(request, step);
        _renderCurrentStep(step, request.stageData[stepNumber] || {}, request);
        _updateActions(request);
        _attachCommentListener(request);
    }

    /**
     * BFIX (audit 2026-05-19): live re-evaluation FSM REJECT guard на input.
     * Раньше: ввод текста не триггерил _updateActions → cached false → reject заблокирован.
     * Сейчас: два listener'а (idempotent через флаг):
     *   1. #reviewComment input — главный textarea на не-checklist шагах
     *   2. #reviewFields delegated input — ловит .checklist-comment-input
     *      (важно: textarea'ы рендерятся динамически на каждом шаге, поэтому delegation)
     * FSM check читает свежее значение → btnReject toggles в realtime.
     */
    function _attachCommentListener(request) {
        if (_commentListenerAttached) return;
        const reEvalActions = () => {
            const current = OnboardingState && OnboardingState.get
                ? OnboardingState.get('currentRequest')
                : request;
            if (current) _updateActions(current);
        };
        const commentEl = document.getElementById('reviewComment');
        if (commentEl) commentEl.addEventListener('input', reEvalActions);
        const reviewFields = document.getElementById('reviewFields');
        if (reviewFields) {
            // Event delegation: ловит input на любом .checklist-comment-input независимо
            // от того когда он добавлен в DOM (re-render между шагами).
            reviewFields.addEventListener('input', (e) => {
                if (e.target && e.target.classList && e.target.classList.contains('checklist-comment-input')) {
                    reEvalActions();
                }
            });
        }
        _commentListenerAttached = true;
    }

    function _renderHeader(request, step) {
        const header = document.getElementById('reviewHeader');
        if (!header) return;

        let badgeLabel, badgeClass;
        if (step.number < request.currentStep) {
            badgeLabel = 'Пройден';
            badgeClass = 'status-success';
        } else if (request.status === 'completed') {
            badgeLabel = 'Завершено';
            badgeClass = 'status-success';
        } else {
            const statusConf = OnboardingConfig.STATUSES[request.status] || {};
            badgeLabel = statusConf.label || request.status;
            badgeClass = statusConf.cssClass || '';
        }
        // Plan 27-02 MIG-03: XSS-safe DOM construction (replaceChildren + textContent)
        header.replaceChildren();
        const nameDiv = document.createElement('div');
        nameDiv.className = 'review-step-name';
        nameDiv.textContent = OnboardingConfig.getStepLabel(step.number);
        const badge = document.createElement('span');
        badge.className = ('status-badge ' + (badgeClass || '')).trim();
        badge.textContent = badgeLabel;
        header.appendChild(nameDiv);
        header.appendChild(badge);
    }

    function _renderCurrentStep(step, data, request) {
        const container = document.getElementById('reviewFields');
        if (!container) return;

        const { sysRole, isAdmin } = OnboardingUtils.getRoles();
        const isOnReview = request.status === 'on_review';
        const isReviewer = step && (OnboardingRoles.isReviewerForStep(sysRole, step.number) || isAdmin);
        const isTerminal = request.status === 'completed' || request.status === 'cancelled';
        const canReview = !isTerminal && isOnReview && isReviewer && step.number === request.currentStep;

        // Work status current step: reviewer hasn't received submission yet — show empty fields
        const isWorkStatus = OnboardingConfig.isWorkStatus(request.status);
        const isCurrentNotSubmitted = isWorkStatus && step.number === request.currentStep
            && isReviewer && !OnboardingRoles.isExecutorForStep(sysRole, step.number);
        if (isCurrentNotSubmitted) data = {};

        // BFIX systemic guard: if data is empty due to isCurrentNotSubmitted AND the request
        // is pending (optimistic), show a loading state instead of dashes to prevent flash.
        // Covers _rejectStep and any future optimistic mutations that land here with empty data.
        if (isCurrentNotSubmitted && request._pending) {
            container.innerHTML = '<div class="loading-state"><span class="spinner"></span></div>';
            return;
        }

        const bannerHtml = request.lastComment ? `<div class="banner-warning">
                <img src="../shared/icons/alert-triangle.svg" width="16" height="16" alt="">
                <div class="banner-text">
                    <strong>${request.status === 'cancelled' ? 'Причина отмены:' : 'Замечание:'}</strong> ${Utils.escapeHtml(request.lastComment)}
                </div>
            </div>` : '';
        container.innerHTML = `${bannerHtml}<div class="review-fields-list">${_renderReadonly(step, data, request, canReview)}</div>`;
    }

    function _renderReadonly(step, data, request, canReview) {
        // BFIX: For past completed dynamicExecutor steps where backend used skipHandoffConfirm=true,
        // _handoff_complete is never set → FieldRenderer.isFieldVisible derives phase='fill' →
        // reviewer-filled fields (account_login, account_password) are hidden for Sales.
        // Pass phaseOverride='confirm' so filled fields are visible in readonly review of past steps.
        const isPastStep = request && Number(step.number) < Number(request.currentStep);
        const _pastPhaseOverride = (isPastStep && step.dynamicExecutor) ? 'confirm' : undefined;
        return step.fields.map(field => {
            // visibleWhen: hide if controlling field doesn't match.
            // Phase 47 (v2.34): pass step чтобы Group C phase-aware fields (account_login,
            // messenger_login/password/checklist) корректно visibility check (ctx.phase derived
            // из step.dynamicExecutor + data._handoff_complete).
            if (!FieldRenderer.isFieldVisible(field, data, step, _pastPhaseOverride)) return '';
            // Resolve value with autofill
            const value = FieldRenderer.resolveValue(field.id, data, field, request);
            // Render readonly (with interactive checklist for reviewer)
            return FieldRenderer.renderReadonly(field, value, {
                canReview,
                reviewChecklistFields: _reviewChecklistFields,
                allowDataUrls: false
            });
        }).join('');
    }

    /**
     * Phase 22 (WMACH-05): build FSM context getter for review action buttons.
     * Returns a getter (closure) — re-reads context at evaluation time per Pitfall #7.
     *
     * BFIX (audit 2026-05-19): hasRejectReason читается из ДВУХ источников:
     *   1. Main #reviewComment textarea (для шагов БЕЗ checklist)
     *   2. Любой непустой .checklist-comment-input в #reviewFields (для шагов С checklist)
     * Раньше читал только #1 → на шагах 4/6/7 (с checklist) reject было невозможно
     * даже после ввода причины в checklist-комментарий.
     */
    function _buildReviewContext(request) {
        const stepNumber = request.currentStep;
        return function () {
            const { sysRole, isAdmin } = OnboardingUtils.getRoles();
            const userEmail = OnboardingState.get('userEmail');
            const isReviewer = OnboardingRoles.isReviewerForStep(sysRole, stepNumber);
            const isExecutor = OnboardingRoles.isExecutorForStep(sysRole, stepNumber);
            const ctxRole = isReviewer ? 'reviewer' : (isExecutor ? 'executor' : sysRole);
            const hasRejectReason = _hasAnyRejectReason();
            return {
                role: ctxRole,
                isAdmin: !!isAdmin,
                executorId: request.assigneeEmail,
                userId: userEmail,
                hasRequiredFields: true,  // not relevant for review actions
                hasRejectReason
            };
        };
    }

    function _hasAnyRejectReason() {
        const commentEl = document.getElementById('reviewComment');
        const isCommentRowVisible = commentEl
            && !document.getElementById('reviewCommentRow')?.classList.contains('hidden');
        if (isCommentRowVisible && commentEl.value && commentEl.value.trim().length > 0) {
            return true;
        }
        // Checklist comments inside #reviewFields (only visible reviewer comment inputs count)
        const reviewFields = document.getElementById('reviewFields');
        if (reviewFields) {
            const inputs = reviewFields.querySelectorAll('.checklist-comment-input');
            for (const inp of inputs) {
                if (inp.value && inp.value.trim().length > 0) return true;
            }
        }
        return false;
    }

    /**
     * Phase 22 (WMACH-05): apply pre-computed FSM check result to button.
     * Buttons остаются ВИДИМЫМИ (visibility decided by existing canX flags),
     * но disabled с tooltip когда FSM denies — discoverable UI per CONTEXT.md.
     */
    function _applyFsmCheck(btn, check) {
        if (!btn || !check) return;
        if (check.allowed) {
            btn.disabled = false;
            btn.removeAttribute('title');
            btn.classList.remove('btn-disabled');
        } else {
            btn.disabled = true;
            btn.title = check.reason || 'Действие недоступно в текущем статусе';
            btn.classList.add('btn-disabled');
        }
    }

    function _updateActions(request) {
        const { sysRole, isAdmin } = OnboardingUtils.getRoles();
        const myEmail = OnboardingState.get('userEmail');
        const step = OnboardingConfig.getStep(request.currentStep);
        const isReviewer = step && (OnboardingRoles.isReviewerForStep(sysRole, step.number) || isAdmin);
        const isExecutor = step && OnboardingRoles.isExecutorForStep(sysRole, step.number);
        const isTerminal = request.status === 'completed' || request.status === 'cancelled';
        const isOnReview = request.status === 'on_review';

        // Dynamic handoff: executor can withdraw when they handed off to reviewer (on_review)
        const effectiveExecutor = OnboardingConfig.getStepEffectiveExecutor(request.currentStep, request.stageData);
        const isDynamicHandoff = step && step.dynamicExecutor && effectiveExecutor !== step.executor && OnboardingRoles.isExecutorForStep(sysRole, step.number);

        const canReview = !isTerminal && isOnReview && isReviewer && step.number === request.currentStep;
        const canWithdraw = !isTerminal && isOnReview && (
            (isExecutor && (request.assigneeEmail === myEmail || request.createdBy === myEmail)) ||
            isDynamicHandoff
        );

        // Phase 22 (WMACH-05): FSM context getter (Pitfall #7 — re-evaluated per render).
        // hasFsm guard защищает от ReferenceError если workflow-machine.js не подключён (test/edge env).
        const hasFsm = typeof WorkflowMachine !== 'undefined' && WorkflowMachine;
        const getCtx = _buildReviewContext(request);
        // availableActions snapshot — exposed для tests verifying integration; Plan 22-08
        // будет использовать его для замены existing canX checks.
        const fsmAvailable = hasFsm ? WorkflowMachine.availableActions(request.status, getCtx) : [];
        void fsmAvailable;

        // Reviewer buttons: Одобрить, Отклонить, Комментарий
        const btnReject = document.getElementById('btnReject');
        const btnApprove = document.getElementById('btnApprove');
        const commentRow = document.getElementById('reviewCommentRow');
        if (btnReject) btnReject.classList.toggle('hidden', !canReview);
        if (btnApprove) btnApprove.classList.toggle('hidden', !canReview);
        // BFIX (audit 2026-05-19 v2): re-sync checklist state ДО решения о видимости textarea —
        // _reviewChecklistFields populated в _collectChecklistState (вызывается после _renderCurrentStep).
        // Без этого первый _updateActions видит длину 0 и показывает оба comment-поля одновременно.
        _collectChecklistState();
        // На checklist-шагах (4, 6, 7) скрываем нижний главный textarea —
        // причина отклонения вводится в .checklist-comment-input у конкретного пункта.
        // На не-checklist шагах (2, 3) — наоборот, виден главный textarea.
        const hasChecklist = _reviewChecklistFields.length > 0;
        const showGeneralComment = canReview && !hasChecklist;
        if (commentRow) commentRow.classList.toggle('hidden', !showGeneralComment);
        // Phase 22 (WMACH-05): explicit per-button FSM check + disabled+tooltip layer
        if (hasFsm) {
            _applyFsmCheck(btnApprove, WorkflowMachine.canTransition(request.status, 'APPROVE', getCtx));
            // BFIX (audit 2026-05-19 v3): кнопка "Отклонить" ВСЕГДА enabled когда visible
            // (canReview=true). Раньше — disabled из-за hasRejectReason=false, пользователь
            // не понимал почему. Сейчас: click всегда вызывает _rejectStep, который сам
            // показывает Toast.error с конкретной инструкцией ("Добавьте комментарий..." или
            // "Снимите отметку с пунктов..." или "Укажите комментарий для каждого пункта..." —
            // см. partner-onboarding.js _rejectStep). Hover-тултип показывает то же.
            if (canReview && btnReject) {
                btnReject.disabled = false;
                btnReject.classList.remove('btn-disabled');
                if (!_hasAnyRejectReason()) {
                    btnReject.title = hasChecklist
                        ? 'Опишите проблему в комментарии у пункта чек-листа'
                        : 'Укажите причину отклонения в поле комментария';
                } else {
                    btnReject.removeAttribute('title');
                }
            }
        }

        // Reviewer buttons (left): Передать, Откатить
        const canManage = !isTerminal && (isAdmin || (isReviewer && isOnReview));
        const btnReassign = document.getElementById('btnReassign');
        const btnRollback = document.getElementById('btnRollback');
        if (btnReassign) btnReassign.classList.toggle('hidden', !canManage);
        if (btnRollback) btnRollback.classList.toggle('hidden', !canManage);
        if (hasFsm) {
            _applyFsmCheck(btnReassign, WorkflowMachine.canTransition(request.status, 'REASSIGN', getCtx));
            _applyFsmCheck(btnRollback, WorkflowMachine.canTransition(request.status, 'ROLLBACK', getCtx));
        }

        // Executor button: Вернуть
        const btnWithdraw = document.getElementById('btnWithdraw');
        if (btnWithdraw) btnWithdraw.classList.toggle('hidden', !canWithdraw);
        if (hasFsm) {
            _applyFsmCheck(btnWithdraw, WorkflowMachine.canTransition(request.status, 'WITHDRAW', getCtx));
        }


        // Actions bar: always visible (История + Назад are always needed)
        const reviewActions = document.getElementById('reviewActions');
        if (reviewActions) {
            reviewActions.classList.remove('hidden');
        }
    }

    /**
     * BFIX-20: Синхронизирует _reviewChecklistFields с актуальным состоянием DOM checklist полей.
     * Вызывается перед switchTab И перед collectReviewChecklists() (defensive),
     * чтобы предотвратить stale snapshot после tab switch (когда render() сбросил _reviewChecklistFields=[]
     * но DOM сохранил видимые checklists).
     *
     * Reads все элементы matching pattern #checklist_<fieldId> в #reviewFields,
     * накапливает их fieldId в _reviewChecklistFields.
     */
    function _collectChecklistState() {
        const reviewContainer = document.getElementById('reviewFields');
        if (!reviewContainer) return;
        const checklistEls = reviewContainer.querySelectorAll('[id^="checklist_"]');
        const fieldIds = [];
        checklistEls.forEach(el => {
            const id = el.id;
            if (id && id.startsWith('checklist_')) {
                const fieldId = id.slice('checklist_'.length);
                if (fieldId) fieldIds.push(fieldId);
            }
        });
        _reviewChecklistFields = fieldIds;
    }

    function collectReviewChecklists() {
        // BFIX-20: re-sync с DOM перед чтением — гарантирует fresh state даже после tab switch
        _collectChecklistState();
        if (!_reviewChecklistFields.length) return null;
        const results = [];
        for (const fieldId of _reviewChecklistFields) {
            const checkEl = document.getElementById(`checklist_${fieldId}`);
            if (!checkEl) continue;
            const checks = {};
            const comments = {};
            checkEl.querySelectorAll('input[type="checkbox"]').forEach((cb, idx) => {
                checks[idx] = cb.checked;
            });
            checkEl.querySelectorAll('.checklist-comment-input').forEach((ta, idx) => {
                if (ta.value.trim()) comments[idx] = ta.value.trim();
            });
            if (Object.keys(comments).length) checks.comments = comments;
            results.push({ fieldId, data: checks });
        }
        return results.length ? results : null;
    }

    function hasReviewChecklist() {
        return _reviewChecklistFields.length > 0;
    }

    return { render, collectReviewChecklists, hasReviewChecklist, _collectChecklistState };
})();

// IIFE module exports — required для vitest require AND для browser globals.
if (typeof module !== 'undefined' && module.exports) { module.exports = OnboardingReview; }
if (typeof window !== 'undefined') { window.OnboardingReview = OnboardingReview; }
