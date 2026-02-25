/* onboarding-review.js — Просмотр и проверка (reviewer) — readonly + approve/reject */

const OnboardingReview = (() => {
    'use strict';

    function render(request, stepNumber) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return;

        // Steps indicator
        OnboardingSteps.render('reviewSteps', stepNumber);

        // Header with status
        _renderHeader(request, step);

        // Previous steps readonly
        _renderPrevSteps(request, stepNumber);

        // Current step data
        _renderCurrentStep(step, request.stageData[stepNumber] || {}, request);

        // History
        _renderHistory(request);

        // Update action buttons visibility
        _updateActions(request);
    }

    function _renderHeader(request, step) {
        const header = document.getElementById('reviewHeader');
        if (!header) return;

        const statusConf = OnboardingConfig.STATUSES[request.status] || {};
        header.innerHTML = `<div class="review-step-name">${Utils.escapeHtml(step.name)}</div>
            <span class="status-badge ${Utils.escapeHtml(statusConf.cssClass || '')}">${Utils.escapeHtml(statusConf.label || request.status)}</span>`;
    }

    function _renderPrevSteps(request, currentStep) {
        const container = document.getElementById('reviewPrevSteps');
        if (!container) return;

        if (currentStep <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i < currentStep; i++) {
            const step = OnboardingConfig.getStep(i);
            const data = request.stageData[i] || {};
            html += `<div class="prev-step-section">
                <div class="prev-step-header" data-action="onb-togglePrevStep" data-value="${i}">
                    <span class="prev-step-title">${Utils.escapeHtml(step.name)}</span>
                    <img class="prev-step-arrow" src="../shared/icons/arrow.svg" width="12" height="12" alt="">
                </div>
                <div class="prev-step-body hidden" id="reviewPrevStep${i}">
                    ${_renderReadonly(step, data, request)}
                </div>
            </div>`;
        }
        container.innerHTML = html;
    }

    function _renderCurrentStep(step, data, request) {
        const container = document.getElementById('reviewFields');
        if (!container) return;

        container.innerHTML = `<h3 class="review-step-title">${Utils.escapeHtml(step.name)}</h3>
            <div class="review-fields-list">${_renderReadonly(step, data, request)}</div>`;
    }

    function _renderReadonly(step, data, request) {
        return step.fields.map(field => {
            let value = data[field.id];
            if (value === undefined || value === '') return '';

            switch (field.type) {
                case 'select':
                    return _field(field.label, OnboardingConfig.getOptionLabel(field.options || [], value) || value);

                case 'file':
                    if (!value) return '';
                    const safeUrl = String(value).startsWith('data:') ? value : Utils.escapeHtml(String(value));
                    return `<div class="readonly-field">
                        <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                        <span class="readonly-value"><img class="readonly-photo" src="${safeUrl}" alt="" data-action="onb-openPhoto"></span>
                    </div>`;

                case 'list':
                    if (!Array.isArray(value) || !value.length) return '';
                    return _field(field.label, value.map(v => Utils.escapeHtml(v)).join(', '));

                case 'checklist':
                    if (typeof value !== 'object' || value === null) return '';
                    const items = (field.items || []).map((item, idx) =>
                        `<span class="checklist-readonly-item ${value[idx] ? 'checked' : ''}">${value[idx] ? '&#10003;' : '&#10007;'} ${Utils.escapeHtml(item.label)}</span>`
                    ).join('');
                    return `<div class="readonly-field">
                        <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                        <div class="readonly-checklist">${items}</div>
                    </div>`;

                default:
                    return _field(field.label, Utils.escapeHtml(String(value)));
            }
        }).join('');
    }

    function _field(label, value) {
        return `<div class="readonly-field">
            <span class="readonly-label">${Utils.escapeHtml(label)}</span>
            <span class="readonly-value">${value}</span>
        </div>`;
    }

    function _renderHistory(request) {
        const container = document.getElementById('reviewHistory');
        if (!container) return;

        const history = request.history || [];
        if (history.length === 0) {
            container.innerHTML = '';
            return;
        }

        const items = history.map(entry => {
            const actionLabel = OnboardingConfig.getHistoryActionLabel(entry.action);
            const stepName = entry.stepName || `Шаг ${entry.step}`;
            const time = entry.timestamp ? new Date(entry.timestamp).toLocaleString('ru-RU') : '';
            const comment = entry.comment ? `<div class="history-comment">${Utils.escapeHtml(entry.comment)}</div>` : '';

            return `<div class="history-entry">
                <div class="history-entry-header">
                    <span class="history-action">${Utils.escapeHtml(actionLabel)}</span>
                    <span class="history-step">${Utils.escapeHtml(stepName)}</span>
                    <span class="history-time">${Utils.escapeHtml(time)}</span>
                </div>
                <div class="history-actor">${Utils.escapeHtml(entry.actor || '')}</div>
                ${comment}
            </div>`;
        }).reverse().join('');

        container.innerHTML = `<div class="history-section">
            <div class="history-title" data-action="onb-toggleHistory">
                История
                <img class="history-arrow" src="../shared/icons/arrow.svg" width="12" height="12" alt="">
            </div>
            <div class="history-list hidden" id="historyList">${items}</div>
        </div>`;
    }

    function _updateActions(request) {
        const myRole = OnboardingState.get('userRole');
        const myEmail = OnboardingState.get('userEmail');
        const withdrawBtn = document.getElementById('btnWithdraw');

        if (withdrawBtn) {
            // Withdraw visible only if executor (owner) and status is on_review
            const step = OnboardingConfig.getStep(request.currentStep);
            const canWithdraw = request.status === 'on_review' &&
                step && step.executor === myRole &&
                (request.assigneeEmail === myEmail || request.createdBy === myEmail);
            withdrawBtn.classList.toggle('hidden', !canWithdraw);
        }

        // Review comment + approve/reject visible only if reviewer
        const reviewActions = document.getElementById('reviewActions');
        if (reviewActions) {
            const isTerminal = request.status === 'completed' || request.status === 'cancelled';
            reviewActions.classList.toggle('hidden', isTerminal);
        }
    }

    return { render };
})();
