/* onboarding-list.js — Таблица-строки заявок + прогресс-бар + фильтры */

const OnboardingList = (() => {
    'use strict';

    // Server pagination state
    let _reqId = 0;
    let _currentPage = 1;
    const _pageSize = 20;
    let _totalCount = 0;
    // Гарантирует что empty state ("Заявок нет") не мигает до завершения первой загрузки
    let _initialLoadComplete = false;
    // Счётчик retry первой загрузки (защита от бесконечного цикла)
    let _firstLoadRetries = 0;
    const _FIRST_LOAD_MAX_RETRIES = 2;

    // Phase 31 BRIDGE-02: cleanup handles для direct OnboardingState subscriptions
    // (signals-bridge удалён — OnboardingState.subscribe теперь возвращает unsubscribe из BRIDGE-01).
    const _listCleanups = [];

    function _totalSteps() {
        return OnboardingConfig.getVisibleStepCount(OnboardingState.get('userRole'));
    }

    function init() {
        // Phase 31 BRIDGE-02: direct subscribe (post-bridge migration).
        // OnboardingState.subscribe() возвращает unsubscribe (BRIDGE-01) — tracked в _listCleanups.
        // Pitfall C cleanup: unsubscribe handles invoked на module destroy для предотвращения
        // stale callbacks на subsequent state mutations.
        const ownershipUnsub = OnboardingState.subscribe('filters.ownership', () => {
            if (typeof applyFilters === 'function') applyFilters();
        });
        const filteredUnsub = OnboardingState.subscribe('filteredRequests', render);
        const loadingUnsub = OnboardingState.subscribe('loading', _toggleLoading);
        _listCleanups.push(ownershipUnsub, filteredUnsub, loadingUnsub);
        // Сразу показываем loading state чтобы empty state не мигал до первой загрузки
        _renderSkeletonRows();
    }

    function destroy() {
        _listCleanups.forEach(c => { try { if (typeof c === 'function') c(); } catch (_) { /* swallow */ } });
        _listCleanups.length = 0;
    }

    /**
     * @param {number} page
     * @param {Object} [opts]
     * @param {boolean} [opts.silent] — НЕ показывать Toast.error при failure
     *   (используется background polling — транзитные ошибки обновления не должны
     *   беспокоить пользователя, следующий poll скорее всего успешен).
     */
    async function goToOnboardingPage(page, opts) {
        const silent = opts && opts.silent === true;
        const reqId = ++_reqId;
        _renderSkeletonRows();
        try {
            const filterStatus = OnboardingState.get('filters.status') || undefined;
            const result = await CloudStorage.getOnboardingRequests({
                page,
                pageSize: _pageSize,
                filterStatus,
                sortBy: 'createdDate',
                order: 'desc'
            });
            if (reqId !== _reqId) return; // stale discard
            // Update state
            OnboardingState.set('requests', result.requests || []);
            OnboardingState.set('history', result.history || {});
            _totalCount = result.totalCount || 0;
            _currentPage = result.page || page;
            // Apply local non-status filters (ownership, search) and render
            _initialLoadComplete = true;
            applyFilters();
            _renderServerPagination();
        } catch (error) {
            if (reqId !== _reqId) return;
            if (error && error._silentRedirect) return;
            // BFIX (audit 2026-05-20): background polling errors silenced — log only.
            // GAS backend иногда возвращает транзитный 500 (sheet lock contention после
            // write, deploy в момент запроса, etc). Polling retry next interval скорее
            // всего успешен. Беспокоить пользователя alarming toast'ом избыточно.
            if (silent) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[OnboardingList.goToOnboardingPage] silent polling error:',
                        error && error.message);
                }
                return;
            }
            if (!_initialLoadComplete) {
                // Первая загрузка упала: не показываем "Заявок нет" (вводит в заблуждение).
                // Оставляем loading spinner и планируем retry (max _FIRST_LOAD_MAX_RETRIES).
                if (!error._conflictHandled) Toast.error('Ошибка загрузки заявок: ' + error.message);
                if (_firstLoadRetries < _FIRST_LOAD_MAX_RETRIES) {
                    _firstLoadRetries++;
                    const retryPage = page;
                    setTimeout(() => {
                        if (!_initialLoadComplete) {
                            // Сбрасываем nsTs чтобы retry сделал полный запрос (bypass notModified)
                            if (typeof CloudStorage !== 'undefined' && CloudStorage._lastKnownNsTs) {
                                delete CloudStorage._lastKnownNsTs.onboardings;
                            }
                            if (typeof CloudStorage !== 'undefined' && CloudStorage.clearCacheNamespace) {
                                CloudStorage.clearCacheNamespace('onboardingRequests');
                            }
                            goToOnboardingPage(retryPage);
                        }
                    }, 5000);
                } else {
                    // Исчерпаны retry — показываем empty state чтобы пользователь не ждал вечно
                    _initialLoadComplete = true;
                    applyFilters();
                }
                return;
            }
            // Повторная загрузка упала — рендерим с текущими (stale) данными
            applyFilters();
            if (!error._conflictHandled) Toast.error('Ошибка загрузки заявок: ' + error.message);
        }
    }

    function _renderSkeletonRows() {
        const container = document.getElementById('requestsList');
        if (!container) return;
        container.classList.add('hidden');
        const emptyState = document.getElementById('listEmpty');
        if (emptyState) emptyState.classList.add('hidden');
        const loading = document.getElementById('listLoading');
        if (loading) loading.classList.remove('hidden');
    }

    function _renderServerPagination() {
        const container = document.getElementById('onboardingPagination');
        if (!container) return;
        if (_totalCount <= _pageSize) {
            // Phase 54 LIT-FIN-02: empty clear — replaceChildren() вместо innerHTML=''
            container.replaceChildren();
            return;
        }
        PaginationHelper.render(container, {
            page: _currentPage,
            pageSize: _pageSize,
            totalCount: _totalCount,
            onPageChange: (p) => goToOnboardingPage(p)
        });
    }

    function render() {
        const allRequests = OnboardingState.get('filteredRequests') || [];
        const container = document.getElementById('requestsList');
        const emptyState = document.getElementById('listEmpty');
        const loading = document.getElementById('listLoading');

        if (!container) return;

        // До завершения первой загрузки оставляем loading state видимым
        // (предотвращает мигание "Заявок нет" пока данные ещё грузятся)
        if (!_initialLoadComplete) {
            container.classList.add('hidden');
            if (emptyState) emptyState.classList.add('hidden');
            if (loading) loading.classList.remove('hidden');
            return;
        }

        if (loading) loading.classList.add('hidden');

        if (allRequests.length === 0) {
            // Phase 54 LIT-FIN-02: empty clear — replaceChildren() вместо innerHTML=''
            container.replaceChildren();
            container.classList.add('hidden');
            if (emptyState) {
                const hasFilter = !!OnboardingState.get('filters.status');
                const titleEl = emptyState.querySelector('.empty-state-title');
                const textEl = emptyState.querySelector('.empty-state-text');
                if (titleEl) titleEl.textContent = hasFilter ? 'Нет заявок с этим статусом' : 'Заявок нет';
                if (textEl) textEl.textContent = hasFilter ? 'Попробуйте выбрать другой фильтр' : 'Создайте первую заявку на заведение партнёра';
                emptyState.classList.remove('hidden');
            }
            _hideSelectionToolbar();
            const paginationEl = document.getElementById('onboardingPagination');
            // Phase 54 LIT-FIN-02: empty clear — replaceChildren() вместо innerHTML=''
            if (paginationEl) paginationEl.replaceChildren();
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        container.classList.remove('hidden');

        const total = _totalSteps();
        container.innerHTML = allRequests.map(r => _renderRow(r, total)).join('');
        _updateSelectionToolbar();
    }

    function goToPage(page) {
        goToOnboardingPage(parseInt(page));
    }

    function _renderRow(request, total) {
        const statusConf = OnboardingConfig.STATUSES[request.status] || {};
        const sourceLabel = OnboardingConfig.getOptionLabel(OnboardingConfig.LEAD_SOURCES, request.leadSource) || 'Новая заявка';
        const contactName = (request.stageData?.[1] || {}).contact_name || '';
        const { myRole, sysRole, isAdmin } = OnboardingUtils.getRoles();
        const myEmail = OnboardingState.get('userEmail');
        const isMyTurn = _isMyTurn(request, myRole, sysRole, myEmail);
        const dateTime = OnboardingUtils.formatDateTime(request.createdDate);
        const assigneeName = _shortenName(request.assigneeName || request.assigneeEmail);
        const title = contactName ? `${sourceLabel} — ${contactName}` : sourceLabel;
        const isTerminal = request.status === 'completed' || request.status === 'cancelled';
        const isWorkStatus = OnboardingConfig.isWorkStatus(request.status);
        const executorDone = OnboardingRoles.getGlobalModuleRole(sysRole) === 'executor' && OnboardingConfig.isExecutorCompleted(request);

        // Progress bar segments
        const segments = [];
        for (let i = 1; i <= total; i++) {
            let cls = 'progress-segment';
            if (executorDone) { cls += ' done'; }
            else if (i < request.currentStep) cls += ' done';
            else if (i === request.currentStep) cls += ' active';
            segments.push(`<div class="${cls}"></div>`);
        }

        // Turn indicator
        let turnHtml;
        if (executorDone) {
            turnHtml = '<span class="row-turn turn-none">\u2014</span>';
        } else if (isMyTurn) {
            turnHtml = '<span class="row-turn turn-action">Требует действия</span>';
        } else if (isTerminal) {
            turnHtml = '<span class="row-turn turn-none">\u2014</span>';
        } else {
            turnHtml = '<span class="row-turn turn-waiting">Ожидание</span>';
        }

        // Checkbox for admin/leader
        const checkboxHtml = isAdmin
            ? `<input type="checkbox" class="row-checkbox" data-action="onb-toggleSelect" data-value="${Utils.escapeHtml(request.id)}">`
            : '';

        const pendingClass = request._pending ? ' item--pending' : '';
        const errorClass = request._error ? ' item--error' : '';

        return `<div class="request-row ${isMyTurn ? 'my-turn' : ''} ${isAdmin ? 'has-checkbox' : ''}${pendingClass}${errorClass}" data-action="onb-openRequest" data-value="${Utils.escapeHtml(request.id)}">
            ${checkboxHtml}
            <div class="row-progress">
                <div class="progress-bar">${segments.join('')}</div>
                <span class="row-step-num">${executorDone ? total : request.currentStep}/${total}</span>
            </div>
            <div class="row-main">
                <span class="row-title">${Utils.escapeHtml(title)}</span>
                <span class="row-id">${Utils.escapeHtml(request.id)}</span>
            </div>
            <div class="row-meta">
                <span class="row-meta-name">${Utils.escapeHtml(assigneeName)}</span>
                <span class="row-meta-date">${Utils.escapeHtml(dateTime)}</span>
            </div>
            <div class="row-status">
                ${executorDone
                    ? '<span class="status-badge status-success">Партнёр заведён</span>'
                    : `<span class="status-badge ${Utils.escapeHtml(statusConf.cssClass || '')}">${Utils.escapeHtml(statusConf.label || request.status)}</span>`}
            </div>
            ${turnHtml}
            <span class="row-spinner spinner spinner--sm" aria-hidden="true"></span>
        </div>`;
    }

    function applyFilters() {
        // _currentPage НЕ сбрасываем — это локальные фильтры (search/ownership),
        // применяются к уже загруженной странице. Смена статус-фильтра отдельно
        // вызывает goToOnboardingPage(1) для server-side reset.
        const requests = OnboardingState.get('requests') || [];
        const search = (OnboardingState.get('filters.search') || '').toLowerCase();

        let filtered = requests;

        // Ownership filter: executor sees only own + unassigned
        const { myRole } = OnboardingUtils.getRoles();
        const myEmail = OnboardingState.get('userEmail');
        if (myRole === 'executor' && myEmail) {
            filtered = filtered.filter(r =>
                r.assigneeEmail === myEmail ||
                r.createdBy === myEmail ||
                !r.assigneeEmail
            );
        }

        // Search (local, non-status)
        if (search) {
            filtered = filtered.filter(r => {
                const contactName = (r.stageData && r.stageData[1] || {}).contact_name || '';
                return r.id.toLowerCase().includes(search) ||
                    contactName.toLowerCase().includes(search) ||
                    (r.assigneeName || '').toLowerCase().includes(search) ||
                    (r.assigneeEmail || '').toLowerCase().includes(search);
            });
        }

        // Sort by date desc
        filtered.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

        OnboardingState.set('filteredRequests', filtered);
    }

    function setupDefaultFilters() {
        OnboardingState.set('filters.ownership', 'all');
        const label = document.getElementById('filterLabel');
        if (label) label.textContent = 'Все заявки';
        const dropdown = document.getElementById('filterDropdown');
        if (dropdown) {
            dropdown.querySelectorAll('.dropdown-item').forEach(o => o.classList.toggle('active', o.dataset.value === 'all'));
        }
    }

    function _isMyTurn(request, myRole, sysRole, myEmail) {
        if (request.status === 'completed' || request.status === 'cancelled') return false;
        if (request.status === 'new') return OnboardingRoles.isExecutorForStep(sysRole, 1);
        const step = OnboardingConfig.getStep(request.currentStep);
        if (!step) return false;

        if (request.status === 'on_review') {
            // Standard review
            if (OnboardingRoles.isReviewerForStep(sysRole, request.currentStep)) return true;
            // Reviewer-executor step (e.g. antifraud): executor fills form
            if (OnboardingRoles.isExecutorForStep(sysRole, request.currentStep) && !step.reviewer) return true;
            // Dynamic handoff: effective executor's turn
            if (step.dynamicExecutor) {
                const stepData = (request.stageData && request.stageData[request.currentStep]) || {};
                // After executor confirmed (handoff complete + on_review) → reviewer's turn
                if (stepData._handoff_complete) return OnboardingRoles.isReviewerForStep(sysRole, request.currentStep);
                const eff = OnboardingConfig.getStepEffectiveExecutor(request.currentStep, request.stageData);
                if (eff === 'reviewer') return OnboardingRoles.isReviewerForStep(sysRole, request.currentStep);
                return OnboardingRoles.isExecutorForStep(sysRole, request.currentStep);
            }
            return false;
        }
        // in_progress / approved / revision_needed: check effective executor
        // AutoHandoff step phase 1: reviewer fills before handoff — reviewer's turn, not executor's
        if (step.dynamicExecutor && step.dynamicExecutor.autoHandoff) {
            const stepData = (request.stageData && request.stageData[request.currentStep]) || {};
            if (!stepData._handoff_complete) {
                return OnboardingRoles.isReviewerForStep(sysRole, request.currentStep);
            }
        }
        if (OnboardingRoles.isExecutorForStep(sysRole, request.currentStep)) {
            if (OnboardingRoles.getGlobalModuleRole(sysRole) === 'executor') {
                return request.assigneeEmail === myEmail || request.createdBy === myEmail;
            }
            return true;
        }
        return false;
    }

    function _shortenName(name) {
        if (!name) return '';
        const parts = name.split(' ');
        if (parts.length >= 2) return parts[0] + ' ' + parts[1][0] + '.';
        return parts[0];
    }

    function _toggleLoading(isLoading) {
        const loading = document.getElementById('listLoading');
        const list = document.getElementById('requestsList');
        if (loading) loading.classList.toggle('hidden', !isLoading);
        if (list) list.classList.toggle('hidden', isLoading);
    }

    // ── Selection Toolbar ──

    function _updateSelectionToolbar() {
        const { isAdmin } = OnboardingUtils.getRoles();
        if (!isAdmin) {
            _hideSelectionToolbar();
            return;
        }
        const checked = document.querySelectorAll('#requestsList .row-checkbox:checked');
        const toolbar = document.getElementById('selectionToolbar');
        const countEl = document.getElementById('selectedCount');
        if (!toolbar) return;

        if (checked.length > 0) {
            toolbar.classList.remove('hidden');
            if (countEl) countEl.textContent = checked.length;
        } else {
            toolbar.classList.add('hidden');
        }

        // Sync selectAll checkbox
        const allCheckboxes = document.querySelectorAll('#requestsList .row-checkbox');
        const selectAll = document.getElementById('selectAll');
        if (selectAll) {
            selectAll.checked = allCheckboxes.length > 0 && checked.length === allCheckboxes.length;
        }
    }

    function _hideSelectionToolbar() {
        const toolbar = document.getElementById('selectionToolbar');
        if (toolbar) toolbar.classList.add('hidden');
        const selectAll = document.getElementById('selectAll');
        if (selectAll) selectAll.checked = false;
    }

    function getSelectedIds() {
        const checked = document.querySelectorAll('#requestsList .row-checkbox:checked');
        return Array.from(checked).map(cb => cb.dataset.value);
    }

    function toggleSelectAll(checked) {
        document.querySelectorAll('#requestsList .row-checkbox').forEach(cb => { cb.checked = checked; });
        _updateSelectionToolbar();
    }

    function getCurrentPage() { return _currentPage; }

    return { init, destroy, render, applyFilters, setupDefaultFilters, getSelectedIds, toggleSelectAll, updateSelection: _updateSelectionToolbar, goToPage, goToOnboardingPage, getCurrentPage };
})();
