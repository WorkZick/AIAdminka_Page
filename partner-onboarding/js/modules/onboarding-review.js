/**
 * OnboardingReview — UI проверки (reviewer)
 * Readonly-вид данных шага, история проверок, одобрение/отклонение
 * Поддерживает: field-level errors, checklist, list, file, readonly display
 */

const OnboardingReview = {
    /** Рендеринг данных шага в readonly-режиме */
    renderReviewData(stageNumber, stageData) {
        const container = document.getElementById('reviewData');
        if (!container) return;

        const stage = OnboardingConfig.getStage(stageNumber);
        if (!stage) return;

        const data = stageData?.[stageNumber];

        // Если нет данных — показываем заглушку
        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = `
                <div class="step-form-placeholder">
                    <p>Данные для этого шага ещё не заполнены</p>
                </div>
            `;
            return;
        }

        // Если есть поля в конфиге — рендерить как disabled form inputs
        if (stage.fields && stage.fields.length > 0) {
            const fieldsHtml = stage.fields
                .filter(f => f.type !== 'readonly' && f.type !== 'internal')
                .map(field => OnboardingForm._renderPrevStageField(field, data, stageNumber))
                .filter(Boolean)
                .join('');
            container.innerHTML = `<div class="step-form-fields step-form-fields--readonly">${fieldsHtml}</div>`;
            return;
        }

        // Без конфига — показать raw data как disabled inputs
        const fieldsHtml = Object.entries(data).map(([key, value]) => `
            <div class="form-group">
                <label class="form-label">${Utils.escapeHtml(key)}</label>
                <input type="text" class="form-input" value="${Utils.escapeHtml(String(value))}" disabled>
            </div>
        `).join('');

        container.innerHTML = `<div class="step-form-fields step-form-fields--readonly">${fieldsHtml}</div>`;
    },

    /** Рендеринг одного поля в review-режиме */
    _renderReviewField(field, data) {
        // Пропуск internal полей
        if (field.type === 'internal') return '';

        const value = data[field.id];

        // Скрытые поля (showWhen не выполнено) — не показываем
        if (field.showWhen && !OnboardingConfig.matchesShowWhen(field.showWhen, data)) return '';

        if (value == null || value === '') return '';

        let displayValue;

        switch (field.type) {
            case 'select': {
                let opt = null;
                if (field.options && field.options.length > 0) {
                    opt = field.options.find(o => o.value === value);
                }
                // Dynamic selects (e.g. method_name) — resolve from config
                if (!opt && field.dynamic && field.id === 'method_name') {
                    const req = OnboardingState.get('currentRequest');
                    const geoCountry = data.geo_country || req?.stageData?.[1]?.geo_country;
                    const methodType = data.method_type;
                    if (geoCountry && methodType) {
                        const names = OnboardingConfig.getMethodNames(geoCountry, methodType);
                        opt = names.find(o => o.value === value);
                    }
                }
                displayValue = opt ? Utils.escapeHtml(opt.label) : Utils.escapeHtml(String(value));
                break;
            }
            case 'list':
                if (Array.isArray(value) && value.length > 0) {
                    displayValue = value.map(v => `<span class="review-list-item">${Utils.escapeHtml(String(v))}</span>`).join('');
                } else {
                    return '';
                }
                break;
            case 'checklist':
                if (typeof value === 'object' && field.items?.length > 0) {
                    // Поддержка enhanced формата {values, threads}
                    const isEnhanced = value.values && typeof value.values === 'object';
                    const values = isEnhanced ? value.values : value;
                    const threads = isEnhanced ? (value.threads || {}) : {};

                    displayValue = field.items.map((item, index) => {
                        const checked = values[index];
                        const icon = checked ? '<span class="checklist-ok">&#10003;</span>' : '<span class="checklist-fail">&#10007;</span>';
                        const label = Utils.escapeHtml(item.label || item);
                        const thread = threads[index] || [];
                        const threadHtml = thread.length > 0
                            ? '<div class="checklist-thread">' + thread.map(msg => {
                                const isReviewer = msg.role === 'reviewer';
                                const cls = isReviewer ? 'thread-msg--reviewer' : 'thread-msg--sales';
                                const authorLabel = isReviewer ? 'Ревьюер' : 'Sales';
                                return `<div class="thread-msg ${cls}"><span class="thread-msg-author">${authorLabel}:</span> ${Utils.escapeHtml(msg.text)}</div>`;
                            }).join('') + '</div>'
                            : '';
                        return `<div class="review-checklist-item">${icon} ${label}${threadHtml}</div>`;
                    }).join('');
                } else {
                    return '';
                }
                break;
            case 'file':
                if (value && String(value).startsWith('data:image/')) {
                    displayValue = `<img src="${value}" alt="${Utils.escapeHtml(field.label)}" class="review-photo-thumb" data-action="onboarding-openPhoto">`;
                } else {
                    displayValue = value ? Utils.escapeHtml(String(value)) : '—';
                }
                break;
            case 'checkbox':
                displayValue = value ? 'Да' : 'Нет';
                break;
            default:
                displayValue = Utils.escapeHtml(String(value));
        }

        // Resolve dynamic deal labels from config (e.g. "Условие 1" → "Пополнения")
        let label = field.label;
        if (field.dynamicDeal) {
            const req = OnboardingState.get('currentRequest');
            const geoCountry = data.geo_country || req?.stageData?.[1]?.geo_country;
            const methodType = data.method_type;
            if (geoCountry && methodType) {
                const conditions = OnboardingConfig.getDealConditions(geoCountry, methodType);
                const cond = conditions.find(c => c.id === field.id);
                if (cond) label = cond.label;
            }
        }

        return `
            <div class="review-field" data-field-id="${field.id}">
                <span class="review-field-label">${Utils.escapeHtml(label)}</span>
                <span class="review-field-value">${displayValue}</span>
            </div>
        `;
    },

    /** Форматирование значения для отображения */
    _formatValue(value) {
        if (value == null || value === '') return '—';
        if (Array.isArray(value)) {
            return value.map(v => Utils.escapeHtml(String(v))).join(', ');
        }
        if (typeof value === 'object') {
            return Utils.escapeHtml(JSON.stringify(value));
        }
        return Utils.escapeHtml(String(value));
    },

    /** Рендеринг истории проверок */
    renderHistory(history) {
        const container = document.getElementById('reviewHistory');
        if (!container) return;

        if (!history || history.length === 0) {
            container.innerHTML = '';
            return;
        }

        const itemsHtml = history.map(item => this._renderHistoryItem(item)).join('');

        container.innerHTML = `
            <details class="review-history-collapsible">
                <summary class="review-history-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>История проверок</span>
                    <span class="review-history-count">${history.length}</span>
                </summary>
                <div class="review-history-content">${itemsHtml}</div>
            </details>
        `;
    },

    /** Рендеринг одного элемента истории */
    _renderHistoryItem(item) {
        const actionData = OnboardingConfig.getHistoryAction(item.action);
        let iconClass, icon, actionText;

        if (item.action === 'rollback') {
            iconClass = actionData.iconClass;
            icon = actionData.icon;
            const targetStage = OnboardingConfig.getStage(item.rollbackTo);
            actionText = `Откат на Шаг ${item.rollbackTo}${targetStage ? ': ' + Utils.escapeHtml(targetStage.shortName || targetStage.name) : ''}`;
        } else if (actionData) {
            iconClass = actionData.iconClass;
            icon = actionData.icon;
            actionText = actionData.label;
        } else {
            iconClass = 'rejected';
            icon = '&#10007;';
            actionText = 'Отклонено';
        }

        const stageName = Utils.escapeHtml(item.stageName || `Шаг ${item.stageNumber}`);
        const actor = Utils.escapeHtml(item.actorEmail || '');
        const date = item.timestamp ? Utils.formatDate(item.timestamp) : '';
        const comment = item.comment ? ` — ${Utils.escapeHtml(item.comment)}` : '';

        // Внутренний комментарий (Step 4 Антифрод) — только для reviewer/admin/leader
        let internalHtml = '';
        if (item.internalComment) {
            const userRole = OnboardingState.get('userRole');
            const canSeeInternal = OnboardingConfig.isReviewer(4, userRole);
            if (canSeeInternal) {
                internalHtml = `<div class="af-reason af-reason--internal af-reason--spaced"><span class="af-reason-label">Внутр.:</span> ${Utils.escapeHtml(item.internalComment)}</div>`;
            }
        }

        return `
            <div class="review-history-item">
                <span class="review-history-icon ${iconClass}">${icon}</span>
                <span>${stageName}: ${actionText} (${actor}, ${date})${comment}</span>
                ${internalHtml}
            </div>
        `;
    },

    /** Рендеринг детального вида заявки */
    renderDetail(request) {
        if (!request) return;

        const detailTitle = document.getElementById('detailTitle');
        const detailId = document.getElementById('detailId');
        const detailStatus = document.getElementById('detailStatus');
        const detailSubtitle = document.getElementById('detailSubtitle');

        if (detailTitle) detailTitle.textContent = request.title || 'Заявка';
        if (detailId) detailId.textContent = '#' + (request.id || '');
        if (detailStatus) {
            // Show who has the task (executor/reviewer) instead of generic status
            if (request.status === 'executor' || request.status === 'revision') {
                detailStatus.textContent = 'У исполнителя';
                detailStatus.className = 'status-badge status-badge--executor';
            } else if (request.status === 'reviewer') {
                detailStatus.textContent = 'У ревьюера';
                detailStatus.className = 'status-badge status-badge--reviewer';
            } else {
                detailStatus.textContent = OnboardingConfig.getStatusLabel(request.status);
                detailStatus.className = 'status-badge ' + OnboardingConfig.getStatusClass(request.status);
            }
        }

        // Subtitle: assignee · step X/Y · date
        if (detailSubtitle) {
            const parts = [];
            if (request.assigneeName) parts.push(Utils.escapeHtml(request.assigneeName));
            if (request.status !== 'completed' && request.status !== 'cancelled') {
                parts.push(`Шаг ${request.currentStageNumber}/${OnboardingConfig.totalStages}`);
            }
            if (request.createdDate) parts.push(Utils.formatDate(request.createdDate));
            detailSubtitle.innerHTML = parts.join('<span class="dot-sep">·</span>');
        }

        // Определить completedSteps для steps indicator
        const completedSteps = [];
        for (const stage of OnboardingConfig.stages) {
            if (stage.number < request.currentStageNumber) {
                completedSteps.push(stage.number);
            }
        }
        if (request.status === 'completed') {
            completedSteps.push(request.currentStageNumber);
        }

        // Steps indicator (все шаги кликабельны для навигации)
        const detailStep = OnboardingState.get('detailStep') || request.currentStageNumber;
        OnboardingSteps.render('detailSteps', detailStep, completedSteps);
        this.renderDetailStep(request, detailStep);

        // Detail actions (role-based)
        this._updateDetailActions(request);
    },

    /** Рендеринг контента ОДНОГО шага в детальном виде */
    renderDetailStep(request, stepNumber) {
        const container = document.getElementById('detailStepContent');
        if (!container || !request) return;

        const stage = OnboardingConfig.getStage(stepNumber);
        if (!stage) return;

        const data = request.stageData?.[stepNumber];
        const isCompleted = stepNumber < request.currentStageNumber ||
            (request.status === 'completed' && stepNumber === request.currentStageNumber);
        const isCurrent = stepNumber === request.currentStageNumber && request.status !== 'completed';
        const isEmpty = !data || Object.keys(data).length === 0;

        // Sub-status banner
        this._updateDetailBanner(request, stepNumber, isCurrent);

        let html = '';

        // Collapsible sections for previous steps' data
        html += this._renderPrevStepsForDetail(request, stepNumber);

        // Status badge (current step status уже в шапке карточки — не дублируем)
        let statusHtml = '';
        if (isCompleted) {
            statusHtml = '<span class="detail-stage-status detail-stage-status--completed">&#10003;</span>';
        } else if (!isCurrent) {
            statusHtml = '<span class="detail-stage-status detail-stage-status--pending">Ожидает</span>';
        }

        // Cancel info (backward-compatible: from history + stageData)
        const cancelInfo = this._getCancelInfo(request);
        const isCancelStep = cancelInfo && cancelInfo.stageNumber === stepNumber;

        let fieldsHtml = '';

        // Cancel step: show ONLY the cancel reason, no form fields
        if (isCancelStep) {
            if (cancelInfo.reason) {
                fieldsHtml = `
                    <div class="form-group form-group--fullwidth">
                        <label class="form-label">Причина отказа</label>
                        <textarea class="form-textarea" rows="2" disabled>${Utils.escapeHtml(cancelInfo.reason)}</textarea>
                    </div>
                `;
            }
        } else {
            // Fields content
            // Skip profile_checklist in readonly review when editable checklist will be shown (Step 3 Phase 4)
            const skipChecklist = isCurrent && stepNumber === 3 && request.status === 'reviewer' &&
                data?.phase === 'filled' && OnboardingConfig.isReviewer(stepNumber, OnboardingState.get('userRole'));

            // For Step 1: suppress reject_reason if cancel was from another step (old data compat)
            let renderData = data;
            if (cancelInfo && stepNumber === 1 && cancelInfo.stageNumber !== 1 && data?.reject_reason) {
                renderData = { ...data };
                delete renderData.reject_reason;
            }

            if (stepNumber === 4) {
                fieldsHtml = this._renderAntifraudData(request);
            } else if (stepNumber === 5) {
                fieldsHtml = this._renderMessengerData(request);
            } else if (!isEmpty && stage.fields && stage.fields.length > 0) {
                fieldsHtml = stage.fields
                    .filter(f => !(skipChecklist && f.id === 'profile_checklist'))
                    .map(field => OnboardingForm._renderPrevStageField(field, renderData, stepNumber))
                    .filter(Boolean).join('');
            } else if (!isEmpty) {
                fieldsHtml = Object.entries(renderData).map(([key, value]) => `
                    <div class="form-group">
                        <label class="form-label">${Utils.escapeHtml(key)}</label>
                        <input type="text" class="form-input" value="${Utils.escapeHtml(String(value))}" disabled>
                    </div>
                `).join('');
            }
        }

        // Пустая секция для не-reviewer на текущем шаге: скрыть
        const hideEmptySection = !fieldsHtml && isCurrent &&
            !OnboardingConfig.isReviewer(stepNumber, OnboardingState.get('userRole'));

        if (!hideEmptySection) {
            html += `
                <div class="detail-stage-section${isCurrent ? ' detail-stage-section--current' : ''}">
                    <div class="detail-stage-header">
                        <span class="detail-stage-title">Шаг ${stepNumber}: ${Utils.escapeHtml(stage.name)}</span>
                        ${statusHtml}
                    </div>
                    ${fieldsHtml
                        ? `<div class="step-form-fields step-form-fields--readonly">${fieldsHtml}</div>`
                        : `<div class="step-form-placeholder"><p>${isEmpty ? 'Данные ещё не заполнены' : ''}</p></div>`
                    }
                </div>
            `;
        }

        // Step 4: Антифрод — специальный рендеринг по ролям
        if (stepNumber === 4) {
            html += this._renderAntifraudSection(request, isCurrent);
        }

        // Step 3 Phase 4: editable checklist + comment для reviewer
        if (isCurrent && stepNumber === 3 && request.status === 'reviewer') {
            const accountStatus = request.stageData?.[3]?.phase;
            const userRole = OnboardingState.get('userRole');
            if (accountStatus === 'filled' && OnboardingConfig.isReviewer(stepNumber, userRole)) {
                html += this._renderEditableChecklist(request.stageData[3]);
                html += `
                    <div class="review-comment-section">
                        <label class="form-label">Комментарий</label>
                        <textarea class="form-textarea" id="detailReviewComment" rows="2" placeholder="Комментарий к проверке..."></textarea>
                    </div>
                `;
            }
        }
        // Review comment (for reviewer of current step, only on current step)
        // Skip Step 4 — handled by _renderAntifraudSection
        else if (isCurrent && stepNumber !== 4) {
            const userRole = OnboardingState.get('userRole');
            if (request.status === 'reviewer' && !stage.noApproval &&
                OnboardingConfig.isReviewer(stepNumber, userRole)) {
                html += `
                    <div class="review-comment-section">
                        <label class="form-label">Комментарий</label>
                        <textarea class="form-textarea" id="detailReviewComment" rows="2" placeholder="Комментарий к проверке..."></textarea>
                    </div>
                `;
            }
        }

        // History for this step only
        const stepHistory = (request.history || []).filter(h => h.stageNumber === stepNumber);
        if (stepHistory.length > 0) {
            const historyHtml = stepHistory.map(item => this._renderHistoryItem(item)).join('');
            html += `
                <details class="review-history-collapsible">
                    <summary class="review-history-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>История</span>
                        <span class="review-history-count">${stepHistory.length}</span>
                    </summary>
                    <div class="review-history-content">${historyHtml}</div>
                </details>`;
        }

        container.innerHTML = html;
    },

    /** Editable checklist для Фазы 4 Шага 3 (reviewer проверяет в detail view) */
    _renderEditableChecklist(stageData) {
        const stage = OnboardingConfig.getStage(3);
        const checklistField = stage?.fields?.find(f => f.id === 'profile_checklist');
        if (!checklistField?.items?.length) return '';

        const existing = stageData?.profile_checklist;
        const isEnhanced = existing?.values && typeof existing.values === 'object';
        const values = isEnhanced ? existing.values : (existing || {});
        const threads = isEnhanced ? (existing.threads || {}) : {};

        const itemsHtml = checklistField.items.map((item, index) => {
            const checked = values[index] ? ' checked' : '';
            const thread = threads[index] || [];

            // Полная история переписки
            const threadHtml = thread.length > 0
                ? '<div class="checklist-thread">' + thread.map(msg => {
                    const isReviewer = msg.role === 'reviewer';
                    const cls = isReviewer ? 'thread-msg--reviewer' : 'thread-msg--sales';
                    const label = isReviewer ? 'Ревьюер' : 'Sales';
                    return `<div class="thread-msg ${cls}"><span class="thread-msg-author">${label}:</span> ${Utils.escapeHtml(msg.text)}</div>`;
                }).join('') + '</div>'
                : '';

            return `
                <div class="checklist-item checklist-item--with-comment">
                    <label class="checklist-label">
                        <input type="checkbox" class="checklist-check" data-index="${index}"${checked}>
                        <span>${Utils.escapeHtml(item.label || item)}</span>
                    </label>
                    ${threadHtml}
                    <input type="text" class="form-input checklist-comment-input" data-index="${index}" placeholder="Комментарий...">
                </div>
            `;
        }).join('');

        return `
            <div class="detail-editable-checklist" id="detailEditableChecklist">
                <div class="form-label">Чеклист заполнения ЛК</div>
                ${itemsHtml}
            </div>
        `;
    },

    /** Рендеринг данных антифрода (Шаг 4) — только причины отказа (статусы в pill-баннере) */
    _renderAntifraudData(request) {
        const afData = request.stageData?.[4] || {};
        if (Object.keys(afData).length === 0) return '';

        const userRole = OnboardingState.get('userRole');
        const isReviewer = OnboardingConfig.isReviewer(4, userRole);
        let fields = '';

        // Причины отказа (фаза и статус вынесены в pill-баннер)
        if (request.status === 'declined') {
            if (afData.af_public_reason) {
                fields += `
                    <div class="form-group form-group--fullwidth">
                        <label class="form-label">Причина отказа</label>
                        <input type="text" class="form-input" value="${Utils.escapeHtml(afData.af_public_reason)}" disabled>
                    </div>
                `;
            }
            if (afData.af_internal_reason && isReviewer) {
                fields += `
                    <div class="form-group form-group--fullwidth">
                        <label class="form-label">Внутренний комментарий</label>
                        <input type="text" class="form-input" value="${Utils.escapeHtml(afData.af_internal_reason)}" disabled>
                    </div>
                `;
            }
        }

        return fields;
    },

    /** Рендеринг данных мессенджера (Шаг 5) — только логин/пароль (фаза в pill-баннере) */
    _renderMessengerData(request) {
        const msgData = request.stageData?.[5] || {};
        if (Object.keys(msgData).length === 0) return '';

        let fields = '';

        // Логин (статус phase вынесен в pill-баннер)
        if (msgData.messenger_login) {
            fields += `
                <div class="form-group">
                    <label class="form-label">Логин</label>
                    <input type="text" class="form-input" value="${Utils.escapeHtml(msgData.messenger_login)}" disabled>
                </div>
            `;
        }

        // Пароль
        if (msgData.messenger_password) {
            fields += `
                <div class="form-group">
                    <label class="form-label">Пароль</label>
                    <input type="text" class="form-input" value="${Utils.escapeHtml(msgData.messenger_password)}" disabled>
                </div>
            `;
        }

        return fields;
    },

    /** Рендеринг секции Антифрод (Шаг 4) — интерактивные элементы (комментарии reviewer) */
    _renderAntifraudSection(request, isCurrent) {
        const userRole = OnboardingState.get('userRole');
        const isReviewer = OnboardingConfig.isReviewer(4, userRole);
        const afData = request.stageData?.[4] || {};
        const phase = afData.phase;
        let html = '';

        // Phase deposit_ok: reviewer comment field
        if (isCurrent && phase === 'deposit_ok' && request.status === 'reviewer' && isReviewer) {
            html += `
                <div class="review-comment-section">
                    <label class="form-label">Комментарий</label>
                    <textarea class="form-textarea" id="detailReviewComment" rows="2" placeholder="Комментарий к проверке пополнения..."></textarea>
                </div>
            `;
        }
        // Phase 1: pending antifraud review → reviewer comment fields
        else if (isCurrent && request.status === 'reviewer' && (!phase || phase === 'check') && isReviewer) {
            html += `
                <div class="review-comment-section">
                    <label class="form-label">Комментарий для sales (публичный)</label>
                    <textarea class="form-textarea" id="detailReviewComment" rows="2" placeholder="Причина отказа, видна sales менеджеру..."></textarea>
                </div>
                <div class="review-comment-section">
                    <label class="form-label">Внутренний комментарий (не виден sales)</label>
                    <textarea class="form-textarea" id="reviewInternalComment" rows="2" placeholder="Внутренняя заметка для команды..."></textarea>
                </div>
            `;
        }

        return html;
    },

    /** Извлечь информацию об отмене из истории (backward-compatible) */
    _getCancelInfo(request) {
        if (request.status !== 'cancelled') return null;
        const history = request.history || [];
        for (let i = history.length - 1; i >= 0; i--) {
            const entry = history[i];
            if (!entry.comment) continue;
            const c = entry.comment;
            if (c.startsWith('Отказ лида:') || c.startsWith('Отказ:') ||
                c === 'Игнор лида' || c === 'Игнор') {
                let reason = null;
                if (c.startsWith('Отказ лида: ')) reason = c.substring('Отказ лида: '.length);
                else if (c.startsWith('Отказ: ')) reason = c.substring('Отказ: '.length);
                // New format: cancel_reason in stageData
                if (!reason) reason = request.stageData?.[entry.stageNumber]?.cancel_reason || null;
                // Old format: reject_reason in stageData[1]
                if (!reason && entry.stageNumber !== 1) reason = request.stageData?.[1]?.reject_reason || null;
                return { stageNumber: entry.stageNumber, reason };
            }
        }
        return null;
    },

    /** Один актуальный статус заявки — фактический, одинаковый для всех ролей */
    _getCurrentStatusPill(request) {
        const step = request.currentStageNumber;
        const status = request.status;

        if (status === 'completed') return { text: 'Завершено', type: 'success' };
        if (status === 'cancelled') return { text: 'Отменено', type: 'warning' };
        if (status === 'declined') return { text: 'Отклонено', type: 'warning' };
        if (status === 'revision') return { text: 'Требуются исправления', type: 'warning' };

        // Step 3: Аккаунт
        if (step === 3) {
            const phase = request.stageData?.[3]?.phase;
            if (phase === 'filled' && status === 'reviewer') {
                return { text: 'Проверка заполнения ЛК', type: '' };
            }
            if (phase) {
                return { text: OnboardingConfig.getPhaseLabel(3, phase), type: phase === 'waiting' ? '' : 'success' };
            }
        }

        // Step 4: Антифрод + пополнение
        if (step === 4) {
            const phase = request.stageData?.[4]?.phase;

            if (phase === 'deposit_ok' && status === 'reviewer') return { text: 'Проверка пополнения', type: '' };
            if (phase === 'deposit_ok') return { text: OnboardingConfig.getPhaseLabel(4, 'deposit_ok'), type: 'success' };
            if (phase === 'approved') return { text: OnboardingConfig.getPhaseLabel(4, 'approved'), type: '' };
            if (phase === 'check') return { text: OnboardingConfig.getPhaseLabel(4, 'check'), type: '' };
            if (status === 'reviewer') return { text: 'Ожидание проверки антифрода', type: '' };
        }

        // Step 5: Мессенджер
        if (step === 5) {
            const phase = request.stageData?.[5]?.phase;
            if (phase === 'logged' && status === 'reviewer') {
                return { text: 'Проверка входа партнёра', type: '' };
            }
            if (phase) {
                return { text: OnboardingConfig.getPhaseLabel(5, phase), type: phase === 'waiting' ? '' : 'success' };
            }
        }

        // Шаги без фаз
        if (status === 'reviewer') return { text: 'На проверке', type: '' };

        return null;
    },

    /** Обновить sub-status banner в detail view — индикатор владельца + lead status pills */
    _updateDetailBanner(request, stepNumber, isCurrent) {
        const banner = document.getElementById('detailStatusBanner');
        if (!banner) return;

        const canCancel = request && !['cancelled', 'completed', 'declined'].includes(request.status);
        const userEmail = OnboardingState.get('userEmail');
        const isOwner = request.createdBy === userEmail || request.assigneeEmail === userEmail;

        // Non-owner or terminal status: show only workflow status pill
        if (!canCancel || !isOwner) {
            const pill = this._getCurrentStatusPill(request);
            if (pill) {
                const cls = pill.type ? ` status-hint--${pill.type}` : '';
                banner.innerHTML = `<span class="status-hint${cls}">${Utils.escapeHtml(pill.text)}</span>`;
                banner.classList.remove('hidden');
            } else {
                banner.innerHTML = '';
                banner.classList.add('hidden');
            }
            return;
        }

        // Owner of active request: lead pills (who has the task shown in header badge)
        const currentLeadStatus = request?.stageData?.[1]?.lead_status || 'in_conversation';
        const pills = OnboardingConfig.LEAD_STATUSES
            .filter(s => s.value === 'in_conversation' || s.value === 'ignored' || s.value === 'refused')
            .map(opt => {
                const activeClass = opt.value === currentLeadStatus ? ' active' : '';
                return `<button class="lead-status-pill${activeClass}" data-action="onboarding-selectLeadStatus" data-value="${Utils.escapeHtml(opt.value)}">${Utils.escapeHtml(opt.label)}</button>`;
            }).join('');

        // "На проверке" indicator when request is with reviewer
        const reviewBadge = request.status === 'reviewer'
            ? '<span class="lead-status-review-badge">На проверке</span>'
            : '';

        banner.innerHTML = `
            <div class="lead-status-bar lead-status-bar--compact">
                <span class="lead-status-label">Статус лида:</span>
                <div class="lead-status-pills">${pills}</div>
                ${reviewBadge}
            </div>
            <div class="status-hint hidden" id="detailLeadHint"></div>
            <div class="form-group hidden" id="detailLeadRejectGroup">
                <label class="form-label">Причина отказа *</label>
                <textarea class="form-textarea" id="detailRejectReason" rows="2" placeholder="Укажите причину отказа лида..."></textarea>
            </div>
            <button class="btn btn-danger hidden" id="detailBtnCancelLead" data-action="onboarding-cancelViaLeadStatus">Закрыть заявку</button>
            <input type="hidden" id="detailLeadStatus" value="${Utils.escapeHtml(currentLeadStatus)}">
        `;
        banner.classList.remove('hidden');

        // Bind change event for detail view pills
        const statusEl = document.getElementById('detailLeadStatus');
        if (statusEl) {
            statusEl.addEventListener('change', () => {
                this._updateDetailLeadPills(statusEl.value);
            });
        }
    },

    /** Обновить UI pills в detail view */
    _updateDetailLeadPills(value) {
        // Sync pills active state
        document.querySelectorAll('#detailStatusBanner .lead-status-pill').forEach(pill => {
            pill.classList.toggle('active', pill.dataset.value === value);
        });

        const isCancel = value === 'ignored' || value === 'refused';
        const hint = document.getElementById('detailLeadHint');
        const rejectGroup = document.getElementById('detailLeadRejectGroup');
        const cancelBtn = document.getElementById('detailBtnCancelLead');

        if (hint) {
            if (isCancel) {
                hint.textContent = value === 'ignored'
                    ? 'Заявка будет закрыта — лид не отвечает'
                    : 'Заявка будет закрыта. Укажите причину отказа';
                hint.className = 'status-hint status-hint--warning';
                hint.classList.remove('hidden');
            } else {
                hint.classList.add('hidden');
            }
        }

        if (rejectGroup) {
            rejectGroup.classList.toggle('hidden', value !== 'refused');
        }

        if (cancelBtn) {
            cancelBtn.classList.toggle('hidden', !isCancel);
        }
    },

    /** Предыдущие шаги для детального вида (disabled form inputs) */
    _renderPrevStepsForDetail(request, currentStep) {
        if (currentStep <= 1) return '';
        if (!request?.stageData) return '';

        const cancelInfo = this._getCancelInfo(request);
        let html = '';
        for (let i = 1; i < currentStep; i++) {
            let data = request.stageData[i];
            if (!data || Object.keys(data).length === 0) continue;

            const prevStage = OnboardingConfig.getStage(i);
            if (!prevStage) continue;

            const isCancelStep = cancelInfo && cancelInfo.stageNumber === i;

            let fieldsHtml;

            // Cancel step: show ONLY the cancel reason, no form fields
            if (isCancelStep) {
                fieldsHtml = cancelInfo.reason
                    ? `<div class="form-group form-group--fullwidth">
                           <label class="form-label">Причина отказа</label>
                           <textarea class="form-textarea" rows="2" disabled>${Utils.escapeHtml(cancelInfo.reason)}</textarea>
                       </div>`
                    : '';
            } else {
                // Step 1: suppress reject_reason if cancel was from another step
                if (cancelInfo && i === 1 && cancelInfo.stageNumber !== 1 && data.reject_reason) {
                    data = { ...data };
                    delete data.reject_reason;
                }

                if (i === 4) {
                    fieldsHtml = this._renderAntifraudData(request);
                } else if (i === 5) {
                    fieldsHtml = this._renderMessengerData(request);
                } else {
                    fieldsHtml = (prevStage.fields || [])
                        .map(field => OnboardingForm._renderPrevStageField(field, data, i))
                        .filter(Boolean).join('');
                }
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

    /** Обновить кнопки действий в детальном виде */
    _updateDetailActions(request) {
        const userRole = OnboardingState.get('userRole');
        const userEmail = OnboardingState.get('userEmail');
        const stage = OnboardingConfig.getStage(request.currentStageNumber);

        const btnReject = document.getElementById('detailBtnReject');
        const btnApprove = document.getElementById('detailBtnApprove');
        const btnWithdraw = document.getElementById('detailBtnWithdraw');
        const btnCancel = document.getElementById('detailBtnCancel');
        const btnReactivate = document.getElementById('detailBtnReactivate');
        const btnReassign = document.getElementById('detailBtnReassign');
        const rollbackGroup = document.getElementById('detailRollbackGroup');

        // Hide all by default
        [btnReject, btnApprove, btnWithdraw, btnCancel, btnReactivate, btnReassign].forEach(btn => btn?.classList.add('hidden'));
        rollbackGroup?.classList.add('hidden');

        // Cancelled → show reactivate (admin/leader or request owner)
        if (request.status === 'cancelled') {
            const isOwner = request.createdBy === userEmail || request.assigneeEmail === userEmail;
            if (userRole === 'admin' || userRole === 'leader' || isOwner) {
                btnReactivate?.classList.remove('hidden');
            }
            return;
        }

        if (request.status === 'completed') return;

        // Reassign (admin/leader for any active request)
        if (userRole === 'admin' || userRole === 'leader') {
            btnReassign?.classList.remove('hidden');
            btnCancel?.classList.remove('hidden');
        }

        // Withdraw (executor can pull back from reviewer status)
        const isOwner = request.createdBy === userEmail || request.assigneeEmail === userEmail;
        if (request.status === 'reviewer' && isOwner) {
            btnWithdraw?.classList.remove('hidden');
        }

        // Reviewer: approve/reject (only when status=reviewer, not noApproval)
        if (request.status === 'reviewer' && stage) {
            const isReviewer = OnboardingConfig.isReviewer(request.currentStageNumber, userRole);
            if (isReviewer) {
                const isStep3 = request.currentStageNumber === 3;
                const isAutoSubmit = stage.autoSubmit;
                const accountStatus = request.stageData?.[3]?.phase;
                const showReviewBtns = isAutoSubmit
                    ? true
                    : (isStep3 ? accountStatus === 'filled' : !stage.noApproval);
                if (showReviewBtns) {
                    btnReject?.classList.remove('hidden');
                    btnApprove?.classList.remove('hidden');
                }
            }
        }

        // Rollback select: reviewer/admin/leader может откатить на предыдущий шаг
        if (request.currentStageNumber > 1 && rollbackGroup) {
            const canRollback = userRole === 'admin' || userRole === 'leader' ||
                (stage && OnboardingConfig.isReviewer(request.currentStageNumber, userRole));
            if (canRollback) {
                const rollbackSelect = document.getElementById('rollbackStepSelect');
                if (rollbackSelect) {
                    rollbackSelect.innerHTML = '<option value="">Откатить на шаг...</option>';
                    for (let i = 1; i < request.currentStageNumber; i++) {
                        const s = OnboardingConfig.getStage(i);
                        if (s && !s.auto) {
                            const opt = document.createElement('option');
                            opt.value = i;
                            opt.textContent = `Шаг ${i}: ${s.shortName || s.name}`;
                            rollbackSelect.appendChild(opt);
                        }
                    }
                    if (rollbackSelect.options.length > 1) {
                        rollbackGroup.classList.remove('hidden');
                    }
                }
            }
        }
    }
};
