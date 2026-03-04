/**
 * Team Templates Module
 * Система шаблонов для полей сотрудников
 */

const TeamTemplates = {
    /**
     * Обработка изменения шаблона
     */
    handleTemplateChange() {
        const templateSelect = document.getElementById('templateSelect');
        const value = templateSelect.value;

        // Сохранение текущего выбора шаблона перед действием
        if (!value.includes('_template')) {
            TeamState.currentTemplateId = value;
        }

        if (value === 'add_template') {
            TeamState.isTemplateMode = true;
            this.showTemplateEditor();
        } else if (value === 'delete_template') {
            this.showDeleteTemplateDialog();
        } else if (value === 'rename_template') {
            this.showRenameTemplateDialog();
        } else if (value === 'edit_template') {
            this.showEditTemplateDialog();
        } else if (value) {
            TeamState.currentTemplateId = value;
            this.applyTemplate(value);
        }
    },

    /**
     * Восстановление выбора шаблона
     */
    restoreTemplateSelection() {
        const templateSelect = document.getElementById('templateSelect');
        if (TeamState.currentTemplateId !== undefined) {
            templateSelect.value = TeamState.currentTemplateId;
        } else {
            // Найти и выбрать шаблон по умолчанию
            const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
            const defaultTemplate = Object.values(templates).find(t => t.isDefault);
            templateSelect.value = defaultTemplate ? defaultTemplate.id : '';
        }
    },

    /**
     * Показать диалог удаления шаблона
     */
    async showDeleteTemplateDialog() {
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
        const templateList = Object.values(templates);

        if (templateList.length === 0) {
            Toast.warning('Нет шаблонов для удаления');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для удаления:\n\n';
        templateList.forEach((template, index) => {
            optionsText += `${index + 1}. ${template.name}\n`;
        });

        const input = await PromptModal.show(optionsText, { placeholder: 'Номер шаблона', confirmText: 'Выбрать' });

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

        if (await ConfirmModal.show('Удалить шаблон "' + templateToDelete.name + '"?', { danger: true })) {
            // Если удаляем текущий шаблон, очищаем currentTemplateId
            if (TeamState.currentTemplateId === templateToDelete.id) {
                TeamState.currentTemplateId = undefined;
            }
            delete templates[templateToDelete.id];
            localStorage.setItem('teamInfoTemplates', JSON.stringify(templates));
            this.updateTemplateList();
            Toast.success('Шаблон удален!');
        } else {
            this.restoreTemplateSelection();
        }
    },

    /**
     * Показать диалог переименования шаблона
     */
    async showRenameTemplateDialog() {
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
        const templateList = Object.values(templates);

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

        const input = await PromptModal.show(optionsText, { placeholder: 'Номер шаблона', confirmText: 'Выбрать' });

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

        const newName = await PromptModal.show(`Введите новое название для шаблона "${templateToRename.name}":`, { defaultValue: templateToRename.name });

        if (!newName || !newName.trim()) {
            this.restoreTemplateSelection();
            return;
        }

        const makeDefault = await ConfirmModal.show('Установить этот шаблон как основной?', { description: 'Основной шаблон будет автоматически выбран при добавлении сотрудника', confirmText: 'Да' });

        // Удалить флаг default у всех шаблонов
        if (makeDefault) {
            Object.values(templates).forEach(t => {
                t.isDefault = false;
            });
        }

        templates[templateToRename.id].name = newName.trim();
        templates[templateToRename.id].isDefault = makeDefault;

        localStorage.setItem('teamInfoTemplates', JSON.stringify(templates));
        this.updateTemplateList();
        Toast.success('Шаблон обновлен!');
    },

    /**
     * Показать диалог редактирования шаблона
     */
    async showEditTemplateDialog() {
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
        const templateList = Object.values(templates);

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

        const input = await PromptModal.show(optionsText, { placeholder: 'Номер шаблона', confirmText: 'Выбрать' });

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

        // Войти в режим редактирования шаблона
        TeamState.isTemplateMode = true;
        TeamState.editingTemplateId = templateToEdit.id;
        this.showTemplateEditor(templateToEdit);
    },

    /**
     * Показать редактор шаблона
     * @param {object|null} existingTemplate - Существующий шаблон для редактирования
     */
    showTemplateEditor(existingTemplate = null) {
        // Скрыть селектор шаблона
        const templateSelector = document.getElementById('formTemplateSelector');
        templateSelector.classList.add('hidden');

        // Изменить текст кнопки
        document.getElementById('formSaveBtnText').textContent = 'Сохранить шаблон';

        // Очистить и отключить поля формы
        const fullNameInput = document.getElementById('formFullName');
        const positionInput = document.getElementById('formPosition');
        const statusBadge = document.getElementById('formStatusBadge');

        fullNameInput.value = 'Ф.И.О.';
        positionInput.value = '';

        fullNameInput.classList.add('disabled');
        positionInput.classList.add('disabled');
        statusBadge.classList.add('disabled');

        fullNameInput.readOnly = true;
        positionInput.disabled = true;

        // Отключить загрузку аватара
        const formAvatar = document.querySelector('.form-avatar');
        if (formAvatar) {
            formAvatar.classList.add('disabled');
            formAvatar.style.pointerEvents = 'none';
        }

        // Скрыть все стандартные поля формы
        const formBody = document.querySelector('.form-body');
        formBody.classList.add('hidden');

        // Показать контейнер полей шаблона
        const templateFieldsContainer = document.getElementById('templateFieldsContainer');
        templateFieldsContainer.classList.remove('hidden');
        templateFieldsContainer.classList.add('visible');

        // Очистить список полей шаблона
        document.getElementById('templateFieldsList').innerHTML = '';

        // Загрузить существующие поля шаблона или инициализировать пустым
        if (existingTemplate && existingTemplate.fields) {
            TeamState.templateFields = existingTemplate.fields.map(f => ({...f}));
            existingTemplate.fields.forEach(field => {
                this._addTemplateFieldToDOM(field);
            });
        } else {
            TeamState.templateFields = [];
        }
    },

    /**
     * Добавить новое поле шаблона
     */
    addTemplateField() {
        const fieldId = 'templateField_' + Date.now();

        const field = {
            id: fieldId,
            label: '',
            type: 'text'
        };

        TeamState.templateFields.push(field);
        this._addTemplateFieldToDOM(field);
    },

    /**
     * Обновить label поля шаблона
     * @param {string} fieldId - ID поля
     * @param {string} label - Новый label
     */
    updateTemplateFieldLabel(fieldId, label) {
        const field = TeamState.templateFields.find(f => f.id === fieldId);
        if (field) {
            field.label = label;
        }
    },

    /**
     * Обновить тип поля шаблона
     * @param {string} fieldId - ID поля
     * @param {string} type - Новый тип
     */
    updateTemplateFieldType(fieldId, type) {
        const field = TeamState.templateFields.find(f => f.id === fieldId);
        if (field) {
            field.type = type;
        }
    },

    /**
     * Удалить поле шаблона
     * @param {string} fieldId - ID поля
     */
    removeTemplateField(fieldId) {
        TeamState.templateFields = TeamState.templateFields.filter(f => f.id !== fieldId);
        const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (fieldElement) {
            fieldElement.remove();
        }
    },

    /**
     * Применить шаблон к форме
     * @param {string} templateId - ID шаблона
     */
    applyTemplate(templateId) {
        if (!templateId) return;

        // Получить шаблоны из localStorage
        const savedTemplates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
        const template = savedTemplates[templateId];

        if (template && template.fields) {
            // Сначала удалить все ранее добавленные динамические поля шаблона
            const allGroups = document.querySelectorAll('.form-body .form-group-inline');
            allGroups.forEach(group => {
                const input = group.querySelector('input, textarea');
                if (input && input.id.startsWith('templateField_')) {
                    group.remove();
                }
            });

            // Затем скрыть все оставшиеся стандартные поля формы
            const defaultGroups = document.querySelectorAll('.form-body .form-group-inline');
            defaultGroups.forEach(group => {
                group.classList.add('hidden');
            });

            // Наконец, создать динамические поля из шаблона
            template.fields.forEach(field => {
                const group = document.createElement('div');
                group.className = 'form-group-inline';

                const label = document.createElement('label');
                label.textContent = field.label + ':';

                const input = field.type === 'textarea'
                    ? document.createElement('textarea')
                    : document.createElement('input');
                input.id = field.id;
                input.placeholder = field.label;
                if (field.type !== 'textarea') input.type = field.type;

                group.appendChild(label);
                group.appendChild(input);
                document.querySelector('.form-body').appendChild(group);
            });
        }
    },

    /**
     * Сохранить шаблон
     */
    async saveTemplate() {
        // Валидация: все поля должны иметь labels
        const invalidFields = TeamState.templateFields.filter(f => !f.label.trim());
        if (invalidFields.length > 0) {
            Toast.warning('Все поля должны иметь название');
            return;
        }

        if (TeamState.templateFields.length === 0) {
            Toast.warning('Добавьте хотя бы одно поле для шаблона');
            return;
        }

        // Получить шаблоны из localStorage
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');

        if (TeamState.editingTemplateId) {
            // Редактирование существующего шаблона
            const template = templates[TeamState.editingTemplateId];
            const templateName = await PromptModal.show('Введите название шаблона:', { defaultValue: template.name });
            if (!templateName || !templateName.trim()) {
                TeamState.editingTemplateId = null;
                return;
            }

            templates[TeamState.editingTemplateId].name = templateName.trim();
            templates[TeamState.editingTemplateId].fields = TeamState.templateFields.map(f => ({
                id: f.id,
                label: f.label,
                type: f.type
            }));
        } else {
            // Создание нового шаблона
            const templateName = await PromptModal.show('Введите название шаблона:');
            if (!templateName || !templateName.trim()) return;

            const templateId = 'template_' + Date.now();
            templates[templateId] = {
                id: templateId,
                name: templateName.trim(),
                fields: TeamState.templateFields.map(f => ({
                    id: f.id,
                    label: f.label,
                    type: f.type
                })),
                createdAt: new Date().toISOString()
            };
        }

        localStorage.setItem('teamInfoTemplates', JSON.stringify(templates));

        // Сброс режима редактирования
        TeamState.editingTemplateId = null;

        // Включить обратно аватар и поля
        const formAvatar = document.querySelector('.form-avatar');
        if (formAvatar) {
            formAvatar.classList.remove('disabled');
            formAvatar.style.pointerEvents = 'auto';
        }

        const fullNameInput = document.getElementById('formFullName');
        const positionInput = document.getElementById('formPosition');
        const statusBadge = document.getElementById('formStatusBadge');

        fullNameInput.classList.remove('disabled');
        positionInput.classList.remove('disabled');
        statusBadge.classList.remove('disabled');

        fullNameInput.readOnly = false;
        positionInput.disabled = false;

        // Закрыть форму и обновить список шаблонов
        TeamForms.closeForm();
        this.updateTemplateList();

        Toast.success('Шаблон сохранен!');
    },

    /**
     * Обновить список шаблонов в select
     */
    updateTemplateList() {
        const templateSelect = document.getElementById('templateSelect');
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');

        // Очистить все опции
        templateSelect.innerHTML = '';

        // Найти шаблон по умолчанию
        const defaultTemplate = Object.values(templates).find(t => t.isDefault);

        // Добавить базовую опцию "Шаблон" только если нет шаблонов или нет шаблона по умолчанию
        if (Object.keys(templates).length === 0 || !defaultTemplate) {
            const baseOption = document.createElement('option');
            baseOption.value = '';
            baseOption.textContent = 'Шаблон';
            templateSelect.appendChild(baseOption);
        }

        Object.values(templates).forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            const isDefault = template.isDefault ? ' (основной)' : '';
            option.textContent = template.name + isDefault;
            templateSelect.appendChild(option);
        });

        // Автовыбор и применение шаблона по умолчанию если существует
        if (defaultTemplate) {
            templateSelect.value = defaultTemplate.id;
            TeamState.currentTemplateId = defaultTemplate.id;
            // Автоматически применить шаблон по умолчанию
            this.applyTemplate(defaultTemplate.id);
        } else {
            TeamState.currentTemplateId = '';
        }

        const addOption = document.createElement('option');
        addOption.value = 'add_template';
        addOption.textContent = '+ Добавить шаблон';
        templateSelect.appendChild(addOption);

        if (Object.keys(templates).length > 0) {
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

    // ========== Приватные методы ==========

    /**
     * Добавить поле шаблона в DOM
     * @private
     */
    _addTemplateFieldToDOM(field) {
        const wrapper = document.createElement('div');
        wrapper.className = 'template-field-item';
        wrapper.dataset.fieldId = field.id;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'template-field-input';
        input.placeholder = 'Название поля';
        input.value = field.label || '';
        input.dataset.action = 'team-updateTemplateFieldLabel';
        input.dataset.fieldId = field.id;

        const select = document.createElement('select');
        select.className = 'template-field-type';
        select.dataset.action = 'team-updateTemplateFieldType';
        select.dataset.fieldId = field.id;

        const typeOptions = [
            { value: 'text', text: 'Текст' },
            { value: 'email', text: 'Email' },
            { value: 'tel', text: 'Телефон' },
            { value: 'date', text: 'Дата' },
            { value: 'textarea', text: 'Текстовая область' }
        ];
        typeOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            if (field.type === opt.value) option.selected = true;
            select.appendChild(option);
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'template-field-remove';
        removeBtn.dataset.action = 'team-removeTemplateField';
        removeBtn.dataset.fieldId = field.id;

        const removeIcon = document.createElement('img');
        removeIcon.src = '../shared/icons/cross.svg';
        removeIcon.width = 16;
        removeIcon.height = 16;
        removeIcon.alt = 'Удалить';
        removeBtn.appendChild(removeIcon);

        wrapper.appendChild(input);
        wrapper.appendChild(select);
        wrapper.appendChild(removeBtn);

        document.getElementById('templateFieldsList').appendChild(wrapper);
    }
};
