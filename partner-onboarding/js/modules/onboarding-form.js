/**
 * OnboardingForm — Формы шагов (executor)
 * Динамическая генерация форм из конфига, валидация, сохранение
 * Поддерживает: text, email, url, number, date, textarea, select, checkbox, file, list, checklist, readonly
 * Условная видимость (showWhen), условная обязательность (requiredWhen), oneOf валидация
 */

const OnboardingForm = {
    /** Временное хранение dataUrl файлов (до сохранения в stageData) */
    _fileDataUrls: {},
    /** Флаги явного удаления файлов пользователем */
    _fileRemovedFlags: {},

    /** Рендеринг формы шага */
    renderStepForm(stageNumber) {
        const container = document.getElementById('stepForm');
        if (!container) return;

        const stage = OnboardingConfig.getStage(stageNumber);
        if (!stage) return;

        // autoSubmit шаг — фазовый рендеринг (Шаг 4: антифрод + пополнение)
        if (stage.autoSubmit) {
            const request = OnboardingState.get('currentRequest');
            const afData = request?.stageData?.[stageNumber] || {};
            const depositStatus = afData.phase;
            let bannerText = '';
            let bannerType = '';
            let extraHtml = '';

            if (afData.phase === 'check' && request?.status === 'declined') {
                bannerText = 'Партнёр отклонён антифрод-отделом.';
                bannerType = 'warning';
                if (afData.af_public_reason) {
                    extraHtml = `<div class="af-reason af-reason--public"><span class="af-reason-label">Причина:</span> ${Utils.escapeHtml(afData.af_public_reason)}</div>`;
                }
            } else if (depositStatus === 'approved') {
                bannerText = 'Метод предоплаты разблокирован, партнёр может пополняться.';
                bannerType = 'success';
                const lastReject = (request?.history || [])
                    .filter(h => h.stageNumber === stageNumber && h.action === 'reject')
                    .pop();
                if (lastReject?.comment) {
                    extraHtml = `<div class="status-hint status-hint--warning"><strong>Замечание ревьюера:</strong> ${Utils.escapeHtml(lastReject.comment)}</div>`;
                }
            } else if (depositStatus === 'deposit_ok') {
                bannerText = 'Пополнение отправлено на проверку. Ожидайте решения.';
            } else {
                bannerText = 'Партнёр на проверке антифрод-отделом. Ожидайте решения.';
            }

            // Banner
            const banner = document.getElementById('stepStatusBanner');
            if (banner) {
                let pillsSection = '';
                const canCancel = request && !['cancelled', 'completed', 'declined'].includes(request.status);
                if (canCancel) {
                    const currentLeadStatus = request?.stageData?.[1]?.lead_status || 'in_conversation';
                    const pillsHtml = OnboardingConfig.LEAD_STATUSES
                        .filter(s => s.value === 'in_conversation' || s.value === 'ignored' || s.value === 'refused')
                        .map(opt => {
                            const activeClass = opt.value === currentLeadStatus ? ' active' : '';
                            return `<button class="lead-status-pill${activeClass}" data-action="onboarding-selectLeadStatus" data-value="${Utils.escapeHtml(opt.value)}">${Utils.escapeHtml(opt.label)}</button>`;
                        }).join('');
                    pillsSection = `
                        <div class="lead-status-bar lead-status-bar--compact">
                            <span class="lead-status-label">Статус лида:</span>
                            <div class="lead-status-pills">${pillsHtml}</div>
                        </div>
                        <div class="status-hint hidden" id="leadStatusHint"></div>
                        <div class="form-group hidden" id="leadRejectReasonGroup">
                            <label class="form-label">Причина отказа *</label>
                            <textarea class="form-textarea" id="field_reject_reason_cancel" rows="2" placeholder="Укажите причину отказа лида..."></textarea>
                        </div>
                        <input type="hidden" id="field_lead_status" value="${Utils.escapeHtml(currentLeadStatus)}">
                    `;
                }
                const typeClass = bannerType ? ` status-hint--${bannerType}` : '';
                banner.innerHTML = pillsSection + `<div class="status-hint${typeClass}">${Utils.escapeHtml(bannerText)}</div>`;
                banner.classList.remove('hidden');
            }

            const prevDataHtml = this._renderPreviousStageData(stageNumber);

            // Показать данные антифрода (результат, статус пополнения) если есть
            let afDataHtml = '';
            const afFieldsHtml = OnboardingReview._renderAntifraudData(request);
            if (afFieldsHtml) {
                afDataHtml = `
                    <div class="prev-stage-section">
                        <div class="prev-stage-label">Шаг ${stageNumber}: ${Utils.escapeHtml(stage.name)}</div>
                        <div class="step-form-fields step-form-fields--readonly">${afFieldsHtml}</div>
                    </div>
                `;
            }

            container.innerHTML = prevDataHtml + afDataHtml + extraHtml;
            this._updateAntifraudUI(afData);

            // Bind lead status handler for autoSubmit steps (pills in banner)
            const statusEl = document.getElementById('field_lead_status');
            if (statusEl) {
                statusEl.addEventListener('change', () => {
                    this._updateLeadStatusUI(statusEl.value);
                });
            }
            return;
        }

        // Автоматический шаг — заглушка
        if (stage.auto) {
            const banner = document.getElementById('stepStatusBanner');
            if (banner) { banner.innerHTML = ''; banner.classList.add('hidden'); }
            container.innerHTML = `
                <div class="step-form-placeholder">
                    <img src="../shared/icons/handshake.svg" width="48" height="48" alt="">
                    <p>Этот шаг выполняется автоматически</p>
                </div>
            `;
            return;
        }

        // Если поля ещё не определены — показываем placeholder
        if (!stage.fields || stage.fields.length === 0) {
            const banner = document.getElementById('stepStatusBanner');
            if (banner) { banner.innerHTML = ''; banner.classList.add('hidden'); }
            container.innerHTML = `
                <div class="step-form-placeholder">
                    <img src="../shared/icons/handshake.svg" width="48" height="48" alt="">
                    <p>Поля формы для шага "${Utils.escapeHtml(stage.name)}" будут добавлены позже</p>
                </div>
            `;
            return;
        }

        // Readonly-секция с данными предыдущих шагов (если есть)
        const prevDataHtml = this._renderPreviousStageData(stageNumber);

        // Генерация полей формы
        const request = OnboardingState.get('currentRequest');
        const formData = request?.stageData?.[stageNumber] || {};
        // Step 1: lead_status rendered as pills in banner, not as form field
        const isStep1 = stage.noApproval && stageNumber === 1;
        const fieldsHtml = stage.fields
            .filter(f => !(isStep1 && f.id === 'lead_status'))
            .map(field => this._renderField(field, stageNumber, formData)).join('');

        // Подсказка — выносим в banner над скроллом
        let bannerHintId = '';
        let bannerHintHtml = '';
        if (stageNumber === 3) {
            bannerHintId = 'accountStatusHint';
        } else if (stageNumber === 5) {
            bannerHintId = 'messengerStatusHint';
        } else if (stageNumber === 6) {
            bannerHintId = 'step6Hint';
            bannerHintHtml = 'Заполните данные для создания карточки партнёра';
        }

        const banner = document.getElementById('stepStatusBanner');
        if (banner) {
            const bannerParts = [];
            const canCancel = request && !['cancelled', 'completed', 'declined'].includes(request.status);

            if (isStep1) {
                // Step 1: all 4 pills + hidden input + hint
                const statusField = stage.fields.find(f => f.id === 'lead_status');
                const currentValue = formData?.lead_status || '';
                const pillsHtml = (statusField?.options || []).map(opt => {
                    const activeClass = currentValue === opt.value ? ' active' : '';
                    return `<button class="lead-status-pill${activeClass}" data-action="onboarding-selectLeadStatus" data-value="${Utils.escapeHtml(opt.value)}">${Utils.escapeHtml(opt.label)}</button>`;
                }).join('');

                bannerParts.push(`
                    <div class="lead-status-bar">
                        <span class="lead-status-label">Статус:</span>
                        <div class="lead-status-pills">${pillsHtml}</div>
                    </div>
                    <div class="status-hint" id="leadStatusHint"></div>
                    <input type="hidden" id="field_lead_status" value="${Utils.escapeHtml(currentValue)}">
                `);
            } else if (canCancel && stageNumber > 1) {
                // Steps 2+: all pills as buttons (same flow as Step 1)
                const currentLeadStatus = request?.stageData?.[1]?.lead_status || 'in_conversation';
                const pillsHtml = OnboardingConfig.LEAD_STATUSES
                    .filter(s => s.value === 'in_conversation' || s.value === 'ignored' || s.value === 'refused')
                    .map(opt => {
                        const activeClass = opt.value === currentLeadStatus ? ' active' : '';
                        return `<button class="lead-status-pill${activeClass}" data-action="onboarding-selectLeadStatus" data-value="${Utils.escapeHtml(opt.value)}">${Utils.escapeHtml(opt.label)}</button>`;
                    }).join('');
                bannerParts.push(`
                    <div class="lead-status-bar lead-status-bar--compact">
                        <span class="lead-status-label">Статус лида:</span>
                        <div class="lead-status-pills">${pillsHtml}</div>
                    </div>
                    <div class="status-hint hidden" id="leadStatusHint"></div>
                    <div class="form-group hidden" id="leadRejectReasonGroup">
                        <label class="form-label">Причина отказа *</label>
                        <textarea class="form-textarea" id="field_reject_reason_cancel" rows="2" placeholder="Укажите причину отказа лида..."></textarea>
                    </div>
                    <input type="hidden" id="field_lead_status" value="${Utils.escapeHtml(currentLeadStatus)}">
                `);
            }

            if (bannerHintId) {
                const typeClass = stageNumber === 6 ? ' status-hint--success' : '';
                bannerParts.push(`<div class="status-hint${typeClass}" id="${bannerHintId}">${bannerHintHtml}</div>`);
            }

            if (bannerParts.length > 0) {
                banner.innerHTML = bannerParts.join('');
                banner.classList.remove('hidden');
            } else {
                banner.innerHTML = '';
                banner.classList.add('hidden');
            }
        }

        // История фазовых переходов для Шага 3 и Шага 5
        let historyHtml = '';
        const phaseHistoryStep = (stageNumber === 3 || stageNumber === 5) ? stageNumber : 0;
        if (phaseHistoryStep) {
            const stepHistory = (request?.history || []).filter(h => h.stageNumber === phaseHistoryStep);
            if (stepHistory.length > 0) {
                const items = stepHistory.map(item => OnboardingReview._renderHistoryItem(item)).join('');
                historyHtml = `<details class="step-form-history">
                    <summary class="step-form-history-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>История действий</span>
                        <span class="step-form-history-count">${stepHistory.length}</span>
                    </summary>
                    <div class="step-form-history-content">${items}</div>
                </details>`;
            }
        }

        container.innerHTML = prevDataHtml + `<div class="step-form-fields">${fieldsHtml}</div>` + historyHtml;

        // Заполнить поля существующими данными
        if (Object.keys(formData).length > 0) {
            this.fillFormData(stageNumber, formData);
        }

        // Привязка обработчиков для условной видимости
        this._bindConditionalHandlers(stageNumber);

        // Обновить подсказку и кнопку для шагов с pills
        if (stageNumber === 1 && stage.noApproval) {
            this._updateLeadStatusUI(formData?.lead_status || '');
        } else if (document.getElementById('field_lead_status')) {
            // Steps 2+: initial state (current status active, no cancel mode)
            this._updateLeadStatusUI(document.getElementById('field_lead_status').value);
        }

        // Обновить UI Шага 3 (фазовый workflow)
        if (stageNumber === 3) {
            this._updateAccountUI(formData?.phase || '');
        }

        // Обновить UI Шага 5 (фазовый workflow мессенджера)
        if (stageNumber === 5) {
            this._updateMessengerUI(formData?.phase || '');
        }

        // Обновить UI Шага 6 (финализация карточки)
        if (stageNumber === 6) {
            this._prefillStep6(formData);
            this._updateStep6UI();
        }

        // Динамические поля Шага 2: method_name + условия зависят от ГЕО + method_type
        if (stageNumber === 2) {
            const geoCountry = this._getGeoCountry();
            const methodType = formData?.method_type || '';
            if (geoCountry) {
                if (methodType) {
                    this._updateMethodNameOptions(geoCountry, methodType, formData?.method_name);
                }
                this._updateDealConditions(geoCountry, formData?.method_name ? methodType : '');
                this._updatePrepaymentAmount(geoCountry, methodType, formData?.method_name || '');
            }
        }
    },

    /** Readonly-секция с данными предыдущих шагов (disabled form inputs) */
    _renderPreviousStageData(stageNumber) {
        if (stageNumber <= 1) return '';

        const request = OnboardingState.get('currentRequest');
        if (!request?.stageData) return '';

        let html = '';
        for (let i = 1; i < stageNumber; i++) {
            const data = request.stageData[i];
            if (!data || Object.keys(data).length === 0) continue;

            const prevStage = OnboardingConfig.getStage(i);
            if (!prevStage) continue;

            let fieldsHtml;
            if (i === 4) {
                fieldsHtml = OnboardingReview._renderAntifraudData(request);
            } else if (i === 5) {
                fieldsHtml = OnboardingReview._renderMessengerData(request);
            } else {
                fieldsHtml = (prevStage.fields || [])
                    .map(field => this._renderPrevStageField(field, data, i))
                    .filter(Boolean).join('');
            }

            if (!fieldsHtml) continue;

            html += `
                <div class="prev-stage-section">
                    <div class="prev-stage-label">Шаг ${i}: ${Utils.escapeHtml(prevStage.name)}</div>
                    <div class="step-form-fields step-form-fields--readonly">${fieldsHtml}</div>
                </div>
            `;
        }

        return html;
    },

    /** Рендеринг одного поля предыдущего шага как disabled form input */
    _renderPrevStageField(field, data, stepNumber) {
        if (field.type === 'internal') return '';

        const value = data[field.id];
        if (value == null || value === '') return '';

        if (field.showWhen && !OnboardingConfig.matchesShowWhen(field.showWhen, data)) return '';

        let label = field.label;
        if (field.dynamicDeal) {
            const request = OnboardingState.get('currentRequest');
            const geoCountry = data.geo_country || request?.stageData?.[1]?.geo_country;
            const methodType = data.method_type;
            if (geoCountry && methodType) {
                const conditions = OnboardingConfig.getDealConditions(geoCountry, methodType);
                const cond = conditions.find(c => c.id === field.id);
                if (cond) label = cond.label;
            }
        }

        const escapedLabel = Utils.escapeHtml(label);
        let inputHtml;

        switch (field.type) {
            case 'text':
            case 'email':
            case 'url':
            case 'number':
            case 'date':
                inputHtml = `<input type="text" class="form-input" value="${Utils.escapeHtml(String(value))}" disabled>`;
                break;
            case 'textarea':
                inputHtml = `<textarea class="form-textarea" rows="2" disabled>${Utils.escapeHtml(String(value))}</textarea>`;
                break;
            case 'select': {
                let displayValue = String(value);
                let opt = field.options?.find(o => o.value === value);
                if (!opt && field.dynamic && field.id === 'method_name') {
                    const request = OnboardingState.get('currentRequest');
                    const geoCountry = data.geo_country || request?.stageData?.[1]?.geo_country;
                    const methodType = data.method_type;
                    if (geoCountry && methodType) {
                        const names = OnboardingConfig.getMethodNames(geoCountry, methodType);
                        opt = names.find(o => o.value === value);
                    }
                }
                if (opt) displayValue = opt.label;
                inputHtml = `<input type="text" class="form-input" value="${Utils.escapeHtml(displayValue)}" disabled>`;
                break;
            }
            case 'checkbox':
                inputHtml = `<label class="form-checkbox"><input type="checkbox"${value ? ' checked' : ''} disabled> ${escapedLabel}</label>`;
                return `<div class="form-group">${inputHtml}</div>`;
            case 'file':
                if (String(value).startsWith('data:image/')) {
                    inputHtml = `<img src="${value}" alt="${escapedLabel}" class="review-photo-thumb" data-action="onboarding-openPhoto">`;
                } else {
                    return '';
                }
                break;
            case 'list':
                if (Array.isArray(value) && value.length > 0) {
                    inputHtml = `<div class="list-items">${value.map(v =>
                        `<span class="list-item"><span class="list-item-value">${Utils.escapeHtml(String(v))}</span></span>`
                    ).join('')}</div>`;
                } else {
                    return '';
                }
                break;
            case 'checklist':
                if (typeof value === 'object' && field.items?.length > 0) {
                    const isEnhanced = value.values && typeof value.values === 'object';
                    const vals = isEnhanced ? value.values : value;
                    inputHtml = `<div class="checklist-field">${field.items.map((item, index) => {
                        const checked = vals[index];
                        const icon = checked ? '<span class="checklist-ok">&#10003;</span>' : '<span class="checklist-fail">&#10007;</span>';
                        return `<div class="review-checklist-item">${icon} ${Utils.escapeHtml(item.label || item)}</div>`;
                    }).join('')}</div>`;
                } else {
                    return '';
                }
                break;
            default:
                inputHtml = `<input type="text" class="form-input" value="${Utils.escapeHtml(String(value))}" disabled>`;
        }

        return `
            <div class="form-group">
                <label class="form-label">${escapedLabel}</label>
                ${inputHtml}
            </div>
        `;
    },

    /** Рендеринг одного поля формы */
    _renderField(field, stageNumber, formData) {
        // Пропуск internal полей (управляются программно)
        if (field.type === 'internal') return '';

        const id = `field_${field.id}`;
        const label = Utils.escapeHtml(field.label);
        const placeholder = Utils.escapeHtml(field.placeholder || '');
        const helpText = field.helpText ? `<span class="form-help">${Utils.escapeHtml(field.helpText)}</span>` : '';

        // Определяем required на основе simple + conditional
        const isRequired = field.required || this._isConditionallyRequired(field, formData);
        const required = isRequired ? 'required' : '';

        // showWhen — скрыт по умолчанию если условие не выполнено
        const isHiddenByCondition = field.showWhen && !OnboardingConfig.matchesShowWhen(field.showWhen, formData);
        // dynamicDeal — скрыт по умолчанию (показывается через _updateDealConditions)
        const isHiddenByDeal = field.dynamicDeal && !formData?.[field.id];
        const hiddenClass = (isHiddenByCondition || isHiddenByDeal) ? ' hidden' : '';

        // editableBy — whitelist ролей, которые могут редактировать поле
        const userRole = OnboardingState.get('userRole');
        const isReadonlyField = field.editableBy && !['admin', 'leader'].includes(userRole) &&
            !field.editableBy.some(role => {
                if (role === 'executor') return OnboardingConfig.isExecutor(stageNumber, userRole);
                if (role === 'reviewer') return OnboardingConfig.isReviewer(stageNumber, userRole);
                return role === userRole;
            });

        let inputHtml = '';
        const currentValue = formData?.[field.id];
        const escapedValue = currentValue != null ? Utils.escapeHtml(String(currentValue)) : '';

        switch (field.type) {
            case 'text':
            case 'email':
            case 'url':
            case 'number':
            case 'date':
                inputHtml = `<input type="${field.type}" class="form-input${isReadonlyField ? ' form-input--readonly' : ''}" id="${id}" placeholder="${placeholder}" value="${escapedValue}" ${required}${field.maxLength ? ` maxlength="${field.maxLength}"` : ''}${isReadonlyField ? ' readonly' : ''}>`;
                break;
            case 'textarea':
                inputHtml = `<textarea class="form-textarea${isReadonlyField ? ' form-input--readonly' : ''}" id="${id}" placeholder="${placeholder}" rows="2" ${required}${isReadonlyField ? ' readonly' : ''}>${escapedValue}</textarea>`;
                break;
            case 'select':
                const options = (field.options || []).map(opt => {
                    const selected = currentValue === opt.value ? ' selected' : '';
                    return `<option value="${Utils.escapeHtml(opt.value)}"${selected}>${Utils.escapeHtml(opt.label)}</option>`;
                }).join('');
                const defaultSelected = !currentValue ? ' selected' : '';
                inputHtml = `<select class="form-select" id="${id}" ${required}${isReadonlyField ? ' disabled' : ''}><option value=""${defaultSelected}>Выберите...</option>${options}</select>`;
                break;
            case 'checkbox':
                const checked = currentValue ? ' checked' : '';
                inputHtml = `<label class="form-checkbox"><input type="checkbox" id="${id}"${checked}${isReadonlyField ? ' disabled' : ''}> ${label}</label>`;
                return `<div class="form-group${hiddenClass}" data-field-id="${field.id}">${inputHtml}${helpText}</div>`;
            case 'file':
                inputHtml = this._renderFileField(field, id, required, isReadonlyField);
                break;
            case 'list':
                inputHtml = this._renderListField(field, id, placeholder, isReadonlyField);
                break;
            case 'checklist':
                inputHtml = this._renderChecklistField(field, id, isReadonlyField);
                break;
            case 'readonly':
                inputHtml = this._renderReadonlyField(field, stageNumber);
                return `<div class="form-group${hiddenClass}" data-field-id="${field.id}"><label class="form-label">${label}</label>${inputHtml}${helpText}</div>`;
            default:
                inputHtml = `<input type="text" class="form-input" id="${id}" placeholder="${placeholder}" ${required}>`;
        }

        const requiredMark = (isRequired || field.oneOf) ? ' *' : '';

        return `
            <div class="form-group${hiddenClass}" data-field-id="${field.id}">
                <label class="form-label" for="${id}">${label}${requiredMark}</label>
                ${inputHtml}
                ${helpText}
            </div>
        `;
    },

    /** Рендеринг поля file с превью */
    _renderFileField(field, id, required, disabled) {
        const accept = field.accept ? ` accept="${Utils.escapeHtml(field.accept)}"` : '';
        return `
            <div class="file-field" id="${id}_wrapper">
                <input type="file" class="form-input file-input" id="${id}"${accept} ${required}${disabled ? ' disabled' : ''}>
                <div class="file-preview hidden" id="${id}_preview"></div>
            </div>
        `;
    },

    /** Рендеринг динамического списка */
    _renderListField(field, id, placeholder, disabled) {
        return `
            <div class="list-field" id="${id}">
                <div class="list-items" id="${id}_items"></div>
                <div class="list-add">
                    <input type="text" class="form-input list-input" id="${id}_input" placeholder="${placeholder}"${disabled ? ' disabled' : ''}>
                    <button type="button" class="btn-secondary btn-sm list-add-btn" data-action="onboarding-addListItem" data-value="${field.id}"${disabled ? ' disabled' : ''}>+</button>
                    <span class="list-count" id="${id}_count"></span>
                </div>
            </div>
        `;
    },

    /** Рендеринг чеклиста */
    _renderChecklistField(field, id, disabled) {
        if (!field.items || field.items.length === 0) {
            return `<div class="checklist-empty" id="${id}">Пункты чеклиста будут определены позже</div>`;
        }

        const withComments = !!field.withComments;

        const itemsHtml = field.items.map((item, index) => {
            const label = Utils.escapeHtml(item.label || item);
            const itemClass = withComments ? ' checklist-item--with-comment' : '';
            const commentHtml = withComments
                ? `<input type="text" class="form-input checklist-comment-input" data-checklist-comment="${field.id}" data-index="${index}" placeholder="Комментарий..."${disabled ? ' disabled' : ''}>`
                : '';

            return `
                <div class="checklist-item${itemClass}">
                    <label class="checklist-label">
                        <input type="checkbox" class="checklist-check" data-checklist="${field.id}" data-index="${index}"${disabled ? ' disabled' : ''}>
                        <span>${label}</span>
                    </label>
                    ${commentHtml}
                </div>
            `;
        }).join('');

        return `<div class="checklist-field" id="${id}">${itemsHtml}</div>`;
    },

    /** Рендеринг readonly-поля (данные из другого шага) */
    _renderReadonlyField(field, stageNumber) {
        const request = OnboardingState.get('currentRequest');
        if (!request?.stageData || !field.sourceStage || !field.sourceFields) {
            return '<span class="form-readonly-value">—</span>';
        }

        const sourceData = request.stageData[field.sourceStage];
        if (!sourceData) return '<span class="form-readonly-value">Данные не заполнены</span>';

        const sourceStage = OnboardingConfig.getStage(field.sourceStage);
        const values = field.sourceFields.map(fId => {
            const sourceField = sourceStage?.fields?.find(f => f.id === fId);
            const val = sourceData[fId];
            if (!val) return '';
            if (sourceField?.type === 'select' && sourceField.options) {
                const opt = sourceField.options.find(o => o.value === val);
                return opt ? opt.label : val;
            }
            return val;
        }).filter(Boolean);

        const display = values.length > 0 ? Utils.escapeHtml(values.join(' — ')) : '—';
        return `<span class="form-readonly-value">${display}</span>`;
    },

    /** Обновить options поля method_name по ГЕО + тип метода */
    _updateMethodNameOptions(country, methodType, preserveValue) {
        const select = document.getElementById('field_method_name');
        if (!select) return;

        const options = OnboardingConfig.getMethodNames(country, methodType);
        const currentValue = preserveValue || select.value;

        select.innerHTML = '<option value="">Выберите...</option>' +
            options.map(opt => {
                const selected = currentValue === opt.value ? ' selected' : '';
                return `<option value="${Utils.escapeHtml(opt.value)}"${selected}>${Utils.escapeHtml(opt.label)}</option>`;
            }).join('');
    },

    /** Обновить условия сделки (лейблы + значения) по ГЕО + тип метода */
    _updateDealConditions(country, methodType) {
        const conditions = OnboardingConfig.getDealConditions(country, methodType);
        for (let i = 1; i <= 3; i++) {
            const cond = conditions[i - 1];
            const group = document.querySelector(`[data-field-id="deal_${i}"]`);
            if (!group) continue;

            const label = group.querySelector('.form-label');
            const input = group.querySelector('.form-input');

            if (cond) {
                group.classList.remove('hidden');
                if (label) label.textContent = cond.label;
                if (input) input.value = cond.value;
            } else {
                group.classList.add('hidden');
                if (label) label.textContent = '';
                if (input) input.value = '';
            }
        }

    },

    /** Обновить сумму предоплаты (показывается после выбора method_name) */
    _updatePrepaymentAmount(country, methodType, methodName) {
        const group = document.querySelector('[data-field-id="prepayment_amount"]');
        if (!group) return;

        const input = group.querySelector('.form-input');
        if (methodName) {
            const amount = OnboardingConfig.getPrepaymentAmount(country, methodType);
            group.classList.remove('hidden');
            if (input) input.value = amount;
        } else {
            group.classList.add('hidden');
            if (input) input.value = '';
        }
    },

    /** Получить geo_country из данных Шага 1 */
    _getGeoCountry() {
        const request = OnboardingState.get('currentRequest');
        return request?.stageData?.[1]?.geo_country || '';
    },

    /** Обновить подсказку и кнопку действия по статусу лида */
    _updateLeadStatusUI(value) {
        const hint = document.getElementById('leadStatusHint');
        const btn = document.getElementById('btnSaveDraft');
        const step = OnboardingState.get('currentStep');

        // Sync pills active state
        document.querySelectorAll('.lead-status-pill').forEach(pill => {
            pill.classList.toggle('active', pill.dataset.value === value);
        });

        if (step === 1) {
            // Step 1: full status flow (new → in_conversation → ignored/refused)
            const hints = {
                '': { text: 'Выберите статус лида — он определяет дальнейший путь заявки', type: '' },
                'new': { text: 'Данные сохраняются автоматически. Когда лид ответит — измените статус', type: '' },
                'in_conversation': { text: 'Лид ответил — можно перейти к заполнению полной информации', type: 'success' },
                'ignored': { text: 'Заявка будет закрыта — лид не отвечает', type: 'warning' },
                'refused': { text: 'Заявка будет закрыта. Укажите причину отказа', type: 'warning' }
            };

            const h = hints[value] || hints[''];
            if (hint) {
                hint.className = 'status-hint' + (h.type ? ' status-hint--' + h.type : '');
                hint.textContent = h.text;
            }

            if (btn) {
                if (value === 'in_conversation') {
                    btn.textContent = 'Перейти к Шагу 2 →';
                    btn.className = 'btn btn-primary';
                    btn.classList.remove('hidden');
                } else if (value === 'ignored' || value === 'refused') {
                    btn.textContent = 'Закрыть заявку';
                    btn.className = 'btn btn-danger';
                    btn.classList.remove('hidden');
                } else {
                    btn.classList.add('hidden');
                }
            }
        } else {
            // Steps 2+: cancel mode (ignored/refused) ↔ normal mode
            const isCancel = value === 'ignored' || value === 'refused';

            if (hint) {
                if (isCancel) {
                    const hintText = value === 'ignored'
                        ? 'Заявка будет закрыта — лид не отвечает'
                        : 'Заявка будет закрыта. Укажите причину отказа';
                    hint.className = 'status-hint status-hint--warning';
                    hint.textContent = hintText;
                    hint.classList.remove('hidden');
                } else {
                    hint.classList.add('hidden');
                }
            }

            // Reject reason group
            const rejectGroup = document.getElementById('leadRejectReasonGroup');
            if (rejectGroup) {
                rejectGroup.classList.toggle('hidden', value !== 'refused');
            }

            // Buttons: cancel mode ↔ normal mode
            const btnSubmit = document.getElementById('btnSubmitReview');
            if (isCancel) {
                if (btn) {
                    btn.textContent = 'Закрыть заявку';
                    btn.className = 'btn btn-danger';
                    btn.classList.remove('hidden');
                }
                if (btnSubmit) btnSubmit.classList.add('hidden');
            } else {
                // Restore normal step buttons
                const request = OnboardingState.get('currentRequest');
                OnboardingSteps.updateActionButtons(step, request);
                // Re-apply step-specific UI (restores btnSaveDraft)
                if (step === 3) {
                    this._updateAccountUI(request?.stageData?.[3]?.phase || '');
                } else if (step === 4) {
                    this._updateAntifraudUI(request?.stageData?.[4] || {});
                } else if (step === 5) {
                    this._updateMessengerUI(request?.stageData?.[5]?.phase || '');
                } else if (step === 6) {
                    this._updateStep6UI();
                }
            }
        }
    },

    /** Обновить UI Шага 4 по фазе пополнения */
    _updateAntifraudUI(afData) {
        const btn = document.getElementById('btnSaveDraft');
        if (!btn) return;

        if (afData?.phase === 'approved') {
            btn.textContent = 'Партнёр пополнился';
            btn.className = 'btn btn-primary';
            btn.classList.remove('hidden');
        }
    },

    /** Привязка обработчиков для showWhen */
    _bindConditionalHandlers(stageNumber) {
        const stage = OnboardingConfig.getStage(stageNumber);
        if (!stage?.fields) return;

        // Обработчик статуса лида (all steps with pills)
        const statusEl = document.getElementById('field_lead_status');
        if (statusEl) {
            statusEl.addEventListener('change', () => {
                this._updateLeadStatusUI(statusEl.value);
            });
        }

        // Обработчик method_type → method_name options (Шаг 2)
        if (stageNumber === 2) {
            const methodTypeEl = document.getElementById('field_method_type');
            const methodNameEl = document.getElementById('field_method_name');
            if (methodTypeEl) {
                methodTypeEl.addEventListener('change', () => {
                    const geoCountry = this._getGeoCountry();
                    this._updateMethodNameOptions(geoCountry, methodTypeEl.value);
                    // Сброс условий и предоплаты (метод ещё не выбран после смены типа)
                    this._updateDealConditions(geoCountry, '');
                    this._updatePrepaymentAmount(geoCountry, methodTypeEl.value, '');
                });
            }
            // Обработчик method_name → условия сделки + предоплата
            if (methodNameEl) {
                methodNameEl.addEventListener('change', () => {
                    const geoCountry = this._getGeoCountry();
                    const methodType = methodTypeEl?.value || '';
                    if (methodNameEl.value) {
                        this._updateDealConditions(geoCountry, methodType);
                    } else {
                        this._updateDealConditions(geoCountry, '');
                    }
                    this._updatePrepaymentAmount(geoCountry, methodType, methodNameEl.value);
                });
            }
        }

        // Обработчик account_creator → обновить phase UI (Шаг 3)
        if (stageNumber === 3) {
            const creatorEl = document.getElementById('field_account_creator');
            if (creatorEl) {
                creatorEl.addEventListener('change', () => {
                    this._updateAccountUI('');
                });
            }
        }

        // Для file inputs — превью + сохранение dataUrl
        stage.fields.filter(f => f.type === 'file').forEach(field => {
            const input = document.getElementById(`field_${field.id}`);
            if (!input) return;
            input.addEventListener('change', () => this._handleFilePreview(field.id));
        });

        // Для list inputs — Enter для быстрого добавления
        stage.fields.filter(f => f.type === 'list').forEach(field => {
            const input = document.getElementById(`field_${field.id}_input`);
            if (!input) return;
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addListItem(field.id);
                }
            });
        });

        // showWhen: условная видимость полей
        const conditionalFields = stage.fields.filter(f => f.showWhen);
        if (conditionalFields.length === 0) return;

        const triggerIds = [...new Set(conditionalFields.map(f => f.showWhen.field))];

        for (const triggerId of triggerIds) {
            const triggerEl = document.getElementById(`field_${triggerId}`);
            if (!triggerEl) continue;

            triggerEl.addEventListener('change', () => {
                const currentData = this.collectFormData(stageNumber);
                for (const field of conditionalFields) {
                    if (field.showWhen.field !== triggerId) continue;
                    const group = document.querySelector(`[data-field-id="${field.id}"]`);
                    if (!group) continue;
                    const shouldShow = OnboardingConfig.matchesShowWhen(field.showWhen, currentData);
                    group.classList.toggle('hidden', !shouldShow);
                }
            });
        }
    },

    /** Превью загруженного файла */
    _handleFilePreview(fieldId) {
        const input = document.getElementById(`field_${fieldId}`);
        const preview = document.getElementById(`field_${fieldId}_preview`);
        if (!input || !preview) return;

        const file = input.files?.[0];
        if (!file) {
            preview.classList.add('hidden');
            preview.innerHTML = '';
            return;
        }

        delete this._fileRemovedFlags[fieldId];

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this._fileDataUrls[fieldId] = e.target.result;
                preview.innerHTML = `<img src="${e.target.result}" alt="${Utils.escapeHtml(file.name)}" class="file-preview-img">`;
                preview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = `<span class="file-preview-name">${Utils.escapeHtml(file.name)}</span>`;
            preview.classList.remove('hidden');
        }
    },

    /** Добавить элемент в list-поле */
    addListItem(fieldId) {
        const inputEl = document.getElementById(`field_${fieldId}_input`);
        const itemsEl = document.getElementById(`field_${fieldId}_items`);
        if (!inputEl || !itemsEl) return;

        const value = inputEl.value.trim();
        if (!value) return;

        const index = itemsEl.children.length;
        const itemHtml = `
            <div class="list-item" data-index="${index}">
                <span class="list-item-value" title="${Utils.escapeHtml(value)}">${Utils.escapeHtml(value)}</span>
                <button type="button" class="list-item-remove" data-action="onboarding-removeListItem" data-value="${fieldId}:${index}">&times;</button>
            </div>
        `;
        itemsEl.insertAdjacentHTML('beforeend', itemHtml);
        inputEl.value = '';
        inputEl.focus();
        this._updateListCount(fieldId);
    },

    /** Удалить элемент из list-поля */
    removeListItem(fieldIdIndex) {
        const [fieldId, index] = fieldIdIndex.split(':');
        const itemsEl = document.getElementById(`field_${fieldId}_items`);
        if (!itemsEl) return;

        const item = itemsEl.querySelector(`[data-index="${index}"]`);
        if (item) item.remove();
        this._updateListCount(fieldId);
    },

    /** Обновить счётчик элементов списка */
    _updateListCount(fieldId) {
        const itemsEl = document.getElementById(`field_${fieldId}_items`);
        const countEl = document.getElementById(`field_${fieldId}_count`);
        if (!countEl) return;
        const count = itemsEl ? itemsEl.children.length : 0;
        countEl.textContent = count > 0 ? count : '';
    },

    /** Собрать данные формы текущего шага */
    collectFormData(stageNumber) {
        const stage = OnboardingConfig.getStage(stageNumber);
        if (!stage || !stage.fields) return {};

        const data = {};
        for (const field of stage.fields) {
            if (field.type === 'readonly' || field.type === 'internal') continue;

            if (field.type === 'list') {
                data[field.id] = this._collectListData(field.id);
                continue;
            }

            if (field.type === 'checklist') {
                data[field.id] = this._collectChecklistData(field.id);
                continue;
            }

            if (field.type === 'file') {
                // Явно удалён пользователем
                if (this._fileRemovedFlags[field.id]) {
                    data[field.id] = '';
                } else if (this._fileDataUrls[field.id]) {
                    // Новый файл или восстановленный из stageData
                    data[field.id] = this._fileDataUrls[field.id];
                } else {
                    const request = OnboardingState.get('currentRequest');
                    data[field.id] = request?.stageData?.[stageNumber]?.[field.id] || '';
                }
                continue;
            }

            const el = document.getElementById(`field_${field.id}`);
            if (!el) continue;

            if (field.type === 'checkbox') {
                data[field.id] = el.checked;
            } else {
                data[field.id] = el.value;
            }
        }
        return data;
    },

    /** Собрать данные list-поля */
    _collectListData(fieldId) {
        const itemsEl = document.getElementById(`field_${fieldId}_items`);
        if (!itemsEl) return [];

        return Array.from(itemsEl.querySelectorAll('.list-item-value'))
            .map(el => el.textContent.trim())
            .filter(Boolean);
    },

    /** Собрать данные checklist-поля (поддержка withComments + replies) */
    _collectChecklistData(fieldId) {
        const checks = document.querySelectorAll(`[data-checklist="${fieldId}"]`);
        const values = {};
        checks.forEach(check => {
            values[check.dataset.index] = check.checked;
        });

        // Собрать комментарии (если есть)
        const commentInputs = document.querySelectorAll(`[data-checklist-comment="${fieldId}"]`);
        const comments = {};
        commentInputs.forEach(input => {
            const val = input.value.trim();
            if (val) comments[input.dataset.index] = val;
        });

        // Собрать ответы sales (если есть)
        const replyInputs = document.querySelectorAll(`[data-checklist-reply="${fieldId}"]`);
        const replies = {};
        replyInputs.forEach(input => {
            const val = input.value.trim();
            if (val) replies[input.dataset.index] = val;
        });

        const hasComments = Object.keys(comments).length > 0;
        const hasReplies = Object.keys(replies).length > 0;
        if (!hasComments && !hasReplies && commentInputs.length === 0 && replyInputs.length === 0) return values;

        const result = { values };
        if (hasComments) result.comments = comments;
        if (hasReplies) result.replies = replies;
        return result;
    },

    /** Заполнить форму данными */
    fillFormData(stageNumber, formData) {
        if (!formData) return;
        const stage = OnboardingConfig.getStage(stageNumber);
        if (!stage || !stage.fields) return;

        for (const field of stage.fields) {
            if (field.type === 'readonly' || field.type === 'internal') continue;

            if (field.type === 'list') {
                this._fillListData(field.id, formData[field.id]);
                continue;
            }

            if (field.type === 'checklist') {
                this._fillChecklistData(field.id, formData[field.id], field);
                continue;
            }

            if (field.type === 'file') {
                this._fillFilePreview(field.id, formData[field.id]);
                continue;
            }

            const el = document.getElementById(`field_${field.id}`);
            if (!el || formData[field.id] === undefined) continue;

            if (field.type === 'checkbox') {
                el.checked = !!formData[field.id];
            } else {
                el.value = formData[field.id];
            }
        }

        // Триггерим showWhen после заполнения
        this._updateConditionalVisibility(stageNumber, formData);
    },

    /** Заполнить list-поле данными */
    _fillListData(fieldId, items) {
        if (!Array.isArray(items)) return;
        const itemsEl = document.getElementById(`field_${fieldId}_items`);
        if (!itemsEl) return;

        itemsEl.innerHTML = items.map((value, index) => `
            <div class="list-item" data-index="${index}">
                <span class="list-item-value" title="${Utils.escapeHtml(String(value))}">${Utils.escapeHtml(String(value))}</span>
                <button type="button" class="list-item-remove" data-action="onboarding-removeListItem" data-value="${fieldId}:${index}">&times;</button>
            </div>
        `).join('');
        this._updateListCount(fieldId);
    },

    /** Заполнить checklist данными (поддержка enhanced формата {values, comments, replies}) */
    _fillChecklistData(fieldId, data, field) {
        if (!data || typeof data !== 'object') return;

        // Определяем формат: простой {0: true} или enhanced {values: {}, comments: {}, replies: {}}
        const isEnhanced = data.values && typeof data.values === 'object';
        const values = isEnhanced ? data.values : data;
        const comments = isEnhanced ? (data.comments || {}) : {};
        const replies = isEnhanced ? (data.replies || {}) : {};

        const checks = document.querySelectorAll(`[data-checklist="${fieldId}"]`);
        checks.forEach(check => {
            if (values[check.dataset.index] !== undefined) {
                check.checked = !!values[check.dataset.index];
            }
        });

        // Заполнить комментарии
        const commentInputs = document.querySelectorAll(`[data-checklist-comment="${fieldId}"]`);
        commentInputs.forEach(input => {
            if (comments[input.dataset.index]) {
                input.value = comments[input.dataset.index];
            }
        });

        // Заполнить ответы
        const replyInputs = document.querySelectorAll(`[data-checklist-reply="${fieldId}"]`);
        replyInputs.forEach(input => {
            if (replies[input.dataset.index]) {
                input.value = replies[input.dataset.index];
            }
        });
    },

    /** Показать превью ранее загруженного файла с кнопкой удаления */
    _fillFilePreview(fieldId, dataUrl) {
        if (!dataUrl || !String(dataUrl).startsWith('data:image/')) return;

        const preview = document.getElementById(`field_${fieldId}_preview`);
        if (!preview) return;

        // Сохраняем dataUrl для collectFormData
        this._fileDataUrls[fieldId] = dataUrl;
        delete this._fileRemovedFlags[fieldId];

        preview.innerHTML = `
            <div class="file-preview-existing">
                <img src="${dataUrl}" alt="" class="file-preview-img">
                <button type="button" class="file-preview-remove" data-action="onboarding-removeFile" data-value="${fieldId}" title="Удалить">&times;</button>
            </div>
        `;
        preview.classList.remove('hidden');
    },

    /** Удалить ранее загруженный файл */
    removeFile(fieldId) {
        const preview = document.getElementById(`field_${fieldId}_preview`);
        if (preview) {
            preview.innerHTML = '';
            preview.classList.add('hidden');
        }

        // Сбросить file input
        const input = document.getElementById(`field_${fieldId}`);
        if (input) input.value = '';

        delete this._fileDataUrls[fieldId];
        this._fileRemovedFlags[fieldId] = true;
    },

    /** Обновить видимость условных полей */
    _updateConditionalVisibility(stageNumber, formData) {
        const stage = OnboardingConfig.getStage(stageNumber);
        if (!stage?.fields) return;

        for (const field of stage.fields) {
            if (!field.showWhen) continue;
            const group = document.querySelector(`[data-field-id="${field.id}"]`);
            if (!group) continue;
            const shouldShow = OnboardingConfig.matchesShowWhen(field.showWhen, formData);
            group.classList.toggle('hidden', !shouldShow);
        }
    },

    /** Обновить UI Шага 3 по фазе аккаунта (фазовый workflow) */
    _updateAccountUI(accountStatus) {
        const hint = document.getElementById('accountStatusHint');
        const btn = document.getElementById('btnSaveDraft');
        const userRole = OnboardingState.get('userRole');
        const isExecutor = OnboardingConfig.isExecutor(3, userRole);
        const isReviewer = OnboardingConfig.isReviewer(3, userRole);
        const creatorEl = document.getElementById('field_account_creator');
        const creatorValue = creatorEl?.value || '';

        // Подсказка по фазе
        const hints = {
            '': { text: 'Выберите, кто создаёт аккаунт партнёру', type: '' },
            'waiting': isReviewer
                ? { text: 'Заполните логин и пароль аккаунта партнёра', type: 'success' }
                : { text: 'Ожидаем создание аккаунта ревьюером', type: '' },
            'created': isExecutor
                ? { text: 'Аккаунт создан. Когда партнёр заполнит профиль — нажмите кнопку', type: 'success' }
                : { text: 'Ожидаем заполнение профиля партнёром', type: '' },
            'filled': isReviewer
                ? { text: 'Проверьте чеклист заполнения ЛК партнёра', type: 'success' }
                : { text: 'Ожидает проверки ревьюером', type: 'warning' }
        };

        const h = hints[accountStatus] || hints[''];
        if (hint) {
            hint.className = 'status-hint' + (h.type ? ' status-hint--' + h.type : '');
            hint.textContent = h.text;
        }

        // Кнопка действия по фазе
        if (btn) {
            btn.classList.add('hidden');

            if (!accountStatus && creatorValue === 'reviewer' && isExecutor) {
                btn.textContent = 'Запросить создание аккаунта';
                btn.className = 'btn btn-primary';
                btn.classList.remove('hidden');
            } else if (!accountStatus && creatorValue === 'partner' && isExecutor) {
                btn.textContent = 'Партнёр создаёт аккаунт';
                btn.className = 'btn btn-primary';
                btn.classList.remove('hidden');
            } else if (accountStatus === 'waiting' && isReviewer) {
                btn.textContent = 'Аккаунт создан';
                btn.className = 'btn btn-primary';
                btn.classList.remove('hidden');
            } else if (accountStatus === 'created' && isExecutor) {
                btn.textContent = 'Партнёр заполнил профиль';
                btn.className = 'btn btn-primary';
                btn.classList.remove('hidden');
            }
        }

        // Скрыть выбор creator после начала процесса (уже не актуально)
        if (accountStatus) {
            const creatorGroup = document.querySelector('[data-field-id="account_creator"]');
            if (creatorGroup) creatorGroup.classList.add('hidden');
        }

        // Обновить видимость полей (phase — internal, не имеет DOM)
        this._applyAccountFieldVisibility(accountStatus);

        // Показать замечания ревьюера после reject (Phase 4 → Phase 3)
        if (accountStatus === 'created' && isExecutor) {
            const request = OnboardingState.get('currentRequest');
            const lastReject = request?.history?.filter(h => h.stageNumber === 3 && h.action === 'reject').pop();
            if (lastReject) {
                if (hint && lastReject.comment) {
                    hint.className = 'status-hint status-hint--warning';
                    hint.innerHTML = `<strong>Замечание ревьюера:</strong> ${Utils.escapeHtml(lastReject.comment)}`;
                }
                this._showChecklistReviewerComments(request?.stageData?.[3]?.profile_checklist);
            }
        }
    },

    /** Применить видимость полей Шага 3 по phase (internal поле) */
    _applyAccountFieldVisibility(accountStatus) {
        const stage = OnboardingConfig.getStage(3);
        if (!stage?.fields) return;

        for (const field of stage.fields) {
            if (!field.showWhen || field.showWhen.field !== 'phase') continue;
            const group = document.querySelector(`[data-field-id="${field.id}"]`);
            if (!group) continue;
            const shouldShow = OnboardingConfig.matchesShowWhen(field.showWhen, { phase: accountStatus });
            group.classList.toggle('hidden', !shouldShow);
        }
    },

    /** Обновить UI Шага 5 по статусу мессенджера (фазовый workflow) */
    _updateMessengerUI(messengerStatus) {
        const hint = document.getElementById('messengerStatusHint');
        const btn = document.getElementById('btnSaveDraft');
        const userRole = OnboardingState.get('userRole');
        const isExecutor = OnboardingConfig.isExecutor(5, userRole);
        const isReviewer = OnboardingConfig.isReviewer(5, userRole);

        const hints = {
            '': isExecutor
                ? { text: 'Нажмите кнопку, чтобы запросить создание аккаунта в мессенджере', type: 'success' }
                : { text: 'Ожидаем запроса на создание аккаунта', type: '' },
            'waiting': isReviewer
                ? { text: 'Заполните логин и пароль аккаунта мессенджера', type: 'success' }
                : { text: 'Ожидаем создание аккаунта ревьюером', type: '' },
            'created': isExecutor
                ? { text: 'Передайте данные партнёру и подтвердите вход в мессенджер', type: 'success' }
                : { text: 'Ожидаем подтверждение входа партнёра', type: '' },
            'logged': { text: 'Партнёр подтверждён. Ожидаем проверку', type: 'success' }
        };

        // Revision на фазе logged — показать замечание ревьюера
        const request = OnboardingState.get('currentRequest');
        const isRejected = request?.status === 'revision';

        if (isRejected && messengerStatus === 'logged' && isExecutor) {
            const lastReject = (request.history || []).filter(h => h.stageNumber === 5 && h.action === 'reject').pop();
            if (hint) {
                if (lastReject?.comment) {
                    hint.className = 'status-hint status-hint--warning';
                    hint.innerHTML = `<strong>Замечание ревьюера:</strong> ${Utils.escapeHtml(lastReject.comment)}`;
                } else {
                    hint.className = 'status-hint status-hint--warning';
                    hint.textContent = 'Отклонено ревьюером — исправьте и отправьте повторно';
                }
            }
        } else {
            const h = hints[messengerStatus] || hints[''];
            if (hint) {
                hint.className = 'status-hint' + (h.type ? ' status-hint--' + h.type : '');
                hint.textContent = h.text;
            }
        }

        if (btn) {
            btn.classList.add('hidden');

            if (!messengerStatus && isExecutor) {
                btn.textContent = 'Запросить создание аккаунта';
                btn.className = 'btn btn-primary';
                btn.classList.remove('hidden');
            } else if (messengerStatus === 'waiting' && isReviewer) {
                btn.textContent = 'Аккаунт создан';
                btn.className = 'btn btn-primary';
                btn.classList.remove('hidden');
            } else if (messengerStatus === 'created' && isExecutor) {
                btn.textContent = 'Партнёр зашёл в мессенджер';
                btn.className = 'btn btn-primary';
                btn.classList.remove('hidden');
            }
        }

        this._applyMessengerFieldVisibility(messengerStatus);
    },

    /** Применить видимость полей Шага 5 по phase (internal поле) */
    _applyMessengerFieldVisibility(messengerStatus) {
        const stage = OnboardingConfig.getStage(5);
        if (!stage?.fields) return;

        for (const field of stage.fields) {
            if (!field.showWhen || field.showWhen.field !== 'phase') continue;
            const group = document.querySelector(`[data-field-id="${field.id}"]`);
            if (!group) continue;
            const shouldShow = OnboardingConfig.matchesShowWhen(field.showWhen, { phase: messengerStatus });
            group.classList.toggle('hidden', !shouldShow);
        }
    },

    /** Авто-заполнение полей Шага 6 из предыдущих шагов */
    _prefillStep6(formData) {
        const request = OnboardingState.get('currentRequest');
        if (!request?.stageData) return;

        // subagent ← Step 1 contact_name
        if (!formData.subagent) {
            const name = request.stageData[1]?.contact_name;
            if (name) {
                const el = document.getElementById('field_subagent');
                if (el) el.value = name;
            }
        }

        // method ← Step 2 method_name (resolve label)
        if (!formData.method) {
            const step1 = request.stageData[1] || {};
            const step2 = request.stageData[2] || {};
            const names = OnboardingConfig.getMethodNames(step1.geo_country, step2.method_type);
            const opt = names.find(o => o.value === step2.method_name);
            if (opt) {
                const el = document.getElementById('field_method');
                if (el) el.value = opt.label;
            }
        }
    },

    /** Показать кнопку действия для Шага 6 (финализация карточки) */
    _updateStep6UI() {
        const btn = document.getElementById('btnSaveDraft');
        if (btn) {
            btn.textContent = 'Создать карточку партнёра';
            btn.className = 'btn btn-primary';
            btn.classList.remove('hidden');
        }
    },

    /** Показать историю переписки per-item + поле для ответа sales */
    _showChecklistReviewerComments(checklistData) {
        if (!checklistData) return;
        const isEnhanced = checklistData.values && typeof checklistData.values === 'object';
        if (!isEnhanced) return;

        // Поддержка нового (threads) и legacy (comments/replies) форматов
        let threads = checklistData.threads || {};
        if (Object.keys(threads).length === 0) {
            const comments = checklistData.comments || {};
            const replies = checklistData.replies || {};
            for (const [idx, text] of Object.entries(comments)) {
                if (!threads[idx]) threads[idx] = [];
                threads[idx].push({ role: 'reviewer', text });
            }
            for (const [idx, text] of Object.entries(replies)) {
                if (!threads[idx]) threads[idx] = [];
                threads[idx].push({ role: 'sales', text });
            }
        }

        if (Object.keys(threads).length === 0) return;

        const checks = document.querySelectorAll('[data-checklist="profile_checklist"]');
        checks.forEach(check => {
            const idx = check.dataset.index;
            const thread = threads[idx];
            if (!thread || thread.length === 0) return;
            const item = check.closest('.checklist-item');
            if (!item) return;

            // Вся история переписки
            const threadDiv = document.createElement('div');
            threadDiv.className = 'checklist-thread';
            thread.forEach(msg => {
                const msgDiv = document.createElement('div');
                const isReviewer = msg.role === 'reviewer';
                msgDiv.className = 'thread-msg ' + (isReviewer ? 'thread-msg--reviewer' : 'thread-msg--sales');
                const label = isReviewer ? 'Ревьюер' : 'Sales';
                msgDiv.innerHTML = `<span class="thread-msg-author">${label}:</span> ${Utils.escapeHtml(msg.text)}`;
                threadDiv.appendChild(msgDiv);
            });
            item.appendChild(threadDiv);

            // Поле ответа sales
            const replyInput = document.createElement('input');
            replyInput.type = 'text';
            replyInput.className = 'form-input checklist-reply-input';
            replyInput.dataset.checklistReply = 'profile_checklist';
            replyInput.dataset.index = idx;
            replyInput.placeholder = 'Ваш ответ...';
            item.appendChild(replyInput);
        });
    },

    /** Проверка условной обязательности */
    _isConditionallyRequired(field, formData) {
        if (!field.requiredWhen) return false;
        return formData?.[field.requiredWhen.field] === field.requiredWhen.value;
    },

    /** Валидация обязательных полей */
    validate(stageNumber) {
        const stage = OnboardingConfig.getStage(stageNumber);
        if (!stage || !stage.fields) return true;

        const formData = this.collectFormData(stageNumber);

        // Проверка обычных required полей
        for (const field of stage.fields) {
            if (field.type === 'readonly' || field.type === 'internal') continue;

            // Проверяем видимость — скрытые поля не валидируем
            if (field.showWhen && !OnboardingConfig.matchesShowWhen(field.showWhen, formData)) continue;

            // Определяем обязательность (static + conditional)
            const isRequired = field.required || this._isConditionallyRequired(field, formData);
            if (!isRequired) continue;

            if (field.type === 'list') {
                const items = formData[field.id];
                if (!items || items.length === 0) {
                    Toast.error(`Добавьте хотя бы один элемент в "${field.label}"`);
                    return false;
                }
                continue;
            }

            if (field.type === 'file') {
                const el = document.getElementById(`field_${field.id}`);
                if (!el?.files?.length && !formData[field.id]) {
                    Toast.error(`Загрузите файл "${field.label}"`);
                    return false;
                }
                continue;
            }

            if (field.type === 'checkbox') {
                const el = document.getElementById(`field_${field.id}`);
                if (!el?.checked) {
                    Toast.error(`Поле "${field.label}" обязательно`);
                    el?.focus();
                    return false;
                }
                continue;
            }

            const el = document.getElementById(`field_${field.id}`);
            if (!el) continue;

            if (!el.value.trim()) {
                Toast.error(`Поле "${field.label}" обязательно`);
                el.focus();
                return false;
            }
        }

        // Проверка oneOf групп (хотя бы одно из группы)
        const oneOfGroups = {};
        for (const field of stage.fields) {
            if (!field.oneOf) continue;
            if (!oneOfGroups[field.oneOf]) oneOfGroups[field.oneOf] = [];
            oneOfGroups[field.oneOf].push(field);
        }

        for (const [groupId, fields] of Object.entries(oneOfGroups)) {
            const hasValue = fields.some(field => {
                const val = formData[field.id];
                return val && String(val).trim();
            });

            if (!hasValue) {
                const labels = fields.map(f => `"${f.label}"`).join(' или ');
                Toast.error(`Заполните хотя бы одно из полей: ${labels}`);
                const firstEl = document.getElementById(`field_${fields[0].id}`);
                firstEl?.focus();
                return false;
            }
        }

        return true;
    }
};
