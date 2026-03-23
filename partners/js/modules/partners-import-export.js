// Partners Import/Export - export and import functionality
const PartnersImportExport = {
    showExportDialog() {
        const partners = PartnersState.getPartners();
        if (partners.length === 0) {
            Toast.warning('Нет данных для экспорта');
            return;
        }

        document.getElementById('exportModal').classList.add('active');
        PartnersState.exportType = 'json';
        PartnersState.selectedExportTemplateId = null;

        PartnersImportExport.setExportType('json');
        PartnersImportExport.populateExportTemplateSelect();

        document.getElementById('exportCount').textContent = `Партнеров для экспорта: ${partners.length}`;
    },

    closeExportDialog() {
        document.getElementById('exportModal').classList.remove('active');
    },

    setExportType(type) {
        PartnersState.exportType = type;

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
            PartnersImportExport.updateExportPreview();
        }
    },

    populateExportTemplateSelect() {
        const menu = document.getElementById('exportTemplateSelectMenu');
        const input = document.getElementById('exportTemplateSelectValue');
        const label = document.getElementById('exportTemplateSelectLabel');
        const trigger = document.getElementById('exportTemplateSelectTrigger');
        if (!menu) return;

        let html = '<div class="dropdown-item active" data-action="partners-selectFormDropdown" data-value="">Без шаблона (базовые поля)</div>';

        Object.values(PartnersState.cachedTemplates).forEach(template => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            html += '<div class="dropdown-item" data-action="partners-selectFormDropdown" data-value="' + Utils.escapeHtml(template.id) + '">' + Utils.escapeHtml(template.name) + isDefault + '</div>';
        });

        menu.innerHTML = html;

        const defaultTemplate = Object.values(PartnersState.cachedTemplates).find(t => t.isDefault);
        if (defaultTemplate) {
            if (input) input.value = defaultTemplate.id;
            if (label) label.textContent = defaultTemplate.name + (defaultTemplate.isDefault ? ' (основной)' : '');
            if (trigger) trigger.classList.remove('placeholder');
            PartnersState.selectedExportTemplateId = defaultTemplate.id;
            // Update active state
            menu.querySelectorAll('.dropdown-item').forEach(i => {
                i.classList.toggle('active', (i.dataset.value || '') === defaultTemplate.id);
            });
        }
    },

    updateExportPreview() {
        const templateId = document.getElementById('exportTemplateSelectValue')?.value || '';
        PartnersState.selectedExportTemplateId = templateId || null;

        const previewInfo = document.getElementById('exportPreviewInfo');

        let baseColumns = ['Субагент', 'ID Субагента', 'Метод', 'DEP', 'WITH', 'COMP', 'Статус', 'Фото'];
        let customColumns = [];

        if (templateId) {
            const template = PartnersState.cachedTemplates[templateId];
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
        if (PartnersState.exportType === 'json') {
            PartnersImportExport.exportAsJSON();
        } else {
            PartnersImportExport.exportAsExcel();
        }
        PartnersImportExport.closeExportDialog();
    },

    exportAsJSON() {
        const partners = PartnersState.getPartners();
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
        const partners = PartnersState.getPartners();
        const templateId = PartnersState.selectedExportTemplateId;

        const baseHeaders = ['Субагент', 'ID Субагента', 'Метод', 'DEP', 'WITH', 'COMP', 'Статус', 'Фото'];

        let templateHeaders = [];
        let templateName = 'базовый';
        if (templateId) {
            const template = PartnersState.cachedTemplates[templateId];
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
        PartnersState.pendingImportData = null;
        PartnersState.importType = 'json';
        PartnersState.selectedImportTemplateId = null;

        PartnersImportExport.setImportType('json');
        PartnersImportExport.populateImportTemplateSelect();
        PartnersImportExport.updateExcelHint();
    },

    closeImportDialog() {
        document.getElementById('importModal').classList.remove('active');
        PartnersState.pendingImportData = null;
        PartnersState.importType = 'json';
        PartnersState.selectedImportTemplateId = null;
        // Reset file labels
        PartnersUtils.resetFileLabel(document.getElementById('jsonFileLabel'), 'Выберите JSON файл', 'или перетащите сюда');
        PartnersUtils.resetFileLabel(document.getElementById('excelFileLabel'), 'Выберите Excel файл', '.xlsx или .xls');
    },

    setImportType(type) {
        PartnersState.importType = type;
        PartnersState.pendingImportData = null;
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
        PartnersUtils.resetFileLabel(document.getElementById('jsonFileLabel'), 'Выберите JSON файл', 'или перетащите сюда');
        PartnersUtils.resetFileLabel(document.getElementById('excelFileLabel'), 'Выберите Excel файл', '.xlsx или .xls');

        if (type === 'excel') {
            PartnersImportExport.goToImportStep1();
        }
    },

    goToImportStep1() {
        document.getElementById('excelImportStep1').classList.remove('hidden');
        document.getElementById('excelImportStep2').classList.add('hidden');
        document.getElementById('importPreview').classList.add('hidden');
        document.getElementById('importBtn').disabled = true;
        document.getElementById('importExcelInput').value = '';
        PartnersState.pendingImportData = null;
        PartnersState.pendingExtraColumns = null;
        // Reset Excel file label
        PartnersUtils.resetFileLabel(document.getElementById('excelFileLabel'), 'Выберите Excel файл', '.xlsx или .xls');
    },

    goToImportStep2() {
        document.getElementById('excelImportStep1').classList.add('hidden');
        document.getElementById('excelImportStep2').classList.remove('hidden');
        PartnersImportExport.updateExcelHint();
    },

    populateImportTemplateSelect() {
        const menu = document.getElementById('importTemplateSelectMenu');
        const input = document.getElementById('importTemplateSelectValue');
        const label = document.getElementById('importTemplateSelectLabel');
        const trigger = document.getElementById('importTemplateSelectTrigger');
        if (!menu) return;

        let html = '<div class="dropdown-item active" data-action="partners-selectFormDropdown" data-value="">Без шаблона (базовые поля)</div>';

        Object.values(PartnersState.cachedTemplates).forEach(template => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            html += '<div class="dropdown-item" data-action="partners-selectFormDropdown" data-value="' + Utils.escapeHtml(template.id) + '">' + Utils.escapeHtml(template.name) + isDefault + '</div>';
        });

        menu.innerHTML = html;

        const defaultTemplate = Object.values(PartnersState.cachedTemplates).find(t => t.isDefault);
        if (defaultTemplate) {
            if (input) input.value = defaultTemplate.id;
            if (label) label.textContent = defaultTemplate.name + (defaultTemplate.isDefault ? ' (основной)' : '');
            if (trigger) trigger.classList.remove('placeholder');
            PartnersState.selectedImportTemplateId = defaultTemplate.id;
            menu.querySelectorAll('.dropdown-item').forEach(i => {
                i.classList.toggle('active', (i.dataset.value || '') === defaultTemplate.id);
            });
        }
    },

    updateExcelHint() {
        const templateId = document.getElementById('importTemplateSelectValue')?.value || '';
        PartnersState.selectedImportTemplateId = templateId || null;

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
            const template = PartnersState.cachedTemplates[templateId];
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
            html += `<span class="excel-hint-column ${className}">${PartnersUtils.escapeHtml(col.name)}</span>`;
        });

        hintColumns.innerHTML = html;
    },

    downloadExcelTemplate() {
        const templateId = PartnersState.selectedImportTemplateId;

        const baseHeaders = ['Субагент', 'ID Субагента', 'Метод', 'DEP', 'WITH', 'COMP', 'Статус', 'Фото'];

        let templateHeaders = [];
        let templateName = 'базовый';
        if (templateId) {
            const template = PartnersState.cachedTemplates[templateId];
            if (template && template.fields) {
                templateHeaders = template.fields.map(f => f.label);
                templateName = String(template.name || 'custom');
            }
        }

        const allHeaders = [...baseHeaders, ...templateHeaders];

        const exampleData = [
            allHeaders,
            PartnersImportExport.generateExampleRow(allHeaders, 1),
            PartnersImportExport.generateExampleRow(allHeaders, 2)
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
                PartnersUtils.resetFileLabel(jsonLabel, 'Выберите JSON файл', 'или перетащите сюда');
                return;
            }

            // Update label to show selected file
            PartnersUtils.updateFileLabel(jsonLabel, file.name);

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    if (data.type !== 'partners-export' || !Array.isArray(data.data)) {
                        throw new Error('Неверный формат файла');
                    }

                    PartnersState.pendingImportData = data.data;

                    const preview = document.getElementById('importPreview');
                    preview.classList.remove('hidden');
                    preview.innerHTML = `<strong>Найдено партнеров:</strong> ${data.data.length}<br><small>Дата экспорта: ${new Date(data.exportDate).toLocaleString('ru-RU')}</small>`;

                    document.getElementById('importBtn').disabled = false;
                } catch (err) {
                    Toast.error('Ошибка чтения файла: ' + err.message);
                    document.getElementById('importPreview').classList.add('hidden');
                    document.getElementById('importBtn').disabled = true;
                    PartnersUtils.resetFileLabel(jsonLabel, 'Выберите JSON файл', 'или перетащите сюда');
                }
            };
            reader.readAsText(file);
        });

        const excelInput = document.getElementById('importExcelInput');
        const excelLabel = document.getElementById('excelFileLabel');

        excelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                PartnersUtils.resetFileLabel(excelLabel, 'Выберите Excel файл', '.xlsx или .xls');
                return;
            }

            // Update label to show selected file
            PartnersUtils.updateFileLabel(excelLabel, file.name);

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
                    const templateId = PartnersState.selectedImportTemplateId;
                    if (templateId) {
                        const template = PartnersState.cachedTemplates[templateId];
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

                    PartnersState.pendingImportData = partners;
                    PartnersState.pendingExtraColumns = extraColumns;

                    const preview = document.getElementById('importPreview');
                    preview.classList.remove('hidden');

                    if (extraColumns.length > 0) {
                        const extraColsTags = extraColumns.map(c => `<span class="extra-column-tag">${PartnersUtils.escapeHtml(c)}</span>`).join('');
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
                    PartnersUtils.resetFileLabel(excelLabel, 'Выберите Excel файл', '.xlsx или .xls');
                }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    openTemplateFromImport() {
        PartnersImportExport.closeImportDialog();
        PartnersForms.showAddModal();
        PartnersState.isTemplateMode = true;
        PartnersTemplates.showTemplateEditor();
    },

    createTemplateFromExtraColumns() {
        if (!PartnersState.pendingExtraColumns || PartnersState.pendingExtraColumns.length === 0) return;

        const extraColumns = [...PartnersState.pendingExtraColumns];

        PartnersImportExport.closeImportDialog();
        PartnersForms.showAddModal();
        PartnersState.isTemplateMode = true;
        PartnersTemplates.showTemplateEditor();

        extraColumns.forEach((colName, index) => {
            const fieldId = 'templateField_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            const field = {
                id: fieldId,
                label: colName,
                type: 'text'
            };
            PartnersState.templateFields.push(field);

            const fieldHtml = PartnersTemplates.createTemplateFieldHtml(fieldId, colName, 'text');
            document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);
        });
    },

    ignoreExtraColumns() {
        const warning = document.querySelector('.extra-columns-warning');
        if (warning) {
            warning.remove();
        }
        PartnersState.pendingExtraColumns = null;
    },

    /**
     * Импорт данных с фоновой синхронизацией
     * Данные сразу сохраняются локально и отображаются,
     * синхронизация с облаком происходит в фоне
     */
    async importData() {
        if (!PartnersState.pendingImportData) return;

        const total = PartnersState.pendingImportData.length;
        let added = 0;
        let updated = 0;
        let methodsAdded = 0;

        try {
            const currentData = PartnersState.getPartners();
            const createKey = (p) => `${String(p.subagent || '').toLowerCase().trim()}|${String(p.subagentId || '').toLowerCase().trim()}|${String(p.method || '').toLowerCase().trim()}`;
            const existingPartnersMap = new Map(currentData.map(p => [createKey(p), p]));

            // Собираем новые методы
            const existingMethods = PartnersState.getMethods();
            const existingMethodNames = new Set(existingMethods.map(m => m.name.toLowerCase()));
            const newMethodsToSync = [];

            for (const partner of PartnersState.pendingImportData) {
                const method = (partner.method || '').trim();
                if (method && !existingMethodNames.has(method.toLowerCase())) {
                    existingMethodNames.add(method.toLowerCase());
                    const tempId = 'temp_method_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
                    const methodData = { id: tempId, name: method, _synced: false };
                    PartnersState.cachedMethods.push(methodData);
                    newMethodsToSync.push({ tempId, data: { name: method } });
                    methodsAdded++;
                }
            }

            // Подготавливаем партнёров для локального сохранения и синхронизации
            const partnersToAdd = [];
            const partnersToUpdate = [];

            for (const partner of PartnersState.pendingImportData) {
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
                    const cacheIndex = PartnersState.cachedPartners.findIndex(p => p.id === existingPartner.id);
                    if (cacheIndex !== -1) {
                        Object.assign(PartnersState.cachedPartners[cacheIndex], updateData);
                        PartnersState.cachedPartners[cacheIndex].dep = updateData.deposits || 0;
                        PartnersState.cachedPartners[cacheIndex].with = updateData.withdrawals || 0;
                        PartnersState.cachedPartners[cacheIndex].comp = updateData.compensation || 0;
                        PartnersState.cachedPartners[cacheIndex]._synced = false;
                    }

                    partnersToUpdate.push({ id: existingPartner.id, data: updateData });
                    updated++;
                } else {
                    // Новый партнёр - создаём с временным ID
                    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
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

                    PartnersState.cachedPartners.push(partnerData);
                    existingPartnersMap.set(partnerKey, partnerData);

                    partnersToAdd.push({ tempId, data: partnerData });
                    added++;
                }
            }

            // Сохраняем в localStorage сразу
            PartnersForms.syncPartnersToLocalStorage();

            // Закрываем диалог и обновляем UI мгновенно
            PartnersImportExport.closeImportDialog();
            PartnersColumns.renderColumnsMenu();
            PartnersColumns.renderTableHeader();
            PartnersRenderer.render();

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
                    PartnersForms.loadDataFromCloud();
                };

                SyncManager.onSyncError = (errors) => {
                    console.error('Ошибки синхронизации:', errors);
                    if (errors.length > 0) {
                        PartnersUtils.showError(`Ошибки синхронизации: ${errors.length}. Проверьте консоль.`);
                    }
                };
            }

        } catch (error) {
            console.error('Ошибка импорта:', error);
            PartnersUtils.showError('Ошибка импорта: ' + error.message);
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
        PartnersState.importCancelled = true;
        PartnersImportExport.hideImportProgress();
    },

    // Remove duplicate partners
    async removeDuplicates() {
        const partners = PartnersState.getPartners();

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

        const confirmed = await PartnersUtils.showConfirm(`Найдено дубликатов: ${duplicateIds.length}\n\nУдалить их?`, 'Удаление дубликатов');
        if (!confirmed) {
            return;
        }

        PartnersUtils.showLoading(true);

        try {
            let deleted = 0;
            for (const id of duplicateIds) {
                try {
                    await CloudStorage.deletePartner(id);
                    PartnersState.cachedPartners = PartnersState.cachedPartners.filter(p => p.id !== id);
                    deleted++;
                } catch (e) {
                    // Failed to delete duplicate, continue with next
                }
            }

            PartnersForms.syncPartnersToLocalStorage();
            PartnersRenderer.render();
            Toast.success(`Удалено дубликатов: ${deleted}`);
        } catch (error) {
            PartnersUtils.showError('Ошибка удаления: ' + error.message);
        } finally {
            PartnersUtils.showLoading(false);
        }
    }
};
