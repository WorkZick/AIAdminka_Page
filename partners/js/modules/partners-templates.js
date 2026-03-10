// Partners Templates - template system
const PartnersTemplates = {
    handleTemplateChange() {
        const templateSelect = document.getElementById('templateSelect');
        const value = templateSelect.value;

        if (!value.includes('_template')) {
            PartnersState.currentTemplateId = value;
        }

        if (value === 'add_template') {
            PartnersState.isTemplateMode = true;
            PartnersTemplates.showTemplateEditor();
        } else if (value === 'delete_template') {
            PartnersTemplates.showDeleteTemplateDialog();
        } else if (value === 'rename_template') {
            PartnersTemplates.showRenameTemplateDialog();
        } else if (value === 'edit_template') {
            PartnersTemplates.showEditTemplateDialog();
        } else if (value) {
            PartnersState.currentTemplateId = value;
            PartnersTemplates.applyTemplate(value);
        } else {
            PartnersTemplates.resetToDefaultFields();
        }
    },

    resetToDefaultFields() {
        PartnersForms.removeDynamicFields();
        PartnersState.currentTemplateId = '';
    },

    restoreTemplateSelection() {
        const templateSelect = document.getElementById('templateSelect');
        if (PartnersState.currentTemplateId !== undefined) {
            templateSelect.value = PartnersState.currentTemplateId;
        } else {
            const defaultTemplate = Object.values(PartnersState.cachedTemplates).find(t => t.isDefault);
            templateSelect.value = defaultTemplate ? defaultTemplate.id : '';
        }
    },

    async showDeleteTemplateDialog() {
        const templateList = Object.values(PartnersState.cachedTemplates);

        if (templateList.length === 0) {
            Toast.warning('Нет шаблонов для удаления');
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для удаления:\n\n';
        templateList.forEach((template, index) => {
            optionsText += `${index + 1}. ${template.name}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = await PartnersUtils.showPrompt(optionsText, '', 'Удаление шаблона');

        if (!input) {
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            Toast.warning('Неверный номер шаблона');
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        const templateToDelete = templateList[index];

        const confirmed = await PartnersUtils.showConfirm(`Удалить шаблон "${templateToDelete.name}"?`, 'Удаление шаблона');
        if (confirmed) {
            PartnersUtils.showLoading(true);
            try {
                await CloudStorage.deleteTemplate(templateToDelete.id);
                if (PartnersState.currentTemplateId === templateToDelete.id) {
                    PartnersState.currentTemplateId = undefined;
                }
                delete PartnersState.cachedTemplates[templateToDelete.id];
                PartnersTemplates.updateTemplateList();
                Toast.success('Шаблон удален!');
            } catch (error) {
                PartnersUtils.showError('Ошибка удаления шаблона: ' + error.message);
            } finally {
                PartnersUtils.showLoading(false);
            }
        } else {
            PartnersTemplates.restoreTemplateSelection();
        }
    },

    async showRenameTemplateDialog() {
        const templateList = Object.values(PartnersState.cachedTemplates);

        if (templateList.length === 0) {
            Toast.warning('Нет шаблонов для переименования');
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для переименования:\n\n';
        templateList.forEach((template, index) => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            optionsText += `${index + 1}. ${template.name}${isDefault}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = await PartnersUtils.showPrompt(optionsText, '', 'Переименование шаблона');

        if (!input) {
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            Toast.warning('Неверный номер шаблона');
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        const templateToRename = templateList[index];

        const newName = await PartnersUtils.showPrompt(`Введите новое название для шаблона "${templateToRename.name}":`, templateToRename.name, 'Переименование шаблона');

        if (!newName || !newName.trim()) {
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        const makeDefault = await PartnersUtils.showConfirm('Установить этот шаблон как основной?\n(Основной шаблон будет автоматически выбран при добавлении партнера)', 'Основной шаблон');

        PartnersUtils.showLoading(true);
        try {
            if (makeDefault) {
                Object.values(PartnersState.cachedTemplates).forEach(t => {
                    t.isDefault = false;
                });
            }

            PartnersState.cachedTemplates[templateToRename.id].name = newName.trim();
            PartnersState.cachedTemplates[templateToRename.id].isDefault = makeDefault;

            await CloudStorage.saveTemplate(PartnersState.cachedTemplates[templateToRename.id]);
            PartnersTemplates.updateTemplateList();
            Toast.success('Шаблон обновлен!');
        } catch (error) {
            PartnersUtils.showError('Ошибка обновления шаблона: ' + error.message);
        } finally {
            PartnersUtils.showLoading(false);
        }
    },

    async showEditTemplateDialog() {
        const templateList = Object.values(PartnersState.cachedTemplates);

        if (templateList.length === 0) {
            Toast.warning('Нет шаблонов для редактирования');
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для редактирования:\n\n';
        templateList.forEach((template, index) => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            optionsText += `${index + 1}. ${template.name}${isDefault}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = await PartnersUtils.showPrompt(optionsText, '', 'Редактирование полей шаблона');

        if (!input) {
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            Toast.warning('Неверный номер шаблона');
            PartnersTemplates.restoreTemplateSelection();
            return;
        }

        const templateToEdit = templateList[index];

        PartnersState.isTemplateMode = true;
        PartnersState.editingTemplateId = templateToEdit.id;
        PartnersTemplates.showTemplateEditor(templateToEdit);
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
            PartnersState.templateFields = existingTemplate.fields.map(f => ({...f}));
            existingTemplate.fields.forEach(field => {
                const fieldHtml = PartnersTemplates.createTemplateFieldHtml(field.id, field.label, field.type);
                document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);

                // Add event listeners for this field
                const fieldRow = document.querySelector(`[data-field-id="${field.id}"]`);
                if (fieldRow) {
                    const inputField = fieldRow.querySelector('.template-field-input');
                    const selectField = fieldRow.querySelector('.template-field-type');

                    if (inputField) {
                        inputField.addEventListener('change', (e) => PartnersTemplates.updateTemplateFieldLabel(field.id, e.target.value));
                    }
                    if (selectField) {
                        selectField.addEventListener('change', (e) => PartnersTemplates.updateTemplateFieldType(field.id, e.target.value));
                    }
                }
            });
        } else {
            PartnersState.templateFields = [];
        }
    },

    createTemplateFieldHtml(fieldId, label = '', type = 'text') {
        return `
            <div class="template-field-row" data-field-id="${fieldId}">
                <div class="form-field">
                    <label>Название поля</label>
                    <input type="text" class="template-field-input" placeholder="Например: Telegram" value="${PartnersUtils.escapeHtml(label)}" data-field-id="${fieldId}">
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

        PartnersState.templateFields.push(field);

        const fieldHtml = PartnersTemplates.createTemplateFieldHtml(fieldId, '', 'text');
        document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);

        // Add event listeners for the new field
        const fieldRow = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (fieldRow) {
            const inputField = fieldRow.querySelector('.template-field-input');
            const selectField = fieldRow.querySelector('.template-field-type');

            if (inputField) {
                inputField.addEventListener('change', (e) => PartnersTemplates.updateTemplateFieldLabel(fieldId, e.target.value));
                inputField.focus();
            }
            if (selectField) {
                selectField.addEventListener('change', (e) => PartnersTemplates.updateTemplateFieldType(fieldId, e.target.value));
            }
        }
    },

    updateTemplateFieldLabel(fieldId, label) {
        const field = PartnersState.templateFields.find(f => f.id === fieldId);
        if (field) {
            field.label = label;
        }
    },

    updateTemplateFieldType(fieldId, type) {
        const field = PartnersState.templateFields.find(f => f.id === fieldId);
        if (field) {
            field.type = type;
        }
    },

    removeTemplateField(fieldId) {
        PartnersState.templateFields = PartnersState.templateFields.filter(f => f.id !== fieldId);
        const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (fieldElement) {
            fieldElement.remove();
        }
    },

    applyTemplate(templateId) {
        if (!templateId) return;

        const template = PartnersState.cachedTemplates[templateId];

        if (template && template.fields) {
            PartnersForms.removeDynamicFields();

            template.fields.forEach(field => {
                const fieldHtml = `
                    <div class="form-group-inline" data-template-field="true">
                        <label>${PartnersUtils.escapeHtml(field.label)}:</label>
                        ${field.type === 'textarea'
                            ? `<textarea id="${field.id}" placeholder="${PartnersUtils.escapeHtml(field.label)}" data-field-label="${PartnersUtils.escapeHtml(field.label)}"></textarea>`
                            : `<input type="${field.type}" id="${field.id}" placeholder="${PartnersUtils.escapeHtml(field.label)}" data-field-label="${PartnersUtils.escapeHtml(field.label)}">`
                        }
                    </div>
                `;

                document.getElementById('formBody').insertAdjacentHTML('beforeend', fieldHtml);
            });
        }
    },

    async saveTemplate() {
        const invalidFields = PartnersState.templateFields.filter(f => !f.label.trim());
        if (invalidFields.length > 0) {
            Toast.warning('Все поля должны иметь название');
            return;
        }

        if (PartnersState.templateFields.length === 0) {
            Toast.warning('Добавьте хотя бы одно поле для шаблона');
            return;
        }

        const templateName = await PartnersUtils.showPrompt('Введите название шаблона:', PartnersState.editingTemplateId ? PartnersState.cachedTemplates[PartnersState.editingTemplateId].name : '', 'Название шаблона');
        if (!templateName || !templateName.trim()) {
            return;
        }

        PartnersUtils.showLoading(true);

        try {
            const templateData = {
                id: PartnersState.editingTemplateId || ('template_' + Date.now()),
                name: templateName.trim(),
                fields: PartnersState.templateFields.map(f => ({
                    id: f.id,
                    label: f.label,
                    type: f.type
                })),
                isDefault: PartnersState.editingTemplateId ? PartnersState.cachedTemplates[PartnersState.editingTemplateId].isDefault : false
            };

            await CloudStorage.saveTemplate(templateData);
            PartnersState.cachedTemplates[templateData.id] = templateData;

            PartnersState.editingTemplateId = null;

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

            PartnersForms.closeForm();
            PartnersTemplates.updateTemplateList();

            Toast.success('Шаблон сохранен!');
        } catch (error) {
            PartnersUtils.showError('Ошибка сохранения шаблона: ' + error.message);
        } finally {
            PartnersUtils.showLoading(false);
        }
    },

    updateTemplateList() {
        const templateSelect = document.getElementById('templateSelect');

        templateSelect.innerHTML = '';

        const defaultTemplate = Object.values(PartnersState.cachedTemplates).find(t => t.isDefault);

        if (Object.keys(PartnersState.cachedTemplates).length === 0 || !defaultTemplate) {
            const baseOption = document.createElement('option');
            baseOption.value = '';
            baseOption.textContent = 'Шаблон';
            templateSelect.appendChild(baseOption);
        }

        Object.values(PartnersState.cachedTemplates).forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            const isDefault = template.isDefault ? ' (основной)' : '';
            option.textContent = template.name + isDefault;
            templateSelect.appendChild(option);
        });

        if (defaultTemplate) {
            templateSelect.value = defaultTemplate.id;
            PartnersState.currentTemplateId = defaultTemplate.id;
            PartnersTemplates.applyTemplate(defaultTemplate.id);
        } else {
            PartnersState.currentTemplateId = '';
        }

        const addOption = document.createElement('option');
        addOption.value = 'add_template';
        addOption.textContent = '+ Добавить шаблон';
        templateSelect.appendChild(addOption);

        if (Object.keys(PartnersState.cachedTemplates).length > 0) {
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
    }
};
