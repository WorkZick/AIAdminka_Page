/* partner-onboarding.js — Главный контроллер */

const PartnerOnboarding = (() => {
    'use strict';

    const STORAGE_KEY = 'onboarding-v2-requests';
    const ID_COUNTER_KEY = 'onboarding-v2-id-counter';

    let _confirmCallback = null;
    const _debouncedSearch = Utils.debounce(() => OnboardingList.applyFilters(), 150);
    const _debouncedAutosave = Utils.debounce(() => _autosaveDraft(), 500);

    // ── Init ──

    function init() {
        OnboardingList.init();
        _loadUserData();
        _setupDevRoleSwitcher();
        _loadRequests();
        OnboardingList.setupDefaultFilters();
        OnboardingList.applyFilters();
    }

    function _loadUserData() {
        const systemRole = (typeof RoleGuard !== 'undefined' && RoleGuard.getCurrentRole)
            ? RoleGuard.getCurrentRole() : 'executor';
        const email = (typeof RoleGuard !== 'undefined' && RoleGuard.user)
            ? RoleGuard.user.email || '' : '';

        // Map system roles to module roles
        const roleMap = { sales: 'executor', partners_mgr: 'executor', assistant: 'reviewer', antifraud: 'reviewer' };
        const moduleRole = roleMap[systemRole] || systemRole; // admin/leader stay as-is

        OnboardingState.set('userRole', moduleRole);
        OnboardingState.set('userEmail', email);
    }

    // ── Storage (localStorage) ──

    function _loadRequests() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            const requests = Array.isArray(parsed) ? parsed : [];
            OnboardingState.set('requests', requests);
            _syncIdCounter(requests);
        } catch {
            OnboardingState.set('requests', []);
        }
    }

    function _saveRequests() {
        const requests = OnboardingState.get('requests') || [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    }

    function _syncIdCounter(requests) {
        const maxId = Math.max(0, ...requests.map(r => parseInt(r.id.replace('ONB', ''), 10) || 0));
        const current = parseInt(localStorage.getItem(ID_COUNTER_KEY) || '0', 10);
        if (current < maxId) localStorage.setItem(ID_COUNTER_KEY, String(maxId));
    }

    function _nextId() {
        let counter = parseInt(localStorage.getItem(ID_COUNTER_KEY) || '0', 10);
        counter++;
        localStorage.setItem(ID_COUNTER_KEY, String(counter));
        return 'ONB' + String(counter).padStart(6, '0');
    }

    function _getRequest(id) {
        return (OnboardingState.get('requests') || []).find(r => r.id === id);
    }

    function _updateRequest(id, updates) {
        const requests = OnboardingState.get('requests') || [];
        const idx = requests.findIndex(r => r.id === id);
        if (idx === -1) return;
        Object.assign(requests[idx], updates);
        OnboardingState.set('requests', requests);
        _saveRequests();
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
        const myRole = OnboardingState.get('userRole');
        const isAdminLike = myRole === 'admin' || myRole === 'leader';
        const view = OnboardingState.get('view');
        const containerId = view === 'form' ? 'formAdminActions' : 'reviewAdminActions';
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';
        if (request.status !== 'completed' && request.status !== 'cancelled') {
            if (isAdminLike || OnboardingConfig.isReviewer(request.currentStep, myRole)) {
                html += `<button class="btn btn-ghost" data-action="onb-showReassign">Передать</button>`;
                html += `<button class="btn btn-ghost" data-action="onb-showRollback">Откатить</button>`;
            }
            if (isAdminLike) {
                html += `<button class="btn btn-ghost btn-danger-text" data-action="onb-cancelRequest">Отменить</button>`;
            }
        }
        if (request.status === 'cancelled' && isAdminLike) {
            html += `<button class="btn btn-ghost" data-action="onb-reactivateRequest">Восстановить</button>`;
        }
        container.innerHTML = html;
    }

    // ── Event Delegation ──

    function _handleClick(e) {
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

            // Confirm modal
            case 'onb-closeConfirm': _closeModal('confirmModal'); break;
            case 'onb-confirmAction': if (_confirmCallback) { _confirmCallback(); _closeModal('confirmModal'); } break;

            // Form field actions
            case 'onb-removeFile': OnboardingForm.removeFile(value); break;
            case 'onb-addListItem': OnboardingForm.addListItem(value); break;
            case 'onb-removeListItem': {
                const [fid, idx] = value.split(':');
                OnboardingForm.removeListItem(fid, parseInt(idx, 10));
                break;
            }
            case 'onb-openPhoto': _openPhotoLightbox(target); break;

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

    function _createRequest() {
        const myEmail = OnboardingState.get('userEmail');
        const myRole = OnboardingState.get('userRole');

        const request = {
            id: _nextId(),
            leadSource: '',
            currentStep: 1,
            status: 'in_progress',
            createdBy: myEmail,
            createdDate: new Date().toISOString(),
            assigneeEmail: myEmail,
            assigneeName: '',
            lastComment: '',
            stageData: {},
            history: [{ step: 0, action: 'create', actor: myEmail, timestamp: new Date().toISOString(), comment: '' }]
        };

        const requests = OnboardingState.get('requests') || [];
        requests.push(request);
        OnboardingState.set('requests', requests);
        _saveRequests();

        OnboardingState.set('currentRequest', request);
        OnboardingState.set('currentStep', 1);
        OnboardingForm.render(request, 1);
        _showView('form');
    }

    function _openRequest(id) {
        const request = _getRequest(id);
        if (!request) return;

        OnboardingState.set('currentRequest', request);
        OnboardingState.set('currentStep', request.currentStep);

        const myRole = OnboardingState.get('userRole');
        const myEmail = OnboardingState.get('userEmail');
        const step = OnboardingConfig.getStep(request.currentStep);
        const isAdminLike = myRole === 'admin' || myRole === 'leader';
        const effectiveExecutor = OnboardingConfig.getStepEffectiveExecutor(request.currentStep, request.stageData);

        // Decide view
        // Dynamic handoff on_review: executor sees review (readonly + withdraw)
        if (request.status === 'on_review' && step.dynamicExecutor && step.executor === myRole) {
            OnboardingReview.render(request, request.currentStep);
            _showView('review');
        // Dynamic handoff on_review: reviewer (or admin) fills form
        } else if (request.status === 'on_review' && step.dynamicExecutor && (effectiveExecutor === myRole || isAdminLike)) {
            OnboardingForm.render(request, request.currentStep);
            _showView('form');
        // Standard in_progress: executor fills form
        } else if (request.status === 'in_progress' && step.executor === myRole) {
            OnboardingForm.render(request, request.currentStep);
            _showView('form');
        // Standard on_review: reviewer sees review
        } else if (request.status === 'on_review' && (step.reviewer === myRole || isAdminLike)) {
            OnboardingReview.render(request, request.currentStep);
            _showView('review');
        // Admin fallback for in_progress
        } else if (isAdminLike && request.status === 'in_progress') {
            OnboardingForm.render(request, request.currentStep);
            _showView('form');
        } else {
            OnboardingReview.render(request, request.currentStep);
            _showView('review');
        }
    }

    function _goToStep(stepNumber) {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

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

        const data = OnboardingForm.collectFormData(stepNumber);
        if (!request.stageData) request.stageData = {};
        request.stageData[stepNumber] = { ...request.stageData[stepNumber], ...data };

        const updates = { stageData: request.stageData };
        if (stepNumber === 1 && data.lead_source) {
            request.leadSource = data.lead_source;
            updates.leadSource = data.lead_source;
        }

        _updateRequest(request.id, updates);
    }

    function _submitStep() {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request) return;

        const step = OnboardingConfig.getStep(stepNumber);
        const myRole = OnboardingState.get('userRole');

        // Executor confirms handoff-completed data → skip validation, advance
        if (step && step.dynamicExecutor && (request.stageData[stepNumber] || {})._handoff_complete) {
            if (stepNumber !== request.currentStep) return;
            _addHistory(request, stepNumber, 'approve');
            const nextStep = stepNumber + 1;
            if (nextStep > OnboardingConfig.STEPS.length) {
                _addHistory(request, stepNumber, 'complete');
                _updateRequest(request.id, { stageData: request.stageData, currentStep: stepNumber, status: 'completed', lastComment: '' });
                Toast.success('Заявка завершена!');
                _showView('list');
            } else {
                _updateRequest(request.id, { stageData: request.stageData, currentStep: nextStep, status: 'in_progress', lastComment: '' });
                const nextStepConf = OnboardingConfig.getStep(nextStep);
                if (nextStepConf.executor === myRole) {
                    const updated = _getRequest(request.id);
                    OnboardingState.set('currentRequest', updated);
                    OnboardingState.set('currentStep', nextStep);
                    OnboardingForm.render(updated, nextStep);
                } else {
                    Toast.success('Шаг выполнен');
                    _showView('list');
                }
            }
            return;
        }

        // Validate
        const { valid, errors } = OnboardingForm.validate(stepNumber);
        if (!valid) {
            Toast.error(errors[0]);
            return;
        }

        // Block submit on past steps (autosave handles saving)
        if (stepNumber !== request.currentStep) {
            _autosaveDraft();
            return;
        }

        // Save data
        const data = OnboardingForm.collectFormData(stepNumber);
        if (!request.stageData) request.stageData = {};
        request.stageData[stepNumber] = { ...request.stageData[stepNumber], ...data };

        // Sync leadSource from step 1
        if (stepNumber === 1 && data.lead_source) {
            request.leadSource = data.lead_source;
        }

        // Dynamic executor: executor chose "reviewer" → hand off to reviewer
        if (step.dynamicExecutor) {
            const creator = data[step.dynamicExecutor.field];
            const isAdminLike = myRole === 'admin' || myRole === 'leader';
            if (creator === step.dynamicExecutor.reviewerValue && myRole !== 'reviewer' && !isAdminLike) {
                _addHistory(request, stepNumber, 'submit', 'Запрос на создание аккаунта');
                _updateRequest(request.id, {
                    stageData: request.stageData,
                    leadSource: request.leadSource,
                    status: 'on_review'
                });
                Toast.success('Запрос на создание аккаунта отправлен');
                _showView('list');
                return;
            }
            // Reviewer completed → send data back to executor
            if (creator === step.dynamicExecutor.reviewerValue && myRole === 'reviewer') {
                request.stageData[stepNumber]._handoff_complete = true;
                _addHistory(request, stepNumber, 'submit', 'Данные аккаунта отправлены');
                _updateRequest(request.id, {
                    stageData: request.stageData,
                    leadSource: request.leadSource,
                    status: 'in_progress'
                });
                Toast.success('Данные отправлены экзекьютору');
                _showView('list');
                return;
            }
        }

        // Antifraud: if failed → cancel
        if (data.antifraud_result === 'failed') {
            _addHistory(request, stepNumber, 'cancel', data.antifraud_comment || 'Не прошёл антифрод');
            _updateRequest(request.id, {
                stageData: request.stageData,
                status: 'cancelled',
                lastComment: data.antifraud_comment || 'Не прошёл антифрод проверку'
            });
            Toast.warning('Заявка отменена: не прошла антифрод');
            _showView('list');
            return;
        }

        if (step.reviewer) {
            // Has reviewer → send to review
            _addHistory(request, stepNumber, 'submit');
            _updateRequest(request.id, {
                stageData: request.stageData,
                leadSource: request.leadSource,
                status: 'on_review',
                lastComment: ''
            });
            Toast.success('Отправлено на проверку');
            _showView('list');
        } else {
            // No reviewer → advance to next step
            _addHistory(request, stepNumber, 'approve');
            const nextStep = stepNumber + 1;

            if (nextStep > OnboardingConfig.STEPS.length) {
                // Completed
                _addHistory(request, stepNumber, 'complete');
                _updateRequest(request.id, {
                    stageData: request.stageData,
                    leadSource: request.leadSource,
                    currentStep: stepNumber,
                    status: 'completed',
                    lastComment: ''
                });
                Toast.success('Заявка завершена!');
                _showView('list');
            } else {
                _updateRequest(request.id, {
                    stageData: request.stageData,
                    leadSource: request.leadSource,
                    currentStep: nextStep,
                    status: 'in_progress',
                    lastComment: ''
                });

                // Check if next step executor is different
                const nextStepConf = OnboardingConfig.getStep(nextStep);
                if (nextStepConf.executor === myRole) {
                    // Continue editing
                    const updated = _getRequest(request.id);
                    OnboardingState.set('currentRequest', updated);
                    OnboardingState.set('currentStep', nextStep);
                    OnboardingForm.render(updated, nextStep);
                } else {
                    Toast.success('Шаг выполнен, передано ' + nextStepConf.executor + '\'у');
                    _showView('list');
                }
            }
        }
    }

    function _approveStep() {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request || request.status !== 'on_review') return;

        const comment = document.getElementById('reviewComment').value.trim();
        _addHistory(request, stepNumber, 'approve', comment);

        const nextStep = stepNumber + 1;
        if (nextStep > OnboardingConfig.STEPS.length) {
            _updateRequest(request.id, { status: 'completed', currentStep: stepNumber, lastComment: '' });
            Toast.success('Заявка завершена!');
        } else {
            _updateRequest(request.id, { status: 'in_progress', currentStep: nextStep, lastComment: '' });
            Toast.success('Шаг одобрен');
        }
        _showView('list');
    }

    function _rejectStep() {
        const request = OnboardingState.get('currentRequest');
        const stepNumber = OnboardingState.get('currentStep');
        if (!request || request.status !== 'on_review') return;

        const comment = document.getElementById('reviewComment').value.trim();
        if (!comment) {
            Toast.error('Добавьте комментарий для возврата');
            return;
        }

        _addHistory(request, stepNumber, 'reject', comment);
        _updateRequest(request.id, { status: 'in_progress', lastComment: comment });
        Toast.info('Заявка возвращена на доработку');
        _showView('list');
    }

    function _withdrawStep() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const step = OnboardingConfig.getStep(request.currentStep);
        const effectiveExecutor = OnboardingConfig.getStepEffectiveExecutor(request.currentStep, request.stageData);

        // Dynamic handoff withdraw: reset account_creator choice, status back to in_progress
        if (step && step.dynamicExecutor && effectiveExecutor !== step.executor && request.status === 'on_review') {
            _addHistory(request, request.currentStep, 'withdraw');
            if (request.stageData && request.stageData[request.currentStep]) {
                delete request.stageData[request.currentStep][step.dynamicExecutor.field];
            }
            _updateRequest(request.id, { stageData: request.stageData, status: 'in_progress' });
            Toast.info('Запрос на создание отозван');
            _showView('list');
            return;
        }

        // Standard withdraw from on_review
        if (request.status !== 'on_review') return;
        _addHistory(request, request.currentStep, 'withdraw');
        _updateRequest(request.id, { status: 'in_progress' });
        Toast.info('Заявка отозвана с проверки');
        _showView('list');
    }

    function _confirmCancelRequest() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        _addHistory(request, request.currentStep, 'cancel');
        _updateRequest(request.id, { status: 'cancelled' });
        Toast.warning('Заявка отменена');
        _showView('list');
    }

    function _confirmReactivateRequest() {
        const request = OnboardingState.get('currentRequest');
        if (!request || request.status !== 'cancelled') return;

        _addHistory(request, request.currentStep, 'reactivate');
        _updateRequest(request.id, { status: 'in_progress', lastComment: '' });
        Toast.success('Заявка восстановлена');
        _showView('list');
    }

    // ── History Modal ──

    function _showHistoryModal() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;
        OnboardingSteps.renderHistoryModal(request);
        _openModal('historyModal');
    }

    // ── Reassign ──

    function _showReassignModal() {
        // TODO: populate from real team data via CloudStorage
        const targetSelect = document.getElementById('reassignTarget');
        if (targetSelect) {
            targetSelect.innerHTML = '<option value="">Выберите менеджера</option>';
        }

        // Populate reasons
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

    function _confirmReassign() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const targetSelect = document.getElementById('reassignTarget');
        const target = targetSelect.value;
        const targetName = targetSelect.options[targetSelect.selectedIndex]?.text || target;
        const reason = document.getElementById('reassignReason').value;
        const comment = document.getElementById('reassignComment').value.trim();

        if (!target) { Toast.error('Выберите менеджера'); return; }
        if (!reason) { Toast.error('Выберите причину'); return; }

        _addHistory(request, request.currentStep, 'reassign', comment);
        _updateRequest(request.id, { assigneeEmail: target, assigneeName: targetName });
        _closeModal('reassignModal');
        Toast.success('Заявка передана');
        _showView('list');
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

    function _confirmRollback() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const targetStep = parseInt(document.getElementById('rollbackTarget').value, 10);
        const comment = document.getElementById('rollbackComment').value.trim();

        if (!targetStep) { Toast.error('Выберите шаг'); return; }

        _addHistory(request, request.currentStep, 'rollback', comment);
        _updateRequest(request.id, { currentStep: targetStep, status: 'in_progress', lastComment: comment || '' });
        _closeModal('rollbackModal');
        Toast.info('Откат выполнен');
        _showView('list');
    }

    // ── Helpers ──

    function _addHistory(request, step, action, comment) {
        if (!request.history) request.history = [];
        request.history.push({
            step,
            action,
            actor: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: comment || ''
        });
    }

    function _mainFilter() {
        const select = document.getElementById('mainFilter');
        const value = select.value;

        if (value.startsWith('status:')) {
            // Status filter: show all ownership, filter by status
            OnboardingState.set('filters.ownership', 'all');
            OnboardingState.set('filters.status', value.replace('status:', ''));
        } else {
            // Ownership filter: clear status filter
            OnboardingState.set('filters.ownership', value);
            OnboardingState.set('filters.status', '');
        }
        OnboardingList.applyFilters();
    }

    function _openPhotoLightbox(target) {
        const img = target.tagName === 'IMG' ? target : target.querySelector('img');
        if (!img || !img.src) return;
        if (!img.src.startsWith('data:') && !img.src.startsWith('http')) return;

        const overlay = document.createElement('div');
        overlay.className = 'photo-lightbox';
        const photo = document.createElement('img');
        photo.src = img.src;
        photo.alt = '';
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
        const switcher = document.getElementById('roleSwitcher');
        if (isLocal && switcher) {
            switcher.classList.remove('hidden');
            OnboardingState.set('userRole', 'reviewer');
            OnboardingState.set('userEmail', 'dev@test.com');
        }
    }

    function _switchDevRole(role, target) {
        OnboardingState.set('userRole', role);
        document.querySelectorAll('#roleSwitcher .dev-role-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.value === role)
        );
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
            init();
        },
        onDestroy() {
            _destroy();
        },
        modals: {
            '#reassignModal': () => _closeModal('reassignModal'),
            '#rollbackModal': () => _closeModal('rollbackModal'),
            '#confirmModal': () => _closeModal('confirmModal'),
            '#historyModal': () => _closeModal('historyModal')
        }
    });

    return { init };
})();
