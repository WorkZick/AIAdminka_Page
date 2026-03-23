// Partners Renderer - render, updateStats, sortBy, filterTable, toggleSidebar, renderPagination
const PartnersRenderer = {
    _filterTimer: null,

    render() {
        PartnersState._invalidateFiltered();
        const allPartners = PartnersState.getPartners();
        const tbody = document.getElementById('partnersTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.querySelector('.partners-table');

        if (allPartners.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            if (table) table.classList.add('hidden');
            PartnersRenderer.updateStats();
            PartnersRenderer.renderPagination();
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        if (table) table.classList.remove('hidden');

        // Clamp page
        const totalPages = PartnersState.getTotalPages();
        if (PartnersState.currentPage > totalPages) PartnersState.currentPage = totalPages;

        const pagedData = PartnersState.getPagedPartners();
        const columns = PartnersColumns.getColumnsConfig();
        const visibleColumns = columns.filter(c => c.visible);
        const selectedId = PartnersState.selectedPartnerId;
        const fragment = document.createDocumentFragment();

        pagedData.forEach(partner => {
            const statusClass = PartnersUtils.getStatusColor(partner.status || 'Открыт');
            const avatar = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
            const isValidAvatar = !!avatar;

            const tr = document.createElement('tr');
            tr.className = selectedId === partner.id ? 'selected' : '';
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

        PartnersRenderer.updateStats();
        PartnersRenderer.renderPagination();
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
        const partners = PartnersState.getPartners();
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

        document.getElementById('totalCount').textContent = partners.length;
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
        PartnersRenderer.render();
    },

    filterTable() {
        clearTimeout(PartnersRenderer._filterTimer);
        PartnersRenderer._filterTimer = setTimeout(() => {
            PartnersState.searchQuery = document.getElementById('searchInput').value;
            PartnersState.currentPage = 1;
            PartnersRenderer.render();
        }, 150);
    },

    renderPagination() {
        const container = document.getElementById('partnersPagination');
        if (!container) return;

        const totalPages = PartnersState.getTotalPages();
        const currentPage = PartnersState.currentPage;

        container.innerHTML = '';
        if (totalPages <= 1) return;

        // Prev
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '\u2190';
        prevBtn.disabled = currentPage === 1;
        prevBtn.dataset.action = 'partners-goToPage';
        prevBtn.dataset.value = currentPage - 1;
        container.appendChild(prevBtn);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = 'page-btn' + (i === currentPage ? ' active' : '');
                pageBtn.textContent = i;
                pageBtn.dataset.action = 'partners-goToPage';
                pageBtn.dataset.value = i;
                container.appendChild(pageBtn);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                const dots = document.createElement('span');
                dots.className = 'pagination-dots';
                dots.textContent = '...';
                container.appendChild(dots);
            }
        }

        // Next
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '\u2192';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.dataset.action = 'partners-goToPage';
        nextBtn.dataset.value = currentPage + 1;
        container.appendChild(nextBtn);
    },

    goToPage(page) {
        const p = parseInt(page);
        if (isNaN(p) || p < 1) return;
        PartnersState.currentPage = p;
        PartnersRenderer.render();
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    }
};
