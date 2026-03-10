// Partners Renderer - render, updateStats, sortBy, filterTable, toggleSidebar
const PartnersRenderer = {
    _filterTimer: null,

    render() {
        const partnersData = PartnersState.getPartners();
        const tbody = document.getElementById('partnersTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.querySelector('.partners-table');

        if (partnersData.length === 0) {
            emptyState.classList.remove('hidden');
            table.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            table.classList.remove('hidden');

            let sortedData = [...partnersData];
            if (PartnersState.sortField) {
                sortedData.sort((a, b) => {
                    const valA = (a[PartnersState.sortField] || '').toString().toLowerCase();
                    const valB = (b[PartnersState.sortField] || '').toString().toLowerCase();
                    if (valA < valB) return PartnersState.sortDirection === 'asc' ? -1 : 1;
                    if (valA > valB) return PartnersState.sortDirection === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            const columns = PartnersColumns.getColumnsConfig();
            const visibleColumns = columns.filter(c => c.visible);
            const selectedId = PartnersState.selectedPartnerId;
            const fragment = document.createDocumentFragment();

            sortedData.forEach(partner => {
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
        }

        PartnersRenderer.updateStats();
    },

    // Обновить только выделение строк без полной перерисовки
    updateSelection(newId, oldId) {
        const tbody = document.getElementById('partnersTableBody');
        if (oldId) {
            const oldRow = tbody.querySelector(`tr[data-partner-id="${oldId}"]`);
            if (oldRow) oldRow.classList.remove('selected');
        }
        if (newId) {
            const newRow = tbody.querySelector(`tr[data-partner-id="${newId}"]`);
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
        PartnersRenderer.render();
    },

    filterTable() {
        clearTimeout(PartnersRenderer._filterTimer);
        PartnersRenderer._filterTimer = setTimeout(() => {
            const searchValue = document.getElementById('searchInput').value.toLowerCase();
            const rows = document.getElementById('partnersTableBody').children;

            for (let i = 0; i < rows.length; i++) {
                const text = rows[i].textContent.toLowerCase();
                rows[i].classList.toggle('hidden', !text.includes(searchValue));
            }
        }, 150);
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    }
};
