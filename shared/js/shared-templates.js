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
                const value = document.getElementById('templateSelectValue')?.value || '';

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
                let targetId;
                if (cfg.state.currentTemplateId !== undefined) {
                    targetId = cfg.state.currentTemplateId;
                } else {
                    const defaultTemplate = Object.values(cfg.storage.getAll()).find(function(t) { return t.isDefault; });
                    targetId = defaultTemplate ? defaultTemplate.id : '';
                }
                // Update hidden input
                const input = document.getElementById('templateSelectValue');
                if (input) input.value = targetId || '';
                // Update label and active state
                const menu = document.getElementById('templateSelectMenu');
                if (menu) {
                    menu.querySelectorAll('.dropdown-item').forEach(function(item) {
                        item.classList.toggle('active', (item.dataset.value || '') === (targetId || ''));
                    });
                }
                const label = document.getElementById('templateSelectLabel');
                const trigger = document.getElementById('templateSelectTrigger');
                if (targetId) {
                    const templates = cfg.storage.getAll();
                    const tmpl = templates[targetId];
                    if (label && tmpl) label.textContent = tmpl.name + (tmpl.isDefault ? ' (основной)' : '');
                    if (trigger) trigger.classList.remove('placeholder');
                } else {
                    if (label) label.textContent = 'Шаблон';
                    if (trigger) trigger.classList.add('placeholder');
                }
            },

            /**
             * Общий паттерн: показать нумерованный список шаблонов и выбрать один
             * @param {string} actionName - название действия для заголовка
             * @returns {object|null} { template, index } или null
             */
            async _pickTemplate(actionName) {
                const templateList = Object.values(cfg.storage.getAll());

                if (templateList.length === 0) {
                    Toast.warning('Нет шаблонов для ' + actionName);
                    self.restoreTemplateSelection();
                    return null;
                }

                let optionsText = 'Выберите шаблон для ' + actionName + ':\n\n';
                templateList.forEach(function(template, index) {
                    const isDefault = template.isDefault ? ' (основной)' : '';
                    optionsText += (index + 1) + '. ' + template.name + isDefault + '\n';
                });
                optionsText += '\nВведите номер шаблона:';

                const input = await cfg.dialog.prompt(optionsText, '');

                if (!input) {
                    self.restoreTemplateSelection();
                    return null;
                }

                const index = parseInt(input) - 1;

                if (isNaN(index) || index < 0 || index >= templateList.length) {
                    Toast.warning('Неверный номер шаблона');
                    self.restoreTemplateSelection();
                    return null;
                }

                return { template: templateList[index], index: index };
            },

            async showDeleteTemplateDialog() {
                const result = await self._pickTemplate('удаления');
                if (!result) return;

                const confirmed = await cfg.dialog.confirm('Удалить шаблон "' + result.template.name + '"?');
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
                const result = await self._pickTemplate('переименования');
                if (!result) return;

                const newName = await cfg.dialog.prompt(
                    'Введите новое название для шаблона "' + result.template.name + '":',
                    result.template.name
                );

                if (!newName || !newName.trim()) {
                    self.restoreTemplateSelection();
                    return;
                }

                const makeDefault = await cfg.dialog.confirm(
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
                const result = await self._pickTemplate('редактирования');
                if (!result) return;

                cfg.state.isTemplateMode = true;
                cfg.state.editingTemplateId = result.template.id;
                self.showTemplateEditor(result.template);
            },

            showTemplateEditor(existingTemplate) {
                cfg.onShowEditor(self, existingTemplate || null);
            },

            addTemplateField() {
                const fieldId = 'templateField_' + Date.now();
                const field = { id: fieldId, label: '', type: 'text' };
                cfg.state.templateFields.push(field);
                cfg.addFieldToDOM(field, self);
            },

            updateTemplateFieldLabel(fieldId, label) {
                const field = cfg.state.templateFields.find(function(f) { return f.id === fieldId; });
                if (field) field.label = label;
            },

            updateTemplateFieldType(fieldId, type) {
                const field = cfg.state.templateFields.find(function(f) { return f.id === fieldId; });
                if (field) field.type = type;
            },

            removeTemplateField(fieldId) {
                cfg.state.templateFields = cfg.state.templateFields.filter(function(f) { return f.id !== fieldId; });
                const fieldElement = document.querySelector('[data-field-id="' + fieldId + '"]');
                if (fieldElement) fieldElement.remove();
            },

            applyTemplate(templateId) {
                if (!templateId) return;
                cfg.onApplyTemplate(templateId, cfg.storage);
            },

            async saveTemplate() {
                const invalidFields = cfg.state.templateFields.filter(function(f) { return !f.label.trim(); });
                if (invalidFields.length > 0) {
                    Toast.warning('Все поля должны иметь название');
                    return;
                }

                if (cfg.state.templateFields.length === 0) {
                    Toast.warning('Добавьте хотя бы одно поле для шаблона');
                    return;
                }

                const existingName = cfg.state.editingTemplateId
                    ? (cfg.storage.getAll()[cfg.state.editingTemplateId] || {}).name || ''
                    : '';

                const templateName = await cfg.dialog.prompt('Введите название шаблона:', existingName);
                if (!templateName || !templateName.trim()) return;

                if (cfg.loading) cfg.loading.show();
                try {
                    const templateData = {
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
                const menu = document.getElementById('templateSelectMenu');
                const input = document.getElementById('templateSelectValue');
                const label = document.getElementById('templateSelectLabel');
                const trigger = document.getElementById('templateSelectTrigger');
                if (!menu) return;

                const act = cfg.dropdownAction || 'partners-selectFormDropdown';
                const templates = cfg.storage.getAll();
                const defaultTemplate = Object.values(templates).find(function(t) { return t.isDefault; });
                let html = '';

                if (Object.keys(templates).length === 0 || !defaultTemplate) {
                    html += '<div class="dropdown-item' + (!defaultTemplate ? ' active' : '') + '" data-action="' + act + '" data-value="">Шаблон</div>';
                }

                Object.values(templates).forEach(function(template) {
                    const isDefault = template.isDefault ? ' (основной)' : '';
                    const isActive = defaultTemplate && defaultTemplate.id === template.id ? ' active' : '';
                    html += '<div class="dropdown-item' + isActive + '" data-action="' + act + '" data-value="' + Utils.escapeHtml(template.id) + '">' + Utils.escapeHtml(template.name) + isDefault + '</div>';
                });

                // Action items
                html += '<div class="dropdown-item dropdown-item--action" data-action="' + act + '" data-value="add_template">+ Добавить шаблон</div>';

                if (Object.keys(templates).length > 0) {
                    html += '<div class="dropdown-item dropdown-item--action" data-action="' + act + '" data-value="edit_template">Изменить шаблон</div>';
                    html += '<div class="dropdown-item dropdown-item--action" data-action="' + act + '" data-value="rename_template">Переименовать шаблон</div>';
                    html += '<div class="dropdown-item dropdown-item--danger" data-action="' + act + '" data-value="delete_template">- Удалить шаблон</div>';
                }

                menu.innerHTML = html;

                if (defaultTemplate) {
                    if (input) input.value = defaultTemplate.id;
                    cfg.state.currentTemplateId = defaultTemplate.id;
                    if (label) label.textContent = defaultTemplate.name + (defaultTemplate.isDefault ? ' (основной)' : '');
                    if (trigger) trigger.classList.remove('placeholder');
                    self.applyTemplate(defaultTemplate.id);
                } else {
                    if (input) input.value = '';
                    cfg.state.currentTemplateId = '';
                    if (label) label.textContent = 'Шаблон';
                    if (trigger) trigger.classList.add('placeholder');
                }
            }
        };

        return self;
    }
};
