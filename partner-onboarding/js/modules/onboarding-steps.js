/* onboarding-steps.js — Вертикальный список шагов (sidebar) + инфо */

const OnboardingSteps = (() => {
    'use strict';

    function renderVertical(containerId, viewingStep) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Progress is based on request's actual currentStep, not the step being viewed
        const request = OnboardingState.get('currentRequest');
        const progressStep = request ? request.currentStep : viewingStep;

        const myRole = OnboardingState.get('userRole');
        const sysRole = OnboardingState.get('systemRole');
        const executorDone = OnboardingRoles.getGlobalModuleRole(sysRole) === 'executor' && request && OnboardingConfig.isExecutorCompleted(request);
        const steps = OnboardingConfig.getVisibleSteps(myRole);
        container.innerHTML = steps.map(step => {
            const num = step.number;
            let cls = 'v-step';
            if (executorDone) cls += ' completed';
            else if (num < progressStep) cls += ' completed';
            else if (num === progressStep) {
                const isInProgress = request && request.status === 'in_progress';
                const isViewerExecutor = OnboardingRoles.isExecutorForStep(sysRole, num);
                if (isInProgress && !isViewerExecutor) {
                    // Reviewer sees gray dot while executor hasn't submitted
                } else {
                    cls += ' active';
                }
            }
            if (num === viewingStep) cls += ' viewing';

            const label = OnboardingConfig.getStepDisplayName(num, myRole);
            return `<div class="${cls}" data-action="onb-goToStep" data-value="${num}">
                <span class="v-step-dot"></span>
                <span class="v-step-label">${num}. ${Utils.escapeHtml(label)}</span>
            </div>`;
        }).join('');
    }

    function renderInfo(containerId, request) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const myRole = OnboardingState.get('userRole');
        const sysRole = OnboardingState.get('systemRole');
        const executorDone = OnboardingRoles.getGlobalModuleRole(sysRole) === 'executor' && OnboardingConfig.isExecutorCompleted(request);
        const statusConf = OnboardingConfig.STATUSES[request.status] || {};
        const statusLabel = executorDone ? 'Партнёр заведён' : (statusConf.label || request.status);
        const statusClass = executorDone ? 'status--completed' : (statusConf.cssClass || '');
        const assigneeName = request.assigneeName || request.assigneeEmail || '';
        const createdDate = request.createdDate ? _formatDateTime(request.createdDate) : '';

        container.innerHTML = `
            <div class="sidebar-info-row">
                <span class="sidebar-info-label">Статус</span>
                <span class="status-badge ${Utils.escapeHtml(statusClass)}">${Utils.escapeHtml(statusLabel)}</span>
            </div>
            <div class="sidebar-info-row">
                <span class="sidebar-info-label">Менеджер</span>
                <span class="sidebar-info-value">${Utils.escapeHtml(assigneeName)}</span>
            </div>
            <div class="sidebar-info-row">
                <span class="sidebar-info-label">Создано</span>
                <span class="sidebar-info-value">${Utils.escapeHtml(createdDate)}</span>
            </div>`;
    }

    function renderHistoryModal(request) {
        const container = document.getElementById('historyModalBody');
        if (!container) return;

        const history = request.history || [];
        if (history.length === 0) {
            container.innerHTML = '<p class="history-empty">Нет записей</p>';
            return;
        }

        const items = history.slice().reverse().map(entry => {
            const actionLabel = OnboardingConfig.getHistoryActionLabel(entry.action);
            const stepLabel = entry.step ? `Шаг ${entry.step}` : '';
            const time = entry.timestamp ? _formatDateTime(entry.timestamp) : '';
            const actor = entry.actor || '';
            const comment = entry.comment
                ? `<div class="history-modal-comment">${Utils.escapeHtml(entry.comment)}</div>`
                : '';

            return `<div class="history-modal-entry">
                <div class="history-modal-row">
                    <span class="history-modal-action">${Utils.escapeHtml(actionLabel)}</span>
                    <span class="history-modal-step">${Utils.escapeHtml(stepLabel)}</span>
                    <span class="history-modal-time">${Utils.escapeHtml(time)}</span>
                </div>
                <div class="history-modal-actor">${Utils.escapeHtml(actor)}</div>
                ${comment}
            </div>`;
        }).join('');

        container.innerHTML = items;
    }

    function _formatDateTime(dateStr) {
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}.${mm}.${yy} ${hh}:${min}`;
    }

    return { renderVertical, renderInfo, renderHistoryModal };
})();
