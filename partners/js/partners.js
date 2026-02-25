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

    // ==================== DIALOG HELPERS ====================

    /**
     * Показать диалог подтверждения (замена confirm)
     * @param {string} message - Текст сообщения
     * @param {string} title - Заголовок диалога
     * @returns {Promise<boolean>} true если подтверждено
     */
    showConfirm(message, title = 'Подтверждение') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmDialog');
            const titleEl = document.getElementById('confirmDialogTitle');
            const messageEl = document.getElementById('confirmDialogMessage');
            const okBtn = document.getElementById('confirmDialogOk');
            const cancelBtn = document.getElementById('confirmDialogCancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            modal.classList.add('active');

            const cleanup = () => {
                modal.classList.remove('active');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('click', handleBackdrop);
            };

            const handleOk = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const handleBackdrop = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };

            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
            modal.addEventListener('click', handleBackdrop);
        });
    },

    /**
     * Показать диалог ввода (замена prompt)
     * @param {string} message - Текст сообщения
     * @param {string} defaultValue - Значение по умолчанию
     * @param {string} title - Заголовок диалога
     * @returns {Promise<string|null>} введённое значение или null
     */
    showPrompt(message, defaultValue = '', title = 'Ввод') {
        return new Promise((resolve) => {
            const modal = document.getElementById('promptDialog');
            const titleEl = document.getElementById('promptDialogTitle');
            const messageEl = document.getElementById('promptDialogMessage');
            const inputEl = document.getElementById('promptDialogInput');
            const okBtn = document.getElementById('promptDialogOk');
            const cancelBtn = document.getElementById('promptDialogCancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            inputEl.value = defaultValue;
            modal.classList.add('active');

            // Фокус на input
            setTimeout(() => inputEl.focus(), 100);

            const cleanup = () => {
                modal.classList.remove('active');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                inputEl.removeEventListener('keydown', handleKeydown);
                modal.removeEventListener('click', handleBackdrop);
            };

            const handleOk = () => {
                const value = inputEl.value.trim();
                cleanup();
                resolve(value || null);
            };

            const handleCancel = () => {
                cleanup();
                resolve(null);
            };

            const handleKeydown = (e) => {
                if (e.key === 'Enter') {
                    handleOk();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };

            const handleBackdrop = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };

            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
            inputEl.addEventListener('keydown', handleKeydown);
            modal.addEventListener('click', handleBackdrop);
        });
    },

    // ==================== INITIALIZATION ====================

    async init() {
        // Check authentication and role status (waiting_invite/blocked check)
        if (!await AuthGuard.checkWithRole()) {
            return; // Will redirect to login or waiting-invite
        }

        // Show loading
        this.showLoading(true);

        try {
            // Initialize CloudStorage
            await CloudStorage.init();

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
            if (loadingState) loadingState.classList.remove('hidden');
            if (table) table.classList.add('hidden');
            if (emptyState) emptyState.classList.add('hidden');
        } else {
            if (loadingState) loadingState.classList.add('hidden');
            // Table visibility will be set by render()
        }
    },

    showError(message) {
        Toast.error(message);
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
        this.updateMethodsCount();
    },

    closeMethodsDialog() {
        document.getElementById('methodsModal').classList.remove('active');
        this.populateMethodsSelect();
    },

    updateMethodsCount() {
        const badge = document.getElementById('methodsCountBadge');
        if (badge) {
            badge.textContent = this.getMethods().length;
        }
    },

    async addMethod() {
        const input = document.getElementById('newMethodInput');
        const name = input.value.trim();

        if (!name) {
            Toast.warning('Введите название метода');
            return;
        }

        const methods = this.getMethods();
        if (methods.some(m => m.name.toLowerCase() === name.toLowerCase())) {
            Toast.warning('Метод с таким названием уже существует');
            return;
        }

        try {
            const result = await CloudStorage.addMethod({ name: name });
            this.cachedMethods.push({ id: result.id, name: name });
            input.value = '';
            this.renderMethodsList();
            this.updateMethodsCount();
            input.focus();
        } catch (error) {
            this.showError('Ошибка добавления метода: ' + error.message);
        }
    },

    async deleteMethod(methodId) {
        try {
            await CloudStorage.deleteMethod(methodId);
            this.cachedMethods = this.cachedMethods.filter(m => m.id !== methodId);
            this.renderMethodsList();
            this.updateMethodsCount();
            Toast.success('Метод удален');
        } catch (error) {
            // Если метод не найден на сервере, обновляем кеш из облака
            if (error.message.includes('Method not found') || error.message.includes('not found')) {
                try {
                    // Обновляем список методов из облака
                    this.cachedMethods = await CloudStorage.getMethods(false);
                    this.renderMethodsList();
                    this.updateMethodsCount();
                    Toast.warning('Метод уже был удален. Список обновлен.');
                } catch (refreshError) {
                    this.showError('Ошибка обновления списка методов: ' + refreshError.message);
                }
            } else {
                this.showError('Ошибка удаления метода: ' + error.message);
            }
        }
    },

    startEditMethod(methodId) {
        const methods = this.getMethods();
        const method = methods.find(m => m.id === methodId);
        if (!method) return;

        const item = document.querySelector(`[data-method-id="${methodId}"]`);
        if (!item) return;

        item.classList.add('editing');
        item.innerHTML = `
            <input type="text" class="method-item-input" id="editMethodInput_${methodId}"
                   value="${this.escapeHtml(method.name)}">
            <div class="method-edit-actions">
                <button class="method-edit-btn save" data-action="partners-saveEditMethod" data-method-id="${methodId}" title="Сохранить">
                    <img src="../shared/icons/done.svg" alt="Сохранить">
                </button>
                <button class="method-edit-btn cancel" data-action="partners-cancelEditMethod" title="Отмена">
                    <img src="../shared/icons/cross.svg" alt="Отмена">
                </button>
            </div>
        `;

        const input = document.getElementById(`editMethodInput_${methodId}`);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveEditMethod(methodId);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.renderMethodsList();
        });
        input.focus();
        input.select();
    },

    async saveEditMethod(methodId) {
        const input = document.getElementById(`editMethodInput_${methodId}`);
        const newName = input.value.trim();

        if (!newName) {
            Toast.warning('Название не может быть пустым');
            return;
        }

        const methods = this.getMethods();
        const methodIndex = methods.findIndex(m => m.id === methodId);
        if (methodIndex === -1) return;

        if (methods.some((m, i) => i !== methodIndex && m.name.toLowerCase() === newName.toLowerCase())) {
            Toast.warning('Метод с таким названием уже существует');
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
            Toast.success('Метод обновлен');
        } catch (error) {
            // Если метод не найден на сервере, обновляем кеш из облака
            if (error.message.includes('Method not found') || error.message.includes('not found')) {
                try {
                    this.cachedMethods = await CloudStorage.getMethods(false);
                    this.renderMethodsList();
                    Toast.warning('Метод не найден. Список обновлен.');
                } catch (refreshError) {
                    this.showError('Ошибка обновления списка методов: ' + refreshError.message);
                }
            } else {
                this.showError('Ошибка сохранения метода: ' + error.message);
            }
        }
    },

    cancelEditMethod() {
        this.renderMethodsList();
    },

    renderMethodsList() {
        const container = document.getElementById('methodsList');
        const methods = this.getMethods();

        if (methods.length === 0) {
            container.innerHTML = `
                <div class="methods-empty">
                    <img class="methods-empty-icon" src="../shared/icons/partners.svg" alt="">
                    <span class="methods-empty-text">Нет методов</span>
                    <span class="methods-empty-hint">Добавьте первый метод выше</span>
                </div>
            `;
            return;
        }

        container.innerHTML = methods.map(method => `
            <div class="method-item" data-method-id="${method.id}">
                <span class="method-item-name">${this.escapeHtml(method.name)}</span>
                <div class="method-item-actions">
                    <button class="method-action-btn" data-action="partners-startEditMethod" data-method-id="${method.id}" title="Редактировать">
                        <img src="../shared/icons/pen.svg" alt="Редактировать">
                    </button>
                    <button class="method-action-btn delete" data-action="partners-deleteMethod" data-method-id="${method.id}" title="Удалить">
                        <img src="../shared/icons/cross.svg" alt="Удалить">
                    </button>
                </div>
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
                    <div class="sort-header" data-action="partners-sortBy" data-column-id="${col.id}">
                        ${this.escapeHtml(col.label)}
                        <img src="../shared/icons/filter.svg" width="16" height="16" alt="Сортировка">
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
                    <span class="column-item-label">${this.escapeHtml(col.label)}</span>
                </div>
            `;
        });

        html += `
            <div class="columns-menu-footer">
                <span>${visibleCount}/${this.maxVisibleColumns}</span>
                <button class="columns-reset-btn" data-action="partners-resetColumnsConfig">Сбросить</button>
            </div>
        `;

        columnsList.innerHTML = html;

        // Add drag&drop event listeners
        const columnItems = columnsList.querySelectorAll('.column-item');
        columnItems.forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleColumnDragStart(e));
            item.addEventListener('dragover', (e) => this.handleColumnDragOver(e));
            item.addEventListener('drop', (e) => this.handleColumnDrop(e));
            item.addEventListener('dragend', (e) => this.handleColumnDragEnd(e));

            // Prevent click when dragging
            const dragHandle = item.querySelector('.column-item-drag');
            if (dragHandle) {
                dragHandle.addEventListener('mousedown', (e) => e.stopPropagation());
            }
        });
    },

    resetColumnsConfig() {
        localStorage.removeItem('partnersColumnsConfig');
        this.renderColumnsMenu();
        this.renderTableHeader();
        this.render();
    },

    toggleColumnsMenu() {
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
            Toast.warning(`Максимум ${this.maxVisibleColumns} колонок. Отключите одну из текущих колонок.`);
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
                return `<td data-column="avatar"><div class="partner-avatar"><img class="avatar-placeholder" src="../shared/icons/partners.svg" alt=""></div></td>`;
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
            emptyState.classList.remove('hidden');
            table.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            table.classList.remove('hidden');

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

        // Update status counts for header badges
        const openCount = partners.filter(p => (p.status || 'Открыт') === 'Открыт').length;
        const closedCount = partners.filter(p => p.status === 'Закрыт').length;
        document.getElementById('openCount').textContent = openCount;
        document.getElementById('closedCount').textContent = closedCount;
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
            if (text.includes(searchValue)) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
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
        this.showHintPanel();
    },

    closeCard() {
        this.deselectPartner();
    },

    showHintPanel() {
        document.getElementById('hintPanel').classList.remove('hidden');
        document.getElementById('partnerCard').classList.add('hidden');
        document.getElementById('partnerForm').classList.add('hidden');
    },

    showPartnerCard(id) {
        const partners = this.getPartners();
        const partner = partners.find(p => p.id === id);
        if (!partner) return;

        document.getElementById('hintPanel').classList.add('hidden');
        document.getElementById('partnerCard').classList.remove('hidden');
        document.getElementById('partnerForm').classList.add('hidden');

        const cardAvatar = document.getElementById('cardAvatar');
        const cardAvatarPlaceholder = document.getElementById('cardAvatarPlaceholder');
        // Используем avatarFileId для получения URL из Google Drive
        const avatarUrl = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
        if (avatarUrl) {
            cardAvatar.src = avatarUrl;
            cardAvatar.classList.remove('hidden');
            if (cardAvatarPlaceholder) cardAvatarPlaceholder.classList.add('hidden');
        } else {
            cardAvatar.src = '';
            cardAvatar.classList.add('hidden');
            if (cardAvatarPlaceholder) cardAvatarPlaceholder.classList.remove('hidden');
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
        const isOpen = dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden');
        if (arrow) {
            if (isOpen) {
                arrow.classList.add('dropdown-arrow-open');
                arrow.classList.remove('dropdown-arrow-closed');
            } else {
                arrow.classList.add('dropdown-arrow-closed');
                arrow.classList.remove('dropdown-arrow-open');
            }
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

            document.getElementById('cardStatusDropdown').classList.add('hidden');
            const arrow = document.querySelector('#cardStatusBadge .status-dropdown-icon');
            if (arrow) {
                arrow.classList.add('dropdown-arrow-closed');
                arrow.classList.remove('dropdown-arrow-open');
            }

            this.render();
        } catch (error) {
            this.showError('Ошибка обновления статуса: ' + error.message);
        }
    },

    toggleFormStatusDropdown() {
        const dropdown = document.getElementById('formStatusDropdown');
        const arrow = document.querySelector('#formStatusBadge .status-dropdown-icon');
        const isOpen = dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden');
        if (arrow) {
            if (isOpen) {
                arrow.classList.add('dropdown-arrow-open');
                arrow.classList.remove('dropdown-arrow-closed');
            } else {
                arrow.classList.add('dropdown-arrow-closed');
                arrow.classList.remove('dropdown-arrow-open');
            }
        }
    },

    changeFormStatus(status) {
        this.formStatus = status;
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = status;
        statusText.className = 'status-badge ' + this.getStatusColor(status);

        document.getElementById('formStatusDropdown').classList.add('hidden');
        const arrow = document.querySelector('#formStatusBadge .status-dropdown-icon');
        if (arrow) {
            arrow.classList.add('dropdown-arrow-closed');
            arrow.classList.remove('dropdown-arrow-open');
        }
    },

    showAddModal() {
        this.editingPartnerId = null;
        this.selectedPartnerId = null;
        this.isTemplateMode = false;
        this.formStatus = 'Открыт';
        this.render();

        document.getElementById('hintPanel').classList.add('hidden');
        document.getElementById('partnerCard').classList.add('hidden');
        document.getElementById('partnerForm').classList.remove('hidden');

        document.getElementById('formTitle').textContent = 'Добавить партнера';
        document.getElementById('formSaveBtnText').textContent = 'Добавить партнера';
        document.getElementById('formDeleteBtn').classList.add('hidden');

        document.getElementById('formTemplateSelector').classList.remove('hidden');
        document.getElementById('templateFieldsContainer').classList.add('hidden');
        document.getElementById('formBody').classList.remove('hidden');
        document.getElementById('formCounters').classList.remove('hidden');
        document.getElementById('formCounters').classList.remove('disabled');
        document.querySelector('.form-partner-info').classList.remove('hidden');

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
            methodWrapper.classList.remove('disabled', 'pointer-events-none');
        }
        if (formAvatar) {
            formAvatar.classList.remove('disabled', 'pointer-events-none');
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
        formAvatarImg.classList.add('hidden');
        document.querySelector('.form-avatar-placeholder').classList.remove('hidden');

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

        document.getElementById('hintPanel').classList.add('hidden');
        document.getElementById('partnerCard').classList.add('hidden');
        document.getElementById('partnerForm').classList.remove('hidden');

        document.getElementById('formTitle').textContent = 'Редактировать партнера';
        document.getElementById('formSaveBtnText').textContent = 'Сохранить изменения';
        document.getElementById('formDeleteBtn').classList.remove('hidden');

        document.getElementById('formTemplateSelector').classList.add('hidden');
        document.getElementById('templateFieldsContainer').classList.add('hidden');
        document.getElementById('formBody').classList.remove('hidden');
        document.getElementById('formCounters').classList.remove('hidden');
        document.getElementById('formCounters').classList.remove('disabled');
        document.querySelector('.form-partner-info').classList.remove('hidden');

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
            methodWrapper.classList.remove('disabled', 'pointer-events-none');
        }
        if (formAvatarWrapper) {
            formAvatarWrapper.classList.remove('disabled', 'pointer-events-none');
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
            formAvatar.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            formAvatar.src = '';
            formAvatar.classList.add('hidden');
            placeholder.classList.remove('hidden');
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

        document.getElementById('templateFieldsSection').classList.add('hidden');
        document.getElementById('templateFieldsContainer').classList.add('hidden');

        document.getElementById('formBody').classList.remove('hidden');
        const formCounters = document.getElementById('formCounters');
        formCounters.classList.remove('hidden');
        formCounters.classList.remove('disabled');

        document.querySelector('.form-partner-info').classList.remove('hidden');

        this.removeDynamicFields();

        const formAvatar = document.querySelector('.form-avatar');
        const subagentInput = document.getElementById('formSubagent');
        const subagentIdInput = document.getElementById('formSubagentId');
        const methodInput = document.getElementById('formMethod');
        const formStatusBadge = document.getElementById('formStatusBadge');

        if (formAvatar) {
            formAvatar.classList.remove('hidden', 'disabled', 'pointer-events-none');
            formAvatar.classList.add('pointer-events-auto');
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
            formStatusBadge.classList.remove('hidden');
            formStatusBadge.classList.remove('disabled');
        }

        if (this.selectedPartnerId) {
            this.showPartnerCard(this.selectedPartnerId);
        } else {
            this.showHintPanel();
        }
    },

    removeDynamicFields() {
        // Remove dynamic custom fields and template fields
        const dynamicFields = document.querySelectorAll('[data-custom-field="true"], [data-template-field="true"]');
        dynamicFields.forEach(field => field.remove());
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
        }, { passive: false });

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

        // Set base size to cover the container using CSS custom properties (CSP compliant)
        cropImage.style.setProperty('--crop-width', imgWidth * scaleToFit + 'px');
        cropImage.style.setProperty('--crop-height', imgHeight * scaleToFit + 'px');
        cropImage.style.setProperty('--crop-translate-x', translateX + 'px');
        cropImage.style.setProperty('--crop-translate-y', translateY + 'px');
        cropImage.style.setProperty('--crop-scale', scale);
    },

    applyCrop() {
        // Сохраняем оригинал для загрузки в Drive
        const originalData = this.cropData.originalSrc;

        // Создаём сжатую версию для предпросмотра в UI (быстро)
        this.compressImage(originalData, 400, 0.85).then(compressedPreview => {
            const formAvatar = document.getElementById('formAvatar');
            const placeholder = document.querySelector('.form-avatar-placeholder');

            // Показываем сжатый предпросмотр в UI
            formAvatar.src = compressedPreview;
            formAvatar.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');

            // Сохраняем оригинал для отправки в Drive (в data-атрибуте)
            formAvatar.dataset.originalSrc = originalData;

            this.closeCropModal();
        });
    },

    /**
     * Сжатие изображения для оптимизации загрузки
     * @param {string} base64 - Base64 изображения
     * @param {number} maxSize - Максимальный размер стороны (px)
     * @param {number} quality - Качество JPEG (0-1)
     * @returns {Promise<string>} - Сжатый base64
     */
    compressImage(base64, maxSize = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Вычисляем новый размер с сохранением пропорций
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                // Создаём canvas и рисуем сжатое изображение
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Конвертируем в JPEG с указанным качеством
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };
            img.src = base64;
        });
    },

    /**
     * Сохранить партнера из формы (добавление или редактирование)
     *
     * @description
     * Использует Optimistic Update паттерн:
     * 1. Сохраняет текущее состояние для возможного отката
     * 2. Немедленно обновляет UI (создает temp_id для новых партнеров)
     * 3. Отправляет данные на сервер
     * 4. При успехе - обновляет temp_id на реальный
     * 5. При ошибке - откатывает изменения (rollback)
     *
     * Преимущества: UI отзывчивый, пользователь видит изменения сразу
     */
    async saveFromForm() {
        if (this.isTemplateMode) {
            this.saveTemplate();
            return;
        }

        const subagent = document.getElementById('formSubagent').value.trim();
        const subagentId = document.getElementById('formSubagentId').value.trim();
        const method = document.getElementById('formMethod').value.trim();

        // Берём оригинал из dataset (для отправки в Drive), или сжатый предпросмотр
        const formAvatarEl = document.getElementById('formAvatar');
        const avatar = formAvatarEl.dataset.originalSrc || formAvatarEl.src || '';

        const dep = parseInt(document.getElementById('formDep').value) || 0;
        const withVal = parseInt(document.getElementById('formWith').value) || 0;
        const comp = parseInt(document.getElementById('formComp').value) || 0;

        if (!subagent || !subagentId || !method) {
            Toast.warning('Пожалуйста, заполните все обязательные поля (Субагент, ID Субагента, Метод)');
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
            avatarFileId: currentAvatarFileId,
            customFields,
            // Локальные поля для UI
            dep: dep,
            with: withVal,
            comp: comp
        };

        // OPTIMISTIC UPDATE: Сохраняем состояние для отката
        const previousPartners = [...this.cachedPartners];
        const isEditing = !!this.editingPartnerId;
        const tempId = isEditing ? this.editingPartnerId : `temp_${Date.now()}`;

        // OPTIMISTIC UPDATE: Обновляем UI сразу
        if (isEditing) {
            partnerData.id = this.editingPartnerId;
            const index = this.cachedPartners.findIndex(p => p.id === this.editingPartnerId);
            if (index !== -1) {
                this.cachedPartners[index] = { ...this.cachedPartners[index], ...partnerData };
            }
            this.selectedPartnerId = this.editingPartnerId;
        } else {
            partnerData.id = tempId;
            this.cachedPartners.push(partnerData);
            this.selectedPartnerId = tempId;
        }

        this.editingPartnerId = null;
        this.syncPartnersToLocalStorage();
        this.renderColumnsMenu();
        this.render();
        this.showPartnerCard(this.selectedPartnerId);

        this.showLoading(true);

        // Индикатор загрузки аватара
        const saveBtnText = document.getElementById('formSaveBtnText');
        const originalBtnText = saveBtnText.textContent;

        try {
            // Если есть новый avatar, загружаем в Google Drive
            if (isNewAvatar) {
                // Показываем индикатор загрузки аватара
                saveBtnText.textContent = 'Загрузка аватара...';

                // Удаляем старый аватар, чтобы не было дубликатов
                if (currentAvatarFileId) {
                    try {
                        await CloudStorage.deleteImage(currentAvatarFileId);
                    } catch (e) {
                        console.error('Failed to delete old avatar:', e);
                    }
                }

                // Загружаем новый аватар (оригинал в полном качестве)
                const fileName = `partner_avatar_${tempId}_${Date.now()}.jpg`;
                const uploadResult = await CloudStorage.uploadImage('partners', fileName, avatar);
                if (uploadResult && uploadResult.fileId) {
                    partnerData.avatarFileId = uploadResult.fileId;
                }

                // Возвращаем текст кнопки
                saveBtnText.textContent = 'Сохранение...';
            }

            // Отправляем на сервер
            if (isEditing) {
                await CloudStorage.updatePartner(tempId, partnerData);

                // Обновляем avatarFileId в cachedPartners после загрузки аватара
                const index = this.cachedPartners.findIndex(p => p.id === tempId);
                if (index !== -1) {
                    this.cachedPartners[index].avatarFileId = partnerData.avatarFileId;
                }
            } else {
                const result = await CloudStorage.addPartner(partnerData);
                // Обновляем временный ID на реальный
                const index = this.cachedPartners.findIndex(p => p.id === tempId);
                if (index !== -1) {
                    this.cachedPartners[index].id = result.id;
                    this.cachedPartners[index].avatarFileId = partnerData.avatarFileId;
                }
                this.selectedPartnerId = result.id;
                this.syncPartnersToLocalStorage();
            }

            // Обновляем UI после успешного сохранения (включая новый аватар)
            this.syncPartnersToLocalStorage();
            this.render();
            if (this.selectedPartnerId) {
                this.showPartnerCard(this.selectedPartnerId);
            }

            Toast.success(isEditing ? 'Партнёр обновлён' : 'Партнёр добавлен');
        } catch (error) {
            // ROLLBACK: Откатываем изменения при ошибке
            this.cachedPartners = previousPartners;
            this.selectedPartnerId = isEditing ? tempId : null;
            this.syncPartnersToLocalStorage();
            this.renderColumnsMenu();
            this.render();
            if (this.selectedPartnerId) {
                this.showPartnerCard(this.selectedPartnerId);
            } else {
                this.showHintPanel();
            }

            this.showError('Ошибка сохранения: ' + error.message);
        } finally {
            this.showLoading(false);
            // Восстанавливаем текст кнопки
            saveBtnText.textContent = originalBtnText;
        }
    },

    async deleteFromCard() {
        if (!this.selectedPartnerId) return;

        const confirmed = await this.showConfirm('Вы уверены, что хотите удалить этого партнера?', 'Удаление партнера');
        if (!confirmed) return;

        // OPTIMISTIC UPDATE: Сохраняем состояние для отката
        const previousPartners = [...this.cachedPartners];
        const deletedId = this.selectedPartnerId;
        const partnerToDelete = this.cachedPartners.find(p => p.id === deletedId);

        // OPTIMISTIC UPDATE: Удаляем из UI сразу
        this.cachedPartners = this.cachedPartners.filter(p => p.id !== deletedId);
        this.syncPartnersToLocalStorage();
        this.selectedPartnerId = null;
        this.cleanupUnusedColumns();
        this.render();
        this.showHintPanel();

        this.showLoading(true);

        try {
            await CloudStorage.deletePartner(deletedId);

            // Удаляем аватар из Google Drive если есть
            if (partnerToDelete?.avatarFileId) {
                try {
                    await CloudStorage.deleteImage(partnerToDelete.avatarFileId);
                } catch (e) {
                    console.error('Failed to delete avatar from Drive:', e);
                }
            }

            Toast.success('Партнёр удалён');
        } catch (error) {
            // ROLLBACK: Откатываем удаление при ошибке
            this.cachedPartners = previousPartners;
            this.syncPartnersToLocalStorage();
            this.selectedPartnerId = deletedId;
            this.cleanupUnusedColumns();
            this.render();
            this.showPartnerCard(deletedId);

            this.showError('Ошибка удаления: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    async deleteFromForm() {
        if (!this.editingPartnerId) return;

        const confirmed = await this.showConfirm('Вы уверены, что хотите удалить этого партнера?', 'Удаление партнера');
        if (!confirmed) return;

        // OPTIMISTIC UPDATE: Сохраняем состояние для отката
        const previousPartners = [...this.cachedPartners];
        const deletedId = this.editingPartnerId;
        const partnerToDelete = this.cachedPartners.find(p => p.id === deletedId);

        // OPTIMISTIC UPDATE: Удаляем из UI сразу
        this.cachedPartners = this.cachedPartners.filter(p => p.id !== deletedId);
        this.syncPartnersToLocalStorage();
        this.editingPartnerId = null;
        this.selectedPartnerId = null;
        this.cleanupUnusedColumns();
        this.render();
        this.showHintPanel();

        this.showLoading(true);

        try {
            await CloudStorage.deletePartner(deletedId);

            // Удаляем аватар из Google Drive если есть
            if (partnerToDelete?.avatarFileId) {
                try {
                    await CloudStorage.deleteImage(partnerToDelete.avatarFileId);
                } catch (e) {
                    console.error('Failed to delete avatar from Drive:', e);
                }
            }

            Toast.success('Партнёр удалён');
        } catch (error) {
            // ROLLBACK: Откатываем удаление при ошибке
            this.cachedPartners = previousPartners;
            this.syncPartnersToLocalStorage();
            this.editingPartnerId = deletedId;
            this.selectedPartnerId = null;
            this.cleanupUnusedColumns();
            this.render();

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
            Toast.warning('Нет шаблонов для удаления');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для удаления:\n\n';
        templateList.forEach((template, index) => {
            optionsText += `${index + 1}. ${template.name}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = await this.showPrompt(optionsText, '', 'Удаление шаблона');

        if (!input) {
            this.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            Toast.warning('Неверный номер шаблона');
            this.restoreTemplateSelection();
            return;
        }

        const templateToDelete = templateList[index];

        const confirmed = await this.showConfirm(`Удалить шаблон "${templateToDelete.name}"?`, 'Удаление шаблона');
        if (confirmed) {
            this.showLoading(true);
            try {
                await CloudStorage.deleteTemplate(templateToDelete.id);
                if (this.currentTemplateId === templateToDelete.id) {
                    this.currentTemplateId = undefined;
                }
                delete this.cachedTemplates[templateToDelete.id];
                this.updateTemplateList();
                Toast.success('Шаблон удален!');
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
            Toast.warning('Нет шаблонов для переименования');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для переименования:\n\n';
        templateList.forEach((template, index) => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            optionsText += `${index + 1}. ${template.name}${isDefault}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = await this.showPrompt(optionsText, '', 'Переименование шаблона');

        if (!input) {
            this.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            Toast.warning('Неверный номер шаблона');
            this.restoreTemplateSelection();
            return;
        }

        const templateToRename = templateList[index];

        const newName = await this.showPrompt(`Введите новое название для шаблона "${templateToRename.name}":`, templateToRename.name, 'Переименование шаблона');

        if (!newName || !newName.trim()) {
            this.restoreTemplateSelection();
            return;
        }

        const makeDefault = await this.showConfirm('Установить этот шаблон как основной?\n(Основной шаблон будет автоматически выбран при добавлении партнера)', 'Основной шаблон');

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
            Toast.success('Шаблон обновлен!');
        } catch (error) {
            this.showError('Ошибка обновления шаблона: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    async showEditTemplateDialog() {
        const templateList = Object.values(this.cachedTemplates);

        if (templateList.length === 0) {
            Toast.warning('Нет шаблонов для редактирования');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для редактирования:\n\n';
        templateList.forEach((template, index) => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            optionsText += `${index + 1}. ${template.name}${isDefault}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = await this.showPrompt(optionsText, '', 'Редактирование полей шаблона');

        if (!input) {
            this.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            Toast.warning('Неверный номер шаблона');
            this.restoreTemplateSelection();
            return;
        }

        const templateToEdit = templateList[index];

        this.isTemplateMode = true;
        this.editingTemplateId = templateToEdit.id;
        this.showTemplateEditor(templateToEdit);
    },

    showTemplateEditor(existingTemplate = null) {
        document.getElementById('formTemplateSelector').classList.add('hidden');
        document.getElementById('formTitle').textContent = existingTemplate ? 'Редактировать шаблон' : 'Добавить шаблон';
        document.getElementById('formSaveBtnText').textContent = 'Сохранить шаблон';
        document.getElementById('formBody').classList.add('hidden');

        const formCounters = document.getElementById('formCounters');
        formCounters.classList.remove('hidden');
        formCounters.classList.add('disabled');
        document.getElementById('formDep').value = '0';
        document.getElementById('formWith').value = '0';
        document.getElementById('formComp').value = '0';

        document.querySelector('.form-partner-info').classList.remove('hidden');

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
            methodWrapper.classList.add('disabled', 'pointer-events-none');
        }

        if (formAvatar) {
            formAvatar.classList.add('disabled', 'pointer-events-none');
        }

        document.getElementById('templateFieldsSection').classList.remove('hidden');
        document.getElementById('templateFieldsContainer').classList.remove('hidden');
        document.getElementById('templateFieldsList').innerHTML = '';

        if (existingTemplate && existingTemplate.fields) {
            this.templateFields = existingTemplate.fields.map(f => ({...f}));
            existingTemplate.fields.forEach(field => {
                const fieldHtml = this.createTemplateFieldHtml(field.id, field.label, field.type);
                document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);

                // Add event listeners for this field
                const fieldRow = document.querySelector(`[data-field-id="${field.id}"]`);
                if (fieldRow) {
                    const inputField = fieldRow.querySelector('.template-field-input');
                    const selectField = fieldRow.querySelector('.template-field-type');

                    if (inputField) {
                        inputField.addEventListener('change', (e) => this.updateTemplateFieldLabel(field.id, e.target.value));
                    }
                    if (selectField) {
                        selectField.addEventListener('change', (e) => this.updateTemplateFieldType(field.id, e.target.value));
                    }
                }
            });
        } else {
            this.templateFields = [];
        }
    },

    createTemplateFieldHtml(fieldId, label = '', type = 'text') {
        return `
            <div class="template-field-row" data-field-id="${fieldId}">
                <div class="form-field">
                    <label>Название поля</label>
                    <input type="text" class="template-field-input" placeholder="Например: Telegram" value="${this.escapeHtml(label)}" data-field-id="${fieldId}">
                </div>
                <div class="form-field">
                    <label>Тип</label>
                    <select class="template-field-type" data-field-id="${fieldId}">
                        <option value="text" ${type === 'text' ? 'selected' : ''}>Текст</option>
                        <option value="email" ${type === 'email' ? 'selected' : ''}>Email</option>
                        <option value="tel" ${type === 'tel' ? 'selected' : ''}>Телефон</option>
                        <option value="date" ${type === 'date' ? 'selected' : ''}>Дата</option>
                        <option value="textarea" ${type === 'textarea' ? 'selected' : ''}>Многострочный</option>
                    </select>
                </div>
                <button class="template-field-delete" data-action="partners-removeTemplateField" data-field-id="${fieldId}" title="Удалить">
                    <img src="../shared/icons/cross.svg" width="14" height="14" alt="Удалить">
                </button>
            </div>
        `;
    },

    addTemplateField() {
        const fieldId = 'templateField_' + Date.now();

        const field = {
            id: fieldId,
            label: '',
            type: 'text'
        };

        this.templateFields.push(field);

        const fieldHtml = this.createTemplateFieldHtml(fieldId, '', 'text');
        document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);

        // Add event listeners for the new field
        const fieldRow = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (fieldRow) {
            const inputField = fieldRow.querySelector('.template-field-input');
            const selectField = fieldRow.querySelector('.template-field-type');

            if (inputField) {
                inputField.addEventListener('change', (e) => this.updateTemplateFieldLabel(fieldId, e.target.value));
                inputField.focus();
            }
            if (selectField) {
                selectField.addEventListener('change', (e) => this.updateTemplateFieldType(fieldId, e.target.value));
            }
        }
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
            Toast.warning('Все поля должны иметь название');
            return;
        }

        if (this.templateFields.length === 0) {
            Toast.warning('Добавьте хотя бы одно поле для шаблона');
            return;
        }

        const templateName = await this.showPrompt('Введите название шаблона:', this.editingTemplateId ? this.cachedTemplates[this.editingTemplateId].name : '', 'Название шаблона');
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
                formAvatar.classList.remove('disabled', 'pointer-events-none');
                formAvatar.classList.add('pointer-events-auto');
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
            formCounters.classList.remove('hidden');
            formCounters.classList.remove('disabled');

            document.querySelector('.form-partner-info').classList.remove('hidden');

            this.closeForm();
            this.updateTemplateList();

            Toast.success('Шаблон сохранен!');
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
            Toast.warning('Нет данных для экспорта');
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

        if (type === 'json') {
            document.getElementById('jsonExportSection').classList.remove('hidden');
            document.getElementById('excelExportSection').classList.add('hidden');
        } else {
            document.getElementById('jsonExportSection').classList.add('hidden');
            document.getElementById('excelExportSection').classList.remove('hidden');
        }

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
                partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : ''
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
        document.getElementById('importPreview').classList.add('hidden');
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
        document.getElementById('importPreview').classList.add('hidden');
        document.getElementById('importBtn').disabled = true;

        document.querySelectorAll('.import-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        if (type === 'json') {
            document.getElementById('jsonImportSection').classList.remove('hidden');
            document.getElementById('excelImportSection').classList.add('hidden');
        } else {
            document.getElementById('jsonImportSection').classList.add('hidden');
            document.getElementById('excelImportSection').classList.remove('hidden');
        }

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
        document.getElementById('excelImportStep1').classList.remove('hidden');
        document.getElementById('excelImportStep2').classList.add('hidden');
        document.getElementById('importPreview').classList.add('hidden');
        document.getElementById('importBtn').disabled = true;
        document.getElementById('importExcelInput').value = '';
        this.pendingImportData = null;
        this.pendingExtraColumns = null;
        // Reset Excel file label
        this.resetFileLabel(document.getElementById('excelFileLabel'), 'Выберите Excel файл', '.xlsx или .xls');
    },

    goToImportStep2() {
        document.getElementById('excelImportStep1').classList.add('hidden');
        document.getElementById('excelImportStep2').classList.remove('hidden');
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

        extraColumns.forEach((colName, index) => {
            const fieldId = 'templateField_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            const field = {
                id: fieldId,
                label: colName,
                type: 'text'
            };
            this.templateFields.push(field);

            const fieldHtml = this.createTemplateFieldHtml(fieldId, colName, 'text');
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
                    preview.classList.remove('hidden');
                    preview.innerHTML = `<strong>Найдено партнеров:</strong> ${data.data.length}<br><small>Дата экспорта: ${new Date(data.exportDate).toLocaleString('ru-RU')}</small>`;

                    document.getElementById('importBtn').disabled = false;
                } catch (err) {
                    Toast.error('Ошибка чтения файла: ' + err.message);
                    document.getElementById('importPreview').classList.add('hidden');
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
                    preview.classList.remove('hidden');

                    if (extraColumns.length > 0) {
                        const extraColsTags = extraColumns.map(c => `<span class="extra-column-tag">${this.escapeHtml(c)}</span>`).join('');
                        preview.innerHTML = `
                            <strong>Найдено партнеров:</strong> ${partners.length}<br>
                            <small>Файл: ${file.name}</small>
                            <div class="extra-columns-warning">
                                <div class="extra-columns-warning-title">Обнаружены дополнительные колонки:</div>
                                <div class="extra-columns-list">${extraColsTags}</div>
                                <div class="extra-columns-actions">
                                    <button class="btn-create-template-from-import" data-action="partners-createTemplateFromExtraColumns">
                                        Создать шаблон с этими полями
                                    </button>
                                    <button class="btn-ignore-extra-columns" data-action="partners-ignoreExtraColumns">
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
                    Toast.error('Ошибка чтения файла: ' + err.message);
                    document.getElementById('importPreview').classList.add('hidden');
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
            let message = `Импорт завершен! Добавлено: ${added}`;
            if (updated > 0) message += `, обновлено: ${updated}`;
            if (methodsAdded > 0) message += `, новых методов: ${methodsAdded}`;
            Toast.success(message);

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
                <div class="modal-dialog modal-dialog-crop">
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
                        <button class="btn btn-secondary" data-action="partners-cancelImport">Отмена</button>
                    </div>
                </div>
            `;

            document.body.appendChild(progressModal);
        }

        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        document.getElementById('importProgressStatus').textContent = status;
        const progressBar = document.getElementById('importProgressBar');
        progressBar.style.setProperty('--progress-width', percent + '%');
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
            Toast.warning('Нет партнёров');
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
            Toast.info('Дубликатов не найдено');
            return;
        }

        const confirmed = await this.showConfirm(`Найдено дубликатов: ${duplicateIds.length}\n\nУдалить их?`, 'Удаление дубликатов');
        if (!confirmed) {
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
                    // Failed to delete duplicate, continue with next
                }
            }

            this.syncPartnersToLocalStorage();
            this.render();
            Toast.success(`Удалено дубликатов: ${deleted}`);
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

// Initialize via PageLifecycle
PageLifecycle.init({
    module: 'partners',
    async onInit() {
        partnersApp.init();
    },
    modals: {
        '#importModal': () => partnersApp.closeImportDialog(),
        '#cropModal': () => partnersApp.closeCropModal()
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

    if (cardStatusBadge && cardStatusDropdown && !cardStatusBadge.contains(e.target)) {
        cardStatusDropdown.classList.add('hidden');
        const arrow = cardStatusBadge.querySelector('.status-dropdown-icon');
        if (arrow) {
            arrow.classList.add('dropdown-arrow-closed');
            arrow.classList.remove('dropdown-arrow-open');
        }
    }
    if (formStatusBadge && formStatusDropdown && !formStatusBadge.contains(e.target)) {
        formStatusDropdown.classList.add('hidden');
        const arrow = formStatusBadge.querySelector('.status-dropdown-icon');
        if (arrow) {
            arrow.classList.add('dropdown-arrow-closed');
            arrow.classList.remove('dropdown-arrow-open');
        }
    }
    if (columnsSettings && columnsMenu && !columnsSettings.contains(e.target)) {
        columnsMenu.classList.remove('active');
    }
});

// Event delegation для всех data-action="partners-*" атрибутов
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action^="partners-"]');
    if (!target) return;

    // Игнорируем file input - он обрабатывается через change event
    if (target.type === 'file') return;

    const action = target.dataset.action.replace('partners-', '');
    const value = target.dataset.value;
    const methodId = target.dataset.methodId;
    const columnId = target.dataset.columnId;
    const fieldId = target.dataset.fieldId;

    // Для status dropdown нужно остановить всплытие
    if (action.includes('changeStatus') || action.includes('changeFormStatus')) {
        e.stopPropagation();
    }

    // Для toggleColumn нужно получить columnId из data-column-id родителя
    if (action === 'toggleColumn') {
        const columnItem = target.closest('.column-item');
        if (columnItem) {
            partnersApp[action](columnItem.dataset.columnId);
        }
        return;
    }

    // Вызов соответствующего метода
    if (typeof partnersApp[action] === 'function') {
        // Передаем параметры в зависимости от того, что есть
        if (methodId !== undefined) {
            partnersApp[action](methodId);
        } else if (columnId !== undefined) {
            partnersApp[action](columnId);
        } else if (fieldId !== undefined) {
            partnersApp[action](fieldId);
        } else if (value !== undefined) {
            partnersApp[action](value);
        } else {
            partnersApp[action]();
        }
    }
});

// Event delegation для input событий
document.addEventListener('input', (e) => {
    const target = e.target.closest('[data-action^="partners-"]');
    if (!target) return;

    // Игнорируем file input - он обрабатывается через change event
    if (target.type === 'file') return;

    const action = target.dataset.action.replace('partners-', '');

    if (typeof partnersApp[action] === 'function') {
        partnersApp[action]();
    }
});

// Event delegation для change событий
document.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action^="partners-"]');
    if (!target) return;

    const action = target.dataset.action.replace('partners-', '');

    if (action === 'handleAvatarUpload') {
        partnersApp.handleAvatarUpload(e);
    } else if (typeof partnersApp[action] === 'function') {
        partnersApp[action]();
    }
});

// Event delegation для keypress событий
document.addEventListener('keypress', (e) => {
    const target = e.target.closest('[data-action^="partners-"]');
    if (!target) return;

    const action = target.dataset.action.replace('partners-', '');

    if (action === 'methodInputKeypress' && e.key === 'Enter') {
        partnersApp.addMethod();
    }
});

// Добавить метод avatarClick
partnersApp.avatarClick = function() {
    document.getElementById('formAvatarInput').click();
};
