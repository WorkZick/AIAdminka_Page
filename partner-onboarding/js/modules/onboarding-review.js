/* onboarding-review.js — Просмотр и проверка (reviewer) — readonly + approve/reject */

const OnboardingReview = (() => {
    'use strict';

    function render(request, stepNumber) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return;

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

        const statusConf = OnboardingConfig.STATUSES[request.status] || {};
        header.innerHTML = `<div class="review-step-name">${Utils.escapeHtml(OnboardingConfig.getStepLabel(step.number))}</div>
            <span class="status-badge ${Utils.escapeHtml(statusConf.cssClass || '')}">${Utils.escapeHtml(statusConf.label || request.status)}</span>`;
    }

    function _renderCurrentStep(step, data, request) {
        const container = document.getElementById('reviewFields');
        if (!container) return;

        container.innerHTML = `<div class="review-fields-list">${_renderReadonly(step, data, request)}</div>`;
    }

    function _renderReadonly(step, data, request) {
        return step.fields.map(field => {
            // Hide showWhen fields that have no data (e.g. login/password not yet filled)
            if (field.showWhen && field.showWhen.phase === 'fill') {
                const value = data[field.id];
                if (value === undefined || value === '' || value === null) return '';
            }

            let value = data[field.id];
            const empty = value === undefined || value === '' || value === null;

            switch (field.type) {
                case 'select':
                    return _field(field.label, empty ? '—' : (OnboardingConfig.getOptionLabel(field.options || [], value) || value));

                case 'file':
                    if (empty) return _field(field.label, '—');
                    const safeUrl = String(value).startsWith('data:') ? value : Utils.escapeHtml(String(value));
                    return `<div class="readonly-field">
                        <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                        <span class="readonly-value"><img class="readonly-photo" src="${safeUrl}" alt="" data-action="onb-openPhoto"></span>
                    </div>`;

                case 'list':
                    if (!Array.isArray(value) || !value.length) return _field(field.label, '—');
                    return _field(field.label, value.map(v => Utils.escapeHtml(v)).join(', '));

                case 'checklist':
                    if (typeof value !== 'object' || value === null) {
                        const emptyItems = (field.items || []).map(item =>
                            `<span class="checklist-readonly-item">&#10007; ${Utils.escapeHtml(item.label)}</span>`
                        ).join('');
                        return `<div class="readonly-field">
                            <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                            <div class="readonly-checklist">${emptyItems}</div>
                        </div>`;
                    }
                    const items = (field.items || []).map((item, idx) =>
                        `<span class="checklist-readonly-item ${value[idx] ? 'checked' : ''}">${value[idx] ? '&#10003;' : '&#10007;'} ${Utils.escapeHtml(item.label)}</span>`
                    ).join('');
                    return `<div class="readonly-field">
                        <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                        <div class="readonly-checklist">${items}</div>
                    </div>`;

                default:
                    return _field(field.label, empty ? '—' : Utils.escapeHtml(String(value)));
            }
        }).join('');
    }

    function _field(label, value) {
        return `<div class="readonly-field">
            <span class="readonly-label">${Utils.escapeHtml(label)}</span>
            <span class="readonly-value">${value}</span>
        </div>`;
    }

    function _updateActions(request) {
        const myRole = OnboardingState.get('userRole');
        const myEmail = OnboardingState.get('userEmail');
        const step = OnboardingConfig.getStep(request.currentStep);
        const isAdminLike = myRole === 'admin' || myRole === 'leader';
        const isReviewer = step && (step.reviewer === myRole || isAdminLike);
        const isExecutor = step && step.executor === myRole;
        const isTerminal = request.status === 'completed' || request.status === 'cancelled';
        const isOnReview = request.status === 'on_review';

        // Dynamic handoff: executor can withdraw when they handed off to reviewer (on_review)
        const effectiveExecutor = OnboardingConfig.getStepEffectiveExecutor(request.currentStep, request.stageData);
        const isDynamicHandoff = step && step.dynamicExecutor && effectiveExecutor !== step.executor && step.executor === myRole;

        const canReview = !isTerminal && isOnReview && isReviewer;
        const canWithdraw = !isTerminal && isOnReview && (
            (isExecutor && (request.assigneeEmail === myEmail || request.createdBy === myEmail)) ||
            isDynamicHandoff
        );

        // Reviewer buttons: Вернуть, Одобрить, Комментарий
        const btnReject = document.getElementById('btnReject');
        const btnApprove = document.getElementById('btnApprove');
        const commentRow = document.getElementById('reviewCommentRow');
        if (btnReject) btnReject.classList.toggle('hidden', !canReview);
        if (btnApprove) btnApprove.classList.toggle('hidden', !canReview);
        if (commentRow) commentRow.classList.toggle('hidden', !canReview);

        // Executor button: Отозвать
        const btnWithdraw = document.getElementById('btnWithdraw');
        if (btnWithdraw) btnWithdraw.classList.toggle('hidden', !canWithdraw);

        // Entire actions bar: hide only if nothing to show (terminal + no role match)
        const reviewActions = document.getElementById('reviewActions');
        if (reviewActions) {
            reviewActions.classList.toggle('hidden', !canReview && !canWithdraw);
        }
    }

    return { render };
})();
