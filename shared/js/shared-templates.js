/**
 * SharedTemplates Factory
 * Единая логика шаблонов для Partners и Team-Info
 *
 * cfg.state — объект состояния (currentTemplateId, isTemplateMode, editingTemplateId, templateFields)
 * cfg.storage.getAll() → {id: template}
 * cfg.storage.save(template) → Promise
 * cfg.storage.delete(templateId) → Promise
 * cfg.storage.rename(templateId, name, makeDefault) → Promise
 * cfg.dialog.prompt(message, defaultValue) → Promise<string|null>
 * cfg.dialog.confirm(message) → Promise<boolean>
 * cfg.forms.closeForm()
 * cfg.loading?.show(), cfg.loading?.hide()
 * cfg.showError?.(message)
 * cfg.onReset?.() — при выборе пустого шаблона
 * cfg.onShowEditor(self, existingTemplate) — UI редактора
 * cfg.onSaveCleanup() — восстановление UI после сохранения
 * cfg.onApplyTemplate(templateId, storage) — применение шаблона к форме
 * cfg.addFieldToDOM(field, self) — добавление поля в DOM
 */
const SharedTemplates = {
    create(cfg) {
        const self = {
            handleTemplateChange() {
                const templateSelect = document.getElementById('templateSelect');
                const value = templateSelect.value;

                if (!value.includes('_template')) {
                    cfg.state.currentTemplateId = value;
                }

                if (value === 'add_template') {
                    cfg.state.isTemplateMode = true;
                    self.showTemplateEditor();
                } else if (value === 'delete_template') {
                    self.showDeleteTemplateDialog();
                } else if (value === 'rename_template') {
                    self.showRenameTemplateDialog();
                } else if (value === 'edit_template') {
                    self.showEditTemplateDialog();
                } else if (value) {
                    cfg.state.currentTemplateId = value;
                    self.applyTemplate(value);
                } else if (cfg.onReset) {
                    cfg.onReset();
                }
            },

            restoreTemplateSelection() {
                const templateSelect = document.getElementById('templateSelect');
                if (cfg.state.currentTemplateId !== undefined) {
                    templateSelect.value = cfg.state.currentTemplateId;
                } else {
                    const defaultTemplate = Object.values(cfg.storage.getAll()).find(function(t) { return t.isDefault; });
                    templateSelect.value = defaultTemplate ? defaultTemplate.id : '';
                }
            },

            /**
             * Общий паттерн: показать нумерованный список шаблонов и выбрать один
             * @param {string} actionName - название действия для заголовка
             * @returns {object|null} { template, index } или null
             */
            async _pickTemplate(actionName) {
                var templateList = Object.values(cfg.storage.getAll());

                if (templateList.length === 0) {
                    Toast.warning('Нет шаблонов для ' + actionName);
                    self.restoreTemplateSelection();
                    return null;
                }

                var optionsText = 'Выберите шаблон для ' + actionName + ':\n\n';
                templateList.forEach(function(template, index) {
                    var isDefault = template.isDefault ? ' (основной)' : '';
                    optionsText += (index + 1) + '. ' + template.name + isDefault + '\n';
                });
                optionsText += '\nВведите номер шаблона:';

                var input = await cfg.dialog.prompt(optionsText, '');

                if (!input) {
                    self.restoreTemplateSelection();
                    return null;
                }

                var index = parseInt(input) - 1;

                if (isNaN(index) || index < 0 || index >= templateList.length) {
                    Toast.warning('Неверный номер шаблона');
                    self.restoreTemplateSelection();
                    return null;
                }

                return { template: templateList[index], index: index };
            },

            async showDeleteTemplateDialog() {
                var result = await self._pickTemplate('удаления');
                if (!result) return;

                var confirmed = await cfg.dialog.confirm('Удалить шаблон "' + result.template.name + '"?');
                if (!confirmed) {
                    self.restoreTemplateSelection();
                    return;
                }

                if (cfg.loading) cfg.loading.show();
                try {
                    if (cfg.state.currentTemplateId === result.template.id) {
                        cfg.state.currentTemplateId = undefined;
                    }
                    await cfg.storage.delete(result.template.id);
                    self.updateTemplateList();
                    Toast.success('Шаблон удален!');
                } catch (error) {
                    if (cfg.showError) cfg.showError('Ошибка удаления шаблона: ' + error.message);
                } finally {
                    if (cfg.loading) cfg.loading.hide();
                }
            },

            async showRenameTemplateDialog() {
                var result = await self._pickTemplate('переименования');
                if (!result) return;

                var newName = await cfg.dialog.prompt(
                    'Введите новое название для шаблона "' + result.template.name + '":',
                    result.template.name
                );

                if (!newName || !newName.trim()) {
                    self.restoreTemplateSelection();
                    return;
                }

                var makeDefault = await cfg.dialog.confirm(
                    'Установить этот шаблон как основной?'
                );

                if (cfg.loading) cfg.loading.show();
                try {
                    await cfg.storage.rename(result.template.id, newName.trim(), makeDefault);
                    self.updateTemplateList();
                    Toast.success('Шаблон обновлен!');
                } catch (error) {
                    if (cfg.showError) cfg.showError('Ошибка обновления шаблона: ' + error.message);
                } finally {
                    if (cfg.loading) cfg.loading.hide();
                }
            },

            async showEditTemplateDialog() {
                var result = await self._pickTemplate('редактирования');
                if (!result) return;

                cfg.state.isTemplateMode = true;
                cfg.state.editingTemplateId = result.template.id;
                self.showTemplateEditor(result.template);
            },

            showTemplateEditor(existingTemplate) {
                cfg.onShowEditor(self, existingTemplate || null);
            },

            addTemplateField() {
                var fieldId = 'templateField_' + Date.now();
                var field = { id: fieldId, label: '', type: 'text' };
                cfg.state.templateFields.push(field);
                cfg.addFieldToDOM(field, self);
            },

            updateTemplateFieldLabel(fieldId, label) {
                var field = cfg.state.templateFields.find(function(f) { return f.id === fieldId; });
                if (field) field.label = label;
            },

            updateTemplateFieldType(fieldId, type) {
                var field = cfg.state.templateFields.find(function(f) { return f.id === fieldId; });
                if (field) field.type = type;
            },

            removeTemplateField(fieldId) {
                cfg.state.templateFields = cfg.state.templateFields.filter(function(f) { return f.id !== fieldId; });
                var fieldElement = document.querySelector('[data-field-id="' + fieldId + '"]');
                if (fieldElement) fieldElement.remove();
            },

            applyTemplate(templateId) {
                if (!templateId) return;
                cfg.onApplyTemplate(templateId, cfg.storage);
            },

            async saveTemplate() {
                var invalidFields = cfg.state.templateFields.filter(function(f) { return !f.label.trim(); });
                if (invalidFields.length > 0) {
                    Toast.warning('Все поля должны иметь название');
                    return;
                }

                if (cfg.state.templateFields.length === 0) {
                    Toast.warning('Добавьте хотя бы одно поле для шаблона');
                    return;
                }

                var existingName = cfg.state.editingTemplateId
                    ? (cfg.storage.getAll()[cfg.state.editingTemplateId] || {}).name || ''
                    : '';

                var templateName = await cfg.dialog.prompt('Введите название шаблона:', existingName);
                if (!templateName || !templateName.trim()) return;

                if (cfg.loading) cfg.loading.show();
                try {
                    var templateData = {
                        id: cfg.state.editingTemplateId || ('template_' + Date.now()),
                        name: templateName.trim(),
                        fields: cfg.state.templateFields.map(function(f) {
                            return { id: f.id, label: f.label, type: f.type };
                        }),
                        isDefault: cfg.state.editingTemplateId
                            ? ((cfg.storage.getAll()[cfg.state.editingTemplateId] || {}).isDefault || false)
                            : false
                    };

                    await cfg.storage.save(templateData);
                    cfg.state.editingTemplateId = null;
                    cfg.onSaveCleanup();
                    cfg.forms.closeForm();
                    self.updateTemplateList();
                    Toast.success('Шаблон сохранен!');
                } catch (error) {
                    if (cfg.showError) cfg.showError('Ошибка сохранения шаблона: ' + error.message);
                } finally {
                    if (cfg.loading) cfg.loading.hide();
                }
            },

            updateTemplateList() {
                var templateSelect = document.getElementById('templateSelect');
                var templates = cfg.storage.getAll();

                templateSelect.innerHTML = '';

                var defaultTemplate = Object.values(templates).find(function(t) { return t.isDefault; });

                if (Object.keys(templates).length === 0 || !defaultTemplate) {
                    var baseOption = document.createElement('option');
                    baseOption.value = '';
                    baseOption.textContent = 'Шаблон';
                    templateSelect.appendChild(baseOption);
                }

                Object.values(templates).forEach(function(template) {
                    var option = document.createElement('option');
                    option.value = template.id;
                    var isDefault = template.isDefault ? ' (основной)' : '';
                    option.textContent = template.name + isDefault;
                    templateSelect.appendChild(option);
                });

                if (defaultTemplate) {
                    templateSelect.value = defaultTemplate.id;
                    cfg.state.currentTemplateId = defaultTemplate.id;
                    self.applyTemplate(defaultTemplate.id);
                } else {
                    cfg.state.currentTemplateId = '';
                }

                var addOption = document.createElement('option');
                addOption.value = 'add_template';
                addOption.textContent = '+ Добавить шаблон';
                templateSelect.appendChild(addOption);

                if (Object.keys(templates).length > 0) {
                    var editOption = document.createElement('option');
                    editOption.value = 'edit_template';
                    editOption.textContent = 'Изменить шаблон';
                    templateSelect.appendChild(editOption);

                    var renameOption = document.createElement('option');
                    renameOption.value = 'rename_template';
                    renameOption.textContent = 'Переименовать шаблон';
                    templateSelect.appendChild(renameOption);

                    var deleteOption = document.createElement('option');
                    deleteOption.value = 'delete_template';
                    deleteOption.textContent = '- Удалить шаблон';
                    templateSelect.appendChild(deleteOption);
                }
            }
        };

        return self;
    }
};
