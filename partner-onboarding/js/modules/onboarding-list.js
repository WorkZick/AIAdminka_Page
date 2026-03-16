/* onboarding-list.js — Таблица-строки заявок + прогресс-бар + фильтры */

const OnboardingList = (() => {
    'use strict';

    let _currentPage = 1;
    const _perPage = 30;

    function _totalSteps() {
        return OnboardingConfig.getVisibleStepCount(OnboardingState.get('userRole'));
    }

    function init() {
        OnboardingState.subscribe('filteredRequests', render);
        OnboardingState.subscribe('loading', _toggleLoading);
    }

    function render() {
        const allRequests = OnboardingState.get('filteredRequests') || [];
        const container = document.getElementById('requestsList');
        const emptyState = document.getElementById('listEmpty');
        const loading = document.getElementById('listLoading');

        if (!container) return;

        loading.classList.add('hidden');

        if (allRequests.length === 0) {
            container.innerHTML = '';
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            _hideSelectionToolbar();
            _renderPagination(0);
            return;
        }

        emptyState.classList.add('hidden');
        container.classList.remove('hidden');

        // Pagination
        const totalPages = Math.max(1, Math.ceil(allRequests.length / _perPage));
        if (_currentPage > totalPages) _currentPage = totalPages;
        const start = (_currentPage - 1) * _perPage;
        const pagedRequests = allRequests.slice(start, start + _perPage);

        const total = _totalSteps();
        container.innerHTML = pagedRequests.map(r => _renderRow(r, total)).join('');
        _updateSelectionToolbar();
        _renderPagination(totalPages);
    }

    function _renderPagination(totalPages) {
        const container = document.getElementById('onboardingPagination');
        if (!container) return;
        container.innerHTML = '';
        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '\u2190';
        prevBtn.disabled = _currentPage === 1;
        prevBtn.dataset.action = 'onb-goToPage';
        prevBtn.dataset.value = _currentPage - 1;
        container.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= _currentPage - 1 && i <= _currentPage + 1)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = 'page-btn' + (i === _currentPage ? ' active' : '');
                pageBtn.textContent = i;
                pageBtn.dataset.action = 'onb-goToPage';
                pageBtn.dataset.value = i;
                container.appendChild(pageBtn);
            } else if (i === _currentPage - 2 || i === _currentPage + 2) {
                const dots = document.createElement('span');
                dots.className = 'pagination-dots';
                dots.textContent = '...';
                container.appendChild(dots);
            }
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '\u2192';
        nextBtn.disabled = _currentPage === totalPages;
        nextBtn.dataset.action = 'onb-goToPage';
        nextBtn.dataset.value = _currentPage + 1;
        container.appendChild(nextBtn);
    }

    function goToPage(page) {
        const p = parseInt(page);
        if (isNaN(p) || p < 1) return;
        _currentPage = p;
        render();
    }

    function _renderRow(request, total) {
        const statusConf = OnboardingConfig.STATUSES[request.status] || {};
        const sourceLabel = OnboardingConfig.getOptionLabel(OnboardingConfig.LEAD_SOURCES, request.leadSource) || 'Новая заявка';
        const contactName = (request.stageData && request.stageData[1] || {}).contact_name || '';
        const myRole = OnboardingState.get('userRole');
        const sysRole = OnboardingState.get('systemRole');
        const myEmail = OnboardingState.get('userEmail');
        const isMyTurn = _isMyTurn(request, myRole, sysRole, myEmail);
        const dateTime = _formatDateTime(request.createdDate);
        const assigneeName = _shortenName(request.assigneeName || request.assigneeEmail);
        const title = contactName ? `${sourceLabel} — ${contactName}` : sourceLabel;
        const isTerminal = request.status === 'completed' || request.status === 'cancelled';
        const isWorkStatus = OnboardingConfig.isWorkStatus(request.status);
        const isAdminLike = myRole === 'admin' || myRole === 'leader';
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
        const checkboxHtml = isAdminLike
            ? `<input type="checkbox" class="row-checkbox" data-action="onb-toggleSelect" data-value="${Utils.escapeHtml(request.id)}">`
            : '';

        return `<div class="request-row ${isMyTurn ? 'my-turn' : ''} ${isAdminLike ? 'has-checkbox' : ''}" data-action="onb-openRequest" data-value="${Utils.escapeHtml(request.id)}">
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
                    ? '<span class="status-badge status--completed">Партнёр заведён</span>'
                    : `<span class="status-badge ${Utils.escapeHtml(statusConf.cssClass || '')}">${Utils.escapeHtml(statusConf.label || request.status)}</span>`}
            </div>
            ${turnHtml}
        </div>`;
    }

    function applyFilters() {
        _currentPage = 1;
        const requests = OnboardingState.get('requests') || [];
        const status = OnboardingState.get('filters.status');
        const search = (OnboardingState.get('filters.search') || '').toLowerCase();

        let filtered = requests;

        // Ownership filter: executor sees only own + unassigned
        const myRole = OnboardingState.get('userRole');
        const myEmail = OnboardingState.get('userEmail');
        if (myRole === 'executor' && myEmail) {
            filtered = filtered.filter(r =>
                r.assigneeEmail === myEmail ||
                r.createdBy === myEmail ||
                !r.assigneeEmail
            );
        }

        // Status filter
        if (status) {
            filtered = filtered.filter(r => r.status === status);
        }

        // Search
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

    function _formatDateTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}.${mm}.${yy} ${hh}:${min}`;
    }

    function _toggleLoading(isLoading) {
        const loading = document.getElementById('listLoading');
        const list = document.getElementById('requestsList');
        if (loading) loading.classList.toggle('hidden', !isLoading);
        if (list) list.classList.toggle('hidden', isLoading);
    }

    // ── Selection Toolbar ──

    function _updateSelectionToolbar() {
        const myRole = OnboardingState.get('userRole');
        if (myRole !== 'admin' && myRole !== 'leader') {
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

    return { init, render, applyFilters, setupDefaultFilters, getSelectedIds, toggleSelectAll, updateSelection: _updateSelectionToolbar, goToPage };
})();
