/* onboarding-review.js — Просмотр и проверка (reviewer) — readonly + approve/reject */

const OnboardingReview = (() => {
    'use strict';

    let _reviewChecklistFields = [];

    function render(request, stepNumber, executorCompleted) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return;

        _reviewChecklistFields = [];

        // Sidebar: vertical steps + info
        OnboardingSteps.renderVertical('reviewSteps', stepNumber);
        OnboardingSteps.renderInfo('reviewInfo', request);

        // Main: header + current step data + actions
        if (executorCompleted) {
            _renderExecutorCompleted(request);
        } else {
            _renderHeader(request, step);
            _renderCurrentStep(step, request.stageData[stepNumber] || {}, request);
            _updateActions(request);
        }
    }

    function _renderExecutorCompleted(request) {
        const header = document.getElementById('reviewHeader');
        if (header) {
            header.innerHTML = `<div class="review-step-name">Партнёр заведён</div>
                <span class="status-badge status--completed">Успешно</span>`;
        }

        const container = document.getElementById('reviewFields');
        if (container) {
            const contactName = (request.stageData && request.stageData[1] || {}).contact_name || '';
            const leadSourceValue = request.leadSource || (request.stageData && request.stageData[1] || {}).lead_source || '';
            const sourceLabel = OnboardingConfig.getOptionLabel(OnboardingConfig.LEAD_SOURCES, leadSourceValue);
            const geoValue = (request.stageData && request.stageData[1] || {}).geo_country || '';
            const geoLabel = OnboardingConfig.getOptionLabel(OnboardingConfig.GEO_COUNTRIES, geoValue);
            const methodValue = (request.stageData && request.stageData[2] || {}).method_name || '';
            const methodLabel = OnboardingConfig.getOptionLabel(OnboardingConfig.METHOD_NAMES, methodValue);

            container.innerHTML = `<div class="executor-completed-banner">
                <img src="../shared/icons/check.svg" width="48" height="48" alt="" class="completed-icon">
                <h3 class="completed-title">Партнёр успешно заведён!</h3>
                <p class="completed-subtitle">${Utils.escapeHtml(contactName || sourceLabel || request.id)}</p>
                <p class="completed-note">Карточка передана на финализацию</p>
            </div>
            <div class="review-fields-list">
                ${contactName ? _field('Контакт', Utils.escapeHtml(contactName)) : ''}
                ${geoLabel ? _field('Страна', Utils.escapeHtml(geoLabel)) : ''}
                ${methodLabel ? _field('Метод', Utils.escapeHtml(methodLabel)) : ''}
                ${_field('Источник', Utils.escapeHtml(sourceLabel || '—'))}
                ${_field('ID заявки', Utils.escapeHtml(request.id))}
            </div>`;
        }

        // Hide all action buttons
        ['btnReject', 'btnApprove', 'reviewCommentRow', 'btnWithdraw', 'btnReassign', 'btnRollback'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        const reviewActions = document.getElementById('reviewActions');
        if (reviewActions) reviewActions.classList.remove('hidden');
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

        const myRole = OnboardingState.get('userRole');
        const sysRole = OnboardingState.get('systemRole');
        const isAdminLike = myRole === 'admin' || myRole === 'leader';
        const isOnReview = request.status === 'on_review';
        const isReviewer = step && (OnboardingRoles.isReviewerForStep(sysRole, step.number) || isAdminLike);
        const isTerminal = request.status === 'completed' || request.status === 'cancelled';
        const canReview = !isTerminal && isOnReview && isReviewer && step.number === request.currentStep;

        // in_progress current step: reviewer hasn't received submission yet — show empty fields
        const isCurrentNotSubmitted = request.status === 'in_progress' && step.number === request.currentStep
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
            // Hide showWhen fields that have no data (e.g. login/password not yet filled)
            if (field.showWhen && field.showWhen.phase === 'fill') {
                const value = data[field.id];
                if (value === undefined || value === '' || value === null) return '';
            }

            // visibleWhen: hide if controlling field doesn't match
            if (field.visibleWhen) {
                const depValue = data[field.visibleWhen.field];
                if (depValue !== field.visibleWhen.value) return '';
            }

            let value = data[field.id];
            // Autofill from another step if value is empty
            if ((value === undefined || value === '' || value === null) && field.autofill) {
                const sourceData = (request.stageData[field.autofill.step]) || {};
                value = sourceData[field.autofill.field] || '';
            }
            const empty = value === undefined || value === '' || value === null;

            switch (field.type) {
                case 'select':
                    return _field(field.label, empty ? '—' : (OnboardingConfig.getOptionLabel(field.options || [], value) || value));

                case 'file':
                    if (field.multiple) {
                        const urls = Array.isArray(value) ? value : (value ? [value] : []);
                        if (!urls.length) return _field(field.label, '—');
                        return `<div class="readonly-field">
                            <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                            <span class="readonly-value readonly-photos">${urls.map(u => {
                                const safe = String(u).startsWith('data:') ? u : Utils.escapeHtml(String(u));
                                return `<img class="readonly-photo" src="${safe}" alt="" data-action="onb-openPhoto">`;
                            }).join('')}</span>
                        </div>`;
                    }
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
                    // Interactive checklist for reviewer
                    if (canReview) {
                        _reviewChecklistFields.push(field.id);
                        return _renderReviewChecklist(field, value);
                    }
                    // Readonly checklist
                    if (typeof value !== 'object' || value === null) {
                        return _field(field.label, '—');
                    }
                    const hasAnyChecked = (field.items || []).some((_, idx) => value[idx]);
                    if (!hasAnyChecked) return _field(field.label, '—');
                    const checkComments = (typeof value.comments === 'object') ? value.comments : {};
                    const items = (field.items || []).map((item, idx) => {
                        const commentText = checkComments[idx] ? checkComments[idx].trim() : '';
                        return `<span class="checklist-readonly-item ${value[idx] ? 'checked' : ''}">${value[idx] ? '&#10003;' : '—'} ${Utils.escapeHtml(item.label)}</span>${commentText ? `<span class="checklist-readonly-comment">${Utils.escapeHtml(commentText)}</span>` : ''}`;
                    }).join('');
                    return `<div class="readonly-field">
                        <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                        <div class="readonly-checklist">${items}</div>
                    </div>`;

                default:
                    return _field(field.label, empty ? '—' : Utils.escapeHtml(String(value)));
            }
        }).join('');
    }

    function _renderReviewChecklist(field, value) {
        const checks = (typeof value === 'object' && value !== null) ? value : {};
        const executorComments = (checks && typeof checks.comments === 'object') ? checks.comments : {};

        return `<div class="form-group" data-field="${field.id}">
            <label class="form-label">${Utils.escapeHtml(field.label)}</label>
            <div class="checklist-field" id="checklist_${field.id}">
                ${(field.items || []).map((item, idx) => {
                    const execComment = executorComments[idx] ? executorComments[idx].trim() : '';
                    return `<div class="checklist-item-wrap">
                        <label class="checklist-item">
                            <input type="checkbox" name="${field.id}_${idx}" ${checks[idx] ? 'checked' : ''}>
                            <span>${Utils.escapeHtml(item.label)}</span>
                            <button type="button" class="checklist-comment-toggle"
                                data-action="onb-toggleChecklistComment" data-value="${field.id}:${idx}"
                                title="Комментарий">
                                <img src="../shared/icons/edit.svg" width="14" height="14" alt="">
                            </button>
                        </label>
                        ${execComment ? `<div class="checklist-executor-comment"><span class="executor-comment-label">Исполнитель:</span> ${Utils.escapeHtml(execComment)}</div>` : ''}
                        <div class="checklist-comment hidden" id="checkComment_${field.id}_${idx}">
                            <textarea class="form-textarea checklist-comment-input" name="${field.id}_comment_${idx}"
                                rows="2" placeholder="Опишите ошибку..."></textarea>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    function _field(label, value) {
        return `<div class="readonly-field">
            <span class="readonly-label">${Utils.escapeHtml(label)}</span>
            <span class="readonly-value">${value}</span>
        </div>`;
    }

    function _updateActions(request) {
        const myRole = OnboardingState.get('userRole');
        const sysRole = OnboardingState.get('systemRole');
        const myEmail = OnboardingState.get('userEmail');
        const step = OnboardingConfig.getStep(request.currentStep);
        const isAdminLike = myRole === 'admin' || myRole === 'leader';
        const isReviewer = step && (OnboardingRoles.isReviewerForStep(sysRole, step.number) || isAdminLike);
        const isExecutor = step && OnboardingRoles.isExecutorForStep(sysRole, step.number);
        const isTerminal = request.status === 'completed' || request.status === 'cancelled';
        const isOnReview = request.status === 'on_review';

        // Dynamic handoff: executor can withdraw when they handed off to reviewer (on_review)
        const effectiveExecutor = OnboardingConfig.getStepEffectiveExecutor(request.currentStep, request.stageData);
        const isDynamicHandoff = step && step.dynamicExecutor && effectiveExecutor !== step.executor && OnboardingRoles.isExecutorForStep(sysRole, step.number);

        const canReview = !isTerminal && isOnReview && isReviewer;
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
        const canManage = !isTerminal && (isAdminLike || (isReviewer && isOnReview));
        const btnReassign = document.getElementById('btnReassign');
        const btnRollback = document.getElementById('btnRollback');
        if (btnReassign) btnReassign.classList.toggle('hidden', !canManage);
        if (btnRollback) btnRollback.classList.toggle('hidden', !canManage);

        // Executor button: Отозвать
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
