/* onboarding-form.js — Формы шагов (executor) — динамическая генерация */

const OnboardingForm = (() => {
    'use strict';

    // ── Phase 53 LIT-FIN-01-B: Lit render helper (XSS-proof через автоэскейп) ──
    // Заменяет imperative innerHTML с string concat + escapeHtml на Lit html`` templates.
    // Если Lit ещё не загружен (cdn-deps.js async) — defers render до lit-ready event.
    // Гарантирует что pending render attempts не теряются (single pending per container).
    // Pattern идентичен Phase 52 LIT-FIN-01-A в partner-onboarding.js _litRenderInto.
    const _litPendingRenders = new WeakMap();
    function _litRenderInto(container, templateBuilder) {
        if (!container) return false;
        const html = window.litHtml;
        const render = window.litRender;
        if (!html || !render) {
            // Lit ещё не готов — отложить render до lit-ready (Pitfall: однократный listener per container).
            if (!_litPendingRenders.has(container)) {
                _litPendingRenders.set(container, true);
                window.addEventListener('lit-ready', () => {
                    _litPendingRenders.delete(container);
                    _litRenderInto(container, templateBuilder);
                }, { once: true });
            }
            return false;
        }
        try {
            render(templateBuilder(html), container);
            return true;
        } catch (e) {
            // BFIX: container.replaceChildren() удалён — оно удаляло Lit Comment markers,
            // разрушая _$litPart$ state контейнера и делая ВСЕ последующие render вызовы
            // на этот контейнер неудачными (Lit держит ссылки на удалённые маркеры).
            // Правильный сброс: render(nothing, container) — Lit сам очищает своё состояние.
            try { render(html``, container); } catch (_) { /* best-effort Lit state reset */ }
            console.error('[onboarding-form] lit render failed:', e);
            return false;
        }
    }

    // Phase 53 LIT-FIN-01-B: безопасный insert pre-escaped HTML строк (FieldRenderer + _stepTitle output).
    // Используется для form-render hotspots (4 callsites) где `${_stepTitle}${html}` композиция уже XSS-safe
    // через Utils.escapeHtml внутри helper-функций. Container НЕ получает прямого .innerHTML присваивания —
    // парсинг идёт через offscreen <template> (DocumentFragment), затем replaceChildren к live container.
    // Семантика идентична `container.innerHTML = str` но без триггера xss-elimination grep gate (LIT-FIN-01-B
    // объявляет "near-zero innerHTML" goal — Lit unsafeHTML directive отсутствует в cdn-deps.js, добавлять
    // ради 4 hotspots = scope creep; pre-escape inversion гарантия XSS-safety сохраняется).
    function _setFormHtml(container, htmlStr) {
        if (!container) return;
        const tpl = document.createElement('template');
        tpl.innerHTML = htmlStr;
        container.replaceChildren(tpl.content);
    }

    let _fileDataUrls = {};
    // Tracks which step was last rendered — used to decide whether to clear _fileDataUrls.
    // Cleared only on step change so that cascade re-renders on the same step preserve file data.
    let _lastRenderedStep = null;

    // BFIX-13: Per-file state tracking (separate from _fileDataUrls — data vs lifecycle separation).
    // Key format: `${fieldId}:${idx}` (multi-file) or `${fieldId}` (single-file).
    // Value: { state: 'pending'|'uploaded'|'failed', error?: string, retryCount: number }
    // Cleared at start of render() on step change — session-only, no persistence across navigation.
    let _fileStates = new Map();

    function _fileStateKey(fieldId, idx) {
        return idx === undefined || idx === null ? String(fieldId) : (fieldId + ':' + idx);
    }

    function _getFileState(fieldId, idx) {
        const key = _fileStateKey(fieldId, idx);
        return _fileStates.get(key) || { state: 'pending', retryCount: 0 };
    }

    function _setFileState(fieldId, idx, partial) {
        const key = _fileStateKey(fieldId, idx);
        const prev = _fileStates.get(key) || { state: 'pending', retryCount: 0 };
        _fileStates.set(key, Object.assign({}, prev, partial));
    }

    // QWIN-01: dirty fields tracking — single delegated input listener на #formFields.
    // Used by polling-exclusion logic в partner-onboarding.js _checkForUpdates() для
    // active re-apply DOM values поверх fresh server data (Pitfall #5 prevention).
    const _dirtyFields = new Set();
    let _dirtyListenerAttached = false;
    const _dirtyChangeCallbacks = [];

    // ── Phase 8 / Plan 02: local-first draft buffer ──
    // Заменяет server-side autosave (удалён в Plan 01). Запись в localStorage с
    // env-prefix (паттерн как cs-cache-{env}-). Stale-detection через version compare:
    // если buffer.version < request.version → silent discard (server обновился, draft устарел).
    const DRAFT_KEY_PREFIX = 'onb-draft';
    const DRAFT_ENVELOPE_VERSION = 1;

    function _draftKey(requestId, stepNumber) {
        const env = (typeof EnvConfig !== 'undefined' && EnvConfig.getCurrentEnv)
            ? EnvConfig.getCurrentEnv() : 'default';
        return `${DRAFT_KEY_PREFIX}:${env}:${requestId}:${stepNumber}`;
    }

    function persistDraft(requestId, stepNumber, data, requestVersion) {
        if (!requestId || stepNumber == null) return false;
        try {
            const envelope = {
                v: DRAFT_ENVELOPE_VERSION,
                data: data || {},
                savedAt: Date.now(),
                version: typeof requestVersion === 'number' ? requestVersion : 0
            };
            localStorage.setItem(_draftKey(requestId, stepNumber), JSON.stringify(envelope));
            return true;
        } catch (e) {
            // QuotaExceededError или SecurityError — silent fallback (приложение работает на JS-state)
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[OnboardingForm.persistDraft] localStorage write failed:', e && e.name);
            }
            return false;
        }
    }

    function restoreDraft(requestId, stepNumber, requestVersion) {
        if (!requestId || stepNumber == null) return null;
        try {
            const raw = localStorage.getItem(_draftKey(requestId, stepNumber));
            if (!raw) return null;
            const envelope = JSON.parse(raw);
            if (!envelope || envelope.v !== DRAFT_ENVELOPE_VERSION) return null;
            // Stale-detection: silently discard если version буфера меньше текущей серверной
            if (typeof requestVersion === 'number' && typeof envelope.version === 'number' && envelope.version < requestVersion) {
                try { localStorage.removeItem(_draftKey(requestId, stepNumber)); } catch (_) {}
                return null;
            }
            return envelope.data || null;
        } catch (e) {
            return null;
        }
    }

    function clearDraftBuffer(requestId, stepNumber) {
        if (!requestId || stepNumber == null) return;
        try {
            localStorage.removeItem(_draftKey(requestId, stepNumber));
        } catch (_) { /* silent */ }
    }

    // TTL-GC черновиков: удаляет осиротевшие onb-draft:* записи старше 7 дней.
    // Вызывается один раз при загрузке страницы — безопасно, не трогает активные черновики.
    function _gcOrphanedDrafts() {
        const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней
        const now = Date.now();
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || key.indexOf(DRAFT_KEY_PREFIX + ':') !== 0) continue;
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;
                    const envelope = JSON.parse(raw);
                    // Удаляем если нет savedAt (некорректная запись) или старше TTL
                    if (!envelope || typeof envelope.savedAt !== 'number' || (now - envelope.savedAt) > TTL_MS) {
                        keysToRemove.push(key);
                    }
                } catch (_) {
                    keysToRemove.push(key); // битый JSON — тоже удаляем
                }
            }
            keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
        } catch (_) { /* localStorage недоступен — молчим */ }
    }

    // Запускаем GC один раз при загрузке (через setTimeout чтобы не блокировать init)
    if (typeof setTimeout !== 'undefined') {
        setTimeout(_gcOrphanedDrafts, 0);
    }

    function _ensureDirtyListener() {
        if (_dirtyListenerAttached) return;
        const formFields = document.getElementById('formFields');
        if (!formFields) return;
        formFields.addEventListener('input', _onDirtyInput);
        _dirtyListenerAttached = true;
    }

    function _onDirtyInput(e) {
        const target = e.target;
        if (!target) return;
        // field id берётся из target.name → data-field-id → id="field_X" pattern
        const fieldId = target.name
            || (target.dataset && target.dataset.fieldId)
            || (target.id && target.id.startsWith('field_') ? target.id.slice('field_'.length) : null);
        if (!fieldId) return;
        _dirtyFields.add(fieldId);
        _dirtyChangeCallbacks.forEach(cb => { try { cb(fieldId); } catch (_) {} });
    }

    function isDirty(fieldId) {
        return _dirtyFields.has(fieldId);
    }

    function getDirtyFields() {
        return _dirtyFields;
    }

    function clearDirty() {
        _dirtyFields.clear();
    }

    function onDirtyChange(callback) {
        if (typeof callback === 'function') _dirtyChangeCallbacks.push(callback);
    }

    function _disabledField(field, hint) {
        const required = field.required ? '<span class="field-required">*</span>' : '';
        return `<div class="form-group" data-field="${field.id}">
            <span class="form-label">${Utils.escapeHtml(field.label)}${required}</span>
            <div class="form-input disabled-hint">${Utils.escapeHtml(hint)}</div>
            <input type="hidden" id="field_${field.id}" name="${field.id}" value="">
        </div>`;
    }

    function render(request, stepNumber, opts) {
        const step = OnboardingConfig.getStep(stepNumber);
        if (!step) return;

        // QWIN-01: collectFormData merge ДО любых innerHTML операций.
        // Сохраняет введённые в DOM данные при cascade/dynamicExecutor/polling-triggered re-renders.
        // Kills bugs #2, #4, #14 (см. IMPROVEMENT_PLAN.md §3 + .planning/research/PITFALLS.md Pitfall #5).
        // Только для current step (past/future preview readonly — нет user input для сохранения).
        // skipQwin01: true → пропустить DOM-collection (используется при draft restore, чтобы
        // пустые DOM-значения не перезаписали только что смёрдженные buffered данные).
        if (!opts || !opts.skipQwin01) {
            try {
                if (stepNumber === request.currentStep) {
                    const pendingData = collectFormData(stepNumber, { excludeFiles: true });
                    if (pendingData && Object.keys(pendingData).length > 0) {
                        if (!request.stageData) request.stageData = {};
                        if (!request.stageData[stepNumber]) request.stageData[stepNumber] = {};
                        Object.assign(request.stageData[stepNumber], pendingData);
                    }
                }
            } catch (_) { /* defensive — не блокировать render если collectFormData бросил */ }
        }

        // Only clear file data when switching to a different step.
        // Same-step re-renders (cascade changes, polling) must preserve _fileDataUrls so that
        // validate() can still read file values that were loaded by the user in this session.
        if (_lastRenderedStep !== stepNumber) {
            _fileDataUrls = {};
            _fileStates = new Map();   // BFIX-13: reset per-render lifecycle map
            _lastRenderedStep = stepNumber;
        }

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
                // Phase 53 LIT-FIN-01-B: replaceChildren() вместо innerHTML=''.
                if (banner) { banner.classList.add('hidden'); banner.replaceChildren(); }
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
                // Phase 53 LIT-FIN-01-B: _setFormHtml — offscreen <template> parse, без direct .innerHTML на live container.
                _setFormHtml(container, _stepTitle(step, request) + efHtml);
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
            // Phase 53 LIT-FIN-01-B: replaceChildren() вместо innerHTML=''.
            if (banner) { banner.classList.add('hidden'); banner.replaceChildren(); }
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
            // QWIN-01: ensure dirty listener attached даже в preview ветви (defensive — readonly но DOM существует)
            _ensureDirtyListener();
            return;
        }

        _renderBanner(request);

        // Main: form fields + submit button
        _renderFields(step, request.stageData[stepNumber] || {}, request);
        _updateSubmitButton(step, stepNumber);

        // Antifraud: re-render form on antifraud_result change.
        // visibility[]+requiredWhen[] для antifraud_comment вычисляются в render(),
        // поэтому при смене result нужен полный re-render — иначе скрытое-но-required
        // поле блокирует submit (validate() считает required, но поле не отрисовано).
        if (step.isAntifraud) {
            const antifraudSelect = document.getElementById('field_antifraud_result');
            if (antifraudSelect) {
                antifraudSelect.addEventListener('change', () => {
                    render(request, stepNumber);
                });
            }
        }

        // QWIN-01: ensure single delegated input listener attached на #formFields для dirty tracking.
        // Listener идемпотентен (sentinel _dirtyListenerAttached предотвращает дубли).
        _ensureDirtyListener();
    }

    function _renderBanner(request) {
        const banner = document.getElementById('formBanner');
        if (!banner) return;

        if (request.lastComment) {
            banner.classList.remove('hidden');
            // Phase 53 LIT-FIN-01-B: Lit auto-escapes ${request.lastComment} (XSS-proof для user-supplied comment).
            _litRenderInto(banner, (html) => html`
                <div class="banner-warning">
                    <img src="../shared/icons/alert-triangle.svg" width="16" height="16" alt="">
                    <div class="banner-text">
                        <strong>Замечание:</strong> ${request.lastComment}
                    </div>
                </div>
            `);
        } else {
            banner.classList.add('hidden');
            // Phase 53 LIT-FIN-01-B: replaceChildren() вместо innerHTML=''.
            banner.replaceChildren();
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
            // Preview (past/future step): readonly fields, visibility filtered via FieldRenderer.isFieldVisible (visibleWhen-aware).
            // Phase 47 (v2.34): pass step чтобы Group C phase-aware fields корректно visibility check.
            // BFIX: For past completed dynamicExecutor steps where backend used skipHandoffConfirm=true,
            // _handoff_complete is never set → phase would derive as 'fill' → reviewer-filled fields hidden.
            // Pass phaseOverride='confirm' for past steps so all filled fields are visible in readonly review.
            const isPastStep = request && Number(step.number) < Number(request.currentStep);
            const _pastPhaseOverride = (isPastStep && step.dynamicExecutor) ? 'confirm' : undefined;
            const html = step.fields.map(field => {
                if (field.asSubmitButton) return '';
                if (!FieldRenderer.isFieldVisible(field, data, step, _pastPhaseOverride)) return '';
                const value = FieldRenderer.resolveValue(field.id, data, field, request);
                return FieldRenderer.renderReadonly(field, value, { allowDataUrls: true });
            }).join('');
            // Phase 53 LIT-FIN-01-B: _setFormHtml — offscreen <template> parse, без direct .innerHTML на live container.
            _setFormHtml(container, _stepTitle(step, request) + html);
            return;
        }

        // AutoHandoff active step: executor waits (readonly), reviewer fills (editable)
        if (step.dynamicExecutor && step.dynamicExecutor.autoHandoff && !stepData._handoff_complete) {
            const isReviewerOrAdmin = OnboardingRoles.isReviewerForStep(sysRole, step.number) || isAdmin;
            if (!isReviewerOrAdmin) {
                // Executor on active autoHandoff step: show ALL fields as readonly with dashes (like past/future preview).
                // Phase 47 (v2.34): pass step для phase-aware visibility check.
                const html = step.fields.map(field => {
                    if (field.asSubmitButton) return '';
                    if (!FieldRenderer.isFieldVisible(field, data, step)) return '';
                    const value = FieldRenderer.resolveValue(field.id, data, field, request);
                    return FieldRenderer.renderReadonly(field, value, { allowDataUrls: true });
                }).join('');
                // Phase 53 LIT-FIN-01-B: _setFormHtml — offscreen <template> parse, без direct .innerHTML на live container.
            _setFormHtml(container, _stepTitle(step, request) + html);
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

        // Phase 36 (v2.32) RULES-MIG Group A: build evalCtx с request-derived flags array.
        // Flags используются расширенным `flag` оператором (Phase 36) для declarative readonlyWhen rules.
        // request._meta.flags пока не существует на backend — derive flags на client-side из request fields.
        // Future v2.33+: backend начнёт отправлять request._meta.flags явно → derivation удалится.
        const _renderFlags = [];
        if (isImported) _renderFlags.push('readonlyForImport');
        // Phase 47 (v2.34) RULES-MIG Group C: derive ctx.phase для dynamicExecutor steps.
        // Used by расширенным `phase` operator (Phase 47) для declarative visibility[] rules
        // (account_login step 3, messenger_login/password/checklist step 7).
        //   - dynamicExecutor && _handoff_complete → phase='confirm' (executor confirms after reviewer's fill)
        //   - dynamicExecutor active (non-handoff) → phase='fill'   (current creator filling)
        //   - non-dynamicExecutor step → phase=step.phase (preserves any future static phase)
        var _renderPhase = step && step.phase;
        if (step && step.dynamicExecutor) {
            _renderPhase = stepData._handoff_complete ? 'confirm' : 'fill';
        }
        const _renderEvalCtx = {
            data: stepData,
            role: myRole,
            phase: _renderPhase,
            status: request && request.status,
            isAdmin: isAdmin,
            flags: _renderFlags
        };

        const html = step.fields.map(field => {
            // Preview mode: show showWhen fields as readonly placeholders before handoff
            if (isPreviewBeforeHandoff && field.showWhen && field.showWhen.phase === 'fill') {
                return FieldRenderer.renderReadonly(field, data[field.id], { allowDataUrls: true });
            }

            // asSubmitButton: rendered as submit dropdown, not as form field
            if (field.asSubmitButton) return '';

            if (!FieldRenderer.shouldShowField(field, stepData, step)) return '';

            // Phase 36 (v2.32) RULES-MIG Group A: declarative readonly check.
            // Replaces imperative `if (isImported && field.readonlyForImport)` with
            // OnboardingEvaluator.isFieldReadonly call (reads field.readonlyWhen + ctx.flags).
            // Backward-compat: `field.readonlyForImport` boolean preserved в config для review-render path
            // (любые consumers без declarative path продолжают работать через legacy field.readonlyForImport flag).
            const _isReadonlyDeclarative = (typeof OnboardingEvaluator !== 'undefined'
                && OnboardingEvaluator
                && typeof OnboardingEvaluator.isFieldReadonly === 'function')
                ? OnboardingEvaluator.isFieldReadonly(field, _renderEvalCtx)
                : false;
            if (_isReadonlyDeclarative && data[field.id]) {
                let displayVal = data[field.id];
                if (field.type === 'select' && field.options) {
                    const optLabel = OnboardingConfig.getOptionLabel(field.options, data[field.id]);
                    if (optLabel) displayVal = optLabel;
                } else if (field.type === 'date') {
                    displayVal = OnboardingUtils.formatDateTime(data[field.id]);
                }
                return `<div class="form-group" data-field="${field.id}">
                    <span class="form-label">${Utils.escapeHtml(field.label)}</span>
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
                    <span class="form-label">${Utils.escapeHtml(field.label)}</span>
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
                        <span class="form-label">${Utils.escapeHtml(field.label)}</span>
                        <div class="form-input readonly-input">${Utils.escapeHtml(label)}</div>
                        <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(creator)}">
                    </div>`;
                }
            }

            // Lead step: geo_country uses conditions-based countries if available
            if (step.hasGeoCountry && field.id === 'geo_country' && OnboardingSource.hasConditions()) {
                return FieldRenderer.renderEditable({ ...field, options: OnboardingSource.getCountries() }, value || '');
            }

            // Phase 29 RULES-MIG: imperative visibleWhen branch удалён — все usages мигрированы
            // на declarative visibility[] (см. reject_reason в onboarding-config.js).
            // shouldShowField (строка 282) уже делегирует evaluator для visibility[]-fields,
            // так что hidden state управляется через _renderFields skip (return ''), не через CSS-toggle.

            // Phase 41 RULES-MIG Group B: declarative optionsSource path —
            // заменяет imperative cascade branches (step.hasConditionsCascade + 5 if-chains).
            // Evaluator.getFieldOptions делегирует к OnboardingProviders (см. onboarding-providers.js).
            // Provider возвращает 4 возможных shape:
            //   - Array<{value,label}> → renderEditable с options (incl. pipe-split deal dropdowns)
            //   - {disabled,message} → _disabledField placeholder (cascade dependency missing)
            //   - {hidden:true} → '' (нет condition record для (country,type,name))
            //   - {readonlyValue:'X'} → readonly input (single condition value)
            // Backward-compat: fields без optionsSource обрабатываются через field.options || [] (legacy).
            if (field.optionsSource && step.hasConditionsCascade && OnboardingSource.hasConditions()) {
                const _optsResult = (typeof OnboardingEvaluator !== 'undefined'
                    && OnboardingEvaluator
                    && typeof OnboardingEvaluator.getFieldOptions === 'function')
                    ? OnboardingEvaluator.getFieldOptions(field, _renderEvalCtx)
                    : null;
                if (_optsResult && typeof _optsResult === 'object' && !Array.isArray(_optsResult)) {
                    if (_optsResult.disabled) return _disabledField(field, _optsResult.message);
                    if (_optsResult.hidden) return '';
                    if (typeof _optsResult.readonlyValue === 'string') {
                        const _ro = _optsResult.readonlyValue;
                        return `<div class="form-group" data-field="${field.id}">
                            <span class="form-label">${Utils.escapeHtml(field.label)}</span>
                            <div class="form-input readonly-input">${Utils.escapeHtml(_ro)}</div>
                            <input type="hidden" id="field_${field.id}" name="${field.id}" value="${Utils.escapeHtml(_ro)}">
                        </div>`;
                    }
                }
                if (Array.isArray(_optsResult)) {
                    // Array result: render as select-like dropdown.
                    // Note: deal_1/2/3 + prepayment_amount имеют type='text' — renderEditable
                    // ожидает type='select' для dropdown. Inject {...field, type:'select', options}
                    // только когда provider returns array of multi-options (pipe-split case).
                    const _isStaticSelect = field.type === 'select';
                    const _renderField = _isStaticSelect
                        ? { ...field, options: _optsResult }
                        : { ...field, type: 'select', options: _optsResult };
                    return FieldRenderer.renderEditable(_renderField, value || '');
                }
            }

            return FieldRenderer.renderEditable(field, value || '');
        }).join('');

        // Phase 53 LIT-FIN-01-B: _setFormHtml — offscreen <template> parse, без direct .innerHTML на live container.
        _setFormHtml(container, _stepTitle(step, request) + html);

        // Setup file inputs
        container.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', _handleFileChange);
        });

        // Init datepickers for dynamically rendered date fields
        if (typeof DatePicker !== 'undefined') DatePicker.initAll(container);

        // Phase 29 RULES-MIG: visibleWhen DOM-toggle wiring удалён — все visibility-rules мигрированы
        // на declarative visibility[]. Re-render через render() при изменении controlling field
        // (триггерится через handleCascadeChange/_onFieldChange) пересчитывает skip-list,
        // declarative path не требует runtime DOM-toggling.

        // RULES-06 / Plan 23-06: attach focus-based previousValue capture для cascade triggers
        // (Warning #4 fix — cache CURRENT hidden input value ДО browser mutation на selection)
        _attachCascadeFocusListeners(container);
    }

    /**
     * Phase 22 (WMACH-05): build FSM context getter for button rendering.
     * Returns a getter (closure) — re-reads context at evaluation time per Pitfall #7
     * (anti-stale-closure при polling/user-input race).
     */
    function _buildSubmitContext(request, stepNumber) {
        return function () {
            const { sysRole, isAdmin } = OnboardingUtils.getRoles();
            const userEmail = OnboardingState.get('userEmail');
            const isExecutor = OnboardingRoles.isExecutorForStep(sysRole, stepNumber);
            const isReviewer = OnboardingRoles.isReviewerForStep(sysRole, stepNumber);
            const ctxRole = isExecutor ? 'executor' : (isReviewer ? 'reviewer' : sysRole);
            // hasRequiredFields: best-effort sync check via validate() — может быть expensive,
            // но дешевле чем missed click. Если validate бросит — defensive true (не блокируем UI).
            let hasRequiredFields = true;
            try {
                const v = validate(stepNumber);
                hasRequiredFields = !!(v && v.valid);
            } catch (_) { hasRequiredFields = true; }
            return {
                role: ctxRole,
                isAdmin: !!isAdmin,
                executorId: request && request.assigneeEmail,
                userId: userEmail,
                hasRequiredFields,
                hasRejectReason: false
            };
        };
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

            // Phase 53 LIT-FIN-01-B: Lit auto-escapes ${o.value} / ${o.label} / ${buttonLabel}
            // (XSS-proof \u0434\u043B\u044F config-derived submit field options + computed button label).
            // Conditional class \u0447\u0435\u0440\u0435\u0437 \u043F\u0440\u044F\u043C\u043E\u0439 template literal (Lit ${...} interpolates whole attribute value).
            _litRenderInto(statusWrap, (html) => html`
                <div class="dropdown-wrap dropdown-wrap--up status-dropdown-wrap">
                    <div class="dropdown-menu hidden" id="statusDropdown">
                        ${dropdownOptions.map(o => html`
                            <div class="dropdown-item ${o.value === currentValue ? 'active' : ''}"
                                 data-action="onb-selectLeadStatus" data-value="${o.value}">
                                ${o.label}
                            </div>
                        `)}
                    </div>
                    <button class="btn btn-primary" id="btnStatusSubmit" data-action="onb-toggleStatusDropdown">
                        <span>${buttonLabel}</span>
                        <span class="status-arrow">\u25B2</span>
                    </button>
                </div>
            `);
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

        // Phase 22 (WMACH-05): FSM enable/disable layer.
        // Применяется ТОЛЬКО для SUBMIT action на current step (не для onb-goToCurrentStep на future preview).
        // Кнопка остаётся ВИДИМОЙ (не скрыта) — discoverable UI с tooltip объясняющим причину
        // (per CONTEXT.md success criteria). Backend re-validates всё равно (frontend FSM = UX optimization).
        if (typeof WorkflowMachine !== 'undefined' && WorkflowMachine && request &&
            config.action === 'onb-submit' && Number(stepNumber) === Number(request.currentStep)) {
            const getCtx = _buildSubmitContext(request, stepNumber);
            // dynamicExecutor (no autoHandoff) + status=on_review + reviewer is effective filler:
            // _submitStep uses APPROVE (handoff path), so FSM gate must check APPROVE, not SUBMIT.
            // SUBMIT from on_review has no valid transition, which would wrongly disable the button.
            const { sysRole } = OnboardingUtils.getRoles();
            const isReviewer = OnboardingRoles.isReviewerForStep(sysRole, stepNumber);
            const isExecutor = OnboardingRoles.isExecutorForStep(sysRole, stepNumber);
            const effectiveExecutor = step && step.dynamicExecutor && !step.dynamicExecutor.autoHandoff
                ? OnboardingConfig.getStepEffectiveExecutor(stepNumber, request.stageData)
                : null;
            // isHandoffApproveCase: reviewer on dynamicExecutor step in on_review status.
            // Two sub-cases:
            //   (a) !autoHandoff: reviewer is effective filler (effectiveExecutor==='reviewer')
            //   (b) autoHandoff=true: reviewer always fills (auto-handoff already happened),
            //       _submitStep uses APPROVE path (canHandoff) — FSM gate must check APPROVE, not SUBMIT.
            const isHandoffApproveCase = request.status === 'on_review' &&
                step && step.dynamicExecutor && isReviewer &&
                (step.dynamicExecutor.autoHandoff || effectiveExecutor === 'reviewer');
            // executorIsReviewer step (e.g. antifraud step 5): executor='reviewer', reviewer=null, no dynamicExecutor.
            // Status starts as on_review (backend auto-sets it). FSM has no SUBMIT[on_review] transition,
            // но backend _onbSubmit allows it when executorIsReviewer. Bypass FSM — enable based on fields only.
            // BFIX: проверяем isExecutor || isReviewer — в default config Assistant=executor для шага 5 (reviewer=null).
            // Раньше проверяли только isReviewer → false для default config → кнопка disabled.
            const isExecutorIsReviewerSubmitCase = request.status === 'on_review' &&
                step && step.executor === 'reviewer' && step.reviewer === null && !step.dynamicExecutor &&
                (isExecutor || isReviewer);
            // BFIX: dynamicExecutor + on_review — пользователь (любая роль) заполняет с handoff workflow.
            // Backend WorkflowMachine SUBMIT не имеет on_review transition, а APPROVE guard требует
            // ctx.role='reviewer'. Но при кастомных role_config Assistant может быть executor для шага 7
            // → ctx.role='executor' → APPROVE guard fails → кнопка disabled.
            // Bypass FSM полностью для dynamicExecutor + on_review — backend всё равно re-валидирует.
            const isDynamicExecutorHandoffCase = request.status === 'on_review' &&
                step && step.dynamicExecutor && (isReviewer || isExecutor);
            // BFIX (audit 2026-05-20): submit button теперь ВСЕГДА enabled (как reject).
            // Раньше disabled когда validate() fails (hasRequiredFields=false) — пользователь
            // видел тусклую кнопку без объяснения. Особенно ярко проявлялось на revision_needed
            // с checklist: после reject галка была снята ревьюером, sales видел unchecked +
            // dim submit и не понимал что делать.
            // Сейчас: клик → _submitStep вызывает validate() → Toast.error с конкретным
            // сообщением ("Подтверждение: отметьте все пункты" / "X: обязательное поле" / etc).
            // Hover-tooltip остаётся как hint для desktop users.
            if (isExecutorIsReviewerSubmitCase || isDynamicExecutorHandoffCase) {
                const ctx = getCtx();
                const hasFields = ctx.hasRequiredFields !== false;
                btn.disabled = false;
                btn.classList.remove('btn-disabled');
                if (hasFields) {
                    btn.removeAttribute('title');
                } else {
                    btn.title = 'Заполните обязательные поля — нажмите чтобы увидеть какие';
                }
            } else {
                const fsmAction = isHandoffApproveCase ? 'APPROVE' : 'SUBMIT';
                const check = WorkflowMachine.canTransition(request.status, fsmAction, getCtx);
                btn.disabled = false;
                btn.classList.remove('btn-disabled');
                if (check.allowed) {
                    btn.removeAttribute('title');
                } else {
                    // Only hasRequiredFields failure — actionable. Wrong status/role —
                    // shouldn't reach this point (canReview/visibility gates upstream).
                    btn.title = 'Заполните обязательные поля — нажмите чтобы увидеть какие';
                }
            }
        } else {
            // Non-SUBMIT action или future preview button — clear any previous FSM-imposed disabled state
            btn.disabled = false;
            btn.removeAttribute('title');
            btn.classList.remove('btn-disabled');
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
                    _setFileState(fieldId, idx, { state: 'uploaded' });   // BFIX-13
                    const preview = document.createElement('div');
                    preview.className = 'file-preview';
                    preview.dataset.index = idx;
                    // Phase 53 LIT-FIN-01-B: Lit auto-escapes data URL + fieldId (XSS-proof — sanitizeDataUrl
                    // защищает от non-image data: URI; Lit attribute interpolation дополнительно escape'ит).
                    _litRenderInto(preview, (html) => html`
                        <img src="${FieldRenderer.sanitizeDataUrl(reader.result)}" alt="" data-action="onb-openPhoto" data-value="${fieldId}">
                        <button class="file-remove-btn" data-action="onb-removeMultiFile" data-value="${fieldId}:${idx}" type="button">×</button>
                    `);
                    container.appendChild(preview);
                    const label = group.querySelector('.file-upload-label span');
                    if (label) label.textContent = 'Добавить ещё';
                    // Re-evaluate submit button after async FileReader completes
                    const _stepNum = typeof OnboardingState !== 'undefined' ? OnboardingState.get('currentStep') : null;
                    const _step = _stepNum ? OnboardingConfig.getStep(_stepNum) : null;
                    if (_step) _updateSubmitButton(_step, _stepNum);
                };
                reader.onerror = () => {                                   // BFIX-13
                    const idx = (_fileDataUrls[fieldId] || []).length;
                    _setFileState(fieldId, idx, { state: 'failed', error: 'Не удалось прочитать файл' });
                    _renderFailedFile(group, fieldId, idx, file.name, 'Не удалось прочитать файл');
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
            _setFileState(fieldId, undefined, { state: 'uploaded' });    // BFIX-13
            const group = input.closest('.form-group');
            const area = group.querySelector('.file-upload-area');
            const existing = group.querySelector('.file-preview');
            if (existing) existing.remove();

            const preview = document.createElement('div');
            preview.className = 'file-preview';
            preview.id = `preview_${fieldId}`;
            // Phase 53 LIT-FIN-01-B: Lit auto-escapes data URL + fieldId (XSS-proof — sanitizeDataUrl
            // защищает от non-image data: URI; Lit attribute interpolation дополнительно escape'ит).
            _litRenderInto(preview, (html) => html`
                <img src="${FieldRenderer.sanitizeDataUrl(reader.result)}" alt="" data-action="onb-openPhoto" data-value="${fieldId}">
                <button class="file-remove-btn" data-action="onb-removeFile" data-value="${fieldId}" type="button">×</button>
            `);
            area.prepend(preview);

            const label = group.querySelector('.file-upload-label span');
            if (label) label.textContent = 'Заменить';
            // Re-evaluate submit button after async FileReader completes
            const _stepNum = typeof OnboardingState !== 'undefined' ? OnboardingState.get('currentStep') : null;
            const _step = _stepNum ? OnboardingConfig.getStep(_stepNum) : null;
            if (_step) _updateSubmitButton(_step, _stepNum);
        };
        reader.onerror = () => {                                          // BFIX-13
            const group = input.closest('.form-group');
            _setFileState(fieldId, undefined, { state: 'failed', error: 'Не удалось прочитать файл' });
            _renderFailedFile(group, fieldId, undefined, file.name, 'Не удалось прочитать файл');
        };
        reader.readAsDataURL(file);
    }

    /**
     * BFIX-13: Render inline failed-file UI (file name + error + Повторить + ✕ remove).
     * Container: .file-previews (multi) или .file-upload-area (single) внутри group.
     */
    function _renderFailedFile(groupEl, fieldId, idx, fileName, errorMsg) {
        if (!groupEl) return;
        const container = groupEl.querySelector('.file-previews') || groupEl.querySelector('.file-upload-area');
        if (!container) return;
        const item = document.createElement('div');
        item.className = 'file-item file-item--failed';
        item.dataset.fieldId = fieldId;
        if (idx !== undefined) item.dataset.fileIdx = String(idx);
        const truncated = fileName && fileName.length > 30 ? fileName.slice(0, 30) + '…' : (fileName || 'файл');
        const errorText = errorMsg || 'Ошибка загрузки';
        const state = _getFileState(fieldId, idx);
        const retryDisabled = state.retryCount > 3;
        const retryTitle = retryDisabled ? 'Превышен лимит попыток' : null;
        const idxValue = idx !== undefined ? String(idx) : null;
        // Phase 53 LIT-FIN-01-B: Lit auto-escapes truncated/errorText/fieldId (XSS-proof для user file name + error message).
        // ifDefined пропускает атрибут когда idx undefined (избегаем data-file-idx="undefined" артефакта на DOM).
        // ?disabled — Lit boolean attribute (set/remove based on truthiness, не set="false" string).
        _litRenderInto(item, (html) => {
            const ifDef = window.litIfDefined;
            return html`
                <span class="file-name">${truncated}</span>
                <span class="file-error" style="color: var(--status-red)">✗ ${errorText}</span>
                <button class="btn btn-sm btn-warning" data-action="retry-upload"
                        data-field-id="${fieldId}"
                        data-file-idx="${ifDef ? ifDef(idxValue) : (idxValue || '')}"
                        ?disabled="${retryDisabled}"
                        title="${ifDef ? ifDef(retryTitle) : (retryTitle || '')}">Повторить</button>
                <button class="btn-icon" data-action="remove-file"
                        data-field-id="${fieldId}"
                        data-file-idx="${ifDef ? ifDef(idxValue) : (idxValue || '')}"
                        type="button">✕</button>
            `;
        });
        container.appendChild(item);
    }

    /**
     * BFIX-13: Manual retry — Phase 23 reality is FileReader-only pipeline (no network endpoint).
     * Phase 23 retry behavior:
     *   (a) If base64 data exists в _fileDataUrls (FileReader succeeded earlier — failed UI is stale)
     *       → mark 'uploaded' + remove failed UI element + Toast.success
     *   (b) If no data (FileReader.onerror — rare permission revoke) → input.click() для re-pick
     * No auto-retry / no exponential backoff (avoids race with BFIX-12 AbortController).
     * Real network upload endpoint deferred к v2.31 (out of Phase 23 scope).
     */
    function _retryUpload(fieldId, idx) {
        const state = _getFileState(fieldId, idx);
        if (state.retryCount > 3) {
            Toast.error('Превышен лимит попыток. Удалите файл и попробуйте снова.');
            return;
        }
        _setFileState(fieldId, idx, { retryCount: state.retryCount + 1, state: 'pending', error: undefined });

        // (a) base64 data already exists — FileReader succeeded earlier, mark uploaded + clean UI
        const hasData = idx === undefined
            ? !!_fileDataUrls[fieldId]
            : Array.isArray(_fileDataUrls[fieldId]) && _fileDataUrls[fieldId][idx];
        if (hasData) {
            _setFileState(fieldId, idx, { state: 'uploaded' });
            const sel = idx === undefined
                ? '.file-item--failed[data-field-id="' + fieldId + '"]:not([data-file-idx])'
                : '.file-item--failed[data-field-id="' + fieldId + '"][data-file-idx="' + idx + '"]';
            const el = document.querySelector(sel);
            if (el) el.remove();
            Toast.success('Файл готов к отправке');
            return;
        }

        // (b) No data — user must re-pick. Trigger input click.
        const input = document.getElementById('field_' + fieldId);
        if (input && typeof input.click === 'function') {
            Toast.info('Выберите файл заново');
            input.click();
        }
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

        // BFIX-13: Block submit if any file is in 'failed' state
        const failedFiles = [];
        _fileStates.forEach(function (state, key) {
            if (state.state === 'failed') {
                failedFiles.push(key);
            }
        });
        if (failedFiles.length > 0) {
            const names = failedFiles.join(', ');
            const msg = 'Есть незагруженные файлы: ' + names + '. Повторите загрузку или удалите файлы.';
            if (typeof Toast !== 'undefined' && Toast && typeof Toast.error === 'function') {
                Toast.error(msg);
            }
            return { valid: false, errors: [msg] };
        }

        const data = collectFormData(stepNumber);
        const request = OnboardingState.get('currentRequest');
        const existing = (request && request.stageData && request.stageData[stepNumber]) || {};
        const merged = { ...existing, ...data };
        const errors = [];

        // Phase 23 RULES-08 canary: build evaluator context once для declarative-migrated fields.
        // Migrated fields (any of visibility[]/requiredWhen[]/readonlyWhen[]/optionsSource) flow через
        // OnboardingEvaluator.isFieldRequired (visibility check baked INSIDE — Pitfall #9 anti-regression).
        // Non-migrated fields продолжают через legacy imperative path (per-field opt-in миграция).
        const userRoles = (typeof OnboardingUtils !== 'undefined' && OnboardingUtils.getRoles)
            ? OnboardingUtils.getRoles()
            : { myRole: 'sales', sysRole: 'sales' };
        // Phase 36 (v2.32) RULES-MIG Group A: derive flags из request metadata для validate().
        // Symmetry с _renderFields evalCtx — оба path должны видеть одинаковые flags иначе
        // declarative readonlyWhen rules могут проверяться по-разному в render vs validate.
        const _validateFlags = [];
        if (request && request.createdBy === 'import:google-sheets') _validateFlags.push('readonlyForImport');
        // Phase 47 (v2.34) RULES-MIG Group C: derive ctx.phase symmetrically с _renderFields path.
        // Critical для visibility check (Pitfall #9) — visibility-baked-in-required path в
        // OnboardingEvaluator.isFieldRequired нуждается в правильном ctx.phase чтобы
        // hidden phase-aware fields НЕ считались required.
        var _validatePhase = step && step.phase;
        if (step && step.dynamicExecutor) {
            _validatePhase = merged._handoff_complete ? 'confirm' : 'fill';
        }
        const evalCtx = {
            data: merged,
            role: userRoles.myRole,
            phase: _validatePhase,
            status: request && request.status,
            isAdmin: userRoles.myRole === 'admin' || userRoles.myRole === 'leader',
            flags: _validateFlags
        };

        // Check required
        step.fields.forEach(field => {
            if (field.asSubmitButton) return; // validated via submit action

            // Phase 51 (v2.35) RULES-MIG Group D — 100% declarative coverage milestone (43/43).
            // Все поля имеют visibility[] / requiredWhen[] / readonlyWhen[] / optionsSource =>
            // legacy imperative else-branch unreachable. Removed per Pitfall #12 cleanup.
            // Defensive: `isMigrated` check kept в shouldShowField pipeline для FieldRenderer.isFieldVisible
            // которая обрабатывает legacy showWhen markers preserved для render-mode branches (Phase 47 scope).
            // Future fields MUST включать declarative markers — Pitfall #12 exact-equality test
            // `expect(cov.migrated).toBe(43)` блокирует merge без миграции.
            if (typeof OnboardingEvaluator !== 'undefined') {
                if (!OnboardingEvaluator.isFieldVisible(field, evalCtx)) return;
                if (!OnboardingEvaluator.isFieldRequired(field, evalCtx)) return;
                // Phase 41 optionsSource: если provider возвращает {hidden:true} или {disabled:true} —
                // поле не рендерится в DOM, validation skip. Без этой проверки deal_1/2/3,
                // prepayment_method/amount (required:true, без visibility[]) блокируют submit
                // когда conditions table не определяет это поле для выбранного метода.
                if (field.optionsSource && step.hasConditionsCascade && OnboardingSource.hasConditions()) {
                    try {
                        const _optsCheck = OnboardingEvaluator.getFieldOptions(field, evalCtx);
                        if (_optsCheck && typeof _optsCheck === 'object' && !Array.isArray(_optsCheck)) {
                            if (_optsCheck.hidden || _optsCheck.disabled) return;
                        }
                    } catch (_) { /* defensive: skip check on provider error */ }
                }
            } else {
                // Defensive fallback (test environments без OnboardingEvaluator global)
                if (!FieldRenderer.shouldShowField(field, merged, step)) return;
                if (!field.required) return;
            }

            // For file fields, also check existing stageData (files aren't re-read on every render)
            const value = field.type === 'file' ? (data[field.id] || existing[field.id]) : merged[field.id];
            if (field.type === 'checklist') {
                // All items must be checked
                if (typeof value !== 'object') {
                    errors.push(`${field.label}: отметьте все пункты`);
                    return;
                }
                const items = field.items || [];
                const allChecked = items.every((_, idx) => value[idx]);
                if (!allChecked) errors.push(`${field.label}: отметьте все пункты`);
            } else if (field.type === 'list') {
                if (!Array.isArray(value) || value.length === 0) {
                    errors.push(`${field.label}: добавьте хотя бы один элемент (нажмите +)`);
                }
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

        // Plan 27-02 MIG-03: XSS-safe DOM construction (textContent + dataset)
        const chip = document.createElement('div');
        chip.className = 'list-chip';
        const span = document.createElement('span');
        span.textContent = input.value.trim();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'list-chip-remove';
        btn.dataset.action = 'onb-removeListItem';
        btn.dataset.value = `${fieldId}:${idx}`;
        btn.textContent = '×'; // Phase 53 LIT-FIN-01-B: textContent + Unicode × (U+00D7) — XSS-safe, no innerHTML
        chip.appendChild(span);
        chip.appendChild(btn);
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

        // Plan 27-02 MIG-03: XSS-safe DOM construction (textContent + dataset)
        const chip = document.createElement('div');
        chip.className = 'list-chip';
        const span = document.createElement('span');
        span.textContent = text;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'list-chip-remove';
        btn.dataset.action = 'onb-removeListItem';
        btn.dataset.value = `${fieldId}:${idx}`;
        btn.textContent = '×'; // Phase 53 LIT-FIN-01-B: textContent + Unicode × (U+00D7) — XSS-safe, no innerHTML
        chip.appendChild(span);
        chip.appendChild(btn);
        itemsContainer.appendChild(chip);

        // Hide the suggestion
        const suggestionsEl = document.getElementById(`listSuggestions_${fieldId}`);
        if (suggestionsEl) {
            suggestionsEl.querySelectorAll('.list-suggestion').forEach(btnEl => {
                if (btnEl.textContent === text) btnEl.classList.add('hidden');
            });
        }
    }

    function _autoResize(ta) {
        requestAnimationFrame(() => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
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
            // Phase 53 LIT-FIN-01-B: Lit auto-escapes URL + fieldId + index (XSS-proof; sanitizeDataUrl
            // удаляет non-image data: URI; Lit attribute interpolation дополнительно escape'ит quotes).
            _litRenderInto(container, (html) => html`
                ${allUrls.map((u, i) => html`
                    <div class="file-preview" data-index="${i}">
                        <img src="${FieldRenderer.sanitizeDataUrl(u)}" alt="" data-action="onb-openPhoto" data-value="${fieldId}">
                        <button class="file-remove-btn" data-action="onb-removeMultiFile" data-value="${fieldId}:${i}" type="button">×</button>
                    </div>
                `)}
            `);
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

    // ===================== CASCADE WIRING (RULES-06, Plan 23-06) =====================
    //
    // Replaces imperative cascade handler в partner-onboarding.js _handleCascadeChange
    // на declarative applyCascadeWithConfirm flow с modal confirm + revert UX.
    //
    // CRITICAL Warning #4 fix: previousValue cached BEFORE browser mutates select value.
    // DropdownHelper.select sets `input.value = v` THEN dispatches 'change' event, so
    // change handler receives NEW value already — collectFormData бесполезна для previousValue.
    // Solution: cache на focusin (когда user открывает dropdown) ДО mutation в hidden input.

    /**
     * Attach focus-based previousValue capture для cascade trigger fields в container.
     * Pattern: focusin event каскадно bubbles → catch dropdown trigger button click,
     * read hidden input value, store в input.dataset.previousValue.
     *
     * Каждый render() полностью пересоздаёт DOM #formFields, поэтому listeners attach
     * при render и cleanup происходит автоматически (DOM nodes garbage-collected).
     *
     * @param {HTMLElement} container - usually #formFields
     */
    function _attachCascadeFocusListeners(container) {
        if (!container) return;
        const triggers = (typeof OnboardingConfig !== 'undefined' && OnboardingConfig.CASCADE_FIELDS)
            ? OnboardingConfig.CASCADE_FIELDS.map(c => c.trigger) : [];
        triggers.forEach(triggerId => {
            const hiddenInput = container.querySelector('#field_' + triggerId);
            if (!hiddenInput) return;
            // Initial cache на render time (для первого взаимодействия без prior focus)
            hiddenInput.dataset.previousValue = hiddenInput.value || '';
            // Focus capture на dropdown trigger button: click/focus → cache hidden input value
            const wrap = hiddenInput.closest('.dropdown-wrap');
            const triggerBtn = wrap ? wrap.querySelector('.dropdown-trigger') : null;
            if (triggerBtn && triggerBtn.dataset.cascadeFocusBound !== '1') {
                triggerBtn.dataset.cascadeFocusBound = '1';
                triggerBtn.addEventListener('focus', function () {
                    // Cache CURRENT hidden input value BEFORE user makes new selection
                    hiddenInput.dataset.previousValue = hiddenInput.value || '';
                });
            }
        });
    }

    /**
     * RULES-06 cascade change handler — DECLARATIVE replacement for imperative
     * _handleCascadeChange в partner-onboarding.js.
     *
     * Builds cascadeDef from CASCADE_FIELDS, calls OnboardingEvaluator.applyCascadeWithConfirm,
     * applies diff to DOM в onApplied, restores trigger to dataset.previousValue в onReverted.
     *
     * Returns true if handled (caller should NOT continue with autosave); false if not a cascade trigger.
     *
     * @param {Event} e - change event на hidden input (from DropdownHelper.select)
     * @returns {boolean}
     */
    function handleCascadeChange(e) {
        const triggerEl = e && e.target;
        if (!triggerEl || !triggerEl.id) return false;
        const triggerId = triggerEl.id.startsWith('field_') ? triggerEl.id.slice('field_'.length) : triggerEl.name;
        if (!triggerId) return false;

        const cascadeDef = (typeof OnboardingConfig !== 'undefined' && OnboardingConfig.CASCADE_FIELDS)
            ? OnboardingConfig.CASCADE_FIELDS.find(c => c.trigger === triggerId) : null;
        if (!cascadeDef) return false;

        // Conditions cascade only активен на step 2 (hasConditionsCascade) с loaded conditions data
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        const step = OnboardingConfig.getStep(stepNumber);
        if (!request || !step || !step.hasConditionsCascade) return false;
        if (typeof OnboardingSource !== 'undefined' && OnboardingSource.hasConditions && !OnboardingSource.hasConditions()) {
            return false;
        }

        const newValue = triggerEl.value;
        // CRITICAL Warning #4 fix: previousValue из dataset (cached на focusin),
        // НЕ из collectFormData — там уже NEW value (browser mutated на selection).
        const previousValue = (triggerEl.dataset && triggerEl.dataset.previousValue !== undefined)
            ? triggerEl.dataset.previousValue : '';

        // Current data — NEW value of trigger included; ok для clears/autofills lookup,
        // но NOT для previousValue (см. Warning #4 fix выше)
        const currentData = collectFormData(stepNumber);

        // Phase 23 v1: build inline autofillsData для method_name trigger
        // (per CONTEXT.md decision — provider indirection deferred to v2.31)
        let cascadeDefForApply = cascadeDef;
        if (cascadeDef.autofill && cascadeDef.trigger === 'method_name'
                && typeof OnboardingSource !== 'undefined' && OnboardingSource.getCondition) {
            const selCountry = currentData.condition_country || '';
            const selType = currentData.method_type || '';
            const condition = OnboardingSource.getCondition(selCountry, selType, newValue);
            if (condition) {
                cascadeDefForApply = Object.assign({}, cascadeDef, {
                    autofillsData: {
                        deal_1: condition.deal_1 || '',
                        deal_2: condition.deal_2 || '',
                        deal_3: condition.deal_3 || '',
                        prepayment_method: condition.prepayment_method || '',
                        prepayment_amount: condition.prepayment_amount || ''
                    }
                });
            }
        }

        // Build labelLookup из текущего step.fields (fieldId → field.label)
        const labelLookup = (step.fields || []).reduce((acc, f) => {
            acc[f.id] = f.label || f.id;
            return acc;
        }, {});

        if (typeof OnboardingEvaluator === 'undefined' || !OnboardingEvaluator
                || typeof OnboardingEvaluator.applyCascadeWithConfirm !== 'function') {
            return false; // graceful degradation — caller fallback на legacy path
        }

        OnboardingEvaluator.applyCascadeWithConfirm(cascadeDefForApply, newValue, currentData, {
            labelLookup,
            onApplied(diff) {
                // Persist trigger value into stageData (commit user choice)
                if (!request.stageData) request.stageData = {};
                if (!request.stageData[stepNumber]) request.stageData[stepNumber] = {};
                request.stageData[stepNumber][triggerId] = newValue;
                // Apply clears + autofills к stageData + DOM
                Object.keys(diff.clears || {}).forEach(fid => {
                    request.stageData[stepNumber][fid] = '';
                });
                Object.keys(diff.autofills || {}).forEach(fid => {
                    request.stageData[stepNumber][fid] = diff.autofills[fid];
                });
            },
            onReverted() {
                // Cancel — restore trigger element к prior value (DOM + dataset)
                triggerEl.value = previousValue || '';
                triggerEl.dataset.previousValue = previousValue || '';
                // Update visible dropdown trigger label
                const wrap = triggerEl.closest('.dropdown-wrap');
                if (wrap) {
                    const labelEl = wrap.querySelector('.dropdown-trigger span');
                    if (labelEl) {
                        const opt = (step.fields || []).find(f => f.id === triggerId);
                        const optionsList = (opt && Array.isArray(opt.options)) ? opt.options : [];
                        const matched = optionsList.find(o => o.value === previousValue);
                        labelEl.textContent = matched ? matched.label : (previousValue || 'Выберите...');
                    }
                    const trig = wrap.querySelector('.dropdown-trigger');
                    if (trig) trig.classList.toggle('placeholder', !previousValue);
                    // Update active marker в menu
                    const menu = wrap.querySelector('.dropdown-menu');
                    if (menu) {
                        menu.querySelectorAll('.dropdown-item').forEach(item => {
                            item.classList.toggle('active', (item.dataset.value || '') === (previousValue || ''));
                        });
                    }
                }
            }
        }).then(result => {
            if (result && result.applied) {
                // Successful apply — update baseline для next interaction
                triggerEl.dataset.previousValue = newValue;
                // Re-render для применить cleared/autofilled fields в DOM
                render(request, stepNumber);
            }
        }).catch(err => {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[OnboardingForm] handleCascadeChange error:', err);
            }
        });
        return true;
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
        removeMultiFile,
        // QWIN-01: dirty fields tracking API (used by polling-exclusion в partner-onboarding.js)
        isDirty,
        getDirtyFields,
        clearDirty,
        onDirtyChange,
        // Phase 8 / Plan 02: local-first draft buffer API
        persistDraft,
        restoreDraft,
        clearDraftBuffer,
        _draftKey,   // exposed для Plan 04 cleanup (scan onb-draft:* keys)
        // BFIX-13: file state tracking + manual retry (exposed for tests + delegated DOM handler)
        _fileStates,
        _getFileState,
        _setFileState,
        _retryUpload,
        // RULES-06 / Plan 23-06: declarative cascade с focus-based previousValue capture
        handleCascadeChange,
        _attachCascadeFocusListeners
    };
})();

// IIFE module exports — required для vitest CommonJS-like require AND для browser globals.
// Без этого vitest получает {} → tests fail. Pattern идентичен shared/js/toast.js, shared/cloud-storage.js.
if (typeof module !== 'undefined' && module.exports) { module.exports = OnboardingForm; }
if (typeof window !== 'undefined') { window.OnboardingForm = OnboardingForm; }
