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
            const isAdminLike = myRole === 'admin' || myRole === 'leader';
            if (isAdminLike) return true;
            if (creator === step.dynamicExecutor.executorValue && myRole === 'executor') return true;
            if (creator === step.dynamicExecutor.reviewerValue && myRole === 'reviewer') return true;
            return false;
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

        const isHandoffComplete = step.dynamicExecutor && stepData._handoff_complete;

        const html = step.fields.map(field => {
            if (!_shouldShowField(field, stepData, step)) return '';

            // Handle autofill
            let value = data[field.id];
            if (value === undefined && field.autofill) {
                const sourceData = request.stageData[field.autofill.step] || {};
                value = sourceData[field.autofill.field] || '';
                if (field.autofill.field === 'method_name') {
                    value = OnboardingConfig.getOptionLabel(OnboardingConfig.METHOD_NAMES, value) || value;
                }
            }

            // Readonly for all fields when handoff completed (executor views reviewer's data)
            if (isHandoffComplete) {
                let display = value || '—';
                if (field.type === 'select') {
                    display = OnboardingConfig.getOptionLabel(field.options || [], value) || value || '—';
                }
                return `<div class="readonly-field">
                    <span class="readonly-label">${Utils.escapeHtml(field.label)}</span>
                    <span class="readonly-value">${Utils.escapeHtml(String(display))}</span>
                </div>`;
            }

            // Readonly for account_creator when reviewer fills
            if (step.dynamicExecutor && field.id === step.dynamicExecutor.field) {
                const creator = data[step.dynamicExecutor.field];
                if (creator === step.dynamicExecutor.reviewerValue && myRole === 'reviewer') {
                    const label = OnboardingConfig.getOptionLabel(field.options || [], creator);
                    return `<div class="form-group" data-field="${field.id}">
                        <label class="form-label">${Utils.escapeHtml(field.label)}</label>
                        <div class="form-input readonly-input">${Utils.escapeHtml(label)}</div>
                        <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(creator)}">
                    </div>`;
                }
            }

            return _renderField(field, value || '');
        }).join('');

        container.innerHTML = `<h3 class="form-step-title">${Utils.escapeHtml(OnboardingConfig.getStepLabel(step.number))}</h3>${html}`;

        // Setup file inputs
        container.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', _handleFileChange);
        });
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
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label" for="${id}">${Utils.escapeHtml(field.label)}${required}</label>
                    <input type="date" class="form-input" id="${id}" name="${field.id}"
                        value="${Utils.escapeHtml(String(value))}" ${reqAttr}>
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

            case 'list':
                const items = Array.isArray(value) ? value : (value ? [value] : []);
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
                            <button type="button" class="btn btn-ghost btn-sm" data-action="onb-addListItem" data-value="${field.id}">+</button>
                        </div>
                    </div>
                </div>`;

            case 'checklist':
                const checks = (typeof value === 'object' && value !== null) ? value : {};
                return `<div class="form-group" data-field="${field.id}">
                    <label class="form-label">${Utils.escapeHtml(field.label)}${required}</label>
                    <div class="checklist-field" id="checklist_${field.id}">
                        ${(field.items || []).map((item, idx) => `<label class="checklist-item">
                            <input type="checkbox" name="${field.id}_${idx}" ${checks[idx] ? 'checked' : ''}>
                            <span>${Utils.escapeHtml(item.label)}</span>
                        </label>`).join('')}
                    </div>
                </div>`;

            default:
                return '';
        }
    }

    function _updateSubmitButton(step, stepNumber) {
        const btn = document.getElementById('btnFormSubmit');
        if (!btn) return;

        const request = OnboardingState.get('currentRequest');
        if (request && stepNumber < request.currentStep) {
            btn.classList.add('hidden');
            return;
        }
        btn.classList.remove('hidden');

        if (stepNumber === OnboardingConfig.STEPS.length) {
            btn.textContent = 'Завершить';
        } else if (step.dynamicExecutor && request) {
            const data = request.stageData[stepNumber] || {};
            const creator = data[step.dynamicExecutor.field];
            const myRole = OnboardingState.get('userRole');
            if (data._handoff_complete) {
                btn.textContent = 'Далее';
            } else if (creator === step.dynamicExecutor.reviewerValue && myRole !== 'reviewer' && myRole !== 'admin' && myRole !== 'leader') {
                btn.textContent = 'Отправить на создание';
            } else if (creator === step.dynamicExecutor.reviewerValue && myRole === 'reviewer') {
                btn.textContent = 'Отправить экзекьютору';
            } else {
                btn.textContent = 'Далее';
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

    function collectFormData(stepNumber) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return {};

        const data = {};
        step.fields.forEach(field => {
            const id = `field_${field.id}`;
            switch (field.type) {
                case 'file':
                    if (_fileDataUrls[field.id]) {
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
                        checkEl.querySelectorAll('input[type="checkbox"]').forEach((cb, idx) => {
                            checks[idx] = cb.checked;
                        });
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
            if (!_shouldShowField(field, merged, step)) return;
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
        if (chips[idx]) chips[idx].remove();
    }

    return {
        render,
        collectFormData,
        validate,
        removeFile,
        addListItem,
        removeListItem
    };
})();
