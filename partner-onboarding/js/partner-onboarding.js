/* partner-onboarding.js — Главный контроллер */

const PartnerOnboarding = (() => {
    'use strict';

    let _confirmCallback = null;
    let _actionInProgress = false;
    let _statusWatchTimer = null;
    let _statusWatchRequestId = null;
    let _statusWatchExpected = null;
    let _statusWatchVisHandler = null;
    let _listRefreshTimer = null;
    let _visibilityRefreshHandler = null;
    let _lastKnownModified = null;
    const POLL_INTERVAL = 5000; // 5 секунд — lightweight change detection
    let _pollErrorCount = 0;
    const MAX_POLL_ERRORS = 3; // после 3 ошибок подряд — стоп
    let _pollInFlight = false;
    let _lastSavedDraftKey = null;
    let _lastSavedDraftJson = null;
    const _debouncedSearch = Utils.debounce(() => OnboardingList.applyFilters(), 150);
    const _debouncedAutosave = Utils.debounce(() => _autosaveDraft(), 5000);

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

        // Параллельная загрузка: заявки + настройки источников + timestamp (все независимы)
        const [,, tsResult] = await Promise.all([
            _loadRequests(),
            OnboardingSource.init(),
            CloudStorage.postApi('getOnboardingLastModified', {}).catch(() => ({ ts: '0' }))
        ]);
        _lastKnownModified = tsResult?.ts || '0';

        OnboardingList.setupDefaultFilters();
        OnboardingList.applyFilters();
        _updateToolbarForRole();
        _startListRefresh();
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
        OnboardingState.set('view', view);
        const r = _getViewRefs();
        r.viewList.classList.toggle('hidden', view !== 'list');
        r.viewForm.classList.toggle('hidden', view !== 'form');
        r.viewReview.classList.toggle('hidden', view !== 'review');

        // Clear inactive view content to prevent duplicate element IDs (e.g. checkComment_*)
        if (view !== 'form' && r.formFields) {
            r.formFields.innerHTML = '';
        }
        if (view !== 'review' && r.reviewFields) {
            r.reviewFields.innerHTML = '';
        }

        const headerTitle = r.headerTitle;
        const headerRequestId = r.headerRequestId;

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
                html += `<button class="btn btn-secondary" data-action="onb-showReassign">Передать</button>`;
                html += `<button class="btn btn-secondary" data-action="onb-showRollback">Откатить</button>`;
            }
            if (isAdminLike) {
                html += `<button class="btn btn-danger btn-sm" data-action="onb-cancelRequest">Отменить</button>`;
            }
        }
        if (request.status === 'cancelled' && isAdminLike) {
            html += `<button class="btn btn-secondary" data-action="onb-reactivateRequest">Восстановить</button>`;
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
            case 'onb-back': _showView('list'); break;
            case 'onb-newRequest': _createRequest(); break;
            case 'onb-openRequest': _openRequest(value); break;
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
            case 'onb-setDateNow': _setDateNow(value); break;

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

            // Form dropdowns
            case 'onb-toggleFormDropdown': _toggleFormDropdown(target); break;
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
            case 'onb-deleteSource': _showConfirm('Удалить источник?', 'Источник будет удалён. Импортированные лиды останутся.', () => OnboardingSource.deleteSource(OnboardingSource._getEditingId())); break;
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

        const isWorkStatus = OnboardingConfig.isWorkStatus(fresh.status);

        // Decide view
        // AutoHandoff in_progress: reviewer fills form, executor sees waiting state (both via form view)
        if (fresh.status === 'in_progress' && step.dynamicExecutor && step.dynamicExecutor.autoHandoff &&
            !(fresh.stageData[fresh.currentStep] || {})._handoff_complete) {
            OnboardingForm.render(fresh, fresh.currentStep);
            _showView('form');
            return;
        }
        // Dynamic handoff on_review: executor sees review (readonly + withdraw)
        if (fresh.status === 'on_review' && step.dynamicExecutor && OnboardingRoles.isExecutorForStep(sysRole, step.number)) {
            OnboardingReview.render(fresh, fresh.currentStep);
            _showView('review');
        // Dynamic handoff on_review: reviewer (or admin) fills form
        } else if (fresh.status === 'on_review' && step.dynamicExecutor && (effectiveExecutor === myRole || isAdminLike)) {
            OnboardingForm.render(fresh, fresh.currentStep);
            _showView('form');
        // Standard work statuses: executor fills form
        } else if (isWorkStatus && OnboardingRoles.isExecutorForStep(sysRole, step.number)) {
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
        // Admin fallback for work statuses
        } else if (isAdminLike && isWorkStatus) {
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

        // Don't autosave to server when reviewer is filling data on dynamicExecutor step (on_review).
        if (request.status === 'on_review') return;

        // Skip API call if data hasn't changed since last save
        const draftKey = request.id + ':' + stepNumber;
        if (draftKey !== _lastSavedDraftKey) {
            _lastSavedDraftKey = draftKey;
            _lastSavedDraftJson = null;
        }
        const draftJson = JSON.stringify(data);
        if (draftJson === _lastSavedDraftJson) return;
        _lastSavedDraftJson = draftJson;

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
        _statusWatchTimer = setInterval(() => _pollStatus(), 5000); // every 5s

        // Pause when tab is hidden (same pattern as _listRefreshTimer)
        if (!_statusWatchVisHandler) {
            _statusWatchVisHandler = () => {
                if (document.visibilityState === 'visible') {
                    if (_statusWatchRequestId && !_statusWatchTimer) {
                        _statusWatchTimer = setInterval(() => _pollStatus(), 5000);
                        _pollStatus(); // immediate check on return
                    }
                } else {
                    if (_statusWatchTimer) {
                        clearInterval(_statusWatchTimer);
                        _statusWatchTimer = null;
                    }
                }
            };
            document.addEventListener('visibilitychange', _statusWatchVisHandler);
        }
    }

    function _stopStatusWatch() {
        if (_statusWatchTimer) {
            clearInterval(_statusWatchTimer);
            _statusWatchTimer = null;
        }
        if (_statusWatchVisHandler) {
            document.removeEventListener('visibilitychange', _statusWatchVisHandler);
            _statusWatchVisHandler = null;
        }
        _statusWatchRequestId = null;
        _statusWatchExpected = null;
    }

    async function _pollStatus() {
        if (!_statusWatchRequestId || !_statusWatchExpected) return;
        if (document.visibilityState === 'hidden') return;
        try {
            const result = await CloudStorage.postApi('getOnboardingStatus', {
                requestId: _statusWatchRequestId
            });
            if (!result.success) return;
            if (result.status !== _statusWatchExpected) {
                const reqId = _statusWatchRequestId;
                _stopStatusWatch();
                Toast.warning('Статус заявки изменился. Обновляю...');
                // Reload all requests to get fresh data, then re-open
                const [listResult, tsResult] = await Promise.all([
                    CloudStorage.postApi('getOnboardingRequests', {}),
                    CloudStorage.postApi('getOnboardingLastModified', {}).catch(() => null)
                ]);
                if (listResult.requests) {
                    OnboardingState.set('requests', listResult.requests);
                    if (listResult.history) OnboardingState.set('history', listResult.history);
                    OnboardingList.applyFilters();
                }
                // Sync timestamp so list poll doesn't trigger redundant refresh
                if (tsResult && tsResult.ts) _lastKnownModified = tsResult.ts;
                _openRequest(reqId);
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
        _setBtnLoading('.dropdown-wrap--up .dropdown-trigger', true);
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

            // Reviewer filling data on dynamicExecutor step → save draft + approve (handoff)
            // AutoHandoff: reviewer submits from in_progress → submitStep + approveStep (handoff)
            // Only when handoff NOT yet complete (first reviewer fill, not executor confirm)
            if (OnboardingConfig.isWorkStatus(request.status) && step && step.dynamicExecutor && step.dynamicExecutor.autoHandoff && !isHandoffComplete) {
                data[step.dynamicExecutor.field] = step.dynamicExecutor.defaultValue;
                const submitResult = await CloudStorage.postApi('submitStep', {
                    requestId: request.id, step: stepNumber, data: data
                });
                if (!submitResult.success) { Toast.error(submitResult.error || 'Ошибка'); return; }
                _applyApiResult(submitResult);
                const approveResult = await CloudStorage.postApi('approveStep', {
                    requestId: request.id, step: stepNumber, comment: ''
                });
                if (!approveResult.success) { Toast.error(approveResult.error || 'Ошибка'); return; }
                _applyApiResult(approveResult);
                Toast.success('Создание завершено, передано в работу');
                _openRequest(request.id);
                return;
            }

            if (request.status === 'on_review' && step && step.dynamicExecutor) {
                // Pre-submit freshness check: verify request is still on_review
                const freshStatus = await CloudStorage.postApi('getOnboardingStatus', {
                    requestId: request.id
                });
                if (freshStatus.success && freshStatus.status !== 'on_review') {
                    _stopStatusWatch();
                    Toast.warning('Заявка была возвращена с проверки. Обновляю...');
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
                Toast.success('Создание завершено, передано в работу');
                _openRequest(request.id);
                return;
            }

            // Freshness check: re-fetch requests and verify state hasn't changed
            const freshList = await CloudStorage.postApi('getOnboardingRequests', {});
            if (freshList.requests) {
                OnboardingState.set('requests', freshList.requests);
                const freshReq = freshList.requests.find(r => r.id === request.id);
                if (freshReq && (freshReq.currentStep !== request.currentStep || freshReq.status !== request.status)) {
                    Toast.warning('Данные заявки изменились. Обновляю...');
                    _openRequest(request.id);
                    return;
                }
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
            if ((updated.status === 'in_progress' || updated.status === 'approved') && OnboardingRoles.isExecutorForStep(sysRole, updated.currentStep)) {
                OnboardingState.set('currentStep', updated.currentStep);
                OnboardingForm.render(updated, updated.currentStep);
            } else {
                _openRequest(request.id);
            }
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'submitStep' });
        } finally {
            _setBtnLoading('#btnFormSubmit', false);
            _setBtnLoading('.dropdown-wrap--up .dropdown-trigger', false);
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
        try {
            const result = await CloudStorage.postApi('rejectStep', {
                requestId: request.id, step: stepNumber, comment, checklistData
            });
            if (!result.success) { Toast.error(result.error || 'Ошибка'); return; }

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
            Toast.info('Заявка возвращена с проверки');
            _openRequest(request.id);
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'withdrawStep' });
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
            const labelEl = document.querySelector('.dropdown-wrap--up .dropdown-trigger span');
            if (labelEl) labelEl.textContent = OnboardingConfig.getOptionLabel(OnboardingConfig.LEAD_STATUSES, value);
            document.querySelectorAll('#statusDropdown .dropdown-item').forEach(opt => {
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
        const labelEl = document.querySelector('.dropdown-wrap--up .dropdown-trigger span');
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
                    const result = await CloudStorage.postApi('deleteOnboardings', { requestIds: ids });
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

    // ── Form Dropdowns ──

    function _toggleFormDropdown(trigger) {
        const menuId = trigger.dataset.target;
        const menu = document.getElementById(menuId);
        if (!menu) return;
        document.querySelectorAll('.dropdown-wrap--form .dropdown-menu:not(.hidden)').forEach(m => {
            if (m !== menu) m.classList.add('hidden');
        });
        menu.classList.toggle('hidden');
    }

    function _selectFormDropdown(target) {
        const menu = target.closest('.dropdown-menu');
        const wrap = target.closest('.dropdown-wrap--form');
        if (!menu || !wrap) return;
        const value = target.dataset.value ?? '';
        const label = target.textContent;
        const input = wrap.querySelector('input[type="hidden"]');
        if (input) input.value = value;
        const trigger = wrap.querySelector('.dropdown-trigger--form');
        const labelEl = trigger?.querySelector('span');
        if (labelEl) labelEl.textContent = label;
        trigger?.classList.toggle('placeholder', !value);
        menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        target.classList.add('active');
        menu.classList.add('hidden');
    }

    // Close form dropdowns on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-wrap--form')) {
            document.querySelectorAll('.dropdown-wrap--form .dropdown-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
        }
    });

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
        const menu = document.getElementById('reassignTargetMenu');
        const input = document.getElementById('reassignTargetValue');
        const label = document.getElementById('reassignTargetLabel');
        const trigger = document.getElementById('reassignTargetTrigger');
        if (menu) {
            menu.innerHTML = '<div class="dropdown-item dropdown-item--disabled">Загрузка...</div>';
            if (input) input.value = '';
            if (label) label.textContent = 'Выберите менеджера';
            if (trigger) trigger.classList.add('placeholder');
            try {
                const employees = await CloudStorage.getEmployees();
                let html = '<div class="dropdown-item active" data-action="onb-selectFormDropdown" data-value="">Выберите менеджера</div>';
                employees.forEach(emp => {
                    html += '<div class="dropdown-item" data-action="onb-selectFormDropdown" data-value="' + Utils.escapeHtml(emp.email) + '" data-label="' + Utils.escapeHtml(emp.name || emp.email) + '">' + Utils.escapeHtml(emp.name || emp.email) + '</div>';
                });
                menu.innerHTML = html;
            } catch {
                menu.innerHTML = '<div class="dropdown-item active" data-action="onb-selectFormDropdown" data-value="">Выберите менеджера</div>';
            }
        }

        const reasonMenu = document.getElementById('reassignReasonMenu');
        const reasonInput = document.getElementById('reassignReasonValue');
        if (reasonMenu && !reasonMenu.dataset.populated) {
            let html = '<div class="dropdown-item active" data-action="onb-selectFormDropdown" data-value="">Выберите причину</div>';
            OnboardingConfig.REASSIGN_REASONS.forEach(r => {
                html += '<div class="dropdown-item" data-action="onb-selectFormDropdown" data-value="' + Utils.escapeHtml(r.value) + '">' + Utils.escapeHtml(r.label) + '</div>';
            });
            reasonMenu.innerHTML = html;
            reasonMenu.dataset.populated = '1';
        }
        if (reasonInput) reasonInput.value = '';
        const reasonLabel = document.getElementById('reassignReasonLabel');
        const reasonTrigger = document.getElementById('reassignReasonTrigger');
        if (reasonLabel) reasonLabel.textContent = 'Выберите причину';
        if (reasonTrigger) reasonTrigger.classList.add('placeholder');

        _openModal('reassignModal');
    }

    async function _confirmReassign() {
        const request = OnboardingState.get('currentRequest');
        if (!request || _isActionLocked()) return;

        const target = document.getElementById('reassignTargetValue')?.value || '';
        const targetLabel = document.getElementById('reassignTargetLabel')?.textContent || target;
        const targetName = target ? targetLabel : '';
        const reason = document.getElementById('reassignReasonValue')?.value || '';
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

        const menu = document.getElementById('rollbackTargetMenu');
        const input = document.getElementById('rollbackTargetValue');
        const label = document.getElementById('rollbackTargetLabel');
        const trigger = document.getElementById('rollbackTargetTrigger');
        if (!menu) return;

        let html = '<div class="dropdown-item active" data-action="onb-selectFormDropdown" data-value="">Выберите шаг</div>';
        for (let i = 1; i < request.currentStep; i++) {
            html += '<div class="dropdown-item" data-action="onb-selectFormDropdown" data-value="' + i + '">' + Utils.escapeHtml(OnboardingConfig.getStepLabel(i)) + '</div>';
        }
        menu.innerHTML = html;
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
        // Apply filter
        OnboardingState.set('filters.status', value.startsWith('status:') ? value.replace('status:', '') : '');
        OnboardingList.applyFilters();
        // Close
        _closeFilterDropdown();
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

    // ── Auto-Refresh (list + detail views) ──

    function _startListRefresh() {
        _stopListRefresh();
        _listRefreshTimer = setInterval(() => _pollForChanges(), POLL_INTERVAL);

        if (!_visibilityRefreshHandler) {
            _visibilityRefreshHandler = () => {
                if (document.visibilityState === 'visible') {
                    _pollErrorCount = 0;
                    _stopListRefresh();
                    _listRefreshTimer = setInterval(() => _pollForChanges(), POLL_INTERVAL);
                    _pollForChanges();
                } else {
                    _stopListRefresh();
                }
            };
            document.addEventListener('visibilitychange', _visibilityRefreshHandler);
        }
    }

    function _stopListRefresh() {
        if (_listRefreshTimer) {
            clearInterval(_listRefreshTimer);
            _listRefreshTimer = null;
        }
    }

    function _destroyRefresh() {
        _stopListRefresh();
        _stopStatusWatch();
        if (_visibilityRefreshHandler) {
            document.removeEventListener('visibilitychange', _visibilityRefreshHandler);
            _visibilityRefreshHandler = null;
        }
    }

    async function _pollForChanges() {
        if (_pollInFlight) return;
        if (_isActionLocked()) return;
        if (document.visibilityState === 'hidden') return;
        // Skip list polling when status watch is active (it has its own polling)
        // to avoid double API calls
        if (_statusWatchTimer && OnboardingState.get('view') !== 'list') return;
        _pollInFlight = true;
        try {
            const result = await CloudStorage.postApi('getOnboardingLastModified', {});
            const serverTs = result.ts || '0';
            _pollErrorCount = 0;
            if (serverTs !== _lastKnownModified) {
                _lastKnownModified = serverTs;
                await _refreshCurrentView();
            }
        } catch (_) {
            _pollErrorCount++;
            if (_pollErrorCount >= MAX_POLL_ERRORS) {
                _stopListRefresh();
                Toast.warning('Нет связи с сервером. Данные могут быть неактуальны.');
            }
        } finally {
            _pollInFlight = false;
        }
    }

    async function _refreshListData() {
        if (_isActionLocked()) return;
        try {
            const data = await CloudStorage.getOnboardingRequests(false);
            OnboardingState.set('requests', data.requests || []);
            if (data.history) OnboardingState.set('history', data.history);
            OnboardingList.applyFilters();
        } catch (_) { /* silent — фоновое обновление */ }
    }

    async function _refreshCurrentView() {
        const view = OnboardingState.get('view');
        if (view === 'list') {
            await _refreshListData();
        } else {
            // В detail view: обновляем текущую заявку + фоновый список
            const current = OnboardingState.get('currentRequest');
            if (!current || _isActionLocked()) return;
            try {
                const data = await CloudStorage.getOnboardingRequests(false);
                const fresh = data.requests || [];
                OnboardingState.set('requests', fresh);
                if (data.history) OnboardingState.set('history', data.history);
                OnboardingList.applyFilters(); // Список актуален при возврате

                const updated = fresh.find(r => r.id === current.id);
                if (updated) {
                    const structural = updated.status !== current.status
                        || updated.currentStep !== current.currentStep
                        || updated.assigneeEmail !== current.assigneeEmail;
                    const dataChanged = updated.updatedDate !== current.updatedDate;

                    if (structural || dataChanged) {
                        OnboardingState.set('currentRequest', updated);
                        const stepNumber = OnboardingState.get('currentStep');

                        if (view === 'form') {
                            if (structural) {
                                // Structural change (status/step/assignee) — must re-render.
                                // Save current form input to stageData before re-render
                                // so unsaved edits are preserved when possible.
                                const currentData = OnboardingForm.collectFormData(stepNumber, { excludeFiles: true });
                                if (currentData && Object.keys(currentData).length > 0) {
                                    if (!updated.stageData) updated.stageData = {};
                                    if (!updated.stageData[stepNumber]) updated.stageData[stepNumber] = {};
                                    // Merge local edits into fresh data (local wins for fields user is editing)
                                    Object.assign(updated.stageData[stepNumber], currentData);
                                }
                                // Re-open request to pick correct view (form vs review)
                                _openRequest(current.id);
                            }
                            // Non-structural data change in form view: don't re-render
                            // (executor is editing, their local data takes precedence).
                            // Sidebar info will update on next view switch.
                        } else if (view === 'review') {
                            // Review view: обновляем только при структурных изменениях
                            // (статус, шаг, назначение). Черновики executor не показываем —
                            // reviewer видит данные только после submitStep/approveStep.
                            if (structural) {
                                OnboardingReview.render(updated, stepNumber);
                                OnboardingSteps.renderVertical('reviewSteps', stepNumber);
                                OnboardingSteps.renderInfo('reviewInfo', updated);
                            }
                        }
                    }
                }
            } catch (_) { /* silent */ }
        }
    }

    // ── Destroy ──

    function _destroy() {
        // Flush pending draft before cleanup
        _autosaveDraft();
        _destroyRefresh();
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
