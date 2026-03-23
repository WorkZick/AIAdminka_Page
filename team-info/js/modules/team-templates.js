// Team Templates — создан через SharedTemplates factory
var TeamTemplates = SharedTemplates.create({
    state: TeamState,
    forms: TeamForms,
    dropdownAction: 'team-selectFormDropdown',

    storage: {
        _key: 'teamInfoTemplates',
        getAll: function() {
            return JSON.parse(localStorage.getItem(this._key) || '{}');
        },
        save: async function(template) {
            var all = JSON.parse(localStorage.getItem(this._key) || '{}');
            if (!all[template.id]) template.createdAt = new Date().toISOString();
            all[template.id] = template;
            localStorage.setItem(this._key, JSON.stringify(all));
        },
        delete: async function(templateId) {
            var all = JSON.parse(localStorage.getItem(this._key) || '{}');
            delete all[templateId];
            localStorage.setItem(this._key, JSON.stringify(all));
        },
        rename: async function(templateId, name, makeDefault) {
            var all = JSON.parse(localStorage.getItem(this._key) || '{}');
            if (makeDefault) {
                Object.values(all).forEach(function(t) { t.isDefault = false; });
            }
            all[templateId].name = name;
            all[templateId].isDefault = makeDefault;
            localStorage.setItem(this._key, JSON.stringify(all));
        }
    },

    dialog: {
        prompt: function(message, defaultValue) {
            return PromptModal.show(message, {
                defaultValue: defaultValue || '',
                placeholder: 'Номер шаблона',
                confirmText: 'Выбрать'
            });
        },
        confirm: function(message) {
            return ConfirmModal.show(message, { danger: true });
        }
    },

    onShowEditor: function(self, existingTemplate) {
        document.getElementById('formTemplateSelector').classList.add('hidden');
        document.getElementById('formSaveBtnText').textContent = 'Сохранить шаблон';

        var fullNameInput = document.getElementById('formFullName');
        var positionWrap = document.getElementById('formPositionWrap');
        var positionInput = document.getElementById('formPositionValue');
        var positionLabel = document.getElementById('formPositionLabel');
        var positionTrigger = document.getElementById('formPositionTrigger');
        var statusBadge = document.getElementById('formStatusBadge');

        fullNameInput.value = 'Ф.И.О.';
        if (positionInput) positionInput.value = '';
        if (positionLabel) positionLabel.textContent = 'Выберите роль';
        if (positionTrigger) positionTrigger.classList.add('placeholder');

        fullNameInput.classList.add('disabled');
        if (positionWrap) positionWrap.classList.add('disabled');
        statusBadge.classList.add('disabled');

        fullNameInput.readOnly = true;

        var formAvatar = document.querySelector('.form-avatar');
        if (formAvatar) {
            formAvatar.classList.add('disabled');
            formAvatar.style.pointerEvents = 'none';
        }

        var formBody = document.querySelector('.form-body');
        formBody.classList.add('hidden');

        var templateFieldsContainer = document.getElementById('templateFieldsContainer');
        templateFieldsContainer.classList.remove('hidden');
        templateFieldsContainer.classList.add('visible');

        document.getElementById('templateFieldsList').innerHTML = '';

        if (existingTemplate && existingTemplate.fields) {
            TeamState.templateFields = existingTemplate.fields.map(function(f) {
                return { id: f.id, label: f.label, type: f.type };
            });
            existingTemplate.fields.forEach(function(field) {
                TeamTemplates._addTemplateFieldToDOM(field);
            });
        } else {
            TeamState.templateFields = [];
        }
    },

    onSaveCleanup: function() {
        var formAvatar = document.querySelector('.form-avatar');
        if (formAvatar) {
            formAvatar.classList.remove('disabled');
            formAvatar.style.pointerEvents = 'auto';
        }

        var fullNameInput = document.getElementById('formFullName');
        var positionWrap = document.getElementById('formPositionWrap');
        var statusBadge = document.getElementById('formStatusBadge');

        fullNameInput.classList.remove('disabled');
        if (positionWrap) positionWrap.classList.remove('disabled');
        statusBadge.classList.remove('disabled');

        fullNameInput.readOnly = false;
    },

    onApplyTemplate: function(templateId, storage) {
        var template = storage.getAll()[templateId];
        if (!template || !template.fields) return;

        // Удалить старые динамические поля
        var allGroups = document.querySelectorAll('.form-body .form-group-inline');
        allGroups.forEach(function(group) {
            var input = group.querySelector('input, textarea');
            if (input && input.id.startsWith('templateField_')) {
                group.remove();
            }
        });

        // Скрыть оставшиеся стандартные поля
        var defaultGroups = document.querySelectorAll('.form-body .form-group-inline');
        defaultGroups.forEach(function(group) {
            group.classList.add('hidden');
        });

        // Вставить поля шаблона
        var allowedTypes = ['text', 'email', 'tel', 'date', 'textarea'];
        template.fields.forEach(function(field) {
            var safeLabel = Utils.escapeHtml(field.label);
            var safeId = Utils.escapeHtml(field.id);
            var safeType = allowedTypes.indexOf(field.type) !== -1 ? field.type : 'text';
            var fieldHtml = '<div class="form-group-inline">' +
                '<label>' + safeLabel + ':</label>' +
                (safeType === 'textarea'
                    ? '<textarea id="' + safeId + '" placeholder="' + safeLabel + '"></textarea>'
                    : '<input type="' + safeType + '" id="' + safeId + '" placeholder="' + safeLabel + '">'
                ) + '</div>';
            document.querySelector('.form-body').insertAdjacentHTML('beforeend', fieldHtml);
        });
    },

    addFieldToDOM: function(field) {
        TeamTemplates._addTemplateFieldToDOM(field);
    }
});

// Приватный хелпер: добавление поля шаблона в DOM (data-action delegation)
TeamTemplates._addTemplateFieldToDOM = function(field) {
    var safeLabel = Utils.escapeHtml(field.label || '');
    var safeId = Utils.escapeHtml(field.id);
    var allowedTypes = ['text', 'email', 'tel', 'date', 'textarea'];
    var safeType = allowedTypes.indexOf(field.type) !== -1 ? field.type : 'text';
    var fieldHtml = '<div class="template-field-item" data-field-id="' + safeId + '">' +
        '<input type="text" class="template-field-input" placeholder="Название поля" value="' + safeLabel + '"' +
        ' data-action="team-updateTemplateFieldLabel" data-field-id="' + safeId + '">' +
        '<select class="template-field-type" data-action="team-updateTemplateFieldType" data-field-id="' + safeId + '">' +
        '<option value="text"' + (safeType === 'text' ? ' selected' : '') + '>Текст</option>' +
        '<option value="email"' + (safeType === 'email' ? ' selected' : '') + '>Email</option>' +
        '<option value="tel"' + (safeType === 'tel' ? ' selected' : '') + '>Телефон</option>' +
        '<option value="date"' + (safeType === 'date' ? ' selected' : '') + '>Дата</option>' +
        '<option value="textarea"' + (safeType === 'textarea' ? ' selected' : '') + '>Текстовая область</option>' +
        '</select>' +
        '<button class="template-field-remove" data-action="team-removeTemplateField" data-field-id="' + safeId + '">' +
        '<img src="../shared/icons/cross.svg" width="16" height="16" alt="Удалить"></button></div>';
    document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);
};
