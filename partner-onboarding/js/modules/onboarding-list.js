/* onboarding-list.js — Таблица-строки заявок + прогресс-бар + фильтры */

const OnboardingList = (() => {
    'use strict';

    const TOTAL_STEPS = 8;

    function init() {
        OnboardingState.subscribe('filteredRequests', render);
        OnboardingState.subscribe('loading', _toggleLoading);
    }

    function render() {
        const requests = OnboardingState.get('filteredRequests') || [];
        const container = document.getElementById('requestsList');
        const emptyState = document.getElementById('listEmpty');
        const loading = document.getElementById('listLoading');

        if (!container) return;

        loading.classList.add('hidden');

        if (requests.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        container.innerHTML = requests.map(_renderRow).join('');
    }

    function _renderRow(request) {
        const statusConf = OnboardingConfig.STATUSES[request.status] || {};
        const sourceLabel = OnboardingConfig.getOptionLabel(OnboardingConfig.LEAD_SOURCES, request.leadSource) || 'Новая заявка';
        const contactName = (request.stageData && request.stageData[1] || {}).contact_name || '';
        const myRole = OnboardingState.get('userRole');
        const myEmail = OnboardingState.get('userEmail');
        const isMyTurn = _isMyTurn(request, myRole, myEmail);
        const dateTime = _formatDateTime(request.createdDate);
        const assigneeName = _shortenName(request.assigneeName || request.assigneeEmail);
        const title = contactName ? `${sourceLabel} — ${contactName}` : sourceLabel;
        const isTerminal = request.status === 'completed' || request.status === 'cancelled';

        // Progress bar segments
        const segments = [];
        for (let i = 1; i <= TOTAL_STEPS; i++) {
            let cls = 'progress-segment';
            if (i < request.currentStep) cls += ' done';
            else if (i === request.currentStep) cls += ' active';
            segments.push(`<div class="${cls}"></div>`);
        }

        // Turn indicator
        let turnHtml;
        if (isMyTurn) {
            turnHtml = '<span class="row-turn turn-action">Требует действия</span>';
        } else if (isTerminal) {
            turnHtml = '<span class="row-turn turn-none">\u2014</span>';
        } else {
            turnHtml = '<span class="row-turn turn-waiting">Ожидание</span>';
        }

        return `<div class="request-row ${isMyTurn ? 'my-turn' : ''}" data-action="onb-openRequest" data-value="${Utils.escapeHtml(request.id)}">
            <div class="row-progress">
                <div class="progress-bar">${segments.join('')}</div>
                <span class="row-step-num">${request.currentStep}/${TOTAL_STEPS}</span>
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
                <span class="status-badge ${Utils.escapeHtml(statusConf.cssClass || '')}">${Utils.escapeHtml(statusConf.label || request.status)}</span>
            </div>
            ${turnHtml}
        </div>`;
    }

    function applyFilters() {
        const requests = OnboardingState.get('requests') || [];
        const ownership = OnboardingState.get('filters.ownership');
        const status = OnboardingState.get('filters.status');
        const search = (OnboardingState.get('filters.search') || '').toLowerCase();
        const myRole = OnboardingState.get('userRole');
        const myEmail = OnboardingState.get('userEmail');

        let filtered = requests;

        // Ownership filter
        if (ownership === 'my') {
            filtered = filtered.filter(r =>
                r.assigneeEmail === myEmail || r.createdBy === myEmail
            );
        } else if (ownership === 'review') {
            filtered = filtered.filter(r => {
                if (r.status === 'completed' || r.status === 'cancelled') return false;
                const step = OnboardingConfig.getStep(r.currentStep);
                if (!step) return false;
                if (r.status === 'on_review') {
                    // Standard review
                    if (step.reviewer === myRole) return true;
                    // Dynamic executor handoff (e.g. account creation assigned to reviewer)
                    if (step.dynamicExecutor) {
                        const eff = OnboardingConfig.getStepEffectiveExecutor(r.currentStep, r.stageData);
                        if (eff === myRole && step.executor !== myRole) return true;
                    }
                }
                return false;
            });
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
        const role = OnboardingState.get('userRole');
        let ownership = 'all';
        if (role === 'executor') ownership = 'my';
        else if (role === 'reviewer') ownership = 'review';

        OnboardingState.set('filters.ownership', ownership);
        const select = document.getElementById('mainFilter');
        if (select) select.value = ownership;
    }

    function _isMyTurn(request, myRole, myEmail) {
        if (request.status === 'completed' || request.status === 'cancelled') return false;
        const step = OnboardingConfig.getStep(request.currentStep);
        if (!step) return false;

        if (request.status === 'on_review') {
            // Standard review
            if (step.reviewer === myRole) return true;
            // Dynamic handoff: effective executor's turn
            if (step.dynamicExecutor) {
                const eff = OnboardingConfig.getStepEffectiveExecutor(request.currentStep, request.stageData);
                return eff === myRole;
            }
            return false;
        }
        // in_progress: check effective executor
        const effectiveExecutor = OnboardingConfig.getStepEffectiveExecutor(request.currentStep, request.stageData);
        if (step.executor === myRole) {
            if (myRole === 'executor') {
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

    return { init, render, applyFilters, setupDefaultFilters };
})();
