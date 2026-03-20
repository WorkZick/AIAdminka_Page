/* onboarding-form.js — Формы шагов (executor) — динамическая генерация */

const OnboardingForm = (() => {
    'use strict';

    let _fileDataUrls = {};

    function render(request, stepNumber) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return;

        _fileDataUrls = {};

        // Sidebar: vertical steps + info
        OnboardingSteps.renderVertical('formSteps', stepNumber);
        OnboardingSteps.renderInfo('formInfo', request);

        // executorFinal step: reviewer/admin sees editable form, executor sees disabled waiting fields
        if (step.executorFinal) {
            const { myRole: efRole, sysRole: efSysRole } = OnboardingUtils.getRoles();
            const isReviewerOrAdmin = OnboardingRoles.isReviewerForStep(efSysRole, step.number) ||
                efRole === 'admin' || efRole === 'leader';
            if (!isReviewerOrAdmin) {
                const banner = document.getElementById('formBanner');
                if (banner) { banner.classList.add('hidden'); banner.innerHTML = ''; }
                const efData = request.stageData[stepNumber] || {};
                const efHtml = step.fields.map(field => {
                    if (field.asSubmitButton) return '';
                    if (field.showWhen) {
                        if (OnboardingUtils.isEmpty(efData[field.id])) return '';
                    }
                    let value = efData[field.id];
                    if (OnboardingUtils.isEmpty(value) && field.autofill) {
                        const src = (request.stageData[field.autofill.step]) || {};
                        value = src[field.autofill.field] || '';
                    }
                    return FieldRenderer.renderReadonly(field, value, { allowDataUrls: true });
                }).join('');
                const container = document.getElementById('formFields');
                if (container) container.innerHTML = `${_stepTitle(step, request)}${efHtml}`;
                const btn = document.getElementById('btnFormSubmit');
                if (btn) btn.classList.add('hidden');
                const statusWrap = document.getElementById('statusSubmitWrap');
                if (statusWrap) statusWrap.classList.add('hidden');
                return;
            }
        }

        // Past or future step preview: readonly, hide banner
        const isPastPreview = stepNumber < request.currentStep;
        const isFuturePreview = stepNumber > request.currentStep;
        if (isPastPreview || isFuturePreview) {
            const banner = document.getElementById('formBanner');
            if (banner) { banner.classList.add('hidden'); banner.innerHTML = ''; }
            _renderFields(step, request.stageData[stepNumber] || {}, request);
            const statusWrap = document.getElementById('statusSubmitWrap');
            if (statusWrap) statusWrap.classList.add('hidden');
            // Past: hide submit. Future: show "К текущему шагу" via getSubmitConfig
            const btn = document.getElementById('btnFormSubmit');
            if (btn) {
                if (isPastPreview) {
                    btn.classList.add('hidden');
                } else {
                    _updateSubmitButton(step, stepNumber);
                }
            }
            return;
        }

        _renderBanner(request);

        // Main: form fields + submit button
        _renderFields(step, request.stageData[stepNumber] || {}, request);
        _updateSubmitButton(step, stepNumber);

        // Antifraud: dynamically update button text + comment required on antifraud_result change
        if (step.isAntifraud) {
            const antifraudSelect = document.getElementById('field_antifraud_result');
            if (antifraudSelect) {
                antifraudSelect.addEventListener('change', () => {
                    _updateSubmitButton(step, stepNumber);
                    const commentGroup = document.querySelector('[data-field="antifraud_comment"]');
                    if (commentGroup) {
                        const label = commentGroup.querySelector('.form-label');
                        const textarea = commentGroup.querySelector('.form-textarea');
                        if (antifraudSelect.value === 'failed') {
                            if (label && !label.querySelector('.field-required')) {
                                label.insertAdjacentHTML('beforeend', '<span class="field-required">*</span>');
                            }
                            if (textarea) textarea.setAttribute('required', '');
                        } else {
                            const req = label && label.querySelector('.field-required');
                            if (req) req.remove();
                            if (textarea) textarea.removeAttribute('required');
                        }
                    }
                });
            }
        }
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

    function _stepTitle(step, request) {
        const label = Utils.escapeHtml(OnboardingConfig.getStepLabel(step.number));
        if (!request || Number(step.number) !== Number(request.currentStep)) {
            return `<h3 class="form-step-title">${label}</h3>`;
        }
        // AutoHandoff phase 1: status "approved" from prev step → show "В работе"
        let displayStatus = request.status;
        if (step.dynamicExecutor && step.dynamicExecutor.autoHandoff) {
            const stepData = (request.stageData && request.stageData[step.number]) || {};
            if (!stepData._handoff_complete && displayStatus === 'approved') {
                displayStatus = 'on_review';
            }
        }
        const statusConf = OnboardingConfig.STATUSES[displayStatus] || {};
        const badgeLabel = statusConf.label || displayStatus;
        const badgeClass = statusConf.cssClass || '';
        return `<h3 class="form-step-title">${label} <span class="status-badge ${Utils.escapeHtml(badgeClass)}">${Utils.escapeHtml(badgeLabel)}</span></h3>`;
    }

    function _renderFields(step, data, request) {
        const container = document.getElementById('formFields');
        if (!container) return;

        const { myRole, sysRole, isAdmin } = OnboardingUtils.getRoles();
        const stepData = data;

        // Past or future step: presentation mode (readonly for all roles)
        // Use Number() coercion to avoid strict-inequality mismatch between number and string types
        const isPastOrFuturePreview = request && Number(step.number) !== Number(request.currentStep);

        if (isPastOrFuturePreview) {
            // Preview: show ALL fields as readonly labels + values/dashes (no showWhen filtering)
            const html = step.fields.map(field => {
                if (field.asSubmitButton) return '';
                if (!FieldRenderer.isFieldVisible(field, data)) return '';
                const value = FieldRenderer.resolveValue(field.id, data, field, request);
                return FieldRenderer.renderReadonly(field, value, { allowDataUrls: true });
            }).join('');
            container.innerHTML = `${_stepTitle(step, request)}${html}`;
            return;
        }

        // AutoHandoff active step: executor waits (readonly), reviewer fills (editable)
        if (step.dynamicExecutor && step.dynamicExecutor.autoHandoff && !stepData._handoff_complete) {
            const isReviewerOrAdmin = OnboardingRoles.isReviewerForStep(sysRole, step.number) || isAdmin;
            if (!isReviewerOrAdmin) {
                // Executor on active autoHandoff step: show ALL fields as readonly with dashes (like past/future preview)
                const html = step.fields.map(field => {
                    if (field.asSubmitButton) return '';
                    if (!FieldRenderer.isFieldVisible(field, data)) return '';
                    const value = FieldRenderer.resolveValue(field.id, data, field, request);
                    return FieldRenderer.renderReadonly(field, value, { allowDataUrls: true });
                }).join('');
                container.innerHTML = `${_stepTitle(step, request)}${html}`;
                const btn = document.getElementById('btnFormSubmit');
                if (btn) btn.classList.add('hidden');
                const statusWrap = document.getElementById('statusSubmitWrap');
                if (statusWrap) statusWrap.classList.add('hidden');
                return;
            }
            // Reviewer: fall through to normal editable rendering below
        }

        const isImported = request.createdBy === 'import:google-sheets';
        const isHandoffComplete = step.dynamicExecutor && stepData._handoff_complete;
        const isAutoHandoff = step.dynamicExecutor && step.dynamicExecutor.autoHandoff;
        const isPreviewBeforeHandoff = step.dynamicExecutor && step.dynamicExecutor.defaultValue &&
            !stepData[step.dynamicExecutor.field] && !isHandoffComplete && !isAutoHandoff;

        const html = step.fields.map(field => {
            // Preview mode: show showWhen fields as readonly placeholders before handoff
            if (isPreviewBeforeHandoff && field.showWhen && field.showWhen.phase === 'fill') {
                return FieldRenderer.renderReadonly(field, data[field.id], { allowDataUrls: true });
            }

            // asSubmitButton: rendered as submit dropdown, not as form field
            if (field.asSubmitButton) return '';

            if (!FieldRenderer.shouldShowField(field, stepData, step)) return '';

            // Readonly for imported fields (e.g. lead_source, geo_country from Google Sheets)
            if (isImported && field.readonlyForImport && data[field.id]) {
                let displayVal = data[field.id];
                if (field.type === 'select' && field.options) {
                    const optLabel = OnboardingConfig.getOptionLabel(field.options, data[field.id]);
                    if (optLabel) displayVal = optLabel;
                } else if (field.type === 'date') {
                    displayVal = OnboardingUtils.formatDateTime(data[field.id]);
                }
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                    <div class="form-input readonly-input">${Utils.escapeHtml(String(displayVal))}</div>
                    <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(String(data[field.id]))}">
                </div>`;
            }

            // Handle autofill
            let value = FieldRenderer.resolveValue(field.id, data, field, request);

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
            // confirm-phase fields: editable for executor, readonly for reviewer
            if (isHandoffComplete) {
                const isConfirmPhase = field.showWhen && field.showWhen.phase === 'confirm';
                if (!isConfirmPhase) return FieldRenderer.renderReadonly(field, value, { allowDataUrls: true });
                // Confirm phase: only executor fills the checklist
                if (!OnboardingRoles.isExecutorForStep(sysRole, step.number) && !isAdmin) {
                    return FieldRenderer.renderReadonly(field, value, { allowDataUrls: true });
                }
            }

            // Readonly for account_creator when reviewer fills
            if (step.dynamicExecutor && field.id === step.dynamicExecutor.field) {
                const creator = data[step.dynamicExecutor.field];
                if (creator === step.dynamicExecutor.reviewerValue && OnboardingRoles.isReviewerForStep(sysRole, step.number)) {
                    const label = OnboardingConfig.getOptionLabel(field.options || [], creator);
                    return `<div class="form-group" data-field="${field.id}">
                        <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                        <div class="form-input readonly-input">${Utils.escapeHtml(label)}</div>
                        <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(creator)}">
                    </div>`;
                }
            }

            // Lead step: geo_country uses conditions-based countries if available
            if (step.hasGeoCountry && field.id === 'geo_country' && OnboardingSource.hasConditions()) {
                return FieldRenderer.renderEditable({ ...field, options: OnboardingSource.getCountries() }, value || '');
            }

            // visibleWhen: conditionally hidden based on another field's value
            if (field.visibleWhen) {
                const depValue = data[field.visibleWhen.field];
                const isVisible = depValue === field.visibleWhen.value;
                const rendered = FieldRenderer.renderEditable(field, value || '');
                return rendered.replace(
                    'class="form-group"',
                    `class="form-group${isVisible ? '' : ' hidden'}" data-visible-when-field="${Utils.escapeHtml(field.visibleWhen.field)}" data-visible-when-value="${Utils.escapeHtml(field.visibleWhen.value)}"`
                );
            }

            // Conditions: cascade country → method_type → method_name → readonly fields
            if (step.hasConditionsCascade && OnboardingSource.hasConditions()) {
                const selCountry = data.condition_country || '';
                const selType = data.method_type || '';

                if (field.id === 'condition_country') {
                    return FieldRenderer.renderEditable({ ...field, options: OnboardingSource.getCountries() }, value || '');
                }
                if (field.id === 'method_type') {
                    const types = selCountry ? OnboardingSource.getMethodTypes(selCountry) : [];
                    return FieldRenderer.renderEditable({ ...field, options: types }, value || '');
                }
                if (field.id === 'method_name') {
                    const names = selType ? OnboardingSource.getMethodNames(selCountry, selType) : [];
                    return FieldRenderer.renderEditable({ ...field, options: names }, value || '');
                }
                const conditionFields = ['deal_1', 'deal_2', 'deal_3', 'prepayment_method', 'prepayment_amount'];
                if (conditionFields.includes(field.id)) {
                    const selName = data.method_name || '';
                    if (!selCountry || !selType || !selName) return '';
                    const cond = OnboardingSource.getCondition(selCountry, selType, selName);
                    if (cond && cond[field.id]) {
                        const raw = String(cond[field.id]);
                        const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
                        if (parts.length > 1) {
                            const curVal = value || '';
                            const opts = parts.map(p =>
                                `<option value="${Utils.escapeHtml(p)}"${p === curVal ? ' selected' : ''}>${Utils.escapeHtml(p)}</option>`
                            ).join('');
                            return `<div class="form-group" data-field="${field.id}">
                                <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                                <select class="form-select" id="field_${field.id}" name="${field.id}">
                                    <option value="">Выберите...</option>${opts}
                                </select>
                            </div>`;
                        }
                        return `<div class="form-group" data-field="${field.id}">
                            <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                            <div class="form-input readonly-input">${Utils.escapeHtml(raw)}</div>
                            <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(raw)}">
                        </div>`;
                    }
                    return '';
                }
            }

            return FieldRenderer.renderEditable(field, value || '');
        }).join('');

        container.innerHTML = `${_stepTitle(step, request)}${html}`;

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

    function _updateSubmitButton(step, stepNumber) {
        const btn = document.getElementById('btnFormSubmit');
        const statusWrap = document.getElementById('statusSubmitWrap');
        if (!btn) return;

        const request = OnboardingState.get('currentRequest');
        const roles = OnboardingUtils.getRoles();
        const config = OnboardingConfig.getSubmitConfig(step, request, roles);

        // Restore default action
        btn.setAttribute('data-action', config.action);

        // Status dropdown mode (asSubmitButton field like lead_status)
        if (config.statusDropdown && statusWrap && config.submitField) {
            btn.classList.add('hidden');
            statusWrap.classList.remove('hidden');

            const submitField = config.submitField;
            const currentData = (request && request.stageData && request.stageData[stepNumber]) || {};
            const defaultValue = submitField.options && submitField.options[0] && submitField.options[0].value;
            const currentValue = currentData[submitField.id] || '';
            const isDefault = !currentValue || currentValue === defaultValue;
            const buttonLabel = isDefault ? 'Выберите статус' : OnboardingConfig.getOptionLabel(submitField.options || [], currentValue) || currentValue;
            const dropdownOptions = (submitField.options || []).filter(o => o.value !== defaultValue);

            statusWrap.innerHTML = `<div class="dropdown-wrap dropdown-wrap--up">
                <div class="dropdown-menu hidden" id="statusDropdown">
                    ${dropdownOptions.map(o =>
                        `<div class="dropdown-item ${o.value === currentValue ? 'active' : ''}"
                             data-action="onb-selectLeadStatus" data-value="${Utils.escapeHtml(o.value)}">
                            ${Utils.escapeHtml(o.label)}
                        </div>`
                    ).join('')}
                </div>
                <button class="btn btn-primary dropdown-trigger" data-action="onb-toggleStatusDropdown">
                    <span>${Utils.escapeHtml(buttonLabel)}</span>
                </button>
            </div>`;
            return;
        }

        // Normal button mode
        if (statusWrap) statusWrap.classList.add('hidden');

        if (!config.visible) {
            btn.classList.add('hidden');
            return;
        }

        btn.classList.remove('hidden');
        btn.textContent = config.label;

        // Antifraud override: change button text based on result
        if (step.isAntifraud && request) {
            const stepData = request.stageData[stepNumber] || {};
            const antifraudEl = document.getElementById('field_antifraud_result');
            const currentVal = antifraudEl ? antifraudEl.value : stepData.antifraud_result;
            if (currentVal === 'failed') {
                btn.textContent = 'Антифрод не пройден';
            } else if (currentVal === 'passed') {
                btn.textContent = 'Антифрод пройден';
            }
        }
    }

    function _handleFileChange(e) {
        const input = e.target;
        const fieldId = input.name;

        if (input.multiple) {
            const files = Array.from(input.files);
            if (!files.length) return;
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            if (!imageFiles.length) { Toast.error('Допустимы только изображения'); return; }
            if (!Array.isArray(_fileDataUrls[fieldId])) _fileDataUrls[fieldId] = [];
            const group = input.closest('.form-group');
            const container = group.querySelector('.file-previews');
            imageFiles.forEach(file => {
                const reader = new FileReader();
                reader.onload = () => {
                    _fileDataUrls[fieldId].push(reader.result);
                    const idx = _fileDataUrls[fieldId].length - 1;
                    const preview = document.createElement('div');
                    preview.className = 'file-preview';
                    preview.dataset.index = idx;
                    preview.innerHTML = `<img src="${FieldRenderer.sanitizeDataUrl(reader.result)}" alt="" data-action="onb-openPhoto" data-value="${fieldId}">
                        <button class="file-remove-btn" data-action="onb-removeMultiFile" data-value="${fieldId}:${idx}" type="button">&times;</button>`;
                    container.appendChild(preview);
                    const label = group.querySelector('.file-upload-label span');
                    if (label) label.textContent = 'Добавить ещё';
                };
                reader.readAsDataURL(file);
            });
            input.value = '';
            return;
        }

        const file = input.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { Toast.error('Допустимы только изображения'); input.value = ''; return; }

        const reader = new FileReader();
        reader.onload = () => {
            _fileDataUrls[fieldId] = reader.result;
            const group = input.closest('.form-group');
            const area = group.querySelector('.file-upload-area');
            const existing = group.querySelector('.file-preview');
            if (existing) existing.remove();

            const preview = document.createElement('div');
            preview.className = 'file-preview';
            preview.id = `preview_${fieldId}`;
            preview.innerHTML = `<img src="${FieldRenderer.sanitizeDataUrl(reader.result)}" alt="" data-action="onb-openPhoto" data-value="${fieldId}">
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
            if (!FieldRenderer.shouldShowField(field, merged, step)) return;
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

        // Antifraud: antifraud_comment required when result is "failed"
        if (step && step.isAntifraud && merged.antifraud_result === 'failed') {
            const comment = merged.antifraud_comment;
            if (!comment || (typeof comment === 'string' && !comment.trim())) {
                errors.push('Комментарий: обязательное поле при отмене');
            }
        }

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

    function _autoResize(ta) {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
    }

    function toggleChecklistComment(fieldId, idx) {
        const el = document.getElementById(`checkComment_${fieldId}_${idx}`);
        if (!el) return;
        el.classList.toggle('hidden');
        if (!el.classList.contains('hidden')) {
            const ta = el.querySelector('textarea');
            if (ta) {
                if (!ta._autoResize) {
                    ta.addEventListener('input', () => _autoResize(ta));
                    ta._autoResize = true;
                }
                requestAnimationFrame(() => {
                    _autoResize(ta);
                    ta.focus();
                });
            }
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
            if (Array.isArray(dataUrl)) {
                const pending = dataUrl.filter(u => u && u.startsWith('data:'));
                if (pending.length) files[fieldId] = pending;
            } else if (dataUrl && dataUrl.startsWith('data:')) {
                files[fieldId] = dataUrl;
            }
        }
        return files;
    }

    /**
     * Replace local base64 with server URL after upload.
     * @param {string} fieldId - Field identifier
     * @param {string|string[]} url - Single URL (string) for single-file fields,
     *   or array of URLs (string[]) for multi-file fields (field.multiple === true).
     */
    function setFileUrl(fieldId, url) {
        _fileDataUrls[fieldId] = url;
    }

    /** Remove a file from multi-file field by index */
    function removeMultiFile(fieldId, index) {
        if (Array.isArray(_fileDataUrls[fieldId])) {
            _fileDataUrls[fieldId].splice(index, 1);
        }
        // Also remove from existing stageData
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (request && request.stageData && request.stageData[stepNumber]) {
            const arr = request.stageData[stepNumber][fieldId];
            if (Array.isArray(arr)) arr.splice(index, 1);
        }
        // Re-render previews
        const container = document.getElementById(`previews_${fieldId}`);
        if (container) {
            const allUrls = _getMultiFileUrls(fieldId);
            container.innerHTML = allUrls.map((u, i) => `<div class="file-preview" data-index="${i}">
                <img src="${FieldRenderer.sanitizeDataUrl(u)}" alt="" data-action="onb-openPhoto" data-value="${fieldId}">
                <button class="file-remove-btn" data-action="onb-removeMultiFile" data-value="${fieldId}:${i}" type="button">&times;</button>
            </div>`).join('');
            const group = container.closest('.form-group');
            const label = group && group.querySelector('.file-upload-label span');
            if (label) label.textContent = allUrls.length ? 'Добавить ещё' : 'Выбрать файлы';
        }
    }

    function _getMultiFileUrls(fieldId) {
        const pending = Array.isArray(_fileDataUrls[fieldId]) ? _fileDataUrls[fieldId] : [];
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        const existing = (request && request.stageData && request.stageData[stepNumber] && Array.isArray(request.stageData[stepNumber][fieldId]))
            ? request.stageData[stepNumber][fieldId] : [];
        // Merge: existing uploaded URLs + new pending data URLs
        return [...existing.filter(u => !u.startsWith('data:')), ...pending];
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
        setFileUrl,
        removeMultiFile
    };
})();
