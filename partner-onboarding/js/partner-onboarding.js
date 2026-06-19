/* partner-onboarding.js — Главный контроллер */

const PartnerOnboarding = (() => {
    'use strict';

    let _confirmCallback = null;
    let _actionInProgress = false;
    let _pollTimer = null;
    let _visHandler = null;
    let _lastModifiedTs = null;
    let _beforeUnloadHandler = null;
    const SYNC_INTERVAL = 10000;
    const _debouncedSearch = Utils.debounce(() => OnboardingList.applyFilters(), 150);

    // ── Phase 52 LIT-FIN-01-A: Lit render helper (XSS-proof через автоэскейп) ──
    // Заменяет imperative innerHTML с string concat + escapeHtml на Lit html`` templates.
    // Если Lit ещё не загружен (cdn-deps.js async) — defers render до lit-ready event.
    // Гарантирует что pending render attempts не теряются (single pending per container).
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
            // BFIX: container.replaceChildren() удалён — удаляло Lit Comment markers, разрушая
            // _$litPart$ state и делая все последующие render на этот контейнер неудачными.
            try { render(html``, container); } catch (_) { /* best-effort Lit state reset */ }
            console.error('[partner-onboarding] Lit render failed:', e);
            return false;
        }
    }

    // ── Loading helpers ──

    function _setBtnLoading(selector, loading) {
        const btn = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!btn) return;
        if (loading) {
            btn.dataset.wasDisabled = btn.disabled;
            btn.classList.add('btn-loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('btn-loading');
            btn.disabled = btn.dataset.wasDisabled === 'true';
            delete btn.dataset.wasDisabled;
        }
    }

    function _setActionLock(lock) {
        _actionInProgress = lock;
    }

    function _isActionLocked() {
        return _actionInProgress;
    }

    // ── Phase 8 / Plan 03: unsaved-changes guard ──

    function _isFormDirty() {
        if (OnboardingState.get('view') !== 'form') return false;
        if (typeof OnboardingForm === 'undefined' || !OnboardingForm.getDirtyFields) return false;
        const dirty = OnboardingForm.getDirtyFields();
        return !!(dirty && dirty.size > 0);
    }

    function _installBeforeUnloadGuard() {
        if (_beforeUnloadHandler) return;
        _beforeUnloadHandler = (e) => {
            if (!_isFormDirty()) return undefined;
            e.preventDefault();
            e.returnValue = 'Часть изменений может быть не сохранена';
            return 'Часть изменений может быть не сохранена';
        };
        window.addEventListener('beforeunload', _beforeUnloadHandler);
    }

    function _uninstallBeforeUnloadGuard() {
        if (_beforeUnloadHandler) {
            window.removeEventListener('beforeunload', _beforeUnloadHandler);
            _beforeUnloadHandler = null;
        }
    }

    function _confirmUnsavedNavigation(proceedCallback) {
        if (!_isFormDirty()) {
            proceedCallback();
            return;
        }
        _showConfirm(
            'Уйти без сохранения?',
            'Часть изменений может быть не сохранена. Локальная копия draft сохранена в браузере — данные восстановятся при возврате.',
            () => {
                if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDirty) OnboardingForm.clearDirty();
                proceedCallback();
            }
        );
    }

    // ── Init ──

    async function init() {
        OnboardingList.init();
        _loadUserData();
        _setupDevRoleSwitcher();

        // Phase 63 (TS-PROTO-06): legacy modified-ts probe deprecated.
        // Use _readNsTs('onboardings') as initial timestamp source — _writeNsTs is called
        // inside getOnboardingRequests/_applyApiResult (see Tasks 1-2), so namespace ts is
        // warmed после первого goToOnboardingPage. _lastModifiedTs locally maintained для
        // existing _checkForUpdates compare logic (full migration к _lastKnownNsTs deferred к Phase 65).
        await OnboardingSource.init();
        const _initTs = (typeof CloudStorage !== 'undefined' && typeof CloudStorage._readNsTs === 'function')
            ? CloudStorage._readNsTs('onboardings')
            : null;
        _lastModifiedTs = _initTs ? String(_initTs) : '0';

        OnboardingState.setOptimistic(OptimisticManager.create('onboarding'));

        OnboardingList.setupDefaultFilters();
        await OnboardingList.goToOnboardingPage(1);
        _updateToolbarForRole();
        _cleanupStaleBuffers();   // Phase 8 / Plan 04: orphan + stale draft buffer cleanup
        _startSmartSync();
    }

    function _loadUserData() {
        let systemRole = (typeof RoleGuard !== 'undefined' && RoleGuard.getCurrentRole)
            ? RoleGuard.getCurrentRole() : 'sales';
        const email = (typeof RoleGuard !== 'undefined' && RoleGuard.user)
            ? RoleGuard.user.email || '' : '';

        // isAdmin privilege: пользователь с флагом isAdmin получает полные права
        if (typeof RoleGuard !== 'undefined' && RoleGuard.isAdmin && RoleGuard.isAdmin()) {
            systemRole = 'admin';
        }

        OnboardingState.set('systemRole', systemRole);
        OnboardingState.set('userRole', OnboardingRoles.getGlobalModuleRole(systemRole));
        OnboardingState.set('userEmail', email);
    }

    // ── Data (API) ──

    async function _loadRequests() {
        const r = _getViewRefs();
        if (r.listLoading) r.listLoading.classList.remove('hidden');
        if (r.requestsList) r.requestsList.classList.add('hidden');
        try {
            const data = await CloudStorage.getOnboardingRequests();
            OnboardingState.set('requests', data.requests || []);
            OnboardingState.set('history', data.history || {});
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'loadRequests' });
            OnboardingState.set('requests', []);
        } finally {
            if (r.listLoading) r.listLoading.classList.add('hidden');
            if (r.requestsList) r.requestsList.classList.remove('hidden');
        }
    }

    function _getRequest(id) {
        return (OnboardingState.get('requests') || []).find(r => r.id === id);
    }

    function _updateRequestLocal(id, updates) {
        const requests = OnboardingState.get('requests') || [];
        const idx = requests.findIndex(r => r.id === id);
        if (idx === -1) return;
        Object.assign(requests[idx], updates);
        OnboardingState.set('requests', requests);
        OnboardingList.applyFilters();
    }

    function _applyApiResult(result) {
        if (!result || !result.request) return;
        CloudStorage.clearCacheNamespace('onboardingRequests');
        // Phase 63 (TS-PROTO-06): capture server ts so next read can short-circuit (single chokepoint)
        // BFIX: _lastModifiedTs must match the serverTs format used in _checkForUpdates
        // (String(result.ts)). Using Date.now() caused _lastModifiedTs to always differ
        // from serverTs → every poll after a submit triggered false self-conflict detection.
        const _ts = (result && typeof result.ts === 'number') ? result.ts : Date.now();
        _lastModifiedTs = String(_ts);
        if (typeof CloudStorage._writeNsTs === 'function') {
            CloudStorage._writeNsTs('onboardings', _ts);
            // Phase 65 (MULTI-TAB-03): broadcast TS_UPDATED to other tabs after onboarding mutation
            if (typeof SyncManager !== 'undefined' && typeof SyncManager.sendTsUpdate === 'function') {
                SyncManager.sendTsUpdate('onboardings', _ts);
            }
        }
        const requests = OnboardingState.get('requests') || [];
        const idx = requests.findIndex(r => r.id === result.request.id);
        if (idx !== -1) {
            requests[idx] = result.request;
        } else {
            requests.push(result.request);
        }
        OnboardingState.set('requests', requests);
        if (result.history) {
            const allHistory = OnboardingState.get('history') || {};
            allHistory[result.request.id] = result.history;
            OnboardingState.set('history', allHistory);
        }
        OnboardingState.set('currentRequest', result.request);
        OnboardingList.applyFilters();
    }

    // ── Cached DOM refs ──
    let _viewRefs = null;
    function _getViewRefs() {
        if (!_viewRefs) {
            _viewRefs = {
                viewList: document.getElementById('viewList'),
                viewForm: document.getElementById('viewForm'),
                viewReview: document.getElementById('viewReview'),
                formFields: document.getElementById('formFields'),
                reviewFields: document.getElementById('reviewFields'),
                headerTitle: document.getElementById('headerTitle'),
                headerRequestId: document.getElementById('headerRequestId'),
                statusDropdown: document.getElementById('statusDropdown'),
                settingsDropdown: document.getElementById('settingsDropdown'),
                btnNewRequest: document.getElementById('btnNewRequest'),
                btnSettings: document.getElementById('btnSettings'),
                btnRoleConfig: document.getElementById('btnRoleConfig'),
                listEmpty: document.getElementById('listEmpty'),
                listLoading: document.getElementById('listLoading'),
                requestsList: document.getElementById('requestsList')
            };
        }
        return _viewRefs;
    }

    // ── Views ──

    function _showView(view) {
        const prevView = OnboardingState.get('view');
        OnboardingState.set('view', view);
        const r = _getViewRefs();
        r.viewList.classList.toggle('hidden', view !== 'list');
        r.viewForm.classList.toggle('hidden', view !== 'form');
        r.viewReview.classList.toggle('hidden', view !== 'review');

        // QWIN-01: уходим из формы — очищаем dirty tracking (no leftover dirty fields в Set
        // когда пользователь сменил view → нет ложных polling-exclusion на следующем checkForUpdates).
        if (prevView === 'form' && view !== 'form' && typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDirty) {
            OnboardingForm.clearDirty();
        }

        // Clear inactive view content to prevent duplicate element IDs (e.g. checkComment_*)
        // Phase 52 LIT-FIN-01-A: replaceChildren() XSS-safer чем innerHTML='' (нет HTML parsing path).
        if (view !== 'form' && r.formFields) {
            r.formFields.replaceChildren();
        }
        if (view !== 'review' && r.reviewFields) {
            r.reviewFields.replaceChildren();
        }

        const headerTitle = r.headerTitle;
        const headerRequestId = r.headerRequestId;

        if (view === 'list') {
            headerTitle.textContent = 'Заведение партнёра';
            headerRequestId.classList.add('hidden');
        } else {
            const request = OnboardingState.get('currentRequest');
            if (request) {
                headerRequestId.textContent = request.id;
                headerRequestId.classList.remove('hidden');
                _renderAdminActions(request);
            }
        }
    }

    function _renderAdminActions(request) {
        const { isAdmin } = OnboardingUtils.getRoles();
        const view = OnboardingState.get('view');
        const containerId = view === 'form' ? 'formAdminActions' : 'reviewAdminActions';
        const container = document.getElementById(containerId);
        if (!container) return;

        // Phase 22 (WMACH-06): FSM context getter (Pitfall #7 — closure, не snapshot).
        // hasFsm guard защищает от ReferenceError если workflow-machine.js не подключён.
        const hasFsm = typeof WorkflowMachine !== 'undefined' && WorkflowMachine;
        const getAdminCtx = function () {
            return {
                role: 'admin',
                isAdmin: !!isAdmin,
                executorId: request && request.assigneeEmail,
                userId: OnboardingState.get('userEmail'),
                hasRequiredFields: true,
                hasRejectReason: false
            };
        };

        // Pre-compute available actions snapshot (single FSM call shared by all checks).
        // When FSM unavailable, fallback uses local terminal/cancelled detection without status === literal.
        const reqStatus = request && request.status;
        const isTerminal = reqStatus === 'completed' || reqStatus === 'cancelled';  // KEEP-equivalent display gate
        const isCancelled = reqStatus === 'cancelled';
        const fsmActions = hasFsm ? WorkflowMachine.availableActions(reqStatus, getAdminCtx) : null;

        // Phase 52 LIT-FIN-01-A: pre-compute action visibility flags (data-layer separated от render).
        let showReassign = false, showRollback = false, showCancel = false;
        if (!isTerminal && isAdmin) {
            if (view === 'form') {
                showReassign = !fsmActions || fsmActions.includes('REASSIGN');
                showRollback = !fsmActions || fsmActions.includes('ROLLBACK');
            }
            showCancel = !fsmActions || fsmActions.includes('CANCEL');
        }
        // Phase 22 (WMACH-06): REPLACE per audit row partner-onboarding.js:214 — workflow gate
        // controlling REACTIVATE button visibility. Replaced literal status check with FSM
        // availableActions (REACTIVATE valid only from cancelled per transitions table).
        const allowReactivate = fsmActions ? fsmActions.includes('REACTIVATE') : isCancelled;
        const showReactivate = isAdmin && allowReactivate;

        // Phase 52 LIT-FIN-01-A: Lit render заменяет imperative html string + innerHTML.
        // Lit auto-escapes ${...} interpolations + проверяет attribute values на security.
        // Fallback (Lit not loaded): defer через _litRenderInto's lit-ready listener.
        const ok = _litRenderInto(container, (html) => html`
            ${showReassign ? html`<button class="btn btn-secondary" data-action="onb-showReassign">Передать</button>` : ''}
            ${showRollback ? html`<button class="btn btn-secondary" data-action="onb-showRollback">Откатить</button>` : ''}
            ${showCancel ? html`<button class="btn btn-danger" data-action="onb-cancelRequest">Отменить</button>` : ''}
            ${showReactivate ? html`<button class="btn btn-secondary" data-action="onb-reactivateRequest">Восстановить</button>` : ''}
        `);
        if (!ok) {
            // Lit not ready — clear visible buttons until lit-ready event re-renders.
            container.replaceChildren();
        }
    }

    // ── Toolbar Role Visibility ──

    function _updateToolbarForRole() {
        const { myRole, sysRole: systemRole } = OnboardingUtils.getRoles();
        const hideSettings = myRole === 'executor';
        const isReviewer = myRole === 'reviewer';
        const isLeaderOrAdmin = systemRole === 'admin' || systemRole === 'leader';
        const r = _getViewRefs();

        if (r.btnNewRequest) r.btnNewRequest.classList.toggle('hidden', isReviewer);
        if (r.btnSettings) r.btnSettings.classList.toggle('hidden', hideSettings);
        if (r.btnRoleConfig) r.btnRoleConfig.classList.toggle('hidden', !isLeaderOrAdmin);
        OnboardingSource.updateSyncBarVisibility();

        // Empty state: hide "Новая заявка" button + adjust text for reviewer
        const emptyState = r.listEmpty;
        if (emptyState) {
            const emptyBtn = emptyState.querySelector('.btn-new-request');
            const emptyText = emptyState.querySelector('.empty-state-text');
            if (emptyBtn) emptyBtn.classList.toggle('hidden', isReviewer);
            if (emptyText) emptyText.textContent = isReviewer
                ? 'Заявки на проверку пока не поступали'
                : 'Создайте первую заявку на заведение партнёра';
        }
    }

    // ── Event Delegation ──

    function _handleClick(e) {
        // Close dropdowns when clicking outside (cached refs)
        const r = _getViewRefs();
        if (r.statusDropdown && !r.statusDropdown.classList.contains('hidden') && !e.target.closest('.dropdown-wrap--up')) {
            r.statusDropdown.classList.add('hidden');
        }
        if (r.settingsDropdown && !r.settingsDropdown.classList.contains('hidden') && !e.target.closest('#settingsWrap')) {
            r.settingsDropdown.classList.add('hidden');
        }
        const filterDd = document.getElementById('filterDropdown');
        if (filterDd && !filterDd.classList.contains('hidden') && !e.target.closest('#filterBox')) {
            filterDd.classList.add('hidden');
        }

        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const value = target.dataset.value;

        switch (action) {
            // Navigation
            case 'onb-back':
                _confirmUnsavedNavigation(() => _showView('list'));
                break;
            case 'onb-newRequest':
                _confirmUnsavedNavigation(() => _createRequest());
                break;
            case 'onb-openRequest':
                if (OnboardingState.get('view') === 'form') {
                    const _curReq = OnboardingState.get('currentRequest');
                    if (_curReq && _curReq.id !== value) {
                        _confirmUnsavedNavigation(() => _openRequest(value));
                        break;
                    }
                }
                _openRequest(value);
                break;
            case 'onb-goToStep': _goToStep(parseInt(value, 10)); break;

            // Filters
            case 'onb-toggleFilter': _toggleFilterDropdown(); break;
            case 'onb-selectFilter': _selectFilter(value, target); break;

            // Form actions
            case 'onb-submit': _submitStep(); break;
            case 'onb-goToCurrentStep': {
                const req = OnboardingState.get('currentRequest');
                if (req) _goToStep(req.currentStep);
                break;
            }
            case 'onb-toggleStatusDropdown': _toggleStatusDropdown(); break;
            case 'onb-selectLeadStatus': _selectLeadStatus(value); break;
            // onb-setDateNow removed — handled by DatePicker "Сейчас" button

            // Review actions
            case 'onb-approve': _approveStep(); break;
            case 'onb-reject': _rejectStep(); break;
            case 'onb-withdraw': _withdrawStep(); break;

            // Admin actions (bottom bar)
            case 'onb-cancelRequest': _showConfirm('Отменить заявку?', 'Заявка будет отменена.', _confirmCancelRequest); break;
            case 'onb-reactivateRequest': _showConfirm('Восстановить заявку?', 'Заявка будет возобновлена.', _confirmReactivateRequest); break;
            case 'onb-showReassign': _showReassignModal(); break;
            case 'onb-showRollback': _showRollbackModal(); break;

            // History modal
            case 'onb-showHistory': _showHistoryModal(); break;
            case 'onb-closeHistory': _closeModal('historyModal'); break;

            // Reassign modal
            case 'onb-closeReassign': _closeModal('reassignModal'); break;
            case 'onb-confirmReassign': _confirmReassign(); break;

            // Rollback modal
            case 'onb-closeRollback': _closeModal('rollbackModal'); break;
            case 'onb-confirmRollback': _confirmRollback(); break;

            // Form dropdowns — BFIX-15: передаём event для touchend.preventDefault в DropdownHelper.toggle
            case 'onb-toggleFormDropdown': _toggleFormDropdown(target, e); break;
            case 'onb-selectFormDropdown': _selectFormDropdown(target); break;

            // Confirm modal
            case 'onb-closeConfirm': _closeModal('confirmModal'); break;
            case 'onb-confirmAction': if (_confirmCallback) { _confirmCallback(); _closeModal('confirmModal'); } break;

            // Form field actions
            case 'onb-removeFile': OnboardingForm.removeFile(value); break;
            case 'onb-removeMultiFile': {
                const [fId, idx] = value.split(':');
                OnboardingForm.removeMultiFile(fId, parseInt(idx, 10));
                break;
            }
            case 'onb-addListItem': OnboardingForm.addListItem(value); break;
            case 'onb-addListSuggestion': {
                const sepIdx = value.indexOf(':');
                OnboardingForm.addListSuggestion(value.slice(0, sepIdx), value.slice(sepIdx + 1));
                break;
            }
            case 'onb-removeListItem': {
                const [fid, idx] = value.split(':');
                OnboardingForm.removeListItem(fid, parseInt(idx, 10));
                break;
            }
            case 'onb-toggleChecklistComment': {
                const [cFid, cIdx] = value.split(':');
                OnboardingForm.toggleChecklistComment(cFid, parseInt(cIdx, 10));
                break;
            }
            case 'onb-openPhoto': _openPhotoLightbox(target); break;

            // BFIX-13: file upload retry (failed FileReader pipeline) — see onboarding-form.js _renderFailedFile
            case 'retry-upload': {
                const fid = target.dataset.fieldId;
                const fidx = target.dataset.fileIdx !== undefined ? Number(target.dataset.fileIdx) : undefined;
                if (typeof OnboardingForm !== 'undefined' && OnboardingForm._retryUpload) {
                    OnboardingForm._retryUpload(fid, fidx);
                }
                break;
            }
            case 'remove-file': {
                const fid = target.dataset.fieldId;
                const fidx = target.dataset.fileIdx !== undefined ? Number(target.dataset.fileIdx) : undefined;
                if (typeof OnboardingForm !== 'undefined') {
                    if (fidx !== undefined && OnboardingForm.removeMultiFile) {
                        OnboardingForm.removeMultiFile(fid, fidx);
                    } else if (OnboardingForm.removeFile) {
                        OnboardingForm.removeFile(fid);
                    }
                }
                // Also remove the failed-UI element if present
                const sel = fidx === undefined
                    ? '.file-item--failed[data-field-id="' + fid + '"]:not([data-file-idx])'
                    : '.file-item--failed[data-field-id="' + fid + '"][data-file-idx="' + fidx + '"]';
                const el = document.querySelector(sel);
                if (el) el.remove();
                break;
            }

            // Selection (admin/leader)
            case 'onb-toggleSelect': e.stopPropagation(); OnboardingList.updateSelection(); break;
            case 'onb-goToPage': OnboardingList.goToPage(value); break;
            case 'onb-selectAll': OnboardingList.toggleSelectAll(target.checked); break;
            case 'onb-deleteSelected': _deleteSelectedRequests(); break;

            // Settings dropdown
            case 'onb-toggleSettings': _toggleSettingsDropdown(); break;

            // Source settings
            case 'onb-openSourceSettings': _closeSettingsDropdown(); OnboardingSource.openSettings(); break;
            case 'onb-closeSourceSettings': _closeModal('sourceSettingsModal'); break;
            case 'onb-addSource': OnboardingSource.showEditForm(null); break;
            case 'onb-editSource': OnboardingSource.showEditForm(value); break;
            case 'onb-backToSourceList': OnboardingSource.showList(); break;
            case 'onb-saveSource': OnboardingSource.saveSource(); break;
            case 'onb-deleteSource': _showConfirm('Удалить источник?', 'Источник будет удалён. Импортированные лиды останутся.', () => OnboardingSource.deleteSource(OnboardingSource.getEditingId())); break;
            case 'onb-syncNow': OnboardingSource.syncNow(); break;

            // Conditions settings
            case 'onb-openConditionsSettings': _closeSettingsDropdown(); OnboardingSource.openConditionsSettings(); break;
            case 'onb-closeConditions': _closeModal('conditionsModal'); break;
            case 'onb-saveConditions': OnboardingSource.saveConditionsUrl(); break;
            case 'onb-editConditionsUrl': OnboardingSource.editConditionsUrl(); break;
            case 'onb-clearConditions': OnboardingSource.clearConditions(); break;
            case 'onb-refreshConditions': OnboardingSource.refreshConditions(); break;

            // Role config settings
            case 'onb-openRoleConfig': _closeSettingsDropdown(); OnboardingRoles.openSettings(); break;
            case 'onb-closeRoleConfig': _closeModal('roleConfigModal'); break;
            // BFIX (audit 2026-05-20): close moved INSIDE OnboardingRoles.saveConfig
            // — закрываем только после успешного API. Раньше fire-and-forget +
            // immediate close скрывал любые backend ошибки.
            case 'onb-saveRoleConfig': OnboardingRoles.saveConfig(); break;
            case 'onb-resetRoleConfig': OnboardingRoles.resetToDefaults(); break;

            // DEV
            case 'onb-devRole': _switchDevRole(value, target); break;
        }
    }

    // Phase 8 / Plan 02: local-first draft buffer (заменяет server-side autosave).
    // Debounce 500ms балансирует частоту localStorage writes при печати vs UX latency.
    const _debouncedPersistDraft = Utils.debounce(() => {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request || OnboardingState.get('view') !== 'form') return;
        if (typeof OnboardingForm === 'undefined' || !OnboardingForm.persistDraft) return;
        const data = OnboardingForm.collectFormData(stepNumber, { excludeFiles: true });
        OnboardingForm.persistDraft(request.id, stepNumber, data, request.version || 0);
    }, 500);

    function _persistDraftToLocal() {
        _debouncedPersistDraft();
    }

    function _restoreDraftIfPresent(request, stepNumber) {
        if (!request || stepNumber == null) return;
        if (typeof OnboardingForm === 'undefined' || !OnboardingForm.restoreDraft) return;
        const buffered = OnboardingForm.restoreDraft(request.id, stepNumber, request.version || 0);
        if (!buffered) return;
        if (!request.stageData) request.stageData = {};
        if (!request.stageData[stepNumber]) request.stageData[stepNumber] = {};
        Object.assign(request.stageData[stepNumber], buffered);
        // Re-render с merged data. skipQwin01: true — не перечитывать DOM (он ещё пустой),
        // иначе QWIN-01 перезапишет buffered data пустыми DOM-значениями.
        // Восстановлено silently — без Toast (per CONTEXT.md decision).
        OnboardingForm.render(request, stepNumber, { skipQwin01: true });
    }

    // ── Phase 8 / Plan 04: stale draft buffer cleanup ──
    // При init модуля удаляем буфера из localStorage для:
    // 1. Неизвестных requestId (заявка удалена) — orphan-prevention
    // 2. Старше 7 дней (savedAt < now - 7d) — long-term hygiene
    // 3. Corrupted JSON — defensive.
    // Вызывается ПОСЛЕ await OnboardingList.goToOnboardingPage(1), чтобы
    // OnboardingState.get('requests') уже содержал загруженные заявки для knownIds.

    const STALE_BUFFER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    function _cleanupStaleBuffers() {
        let prefix;
        try {
            const env = (typeof EnvConfig !== 'undefined' && EnvConfig.getCurrentEnv)
                ? EnvConfig.getCurrentEnv() : 'default';
            prefix = `onb-draft:${env}:`;
        } catch (_) { return; }

        let removedUnknown = 0;
        let removedOld = 0;
        const now = Date.now();
        const requests = OnboardingState.get('requests') || [];
        const knownIds = new Set(requests.map(r => r.id));

        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || !key.startsWith(prefix)) continue;
                // key format: onb-draft:{env}:{requestId}:{stepNumber}
                const rest = key.slice(prefix.length);
                const colonIdx = rest.indexOf(':');
                if (colonIdx === -1) continue;
                const requestId = rest.slice(0, colonIdx);

                let parsed;
                try {
                    parsed = JSON.parse(localStorage.getItem(key) || 'null');
                } catch (_) {
                    // Corrupted JSON — удалить
                    keysToRemove.push({ key, reason: 'corrupted' });
                    continue;
                }

                // Unknown request — удалить
                if (!knownIds.has(requestId)) {
                    keysToRemove.push({ key, reason: 'unknown' });
                    continue;
                }
                // Old buffer — удалить
                if (parsed && typeof parsed.savedAt === 'number' && (now - parsed.savedAt) > STALE_BUFFER_MAX_AGE_MS) {
                    keysToRemove.push({ key, reason: 'old' });
                    continue;
                }
            }
            for (const { key, reason } of keysToRemove) {
                try {
                    localStorage.removeItem(key);
                    if (reason === 'unknown' || reason === 'corrupted') removedUnknown++;
                    else removedOld++;
                } catch (_) { /* silent */ }
            }
        } catch (e) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[partner-onboarding._cleanupStaleBuffers] failed:', e && e.message);
            }
        }

        if (removedUnknown || removedOld) {
            if (typeof console !== 'undefined' && console.log) {
                console.log(`[partner-onboarding] Cleanup: removed ${removedUnknown} unknown + ${removedOld} old draft buffers`);
            }
        }
    }

    function _handleInput(e) {
        const target = e.target;
        if (target.dataset.action === 'onb-search') {
            OnboardingState.set('filters.search', target.value);
            _debouncedSearch();
            return;
        }
        // Сохранение черновика в локальный буфер при вводе в поля формы
        if (OnboardingState.get('view') === 'form' && target.closest('#formFields')) {
            _persistDraftToLocal();
        }
    }

    function _handleCascadeChange(target) {
        // Phase 23 RULES-06 (Plan 23-06): delegate to OnboardingForm.handleCascadeChange
        // (declarative applyCascadeWithConfirm flow с focus-based previousValue capture).
        // Form module owns DOM rendering + cache lifecycle; controller только wiring.
        if (typeof OnboardingForm !== 'undefined' && OnboardingForm
                && typeof OnboardingForm.handleCascadeChange === 'function') {
            const handled = OnboardingForm.handleCascadeChange({ target });
            if (handled) {
                _persistDraftToLocal();
                return true;
            }
        }
        return false;
    }

    function _handleChange(e) {
        const target = e.target;
        // Dynamic executor: re-render form when executor field changes
        const _deStep = OnboardingConfig.getStep(OnboardingState.get('currentStep'));
        if (_deStep && _deStep.dynamicExecutor && target.name === _deStep.dynamicExecutor.field) {
            const request = OnboardingState.get('currentRequest');
            const stepNumber = OnboardingState.get('currentStep');
            if (request) {
                if (!request.stageData) request.stageData = {};
                if (!request.stageData[stepNumber]) request.stageData[stepNumber] = {};
                request.stageData[stepNumber][target.name] = target.value;
                OnboardingForm.render(request, stepNumber);
            }
            return;
        }
        // Conditions cascade: single handler for all cascade fields
        if (_handleCascadeChange(target)) return;
        // Сохранение черновика в локальный буфер при изменении select/checkbox
        if (OnboardingState.get('view') === 'form' && target.closest('#formFields')) {
            _persistDraftToLocal();
        }
    }

    function _handleKeypress(e) {
        const target = e.target;
        if (target.dataset.action === 'onb-listInputKeypress' && e.key === 'Enter') {
            e.preventDefault();
            OnboardingForm.addListItem(target.dataset.value);
        }
    }

    // ── Request CRUD ──

    async function _createRequest() {
        if (_isActionLocked()) return;
        _setActionLock(true);
        _setBtnLoading('#btnNewRequest', true);
        try {
            const result = await CloudStorage.postApi('createOnboardingRequest', {
                data: { leadSource: '', stageData: { 1: { lead_status: 'new' } } }
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка создания'); return; }
            _applyApiResult(result);
            OnboardingState.set('currentStep', 1);
            OnboardingForm.render(result.request, 1);
            _showView('form');
        } catch (e) {
            // Phase 45 F-C1: CONFLICT auto-handled by CloudStorage._handleConflict — silent
            if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
            else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'createRequest' }); }
        } finally {
            _setBtnLoading('#btnNewRequest', false);
            _setActionLock(false);
        }
    }

    async function createRequestFromImport(leadData) {
        const sourceName = leadData.lead_source_name || leadData.lead_source || '';
        try {
            const result = await CloudStorage.postApi('createOnboardingRequest', {
                data: {
                    isImport: true,
                    leadSource: sourceName,
                    stageData: {
                        1: {
                            lead_status: 'new',
                            contact_name: leadData.contact_name || '',
                            phone: leadData.phone || '',
                            email: leadData.email || '',
                            tg_username: leadData.tg_username || '',
                            lead_source: sourceName,
                            geo_country: leadData.geo_country || '',
                            lead_date: leadData.lead_date || ''
                        }
                    }
                }
            });
            if (!result.success) return;
            _applyApiResult(result);
        } catch { /* silent for import */ }
    }

    async function _openRequest(id) {
        let request = _getRequest(id);
        if (!request) return;

        // Phase 45 FINAL FINAL: компактный spinner на КЛИКНУТОЙ row справа
        // (как user сказал: "должен поялвяться справа, где требуется действие, и компактно").
        // ТОЛЬКО для async work (executor auto-assign) — для остальных instant view switch
        // не нуждается в visual feedback.
        const _clickedRow = document.querySelector(`.request-row[data-value="${id}"]`);

        const { myRole, sysRole, isAdmin } = OnboardingUtils.getRoles();
        const step = OnboardingConfig.getStep(request.currentStep);

        // Phase 22 (WMACH-06): REPLACE per audit row partner-onboarding.js:522 — workflow gate
        // for executor auto-assign trigger on opening "new" request. Status check IS the FSM
        // precondition; role check (isExecutorForStep) remains orthogonal.
        // Per audit doc Plan 22-01 design Q1: используем SUBMIT с intent flag (avoids ASSIGN action
        // table inflation; FSM transition new → on_review через SUBMIT уже валидна per Plan 22-02).
        const hasFsmAssign = typeof WorkflowMachine !== 'undefined' && WorkflowMachine;
        const getAssignCtx = function () {
            const isExecForStep = step && OnboardingRoles.isExecutorForStep(sysRole, step.number);
            return {
                role: isExecForStep ? 'executor' : sysRole,
                isAdmin: !!isAdmin,
                executorId: request && request.assigneeEmail,
                userId: OnboardingState.get('userEmail'),
                hasRequiredFields: true,  // assign не валидирует поля — backend re-validates anyway
                hasRejectReason: false,
                intent: 'assign'
            };
        };
        const reqStatusAssign = request && request.status;
        // BFIX: auto-assign submit должен срабатывать ТОЛЬКО для status='new' (незаявленные импортированные заявки).
        // Для status='in_progress' (созданные sales напрямую) assigneeEmail уже установлен при создании —
        // submitStep с {_assign:true} вызывал полный _onbSubmit на backend, который для шага 1
        // (hasReviewer:false) автоматически переводил currentStep=2, оставляя шаг 1 «завершённым» с пустыми данными.
        // FSM canTransition('in_progress', 'SUBMIT', ...) возвращал allowed=true (SUBMIT разрешён для executor),
        // что приводило к выполнению submitStep при каждом открытии заявки на шаге 1.
        const canAssign = reqStatusAssign === 'new' && (hasFsmAssign
            ? WorkflowMachine.canTransition(reqStatusAssign, 'SUBMIT', getAssignCtx).allowed
            : true);
        if (canAssign && step && OnboardingRoles.isExecutorForStep(sysRole, step.number)) {
            // Phase 45 FINAL: row spinner ТОЛЬКО для async auto-assign (есть real wait)
            if (_clickedRow) _clickedRow.classList.add('row-loading');
            try {
                // Phase 22 (WMACH-04): version threading для optimistic locking
                // Phase 44 fix: step должен быть = currentStep (был 0 — backend reject "Step mismatch")
                const result = await CloudStorage.postApi('submitStep', {
                    requestId: request.id, step: step.number, data: { _assign: true }, version: request.version || 0
                });
                if (result.success) _applyApiResult(result);
            } catch (e) {
                // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — swallow silently
                if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
                else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'assignRequest' }); }
            } finally {
                if (_clickedRow) _clickedRow.classList.remove('row-loading');
            }
        }

        try {
            const fromList = _getRequest(id);
            if (!fromList) return;

            // BFIX (audit 2026-05-20): deep-clone request перед set currentRequest.
            // QWIN-01 в render() делает Object.assign(request.stageData, pendingData) —
            // мутирует объект in-place. Раньше fromList и currentRequest были СОДНОЙ
            // ссылкой → WIP-изменения assistant'а становились видны Sales'у через
            // OnboardingState.get('requests')[i].stageData при switch role.
            // Сейчас: clone изолирует local mutations от shared list. Submit/approve/reject
            // явно перезаписывают list через _applyApiResult после server-ack.
            const fresh = (typeof structuredClone === 'function')
                ? structuredClone(fromList)
                : JSON.parse(JSON.stringify(fromList));

            OnboardingState.set('currentRequest', fresh);
            OnboardingState.set('currentStep', fresh.currentStep);

            const decision = OnboardingConfig.getViewDecision(step, fresh, { myRole, sysRole, isAdmin });

            if (decision.stepOverride) {
                OnboardingState.set('currentStep', decision.stepOverride);
                OnboardingForm.render(fresh, decision.stepOverride);
                // Phase 8 / Plan 02: auto-restore из локального буфера (silent если version совпадает)
                _restoreDraftIfPresent(fresh, decision.stepOverride);
                _showView('form');
                return;
            }

            if (decision.view === 'form') {
                OnboardingForm.render(fresh, fresh.currentStep);
                // Phase 8 / Plan 02: auto-restore из локального буфера (silent если version совпадает)
                _restoreDraftIfPresent(fresh, fresh.currentStep);
                _showView('form');
            } else {
                OnboardingReview.render(fresh, fresh.currentStep);
                _showView('review');
            }
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: '_openRequest' });
        }
    }

    function _goToStep(stepNumber) {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const { myRole, sysRole } = OnboardingUtils.getRoles();

        // Executor clicks executorFinal step → show disabled waiting fields
        if (OnboardingRoles.getGlobalModuleRole(sysRole) === 'executor' && OnboardingConfig.isExecutorFinalStep(stepNumber)) {
            if (OnboardingConfig.isExecutorCompleted(request)) {
                OnboardingState.set('currentStep', stepNumber);
                OnboardingForm.render(request, stepNumber);
                _showView('form');
            }
            return;
        }

        OnboardingState.set('currentStep', stepNumber);
        const view = OnboardingState.get('view');

        if (view === 'form') {
            OnboardingForm.render(request, stepNumber);
            // Phase 8 / Plan 02: auto-restore из локального буфера (silent если version совпадает)
            _restoreDraftIfPresent(request, stepNumber);
        } else {
            OnboardingReview.render(request, stepNumber);
        }

        // Scroll to top
        const scroll = document.querySelector('.onb-view:not(.hidden) .detail-main-scroll');
        if (scroll) scroll.scrollTop = 0;
    }

    // ── Actions ──

    async function _submitStep() {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request || _isActionLocked()) return;

        const step = OnboardingConfig.getStep(stepNumber);
        // Phase 44 fix: добавлен myRole — line 973 use OnboardingUtils.isAdminLike(myRole) was ReferenceError
        const { myRole, sysRole } = OnboardingUtils.getRoles();

        // Validate (except handoff-complete confirm phase)
        const isHandoffComplete = step && step.dynamicExecutor && (request.stageData[stepNumber] || {})._handoff_complete;
        if (!isHandoffComplete) {
            const { valid, errors } = OnboardingForm.validate(stepNumber);
            if (!valid) { Toast.error(errors[0]); return; }
        }

        // Block submit on past steps (data уже в request.stageData через render-merge).
        if (stepNumber !== request.currentStep && !isHandoffComplete) {
            // Plan 08-01: past-step submit no-op (data уже в request.stageData через render-merge).
            // Plan 08-02 заменит на flush буфера если нужен.
            return;
        }

        const data = OnboardingForm.collectFormData(stepNumber, { excludeFiles: true });

        _setActionLock(true);
        _setBtnLoading('#btnFormSubmit', true);
        // Also lock status-submit button if present
        _setBtnLoading('#btnStatusSubmit', true);
        try {
            // Upload pending files (base64) separately to avoid CORS/payload-size issues
            const pendingFiles = OnboardingForm.getPendingFiles();
            for (const [fieldId, value] of Object.entries(pendingFiles)) {
                // Multiple files (array of data URLs)
                if (Array.isArray(value)) {
                    const existingUrls = Array.isArray(data[fieldId]) ? data[fieldId].filter(u => !u.startsWith('data:')) : [];
                    const uploadedUrls = [...existingUrls];
                    for (const dataUrl of value) {
                        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                        if (!match) continue;
                        const uploadResult = await CloudStorage.postApi('uploadOnboardingFile', {
                            requestId: request.id, fieldName: fieldId, base64: match[2], mimeType: match[1]
                        });
                        if (uploadResult.success && uploadResult.url) {
                            uploadedUrls.push(uploadResult.url);
                        } else {
                            Toast.error(uploadResult.error || 'Ошибка загрузки файла ' + fieldId);
                            return;
                        }
                    }
                    data[fieldId] = uploadedUrls;
                    OnboardingForm.setFileUrl(fieldId, uploadedUrls);
                    continue;
                }
                // Single file
                const match = value.match(/^data:([^;]+);base64,(.+)$/);
                if (!match) continue;
                const uploadResult = await CloudStorage.postApi('uploadOnboardingFile', {
                    requestId: request.id, fieldName: fieldId, base64: match[2], mimeType: match[1]
                });
                if (uploadResult.success && uploadResult.url) {
                    data[fieldId] = uploadResult.url;
                    OnboardingForm.setFileUrl(fieldId, uploadResult.url);
                } else {
                    Toast.error(uploadResult.error || 'Ошибка загрузки файла ' + fieldId);
                    return;
                }
            }

            // Helper: build optimistic op before the actual API call(s)
            const _applyOptimisticSubmit = (opts = {}) => {
                const requests = OnboardingState.get('requests') || [];
                const snapshot = structuredClone(requests);
                const reqIdx = requests.findIndex(r => r.id === request.id);
                if (reqIdx !== -1) {
                    requests[reqIdx]._pending = true;
                    requests[reqIdx].status = 'on_review';
                    // BFIX: write collected form data into stageData optimistically so
                    // OnboardingReview.render() displays actual field values immediately
                    // instead of "—" during the ~1s round-trip to the server.
                    requests[reqIdx].stageData = {
                        ...(requests[reqIdx].stageData || {}),
                        [stepNumber]: data
                    };
                }
                OnboardingState.set('requests', requests);
                OnboardingList.applyFilters();
                const reqInState = reqIdx !== -1 ? requests[reqIdx] : request;
                // Only show review UI optimistically if there's a reviewer for this step.
                // Steps without a reviewer are auto-promoted by the server — showing review
                // mode would flash an incorrect intermediate state for ~1 second.
                // BFIX handoff-flash: для dynamicExecutor handoff (autoHandoff + saveDraft+approveStep)
                // не рендерим optimistic review-view, потому что после server-ack идёт немедленный
                // _openRequest(request.id) с переходом на корректный target view. Optimistic review
                // показывает артефактный экран 'На проверке' с одним полем 'account_creator=Проверяющий'
                // (остальные скрыты visibility-правилами в confirm-фазе для reviewer-handoff контекста).
                // Аналогично прецедентам BFIX approve-flash (~1157) и BFIX reject-flash (~1267).
                if (!opts.suppressReviewRender && OnboardingConfig.hasReviewer(stepNumber)) {
                    OnboardingReview.render(reqInState, stepNumber);
                    _showView('review');
                }
                const opId = OnboardingState.getOptimistic().apply({
                    stateRef: requests,
                    index: reqIdx,
                    snapshot,
                    operation: 'update',
                    item: reqInState,
                    onRollback: (error) => {
                        OnboardingList.applyFilters();
                        const restoredReq = _getRequest(request.id);
                        if (restoredReq) {
                            OnboardingState.set('currentRequest', restoredReq);
                            OnboardingForm.render(restoredReq, stepNumber);
                        }
                        _showView('form');
                        // BFIX: CONFLICT errors already handled by _handleConflict (Toast + reload)
                        // — suppress duplicate error toast to avoid double-toasting on self-conflict.
                        if (error && error._conflictHandled) return;
                        Toast.error('Ошибка отправки: ' + error.message, 6000, {
                            action: { label: 'Повторить', callback: () => _submitStep() }
                        });
                    }
                });
                return opId;
            };

            // Reviewer filling data on dynamicExecutor step → save draft + approve (handoff)
            // AutoHandoff: reviewer submits from in_progress → submitStep + approveStep (handoff)
            // Only when handoff NOT yet complete (first reviewer fill, not executor confirm)
            if (OnboardingConfig.isWorkStatus(request.status) && step && step.dynamicExecutor && step.dynamicExecutor.autoHandoff && !isHandoffComplete) {
                data[step.dynamicExecutor.field] = step.dynamicExecutor.defaultValue;
                // BFIX handoff-flash: подавить optimistic review-рендер — после server-ack идёт _openRequest
                const opId = _applyOptimisticSubmit({ suppressReviewRender: true });
                try {
                    // Phase 22 (WMACH-04): version threading для optimistic locking
                    const submitResult = await CloudStorage.postApi('submitStep', {
                        requestId: request.id, step: stepNumber, data: data, version: request.version || 0
                    });
                    if (!submitResult.success) { OnboardingState.getOptimistic().rollback(opId, new Error(submitResult.error || 'Ошибка')); return; }
                    _applyApiResult(submitResult);
                    // Re-read version after submit (backend incremented it)
                    const reqAfterSubmit = _getRequest(request.id) || request;
                    const approveResult = await CloudStorage.postApi('approveStep', {
                        requestId: request.id, step: stepNumber, comment: '', version: reqAfterSubmit.version || 0
                    });
                    if (!approveResult.success) { OnboardingState.getOptimistic().rollback(opId, new Error(approveResult.error || 'Ошибка')); return; }
                    OnboardingState.getOptimistic().confirm(opId);
                    _applyApiResult(approveResult);
                    // QWIN-01: успешный submitStep+approveStep — очищаем dirty tracking
                    if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDirty) OnboardingForm.clearDirty();
                    if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDraftBuffer) OnboardingForm.clearDraftBuffer(request.id, stepNumber);
                    Toast.success('Создание завершено, передано в работу');
                    _openRequest(request.id);
                } catch (e) {
                    // Phase 22 (WMACH-04): CONFLICT auto-handled — rollback optimistic state silently
                    if (e && e._conflictHandled) {
                        OnboardingState.getOptimistic().rollback(opId, e);
                        return;
                    }
                    OnboardingState.getOptimistic().rollback(opId, e);
                }
                return;
            }

            // Phase 22 (WMACH-06): REPLACE per audit row partner-onboarding.js:761 — workflow gate
            // for dynamicExecutor handoff (saveDraft + approveStep compound flow).
            // Per audit doc Plan 22-01 design Q2: используем APPROVE с intent flag 'handoff'.
            // FSM transition on_review → approved (или completed) через APPROVE валидна per Plan 22-02.
            const hasFsmHandoff = typeof WorkflowMachine !== 'undefined' && WorkflowMachine;
            const getHandoffCtx = function () {
                const { sysRole: hSysRole, isAdmin: hIsAdmin } = OnboardingUtils.getRoles();
                const isReviewer = step && OnboardingRoles.isReviewerForStep(hSysRole, step.number);
                const isExecutor = step && OnboardingRoles.isExecutorForStep(hSysRole, step.number);
                return {
                    role: isReviewer ? 'reviewer' : (isExecutor ? 'executor' : hSysRole),
                    isAdmin: !!hIsAdmin,
                    executorId: request && request.assigneeEmail,
                    userId: OnboardingState.get('userEmail'),
                    hasRequiredFields: true,
                    hasRejectReason: false,
                    intent: 'handoff'
                };
            };
            const reqStatusHandoff = request && request.status;
            const canHandoff = hasFsmHandoff
                ? WorkflowMachine.canTransition(reqStatusHandoff, 'APPROVE', getHandoffCtx).allowed
                : (reqStatusHandoff === 'on_review');  // fallback when FSM unavailable
            if (canHandoff && step && step.dynamicExecutor) {
                // Pre-submit freshness check: verify request is still on_review
                const freshStatus = await CloudStorage.postApi('getOnboardingStatus', {
                    requestId: request.id
                });
                if (freshStatus.success && freshStatus.status !== 'on_review') {
                    Toast.warning('Заявка была возвращена с проверки. Обновляю...');
                    const listResult = await CloudStorage.postApi('getOnboardingRequests', {});
                    if (listResult.requests) OnboardingState.set('requests', listResult.requests);
                    _openRequest(request.id);
                    return;
                }

                // BFIX handoff-flash: подавить optimistic review-рендер — после server-ack идёт _openRequest
                const opId = _applyOptimisticSubmit({ suppressReviewRender: true });
                try {
                    // Phase 22 (WMACH-04): version threading для optimistic locking
                    // BFIX: capture saveDraft result to get updated version — discarding result
                    // caused reqAfterSave.version to stay at pre-saveDraft value → approveStep
                    // sent stale version → backend CONFLICT (version N vs expected N+1).
                    const saveDraftResult = await CloudStorage.postApi('saveDraft', {
                        requestId: request.id, step: stepNumber, data: data, version: request.version || 0
                    });
                    // Update local state with new version from saveDraft response
                    let approveVersion = request.version || 0;
                    if (saveDraftResult && typeof saveDraftResult.version === 'number') {
                        approveVersion = saveDraftResult.version;
                        const currentReq = OnboardingState.get('currentRequest');
                        if (currentReq && currentReq.id === request.id) {
                            currentReq.version = saveDraftResult.version;
                            const reqs = OnboardingState.get('requests') || [];
                            const idx = reqs.findIndex(r => r.id === request.id);
                            if (idx !== -1) reqs[idx].version = saveDraftResult.version;
                        }
                    }
                    const approveResult = await CloudStorage.postApi('approveStep', {
                        requestId: request.id, step: stepNumber, comment: '', version: approveVersion
                    });
                    if (!approveResult.success) { OnboardingState.getOptimistic().rollback(opId, new Error(approveResult.error || 'Ошибка')); return; }
                    OnboardingState.getOptimistic().confirm(opId);
                    _applyApiResult(approveResult);
                    // QWIN-01: успешный saveDraft+approveStep — очищаем dirty tracking
                    if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDirty) OnboardingForm.clearDirty();
                    if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDraftBuffer) OnboardingForm.clearDraftBuffer(request.id, stepNumber);
                    Toast.success('Создание завершено, передано в работу');
                    _openRequest(request.id);
                } catch (e) {
                    // Phase 22 (WMACH-04): CONFLICT auto-handled — rollback optimistic state silently
                    if (e && e._conflictHandled) {
                        OnboardingState.getOptimistic().rollback(opId, e);
                        return;
                    }
                    OnboardingState.getOptimistic().rollback(opId, e);
                }
                return;
            }

            // Freshness check: re-fetch requests and verify state hasn't changed
            const freshList = await CloudStorage.postApi('getOnboardingRequests', {});
            // BFIX: track fresh version from server — use it for submitStep to avoid self-conflict
            // caused by autosave version drift (autosave increments server version but previously
            // didn't update local currentRequest.version before this point).
            let _submitVersion = request.version || 0;
            if (freshList.requests) {
                OnboardingState.set('requests', freshList.requests);
                const freshReq = freshList.requests.find(r => r.id === request.id);
                if (freshReq) {
                    if (freshReq.currentStep !== request.currentStep || freshReq.status !== request.status) {
                        Toast.warning('Данные заявки изменились. Обновляю...');
                        _openRequest(request.id);
                        return;
                    }
                    // Use fresh version for submitStep — prevents CONFLICT when autosave incremented
                    // server version but local request.version was not updated (fire-and-forget autosave).
                    _submitVersion = typeof freshReq.version === 'number' ? freshReq.version : _submitVersion;
                }
            }

            const opId = _applyOptimisticSubmit();
            let result;
            try {
                // Phase 22 (WMACH-04): version threading для optimistic locking
                result = await CloudStorage.postApi('submitStep', {
                    requestId: request.id, step: stepNumber, data: data, version: _submitVersion
                });
                if (!result.success) { OnboardingState.getOptimistic().rollback(opId, new Error(result.error || 'Ошибка')); return; }
                OnboardingState.getOptimistic().confirm(opId);
                // QWIN-01: основной submitStep success — очищаем dirty tracking (server подтвердил приём)
                if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDirty) OnboardingForm.clearDirty();
                if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDraftBuffer) OnboardingForm.clearDraftBuffer(request.id, stepNumber);
            } catch (e) {
                // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — rollback silently
                if (e && e._conflictHandled) {
                    OnboardingState.getOptimistic().rollback(opId, e);
                    return;
                }
                OnboardingState.getOptimistic().rollback(opId, e);
                return;
            }

            _applyApiResult(result);
            const updated = result.request;

            // Determine toast message based on result
            if (updated.status === 'completed') {
                Toast.success('Заявка завершена!');
            } else if (updated.status === 'cancelled') {
                Toast.warning('Заявка отменена: не прошла антифрод');
            } else if (updated.status === 'on_review') {
                Toast.success('Отправлено на проверку');
            } else {
                Toast.success('Шаг выполнен');
            }

            // Phase 22 (WMACH-06): REPLACE per audit row partner-onboarding.js:837 — workflow gate
            // determining "next step executor is same user → continue editing inline" vs "open review".
            // Status check (in_progress/approved) IS the FSM precondition: SUBMIT действие валидно
            // только из этих source statuses (per WorkflowMachine.transitions table). Replaced со
            // standard availableActions(...).includes('SUBMIT') translation per audit replacement pattern.
            const hasFsmNext = typeof WorkflowMachine !== 'undefined' && WorkflowMachine;
            const getNextStepCtx = function () {
                const isExecForNextStep = OnboardingRoles.isExecutorForStep(sysRole, updated.currentStep);
                return {
                    role: isExecForNextStep ? 'executor' : sysRole,
                    isAdmin: OnboardingUtils.isAdminLike(myRole),
                    executorId: updated.assigneeEmail,
                    userId: OnboardingState.get('userEmail'),
                    hasRequiredFields: true,
                    hasRejectReason: false
                };
            };
            const updatedStatusNext = updated && updated.status;
            const canSubmitNext = hasFsmNext
                ? WorkflowMachine.availableActions(updatedStatusNext, getNextStepCtx).includes('SUBMIT')
                : (updatedStatusNext === 'in_progress' || updatedStatusNext === 'approved');  // fallback when FSM unavailable
            // If next step executor is same user → continue editing
            if (canSubmitNext && OnboardingRoles.isExecutorForStep(sysRole, updated.currentStep)) {
                OnboardingState.set('currentStep', updated.currentStep);
                OnboardingForm.render(updated, updated.currentStep);
                // BFIX: снимаем btn-loading ДО _showView('form') — форма не должна становиться
                // видимой пока кнопка ещё в состоянии загрузки (browser может отрисовать фрейм
                // между _showView и finally). finally делает idempotent second clear.
                _setBtnLoading('#btnFormSubmit', false);
                _setBtnLoading('#btnStatusSubmit', false);
                _setActionLock(false);
                _showView('form');
            } else {
                _openRequest(request.id);
            }
        } catch (e) {
            // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — silent on outer catch too
            if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
            else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'submitStep' }); }
        } finally {
            _setBtnLoading('#btnFormSubmit', false);
            _setBtnLoading('#btnStatusSubmit', false);
            _setActionLock(false);
        }
    }

    async function _approveStep() {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request || request.status !== 'on_review' || _isActionLocked()) return;

        const comment = (document.getElementById('reviewComment') || {}).value || '';

        _setActionLock(true);
        _setBtnLoading('#btnApprove', true);
        let opId = null;
        try {
            // BFIX: read fresh version from state (autosave may have updated it via .then() handler)
            const freshReq = _getRequest(request.id) || request;
            const approveVersion = typeof freshReq.version === 'number' ? freshReq.version : (request.version || 0);

            // OPTIMISTIC: snapshot → mutate status → update list (no re-render of review view)
            const requests = OnboardingState.get('requests') || [];
            const snapshot = structuredClone(requests);
            const reqIdx = requests.findIndex(r => r.id === request.id);
            const isLastStep = OnboardingConfig.getStep(stepNumber) &&
                stepNumber >= OnboardingConfig.getVisibleStepCount(OnboardingState.get('userRole'));
            if (reqIdx !== -1) {
                requests[reqIdx]._pending = true;
                requests[reqIdx].status = isLastStep ? 'completed' : 'approved';
            }
            OnboardingState.set('requests', requests);
            OnboardingList.applyFilters();
            // BFIX approve-flash: do NOT call _openRequest optimistically — onboarding-review.js
            // treats isWorkStatus('approved') as "not yet submitted" and clears all data to {},
            // causing a flash of empty review fields. Re-render only after real server response.
            const reqInState = reqIdx !== -1 ? requests[reqIdx] : request;
            opId = OnboardingState.getOptimistic().apply({
                stateRef: requests,
                index: reqIdx,
                snapshot,
                operation: 'update',
                item: reqInState,
                onRollback: (error) => {
                    OnboardingList.applyFilters();
                    const restoredReq = _getRequest(request.id);
                    if (restoredReq) {
                        OnboardingState.set('currentRequest', restoredReq);
                        OnboardingReview.render(restoredReq, stepNumber);
                    }
                    _showView('review');
                    Toast.error('Ошибка одобрения: ' + error.message, 6000, {
                        action: { label: 'Повторить', callback: () => _approveStep() }
                    });
                }
            });

            // Phase 22 (WMACH-04): version threading для optimistic locking
            const result = await CloudStorage.postApi('approveStep', {
                requestId: request.id, step: stepNumber, comment: comment.trim(), version: approveVersion
            });
            if (!result.success) { OnboardingState.getOptimistic().rollback(opId, new Error(result.error || 'Ошибка')); return; }

            OnboardingState.getOptimistic().confirm(opId);
            _applyApiResult(result);
            // QWIN-01: успешный approveStep — очищаем dirty tracking
            if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDirty) OnboardingForm.clearDirty();
            if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDraftBuffer) OnboardingForm.clearDraftBuffer(request.id, stepNumber);
            Toast.success(result.request.status === 'completed' ? 'Заявка завершена!' : 'Шаг одобрен');
            _openRequest(request.id);
        } catch (e) {
            if (opId) OnboardingState.getOptimistic().rollback(opId, e);
            // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — silent
            if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
            else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'approveStep' }); }
        } finally {
            _setBtnLoading('#btnApprove', false);
            _setActionLock(false);
        }
    }

    async function _rejectStep() {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request || request.status !== 'on_review' || _isActionLocked()) return;

        let comment = '';
        let checklistData = null;

        // Checklist-based review
        if (OnboardingReview.hasReviewChecklist()) {
            const reviewDataArr = OnboardingReview.collectReviewChecklists();
            if (!reviewDataArr || !reviewDataArr.length) return;

            const step = OnboardingConfig.getStep(stepNumber);
            const originalData = request.stageData[stepNumber] || {};
            const allParts = [];
            const allChecklistData = [];

            let missingComment = false;
            for (const reviewData of reviewDataArr) {
                const field = step && step.fields.find(f => f.id === reviewData.fieldId);
                const items = field ? field.items || [] : [];
                const original = (typeof originalData[reviewData.fieldId] === 'object' && originalData[reviewData.fieldId] !== null)
                    ? originalData[reviewData.fieldId] : {};
                // Only count items that executor HAD checked but reviewer UNchecked
                const rejected = items.map((_, idx) => idx).filter(idx => original[idx] && !reviewData.data[idx]);
                const comments = reviewData.data.comments || {};

                for (const idx of rejected) {
                    const label = items[idx].label;
                    const c = comments[idx] || '';
                    if (!c) missingComment = true;
                    allParts.push(c ? `${label}: ${c}` : label);
                }
                allChecklistData.push({ fieldId: reviewData.fieldId, data: reviewData.data });
            }

            if (allParts.length === 0) { Toast.error('Снимите отметку с пунктов, где обнаружены ошибки'); return; }
            if (missingComment) { Toast.error('Укажите комментарий для каждого отклонённого пункта'); return; }

            comment = allParts.join('; ');
            checklistData = allChecklistData;
        } else {
            comment = (document.getElementById('reviewComment') || {}).value || '';
            comment = comment.trim();
            if (!comment) { Toast.error('Добавьте комментарий для возврата'); return; }
        }

        _setActionLock(true);
        _setBtnLoading('#btnReject', true);
        let opId = null;
        try {
            // BFIX: read fresh version from state (autosave may have updated it via .then() handler)
            const freshReqForReject = _getRequest(request.id) || request;
            const rejectVersion = typeof freshReqForReject.version === 'number' ? freshReqForReject.version : (request.version || 0);

            // OPTIMISTIC: snapshot → mutate status → update list (no re-render of review view)
            // BFIX reject-flash: do NOT call _openRequest optimistically — onboarding-review.js
            // isCurrentNotSubmitted guard clears stageData to {} for revision_needed + reviewer,
            // causing a flash of empty review fields. Re-render only after real server response.
            const requests = OnboardingState.get('requests') || [];
            const snapshot = structuredClone(requests);
            const reqIdx = requests.findIndex(r => r.id === request.id);
            if (reqIdx !== -1) {
                requests[reqIdx]._pending = true;
                requests[reqIdx].status = 'revision_needed';
                requests[reqIdx].lastComment = comment;
            }
            OnboardingState.set('requests', requests);
            OnboardingList.applyFilters();
            const reqInState = reqIdx !== -1 ? requests[reqIdx] : request;
            opId = OnboardingState.getOptimistic().apply({
                stateRef: requests,
                index: reqIdx,
                snapshot,
                operation: 'update',
                item: reqInState,
                onRollback: (error) => {
                    OnboardingList.applyFilters();
                    const restoredReq = _getRequest(request.id);
                    if (restoredReq) {
                        OnboardingState.set('currentRequest', restoredReq);
                        OnboardingReview.render(restoredReq, stepNumber);
                    }
                    _showView('review');
                    Toast.error('Ошибка отклонения: ' + error.message, 6000, {
                        action: { label: 'Повторить', callback: () => _rejectStep() }
                    });
                }
            });

            // Phase 22 (WMACH-04): version threading для optimistic locking
            const result = await CloudStorage.postApi('rejectStep', {
                requestId: request.id, step: stepNumber, comment, checklistData, version: rejectVersion
            });
            if (!result.success) { OnboardingState.getOptimistic().rollback(opId, new Error(result.error || 'Ошибка')); return; }

            OnboardingState.getOptimistic().confirm(opId);
            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'revision_needed', lastComment: comment });

            // Merge reviewer's checklist into stageData: update checkbox state, keep executor comments separate
            if (checklistData) {
                const req = _getRequest(request.id);
                if (req && req.stageData && req.stageData[stepNumber]) {
                    for (const cd of checklistData) {
                        const existing = req.stageData[stepNumber][cd.fieldId] || {};
                        const merged = {};
                        // Copy checkbox states from reviewer
                        for (const key of Object.keys(cd.data)) {
                            if (key !== 'comments') merged[key] = cd.data[key];
                        }
                        // Keep executor's comments untouched
                        if (existing.comments) merged.comments = existing.comments;
                        // Store reviewer's comments separately
                        if (cd.data.comments) merged.reviewerComments = cd.data.comments;
                        req.stageData[stepNumber][cd.fieldId] = merged;
                    }
                    OnboardingState.set('requests', OnboardingState.get('requests'));
                }
            }

            // QWIN-01: успешный rejectStep — очищаем dirty tracking
            if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDirty) OnboardingForm.clearDirty();
            if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDraftBuffer) OnboardingForm.clearDraftBuffer(request.id, stepNumber);
            Toast.info('Заявка возвращена на доработку');
            _openRequest(request.id);
        } catch (e) {
            if (opId) OnboardingState.getOptimistic().rollback(opId, e);
            // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — silent
            if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
            else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'rejectStep' }); }
        } finally {
            _setBtnLoading('#btnReject', false);
            _setActionLock(false);
        }
    }

    async function _withdrawStep() {
        const request = OnboardingState.get('currentRequest');
        if (!request || _isActionLocked()) return;

        _setActionLock(true);
        _setBtnLoading('#btnWithdraw', true);
        try {
            // Phase 22 (WMACH-04): version threading для optimistic locking
            const result = await CloudStorage.postApi('withdrawOnboarding', {
                requestId: request.id, step: request.currentStep, version: request.version || 0
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'in_progress' });
            // QWIN-01: успешный withdrawStep — очищаем dirty tracking (возврат с проверки → форма открывается заново)
            if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDirty) OnboardingForm.clearDirty();
            if (typeof OnboardingForm !== 'undefined' && OnboardingForm.clearDraftBuffer) OnboardingForm.clearDraftBuffer(request.id, request.currentStep);
            Toast.info('Заявка возвращена с проверки');
            _openRequest(request.id);
        } catch (e) {
            // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — silent
            if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
            else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'withdrawStep' }); }
        } finally {
            _setBtnLoading('#btnWithdraw', false);
            _setActionLock(false);
        }
    }

    function _toggleStatusDropdown() {
        const dropdown = document.getElementById('statusDropdown');
        if (dropdown) dropdown.classList.toggle('hidden');
    }

    function _toggleSettingsDropdown() {
        const dropdown = document.getElementById('settingsDropdown');
        if (dropdown) dropdown.classList.toggle('hidden');
    }

    function _closeSettingsDropdown() {
        const dropdown = document.getElementById('settingsDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }

    function _updateLeadStatusUI(value) {
        // BFIX: прямые DOM-мутации Lit-managed узлов (labelEl.textContent, opt.classList)
        // удалены — они повреждали Lit ChildPart internal state (удаляли Comment markers)
        // и вызывали TypeError в следующем _litRenderInto(statusWrap).
        // OnboardingForm.render ниже делает полный Lit re-render, который корректно обновит UI.
        // Phase 29 RULES-MIG: visibleWhen DOM-toggle удалён в пользу declarative re-render.
        // reject_reason теперь использует visibility[] (eq lead_status === 'refused') — full
        // form re-render пересчитывает skip-list через FieldRenderer.shouldShowField → evaluator.
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (request && stepNumber && typeof OnboardingForm !== 'undefined' && OnboardingForm
                && typeof OnboardingForm.render === 'function') {
            OnboardingForm.render(request, stepNumber);
        }
    }

    function _selectLeadStatus(value) {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request) return;

        // Close dropdown
        const dropdown = document.getElementById('statusDropdown');
        if (dropdown) dropdown.classList.add('hidden');

        if (!request.stageData) request.stageData = {};
        if (!request.stageData[stepNumber]) request.stageData[stepNumber] = {};

        const prevStatus = request.stageData[stepNumber].lead_status;

        // For "refused" — show reject_reason, update button, don't validate yet
        if (value === 'refused' && prevStatus !== 'refused') {
            request.stageData[stepNumber].lead_status = value;
            _updateLeadStatusUI(value);
            const textarea = document.getElementById('field_reject_reason');
            if (textarea) setTimeout(() => textarea.focus(), 100);
            return;
        }

        // Validate before applying status
        request.stageData[stepNumber].lead_status = value;
        const { valid, errors } = OnboardingForm.validate(stepNumber);
        if (!valid) {
            // Revert status
            request.stageData[stepNumber].lead_status = prevStatus;
            Toast.error(errors[0]);
            return;
        }

        // Validation passed — update UI and submit
        _updateLeadStatusUI(value);

        _submitStep();
    }

    function _deleteSelectedRequests() {
        const ids = OnboardingList.getSelectedIds();
        if (ids.length === 0) return;

        _showConfirm(
            'Удалить заявки?',
            `Будет удалено заявок: ${ids.length}. Это действие нельзя отменить.`,
            async () => {
                _setActionLock(true);
                _setBtnLoading('#confirmOk', true);
                let opId = null;
                try {
                    // OPTIMISTIC: snapshot → remove selected from array → re-render
                    const requests = OnboardingState.get('requests') || [];
                    const snapshot = structuredClone(requests);
                    // Mark pending on each item to be deleted, then filter out
                    ids.forEach(id => {
                        const item = requests.find(r => r.id === id);
                        if (item) item._pending = true;
                    });
                    const remaining = requests.filter(r => !ids.includes(r.id));
                    // Replace array content in-place to preserve reference for OptimisticManager
                    requests.length = 0;
                    requests.push(...remaining);
                    OnboardingState.set('requests', requests);
                    OnboardingList.applyFilters();
                    // Use first deleted item as representative for OptimisticManager
                    const firstDeletedItem = snapshot.find(r => ids.includes(r.id)) || { id: ids[0] };
                    opId = OnboardingState.getOptimistic().apply({
                        stateRef: requests,
                        index: -1,
                        snapshot,
                        operation: 'delete',
                        item: firstDeletedItem,
                        onRollback: (error) => {
                            OnboardingList.applyFilters();
                            Toast.error('Ошибка удаления: ' + error.message, 6000, {
                                action: { label: 'Повторить', callback: () => _deleteSelectedRequests() }
                            });
                        }
                    });

                    const result = await CloudStorage.postApi('deleteOnboardings', { requestIds: ids });
                    if (!result.success) { OnboardingState.getOptimistic().rollback(opId, new Error(result.error || 'Ошибка')); return; }

                    OnboardingState.getOptimistic().confirm(opId);
                    CloudStorage.clearCacheNamespace('onboardingRequests');
                    // Phase 63 (TS-PROTO-06): capture server ts so next read short-circuits
                    if (typeof CloudStorage._writeNsTs === 'function') {
                        CloudStorage._writeNsTs('onboardings', (result && typeof result.ts === 'number') ? result.ts : Date.now());
                    }
                    await OnboardingList.goToOnboardingPage(OnboardingList.getCurrentPage());
                    Toast.success(`Удалено заявок: ${ids.length}`);
                } catch (e) {
                    if (opId) OnboardingState.getOptimistic().rollback(opId, e);
                    // Phase 45 F-C2: CONFLICT auto-handled by CloudStorage._handleConflict — silent (defensive consistency)
                    if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
                    else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'deleteRequests' }); }
                } finally {
                    _setBtnLoading('#confirmOk', false);
                    _setActionLock(false);
                }
            }
        );
    }

    async function _confirmCancelRequest() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        _setActionLock(true);
        _setBtnLoading('#confirmOk', true);
        try {
            // Phase 22 (WMACH-04): version threading для optimistic locking
            const result = await CloudStorage.postApi('cancelOnboarding', { requestId: request.id, version: request.version || 0 });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'cancelled' });
            Toast.warning('Заявка отменена');
            _openRequest(request.id);
        } catch (e) {
            // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — silent
            if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
            else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'cancelRequest' }); }
        } finally {
            _setBtnLoading('#confirmOk', false);
            _setActionLock(false);
        }
    }

    async function _confirmReactivateRequest() {
        const request = OnboardingState.get('currentRequest');
        if (!request || request.status !== 'cancelled') return;

        _setActionLock(true);
        _setBtnLoading('#confirmOk', true);
        try {
            // Phase 22 (WMACH-04): version threading для optimistic locking
            const result = await CloudStorage.postApi('reactivateOnboarding', { requestId: request.id, version: request.version || 0 });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'in_progress' });
            Toast.success('Заявка восстановлена');
            _openRequest(request.id);
        } catch (e) {
            // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — silent
            if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
            else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'reactivateRequest' }); }
        } finally {
            _setBtnLoading('#confirmOk', false);
            _setActionLock(false);
        }
    }

    // ── Form Dropdowns ──
    // QWIN-03: делегируем в shared/js/dropdown-helper.js
    // BFIX-15: evt передаётся для touchend.preventDefault внутри DropdownHelper.toggle

    function _toggleFormDropdown(trigger, evt) {
        DropdownHelper.toggle(trigger, evt);
    }

    function _selectFormDropdown(target) {
        DropdownHelper.select(target, target.dataset.value ?? '', target.textContent);
    }

    // ── History Modal ──

    function _showHistoryModal() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;
        // Attach history from cached API data
        const allHistory = OnboardingState.get('history') || {};
        const reqWithHistory = { ...request, history: allHistory[request.id] || request.history || [] };
        OnboardingSteps.renderHistoryModal(reqWithHistory);
        _openModal('historyModal');
    }

    // ── Reassign ──

    async function _showReassignModal() {
        // BFIX (audit 2026-05-19): открыть модалку СРАЗУ + спиннер на trigger-кнопке.
        // Раньше: await getEmployees() ДО _openModal → click "Передать" → пользователь
        // не видит ничего до завершения fetch → "резко появляется модалка".
        // Сейчас: модалка открывается мгновенно с "Загрузка..." в dropdown'е (visual feedback),
        // btnReassign показывает spinner в bottom-bar до завершения fetch.
        const menu = document.getElementById('reassignTargetMenu');
        const input = document.getElementById('reassignTargetValue');
        const label = document.getElementById('reassignTargetLabel');
        const trigger = document.getElementById('reassignTargetTrigger');

        // 1) Сброс полей в начальное состояние ДО открытия (чтобы старое значение не мигало).
        if (input) input.value = '';
        if (label) label.textContent = 'Выберите менеджера';
        if (trigger) trigger.classList.add('placeholder');
        if (menu) {
            _litRenderInto(menu, (html) => html`<div class="dropdown-item dropdown-item--disabled">Загрузка...</div>`);
        }

        const reasonMenu = document.getElementById('reassignReasonMenu');
        const reasonInput = document.getElementById('reassignReasonValue');
        if (reasonMenu && !reasonMenu.dataset.populated) {
            // Phase 52 LIT-FIN-01-A: Lit auto-escapes r.value/r.label (XSS-proof для config-derived values).
            _litRenderInto(reasonMenu, (html) => html`
                <div class="dropdown-item active" data-action="onb-selectFormDropdown" data-value="">Выберите причину</div>
                ${OnboardingConfig.REASSIGN_REASONS.map(r => html`<div class="dropdown-item" data-action="onb-selectFormDropdown" data-value="${r.value}">${r.label}</div>`)}
            `);
            reasonMenu.dataset.populated = '1';
        }
        if (reasonInput) reasonInput.value = '';
        const reasonLabel = document.getElementById('reassignReasonLabel');
        const reasonTrigger = document.getElementById('reassignReasonTrigger');
        if (reasonLabel) reasonLabel.textContent = 'Выберите причину';
        if (reasonTrigger) reasonTrigger.classList.add('placeholder');

        // 2) Открываем модалку — пользователь сразу видит UI с "Загрузка..." в dropdown.
        _openModal('reassignModal');

        // 3) Fetch employees в фоне (БЕЗ spinner на btnReassign — модалка уже даёт
        //    visual feedback через "Загрузка..." в dropdown'е).
        // BFIX (audit 2026-05-20): фильтруем текущего assignee из списка — нет смысла
        // reassign на того же кто уже владеет заявкой. UX clarity + предотвращает
        // backend error на no-op reassign.
        if (menu) {
            try {
                if (typeof CloudStorage.clearCacheNamespace === 'function') {
                    CloudStorage.clearCacheNamespace('employees');
                }
                const employees = await CloudStorage.getEmployees();
                const currentReq = OnboardingState.get('currentRequest');
                const currentAssignee = (currentReq && currentReq.assigneeEmail) ? String(currentReq.assigneeEmail).toLowerCase() : '';
                const filtered = employees.filter(emp =>
                    !currentAssignee || String(emp.email || '').toLowerCase() !== currentAssignee
                );
                _litRenderInto(menu, (html) => html`
                    <div class="dropdown-item active" data-action="onb-selectFormDropdown" data-value="">Выберите менеджера</div>
                    ${filtered.map(emp => {
                        const labelText = emp.name || emp.email;
                        return html`<div class="dropdown-item" data-action="onb-selectFormDropdown" data-value="${emp.email}" data-label="${labelText}">${labelText}</div>`;
                    })}
                `);
            } catch {
                _litRenderInto(menu, (html) => html`<div class="dropdown-item active" data-action="onb-selectFormDropdown" data-value="">Выберите менеджера</div>`);
            }
        }
    }

    async function _confirmReassign() {
        const request = OnboardingState.get('currentRequest');
        if (!request || _isActionLocked()) return;

        const target = document.getElementById('reassignTargetValue')?.value || '';
        const targetLabel = document.getElementById('reassignTargetLabel')?.textContent || target;
        const targetName = target ? targetLabel : '';
        const reason = document.getElementById('reassignReasonValue')?.value || '';
        const comment = (document.getElementById('reassignComment')?.value || '').trim();

        if (!target) { Toast.error('Выберите менеджера'); return; }
        if (!reason) { Toast.error('Выберите причину'); return; }
        // BFIX (audit 2026-05-20): client-side guard от reassign на того же assignee
        // (dropdown уже фильтрует, но защитимся от race / direct input).
        if (request.assigneeEmail && target.toLowerCase() === String(request.assigneeEmail).toLowerCase()) {
            Toast.warning('Заявка уже у этого менеджера');
            return;
        }

        _setActionLock(true);
        const btn = document.querySelector('[data-action="onb-confirmReassign"]');
        _setBtnLoading(btn, true);
        try {
            // Phase 22 (WMACH-04): version threading для optimistic locking
            // BFIX (audit 2026-05-20): field name fix — real backend route ожидает
            // `newAssignee` (см. ROUTE_TABLE в AppsScript_Test.js). Раньше слали
            // targetEmail — mock-backend принимал alias, реальный backend reject'ил
            // с "New assignee email is required". targetName тоже переименован
            // для consistency (backend читает payload.newAssigneeName).
            const result = await CloudStorage.postApi('reassignOnboarding', {
                requestId: request.id,
                newAssignee: target,
                newAssigneeName: targetName,
                reason: reason,
                comment: comment,
                version: request.version || 0
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { assigneeEmail: target, assigneeName: targetName });
            _closeModal('reassignModal');
            Toast.success('Заявка передана');
            _openRequest(request.id);
        } catch (e) {
            // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — silent
            if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
            else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'reassign' }); }
        } finally {
            _setBtnLoading(btn, false);
            _setActionLock(false);
        }
    }

    // ── Rollback ──

    function _showRollbackModal() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const menu = document.getElementById('rollbackTargetMenu');
        const input = document.getElementById('rollbackTargetValue');
        const label = document.getElementById('rollbackTargetLabel');
        const trigger = document.getElementById('rollbackTargetTrigger');
        if (!menu) return;

        // Phase 52 LIT-FIN-01-A: Lit render — auto-escapes step labels (XSS-proof для config-derived).
        const steps = [];
        for (let i = 1; i < request.currentStep; i++) {
            steps.push({ value: i, label: OnboardingConfig.getStepLabel(i) });
        }
        _litRenderInto(menu, (html) => html`
            <div class="dropdown-item active" data-action="onb-selectFormDropdown" data-value="">Выберите шаг</div>
            ${steps.map(s => html`<div class="dropdown-item" data-action="onb-selectFormDropdown" data-value="${s.value}">${s.label}</div>`)}
        `);
        if (input) input.value = '';
        if (label) label.textContent = 'Выберите шаг';
        if (trigger) trigger.classList.add('placeholder');
        _openModal('rollbackModal');
    }

    async function _confirmRollback() {
        const request = OnboardingState.get('currentRequest');
        if (!request || _isActionLocked()) return;

        const targetStep = parseInt(document.getElementById('rollbackTargetValue')?.value || '', 10);
        const comment = document.getElementById('rollbackComment').value.trim();

        if (!targetStep) { Toast.error('Выберите шаг'); return; }

        _setActionLock(true);
        const btn = document.querySelector('[data-action="onb-confirmRollback"]');
        _setBtnLoading(btn, true);
        try {
            // Phase 22 (WMACH-04): version threading для optimistic locking
            const result = await CloudStorage.postApi('rollbackOnboarding', {
                requestId: request.id, targetStep, comment, version: request.version || 0
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'in_progress', currentStep: targetStep, lastComment: comment });
            _closeModal('rollbackModal');
            Toast.info('Откат выполнен');
            _openRequest(request.id);
        } catch (e) {
            // Phase 22 (WMACH-04): CONFLICT auto-handled by CloudStorage._handleConflict — silent
            if (e && e._conflictHandled) { /* handler уже показал Toast.warning + reload */ }
            else { ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'rollback' }); }
        } finally {
            _setBtnLoading(btn, false);
            _setActionLock(false);
        }
    }

    // ── Helpers ──

    function _toggleFilterDropdown() {
        const dropdown = document.getElementById('filterDropdown');
        if (dropdown) dropdown.classList.toggle('hidden');
    }

    function _closeFilterDropdown() {
        const dropdown = document.getElementById('filterDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }

    function _selectFilter(value, target) {
        // Update active state
        const dropdown = document.getElementById('filterDropdown');
        if (dropdown) {
            dropdown.querySelectorAll('.dropdown-item').forEach(o => o.classList.remove('active'));
            target.classList.add('active');
        }
        // Update label
        const label = document.getElementById('filterLabel');
        if (label) label.textContent = target.textContent;
        // Apply filter — reset to page 1 with new server-side status filter
        OnboardingState.set('filters.status', value.startsWith('status:') ? value.replace('status:', '') : '');
        OnboardingList.goToOnboardingPage(1);
        // Close
        _closeFilterDropdown();
    }

    // _setDateNow removed — handled by DatePicker component

    function _getFullResUrl(src) {
        // Already lh3 CDN — original resolution, use as-is
        if (src.includes('lh3.googleusercontent.com/d/')) return src;
        // Old thumbnail URL (sz=w400) → extract fileId → lh3 CDN original
        const thumbMatch = src.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/);
        if (thumbMatch) return 'https://lh3.googleusercontent.com/d/' + thumbMatch[1];
        // data: URL or unknown — use as-is
        return src;
    }

    function _openPhotoLightbox(target) {
        const img = target.tagName === 'IMG' ? target : target.querySelector('img');
        if (!img || !img.src) return;
        if (!img.src.startsWith('data:') && !img.src.startsWith('http')) return;

        const fullSrc = _getFullResUrl(img.src);

        const overlay = document.createElement('div');
        overlay.className = 'photo-lightbox';

        const photo = document.createElement('img');
        photo.src = fullSrc;
        photo.alt = '';

        // Fallback: if lh3 fails, try high-res thumbnail
        photo.onerror = function() {
            const thumbMatch = fullSrc.match(/lh3\.googleusercontent\.com\/d\/(.+)/);
            if (thumbMatch && !this._fallback) {
                this._fallback = true;
                this.src = 'https://drive.google.com/thumbnail?id=' + thumbMatch[1] + '&sz=w2000';
            }
        };

        overlay.appendChild(photo);
        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
    }

    // ── Modals ──

    function _openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        // Phase 27 BFIX-19: <app-modal> Lit component (historyModal) использует boolean property API
        if (modal.tagName === 'APP-MODAL') {
            modal.open = true;
        } else {
            modal.classList.add('active');
        }
    }

    function _closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            // Phase 27 BFIX-19: <app-modal> compat
            if (modal.tagName === 'APP-MODAL') {
                modal.open = false;
            } else {
                modal.classList.remove('active');
            }
        }
        _confirmCallback = null;
    }

    function _showConfirm(title, message, callback) {
        // Phase 30 LIT-MIG-04: confirmTitle <h2> заменён на <app-modal title=""> — set via property
        const modal = document.getElementById('confirmModal');
        if (modal) modal.title = title;
        document.getElementById('confirmMessage').textContent = message;
        _confirmCallback = callback;
        _openModal('confirmModal');
    }

    // ── DEV Role Switcher ──

    function _setupDevRoleSwitcher() {
        const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        const { isAdmin } = OnboardingUtils.getRoles();
        const switcher = document.getElementById('roleSwitcher');
        if (isLocal && isAdmin && switcher) {
            switcher.classList.remove('hidden');
        }
    }

    async function _switchDevRole(devRole, target) {
        OnboardingState.set('systemRole', devRole);
        OnboardingState.set('userRole', OnboardingRoles.getGlobalModuleRole(devRole));
        document.querySelectorAll('#roleSwitcher .dev-role-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.value === devRole)
        );
        _updateToolbarForRole();
        OnboardingList.setupDefaultFilters();

        // BFIX (audit 2026-05-20): force fresh fetch при DEV switch — discards
        // in-memory mutations from previous role's WIP edits. Mirrors real-world
        // scenario where Sales/Assistant are separate sessions (clean server data).
        // Раньше: assistant менял dropdown → QWIN-01 мутировал request.stageData
        // → switch to Sales → видел WIP-изменения через shared object reference.
        try {
            if (typeof CloudStorage !== 'undefined' && typeof CloudStorage.clearCacheNamespace === 'function') {
                CloudStorage.clearCacheNamespace('onboardings');
            }
            await _loadRequests();
        } catch (_) { /* defensive — не блокировать switch */ }

        OnboardingList.applyFilters();

        // Re-render current view if not list
        const view = OnboardingState.get('view');
        if (view !== 'list') {
            _showView('list');
        }
    }

    // ── Escape handler (modals handled by PageLifecycle) ──

    function _handleKeydown(e) {
        if (e.key !== 'Escape') return;

        // Modals are handled by PageLifecycle — skip if any modal is active
        // Phase 30 LIT-MIG-04: also skip if any <app-modal> is open (avoids navigating to list when modal closes)
        if (document.querySelector('.modal.active')) return;
        if (document.querySelector('app-modal[open]')) return;

        // Close lightbox
        const lightbox = document.querySelector('.photo-lightbox');
        if (lightbox) {
            lightbox.remove();
            return;
        }
        // Back to list
        if (OnboardingState.get('view') !== 'list') {
            _showView('list');
        }
    }

    // ── Destroy ──

    function _destroy() {
        _stopSmartSync();
        _uninstallBeforeUnloadGuard();   // Phase 8 / Plan 03: cleanup before-unload listener
        OnboardingSource.destroy();
        OnboardingRoles.destroy();
        document.removeEventListener('click', _handleClick);
        document.removeEventListener('input', _handleInput);
        document.removeEventListener('change', _handleChange);
        document.removeEventListener('keydown', _handleKeydown);
        document.removeEventListener('keypress', _handleKeypress);
    }

    // -- Smart Sync (lightweight polling 10s) --

    function _startSmartSync() {
        _stopSmartSync();
        _pollTimer = setInterval(_checkForUpdates, SYNC_INTERVAL);
        _visHandler = () => {
            if (document.visibilityState === 'visible') {
                _checkForUpdates();
                if (!_pollTimer) _pollTimer = setInterval(_checkForUpdates, SYNC_INTERVAL);
            } else {
                clearInterval(_pollTimer);
                _pollTimer = null;
            }
        };
        document.addEventListener('visibilitychange', _visHandler);
    }

    function _stopSmartSync() {
        if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
        if (_visHandler) { document.removeEventListener('visibilitychange', _visHandler); _visHandler = null; }
    }

    async function _checkForUpdates() {
        if (_isActionLocked()) return;
        if (document.visibilityState === 'hidden') return;
        try {
            // Phase 63 (TS-PROTO-06): replace legacy ts probe с conditional GET через
            // getOnboardingRequests. Backend returns {notModified:true, ts} when nothing changed
            // → no-op (skip render); else returns full data → existing reload pipeline triggers.
            const _clientTs = (typeof CloudStorage._readNsTs === 'function')
                ? CloudStorage._readNsTs('onboardings')
                : null;
            // BFIX (audit 2026-05-20): polling postApi ошибки тоже silent — GAS backend
            // транзитно возвращает 500 (sheet lock, deploy, quota). Background polling
            // не должен показывать alarming toast пользователю; next interval скорее
            // всего успешен. Console.warn для debug, return для skip cycle.
            let result;
            try {
                result = await CloudStorage.postApi('getOnboardingRequests', _clientTs ? { clientTs: _clientTs } : {});
            } catch (apiError) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[partner-onboarding._checkForUpdates] silent polling probe error:',
                        apiError && apiError.message);
                }
                return;
            }
            // notModified short-circuit — нет изменений с момента _clientTs, skip render
            if (result && result.notModified === true) return;
            // Else: данные изменились — server returned full envelope (with new ts).
            // raw postApi не идёт через CloudStorage.getOnboardingRequests → manually capture ts:
            if (typeof CloudStorage._writeNsTs === 'function' && result && typeof result.ts === 'number') {
                CloudStorage._writeNsTs('onboardings', result.ts);
            }
            const serverTs = (result && result.ts !== undefined) ? String(result.ts) : '0';
            if (serverTs === _lastModifiedTs) return;
            _lastModifiedTs = serverTs;
            // Pending guard: skip sync if optimistic operations are in-flight
            const optimistic = OnboardingState.getOptimistic();
            if (optimistic && optimistic.getPendingCount() > 0) return;

            // QWIN-01 ACTIVE EXCLUSION (Pitfall #5 prevention): capture user's dirty DOM
            // values BEFORE state.requests перезаписан fresh server data. CONTEXT.md decision #3:
            // polling does NOT pause; instead actively re-applies user's in-flight DOM
            // values поверх fresh server stageData ПЕРЕД _openRequest re-render.
            let _dirtyDomSnapshot = null;
            let _dirtyFieldsSnapshot = null;
            let _dirtyCurrentStep = null;
            let _dirtyRequestId = null;
            const _viewBefore = OnboardingState.get('view');
            const _currentBefore = OnboardingState.get('currentRequest');
            if (_viewBefore === 'form' && _currentBefore && typeof OnboardingForm !== 'undefined' && typeof OnboardingForm.getDirtyFields === 'function') {
                const _dirty = OnboardingForm.getDirtyFields();
                if (_dirty && _dirty.size > 0) {
                    _dirtyFieldsSnapshot = new Set(_dirty);
                    _dirtyCurrentStep = _currentBefore.currentStep;
                    _dirtyRequestId = _currentBefore.id;
                    try {
                        _dirtyDomSnapshot = OnboardingForm.collectFormData(_dirtyCurrentStep, { excludeFiles: true });
                    } catch (_) { _dirtyDomSnapshot = null; }
                    // Toast.info indicator (UI feedback — secondary к данным защите)
                    Toast.info('Другой пользователь изменил карточку. Ваши изменения сохранены.', 3000);
                }
            }

            // Clear cache and reload current page (server pagination mode)
            // BFIX (audit 2026-05-20): silent=true — background polling, не показывать
            // Toast.error на транзитные backend 500-ки (next interval retry).
            CloudStorage.clearCacheNamespace('onboardingRequests');
            await OnboardingList.goToOnboardingPage(
                OnboardingList.getCurrentPage ? OnboardingList.getCurrentPage() : 1,
                { silent: true }
            );

            // QWIN-01 ACTIVE EXCLUSION (continued): re-apply DOM values поверх fresh server stageData
            // ДО того как _openRequest вызовет render() с stale-from-server data.
            if (_dirtyFieldsSnapshot && _dirtyDomSnapshot && _dirtyRequestId) {
                const _freshRequests = OnboardingState.get('requests') || [];
                const _freshRequest = _freshRequests.find(r => r.id === _dirtyRequestId);
                if (_freshRequest) {
                    if (!_freshRequest.stageData) _freshRequest.stageData = {};
                    if (!_freshRequest.stageData[_dirtyCurrentStep]) _freshRequest.stageData[_dirtyCurrentStep] = {};
                    for (const fieldId of _dirtyFieldsSnapshot) {
                        if (fieldId in _dirtyDomSnapshot) {
                            _freshRequest.stageData[_dirtyCurrentStep][fieldId] = _dirtyDomSnapshot[fieldId];
                        }
                    }
                    // _freshRequest mutated in-place — OnboardingState.requests array references same object.
                }
            }

            const view = OnboardingState.get('view');
            if (view !== 'list') {
                const current = OnboardingState.get('currentRequest');
                if (current) {
                    if (optimistic && optimistic.isPending(current.id)) return;
                    const requests = OnboardingState.get('requests') || [];
                    const updated = requests.find(r => r.id === current.id);
                    if (!updated) {
                        Toast.info('Заявка была удалена');
                        _showView('list');
                    } else if (updated.status !== current.status || updated.currentStep !== current.currentStep) {
                        _openRequest(current.id);  // collectFormData wrap в render() (Defense Layer 1) protects DOM data here too
                    }
                }
            }
        } catch (_) { /* silent -- background sync */ }
    }

    // ── PageLifecycle ──

    PageLifecycle.init({
        module: 'partner-onboarding',
        basePath: '..',
        needsAuth: true,
        needsCloudStorage: true,
        async onInit() {
            document.addEventListener('click', _handleClick);
            document.addEventListener('input', _handleInput);
            document.addEventListener('change', _handleChange);
            document.addEventListener('keydown', _handleKeydown);
            document.addEventListener('keypress', _handleKeypress);
            await init();
            _installBeforeUnloadGuard();   // Phase 8 / Plan 03: unsaved-changes guard
        },
        onDestroy() {
            _destroy();
        },
        modals: {
            '#reassignModal': () => _closeModal('reassignModal'),
            '#rollbackModal': () => _closeModal('rollbackModal'),
            '#confirmModal': () => _closeModal('confirmModal'),
            '#historyModal': () => _closeModal('historyModal'),
            '#sourceSettingsModal': () => _closeModal('sourceSettingsModal'),
            '#conditionsModal': () => _closeModal('conditionsModal'),
            '#roleConfigModal': () => _closeModal('roleConfigModal')
        }
    });

    return { init, createRequestFromImport };
})();
