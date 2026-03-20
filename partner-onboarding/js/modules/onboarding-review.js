/* onboarding-review.js — Просмотр и проверка (reviewer) — readonly + approve/reject */

const OnboardingReview = (() => {
    'use strict';

    let _reviewChecklistFields = [];

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
    }

    function _renderHeader(request, step) {
        const header = document.getElementById('reviewHeader');
        if (!header) return;

        let badgeLabel, badgeClass;
        if (step.number < request.currentStep) {
            badgeLabel = 'Пройден';
            badgeClass = 'status--completed';
        } else if (request.status === 'completed') {
            badgeLabel = 'Завершено';
            badgeClass = 'status--completed';
        } else {
            const statusConf = OnboardingConfig.STATUSES[request.status] || {};
            badgeLabel = statusConf.label || request.status;
            badgeClass = statusConf.cssClass || '';
        }
        header.innerHTML = `<div class="review-step-name">${Utils.escapeHtml(OnboardingConfig.getStepLabel(step.number))}</div>
            <span class="status-badge ${Utils.escapeHtml(badgeClass)}">${Utils.escapeHtml(badgeLabel)}</span>`;
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

        const bannerHtml = request.lastComment ? `<div class="banner-warning">
                <img src="../shared/icons/alert-triangle.svg" width="16" height="16" alt="">
                <div class="banner-text">
                    <strong>${request.status === 'cancelled' ? 'Причина отмены:' : 'Замечание:'}</strong> ${Utils.escapeHtml(request.lastComment)}
                </div>
            </div>` : '';
        container.innerHTML = `${bannerHtml}<div class="review-fields-list">${_renderReadonly(step, data, request, canReview)}</div>`;
    }

    function _renderReadonly(step, data, request, canReview) {
        return step.fields.map(field => {
            // visibleWhen: hide if controlling field doesn't match
            if (!FieldRenderer.isFieldVisible(field, data)) return '';
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

        // Reviewer buttons: Одобрить, Отклонить, Комментарий
        const btnReject = document.getElementById('btnReject');
        const btnApprove = document.getElementById('btnApprove');
        const commentRow = document.getElementById('reviewCommentRow');
        if (btnReject) btnReject.classList.toggle('hidden', !canReview);
        if (btnApprove) btnApprove.classList.toggle('hidden', !canReview);
        // Hide general comment when step has interactive checklist
        const showGeneralComment = canReview && !_reviewChecklistFields.length;
        if (commentRow) commentRow.classList.toggle('hidden', !showGeneralComment);

        // Reviewer buttons (left): Передать, Откатить
        const canManage = !isTerminal && (isAdmin || (isReviewer && isOnReview));
        const btnReassign = document.getElementById('btnReassign');
        const btnRollback = document.getElementById('btnRollback');
        if (btnReassign) btnReassign.classList.toggle('hidden', !canManage);
        if (btnRollback) btnRollback.classList.toggle('hidden', !canManage);

        // Executor button: Вернуть
        const btnWithdraw = document.getElementById('btnWithdraw');
        if (btnWithdraw) btnWithdraw.classList.toggle('hidden', !canWithdraw);


        // Actions bar: always visible (История + Назад are always needed)
        const reviewActions = document.getElementById('reviewActions');
        if (reviewActions) {
            reviewActions.classList.remove('hidden');
        }
    }

    function collectReviewChecklists() {
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

    return { render, collectReviewChecklists, hasReviewChecklist };
})();
