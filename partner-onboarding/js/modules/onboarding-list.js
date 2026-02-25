/**
 * OnboardingList — Список заявок, карточки, фильтры
 * Рендеринг карточек заявок + применение фильтров + пустые состояния
 */

const OnboardingList = {
    /** Применить фильтры и перерисовать список */
    applyFilters() {
        const ownership = document.getElementById('filterOwnership')?.value || 'my';
        const status = document.getElementById('filterStatus')?.value || 'all';
        const search = document.getElementById('searchInput')?.value?.trim().toLowerCase() || '';

        OnboardingState.set('filters.ownership', ownership);
        OnboardingState.set('filters.status', status);
        OnboardingState.set('filters.search', search);

        const requests = OnboardingState.get('requests') || [];
        const userEmail = OnboardingState.get('userEmail');
        const userRole = OnboardingState.get('userRole');

        let filtered = requests;

        // Ownership filter (role-based isolation)
        if (ownership === 'my') {
            filtered = filtered.filter(r =>
                r.createdBy === userEmail || r.assigneeEmail === userEmail
            );
        } else if (ownership === 'review') {
            filtered = filtered.filter(r => {
                if (r.status !== 'reviewer') return false;
                const stage = OnboardingConfig.getStage(r.currentStageNumber);
                return stage && stage.reviewerRole === userRole;
            });
        }
        // 'all' — no ownership filter (admin/leader only)

        // Status filter
        if (status !== 'all') {
            filtered = filtered.filter(r => r.status === status);
        }

        // Search filter (по ФИО, источнику лида, ID)
        if (search) {
            filtered = filtered.filter(r =>
                (r.title || '').toLowerCase().includes(search) ||
                (r.id || '').toLowerCase().includes(search) ||
                (r.stageData?.[1]?.contact_name || '').toLowerCase().includes(search)
            );
        }

        OnboardingState.set('filteredRequests', filtered);
        this.render(filtered);
    },

    /** Рендеринг списка карточек */
    render(requests) {
        const container = document.getElementById('requestsList');
        const emptyState = document.getElementById('emptyState');
        const loadingState = document.getElementById('listLoadingState');

        if (!container) return;

        loadingState?.classList.add('hidden');

        if (!requests || requests.length === 0) {
            container.innerHTML = '';
            emptyState?.classList.remove('hidden');
            return;
        }

        emptyState?.classList.add('hidden');
        container.innerHTML = requests.map(r => this._renderCard(r)).join('');
    },

    /** Рендеринг одной карточки */
    _renderCard(request) {
        const statusLabel = OnboardingConfig.getStatusLabel(request.status);
        const statusClass = OnboardingConfig.getStatusClass(request.status);
        const totalStages = OnboardingConfig.totalStages;
        const timeAgo = this._timeAgo(request.createdDate);

        // Заголовок: ФИО контакта (из stageData[1]), fallback на title (источник лида)
        const contactName = request.stageData?.[1]?.contact_name;
        const cardTitle = contactName || request.title;

        // Subtitle: источник · ID · Шаг X/Y · Менеджер
        const subtitleParts = [
            `<span>${Utils.escapeHtml(request.title)}</span>`
        ];
        subtitleParts.push(`<span class="request-card-id">${Utils.escapeHtml(request.id)}</span>`);

        if (request.status !== 'completed' && request.status !== 'cancelled') {
            subtitleParts.push(`<span>Шаг ${request.currentStageNumber}/${totalStages}</span>`);
        }

        const shortName = this._shortName(request.assigneeName);
        if (shortName) {
            subtitleParts.push(`<span>${Utils.escapeHtml(shortName)}</span>`);
        }

        return `
            <div class="request-card" data-status="${Utils.escapeHtml(request.status)}" data-action="onboarding-openDetail" data-value="${Utils.escapeHtml(request.id)}">
                <div class="request-card-main">
                    <div class="request-card-title">${Utils.escapeHtml(cardTitle)}</div>
                    <div class="request-card-subtitle">${subtitleParts.join('<span class="dot-sep">·</span>')}</div>
                </div>
                <div class="request-card-right">
                    <span class="status-badge ${statusClass}">${Utils.escapeHtml(statusLabel)}</span>
                    <span class="request-card-time">${timeAgo}</span>
                </div>
            </div>
        `;
    },

    /** Сокращение имени: "Иван Петров" → "И. Петров" */
    _shortName(name) {
        if (!name) return '';
        const parts = name.trim().split(/\s+/);
        if (parts.length < 2) return name;
        return parts[0][0] + '. ' + parts.slice(1).join(' ');
    },

    /** Форматирование "время назад" */
    _timeAgo(dateString) {
        if (!dateString) return '';
        const now = new Date();
        const date = new Date(dateString);
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'только что';
        if (diff < 3600) return Math.floor(diff / 60) + ' мин. назад';
        if (diff < 86400) return Math.floor(diff / 3600) + ' ч. назад';
        if (diff < 2592000) return Math.floor(diff / 86400) + ' дн. назад';
        return Utils.formatDate(dateString);
    },

    /** Настроить фильтры по умолчанию в зависимости от роли */
    setupDefaultFilters() {
        const userRole = OnboardingState.get('userRole');
        const filterOwnership = document.getElementById('filterOwnership');
        if (!filterOwnership) return;

        // Sales: only "my" filter, hide others
        if (userRole === 'sales') {
            filterOwnership.innerHTML = '<option value="my">Мои заявки</option>';
        } else if (userRole === 'admin') {
            filterOwnership.value = 'all';
        } else if (userRole === 'leader') {
            filterOwnership.value = 'all';
        } else {
            // Reviewer roles: default to "review"
            filterOwnership.value = 'review';
        }
    }
};
