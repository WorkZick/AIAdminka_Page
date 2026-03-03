/* partner-onboarding.js — Главный контроллер */

const PartnerOnboarding = (() => {
    'use strict';

    let _confirmCallback = null;
    let _actionInProgress = false;
    let _statusWatchTimer = null;
    let _statusWatchRequestId = null;
    let _statusWatchExpected = null;
    const _debouncedSearch = Utils.debounce(() => OnboardingList.applyFilters(), 150);
    const _debouncedAutosave = Utils.debounce(() => _autosaveDraft(), 500);

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

    // ── Init ──

    async function init() {
        OnboardingList.init();
        _loadUserData();
        _setupDevRoleSwitcher();
        await _loadRequests();
        OnboardingList.setupDefaultFilters();
        OnboardingList.applyFilters();
        _updateToolbarForRole();
        await OnboardingSource.init();
    }

    function _loadUserData() {
        const systemRole = (typeof RoleGuard !== 'undefined' && RoleGuard.getCurrentRole)
            ? RoleGuard.getCurrentRole() : 'sales';
        const email = (typeof RoleGuard !== 'undefined' && RoleGuard.user)
            ? RoleGuard.user.email || '' : '';

        OnboardingState.set('systemRole', systemRole);
        OnboardingState.set('userRole', OnboardingRoles.getGlobalModuleRole(systemRole));
        OnboardingState.set('userEmail', email);
    }

    // ── Data (API) ──

    async function _loadRequests() {
        const loadingEl = document.getElementById('listLoading');
        const listEl = document.getElementById('requestsList');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (listEl) listEl.classList.add('hidden');
        try {
            const data = await CloudStorage.getOnboardingRequests();
            OnboardingState.set('requests', data.requests || []);
            OnboardingState.set('history', data.history || {});
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'loadRequests' });
            OnboardingState.set('requests', []);
        } finally {
            if (loadingEl) loadingEl.classList.add('hidden');
            if (listEl) listEl.classList.remove('hidden');
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
        CloudStorage.clearCache('onboardingRequests');
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

    // ── Views ──

    function _showView(view) {
        OnboardingState.set('view', view);
        document.getElementById('viewList').classList.toggle('hidden', view !== 'list');
        document.getElementById('viewForm').classList.toggle('hidden', view !== 'form');
        document.getElementById('viewReview').classList.toggle('hidden', view !== 'review');

        const headerTitle = document.getElementById('headerTitle');
        const headerRequestId = document.getElementById('headerRequestId');

        if (view === 'list') {
            headerTitle.textContent = 'Заведение партнёра';
            headerRequestId.classList.add('hidden');
            _stopStatusWatch();
        } else {
            const request = OnboardingState.get('currentRequest');
            if (request) {
                headerRequestId.textContent = request.id;
                headerRequestId.classList.remove('hidden');
                _renderAdminActions(request);
                // Start status watch when request is on_review (reviewer or form view)
                // Detects if executor withdraws while reviewer is working
                if (request.status === 'on_review') {
                    _startStatusWatch(request.id, 'on_review');
                } else {
                    _stopStatusWatch();
                }
            }
        }
    }

    function _renderAdminActions(request) {
        const myRole = OnboardingState.get('userRole');
        const isAdminLike = myRole === 'admin' || myRole === 'leader';
        const view = OnboardingState.get('view');
        const containerId = view === 'form' ? 'formAdminActions' : 'reviewAdminActions';
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';
        if (request.status !== 'completed' && request.status !== 'cancelled') {
            if (isAdminLike && view === 'form') {
                html += `<button class="btn btn-primary" data-action="onb-showReassign">Передать</button>`;
                html += `<button class="btn btn-primary" data-action="onb-showRollback">Откатить</button>`;
            }
            if (isAdminLike) {
                html += `<button class="btn btn-danger btn-sm" data-action="onb-cancelRequest">Отменить</button>`;
            }
        }
        if (request.status === 'cancelled' && isAdminLike) {
            html += `<button class="btn btn-primary" data-action="onb-reactivateRequest">Восстановить</button>`;
        }
        container.innerHTML = html;
    }

    // ── Toolbar Role Visibility ──

    function _updateToolbarForRole() {
        const myRole = OnboardingState.get('userRole');
        const systemRole = OnboardingState.get('systemRole');
        const hideSettings = myRole === 'executor';
        const isReviewer = myRole === 'reviewer';
        const isLeaderOrAdmin = systemRole === 'admin' || systemRole === 'leader';
        const btnNew = document.getElementById('btnNewRequest');
        const btnSettings = document.getElementById('btnSettings');
        const btnRoleConfig = document.getElementById('btnRoleConfig');

        if (btnNew) btnNew.classList.toggle('hidden', isReviewer);
        if (btnSettings) btnSettings.classList.toggle('hidden', hideSettings);
        if (btnRoleConfig) btnRoleConfig.classList.toggle('hidden', !isLeaderOrAdmin);
        OnboardingSource.updateSyncBarVisibility();

        // Empty state: hide "Новая заявка" button + adjust text for reviewer
        const emptyState = document.getElementById('listEmpty');
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
        // Close status dropdown when clicking outside
        const statusDropdown = document.getElementById('statusDropdown');
        if (statusDropdown && !statusDropdown.classList.contains('hidden') && !e.target.closest('.status-submit-btn')) {
            statusDropdown.classList.add('hidden');
        }
        // Close settings dropdown when clicking outside
        const settingsDropdown = document.getElementById('settingsDropdown');
        if (settingsDropdown && !settingsDropdown.classList.contains('hidden') && !e.target.closest('.settings-dropdown-wrap')) {
            settingsDropdown.classList.add('hidden');
        }

        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const value = target.dataset.value;

        switch (action) {
            // Navigation
            case 'onb-back': _showView('list'); break;
            case 'onb-newRequest': _createRequest(); break;
            case 'onb-openRequest': _openRequest(value); break;
            case 'onb-goToStep': _goToStep(parseInt(value, 10)); break;

            // Filters
            case 'onb-mainFilter': _mainFilter(); break;

            // Form actions
            case 'onb-submit': _submitStep(); break;
            case 'onb-toggleStatusDropdown': _toggleStatusDropdown(); break;
            case 'onb-selectLeadStatus': _selectLeadStatus(value); break;
            case 'onb-setDateNow': _setDateNow(value); break;

            // Review actions
            case 'onb-approve': _approveStep(); break;
            case 'onb-reject': _rejectStep(); break;
            case 'onb-withdraw': _withdrawStep(); break;
            case 'onb-reviewAdvance': _advanceAfterApprove(); break;

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

            // Confirm modal
            case 'onb-closeConfirm': _closeModal('confirmModal'); break;
            case 'onb-confirmAction': if (_confirmCallback) { _confirmCallback(); _closeModal('confirmModal'); } break;

            // Form field actions
            case 'onb-removeFile': OnboardingForm.removeFile(value); break;
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

            // Selection (admin/leader)
            case 'onb-toggleSelect': OnboardingList.updateSelection(); break;
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
            case 'onb-deleteSource': _showConfirm('Удалить источник?', 'Источник будет удалён. Импортированные лиды останутся.', () => OnboardingSource.deleteSource(OnboardingSource._getEditingId())); break;
            case 'onb-syncNow': OnboardingSource.syncNow(); break;

            // Conditions settings
            case 'onb-openConditionsSettings': _closeSettingsDropdown(); OnboardingSource.openConditionsSettings(); break;
            case 'onb-closeConditions': _closeModal('conditionsModal'); break;
            case 'onb-saveConditions': OnboardingSource.saveConditionsUrl(); break;

            // Role config settings
            case 'onb-openRoleConfig': _closeSettingsDropdown(); OnboardingRoles.openSettings(); break;
            case 'onb-closeRoleConfig': _closeModal('roleConfigModal'); break;
            case 'onb-saveRoleConfig': OnboardingRoles.saveConfig(); _closeModal('roleConfigModal'); break;
            case 'onb-resetRoleConfig': OnboardingRoles.resetToDefaults(); break;

            // DEV
            case 'onb-devRole': _switchDevRole(value, target); break;
        }
    }

    function _handleInput(e) {
        const target = e.target;
        if (target.dataset.action === 'onb-search') {
            OnboardingState.set('filters.search', target.value);
            _debouncedSearch();
            return;
        }
        // Autosave draft on any form field input
        if (OnboardingState.get('view') === 'form' && target.closest('#formFields')) {
            _debouncedAutosave();
        }
    }

    function _handleChange(e) {
        const target = e.target;
        if (target.dataset.action === 'onb-mainFilter') {
            _mainFilter();
            return;
        }
        // Dynamic executor: re-render form when account_creator changes
        if (target.name === 'account_creator') {
            const request = OnboardingState.get('currentRequest');
            const stepNumber = OnboardingState.get('currentStep');
            if (request) {
                if (!request.stageData) request.stageData = {};
                if (!request.stageData[stepNumber]) request.stageData[stepNumber] = {};
                request.stageData[stepNumber].account_creator = target.value;
                OnboardingForm.render(request, stepNumber);
            }
            return;
        }
        // Conditions cascade: condition_country → clear method_type, method_name, conditions
        if (target.name === 'condition_country' && OnboardingSource.hasConditions()) {
            const request = OnboardingState.get('currentRequest');
            const stepNumber = OnboardingState.get('currentStep');
            if (request && stepNumber === 2) {
                const currentData = OnboardingForm.collectFormData(2);
                if (!request.stageData) request.stageData = {};
                request.stageData[2] = { ...request.stageData[2], ...currentData };
                request.stageData[2].condition_country = target.value;
                request.stageData[2].method_type = '';
                request.stageData[2].method_name = '';
                request.stageData[2].deal_1 = '';
                request.stageData[2].deal_2 = '';
                request.stageData[2].deal_3 = '';
                request.stageData[2].prepayment_method = '';
                request.stageData[2].prepayment_amount = '';
                _debouncedAutosave();
                OnboardingForm.render(request, 2);
            }
            return;
        }
        // Conditions cascade: method_type → clear method_name + conditions
        if (target.name === 'method_type' && OnboardingSource.hasConditions()) {
            const request = OnboardingState.get('currentRequest');
            const stepNumber = OnboardingState.get('currentStep');
            if (request && stepNumber === 2) {
                const currentData = OnboardingForm.collectFormData(2);
                if (!request.stageData) request.stageData = {};
                request.stageData[2] = { ...request.stageData[2], ...currentData };
                request.stageData[2].method_type = target.value;
                request.stageData[2].method_name = '';
                request.stageData[2].deal_1 = '';
                request.stageData[2].deal_2 = '';
                request.stageData[2].deal_3 = '';
                request.stageData[2].prepayment_method = '';
                request.stageData[2].prepayment_amount = '';
                _debouncedAutosave();
                OnboardingForm.render(request, 2);
            }
            return;
        }
        // Conditions cascade: method_name → apply condition values
        if (target.name === 'method_name' && OnboardingSource.hasConditions()) {
            const request = OnboardingState.get('currentRequest');
            const stepNumber = OnboardingState.get('currentStep');
            if (request && stepNumber === 2) {
                const currentData = OnboardingForm.collectFormData(2);
                if (!request.stageData) request.stageData = {};
                request.stageData[2] = { ...request.stageData[2], ...currentData };
                request.stageData[2].method_name = target.value;
                const selCountry = request.stageData[2].condition_country || '';
                const condition = OnboardingSource.getCondition(
                    selCountry, request.stageData[2].method_type, target.value
                );
                if (condition) {
                    request.stageData[2].deal_1 = condition.deal_1 || '';
                    request.stageData[2].deal_2 = condition.deal_2 || '';
                    request.stageData[2].deal_3 = condition.deal_3 || '';
                    request.stageData[2].prepayment_method = condition.prepayment_method || '';
                    request.stageData[2].prepayment_amount = condition.prepayment_amount || '';
                }
                _debouncedAutosave();
                OnboardingForm.render(request, 2);
            }
            return;
        }
        // Autosave draft on select/checkbox changes
        if (OnboardingState.get('view') === 'form' && target.closest('#formFields')) {
            _debouncedAutosave();
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
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'createRequest' });
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

        const myRole = OnboardingState.get('userRole');
        const sysRole = OnboardingState.get('systemRole');
        const step = OnboardingConfig.getStep(request.currentStep);

        // Executor takes "new" request → assign via API
        if (request.status === 'new' && step && OnboardingRoles.isExecutorForStep(sysRole, step.number)) {
            // Show loading on the clicked row
            const row = document.querySelector(`.request-row[data-id="${id}"]`);
            if (row) row.classList.add('row-loading');
            try {
                const result = await CloudStorage.postApi('submitStep', {
                    requestId: request.id, step: 0, data: { _assign: true }
                });
                if (result.success) _applyApiResult(result);
            } catch (e) {
                ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'assignRequest' });
            } finally {
                if (row) row.classList.remove('row-loading');
            }
        }

        const fresh = _getRequest(id);
        if (!fresh) return;

        OnboardingState.set('currentRequest', fresh);
        OnboardingState.set('currentStep', fresh.currentStep);

        const isAdminLike = myRole === 'admin' || myRole === 'leader';
        const effectiveExecutor = OnboardingConfig.getStepEffectiveExecutor(fresh.currentStep, fresh.stageData);

        // Executor: executorFinal step → show success view
        if (OnboardingRoles.getGlobalModuleRole(sysRole) === 'executor' && OnboardingConfig.isExecutorCompleted(fresh)) {
            const finalStep = OnboardingConfig.STEPS.find(s => s.executorFinal);
            const finalStepNum = finalStep ? finalStep.number : fresh.currentStep;
            OnboardingState.set('currentStep', finalStepNum);
            OnboardingReview.render(fresh, finalStepNum, true);
            _showView('review');
            return;
        }

        // Decide view
        // confirmAfterApprove: executor sees review (readonly + "Далее")
        const stageData = (fresh.stageData && fresh.stageData[fresh.currentStep]) || {};
        if (fresh.status === 'in_progress' && step.confirmAfterApprove && stageData._approved && OnboardingRoles.isExecutorForStep(sysRole, step.number)) {
            OnboardingReview.render(fresh, fresh.currentStep);
            _showView('review');
        // Dynamic handoff on_review: executor sees review (readonly + withdraw)
        } else if (fresh.status === 'on_review' && step.dynamicExecutor && OnboardingRoles.isExecutorForStep(sysRole, step.number)) {
            OnboardingReview.render(fresh, fresh.currentStep);
            _showView('review');
        // Dynamic handoff on_review: reviewer (or admin) fills form
        } else if (fresh.status === 'on_review' && step.dynamicExecutor && (effectiveExecutor === myRole || isAdminLike)) {
            OnboardingForm.render(fresh, fresh.currentStep);
            _showView('form');
        // Standard in_progress: executor fills form
        } else if (fresh.status === 'in_progress' && OnboardingRoles.isExecutorForStep(sysRole, step.number)) {
            OnboardingForm.render(fresh, fresh.currentStep);
            _showView('form');
        // Reviewer-executor step (e.g. antifraud): reviewer fills form
        } else if (fresh.status === 'on_review' && OnboardingRoles.isExecutorForStep(sysRole, step.number) && !step.reviewer) {
            OnboardingForm.render(fresh, fresh.currentStep);
            _showView('form');
        // Standard on_review: reviewer sees review
        } else if (fresh.status === 'on_review' && (OnboardingRoles.isReviewerForStep(sysRole, step.number) || isAdminLike)) {
            OnboardingReview.render(fresh, fresh.currentStep);
            _showView('review');
        // Admin fallback for on_review reviewer-executor steps
        } else if (isAdminLike && fresh.status === 'on_review' && !step.reviewer) {
            OnboardingForm.render(fresh, fresh.currentStep);
            _showView('form');
        // Admin fallback for in_progress
        } else if (isAdminLike && fresh.status === 'in_progress') {
            OnboardingForm.render(fresh, fresh.currentStep);
            _showView('form');
        } else {
            OnboardingReview.render(fresh, fresh.currentStep);
            _showView('review');
        }
    }

    function _goToStep(stepNumber) {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const myRole = OnboardingState.get('userRole');
        const sysRole = OnboardingState.get('systemRole');

        // Executor clicks executorFinal step → show success view
        if (OnboardingRoles.getGlobalModuleRole(sysRole) === 'executor' && OnboardingConfig.isExecutorFinalStep(stepNumber)) {
            if (OnboardingConfig.isExecutorCompleted(request)) {
                OnboardingState.set('currentStep', stepNumber);
                OnboardingReview.render(request, stepNumber, true);
                _showView('review');
            }
            return;
        }

        OnboardingState.set('currentStep', stepNumber);
        const view = OnboardingState.get('view');

        if (view === 'form') {
            OnboardingForm.render(request, stepNumber);
        } else {
            OnboardingReview.render(request, stepNumber);
        }

        // Scroll to top
        const scroll = document.querySelector('.onb-view:not(.hidden) .detail-main-scroll');
        if (scroll) scroll.scrollTop = 0;
    }

    // ── Actions ──

    function _autosaveDraft() {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request || OnboardingState.get('view') !== 'form') return;

        const data = OnboardingForm.collectFormData(stepNumber, { excludeFiles: true });
        if (!request.stageData) request.stageData = {};
        request.stageData[stepNumber] = { ...request.stageData[stepNumber], ...data };

        if (stepNumber === 1 && data.lead_source) {
            request.leadSource = data.lead_source;
        }

        // Local update for responsive UI
        _updateRequestLocal(request.id, { stageData: request.stageData, leadSource: request.leadSource });

        // Don't autosave to server when reviewer is filling data on dynamicExecutor step (on_review).
        // Data will be saved explicitly when reviewer clicks "Отправить экзекьютору".
        // This prevents executor from seeing partial/in-progress reviewer edits.
        if (request.status === 'on_review') return;

        // Fire-and-forget API save (without files — they are uploaded on submit)
        CloudStorage.postApi('saveDraft', {
            requestId: request.id, step: stepNumber, data: data
        }).catch(() => { /* silent — draft save не критичен */ });
    }

    // ── Status Watch (sync: detect if executor withdraws while reviewer edits) ──

    function _startStatusWatch(requestId, expectedStatus) {
        _stopStatusWatch();
        _statusWatchRequestId = requestId;
        _statusWatchExpected = expectedStatus;
        _statusWatchTimer = setInterval(() => _pollStatus(), 10000); // every 10s
    }

    function _stopStatusWatch() {
        if (_statusWatchTimer) {
            clearInterval(_statusWatchTimer);
            _statusWatchTimer = null;
        }
        _statusWatchRequestId = null;
        _statusWatchExpected = null;
    }

    async function _pollStatus() {
        if (!_statusWatchRequestId || !_statusWatchExpected) return;
        try {
            const result = await CloudStorage.postApi('getOnboardingStatus', {
                requestId: _statusWatchRequestId
            });
            if (!result.success) return;
            if (result.status !== _statusWatchExpected) {
                _stopStatusWatch();
                Toast.warning('Статус заявки изменился. Обновляю...');
                // Reload all requests to get fresh data, then re-open
                const listResult = await CloudStorage.postApi('getOnboardingRequests', {});
                if (listResult.requests) {
                    OnboardingState.set('requests', listResult.requests);
                }
                _openRequest(_statusWatchRequestId);
            }
        } catch (_) { /* silent — polling error is not critical */ }
    }

    async function _submitStep() {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request || _isActionLocked()) return;

        const step = OnboardingConfig.getStep(stepNumber);
        const sysRole = OnboardingState.get('systemRole');

        // Validate (except handoff-complete confirm phase)
        const isHandoffComplete = step && step.dynamicExecutor && (request.stageData[stepNumber] || {})._handoff_complete;
        if (!isHandoffComplete) {
            const { valid, errors } = OnboardingForm.validate(stepNumber);
            if (!valid) { Toast.error(errors[0]); return; }
        }

        // Block submit on past steps (autosave handles saving)
        if (stepNumber !== request.currentStep && !isHandoffComplete) {
            _autosaveDraft();
            return;
        }

        const data = OnboardingForm.collectFormData(stepNumber, { excludeFiles: true });

        _setActionLock(true);
        _setBtnLoading('#btnFormSubmit', true);
        // Also lock status-submit button if present
        _setBtnLoading('.status-submit-main', true);
        try {
            // Upload pending files (base64) separately to avoid CORS/payload-size issues
            const pendingFiles = OnboardingForm.getPendingFiles();
            for (const [fieldId, dataUrl] of Object.entries(pendingFiles)) {
                const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (!match) continue;
                const mimeType = match[1];
                const base64 = match[2];
                const uploadResult = await CloudStorage.postApi('uploadOnboardingFile', {
                    requestId: request.id, fieldName: fieldId, base64, mimeType
                });
                if (uploadResult.success && uploadResult.url) {
                    data[fieldId] = uploadResult.url;
                    OnboardingForm.setFileUrl(fieldId, uploadResult.url);
                } else {
                    Toast.error(uploadResult.error || 'Ошибка загрузки файла ' + fieldId);
                    return;
                }
            }

            // Reviewer filling data on dynamicExecutor step → save draft + approve (handoff)
            if (request.status === 'on_review' && step && step.dynamicExecutor) {
                // Pre-submit freshness check: verify request is still on_review
                const freshStatus = await CloudStorage.postApi('getOnboardingStatus', {
                    requestId: request.id
                });
                if (freshStatus.success && freshStatus.status !== 'on_review') {
                    _stopStatusWatch();
                    Toast.warning('Заявка была отозвана экзекьютором. Обновляю...');
                    const listResult = await CloudStorage.postApi('getOnboardingRequests', {});
                    if (listResult.requests) OnboardingState.set('requests', listResult.requests);
                    _openRequest(request.id);
                    return;
                }

                await CloudStorage.postApi('saveDraft', {
                    requestId: request.id, step: stepNumber, data: data
                });
                const approveResult = await CloudStorage.postApi('approveStep', {
                    requestId: request.id, step: stepNumber, comment: ''
                });
                if (!approveResult.success) { Toast.error(approveResult.error || 'Ошибка'); return; }
                _stopStatusWatch();
                _applyApiResult(approveResult);
                Toast.success('Данные сохранены, передано экзекьютору');
                _openRequest(request.id);
                return;
            }

            const result = await CloudStorage.postApi('submitStep', {
                requestId: request.id, step: stepNumber, data: data
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

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

            // If next step executor is same user → continue editing
            if (updated.status === 'in_progress' && OnboardingRoles.isExecutorForStep(sysRole, updated.currentStep)) {
                OnboardingState.set('currentStep', updated.currentStep);
                OnboardingForm.render(updated, updated.currentStep);
            } else {
                _openRequest(request.id);
            }
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'submitStep' });
        } finally {
            _setBtnLoading('#btnFormSubmit', false);
            _setBtnLoading('.status-submit-main', false);
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
        try {
            const result = await CloudStorage.postApi('approveStep', {
                requestId: request.id, step: stepNumber, comment: comment.trim()
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            Toast.success(result.request.status === 'completed' ? 'Заявка завершена!' : 'Шаг одобрен');
            _openRequest(request.id);
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'approveStep' });
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
            const reviewData = OnboardingReview.collectReviewChecklist();
            if (!reviewData) return;

            const step = OnboardingConfig.getStep(stepNumber);
            const field = step && step.fields.find(f => f.id === reviewData.fieldId);
            const items = field ? field.items || [] : [];
            const unchecked = items.map((_, idx) => idx).filter(idx => !reviewData.data[idx]);

            if (unchecked.length === 0) { Toast.error('Снимите отметку с пунктов, где обнаружены ошибки'); return; }

            const comments = reviewData.data.comments || {};
            if (!unchecked.some(idx => comments[idx])) { Toast.error('Добавьте комментарий к пунктам с ошибками'); return; }

            comment = unchecked.map(idx => {
                const label = items[idx].label;
                const c = comments[idx] || '';
                return c ? `${label}: ${c}` : label;
            }).join('; ');

            checklistData = { fieldId: reviewData.fieldId, data: reviewData.data };
        } else {
            comment = (document.getElementById('reviewComment') || {}).value || '';
            comment = comment.trim();
            if (!comment) { Toast.error('Добавьте комментарий для возврата'); return; }
        }

        _setActionLock(true);
        _setBtnLoading('#btnReject', true);
        try {
            const result = await CloudStorage.postApi('rejectStep', {
                requestId: request.id, step: stepNumber, comment, checklistData
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'in_progress', lastComment: comment });
            Toast.info('Заявка возвращена на доработку');
            _openRequest(request.id);
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'rejectStep' });
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
            const result = await CloudStorage.postApi('withdrawOnboarding', {
                requestId: request.id, step: request.currentStep
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'in_progress' });
            Toast.info('Заявка отозвана с проверки');
            _openRequest(request.id);
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'withdrawStep' });
        } finally {
            _setBtnLoading('#btnWithdraw', false);
            _setActionLock(false);
        }
    }

    async function _advanceAfterApprove() {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request || _isActionLocked()) return;

        const step = OnboardingConfig.getStep(stepNumber);
        if (!step || !step.confirmAfterApprove || !(request.stageData[stepNumber] || {})._approved) return;

        const sysRole = OnboardingState.get('systemRole');

        _setActionLock(true);
        _setBtnLoading('#btnReviewAdvance', true);
        try {
            const result = await CloudStorage.postApi('submitStep', {
                requestId: request.id, step: stepNumber, data: { _advance: true }
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            const updated = result.request;

            if (updated.status === 'completed') {
                Toast.success('Заявка завершена!');
                _openRequest(request.id);
            } else if (OnboardingRoles.isExecutorForStep(sysRole, updated.currentStep)) {
                OnboardingState.set('currentStep', updated.currentStep);
                OnboardingForm.render(updated, updated.currentStep);
                _showView('form');
            } else {
                Toast.success('Шаг выполнен');
                _openRequest(request.id);
            }
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'advanceAfterApprove' });
        } finally {
            _setBtnLoading('#btnReviewAdvance', false);
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
            const labelEl = document.querySelector('.status-submit-label');
            if (labelEl) labelEl.textContent = OnboardingConfig.getOptionLabel(OnboardingConfig.LEAD_STATUSES, value);
            document.querySelectorAll('.status-submit-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.value === value);
            });
            document.querySelectorAll('#formFields [data-visible-when-field="lead_status"]').forEach(el => {
                el.classList.toggle('hidden', value !== el.dataset.visibleWhenValue);
            });
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
        const labelEl = document.querySelector('.status-submit-label');
        if (labelEl) labelEl.textContent = OnboardingConfig.getOptionLabel(OnboardingConfig.LEAD_STATUSES, value);
        document.querySelectorAll('.status-submit-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.value === value);
        });
        document.querySelectorAll('#formFields [data-visible-when-field="lead_status"]').forEach(el => {
            el.classList.toggle('hidden', value !== el.dataset.visibleWhenValue);
        });

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
                try {
                    const result = await CloudStorage.postApi('deleteOnboardings', { ids });
                    if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

                    CloudStorage.clearCache('onboardingRequests');
                    const requests = OnboardingState.get('requests') || [];
                    const remaining = requests.filter(r => !ids.includes(r.id));
                    OnboardingState.set('requests', remaining);
                    OnboardingList.applyFilters();
                    Toast.success(`Удалено заявок: ${ids.length}`);
                } catch (e) {
                    ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'deleteRequests' });
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
            const result = await CloudStorage.postApi('cancelOnboarding', { requestId: request.id });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'cancelled' });
            Toast.warning('Заявка отменена');
            _openRequest(request.id);
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'cancelRequest' });
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
            const result = await CloudStorage.postApi('reactivateOnboarding', { requestId: request.id });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'in_progress' });
            Toast.success('Заявка восстановлена');
            _openRequest(request.id);
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'reactivateRequest' });
        } finally {
            _setBtnLoading('#confirmOk', false);
            _setActionLock(false);
        }
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
        const targetSelect = document.getElementById('reassignTarget');
        if (targetSelect) {
            targetSelect.innerHTML = '<option value="">Загрузка...</option>';
            try {
                const employees = await CloudStorage.getEmployees();
                targetSelect.innerHTML = '<option value="">Выберите менеджера</option>';
                employees.forEach(emp => {
                    const opt = document.createElement('option');
                    opt.value = emp.email;
                    opt.textContent = emp.name || emp.email;
                    targetSelect.appendChild(opt);
                });
            } catch {
                targetSelect.innerHTML = '<option value="">Выберите менеджера</option>';
            }
        }

        const select = document.getElementById('reassignReason');
        if (select && select.options.length <= 1) {
            OnboardingConfig.REASSIGN_REASONS.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.value;
                opt.textContent = r.label;
                select.appendChild(opt);
            });
        }
        _openModal('reassignModal');
    }

    async function _confirmReassign() {
        const request = OnboardingState.get('currentRequest');
        if (!request || _isActionLocked()) return;

        const targetSelect = document.getElementById('reassignTarget');
        const target = targetSelect.value;
        const targetName = targetSelect.options[targetSelect.selectedIndex]?.text || target;
        const reason = document.getElementById('reassignReason').value;
        const comment = document.getElementById('reassignComment').value.trim();

        if (!target) { Toast.error('Выберите менеджера'); return; }
        if (!reason) { Toast.error('Выберите причину'); return; }

        _setActionLock(true);
        const btn = document.querySelector('[data-action="onb-confirmReassign"]');
        _setBtnLoading(btn, true);
        try {
            const result = await CloudStorage.postApi('reassignOnboarding', {
                requestId: request.id, targetEmail: target, targetName, reason, comment
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { assigneeEmail: target, assigneeName: targetName });
            _closeModal('reassignModal');
            Toast.success('Заявка передана');
            _openRequest(request.id);
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'reassign' });
        } finally {
            _setBtnLoading(btn, false);
            _setActionLock(false);
        }
    }

    // ── Rollback ──

    function _showRollbackModal() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const select = document.getElementById('rollbackTarget');
        select.innerHTML = '<option value="">Выберите шаг</option>';
        for (let i = 1; i < request.currentStep; i++) {
            const step = OnboardingConfig.getStep(i);
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = OnboardingConfig.getStepLabel(i);
            select.appendChild(opt);
        }
        _openModal('rollbackModal');
    }

    async function _confirmRollback() {
        const request = OnboardingState.get('currentRequest');
        if (!request || _isActionLocked()) return;

        const targetStep = parseInt(document.getElementById('rollbackTarget').value, 10);
        const comment = document.getElementById('rollbackComment').value.trim();

        if (!targetStep) { Toast.error('Выберите шаг'); return; }

        _setActionLock(true);
        const btn = document.querySelector('[data-action="onb-confirmRollback"]');
        _setBtnLoading(btn, true);
        try {
            const result = await CloudStorage.postApi('rollbackOnboarding', {
                requestId: request.id, targetStep, comment
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

            _applyApiResult(result);
            if (!result.request) _updateRequestLocal(request.id, { status: 'in_progress', currentStep: targetStep, lastComment: comment });
            _closeModal('rollbackModal');
            Toast.info('Откат выполнен');
            _openRequest(request.id);
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'rollback' });
        } finally {
            _setBtnLoading(btn, false);
            _setActionLock(false);
        }
    }

    // ── Helpers ──

    function _mainFilter() {
        const select = document.getElementById('mainFilter');
        const value = select.value;
        OnboardingState.set('filters.status', value.startsWith('status:') ? value.replace('status:', '') : '');
        OnboardingList.applyFilters();
    }

    function _setDateNow(fieldId) {
        const input = document.getElementById(`field_${fieldId}`);
        if (!input) return;
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        input.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

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
        if (modal) modal.classList.add('active');
    }

    function _closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
        _confirmCallback = null;
    }

    function _showConfirm(title, message, callback) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        _confirmCallback = callback;
        _openModal('confirmModal');
    }

    // ── DEV Role Switcher ──

    function _setupDevRoleSwitcher() {
        const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        const systemRole = OnboardingState.get('systemRole');
        const isAdminLike = systemRole === 'admin' || systemRole === 'leader';
        const switcher = document.getElementById('roleSwitcher');
        if (isLocal && isAdminLike && switcher) {
            switcher.classList.remove('hidden');
        }
    }

    function _switchDevRole(devRole, target) {
        OnboardingState.set('systemRole', devRole);
        OnboardingState.set('userRole', OnboardingRoles.getGlobalModuleRole(devRole));
        document.querySelectorAll('#roleSwitcher .dev-role-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.value === devRole)
        );
        _updateToolbarForRole();
        OnboardingList.setupDefaultFilters();
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
        if (document.querySelector('.modal.active')) return;

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
        OnboardingSource.destroy();
        OnboardingRoles.destroy();
        document.removeEventListener('click', _handleClick);
        document.removeEventListener('input', _handleInput);
        document.removeEventListener('change', _handleChange);
        document.removeEventListener('keydown', _handleKeydown);
        document.removeEventListener('keypress', _handleKeypress);
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
