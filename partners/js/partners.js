// Partners App - Cloud Sync Version
const partnersApp = {
    selectedPartnerId: null,
    editingPartnerId: null,
    sortField: null,
    sortDirection: 'asc',
    pendingImportData: null,
    pendingExtraColumns: null,
    importType: 'json',
    selectedImportTemplateId: null,

    // Cached data
    cachedPartners: [],
    cachedMethods: [],
    cachedTemplates: {},

    // Loading state
    isLoading: false,

    // Template system
    isTemplateMode: false,
    editingTemplateId: null,
    currentTemplateId: null,
    templateFields: [],

    // ==================== INITIALIZATION ====================

    async init() {
        // Check authentication
        if (!AuthGuard.check()) {
            return; // Will redirect to login
        }

        // Initialize CloudStorage
        await CloudStorage.init();

        // Show loading
        this.showLoading(true);

        try {
            // Load data from cloud
            await this.loadAllData();

            // Render UI
            this.renderTableHeader();
            this.render();
            this.updateStats();
            this.setupImportHandler();
            this.setupCropHandlers();
            this.renderColumnsMenu();

        } catch (error) {
            console.error('Init error:', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
        } finally {
            this.showLoading(false);
        }

        // Слушаем завершение синхронизации для обновления данных
        window.addEventListener('sync-complete', () => {
            console.log('🔄 Синхронизация завершена, обновляем данные...');
            this.loadDataFromCloud();
        });
    },

    async loadAllData() {
        // Load all data in parallel
        const [partners, methods, templates] = await Promise.all([
            CloudStorage.getPartners(),
            CloudStorage.getMethods(),
            CloudStorage.getTemplates()
        ]);

        this.cachedPartners = partners;
        this.cachedMethods = methods;

        // Cache partners to localStorage for other modules (traffic-calculation)
        this.syncPartnersToLocalStorage();

        // Convert templates array to object
        this.cachedTemplates = {};
        templates.forEach(t => {
            this.cachedTemplates[t.id] = t;
        });
    },

    // Sync partners to localStorage for other modules
    // ВАЖНО: сохраняем ТОЛЬКО несинхронизированных партнёров
    // Облачные данные всегда доступны из облака, не нужно их дублировать
    syncPartnersToLocalStorage() {
        try {
            // Фильтруем только несинхронизированных
            const unsyncedPartners = this.cachedPartners.filter(p => p._synced === false);
            localStorage.setItem('partners-data', JSON.stringify(unsyncedPartners));
        } catch (e) {
            console.error('Failed to sync partners to localStorage:', e);
        }
    },

    // Перезагрузить данные с сервера (после фоновой синхронизации)
    async loadDataFromCloud() {
        try {
            // Очищаем кэш и загружаем свежие данные
            CloudStorage.clearCache();
            await this.loadAllData();
            this.renderColumnsMenu();
            this.renderTableHeader();
            this.render();
            console.log('✅ Данные обновлены с сервера');
        } catch (e) {
            console.error('Ошибка обновления данных с сервера:', e);
        }
    },

    // ==================== LOADING UI ====================

    showLoading(show) {
        this.isLoading = show;
        const loadingState = document.getElementById('loadingState');
        const table = document.querySelector('.partners-table');
        const emptyState = document.getElementById('emptyState');

        if (show) {
            if (loadingState) loadingState.style.display = 'flex';
            if (table) table.style.display = 'none';
            if (emptyState) emptyState.style.display = 'none';
        } else {
            if (loadingState) loadingState.style.display = 'none';
            // Table visibility will be set by render()
        }
    },

    showError(message) {
        alert(message);
    },

    // ==================== METHODS MANAGEMENT ====================

    getMethods() {
        return this.cachedMethods;
    },

    async loadMethods() {
        this.cachedMethods = await CloudStorage.getMethods();
        return this.cachedMethods;
    },

    showMethodsDialog() {
        document.getElementById('methodsModal').classList.add('active');
        document.getElementById('newMethodInput').value = '';
        this.renderMethodsList();
    },

    closeMethodsDialog() {
        document.getElementById('methodsModal').classList.remove('active');
        this.populateMethodsSelect();
    },

    async addMethod() {
        const input = document.getElementById('newMethodInput');
        const name = input.value.trim();

        if (!name) {
            alert('Введите название метода');
            return;
        }

        const methods = this.getMethods();
        if (methods.some(m => m.name.toLowerCase() === name.toLowerCase())) {
            alert('Метод с таким названием уже существует');
            return;
        }

        try {
            const result = await CloudStorage.addMethod({ name: name });
            this.cachedMethods.push({ id: result.id, name: name });
            input.value = '';
            this.renderMethodsList();
        } catch (error) {
            this.showError('Ошибка добавления метода: ' + error.message);
        }
    },

    async deleteMethod(methodId) {
        if (!confirm('Удалить этот метод?')) return;

        try {
            await CloudStorage.deleteMethod(methodId);
            this.cachedMethods = this.cachedMethods.filter(m => m.id !== methodId);
            this.renderMethodsList();
        } catch (error) {
            this.showError('Ошибка удаления метода: ' + error.message);
        }
    },

    startEditMethod(methodId) {
        const methods = this.getMethods();
        const method = methods.find(m => m.id === methodId);
        if (!method) return;

        const item = document.querySelector(`[data-method-id="${methodId}"]`);
        if (!item) return;

        item.innerHTML = `
            <input type="text" class="method-item-input" id="editMethodInput_${methodId}" value="${this.escapeHtml(method.name)}">
            <button class="method-item-btn" onclick="partnersApp.saveEditMethod('${methodId}')" title="Сохранить">
                <img src="icons/done.svg" width="16" height="16" alt="Сохранить">
            </button>
            <button class="method-item-btn" onclick="partnersApp.renderMethodsList()" title="Отмена">
                <img src="icons/cross.svg" width="16" height="16" alt="Отмена">
            </button>
        `;

        document.getElementById(`editMethodInput_${methodId}`).focus();
    },

    async saveEditMethod(methodId) {
        const input = document.getElementById(`editMethodInput_${methodId}`);
        const newName = input.value.trim();

        if (!newName) {
            alert('Название не может быть пустым');
            return;
        }

        const methods = this.getMethods();
        const methodIndex = methods.findIndex(m => m.id === methodId);
        if (methodIndex === -1) return;

        if (methods.some((m, i) => i !== methodIndex && m.name.toLowerCase() === newName.toLowerCase())) {
            alert('Метод с таким названием уже существует');
            return;
        }

        try {
            const oldName = methods[methodIndex].name;
            await CloudStorage.updateMethod(methodId, { id: methodId, name: newName });
            this.cachedMethods[methodIndex].name = newName;

            // Update partners with this method
            const partners = this.getPartners();
            for (const partner of partners) {
                if (partner.method === oldName) {
                    partner.method = newName;
                    await CloudStorage.updatePartner(partner.id, partner);
                }
            }

            // Refresh partners cache
            this.cachedPartners = await CloudStorage.getPartners(false);
            this.syncPartnersToLocalStorage();
            this.renderMethodsList();
            this.render();
        } catch (error) {
            this.showError('Ошибка сохранения метода: ' + error.message);
        }
    },

    renderMethodsList() {
        const container = document.getElementById('methodsList');
        const methods = this.getMethods();

        if (methods.length === 0) {
            container.innerHTML = '<div class="methods-empty">Нет добавленных методов</div>';
            return;
        }

        container.innerHTML = methods.map(method => `
            <div class="method-item" data-method-id="${method.id}">
                <span class="method-item-name">${this.escapeHtml(method.name)}</span>
                <button class="method-item-btn" onclick="partnersApp.startEditMethod('${method.id}')" title="Редактировать">
                    <img src="icons/pen.svg" width="16" height="16" alt="Редактировать">
                </button>
                <button class="method-item-btn delete" onclick="partnersApp.deleteMethod('${method.id}')" title="Удалить">
                    <img src="icons/cross.svg" width="16" height="16" alt="Удалить">
                </button>
            </div>
        `).join('');
    },

    populateMethodsSelect(selectedValue = '') {
        const select = document.getElementById('formMethod');
        if (!select) return;

        const methods = this.getMethods();
        select.innerHTML = '<option value="">Выберите метод</option>';

        methods.forEach(method => {
            const option = document.createElement('option');
            option.value = method.name;
            option.textContent = method.name;
            if (method.name === selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    },

    // Avatar/crop system
    cropData: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        startX: 0,
        startY: 0,
        originalSrc: null
    },

    formStatus: 'Открыт',

    // Columns configuration
    defaultColumns: [
        { id: 'avatar', label: 'Фото', visible: true, sortable: false },
        { id: 'method', label: 'Метод', visible: true, sortable: true },
        { id: 'subagent', label: 'Субагент', visible: true, sortable: true },
        { id: 'subagentId', label: 'ID Субагента', visible: true, sortable: true },
        { id: 'status', label: 'Статус', visible: true, sortable: true }
    ],

    getColumnsConfig() {
        let columns = [];
        const saved = localStorage.getItem('partnersColumnsConfig');

        if (saved) {
            try {
                columns = JSON.parse(saved);
            } catch (e) {
                columns = [...this.defaultColumns];
            }
        } else {
            columns = [...this.defaultColumns];
        }

        const customFieldNames = this.collectCustomFieldNames();

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
        const partners = this.getPartners();
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

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    isValidImageUrl(url) {
        if (!url) return false;
        return url.startsWith('data:image/') ||
               url.startsWith('http://') ||
               url.startsWith('https://');
    },

    renderTableHeader() {
        const thead = document.getElementById('partnersTableHead');
        const columns = this.getColumnsConfig();
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
                    <div class="sort-header" onclick="partnersApp.sortBy('${col.id}')">
                        ${this.escapeHtml(col.label)}
                        <img src="icons/filter.svg" width="16" height="16" alt="Сортировка">
                    </div>
                </th>`;
            } else {
                html += `<th data-column="${col.id}">${this.escapeHtml(col.label)}</th>`;
            }
        });

        html += '<th></th>';
        html += '</tr>';

        thead.innerHTML = html;
    },

    renderColumnsMenu() {
        const columnsList = document.getElementById('columnsList');
        const columns = this.getColumnsConfig();
        const visibleCount = columns.filter(c => c.visible).length;
        const isMaxReached = visibleCount >= this.maxVisibleColumns;

        let html = '';
        columns.forEach((col, index) => {
            const activeClass = col.visible ? 'active' : '';
            const disabledClass = (!col.visible && isMaxReached) ? 'disabled' : '';
            html += `
                <div class="column-item ${activeClass} ${disabledClass}"
                     data-column-id="${col.id}"
                     data-index="${index}"
                     draggable="true"
                     onclick="partnersApp.toggleColumn('${col.id}')"
                     ondragstart="partnersApp.handleColumnDragStart(event)"
                     ondragover="partnersApp.handleColumnDragOver(event)"
                     ondrop="partnersApp.handleColumnDrop(event)"
                     ondragend="partnersApp.handleColumnDragEnd(event)">
                    <div class="column-item-drag" onmousedown="event.stopPropagation()">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 5h2v2H9V5zm4 0h2v2h-2V5zM9 9h2v2H9V9zm4 0h2v2h-2V9zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z"/>
                        </svg>
                    </div>
                    <div class="column-item-checkbox">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                    </div>
                    <span class="column-item-label">${this.escapeHtml(col.label)}</span>
                </div>
            `;
        });

        html += `
            <div class="columns-menu-footer">
                <span>${visibleCount}/${this.maxVisibleColumns}</span>
                <button class="columns-reset-btn" onclick="event.stopPropagation(); partnersApp.resetColumnsConfig()">Сбросить</button>
            </div>
        `;

        columnsList.innerHTML = html;
    },

    resetColumnsConfig() {
        localStorage.removeItem('partnersColumnsConfig');
        this.renderColumnsMenu();
        this.renderTableHeader();
        this.render();
    },

    toggleColumnsMenu(event) {
        event.stopPropagation();
        const menu = document.getElementById('columnsMenu');
        menu.classList.toggle('active');
    },

    closeColumnsMenu() {
        const menu = document.getElementById('columnsMenu');
        menu.classList.remove('active');
    },

    maxVisibleColumns: 5,

    toggleColumn(columnId) {
        const columns = this.getColumnsConfig();
        const column = columns.find(c => c.id === columnId);
        if (!column) return;

        const visibleCount = columns.filter(c => c.visible).length;
        if (!column.visible && visibleCount >= this.maxVisibleColumns) {
            alert(`Максимум ${this.maxVisibleColumns} колонок. Отключите одну из текущих колонок.`);
            return;
        }

        column.visible = !column.visible;
        this.saveColumnsConfig(columns);
        this.renderColumnsMenu();
        this.renderTableHeader();
        this.render();
    },

    draggedColumnIndex: null,

    handleColumnDragStart(event) {
        const item = event.target.closest('.column-item');
        this.draggedColumnIndex = parseInt(item.dataset.index);
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
        if (!targetItem || this.draggedColumnIndex === null) return;

        const targetIndex = parseInt(targetItem.dataset.index);
        if (this.draggedColumnIndex === targetIndex) return;

        const columns = this.getColumnsConfig();
        const [movedColumn] = columns.splice(this.draggedColumnIndex, 1);
        columns.splice(targetIndex, 0, movedColumn);

        this.saveColumnsConfig(columns);
        this.renderColumnsMenu();
        this.renderTableHeader();
        this.render();
    },

    handleColumnDragEnd() {
        this.draggedColumnIndex = null;
        document.querySelectorAll('.column-item').forEach(el => {
            el.classList.remove('dragging', 'drag-over');
        });
    },

    renderColumnCell(columnId, partner, statusClass) {
        if (columnId.startsWith('custom_')) {
            const fieldName = columnId.replace('custom_', '');
            const value = partner.customFields?.[fieldName] || '';
            return `<td data-column="${columnId}">${this.escapeHtml(value)}</td>`;
        }

        switch (columnId) {
            case 'avatar':
                return `<td data-column="avatar"><div class="partner-avatar"></div></td>`;
            case 'method':
                return `<td data-column="method">${this.escapeHtml(partner.method || '')}</td>`;
            case 'subagent':
                return `<td data-column="subagent">${this.escapeHtml(partner.subagent || '')}</td>`;
            case 'subagentId':
                return `<td data-column="subagentId">${this.escapeHtml(partner.subagentId || '')}</td>`;
            case 'status':
                return `<td data-column="status"><span class="status-badge ${this.escapeHtml(statusClass)}">${this.escapeHtml(partner.status || 'Открыт')}</span></td>`;
            default:
                return '<td></td>';
        }
    },

    render() {
        const partnersData = this.getPartners();
        const tbody = document.getElementById('partnersTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.querySelector('.partners-table');

        if (partnersData.length === 0) {
            emptyState.style.display = 'block';
            table.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            table.style.display = 'table';

            let sortedData = [...partnersData];
            if (this.sortField) {
                sortedData.sort((a, b) => {
                    const valA = (a[this.sortField] || '').toString().toLowerCase();
                    const valB = (b[this.sortField] || '').toString().toLowerCase();
                    if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
                    if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            tbody.innerHTML = '';

            const columns = this.getColumnsConfig();
            const visibleColumns = columns.filter(c => c.visible);

            sortedData.forEach(partner => {
                const statusClass = this.getStatusColor(partner.status || 'Открыт');
                // Используем avatarFileId для получения URL из Google Drive
                const avatar = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
                const isValidAvatar = !!avatar;

                const tr = document.createElement('tr');
                tr.className = this.selectedPartnerId === partner.id ? 'selected' : '';
                tr.dataset.partnerId = partner.id;
                tr.addEventListener('click', () => this.selectPartner(partner.id));

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
                    rowHtml += this.renderColumnCell(col.id, partner, statusClass, isValidAvatar);
                });

                rowHtml += `
                    <td>
                        <img class="row-arrow" src="icons/arrow.svg" width="20" height="20" alt="Открыть" style="transform: rotate(${this.selectedPartnerId === partner.id ? '180deg' : '0deg'}); transition: transform 0.2s ease;">
                    </td>
                `;

                tr.innerHTML = rowHtml;

                if (isValidAvatar) {
                    const avatarDiv = tr.querySelector('.partner-avatar');
                    if (avatarDiv) {
                        const img = document.createElement('img');
                        img.src = avatar;
                        img.alt = '';
                        avatarDiv.appendChild(img);
                    }
                }

                tbody.appendChild(tr);
            });
        }

        this.updateStats();
    },

    getPartners() {
        return this.cachedPartners;
    },

    updateStats() {
        const partners = this.getPartners();
        document.getElementById('totalCount').textContent = partners.length;

        const uniqueMethods = new Set(partners.map(p => p.method).filter(Boolean));
        document.getElementById('methodsCount').textContent = uniqueMethods.size;
    },

    sortBy(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
        this.render();
    },

    filterTable() {
        const searchValue = document.getElementById('searchInput').value.toLowerCase();
        const rows = document.querySelectorAll('.partners-table tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchValue) ? '' : 'none';
        });
    },

    selectPartner(id) {
        if (this.selectedPartnerId === id) {
            this.deselectPartner();
            return;
        }

        this.selectedPartnerId = id;
        this.render();
        this.showPartnerCard(id);
    },

    deselectPartner() {
        this.selectedPartnerId = null;
        this.render();
        this.showStatsPanel();
    },

    showStatsPanel() {
        document.getElementById('statsPanel').style.display = 'flex';
        document.getElementById('partnerCard').style.display = 'none';
        document.getElementById('partnerForm').style.display = 'none';
    },

    showPartnerCard(id) {
        const partners = this.getPartners();
        const partner = partners.find(p => p.id === id);
        if (!partner) return;

        document.getElementById('statsPanel').style.display = 'none';
        document.getElementById('partnerCard').style.display = 'flex';
        document.getElementById('partnerForm').style.display = 'none';

        const cardAvatar = document.getElementById('cardAvatar');
        // Используем avatarFileId для получения URL из Google Drive
        const avatarUrl = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
        if (avatarUrl) {
            cardAvatar.src = avatarUrl;
            cardAvatar.style.display = 'block';
        } else {
            cardAvatar.src = '';
            cardAvatar.style.display = 'none';
        }

        document.getElementById('cardFullName').textContent = partner.subagent || '-';
        document.getElementById('cardPosition').textContent = partner.subagentId || '-';

        const status = partner.status || 'Открыт';
        const statusText = document.getElementById('cardStatusText');
        statusText.textContent = status;
        statusText.className = 'status-badge ' + this.getStatusColor(status);

        const cardBody = document.getElementById('cardBody');
        cardBody.innerHTML = this.generateCardInfo(partner);
    },

    getStatusColor(status) {
        const colors = {
            'Открыт': 'green',
            'Закрыт': 'red'
        };
        return colors[status] || 'green';
    },

    generateCardInfo(partner) {
        let html = '';

        html += `
            <div class="counters-info">
                <div class="counter-item">
                    <span class="counter-label">DEP</span>
                    <span class="counter-value">${partner.dep || 0}</span>
                </div>
                <div class="counter-item">
                    <span class="counter-label">WITH</span>
                    <span class="counter-value">${partner.with || 0}</span>
                </div>
                <div class="counter-item">
                    <span class="counter-label">COMP</span>
                    <span class="counter-value">${partner.comp || 0}</span>
                </div>
            </div>
        `;

        html += `
            <div class="info-group">
                <span class="info-label">Метод:</span>
                <span class="info-value">${this.escapeHtml(partner.method || '-')}</span>
            </div>
        `;

        if (partner.customFields) {
            Object.entries(partner.customFields).forEach(([label, value]) => {
                if (value) {
                    html += `
                        <div class="info-group">
                            <span class="info-label">${this.escapeHtml(label)}:</span>
                            <span class="info-value">${this.escapeHtml(value)}</span>
                        </div>
                    `;
                }
            });
        }

        return html;
    },

    toggleStatusDropdown() {
        const dropdown = document.getElementById('cardStatusDropdown');
        const arrow = document.querySelector('#cardStatusBadge .status-dropdown-icon');
        const isOpen = dropdown.style.display === 'none';
        dropdown.style.display = isOpen ? 'flex' : 'none';
        if (arrow) {
            arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
    },

    async changeStatus(status) {
        if (!this.selectedPartnerId) return;

        const partners = this.getPartners();
        const partner = partners.find(p => p.id === this.selectedPartnerId);
        if (!partner) return;

        try {
            partner.status = status;
            await CloudStorage.updatePartner(this.selectedPartnerId, partner);

            // Update cache
            const index = this.cachedPartners.findIndex(p => p.id === this.selectedPartnerId);
            if (index !== -1) {
                this.cachedPartners[index].status = status;
            }

            const statusText = document.getElementById('cardStatusText');
            statusText.textContent = status;
            statusText.className = 'status-badge ' + this.getStatusColor(status);

            document.getElementById('cardStatusDropdown').style.display = 'none';
            const arrow = document.querySelector('#cardStatusBadge .status-dropdown-icon');
            if (arrow) arrow.style.transform = 'rotate(-90deg)';

            this.render();
        } catch (error) {
            this.showError('Ошибка обновления статуса: ' + error.message);
        }
    },

    toggleFormStatusDropdown() {
        const dropdown = document.getElementById('formStatusDropdown');
        const arrow = document.querySelector('#formStatusBadge .status-dropdown-icon');
        const isOpen = dropdown.style.display === 'none';
        dropdown.style.display = isOpen ? 'flex' : 'none';
        if (arrow) {
            arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
    },

    changeFormStatus(status) {
        this.formStatus = status;
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = status;
        statusText.className = 'status-badge ' + this.getStatusColor(status);

        document.getElementById('formStatusDropdown').style.display = 'none';
        const arrow = document.querySelector('#formStatusBadge .status-dropdown-icon');
        if (arrow) arrow.style.transform = 'rotate(-90deg)';
    },

    showAddModal() {
        this.editingPartnerId = null;
        this.selectedPartnerId = null;
        this.isTemplateMode = false;
        this.formStatus = 'Открыт';
        this.render();

        document.getElementById('statsPanel').style.display = 'none';
        document.getElementById('partnerCard').style.display = 'none';
        document.getElementById('partnerForm').style.display = 'flex';

        document.getElementById('formTitle').textContent = 'Добавить партнера';
        document.getElementById('formSaveBtnText').textContent = 'Добавить партнера';
        document.getElementById('formDeleteBtn').style.display = 'none';

        document.getElementById('formTemplateSelector').style.display = 'flex';
        document.getElementById('templateFieldsContainer').style.display = 'none';
        document.getElementById('formBody').style.display = 'block';
        document.getElementById('formCounters').style.display = 'flex';
        document.getElementById('formCounters').classList.remove('disabled');
        document.querySelector('.form-partner-info').style.display = 'flex';

        const subagentInput = document.getElementById('formSubagent');
        const subagentIdInput = document.getElementById('formSubagentId');
        const methodInput = document.getElementById('formMethod');
        const methodWrapper = document.querySelector('.form-method-wrapper');
        const formAvatar = document.querySelector('.form-avatar');

        subagentInput.classList.remove('disabled');
        subagentIdInput.classList.remove('disabled');
        methodInput.classList.remove('disabled');
        subagentInput.readOnly = false;
        subagentIdInput.readOnly = false;
        methodInput.disabled = false;

        if (methodWrapper) {
            methodWrapper.classList.remove('disabled');
            methodWrapper.style.pointerEvents = '';
        }
        if (formAvatar) {
            formAvatar.classList.remove('disabled');
            formAvatar.style.pointerEvents = '';
        }

        this.removeDynamicFields();

        document.getElementById('formSubagent').value = '';
        document.getElementById('formSubagentId').value = '';

        this.populateMethodsSelect('');

        document.getElementById('formDep').value = '';
        document.getElementById('formWith').value = '';
        document.getElementById('formComp').value = '';

        const formAvatarImg = document.getElementById('formAvatar');
        formAvatarImg.src = '';
        formAvatarImg.style.display = 'none';
        document.querySelector('.form-avatar-placeholder').style.display = 'block';

        const statusText = document.getElementById('formStatusText');
        statusText.textContent = 'Открыт';
        statusText.className = 'status-badge green';

        this.updateTemplateList();
    },

    editFromCard() {
        if (!this.selectedPartnerId) return;

        const partners = this.getPartners();
        const partner = partners.find(p => p.id === this.selectedPartnerId);
        if (!partner) return;

        this.editingPartnerId = this.selectedPartnerId;
        this.isTemplateMode = false;
        this.formStatus = partner.status || 'Открыт';

        document.getElementById('statsPanel').style.display = 'none';
        document.getElementById('partnerCard').style.display = 'none';
        document.getElementById('partnerForm').style.display = 'flex';

        document.getElementById('formTitle').textContent = 'Редактировать партнера';
        document.getElementById('formSaveBtnText').textContent = 'Сохранить изменения';

        document.getElementById('formTemplateSelector').style.display = 'none';
        document.getElementById('templateFieldsContainer').style.display = 'none';
        document.getElementById('formBody').style.display = 'block';
        document.getElementById('formCounters').style.display = 'flex';
        document.getElementById('formCounters').classList.remove('disabled');
        document.querySelector('.form-partner-info').style.display = 'flex';

        const subagentInput = document.getElementById('formSubagent');
        const subagentIdInput = document.getElementById('formSubagentId');
        const methodInput = document.getElementById('formMethod');
        const methodWrapper = document.querySelector('.form-method-wrapper');
        const formAvatarWrapper = document.querySelector('.form-avatar');

        subagentInput.classList.remove('disabled');
        subagentIdInput.classList.remove('disabled');
        methodInput.classList.remove('disabled');
        subagentInput.readOnly = false;
        subagentIdInput.readOnly = false;
        methodInput.disabled = false;

        if (methodWrapper) {
            methodWrapper.classList.remove('disabled');
            methodWrapper.style.pointerEvents = '';
        }
        if (formAvatarWrapper) {
            formAvatarWrapper.classList.remove('disabled');
            formAvatarWrapper.style.pointerEvents = '';
        }

        this.removeDynamicFields();

        subagentInput.value = partner.subagent || '';
        subagentIdInput.value = partner.subagentId || '';

        this.populateMethodsSelect(partner.method || '');

        document.getElementById('formDep').value = partner.dep || '';
        document.getElementById('formWith').value = partner.with || '';
        document.getElementById('formComp').value = partner.comp || '';

        const formAvatar = document.getElementById('formAvatar');
        const placeholder = document.querySelector('.form-avatar-placeholder');
        // Используем avatarFileId для получения URL из Google Drive
        const avatarUrl = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
        if (avatarUrl) {
            formAvatar.src = avatarUrl;
            formAvatar.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            formAvatar.src = '';
            formAvatar.style.display = 'none';
            placeholder.style.display = 'block';
        }

        const statusText = document.getElementById('formStatusText');
        statusText.textContent = this.formStatus;
        statusText.className = 'status-badge ' + this.getStatusColor(this.formStatus);

        if (partner.customFields) {
            Object.entries(partner.customFields).forEach(([label, value]) => {
                const fieldId = 'customField_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const fieldHtml = `
                    <div class="form-group-inline" data-custom-field="true">
                        <label>${this.escapeHtml(label)}:</label>
                        <input type="text" id="${fieldId}" value="${this.escapeHtml(value)}" data-field-label="${this.escapeHtml(label)}">
                    </div>
                `;
                document.getElementById('formBody').insertAdjacentHTML('beforeend', fieldHtml);
            });
        }
    },

    closeForm() {
        this.editingPartnerId = null;
        this.isTemplateMode = false;
        this.editingTemplateId = null;

        document.getElementById('templateFieldsContainer').style.display = 'none';

        document.getElementById('formBody').style.display = 'block';
        const formCounters = document.getElementById('formCounters');
        formCounters.style.display = 'flex';
        formCounters.classList.remove('disabled');

        document.querySelector('.form-partner-info').style.display = 'flex';

        this.removeDynamicFields();

        const formAvatar = document.querySelector('.form-avatar');
        const subagentInput = document.getElementById('formSubagent');
        const subagentIdInput = document.getElementById('formSubagentId');
        const methodInput = document.getElementById('formMethod');
        const formStatusBadge = document.getElementById('formStatusBadge');

        if (formAvatar) {
            formAvatar.style.display = 'flex';
            formAvatar.classList.remove('disabled');
            formAvatar.style.pointerEvents = 'auto';
        }
        if (subagentInput) {
            subagentInput.classList.remove('disabled');
            subagentInput.readOnly = false;
        }
        if (subagentIdInput) {
            subagentIdInput.classList.remove('disabled');
            subagentIdInput.readOnly = false;
        }
        if (methodInput) {
            methodInput.classList.remove('disabled');
            methodInput.readOnly = false;
        }
        if (formStatusBadge) {
            formStatusBadge.style.display = 'flex';
            formStatusBadge.classList.remove('disabled');
        }

        if (this.selectedPartnerId) {
            this.showPartnerCard(this.selectedPartnerId);
        } else {
            this.showStatsPanel();
        }
    },

    removeDynamicFields() {
        const formBody = document.getElementById('formBody');
        formBody.innerHTML = '';
    },

    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.cropData.originalSrc = e.target.result;
            this.showCropModal(e.target.result);
        };
        reader.readAsDataURL(file);
    },

    showCropModal(imageSrc) {
        const modal = document.getElementById('cropModal');
        const cropImage = document.getElementById('cropImage');

        cropImage.src = imageSrc;
        this.cropData.scale = 1;
        this.cropData.offsetX = 0;
        this.cropData.offsetY = 0;

        modal.classList.add('active');

        cropImage.onload = () => {
            this.updateCropTransform();
        };
    },

    closeCropModal() {
        document.getElementById('cropModal').classList.remove('active');
        document.getElementById('formAvatarInput').value = '';
    },

    setupCropHandlers() {
        const cropPreview = document.getElementById('cropPreview');
        if (!cropPreview) return;

        cropPreview.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.cropData.scale = Math.max(0.5, Math.min(3, this.cropData.scale + delta));
            this.updateCropTransform();
        });

        cropPreview.addEventListener('mousedown', (e) => {
            this.cropData.isDragging = true;
            this.cropData.startX = e.clientX - this.cropData.offsetX;
            this.cropData.startY = e.clientY - this.cropData.offsetY;
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.cropData.isDragging) return;
            this.cropData.offsetX = e.clientX - this.cropData.startX;
            this.cropData.offsetY = e.clientY - this.cropData.startY;
            this.updateCropTransform();
        });

        document.addEventListener('mouseup', () => {
            this.cropData.isDragging = false;
        });
    },

    updateCropTransform() {
        const cropImage = document.getElementById('cropImage');
        const cropPreview = document.getElementById('cropPreview');
        if (!cropImage || !cropImage.complete) return;

        const scale = this.cropData.scale;
        const translateX = this.cropData.offsetX;
        const translateY = this.cropData.offsetY;

        // Calculate initial size to cover container (like background-size: cover)
        const previewWidth = cropPreview.clientWidth;
        const previewHeight = cropPreview.clientHeight;
        const imgWidth = cropImage.naturalWidth;
        const imgHeight = cropImage.naturalHeight;

        const scaleToFit = Math.max(
            previewWidth / imgWidth,
            previewHeight / imgHeight
        );

        // Set base size to cover the container
        cropImage.style.width = imgWidth * scaleToFit + 'px';
        cropImage.style.height = imgHeight * scaleToFit + 'px';
        cropImage.style.left = '50%';
        cropImage.style.top = '50%';

        // Apply transform: center image + user offset + user scale
        cropImage.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`;
    },

    applyCrop() {
        // Сохраняем оригинальное изображение без обрезки
        // Обрезка только визуальная (CSS object-fit: cover)
        const originalData = this.cropData.originalSrc;

        const formAvatar = document.getElementById('formAvatar');
        const placeholder = document.querySelector('.form-avatar-placeholder');
        formAvatar.src = originalData;
        formAvatar.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';

        this.closeCropModal();
    },

    async saveFromForm() {
        if (this.isTemplateMode) {
            this.saveTemplate();
            return;
        }

        const subagent = document.getElementById('formSubagent').value.trim();
        const subagentId = document.getElementById('formSubagentId').value.trim();
        const method = document.getElementById('formMethod').value.trim();
        const avatar = document.getElementById('formAvatar').src || '';

        const dep = parseInt(document.getElementById('formDep').value) || 0;
        const withVal = parseInt(document.getElementById('formWith').value) || 0;
        const comp = parseInt(document.getElementById('formComp').value) || 0;

        if (!subagent || !subagentId || !method) {
            alert('Пожалуйста, заполните все обязательные поля (Субагент, ID Субагента, Метод)');
            return;
        }

        const customFields = {};
        const templateFieldInputs = document.querySelectorAll('#formBody .form-group-inline');
        templateFieldInputs.forEach(group => {
            const input = group.querySelector('input, textarea');
            const label = group.querySelector('label');
            if (input && label) {
                const value = input.value.trim();
                const labelText = label.textContent.replace(':', '').trim();
                if (labelText && value) {
                    customFields[labelText] = value;
                }
            }
        });

        // Проверяем, есть ли новый avatar (base64)
        const isNewAvatar = avatar && avatar.startsWith('data:image/');

        // Получаем текущий avatarFileId если редактируем
        let currentAvatarFileId = '';
        if (this.editingPartnerId) {
            const existingPartner = this.cachedPartners.find(p => p.id === this.editingPartnerId);
            currentAvatarFileId = existingPartner?.avatarFileId || '';
        }

        const partnerData = {
            subagent,
            subagentId,
            method,
            deposits: dep,
            withdrawals: withVal,
            compensation: comp,
            status: this.formStatus,
            avatarFileId: currentAvatarFileId, // Будет обновлён если загружен новый аватар
            customFields
        };

        this.showLoading(true);

        try {
            // Если есть новый avatar, загружаем в Google Drive
            if (isNewAvatar) {
                // Удаляем старый аватар, чтобы не было дубликатов
                if (currentAvatarFileId) {
                    try {
                        await CloudStorage.deleteImage(currentAvatarFileId);
                    } catch (e) {
                        console.error('Failed to delete old avatar:', e);
                    }
                }

                // Загружаем новый аватар
                const fileName = `partner_avatar_${this.editingPartnerId || 'new'}_${Date.now()}.jpg`;
                const uploadResult = await CloudStorage.uploadImage('partners', fileName, avatar);
                if (uploadResult && uploadResult.fileId) {
                    partnerData.avatarFileId = uploadResult.fileId;
                }
            }

            // Добавляем локальные поля для UI (dep/with/comp)
            partnerData.dep = partnerData.deposits || 0;
            partnerData.with = partnerData.withdrawals || 0;
            partnerData.comp = partnerData.compensation || 0;

            if (this.editingPartnerId) {
                partnerData.id = this.editingPartnerId;
                await CloudStorage.updatePartner(this.editingPartnerId, partnerData);

                const index = this.cachedPartners.findIndex(p => p.id === this.editingPartnerId);
                if (index !== -1) {
                    this.cachedPartners[index] = { ...this.cachedPartners[index], ...partnerData };
                }

                this.selectedPartnerId = this.editingPartnerId;
                this.editingPartnerId = null;
                this.syncPartnersToLocalStorage();
                this.renderColumnsMenu();
                this.render();
                this.showPartnerCard(this.selectedPartnerId);
            } else {
                const result = await CloudStorage.addPartner(partnerData);
                partnerData.id = result.id;
                this.cachedPartners.push(partnerData);
                this.syncPartnersToLocalStorage();

                this.selectedPartnerId = result.id;
                this.editingPartnerId = null;
                this.renderColumnsMenu();
                this.render();
                this.showPartnerCard(this.selectedPartnerId);
            }
        } catch (error) {
            this.showError('Ошибка сохранения: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    async deleteFromCard() {
        if (!this.selectedPartnerId) return;

        if (!confirm('Вы уверены, что хотите удалить этого партнера?')) return;

        this.showLoading(true);

        try {
            const partnerToDelete = this.cachedPartners.find(p => p.id === this.selectedPartnerId);
            await CloudStorage.deletePartner(this.selectedPartnerId);

            // Удаляем аватар из Google Drive если есть
            if (partnerToDelete?.avatarFileId) {
                try {
                    await CloudStorage.deleteImage(partnerToDelete.avatarFileId);
                } catch (e) {
                    console.error('Failed to delete avatar from Drive:', e);
                }
            }

            this.cachedPartners = this.cachedPartners.filter(p => p.id !== this.selectedPartnerId);
            this.syncPartnersToLocalStorage();
            this.selectedPartnerId = null;
            this.cleanupUnusedColumns();
            this.render();
            this.showStatsPanel();
        } catch (error) {
            this.showError('Ошибка удаления: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    async deleteFromForm() {
        if (!this.editingPartnerId) return;

        if (!confirm('Вы уверены, что хотите удалить этого партнера?')) return;

        this.showLoading(true);

        try {
            const partnerToDelete = this.cachedPartners.find(p => p.id === this.editingPartnerId);
            await CloudStorage.deletePartner(this.editingPartnerId);

            // Удаляем аватар из Google Drive если есть
            if (partnerToDelete?.avatarFileId) {
                try {
                    await CloudStorage.deleteImage(partnerToDelete.avatarFileId);
                } catch (e) {
                    console.error('Failed to delete avatar from Drive:', e);
                }
            }

            this.cachedPartners = this.cachedPartners.filter(p => p.id !== this.editingPartnerId);
            this.syncPartnersToLocalStorage();
            this.editingPartnerId = null;
            this.selectedPartnerId = null;
            this.cleanupUnusedColumns();
            this.render();
            this.showStatsPanel();
        } catch (error) {
            this.showError('Ошибка удаления: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    cleanupUnusedColumns() {
        const saved = localStorage.getItem('partnersColumnsConfig');

        if (saved) {
            try {
                let columns = JSON.parse(saved);
                const customFieldNames = this.collectCustomFieldNames();

                const cleanedColumns = columns.filter(col => {
                    if (col.isCustom) {
                        const fieldName = col.id.replace('custom_', '');
                        return customFieldNames.includes(fieldName);
                    }
                    return true;
                });

                if (cleanedColumns.length !== columns.length) {
                    this.saveColumnsConfig(cleanedColumns);
                }
            } catch (e) {}
        }

        // Всегда обновляем UI колонок
        this.renderColumnsMenu();
        this.renderTableHeader();
    },

    // ==================== TEMPLATE SYSTEM ====================

    handleTemplateChange() {
        const templateSelect = document.getElementById('templateSelect');
        const value = templateSelect.value;

        if (!value.includes('_template')) {
            this.currentTemplateId = value;
        }

        if (value === 'add_template') {
            this.isTemplateMode = true;
            this.showTemplateEditor();
        } else if (value === 'delete_template') {
            this.showDeleteTemplateDialog();
        } else if (value === 'rename_template') {
            this.showRenameTemplateDialog();
        } else if (value === 'edit_template') {
            this.showEditTemplateDialog();
        } else if (value) {
            this.currentTemplateId = value;
            this.applyTemplate(value);
        } else {
            this.resetToDefaultFields();
        }
    },

    resetToDefaultFields() {
        this.removeDynamicFields();
        this.currentTemplateId = '';
    },

    restoreTemplateSelection() {
        const templateSelect = document.getElementById('templateSelect');
        if (this.currentTemplateId !== undefined) {
            templateSelect.value = this.currentTemplateId;
        } else {
            const defaultTemplate = Object.values(this.cachedTemplates).find(t => t.isDefault);
            templateSelect.value = defaultTemplate ? defaultTemplate.id : '';
        }
    },

    async showDeleteTemplateDialog() {
        const templateList = Object.values(this.cachedTemplates);

        if (templateList.length === 0) {
            alert('Нет шаблонов для удаления');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для удаления:\n\n';
        templateList.forEach((template, index) => {
            optionsText += `${index + 1}. ${template.name}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = prompt(optionsText);

        if (!input) {
            this.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            alert('Неверный номер шаблона');
            this.restoreTemplateSelection();
            return;
        }

        const templateToDelete = templateList[index];

        if (confirm(`Удалить шаблон "${templateToDelete.name}"?`)) {
            this.showLoading(true);
            try {
                await CloudStorage.deleteTemplate(templateToDelete.id);
                if (this.currentTemplateId === templateToDelete.id) {
                    this.currentTemplateId = undefined;
                }
                delete this.cachedTemplates[templateToDelete.id];
                this.updateTemplateList();
                alert('Шаблон удален!');
            } catch (error) {
                this.showError('Ошибка удаления шаблона: ' + error.message);
            } finally {
                this.showLoading(false);
            }
        } else {
            this.restoreTemplateSelection();
        }
    },

    async showRenameTemplateDialog() {
        const templateList = Object.values(this.cachedTemplates);

        if (templateList.length === 0) {
            alert('Нет шаблонов для переименования');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для переименования:\n\n';
        templateList.forEach((template, index) => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            optionsText += `${index + 1}. ${template.name}${isDefault}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = prompt(optionsText);

        if (!input) {
            this.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            alert('Неверный номер шаблона');
            this.restoreTemplateSelection();
            return;
        }

        const templateToRename = templateList[index];

        const newName = prompt(`Введите новое название для шаблона "${templateToRename.name}":`, templateToRename.name);

        if (!newName || !newName.trim()) {
            this.restoreTemplateSelection();
            return;
        }

        const makeDefault = confirm('Установить этот шаблон как основной?\n(Основной шаблон будет автоматически выбран при добавлении партнера)');

        this.showLoading(true);
        try {
            if (makeDefault) {
                Object.values(this.cachedTemplates).forEach(t => {
                    t.isDefault = false;
                });
            }

            this.cachedTemplates[templateToRename.id].name = newName.trim();
            this.cachedTemplates[templateToRename.id].isDefault = makeDefault;

            await CloudStorage.saveTemplate(this.cachedTemplates[templateToRename.id]);
            this.updateTemplateList();
            alert('Шаблон обновлен!');
        } catch (error) {
            this.showError('Ошибка обновления шаблона: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    showEditTemplateDialog() {
        const templateList = Object.values(this.cachedTemplates);

        if (templateList.length === 0) {
            alert('Нет шаблонов для редактирования');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для редактирования:\n\n';
        templateList.forEach((template, index) => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            optionsText += `${index + 1}. ${template.name}${isDefault}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = prompt(optionsText);

        if (!input) {
            this.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            alert('Неверный номер шаблона');
            this.restoreTemplateSelection();
            return;
        }

        const templateToEdit = templateList[index];

        this.isTemplateMode = true;
        this.editingTemplateId = templateToEdit.id;
        this.showTemplateEditor(templateToEdit);
    },

    showTemplateEditor(existingTemplate = null) {
        document.getElementById('formTemplateSelector').style.display = 'none';
        document.getElementById('formTitle').textContent = existingTemplate ? 'Редактировать шаблон' : 'Добавить шаблон';
        document.getElementById('formSaveBtnText').textContent = 'Сохранить шаблон';
        document.getElementById('formBody').style.display = 'none';

        const formCounters = document.getElementById('formCounters');
        formCounters.style.display = 'flex';
        formCounters.classList.add('disabled');
        document.getElementById('formDep').value = '0';
        document.getElementById('formWith').value = '0';
        document.getElementById('formComp').value = '0';

        document.querySelector('.form-partner-info').style.display = 'flex';

        const subagentInput = document.getElementById('formSubagent');
        const subagentIdInput = document.getElementById('formSubagentId');
        const methodInput = document.getElementById('formMethod');
        const statusBadge = document.getElementById('formStatusBadge');
        const formAvatar = document.querySelector('.form-avatar');

        subagentInput.value = 'Субагент';
        subagentIdInput.value = 'ID Субагента';
        methodInput.innerHTML = '<option value="" selected>Метод</option>';

        subagentInput.classList.add('disabled');
        subagentIdInput.classList.add('disabled');
        methodInput.classList.add('disabled');
        if (statusBadge) statusBadge.classList.add('disabled');

        subagentInput.readOnly = true;
        subagentIdInput.readOnly = true;
        methodInput.disabled = true;

        const methodWrapper = document.querySelector('.form-method-wrapper');
        if (methodWrapper) {
            methodWrapper.classList.add('disabled');
            methodWrapper.style.pointerEvents = 'none';
        }

        if (formAvatar) {
            formAvatar.classList.add('disabled');
            formAvatar.style.pointerEvents = 'none';
        }

        document.getElementById('templateFieldsContainer').style.display = 'block';
        document.getElementById('templateFieldsList').innerHTML = '';

        if (existingTemplate && existingTemplate.fields) {
            this.templateFields = existingTemplate.fields.map(f => ({...f}));
            existingTemplate.fields.forEach(field => {
                const fieldHtml = `
                    <div class="template-field-item" data-field-id="${field.id}">
                        <input type="text" class="template-field-input" placeholder="Название поля" value="${this.escapeHtml(field.label)}"
                            onchange="partnersApp.updateTemplateFieldLabel('${field.id}', this.value)">
                        <select class="template-field-type" onchange="partnersApp.updateTemplateFieldType('${field.id}', this.value)">
                            <option value="text" ${field.type === 'text' ? 'selected' : ''}>Текст</option>
                            <option value="email" ${field.type === 'email' ? 'selected' : ''}>Email</option>
                            <option value="tel" ${field.type === 'tel' ? 'selected' : ''}>Телефон</option>
                            <option value="date" ${field.type === 'date' ? 'selected' : ''}>Дата</option>
                            <option value="textarea" ${field.type === 'textarea' ? 'selected' : ''}>Текстовая область</option>
                        </select>
                        <button class="template-field-remove" onclick="partnersApp.removeTemplateField('${field.id}')">
                            <img src="icons/cross.svg" width="16" height="16" alt="Удалить">
                        </button>
                    </div>
                `;
                document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);
            });
        } else {
            this.templateFields = [];
        }
    },

    addTemplateField() {
        const fieldId = 'templateField_' + Date.now();

        const field = {
            id: fieldId,
            label: '',
            type: 'text'
        };

        this.templateFields.push(field);

        const fieldHtml = `
            <div class="template-field-item" data-field-id="${fieldId}">
                <input type="text" class="template-field-input" placeholder="Название поля"
                    onchange="partnersApp.updateTemplateFieldLabel('${fieldId}', this.value)">
                <select class="template-field-type" onchange="partnersApp.updateTemplateFieldType('${fieldId}', this.value)">
                    <option value="text">Текст</option>
                    <option value="email">Email</option>
                    <option value="tel">Телефон</option>
                    <option value="date">Дата</option>
                    <option value="textarea">Текстовая область</option>
                </select>
                <button class="template-field-remove" onclick="partnersApp.removeTemplateField('${fieldId}')">
                    <img src="icons/cross.svg" width="16" height="16" alt="Удалить">
                </button>
            </div>
        `;

        document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);
    },

    updateTemplateFieldLabel(fieldId, label) {
        const field = this.templateFields.find(f => f.id === fieldId);
        if (field) {
            field.label = label;
        }
    },

    updateTemplateFieldType(fieldId, type) {
        const field = this.templateFields.find(f => f.id === fieldId);
        if (field) {
            field.type = type;
        }
    },

    removeTemplateField(fieldId) {
        this.templateFields = this.templateFields.filter(f => f.id !== fieldId);
        const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (fieldElement) {
            fieldElement.remove();
        }
    },

    applyTemplate(templateId) {
        if (!templateId) return;

        const template = this.cachedTemplates[templateId];

        if (template && template.fields) {
            this.removeDynamicFields();

            template.fields.forEach(field => {
                const fieldHtml = `
                    <div class="form-group-inline" data-template-field="true">
                        <label>${this.escapeHtml(field.label)}:</label>
                        ${field.type === 'textarea'
                            ? `<textarea id="${field.id}" placeholder="${this.escapeHtml(field.label)}" data-field-label="${this.escapeHtml(field.label)}"></textarea>`
                            : `<input type="${field.type}" id="${field.id}" placeholder="${this.escapeHtml(field.label)}" data-field-label="${this.escapeHtml(field.label)}">`
                        }
                    </div>
                `;

                document.getElementById('formBody').insertAdjacentHTML('beforeend', fieldHtml);
            });
        }
    },

    async saveTemplate() {
        const invalidFields = this.templateFields.filter(f => !f.label.trim());
        if (invalidFields.length > 0) {
            alert('Все поля должны иметь название');
            return;
        }

        if (this.templateFields.length === 0) {
            alert('Добавьте хотя бы одно поле для шаблона');
            return;
        }

        const templateName = prompt('Введите название шаблона:', this.editingTemplateId ? this.cachedTemplates[this.editingTemplateId].name : '');
        if (!templateName || !templateName.trim()) {
            return;
        }

        this.showLoading(true);

        try {
            const templateData = {
                id: this.editingTemplateId || ('template_' + Date.now()),
                name: templateName.trim(),
                fields: this.templateFields.map(f => ({
                    id: f.id,
                    label: f.label,
                    type: f.type
                })),
                isDefault: this.editingTemplateId ? this.cachedTemplates[this.editingTemplateId].isDefault : false
            };

            await CloudStorage.saveTemplate(templateData);
            this.cachedTemplates[templateData.id] = templateData;

            this.editingTemplateId = null;

            const formAvatar = document.querySelector('.form-avatar');
            if (formAvatar) {
                formAvatar.classList.remove('disabled');
                formAvatar.style.pointerEvents = 'auto';
            }

            const subagentInput = document.getElementById('formSubagent');
            const subagentIdInput = document.getElementById('formSubagentId');
            const methodInput = document.getElementById('formMethod');
            const statusBadge = document.getElementById('formStatusBadge');

            if (subagentInput) {
                subagentInput.classList.remove('disabled');
                subagentInput.readOnly = false;
            }
            if (subagentIdInput) {
                subagentIdInput.classList.remove('disabled');
                subagentIdInput.readOnly = false;
            }
            if (methodInput) {
                methodInput.classList.remove('disabled');
                methodInput.readOnly = false;
            }
            if (statusBadge) {
                statusBadge.classList.remove('disabled');
            }

            const formCounters = document.getElementById('formCounters');
            formCounters.style.display = 'flex';
            formCounters.classList.remove('disabled');

            document.querySelector('.form-partner-info').style.display = 'flex';

            this.closeForm();
            this.updateTemplateList();

            alert('Шаблон сохранен!');
        } catch (error) {
            this.showError('Ошибка сохранения шаблона: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    updateTemplateList() {
        const templateSelect = document.getElementById('templateSelect');

        templateSelect.innerHTML = '';

        const defaultTemplate = Object.values(this.cachedTemplates).find(t => t.isDefault);

        if (Object.keys(this.cachedTemplates).length === 0 || !defaultTemplate) {
            const baseOption = document.createElement('option');
            baseOption.value = '';
            baseOption.textContent = 'Шаблон';
            templateSelect.appendChild(baseOption);
        }

        Object.values(this.cachedTemplates).forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            const isDefault = template.isDefault ? ' (основной)' : '';
            option.textContent = template.name + isDefault;
            templateSelect.appendChild(option);
        });

        if (defaultTemplate) {
            templateSelect.value = defaultTemplate.id;
            this.currentTemplateId = defaultTemplate.id;
            this.applyTemplate(defaultTemplate.id);
        } else {
            this.currentTemplateId = '';
        }

        const addOption = document.createElement('option');
        addOption.value = 'add_template';
        addOption.textContent = '+ Добавить шаблон';
        templateSelect.appendChild(addOption);

        if (Object.keys(this.cachedTemplates).length > 0) {
            const editOption = document.createElement('option');
            editOption.value = 'edit_template';
            editOption.textContent = 'Изменить шаблон';
            templateSelect.appendChild(editOption);

            const renameOption = document.createElement('option');
            renameOption.value = 'rename_template';
            renameOption.textContent = 'Переименовать шаблон';
            templateSelect.appendChild(renameOption);

            const deleteOption = document.createElement('option');
            deleteOption.value = 'delete_template';
            deleteOption.textContent = '- Удалить шаблон';
            templateSelect.appendChild(deleteOption);
        }
    },

    // ==================== EXPORT/IMPORT ====================

    exportType: 'json',
    selectedExportTemplateId: null,

    showExportDialog() {
        const partners = this.getPartners();
        if (partners.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }

        document.getElementById('exportModal').classList.add('active');
        this.exportType = 'json';
        this.selectedExportTemplateId = null;

        this.setExportType('json');
        this.populateExportTemplateSelect();

        document.getElementById('exportCount').textContent = `Партнеров для экспорта: ${partners.length}`;
    },

    closeExportDialog() {
        document.getElementById('exportModal').classList.remove('active');
    },

    setExportType(type) {
        this.exportType = type;

        document.querySelectorAll('#exportModal .import-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        document.getElementById('jsonExportSection').style.display = type === 'json' ? 'block' : 'none';
        document.getElementById('excelExportSection').style.display = type === 'excel' ? 'block' : 'none';

        if (type === 'excel') {
            this.updateExportPreview();
        }
    },

    populateExportTemplateSelect() {
        const select = document.getElementById('exportTemplateSelect');

        select.innerHTML = '<option value="">Без шаблона (базовые поля)</option>';

        Object.values(this.cachedTemplates).forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            const isDefault = template.isDefault ? ' (основной)' : '';
            option.textContent = template.name + isDefault;
            select.appendChild(option);
        });

        const defaultTemplate = Object.values(this.cachedTemplates).find(t => t.isDefault);
        if (defaultTemplate) {
            select.value = defaultTemplate.id;
            this.selectedExportTemplateId = defaultTemplate.id;
        }
    },

    updateExportPreview() {
        const select = document.getElementById('exportTemplateSelect');
        const templateId = select.value;
        this.selectedExportTemplateId = templateId || null;

        const previewInfo = document.getElementById('exportPreviewInfo');

        let baseColumns = ['Субагент', 'ID Субагента', 'Метод', 'DEP', 'WITH', 'COMP', 'Статус', 'Фото'];
        let customColumns = [];

        if (templateId) {
            const template = this.cachedTemplates[templateId];
            if (template && template.fields) {
                customColumns = template.fields.map(f => f.label);
            }
        }

        const requiredCols = ['Субагент', 'ID Субагента', 'Метод'];
        const baseTags = baseColumns.map(col => {
            const isRequired = requiredCols.includes(col);
            return `<span class="excel-hint-column ${isRequired ? 'required' : 'optional'}">${col}</span>`;
        }).join('');
        const customTags = customColumns.map(col => `<span class="excel-hint-column optional">${col}</span>`).join('');

        previewInfo.innerHTML = `
            <div class="export-preview-title">Колонки для экспорта:</div>
            <div class="excel-hint-columns">${baseTags}${customTags}</div>
        `;
    },

    doExport() {
        if (this.exportType === 'json') {
            this.exportAsJSON();
        } else {
            this.exportAsExcel();
        }
        this.closeExportDialog();
    },

    exportAsJSON() {
        const partners = this.getPartners();
        const exportData = {
            type: 'partners-export',
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: partners
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `partners-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    exportAsExcel() {
        const partners = this.getPartners();
        const templateId = this.selectedExportTemplateId;

        const baseHeaders = ['Субагент', 'ID Субагента', 'Метод', 'DEP', 'WITH', 'COMP', 'Статус', 'Фото'];

        let templateHeaders = [];
        let templateName = 'базовый';
        if (templateId) {
            const template = this.cachedTemplates[templateId];
            if (template && template.fields) {
                templateHeaders = template.fields.map(f => f.label);
                templateName = String(template.name || 'custom');
            }
        }

        const allHeaders = [...baseHeaders, ...templateHeaders];

        const data = [allHeaders];
        partners.forEach(partner => {
            const row = [
                partner.subagent || '',
                partner.subagentId || '',
                partner.method || '',
                partner.dep || 0,
                partner.with || 0,
                partner.comp || 0,
                partner.status || 'Открыт',
                partner.avatar || ''
            ];

            templateHeaders.forEach(header => {
                row.push(partner.customFields?.[header] || '');
            });

            data.push(row);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);

        const colWidths = allHeaders.map(h => ({ wch: Math.max(h.length + 2, 15) }));
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Партнеры');

        const safeTemplateName = String(templateName || 'базовый').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
        const fileName = `partners_${safeTemplateName}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    },

    showImportDialog() {
        document.getElementById('importModal').classList.add('active');
        document.getElementById('importFileInput').value = '';
        document.getElementById('importExcelInput').value = '';
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('importBtn').disabled = true;
        this.pendingImportData = null;
        this.importType = 'json';
        this.selectedImportTemplateId = null;

        this.setImportType('json');
        this.populateImportTemplateSelect();
        this.updateExcelHint();
    },

    closeImportDialog() {
        document.getElementById('importModal').classList.remove('active');
        this.pendingImportData = null;
        this.importType = 'json';
        this.selectedImportTemplateId = null;
        // Reset file labels
        this.resetFileLabel(document.getElementById('jsonFileLabel'), 'Выберите JSON файл', 'или перетащите сюда');
        this.resetFileLabel(document.getElementById('excelFileLabel'), 'Выберите Excel файл', '.xlsx или .xls');
    },

    setImportType(type) {
        this.importType = type;
        this.pendingImportData = null;
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('importBtn').disabled = true;

        document.querySelectorAll('.import-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        document.getElementById('jsonImportSection').style.display = type === 'json' ? 'block' : 'none';
        document.getElementById('excelImportSection').style.display = type === 'excel' ? 'block' : 'none';

        document.getElementById('importFileInput').value = '';
        document.getElementById('importExcelInput').value = '';

        // Reset file labels
        this.resetFileLabel(document.getElementById('jsonFileLabel'), 'Выберите JSON файл', 'или перетащите сюда');
        this.resetFileLabel(document.getElementById('excelFileLabel'), 'Выберите Excel файл', '.xlsx или .xls');

        if (type === 'excel') {
            this.goToImportStep1();
        }
    },

    goToImportStep1() {
        document.getElementById('excelImportStep1').style.display = 'block';
        document.getElementById('excelImportStep2').style.display = 'none';
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('importBtn').disabled = true;
        document.getElementById('importExcelInput').value = '';
        this.pendingImportData = null;
        this.pendingExtraColumns = null;
        // Reset Excel file label
        this.resetFileLabel(document.getElementById('excelFileLabel'), 'Выберите Excel файл', '.xlsx или .xls');
    },

    goToImportStep2() {
        document.getElementById('excelImportStep1').style.display = 'none';
        document.getElementById('excelImportStep2').style.display = 'block';
        this.updateExcelHint();
    },

    openTemplateFromImport() {
        this.closeImportDialog();
        this.showAddModal();
        this.isTemplateMode = true;
        this.showTemplateEditor();
    },

    createTemplateFromExtraColumns() {
        if (!this.pendingExtraColumns || this.pendingExtraColumns.length === 0) return;

        const extraColumns = [...this.pendingExtraColumns];

        this.closeImportDialog();
        this.showAddModal();
        this.isTemplateMode = true;
        this.showTemplateEditor();

        extraColumns.forEach(colName => {
            const fieldId = 'templateField_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            const field = {
                id: fieldId,
                label: colName,
                type: 'text'
            };
            this.templateFields.push(field);

            const fieldHtml = `
                <div class="template-field-item" data-field-id="${fieldId}">
                    <input type="text" class="template-field-input" placeholder="Название поля" value="${this.escapeHtml(colName)}"
                        onchange="partnersApp.updateTemplateFieldLabel('${fieldId}', this.value)">
                    <select class="template-field-type" onchange="partnersApp.updateTemplateFieldType('${fieldId}', this.value)">
                        <option value="text" selected>Текст</option>
                        <option value="email">Email</option>
                        <option value="tel">Телефон</option>
                        <option value="date">Дата</option>
                        <option value="textarea">Текстовая область</option>
                    </select>
                    <button class="template-field-remove" onclick="partnersApp.removeTemplateField('${fieldId}')">
                        <img src="icons/cross.svg" width="16" height="16" alt="Удалить">
                    </button>
                </div>
            `;
            document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);
        });
    },

    ignoreExtraColumns() {
        const warning = document.querySelector('.extra-columns-warning');
        if (warning) {
            warning.remove();
        }
        this.pendingExtraColumns = null;
    },

    populateImportTemplateSelect() {
        const select = document.getElementById('importTemplateSelect');

        select.innerHTML = '<option value="">Без шаблона (базовые поля)</option>';

        Object.values(this.cachedTemplates).forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            const isDefault = template.isDefault ? ' (основной)' : '';
            option.textContent = template.name + isDefault;
            select.appendChild(option);
        });

        const defaultTemplate = Object.values(this.cachedTemplates).find(t => t.isDefault);
        if (defaultTemplate) {
            select.value = defaultTemplate.id;
            this.selectedImportTemplateId = defaultTemplate.id;
        }
    },

    updateExcelHint() {
        const select = document.getElementById('importTemplateSelect');
        const templateId = select.value;
        this.selectedImportTemplateId = templateId || null;

        const hintColumns = document.getElementById('excelHintColumns');

        const baseColumns = [
            { name: 'Субагент', required: true },
            { name: 'ID Субагента', required: true },
            { name: 'Метод', required: true },
            { name: 'DEP', required: false },
            { name: 'WITH', required: false },
            { name: 'COMP', required: false },
            { name: 'Статус', required: false },
            { name: 'Фото', required: false }
        ];

        let templateColumns = [];
        if (templateId) {
            const template = this.cachedTemplates[templateId];
            if (template && template.fields) {
                templateColumns = template.fields.map(f => ({
                    name: f.label,
                    required: false
                }));
            }
        }

        let html = '';
        [...baseColumns, ...templateColumns].forEach(col => {
            const className = col.required ? 'required' : 'optional';
            html += `<span class="excel-hint-column ${className}">${this.escapeHtml(col.name)}</span>`;
        });

        hintColumns.innerHTML = html;
    },

    downloadExcelTemplate() {
        const templateId = this.selectedImportTemplateId;

        const baseHeaders = ['Субагент', 'ID Субагента', 'Метод', 'DEP', 'WITH', 'COMP', 'Статус', 'Фото'];

        let templateHeaders = [];
        let templateName = 'базовый';
        if (templateId) {
            const template = this.cachedTemplates[templateId];
            if (template && template.fields) {
                templateHeaders = template.fields.map(f => f.label);
                templateName = String(template.name || 'custom');
            }
        }

        const allHeaders = [...baseHeaders, ...templateHeaders];

        const exampleData = [
            allHeaders,
            this.generateExampleRow(allHeaders, 1),
            this.generateExampleRow(allHeaders, 2)
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exampleData);

        const colWidths = allHeaders.map(h => ({ wch: Math.max(h.length + 2, 15) }));
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Партнеры');

        const fileName = `partners_template_${templateName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    },

    generateExampleRow(headers, rowNum) {
        return headers.map(header => {
            switch (header) {
                case 'Субагент':
                    return `Субагент ${rowNum}`;
                case 'ID Субагента':
                    return `SA-${String(rowNum).padStart(4, '0')}`;
                case 'Метод':
                    return rowNum === 1 ? 'Метод A' : 'Метод B';
                case 'DEP':
                    return rowNum * 10;
                case 'WITH':
                    return rowNum * 5;
                case 'COMP':
                    return rowNum * 2;
                case 'Статус':
                    return 'Открыт';
                case 'Фото':
                    return '';
                default:
                    return `Значение ${rowNum}`;
            }
        });
    },

    setupImportHandler() {
        const fileInput = document.getElementById('importFileInput');
        const jsonLabel = document.getElementById('jsonFileLabel');

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                this.resetFileLabel(jsonLabel, 'Выберите JSON файл', 'или перетащите сюда');
                return;
            }

            // Update label to show selected file
            this.updateFileLabel(jsonLabel, file.name);

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    if (data.type !== 'partners-export' || !Array.isArray(data.data)) {
                        throw new Error('Неверный формат файла');
                    }

                    this.pendingImportData = data.data;

                    const preview = document.getElementById('importPreview');
                    preview.style.display = 'block';
                    preview.innerHTML = `<strong>Найдено партнеров:</strong> ${data.data.length}<br><small>Дата экспорта: ${new Date(data.exportDate).toLocaleString('ru-RU')}</small>`;

                    document.getElementById('importBtn').disabled = false;
                } catch (err) {
                    alert('Ошибка чтения файла: ' + err.message);
                    document.getElementById('importPreview').style.display = 'none';
                    document.getElementById('importBtn').disabled = true;
                    this.resetFileLabel(jsonLabel, 'Выберите JSON файл', 'или перетащите сюда');
                }
            };
            reader.readAsText(file);
        });

        const excelInput = document.getElementById('importExcelInput');
        const excelLabel = document.getElementById('excelFileLabel');

        excelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                this.resetFileLabel(excelLabel, 'Выберите Excel файл', '.xlsx или .xls');
                return;
            }

            // Update label to show selected file
            this.updateFileLabel(excelLabel, file.name);

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    if (jsonData.length < 2) {
                        throw new Error('Файл пустой или содержит только заголовки');
                    }

                    const headers = jsonData[0].map(h => String(h).trim());

                    const baseColumns = ['Субагент', 'ID Субагента', 'Метод', 'DEP', 'WITH', 'COMP', 'Статус', 'Фото'];
                    const columnMapping = {
                        'Субагент': 'subagent',
                        'ID Субагента': 'subagentId',
                        'Метод': 'method',
                        'DEP': 'dep',
                        'WITH': 'with',
                        'COMP': 'comp',
                        'Статус': 'status',
                        'Фото': 'avatar'
                    };

                    let expectedColumns = [...baseColumns];
                    const templateId = this.selectedImportTemplateId;
                    if (templateId) {
                        const template = this.cachedTemplates[templateId];
                        if (template && template.fields) {
                            template.fields.forEach(f => {
                                expectedColumns.push(f.label);
                                columnMapping[f.label] = 'custom_' + f.label;
                            });
                        }
                    }

                    const extraColumns = headers.filter(h => !expectedColumns.includes(h));

                    const columnIndexes = {};
                    headers.forEach((header, index) => {
                        if (columnMapping[header]) {
                            columnIndexes[columnMapping[header]] = index;
                        } else {
                            columnIndexes['custom_' + header] = index;
                        }
                    });

                    const requiredColumns = ['subagent', 'subagentId', 'method'];
                    const missingColumns = requiredColumns.filter(col => columnIndexes[col] === undefined);
                    if (missingColumns.length > 0) {
                        const missingNames = missingColumns.map(col => {
                            return Object.keys(columnMapping).find(key => columnMapping[key] === col) || col;
                        });
                        throw new Error('Отсутствуют обязательные колонки: ' + missingNames.join(', '));
                    }

                    const partners = [];
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || row.length === 0) continue;

                        const partner = {
                            id: 'partner_' + Date.now() + '_' + i,
                            subagent: String(row[columnIndexes.subagent] || '').trim(),
                            subagentId: String(row[columnIndexes.subagentId] || '').trim(),
                            method: String(row[columnIndexes.method] || '').trim(),
                            dep: parseInt(row[columnIndexes.dep]) || 0,
                            with: parseInt(row[columnIndexes.with]) || 0,
                            comp: parseInt(row[columnIndexes.comp]) || 0,
                            status: String(row[columnIndexes.status] || 'Открыт').trim(),
                            avatar: String(row[columnIndexes.avatar] || '').trim(),
                            customFields: {}
                        };

                        if (!partner.subagent && !partner.subagentId && !partner.method) {
                            continue;
                        }

                        Object.keys(columnIndexes).forEach(key => {
                            if (key.startsWith('custom_')) {
                                const fieldName = key.replace('custom_', '');
                                const value = String(row[columnIndexes[key]] || '').trim();
                                if (value) {
                                    partner.customFields[fieldName] = value;
                                }
                            }
                        });

                        partners.push(partner);
                    }

                    if (partners.length === 0) {
                        throw new Error('Не найдено данных для импорта');
                    }

                    this.pendingImportData = partners;
                    this.pendingExtraColumns = extraColumns;

                    const preview = document.getElementById('importPreview');
                    preview.style.display = 'block';

                    if (extraColumns.length > 0) {
                        const extraColsTags = extraColumns.map(c => `<span class="extra-column-tag">${this.escapeHtml(c)}</span>`).join('');
                        preview.innerHTML = `
                            <strong>Найдено партнеров:</strong> ${partners.length}<br>
                            <small>Файл: ${file.name}</small>
                            <div class="extra-columns-warning">
                                <div class="extra-columns-warning-title">Обнаружены дополнительные колонки:</div>
                                <div class="extra-columns-list">${extraColsTags}</div>
                                <div class="extra-columns-actions">
                                    <button class="btn-create-template-from-import" onclick="partnersApp.createTemplateFromExtraColumns()">
                                        Создать шаблон с этими полями
                                    </button>
                                    <button class="btn-ignore-extra-columns" onclick="partnersApp.ignoreExtraColumns()">
                                        Игнорировать
                                    </button>
                                </div>
                            </div>
                        `;
                    } else {
                        preview.innerHTML = `<strong>Найдено партнеров:</strong> ${partners.length}<br><small>Файл: ${file.name}</small>`;
                    }

                    document.getElementById('importBtn').disabled = false;
                } catch (err) {
                    alert('Ошибка чтения файла: ' + err.message);
                    document.getElementById('importPreview').style.display = 'none';
                    document.getElementById('importBtn').disabled = true;
                    this.resetFileLabel(excelLabel, 'Выберите Excel файл', '.xlsx или .xls');
                }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    // Helper methods for file input labels
    updateFileLabel(label, fileName) {
        if (!label) return;
        label.classList.add('has-file');
        const mainText = label.querySelector('.main-text');
        const subText = label.querySelector('.sub-text');
        if (mainText) mainText.textContent = fileName;
        if (subText) subText.textContent = 'Файл выбран';
    },

    resetFileLabel(label, mainText, subText) {
        if (!label) return;
        label.classList.remove('has-file');
        const mainEl = label.querySelector('.main-text');
        const subEl = label.querySelector('.sub-text');
        if (mainEl) mainEl.textContent = mainText;
        if (subEl) subEl.textContent = subText;
    },

    // Counter button helpers
    incrementCounter(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            const currentValue = parseInt(input.value) || 0;
            input.value = currentValue + 1;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    decrementCounter(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            const currentValue = parseInt(input.value) || 0;
            const min = parseInt(input.min);
            const newValue = currentValue - 1;
            input.value = (!isNaN(min) && newValue < min) ? min : newValue;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    // Import state
    importCancelled: false,

    /**
     * Импорт данных с фоновой синхронизацией
     * Данные сразу сохраняются локально и отображаются,
     * синхронизация с облаком происходит в фоне
     */
    async importData() {
        if (!this.pendingImportData) return;

        const total = this.pendingImportData.length;
        let added = 0;
        let updated = 0;
        let methodsAdded = 0;

        try {
            const currentData = this.getPartners();
            const createKey = (p) => `${String(p.subagent || '').toLowerCase().trim()}|${String(p.subagentId || '').toLowerCase().trim()}|${String(p.method || '').toLowerCase().trim()}`;
            const existingPartnersMap = new Map(currentData.map(p => [createKey(p), p]));

            // Собираем новые методы
            const existingMethods = this.getMethods();
            const existingMethodNames = new Set(existingMethods.map(m => m.name.toLowerCase()));
            const newMethodsToSync = [];

            for (const partner of this.pendingImportData) {
                const method = (partner.method || '').trim();
                if (method && !existingMethodNames.has(method.toLowerCase())) {
                    existingMethodNames.add(method.toLowerCase());
                    const tempId = 'temp_method_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    const methodData = { id: tempId, name: method, _synced: false };
                    this.cachedMethods.push(methodData);
                    newMethodsToSync.push({ tempId, data: { name: method } });
                    methodsAdded++;
                }
            }

            // Подготавливаем партнёров для локального сохранения и синхронизации
            const partnersToAdd = [];
            const partnersToUpdate = [];

            for (const partner of this.pendingImportData) {
                const partnerKey = createKey(partner);
                const existingPartner = existingPartnersMap.get(partnerKey);

                if (existingPartner) {
                    // Обновляем существующего партнёра
                    const updateData = {
                        id: existingPartner.id,
                        deposits: partner.dep || partner.deposits || existingPartner.deposits || 0,
                        withdrawals: partner.with || partner.withdrawals || existingPartner.withdrawals || 0,
                        compensation: partner.comp || partner.compensation || existingPartner.compensation || 0,
                        status: partner.status || existingPartner.status || 'Открыт',
                        avatar: partner.avatar || existingPartner.avatar || '',
                        customFields: { ...(existingPartner.customFields || {}), ...(partner.customFields || {}) }
                    };

                    // Обновляем в кэше сразу
                    const cacheIndex = this.cachedPartners.findIndex(p => p.id === existingPartner.id);
                    if (cacheIndex !== -1) {
                        Object.assign(this.cachedPartners[cacheIndex], updateData);
                        this.cachedPartners[cacheIndex].dep = updateData.deposits || 0;
                        this.cachedPartners[cacheIndex].with = updateData.withdrawals || 0;
                        this.cachedPartners[cacheIndex].comp = updateData.compensation || 0;
                        this.cachedPartners[cacheIndex]._synced = false;
                    }

                    partnersToUpdate.push({ id: existingPartner.id, data: updateData });
                    updated++;
                } else {
                    // Новый партнёр - создаём с временным ID
                    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    const partnerData = {
                        id: tempId,
                        subagent: partner.subagent,
                        subagentId: partner.subagentId,
                        method: partner.method,
                        deposits: partner.dep || partner.deposits || 0,
                        withdrawals: partner.with || partner.withdrawals || 0,
                        compensation: partner.comp || partner.compensation || 0,
                        status: partner.status || 'Открыт',
                        avatar: partner.avatar || '',
                        customFields: partner.customFields || {},
                        _synced: false
                    };

                    partnerData.dep = partnerData.deposits || 0;
                    partnerData.with = partnerData.withdrawals || 0;
                    partnerData.comp = partnerData.compensation || 0;

                    this.cachedPartners.push(partnerData);
                    existingPartnersMap.set(partnerKey, partnerData);

                    partnersToAdd.push({ tempId, data: partnerData });
                    added++;
                }
            }

            // Сохраняем в localStorage сразу
            this.syncPartnersToLocalStorage();

            // Закрываем диалог и обновляем UI мгновенно
            this.closeImportDialog();
            this.renderColumnsMenu();
            this.renderTableHeader();
            this.render();

            // Показываем результат
            let message = `Импорт завершен!\n\n`;
            message += `Добавлено: ${added}\n`;
            if (updated > 0) message += `Обновлено: ${updated}\n`;
            if (methodsAdded > 0) message += `Новых методов: ${methodsAdded}\n`;
            message += `\nСинхронизация с облаком идёт в фоне...`;
            alert(message);

            // Добавляем операции в очередь фоновой синхронизации
            if (typeof SyncManager !== 'undefined') {
                // Сначала методы
                for (const method of newMethodsToSync) {
                    SyncManager.addToQueue('add', 'method', method.data, method.tempId);
                }

                // Затем партнёры
                for (const partner of partnersToAdd) {
                    SyncManager.addToQueue('add', 'partner', partner.data, partner.tempId);
                }

                for (const partner of partnersToUpdate) {
                    SyncManager.addToQueue('update', 'partner', partner.data);
                }

                // Устанавливаем callback для обновления UI после синхронизации
                SyncManager.onSyncComplete = () => {
                    // Перезагружаем данные с сервера для получения актуальных ID
                    this.loadDataFromCloud();
                };

                SyncManager.onSyncError = (errors) => {
                    console.error('Ошибки синхронизации:', errors);
                    if (errors.length > 0) {
                        this.showError(`Ошибки синхронизации: ${errors.length}. Проверьте консоль.`);
                    }
                };
            } else {
                console.warn('SyncManager не найден, синхронизация не будет выполнена');
            }

        } catch (error) {
            console.error('Ошибка импорта:', error);
            this.showError('Ошибка импорта: ' + error.message);
        }
    },

    showImportProgress(current, total, status) {
        let progressModal = document.getElementById('importProgressModal');

        if (!progressModal) {
            progressModal = document.createElement('div');
            progressModal.id = 'importProgressModal';
            progressModal.className = 'modal active';
            progressModal.innerHTML = `
                <div class="modal-dialog" style="max-width: 400px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Импорт данных</h2>
                    </div>
                    <div class="modal-body">
                        <div class="import-progress-status" id="importProgressStatus">Подготовка...</div>
                        <div class="import-progress-bar-container">
                            <div class="import-progress-bar" id="importProgressBar"></div>
                        </div>
                        <div class="import-progress-count" id="importProgressCount">0 / 0</div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="partnersApp.cancelImport()">Отмена</button>
                    </div>
                </div>
            `;

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .import-progress-status {
                    font-size: 14px;
                    margin-bottom: 12px;
                    color: #666;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .import-progress-bar-container {
                    width: 100%;
                    height: 8px;
                    background: rgba(0,0,0,0.1);
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }
                .import-progress-bar {
                    height: 100%;
                    background: #fdbe2f;
                    border-radius: 4px;
                    transition: width 0.3s ease;
                    width: 0%;
                }
                .import-progress-count {
                    font-size: 13px;
                    color: #888;
                    text-align: center;
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(progressModal);
        }

        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        document.getElementById('importProgressStatus').textContent = status;
        document.getElementById('importProgressBar').style.width = percent + '%';
        document.getElementById('importProgressCount').textContent = `${current} / ${total} (${percent}%)`;

        progressModal.classList.add('active');
    },

    hideImportProgress() {
        const progressModal = document.getElementById('importProgressModal');
        if (progressModal) {
            progressModal.classList.remove('active');
        }
    },

    cancelImport() {
        this.importCancelled = true;
        this.hideImportProgress();
    },

    // Remove duplicate partners
    async removeDuplicates() {
        const partners = this.getPartners();

        if (partners.length === 0) {
            alert('Нет партнёров');
            return;
        }

        // Find duplicates by subagent + subagentId + method
        const createKey = (p) => `${String(p.subagent || '').toLowerCase().trim()}|${String(p.subagentId || '').toLowerCase().trim()}|${String(p.method || '').toLowerCase().trim()}`;

        const seen = new Map();
        const duplicateIds = [];

        for (const partner of partners) {
            const key = createKey(partner);
            if (seen.has(key)) {
                // This is a duplicate - mark for deletion
                duplicateIds.push(partner.id);
            } else {
                seen.set(key, partner.id);
            }
        }

        if (duplicateIds.length === 0) {
            alert('Дубликатов не найдено');
            return;
        }

        if (!confirm(`Найдено дубликатов: ${duplicateIds.length}\n\nУдалить их?`)) {
            return;
        }

        this.showLoading(true);

        try {
            let deleted = 0;
            for (const id of duplicateIds) {
                try {
                    await CloudStorage.deletePartner(id);
                    this.cachedPartners = this.cachedPartners.filter(p => p.id !== id);
                    deleted++;
                } catch (e) {
                    console.warn('Failed to delete duplicate:', id, e);
                }
            }

            this.syncPartnersToLocalStorage();
            this.render();
            alert(`Удалено дубликатов: ${deleted}`);
        } catch (error) {
            this.showError('Ошибка удаления: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    partnersApp.init();
});

// Close modals on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('importModal').classList.contains('active')) {
            partnersApp.closeImportDialog();
        }
        if (document.getElementById('cropModal').classList.contains('active')) {
            partnersApp.closeCropModal();
        }
        document.getElementById('cardStatusDropdown').style.display = 'none';
        document.getElementById('formStatusDropdown').style.display = 'none';
    }
});

// Close modals on backdrop click
document.getElementById('importModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        partnersApp.closeImportDialog();
    }
});

document.getElementById('cropModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        partnersApp.closeCropModal();
    }
});

// Close dropdowns and menus when clicking outside
document.addEventListener('click', (e) => {
    const cardStatusBadge = document.getElementById('cardStatusBadge');
    const cardStatusDropdown = document.getElementById('cardStatusDropdown');
    const formStatusBadge = document.getElementById('formStatusBadge');
    const formStatusDropdown = document.getElementById('formStatusDropdown');
    const columnsSettings = document.querySelector('.columns-settings');
    const columnsMenu = document.getElementById('columnsMenu');

    if (cardStatusBadge && !cardStatusBadge.contains(e.target)) {
        cardStatusDropdown.style.display = 'none';
        const arrow = cardStatusBadge.querySelector('.status-dropdown-icon');
        if (arrow) arrow.style.transform = 'rotate(-90deg)';
    }
    if (formStatusBadge && !formStatusBadge.contains(e.target)) {
        formStatusDropdown.style.display = 'none';
        const arrow = formStatusBadge.querySelector('.status-dropdown-icon');
        if (arrow) arrow.style.transform = 'rotate(-90deg)';
    }
    if (columnsSettings && columnsMenu && !columnsSettings.contains(e.target)) {
        columnsMenu.classList.remove('active');
    }
});
