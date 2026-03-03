/* onboarding-form.js — Формы шагов (executor) — динамическая генерация */

const OnboardingForm = (() => {
    'use strict';

    let _fileDataUrls = {};

    function _shouldShowField(field, stepData, step) {
        if (!field.showWhen) return true;
        if (field.showWhen.phase === 'fill' && step.dynamicExecutor) {
            // Handoff completed → show all fields (readonly rendering handles display)
            if (stepData._handoff_complete) return true;
            const creator = stepData[step.dynamicExecutor.field];
            if (!creator) return false;
            // onlyCreator: show only when specific creator is chosen
            if (field.showWhen.onlyCreator && creator !== field.showWhen.onlyCreator) return false;
            const myRole = OnboardingState.get('userRole');
            const sysRole = OnboardingState.get('systemRole');
            const isAdminLike = myRole === 'admin' || myRole === 'leader';
            if (isAdminLike) return true;
            if (creator === step.dynamicExecutor.executorValue && OnboardingRoles.isExecutorForStep(sysRole, step.number)) return true;
            if (creator === step.dynamicExecutor.reviewerValue && OnboardingRoles.isReviewerForStep(sysRole, step.number)) return true;
            return false;
        }
        // confirm phase: only show after handoff complete (executor confirms)
        if (field.showWhen.phase === 'confirm' && step.dynamicExecutor) {
            return !!stepData._handoff_complete;
        }
        return true;
    }

    function render(request, stepNumber) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return;

        _fileDataUrls = {};

        // Sidebar: vertical steps + info
        OnboardingSteps.renderVertical('formSteps', stepNumber);
        OnboardingSteps.renderInfo('formInfo', request);

        // executorFinal step: show development stub
        if (step.executorFinal) {
            const banner = document.getElementById('formBanner');
            if (banner) { banner.classList.add('hidden'); banner.innerHTML = ''; }
            const container = document.getElementById('formFields');
            if (container) {
                container.innerHTML = `<div class="dev-stub">
                    <img src="../shared/icons/settings.svg" width="48" height="48" alt="" class="dev-stub-icon">
                    <h3 class="dev-stub-title">Раздел в разработке</h3>
                    <p class="dev-stub-text">На этом этапе будет автоматически создаваться карточка партнёра в модуле «Партнёры».</p>
                </div>`;
            }
            const btn = document.getElementById('btnFormSubmit');
            if (btn) btn.classList.add('hidden');
            const statusWrap = document.getElementById('statusSubmitWrap');
            if (statusWrap) statusWrap.classList.add('hidden');
            return;
        }

        // Main: banner + form fields + submit button
        _renderBanner(request);
        _renderFields(step, request.stageData[stepNumber] || {}, request);
        _updateSubmitButton(step, stepNumber);
    }

    function _renderBanner(request) {
        const banner = document.getElementById('formBanner');
        if (!banner) return;

        if (request.lastComment) {
            banner.classList.remove('hidden');
            banner.innerHTML = `<div class="banner-warning">
                <img src="../shared/icons/alert-triangle.svg" width="16" height="16" alt="">
                <div class="banner-text">
                    <strong>Замечание:</strong> ${Utils.escapeHtml(request.lastComment)}
                </div>
            </div>`;
        } else {
            banner.classList.add('hidden');
            banner.innerHTML = '';
        }
    }

    function _renderFields(step, data, request) {
        const container = document.getElementById('formFields');
        if (!container) return;

        const myRole = OnboardingState.get('userRole');
        const stepData = data;

        const isImported = request.createdBy === 'import:google-sheets';
        const isHandoffComplete = step.dynamicExecutor && stepData._handoff_complete;
        const isPreviewBeforeHandoff = step.dynamicExecutor && step.dynamicExecutor.defaultValue &&
            !stepData[step.dynamicExecutor.field] && !isHandoffComplete;

        const html = step.fields.map(field => {
            // Preview mode: show showWhen fields as readonly placeholders before handoff
            if (isPreviewBeforeHandoff && field.showWhen && field.showWhen.phase === 'fill') {
                return _renderReadonlyPreview(field, data[field.id]);
            }

            // asSubmitButton: rendered as submit dropdown, not as form field
            if (field.asSubmitButton) return '';

            if (!_shouldShowField(field, stepData, step)) return '';

            // Readonly for imported fields (e.g. lead_source, geo_country from Google Sheets)
            if (isImported && field.readonlyForImport && data[field.id]) {
                let displayVal = data[field.id];
                if (field.type === 'select' && field.options) {
                    const optLabel = OnboardingConfig.getOptionLabel(field.options, data[field.id]);
                    if (optLabel) displayVal = optLabel;
                } else if (field.type === 'date') {
                    displayVal = _formatDateDisplay(data[field.id]);
                }
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                    <div class="form-input readonly-input">${Utils.escapeHtml(String(displayVal))}</div>
                    <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(String(data[field.id]))}">
                </div>`;
            }

            // Handle autofill
            let value = data[field.id];
            if (value === undefined && field.autofill) {
                const sourceData = request.stageData[field.autofill.step] || {};
                value = sourceData[field.autofill.field] || '';
                if (field.autofill.field === 'method_name') {
                    value = OnboardingConfig.getOptionLabel(OnboardingConfig.METHOD_NAMES, value) || value;
                }
            }

            // Config-level readonly (e.g. autofilled from another step)
            if (field.readonly) {
                // Always pull fresh from source for readonly autofill fields
                if (field.autofill) {
                    const src = request.stageData[field.autofill.step] || {};
                    value = src[field.autofill.field] || '';
                }
                let display = value || '—';
                if (field.type === 'select') {
                    display = OnboardingConfig.getOptionLabel(field.options || [], value) || value || '—';
                }
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                    <div class="form-input readonly-input">${Utils.escapeHtml(String(display))}</div>
                    <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(String(value || ''))}">
                </div>`;
            }

            // Readonly for fill-phase fields when handoff completed (executor views reviewer's data)
            // confirm-phase fields stay editable (e.g. checklist for executor to fill)
            if (isHandoffComplete && !(field.showWhen && field.showWhen.phase === 'confirm')) {
                return _renderReadonlyPreview(field, value);
            }

            // Readonly for account_creator when reviewer fills
            if (step.dynamicExecutor && field.id === step.dynamicExecutor.field) {
                const creator = data[step.dynamicExecutor.field];
                const formSysRole = OnboardingState.get('systemRole');
                if (creator === step.dynamicExecutor.reviewerValue && OnboardingRoles.isReviewerForStep(formSysRole, step.number)) {
                    const label = OnboardingConfig.getOptionLabel(field.options || [], creator);
                    return `<div class="form-group" data-field="${field.id}">
                        <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                        <div class="form-input readonly-input">${Utils.escapeHtml(label)}</div>
                        <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(creator)}">
                    </div>`;
                }
            }

            // Step 1: geo_country uses conditions-based countries if available
            if (step.number === 1 && field.id === 'geo_country' && OnboardingSource.hasConditions()) {
                return _renderField({ ...field, options: OnboardingSource.getCountries() }, value || '');
            }

            // visibleWhen: conditionally hidden based on another field's value
            if (field.visibleWhen) {
                const depValue = data[field.visibleWhen.field];
                const isVisible = depValue === field.visibleWhen.value;
                const rendered = _renderField(field, value || '');
                return rendered.replace(
                    'class="form-group"',
                    `class="form-group${isVisible ? '' : ' hidden'}" data-visible-when-field="${field.visibleWhen.field}" data-visible-when-value="${field.visibleWhen.value}"`
                );
            }

            // Conditions: cascade country → method_type → method_name → readonly fields
            if (step.number === 2 && OnboardingSource.hasConditions()) {
                const selCountry = data.condition_country || '';
                const selType = data.method_type || '';

                if (field.id === 'condition_country') {
                    return _renderField({ ...field, options: OnboardingSource.getCountries() }, value || '');
                }
                if (field.id === 'method_type') {
                    const types = selCountry ? OnboardingSource.getMethodTypes(selCountry) : [];
                    return _renderField({ ...field, options: types }, value || '');
                }
                if (field.id === 'method_name') {
                    const names = selType ? OnboardingSource.getMethodNames(selCountry, selType) : [];
                    return _renderField({ ...field, options: names }, value || '');
                }
                const conditionFields = ['deal_1', 'deal_2', 'deal_3', 'prepayment_method', 'prepayment_amount'];
                if (conditionFields.includes(field.id)) {
                    const selName = data.method_name || '';
                    // Hide until all cascade selects are chosen
                    if (!selCountry || !selType || !selName) return '';
                    const cond = OnboardingSource.getCondition(selCountry, selType, selName);
                    if (cond && cond[field.id]) {
                        const display = cond[field.id];
                        return `<div class="form-group" data-field="${field.id}">
                            <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                            <div class="form-input readonly-input">${Utils.escapeHtml(String(display))}</div>
                            <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(String(display))}">
                        </div>`;
                    }
                    return '';
                }
            }

            return _renderField(field, value || '');
        }).join('');

        container.innerHTML = `<h3 class="form-step-title">${Utils.escapeHtml(OnboardingConfig.getStepLabel(step.number))}</h3>${html}`;

        // Setup file inputs
        container.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', _handleFileChange);
        });

        // Setup visibleWhen: toggle dependent fields on controlling field change
        container.querySelectorAll('[data-visible-when-field]').forEach(el => {
            const controlFieldId = el.dataset.visibleWhenField;
            const controlEl = container.querySelector(`[name="${controlFieldId}"]`);
            if (controlEl && !controlEl._visibleWhenBound) {
                controlEl._visibleWhenBound = true;
                controlEl.addEventListener('change', () => {
                    container.querySelectorAll(`[data-visible-when-field="${controlFieldId}"]`).forEach(dep => {
                        dep.classList.toggle('hidden', controlEl.value !== dep.dataset.visibleWhenValue);
                    });
                });
            }
        });
    }

    function _renderReadonlyPreview(field, value) {
        if (field.type === 'checklist') {
            if (typeof value !== 'object' || value === null) {
                const emptyItems = (field.items || []).map(item =>
                    `<span class="checklist-readonly-item">&#10007; ${Utils.escapeHtml(item.label)}</span>`
                ).join('');
                return `<div class="readonly-field">
                    <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                    <div class="readonly-checklist">${emptyItems}</div>
                </div>`;
            }
            const checkComments = (typeof value.comments === 'object') ? value.comments : {};
            const items = (field.items || []).map((item, idx) => {
                const commentText = checkComments[idx] ? checkComments[idx].trim() : '';
                return `<span class="checklist-readonly-item ${value[idx] ? 'checked' : ''}">${value[idx] ? '&#10003;' : '&#10007;'} ${Utils.escapeHtml(item.label)}</span>${commentText ? `<span class="checklist-readonly-comment">${Utils.escapeHtml(commentText)}</span>` : ''}`;
            }).join('');
            return `<div class="readonly-field">
                <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                <div class="readonly-checklist">${items}</div>
            </div>`;
        }
        let display = value || '—';
        if (field.type === 'select') {
            display = OnboardingConfig.getOptionLabel(field.options || [], value) || value || '—';
        }
        return `<div class="readonly-field">
            <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
            <span class="readonly-value">${Utils.escapeHtml(String(display))}</span>
        </div>`;
    }

    function _renderField(field, value) {
        const required = field.required ? '<span class="field-required">*</span>' : '';
        const reqAttr = field.required ? 'required' : '';
        const id = `field_${field.id}`;

        switch (field.type) {
            case 'text':
            case 'email':
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                    <input type="${field.type}" class="form-input" id="${id}" name="${field.id}"
                        value="${Utils.escapeHtml(String(value))}"
                        placeholder="${Utils.escapeHtml(field.placeholder || '')}" ${reqAttr}>
                </div>`;

            case 'date':
                if (field.noNowButton) {
                    return `<div class="form-group" data-field="${field.id}">
                        <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                        <input type="date" class="form-input" id="${id}" name="${field.id}"
                            value="${Utils.escapeHtml(String(value))}" ${reqAttr}>
                    </div>`;
                }
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                    <div class="date-input-wrap">
                        <input type="datetime-local" class="form-input" id="${id}" name="${field.id}"
                            value="${Utils.escapeHtml(String(value))}" ${reqAttr}>
                        <button type="button" class="date-now-btn" data-action="onb-setDateNow" data-value="${field.id}" title="Сейчас">Сейчас</button>
                    </div>
                </div>`;

            case 'textarea':
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                    <textarea class="form-textarea" id="${id}" name="${field.id}" rows="3"
                        placeholder="${Utils.escapeHtml(field.placeholder || '')}" ${reqAttr}>${Utils.escapeHtml(String(value))}</textarea>
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

            case 'checklist':
                const checks = (typeof value === 'object' && value !== null) ? value : {};
                const comments = (checks && typeof checks.comments === 'object') ? checks.comments : {};
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label">${Utils.escapeHtml(field.label)}${required}</label>
                    <div class="checklist-field" id="checklist_${field.id}">
                        ${(field.items || []).map((item, idx) => {
                            const hasComment = comments[idx] && comments[idx].trim();
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
                                <div class="checklist-comment ${hasComment ? '' : 'hidden'}" id="checkComment_${field.id}_${idx}">
                                    <textarea class="form-textarea checklist-comment-input" name="${field.id}_comment_${idx}"
                                        rows="2" placeholder="Комментарий...">${Utils.escapeHtml(String(comments[idx] || ''))}</textarea>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;

            default:
                return '';
        }
    }

    function _updateSubmitButton(step, stepNumber) {
        const btn = document.getElementById('btnFormSubmit');
        const statusWrap = document.getElementById('statusSubmitWrap');
        if (!btn) return;

        const request = OnboardingState.get('currentRequest');

        // Past step — hide everything
        if (request && stepNumber < request.currentStep) {
            btn.classList.add('hidden');
            if (statusWrap) statusWrap.classList.add('hidden');
            return;
        }

        // Check for asSubmitButton field (e.g. lead_status on step 1)
        const submitField = step.fields.find(f => f.asSubmitButton);

        if (submitField && statusWrap) {
            btn.classList.add('hidden');
            statusWrap.classList.remove('hidden');

            const currentData = (request && request.stageData && request.stageData[stepNumber]) || {};
            const defaultValue = submitField.options && submitField.options[0] && submitField.options[0].value;
            const currentValue = currentData[submitField.id] || '';
            const isDefault = !currentValue || currentValue === defaultValue;
            const buttonLabel = isDefault ? 'Выберите статус' : OnboardingConfig.getOptionLabel(submitField.options || [], currentValue) || currentValue;
            const dropdownOptions = (submitField.options || []).filter(o => o.value !== defaultValue);

            statusWrap.innerHTML = `<div class="status-submit-btn">
                <button class="btn btn-primary status-submit-main" data-action="onb-toggleStatusDropdown">
                    <span class="status-submit-label">${Utils.escapeHtml(buttonLabel)}</span>
                </button>
                <div class="status-submit-dropdown hidden" id="statusDropdown">
                    ${dropdownOptions.map(o =>
                        `<div class="status-submit-option ${o.value === currentValue ? 'active' : ''}"
                             data-action="onb-selectLeadStatus" data-value="${Utils.escapeHtml(o.value)}">
                            ${Utils.escapeHtml(o.label)}
                        </div>`
                    ).join('')}
                </div>
            </div>`;
            return;
        }

        // Normal button — hide status dropdown
        if (statusWrap) statusWrap.classList.add('hidden');
        btn.classList.remove('hidden');

        if (stepNumber === OnboardingConfig.STEPS.length) {
            btn.textContent = 'Завершить';
        } else if (step.dynamicExecutor && request) {
            const data = request.stageData[stepNumber] || {};
            const creator = data[step.dynamicExecutor.field] || step.dynamicExecutor.defaultValue;
            const myRole = OnboardingState.get('userRole');
            const btnSysRole = OnboardingState.get('systemRole');
            if (data._handoff_complete) {
                btn.textContent = step.reviewer ? 'Отправить на проверку' : 'Далее';
            } else if (creator === step.dynamicExecutor.reviewerValue && !OnboardingRoles.isReviewerForStep(btnSysRole, step.number) && myRole !== 'admin' && myRole !== 'leader') {
                btn.textContent = 'Отправить на создание';
            } else if (creator === step.dynamicExecutor.reviewerValue && OnboardingRoles.isReviewerForStep(btnSysRole, step.number)) {
                btn.textContent = 'Отправить экзекьютору';
            } else {
                btn.textContent = step.reviewer ? 'Отправить на проверку' : 'Далее';
            }
        } else if (step.reviewer) {
            btn.textContent = 'Отправить на проверку';
        } else {
            btn.textContent = 'Далее';
        }
    }

    function _handleFileChange(e) {
        const input = e.target;
        const fieldId = input.name;
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            _fileDataUrls[fieldId] = reader.result;
            // Update preview
            const group = input.closest('.form-group');
            const area = group.querySelector('.file-upload-area');
            const existing = group.querySelector('.file-preview');
            if (existing) existing.remove();

            const preview = document.createElement('div');
            preview.className = 'file-preview';
            preview.id = `preview_${fieldId}`;
            preview.innerHTML = `<img src="${reader.result}" alt="" data-action="onb-openPhoto" data-value="${fieldId}">
                <button class="file-remove-btn" data-action="onb-removeFile" data-value="${fieldId}" type="button">&times;</button>`;
            area.prepend(preview);

            const label = group.querySelector('.file-upload-label span');
            if (label) label.textContent = 'Заменить';
        };
        reader.readAsDataURL(file);
    }

    function collectFormData(stepNumber, { excludeFiles = false } = {}) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return {};

        const data = {};
        step.fields.forEach(field => {
            const id = `field_${field.id}`;
            switch (field.type) {
                case 'file':
                    if (!excludeFiles && _fileDataUrls[field.id]) {
                        data[field.id] = _fileDataUrls[field.id];
                    }
                    break;
                case 'list': {
                    const listEl = document.getElementById(`list_${field.id}`);
                    if (listEl) {
                        data[field.id] = Array.from(listEl.querySelectorAll('.list-chip span'))
                            .map(s => s.textContent);
                    }
                    break;
                }
                case 'checklist': {
                    const checkEl = document.getElementById(`checklist_${field.id}`);
                    if (checkEl) {
                        const checks = {};
                        const checkComments = {};
                        checkEl.querySelectorAll('input[type="checkbox"]').forEach((cb, idx) => {
                            checks[idx] = cb.checked;
                        });
                        checkEl.querySelectorAll('.checklist-comment-input').forEach((ta, idx) => {
                            if (ta.value.trim()) checkComments[idx] = ta.value.trim();
                        });
                        if (Object.keys(checkComments).length) checks.comments = checkComments;
                        data[field.id] = checks;
                    }
                    break;
                }
                default: {
                    const el = document.getElementById(id);
                    if (el) data[field.id] = el.value;
                }
            }
        });
        return data;
    }

    function validate(stepNumber) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return { valid: false, errors: ['Шаг не найден'] };

        const data = collectFormData(stepNumber);
        const request = OnboardingState.get('currentRequest');
        const existing = (request && request.stageData && request.stageData[stepNumber]) || {};
        const merged = { ...existing, ...data };
        const errors = [];

        // Check required
        step.fields.forEach(field => {
            if (field.asSubmitButton) return; // validated via submit action
            if (!_shouldShowField(field, merged, step)) return;
            // Skip hidden visibleWhen fields
            if (field.visibleWhen && merged[field.visibleWhen.field] !== field.visibleWhen.value) return;
            if (!field.required) return;

            // For file fields, also check existing stageData (files aren't re-read on every render)
            const value = field.type === 'file' ? (data[field.id] || existing[field.id]) : data[field.id];
            if (field.type === 'checklist') {
                // All items must be checked
                if (typeof value !== 'object') {
                    errors.push(`${field.label}: отметьте все пункты`);
                    return;
                }
                const items = field.items || [];
                const allChecked = items.every((_, idx) => value[idx]);
                if (!allChecked) errors.push(`${field.label}: отметьте все пункты`);
            } else if (!value || (typeof value === 'string' && !value.trim())) {
                errors.push(`${field.label}: обязательное поле`);
            }
        });

        // Check oneOf groups
        const oneOfGroups = {};
        step.fields.forEach(field => {
            if (field.oneOf) {
                if (!oneOfGroups[field.oneOf]) oneOfGroups[field.oneOf] = [];
                oneOfGroups[field.oneOf].push(field);
            }
        });
        for (const [group, fields] of Object.entries(oneOfGroups)) {
            const hasValue = fields.some(f => {
                const val = data[f.id];
                return val && String(val).trim();
            });
            if (!hasValue) {
                const labels = fields.map(f => f.label).join(' или ');
                errors.push(`Заполните хотя бы одно: ${labels}`);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    function removeFile(fieldId) {
        delete _fileDataUrls[fieldId];
        const preview = document.getElementById(`preview_${fieldId}`);
        if (preview) preview.remove();
        const input = document.getElementById(`field_${fieldId}`);
        if (input) input.value = '';
        const group = document.querySelector(`[data-field="${fieldId}"]`);
        if (group) {
            const label = group.querySelector('.file-upload-label span');
            if (label) label.textContent = 'Выбрать файл';
        }
    }

    function addListItem(fieldId) {
        const input = document.getElementById(`listInput_${fieldId}`);
        if (!input || !input.value.trim()) return;

        const listEl = document.getElementById(`list_${fieldId}`);
        const itemsContainer = listEl.querySelector('.list-items');
        const idx = itemsContainer.querySelectorAll('.list-chip').length;

        const chip = document.createElement('div');
        chip.className = 'list-chip';
        chip.innerHTML = `<span>${Utils.escapeHtml(input.value.trim())}</span>
            <button type="button" class="list-chip-remove" data-action="onb-removeListItem" data-value="${fieldId}:${idx}">&times;</button>`;
        itemsContainer.appendChild(chip);
        input.value = '';
    }

    function removeListItem(fieldId, idx) {
        const listEl = document.getElementById(`list_${fieldId}`);
        if (!listEl) return;
        const chips = listEl.querySelectorAll('.list-chip');
        if (chips[idx]) {
            const text = chips[idx].querySelector('span').textContent;
            chips[idx].remove();
            // Restore suggestion if it was one
            const suggestionsEl = document.getElementById(`listSuggestions_${fieldId}`);
            if (suggestionsEl) {
                suggestionsEl.querySelectorAll('.list-suggestion').forEach(btn => {
                    if (btn.textContent === text) btn.classList.remove('hidden');
                });
            }
        }
    }

    function addListSuggestion(fieldId, text) {
        const listEl = document.getElementById(`list_${fieldId}`);
        if (!listEl) return;
        const itemsContainer = listEl.querySelector('.list-items');
        const idx = itemsContainer.querySelectorAll('.list-chip').length;

        const chip = document.createElement('div');
        chip.className = 'list-chip';
        chip.innerHTML = `<span>${Utils.escapeHtml(text)}</span>
            <button type="button" class="list-chip-remove" data-action="onb-removeListItem" data-value="${fieldId}:${idx}">&times;</button>`;
        itemsContainer.appendChild(chip);

        // Hide the suggestion
        const suggestionsEl = document.getElementById(`listSuggestions_${fieldId}`);
        if (suggestionsEl) {
            suggestionsEl.querySelectorAll('.list-suggestion').forEach(btn => {
                if (btn.textContent === text) btn.classList.add('hidden');
            });
        }
    }

    function _formatDateDisplay(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
        return hasTime ? `${dd}.${mm}.${yyyy} ${hh}:${min}` : `${dd}.${mm}.${yyyy}`;
    }

    function toggleChecklistComment(fieldId, idx) {
        const el = document.getElementById(`checkComment_${fieldId}_${idx}`);
        if (!el) return;
        el.classList.toggle('hidden');
        if (!el.classList.contains('hidden')) {
            const ta = el.querySelector('textarea');
            if (ta) ta.focus();
        }
        const btn = document.querySelector(`[data-action="onb-toggleChecklistComment"][data-value="${fieldId}:${idx}"]`);
        if (btn) {
            const ta = el.querySelector('textarea');
            btn.classList.toggle('has-comment', ta && ta.value.trim());
        }
    }

    /** Return pending file uploads (base64 data URLs not yet uploaded to server) */
    function getPendingFiles() {
        const files = {};
        for (const [fieldId, dataUrl] of Object.entries(_fileDataUrls)) {
            if (dataUrl && dataUrl.startsWith('data:')) {
                files[fieldId] = dataUrl;
            }
        }
        return files;
    }

    /** Replace local base64 with server URL after upload */
    function setFileUrl(fieldId, url) {
        _fileDataUrls[fieldId] = url;
    }

    return {
        render,
        collectFormData,
        validate,
        removeFile,
        addListItem,
        addListSuggestion,
        removeListItem,
        toggleChecklistComment,
        getPendingFiles,
        setFileUrl
    };
})();
