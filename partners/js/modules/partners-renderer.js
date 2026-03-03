// Partners Renderer - render, updateStats, sortBy, filterTable, toggleSidebar
const PartnersRenderer = {
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

            tbody.innerHTML = '';

            const columns = PartnersColumns.getColumnsConfig();
            const visibleColumns = columns.filter(c => c.visible);

            sortedData.forEach(partner => {
                const statusClass = PartnersUtils.getStatusColor(partner.status || 'Открыт');
                // Используем avatarFileId для получения URL из Google Drive
                const avatar = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
                const isValidAvatar = !!avatar;

                const tr = document.createElement('tr');
                tr.className = PartnersState.selectedPartnerId === partner.id ? 'selected' : '';
                tr.dataset.partnerId = partner.id;
                tr.addEventListener('click', () => PartnersNavigation.selectPartner(partner.id));

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
                        avatarDiv.appendChild(img);
                    }
                }

                tbody.appendChild(tr);
            });
        }

        PartnersRenderer.updateStats();
    },

    updateStats() {
        const partners = PartnersState.getPartners();
        document.getElementById('totalCount').textContent = partners.length;

        const uniqueMethods = new Set(partners.map(p => p.method).filter(Boolean));
        document.getElementById('methodsCount').textContent = uniqueMethods.size;

        // Update status counts for header badges
        const openCount = partners.filter(p => (p.status || 'Открыт') === 'Открыт').length;
        const closedCount = partners.filter(p => p.status === 'Закрыт').length;
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
        const searchValue = document.getElementById('searchInput').value.toLowerCase();
        const rows = document.querySelectorAll('.partners-table tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchValue)) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        });
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    }
};
