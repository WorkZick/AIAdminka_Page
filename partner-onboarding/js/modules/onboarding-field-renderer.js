/* onboarding-field-renderer.js — Единый модуль рендеринга полей (readonly + editable) */

const FieldRenderer = (() => {
    'use strict';

    function sanitizeDataUrl(url) {
        const str = String(url);
        if (!str.startsWith('data:')) return Utils.escapeHtml(str);
        const mimeMatch = str.match(/^data:([^;,]+)/);
        if (!mimeMatch || !mimeMatch[1].startsWith('image/')) return '';
        // Экранировать кавычки для безопасной вставки в атрибуты
        return str.replace(/"/g, '&quot;');
    }

    // --- Readonly rendering ---

    function readonlyField(label, value) {
        return `<div class="readonly-field">
            <span class="readonly-label">${Utils.escapeHtml(label)}</span>
            <span class="readonly-value">${Utils.escapeHtml(String(value ?? ''))}</span>
        </div>`;
    }

    function renderReadonly(field, value, options) {
        // options: { canReview, reviewChecklistFields, allowDataUrls }
        const opts = options || {};
        const empty = OnboardingUtils.isEmpty(value);

        switch (field.type) {
            case 'checklist': {
                if (opts.canReview) {
                    if (opts.reviewChecklistFields) opts.reviewChecklistFields.push(field.id);
                    return renderReviewChecklist(field, value);
                }
                if (typeof value !== 'object' || value === null) {
                    return readonlyField(field.label, '—');
                }
                const hasAnyChecked = (field.items || []).some((_, idx) => value[idx]);
                if (!hasAnyChecked) return readonlyField(field.label, '—');
                const checkComments = (typeof value.comments === 'object') ? value.comments : {};
                const checkItems = (field.items || []).map((item, idx) => {
                    const commentText = checkComments[idx] ? checkComments[idx].trim() : '';
                    return `<span class="checklist-readonly-item ${value[idx] ? 'checked' : ''}">${value[idx] ? '&#10003;' : '—'} ${Utils.escapeHtml(item.label)}</span>${commentText ? `<span class="checklist-readonly-comment">${Utils.escapeHtml(commentText)}</span>` : ''}`;
                }).join('');
                return `<div class="readonly-field">
                    <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                    <div class="readonly-checklist">${checkItems}</div>
                </div>`;
            }

            case 'file':
                if (field.multiple) {
                    const urls = Array.isArray(value) ? value : (value ? [value] : []);
                    if (!urls.length) return readonlyField(field.label, '—');
                    return `<div class="readonly-field">
                        <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                        <span class="readonly-value readonly-photos">${urls.map(u => {
                            const safe = opts.allowDataUrls ? sanitizeDataUrl(u) : Utils.escapeHtml(String(u));
                            return `<img class="readonly-photo" src="${safe}" alt="" data-action="onb-openPhoto">`;
                        }).join('')}</span>
                    </div>`;
                }
                if (empty) return readonlyField(field.label, '—');
                const safeUrl = opts.allowDataUrls ? sanitizeDataUrl(value) : Utils.escapeHtml(String(value));
                return `<div class="readonly-field">
                    <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                    <span class="readonly-value"><img class="readonly-photo" src="${safeUrl}" alt="" data-action="onb-openPhoto"></span>
                </div>`;

            case 'list':
                if (!Array.isArray(value) || !value.length) return readonlyField(field.label, '—');
                return readonlyField(field.label, value.join(', '));

            case 'select':
                return readonlyField(field.label, empty ? '—' : (OnboardingConfig.getOptionLabel(field.options || [], value) || value));

            default:
                return readonlyField(field.label, empty ? '—' : String(value));
        }
    }

    function renderReviewChecklist(field, value) {
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

    // --- Editable rendering ---

    function renderEditable(field, value) {
        const required = field.required ? '<span class="field-required">*</span>' : '';
        const reqAttr = field.required ? 'required' : '';
        const id = `field_${field.id}`;

        switch (field.type) {
            case 'text':
            case 'email':
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                    <input type="${field.type}" class="form-input" id="${id}" name="${field.id}"
                        value="${Utils.escapeHtml(String(value ?? ''))}"
                        placeholder="${Utils.escapeHtml(field.placeholder || '')}" ${reqAttr}>
                </div>`;

            case 'date':
                if (field.noNowButton) {
                    return `<div class="form-group" data-field="${field.id}">
                        <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                        <input type="date" class="form-input" id="${id}" name="${field.id}"
                            value="${Utils.escapeHtml(String(value ?? ''))}" ${reqAttr}>
                    </div>`;
                }
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                    <div class="date-input-wrap">
                        <input type="datetime-local" class="form-input" id="${id}" name="${field.id}"
                            value="${Utils.escapeHtml(String(value ?? ''))}" ${reqAttr}>
                        <button type="button" class="date-now-btn" data-action="onb-setDateNow" data-value="${field.id}" title="Сейчас">Сейчас</button>
                    </div>
                </div>`;

            case 'textarea':
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                    <textarea class="form-textarea" id="${id}" name="${field.id}" rows="3"
                        placeholder="${Utils.escapeHtml(field.placeholder || '')}" ${reqAttr}>${Utils.escapeHtml(String(value ?? ''))}</textarea>
                </div>`;

            case 'select':
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                    <select class="form-select" id="${id}" name="${field.id}" ${reqAttr}>
                        <option value="">Выберите...</option>
                        ${(field.options || []).map(o =>
                            `<option value="${Utils.escapeHtml(o.value)}" ${o.value === value ? 'selected' : ''}>${Utils.escapeHtml(o.label)}</option>`
                        ).join('')}
                    </select>
                </div>`;

            case 'file':
                if (field.multiple) {
                    const urls = Array.isArray(value) ? value : (value ? [value] : []);
                    return `<div class="form-group" data-field="${field.id}">
                        <label class="form-label">${Utils.escapeHtml(field.label)}${required}</label>
                        <div class="file-upload-area file-upload-multi">
                            <div class="file-previews" id="previews_${field.id}">
                                ${urls.map((u, i) => `<div class="file-preview" data-index="${i}">
                                    <img src="${Utils.escapeHtml(String(u))}" alt="" data-action="onb-openPhoto" data-value="${field.id}">
                                    <button class="file-remove-btn" data-action="onb-removeMultiFile" data-value="${field.id}:${i}" type="button">&times;</button>
                                </div>`).join('')}
                            </div>
                            <label class="file-upload-label" for="${id}">
                                <span>${urls.length ? 'Добавить ещё' : 'Выбрать файлы'}</span>
                            </label>
                            <input type="file" class="hidden" id="${id}" name="${field.id}" accept="${field.accept || '*'}" multiple>
                        </div>
                    </div>`;
                }
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label">${Utils.escapeHtml(field.label)}${required}</label>
                    <div class="file-upload-area">
                        ${value ? `<div class="file-preview" id="preview_${field.id}">
                            <img src="${Utils.escapeHtml(String(value))}" alt="" data-action="onb-openPhoto" data-value="${field.id}">
                            <button class="file-remove-btn" data-action="onb-removeFile" data-value="${field.id}" type="button">&times;</button>
                        </div>` : ''}
                        <label class="file-upload-label" for="${id}">
                            <span>${value ? 'Заменить' : 'Выбрать файл'}</span>
                        </label>
                        <input type="file" class="hidden" id="${id}" name="${field.id}" accept="${field.accept || '*'}">
                    </div>
                </div>`;

            case 'list': {
                const items = Array.isArray(value) ? value : (value ? [value] : []);
                const suggestionsHtml = field.suggestions ? `<div class="list-suggestions" id="listSuggestions_${field.id}">
                    ${field.suggestions.map(s => `<button type="button" class="list-suggestion${items.includes(s) ? ' hidden' : ''}"
                        data-action="onb-addListSuggestion" data-value="${field.id}:${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</button>`).join('')}
                </div>` : '';
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                    <div class="list-field" id="list_${field.id}">
                        <div class="list-items">
                            ${items.map((item, idx) => `<div class="list-chip">
                                <span>${Utils.escapeHtml(item)}</span>
                                <button type="button" class="list-chip-remove" data-action="onb-removeListItem" data-value="${field.id}:${idx}">&times;</button>
                            </div>`).join('')}
                        </div>
                        <div class="list-add-row">
                            <input type="text" class="form-input list-add-input" id="listInput_${field.id}"
                                placeholder="${Utils.escapeHtml(field.placeholder || 'Добавить...')}"
                                data-action="onb-listInputKeypress" data-value="${field.id}">
                            <button type="button" class="btn btn-primary btn-sm" data-action="onb-addListItem" data-value="${field.id}">+</button>
                        </div>
                        ${suggestionsHtml}
                    </div>
                </div>`;
            }

            case 'checklist': {
                const checks = (typeof value === 'object' && value !== null) ? value : {};
                const comments = (checks && typeof checks.comments === 'object') ? checks.comments : {};
                const revComments = (checks && typeof checks.reviewerComments === 'object') ? checks.reviewerComments : {};
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label">${Utils.escapeHtml(field.label)}${required}</label>
                    <div class="checklist-field" id="checklist_${field.id}">
                        ${(field.items || []).map((item, idx) => {
                            const hasComment = comments[idx] && comments[idx].trim();
                            const revComment = revComments[idx] ? revComments[idx].trim() : '';
                            return `<div class="checklist-item-wrap">
                                <label class="checklist-item">
                                    <input type="checkbox" name="${field.id}_${idx}" ${checks[idx] ? 'checked' : ''}>
                                    <span>${Utils.escapeHtml(item.label)}</span>
                                    <button type="button" class="checklist-comment-toggle ${hasComment ? 'has-comment' : ''}"
                                        data-action="onb-toggleChecklistComment" data-value="${field.id}:${idx}"
                                        title="Комментарий">
                                        <img src="../shared/icons/edit.svg" width="14" height="14" alt="">
                                    </button>
                                </label>
                                ${revComment ? `<div class="checklist-reviewer-comment"><span class="reviewer-comment-label">Ревьюер:</span> ${Utils.escapeHtml(revComment)}</div>` : ''}
                                <div class="checklist-comment ${hasComment ? '' : 'hidden'}" id="checkComment_${field.id}_${idx}">
                                    <textarea class="form-textarea checklist-comment-input" name="${field.id}_comment_${idx}"
                                        rows="2" placeholder="Комментарий...">${Utils.escapeHtml(String(comments[idx] || ''))}</textarea>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }

            default:
                return '';
        }
    }

    // --- Visibility helpers ---

    function resolveValue(fieldId, data, field, request) {
        let value = data[fieldId];
        if (OnboardingUtils.isEmpty(value) && field.autofill) {
            const sourceData = (request.stageData[field.autofill.step]) || {};
            value = sourceData[field.autofill.field] || '';
            if (field.autofill.field === 'method_name') {
                value = OnboardingConfig.getOptionLabel(OnboardingConfig.METHOD_NAMES, value) || value;
            }
        }
        return value;
    }

    function shouldShowField(field, stepData, step) {
        if (!field.showWhen) return true;
        if (field.showWhen.phase === 'fill' && step.dynamicExecutor) {
            if (stepData._handoff_complete) return true;
            if (step.dynamicExecutor.autoHandoff) {
                const { myRole: ahRole, sysRole: ahSysRole } = OnboardingUtils.getRoles();
                if (OnboardingRoles.isReviewerForStep(ahSysRole, step.number) || ahRole === 'admin' || ahRole === 'leader') return true;
                return false;
            }
            const creator = stepData[step.dynamicExecutor.field];
            if (!creator) return false;
            if (field.showWhen.onlyCreator && creator !== field.showWhen.onlyCreator) return false;
            const { myRole, sysRole, isAdmin } = OnboardingUtils.getRoles();
            if (isAdmin) return true;
            if (creator === step.dynamicExecutor.executorValue && OnboardingRoles.isExecutorForStep(sysRole, step.number)) return true;
            if (creator === step.dynamicExecutor.reviewerValue && OnboardingRoles.isReviewerForStep(sysRole, step.number)) return true;
            return false;
        }
        if (field.showWhen.phase === 'confirm' && step.dynamicExecutor) {
            return !!stepData._handoff_complete;
        }
        return true;
    }

    function isFieldVisible(field, data) {
        if (field.visibleWhen) return data[field.visibleWhen.field] === field.visibleWhen.value;
        return true;
    }

    return {
        sanitizeDataUrl,
        readonlyField,
        renderReadonly,
        renderReviewChecklist,
        renderEditable,
        resolveValue,
        shouldShowField,
        isFieldVisible
    };
})();
