/* onboarding-list.js — Список заявок + фильтры + карточки */

const OnboardingList = (() => {
    'use strict';

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
        container.innerHTML = requests.map(_renderCard).join('');
    }

    function _renderCard(request) {
        const step = OnboardingConfig.getStep(request.currentStep);
        const statusConf = OnboardingConfig.STATUSES[request.status] || {};
        const sourceLabel = OnboardingConfig.getOptionLabel(OnboardingConfig.LEAD_SOURCES, request.leadSource) || 'Новая заявка';
        const contactName = (request.stageData && request.stageData[1] || {}).contact_name || '';
        const myRole = OnboardingState.get('userRole');
        const myEmail = OnboardingState.get('userEmail');
        const isMyTurn = _isMyTurn(request, myRole, myEmail);
        const timeAgo = _formatTimeAgo(request.createdDate);
        const assigneeName = _shortenName(request.assigneeName || request.assigneeEmail);
        const title = contactName ? `${sourceLabel} — ${contactName}` : sourceLabel;

        return `<div class="request-card ${isMyTurn ? 'my-turn' : ''}" data-action="onb-openRequest" data-value="${Utils.escapeHtml(request.id)}">
            <div class="request-card-top">
                <div class="request-card-source">${Utils.escapeHtml(title)}</div>
                <span class="request-card-id">${Utils.escapeHtml(request.id)}</span>
            </div>
            <div class="request-card-middle">
                <span class="request-card-step">Шаг ${request.currentStep}/${OnboardingConfig.STEPS.length}</span>
                <span class="request-card-dot">·</span>
                <span class="request-card-assignee">${Utils.escapeHtml(assigneeName)}</span>
                <span class="request-card-dot">·</span>
                <span class="request-card-time">${Utils.escapeHtml(timeAgo)}</span>
            </div>
            <div class="request-card-bottom">
                <span class="status-badge ${Utils.escapeHtml(statusConf.cssClass || '')}">${Utils.escapeHtml(statusConf.label || request.status)}</span>
                ${isMyTurn ? '<span class="turn-indicator">Ваш ход</span>' : '<span class="turn-indicator turn-waiting">Ожидание</span>'}
            </div>
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
                if (r.status !== 'on_review') return false;
                const step = OnboardingConfig.getStep(r.currentStep);
                return step && step.reviewer === myRole;
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
        if (role === 'sales') ownership = 'my';
        else if (role === 'assistant') ownership = 'review';

        OnboardingState.set('filters.ownership', ownership);
        _highlightFilterTab(ownership);
    }

    function _highlightFilterTab(value) {
        const tabs = document.querySelectorAll('#ownershipFilter .filter-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.value === value);
        });
    }

    function _isMyTurn(request, myRole, myEmail) {
        if (request.status === 'completed' || request.status === 'cancelled') return false;
        const step = OnboardingConfig.getStep(request.currentStep);
        if (!step) return false;

        if (request.status === 'on_review') {
            return step.reviewer === myRole;
        }
        // in_progress
        if (step.executor === myRole) {
            if (myRole === 'sales') {
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

    function _formatTimeAgo(dateStr) {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'только что';
        if (mins < 60) return mins + ' мин. назад';
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours + ' ч. назад';
        const days = Math.floor(hours / 24);
        if (days === 1) return 'вчера';
        if (days < 7) return days + ' дн. назад';
        return new Date(dateStr).toLocaleDateString('ru-RU');
    }

    function _toggleLoading(isLoading) {
        const loading = document.getElementById('listLoading');
        const list = document.getElementById('requestsList');
        if (loading) loading.classList.toggle('hidden', !isLoading);
        if (list) list.classList.toggle('hidden', isLoading);
    }

    return { init, render, applyFilters, setupDefaultFilters };
})();
