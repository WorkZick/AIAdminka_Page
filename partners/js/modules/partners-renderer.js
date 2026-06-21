// Partners Renderer - render, updateStats, sortBy, filterTable, toggleSidebar
//
// Phase 25 LIT-06 (Plan 25-07) bridge:
// — после render() / updateSelection() / updateStats() — sync PartnersState.cachedPartners → mod.items signal
// — <app-table> consumes mod.items.value через window.effect() в partners.js (Option A)
// — Lit auto-escape применяется в cell renderers (partners.js columns config)
// Reference: 25-RESEARCH.md §"Pattern 2: ModuleFactory + Lit binding (Option A)" + 25-07-PLAN.md.
const PartnersRenderer = {
    _filterTimer: null,

    // Phase 25 LIT-06: bridge — sync existing PartnersState → ModuleFactory items signal
    _syncToModuleFactory() {
        const mod = window.partnersModule;
        if (!mod || typeof window.batch !== 'function') return;
        try {
            window.batch(() => {
                mod.items.value = (PartnersState.cachedPartners || []).slice();
                if (mod.totalCount) {
                    mod.totalCount.value = PartnersState.totalCount || PartnersState.cachedPartners.length;
                }
            });
        } catch (_) { /* non-fatal */ }
    },

    renderSkeletonRows() {
        const table = document.querySelector('.partners-table');
        if (table) table.classList.add('hidden');
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.classList.add('hidden');
        const loading = document.getElementById('loadingState');
        if (loading) loading.classList.remove('hidden');
    },

    render() {
        const allPartners = PartnersState.getPartners();
        const tbody = document.getElementById('partnersTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.querySelector('.partners-table');
        const loading = document.getElementById('loadingState');
        if (loading) loading.classList.add('hidden');

        if (allPartners.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            if (table) table.classList.add('hidden');
            // Phase 25 LIT-06: sync empty state to ModuleFactory
            PartnersRenderer._syncToModuleFactory();
            PartnersRenderer.updateStats();
            const paginationContainer = document.getElementById('partnersPagination');
            if (paginationContainer) {
                PaginationHelper.render(paginationContainer, {
                    page: PartnersState.currentPage,
                    pageSize: PartnersState.pageSize,
                    totalCount: PartnersState.totalCount,
                    onPageChange: (newPage) => PartnersForms.goToPage(newPage)
                });
            }
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        if (table) table.classList.remove('hidden');

        const all = PartnersState.cachedPartners;
        const pageSize = PartnersState.pageSize;
        // Если массив длиннее pageSize — сервер НЕ нарезал страницу (batch-путь),
        // делаем client-side slice окна текущей страницы (fallback, как в onboarding).
        // Если массив ≤ pageSize — сервер уже вернул страницу, slice 20→20 безвреден.
        let pagedData = all;
        let effectiveTotal = PartnersState.totalCount;
        if (all.length > pageSize) {
            const page = Math.max(1, PartnersState.currentPage || 1);
            const start = (page - 1) * pageSize;
            pagedData = all.slice(start, start + pageSize);
            effectiveTotal = all.length; // totalCount для пагинации = длина всего массива
        }
        const columns = PartnersColumns.getColumnsConfig();
        const visibleColumns = columns.filter(c => c.visible);
        const selectedId = PartnersState.selectedPartnerId;
        const fragment = document.createDocumentFragment();

        pagedData.forEach(partner => {
            const statusClass = PartnersUtils.getStatusColor(partner.status || 'Открыт');
            const avatar = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
            const isValidAvatar = !!avatar;

            const tr = document.createElement('tr');
            const classes = [];
            if (selectedId === partner.id) classes.push('selected');
            if (partner._pending) classes.push('item--pending');
            if (partner._error) classes.push('item--error');
            tr.className = classes.join(' ');
            tr.dataset.partnerId = partner.id;

            let rowHtml = `
                <td>
                    <div class="counters-cell">
                        <span>${parseInt(partner.dep) || 0}</span>
                        <span>${parseInt(partner.with) || 0}</span>
                        <span>${parseInt(partner.comp) || 0}</span>
                    </div>
                </td>
            `;

            visibleColumns.forEach(col => {
                rowHtml += PartnersColumns.renderColumnCell(col.id, partner, statusClass, isValidAvatar);
            });

            rowHtml += `
                <td class="col-arrow">
                    <img class="row-arrow" src="../shared/icons/arrow.svg" alt="">
                </td>
            `;

            tr.innerHTML = rowHtml;

            if (isValidAvatar) {
                const avatarDiv = tr.querySelector('.partner-avatar');
                if (avatarDiv) {
                    const placeholder = avatarDiv.querySelector('.avatar-placeholder');
                    if (placeholder) placeholder.classList.add('hidden');
                    const img = document.createElement('img');
                    img.src = avatar;
                    img.alt = '';
                    img.loading = 'lazy';
                    avatarDiv.appendChild(img);
                }
            }

            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        // Phase 25 LIT-06: sync to ModuleFactory.items signal → <app-table> re-renders via effect
        PartnersRenderer._syncToModuleFactory();

        PartnersRenderer.updateStats();
        const paginationContainer = document.getElementById('partnersPagination');
        if (paginationContainer) {
            PaginationHelper.render(paginationContainer, {
                page: PartnersState.currentPage,
                pageSize: PartnersState.pageSize,
                totalCount: effectiveTotal,
                onPageChange: (newPage) => PartnersForms.goToPage(newPage)
            });
        }
    },

    // Обновить только выделение строк без полной перерисовки
    updateSelection(newId, oldId) {
        const tbody = document.getElementById('partnersTableBody');
        if (oldId) {
            const oldRow = tbody.querySelector(`tr[data-partner-id="${CSS.escape(oldId)}"]`);
            if (oldRow) oldRow.classList.remove('selected');
        }
        if (newId) {
            const newRow = tbody.querySelector(`tr[data-partner-id="${CSS.escape(newId)}"]`);
            if (newRow) newRow.classList.add('selected');
        }
    },

    updateStats() {
        const partners = PartnersState.cachedPartners;
        let openCount = 0;
        let closedCount = 0;
        const methods = new Set();

        for (let i = 0; i < partners.length; i++) {
            const p = partners[i];
            const status = p.status || 'Открыт';
            if (status === 'Открыт') openCount++;
            else if (status === 'Закрыт') closedCount++;
            if (p.method) methods.add(p.method);
        }

        document.getElementById('totalCount').textContent = PartnersState.totalCount || partners.length;
        document.getElementById('methodsCount').textContent = methods.size;
        document.getElementById('openCount').textContent = openCount;
        document.getElementById('closedCount').textContent = closedCount;
    },

    sortBy(field) {
        if (PartnersState.sortField === field) {
            PartnersState.sortDirection = PartnersState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            PartnersState.sortField = field;
            PartnersState.sortDirection = 'asc';
        }
        PartnersState.currentPage = 1;
        PartnersForms.goToPage(1);
    },

    filterTable() {
        clearTimeout(PartnersRenderer._filterTimer);
        PartnersRenderer._filterTimer = setTimeout(() => {
            const query = document.getElementById('searchInput').value.trim();
            PartnersState.serverFilter = query;
            PartnersState.searchQuery = query;
            PartnersState.currentPage = 1;
            PartnersForms.goToPage(1);
        }, 300);
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    }
};
