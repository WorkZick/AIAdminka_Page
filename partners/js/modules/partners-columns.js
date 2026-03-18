// Partners Columns - column configuration and management
const PartnersColumns = {
    defaultColumns: [
        { id: 'avatar', label: 'Фото', visible: true, sortable: false },
        { id: 'method', label: 'Метод', visible: true, sortable: true },
        { id: 'subagent', label: 'Субагент', visible: true, sortable: true },
        { id: 'subagentId', label: 'ID Субагента', visible: true, sortable: true },
        { id: 'status', label: 'Статус', visible: true, sortable: true }
    ],

    maxVisibleColumns: 5,

    getColumnsConfig() {
        let columns = [];
        const saved = localStorage.getItem('partnersColumnsConfig');

        if (saved) {
            try {
                columns = JSON.parse(saved);
            } catch (e) {
                columns = [...PartnersColumns.defaultColumns];
            }
        } else {
            columns = [...PartnersColumns.defaultColumns];
        }

        const customFieldNames = PartnersColumns.collectCustomFieldNames();

        customFieldNames.forEach(fieldName => {
            const exists = columns.some(c => c.id === `custom_${fieldName}`);
            if (!exists) {
                columns.push({
                    id: `custom_${fieldName}`,
                    label: fieldName,
                    visible: false,
                    sortable: true,
                    isCustom: true
                });
            }
        });

        columns = columns.filter(col => {
            if (col.isCustom) {
                const fieldName = col.id.replace('custom_', '');
                return customFieldNames.includes(fieldName);
            }
            return true;
        });

        return columns;
    },

    collectCustomFieldNames() {
        const partners = PartnersState.getPartners();
        const fieldNames = new Set();

        partners.forEach(partner => {
            if (partner.customFields) {
                Object.keys(partner.customFields).forEach(key => {
                    if (partner.customFields[key]) {
                        fieldNames.add(key);
                    }
                });
            }
        });

        return Array.from(fieldNames);
    },

    saveColumnsConfig(columns) {
        localStorage.setItem('partnersColumnsConfig', JSON.stringify(columns));
    },

    resetColumnsConfig() {
        localStorage.removeItem('partnersColumnsConfig');
        PartnersColumns.renderColumnsMenu();
        PartnersColumns.renderTableHeader();
        PartnersRenderer.render();
    },

    toggleColumnsMenu() {
        const menu = document.getElementById('columnsMenu');
        menu.classList.toggle('active');
    },

    closeColumnsMenu() {
        const menu = document.getElementById('columnsMenu');
        menu.classList.remove('active');
    },

    toggleColumn(columnId) {
        const columns = PartnersColumns.getColumnsConfig();
        const column = columns.find(c => c.id === columnId);
        if (!column) return;

        const visibleCount = columns.filter(c => c.visible).length;
        if (!column.visible && visibleCount >= PartnersColumns.maxVisibleColumns) {
            Toast.warning(`Максимум ${PartnersColumns.maxVisibleColumns} колонок. Отключите одну из текущих колонок.`);
            return;
        }

        column.visible = !column.visible;
        PartnersColumns.saveColumnsConfig(columns);
        PartnersColumns.renderColumnsMenu();
        PartnersColumns.renderTableHeader();
        PartnersRenderer.render();
    },

    handleColumnDragStart(event) {
        const item = event.target.closest('.column-item');
        PartnersState.draggedColumnIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
    },

    handleColumnDragOver(event) {
        event.preventDefault();
        const item = event.target.closest('.column-item');
        if (item) {
            document.querySelectorAll('.column-item').forEach(el => el.classList.remove('drag-over'));
            item.classList.add('drag-over');
        }
    },

    handleColumnDrop(event) {
        event.preventDefault();
        const targetItem = event.target.closest('.column-item');
        if (!targetItem || PartnersState.draggedColumnIndex === null) return;

        const targetIndex = parseInt(targetItem.dataset.index);
        if (PartnersState.draggedColumnIndex === targetIndex) return;

        const columns = PartnersColumns.getColumnsConfig();
        const [movedColumn] = columns.splice(PartnersState.draggedColumnIndex, 1);
        columns.splice(targetIndex, 0, movedColumn);

        PartnersColumns.saveColumnsConfig(columns);
        PartnersColumns.renderColumnsMenu();
        PartnersColumns.renderTableHeader();
        PartnersRenderer.render();
    },

    handleColumnDragEnd() {
        PartnersState.draggedColumnIndex = null;
        document.querySelectorAll('.column-item').forEach(el => {
            el.classList.remove('dragging', 'drag-over');
        });
    },

    renderColumnsMenu() {
        const columnsList = document.getElementById('columnsList');
        const columns = PartnersColumns.getColumnsConfig();
        const visibleCount = columns.filter(c => c.visible).length;
        const isMaxReached = visibleCount >= PartnersColumns.maxVisibleColumns;

        let html = '';
        columns.forEach((col, index) => {
            const activeClass = col.visible ? 'active' : '';
            const disabledClass = (!col.visible && isMaxReached) ? 'disabled' : '';
            html += `
                <div class="column-item ${activeClass} ${disabledClass}"
                     data-column-id="${col.id}"
                     data-index="${index}"
                     draggable="true"
                     data-action="partners-toggleColumn">
                    <div class="column-item-drag">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 5h2v2H9V5zm4 0h2v2h-2V5zM9 9h2v2H9V9zm4 0h2v2h-2V9zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z"/>
                        </svg>
                    </div>
                    <div class="column-item-checkbox">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                    </div>
                    <span class="column-item-label">${PartnersUtils.escapeHtml(col.label)}</span>
                </div>
            `;
        });

        html += `
            <div class="columns-menu-footer">
                <span>${visibleCount}/${PartnersColumns.maxVisibleColumns}</span>
                <button class="columns-reset-btn" data-action="partners-resetColumnsConfig">Сбросить</button>
            </div>
        `;

        columnsList.innerHTML = html;

        // Event delegation for drag&drop (set up once per container)
        if (!columnsList._dragDelegated) {
            columnsList.addEventListener('dragstart', (e) => {
                if (e.target.closest('.column-item')) PartnersColumns.handleColumnDragStart(e);
            });
            columnsList.addEventListener('dragover', (e) => {
                if (e.target.closest('.column-item')) PartnersColumns.handleColumnDragOver(e);
            });
            columnsList.addEventListener('drop', (e) => {
                if (e.target.closest('.column-item')) PartnersColumns.handleColumnDrop(e);
            });
            columnsList.addEventListener('dragend', (e) => {
                if (e.target.closest('.column-item')) PartnersColumns.handleColumnDragEnd(e);
            });
            columnsList.addEventListener('mousedown', (e) => {
                if (e.target.closest('.column-item-drag')) e.stopPropagation();
            });
            columnsList._dragDelegated = true;
        }
    },

    renderTableHeader() {
        const thead = document.getElementById('partnersTableHead');
        const columns = PartnersColumns.getColumnsConfig();
        const visibleColumns = columns.filter(c => c.visible);

        let html = '<tr>';
        html += `<th>
            <div class="counters-header">
                <span>DEP</span>
                <span>WITH</span>
                <span>COMP</span>
            </div>
        </th>`;

        visibleColumns.forEach(col => {
            if (col.sortable) {
                html += `<th data-column="${col.id}">
                    <div class="sort-header" data-action="partners-sortBy" data-column-id="${col.id}">
                        ${PartnersUtils.escapeHtml(col.label)}
                        <img src="../shared/icons/filter.svg" width="16" height="16" alt="Сортировка">
                    </div>
                </th>`;
            } else {
                html += `<th data-column="${col.id}">${PartnersUtils.escapeHtml(col.label)}</th>`;
            }
        });

        html += '<th></th>';
        html += '</tr>';

        thead.innerHTML = html;
    },

    renderColumnCell(columnId, partner, statusClass) {
        if (columnId.startsWith('custom_')) {
            const fieldName = columnId.replace('custom_', '');
            const value = partner.customFields?.[fieldName] || '';
            return `<td data-column="${columnId}">${PartnersUtils.escapeHtml(value)}</td>`;
        }

        switch (columnId) {
            case 'avatar':
                return `<td data-column="avatar"><div class="partner-avatar"><img class="avatar-placeholder" src="../shared/icons/partners.svg" alt=""></div></td>`;
            case 'method':
                return `<td data-column="method">${PartnersUtils.escapeHtml(partner.method || '')}</td>`;
            case 'subagent':
                return `<td data-column="subagent">${PartnersUtils.escapeHtml(partner.subagent || '')}</td>`;
            case 'subagentId':
                return `<td data-column="subagentId">${PartnersUtils.escapeHtml(partner.subagentId || '')}</td>`;
            case 'status':
                return `<td data-column="status"><span class="status-badge ${PartnersUtils.escapeHtml(statusClass)}">${PartnersUtils.escapeHtml(partner.status || 'Открыт')}</span></td>`;
            default:
                return '<td></td>';
        }
    },

    cleanupUnusedColumns() {
        const saved = localStorage.getItem('partnersColumnsConfig');

        if (saved) {
            try {
                let columns = JSON.parse(saved);
                const customFieldNames = PartnersColumns.collectCustomFieldNames();

                const cleanedColumns = columns.filter(col => {
                    if (col.isCustom) {
                        const fieldName = col.id.replace('custom_', '');
                        return customFieldNames.includes(fieldName);
                    }
                    return true;
                });

                if (cleanedColumns.length !== columns.length) {
                    PartnersColumns.saveColumnsConfig(cleanedColumns);
                }
            } catch (e) {
                console.warn('Ошибка миграции конфигурации колонок:', e);
            }
        }

        // Всегда обновляем UI колонок
        PartnersColumns.renderColumnsMenu();
        PartnersColumns.renderTableHeader();
    }
};
