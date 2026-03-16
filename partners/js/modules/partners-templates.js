// Partners Templates — создан через SharedTemplates factory
var PartnersTemplates = SharedTemplates.create({
    state: PartnersState,
    forms: PartnersForms,
    dropdownAction: 'partners-selectFormDropdown',

    storage: {
        getAll: function() { return PartnersState.cachedTemplates; },
        save: async function(template) {
            await CloudStorage.saveTemplate(template);
            PartnersState.cachedTemplates[template.id] = template;
        },
        delete: async function(templateId) {
            await CloudStorage.deleteTemplate(templateId);
            delete PartnersState.cachedTemplates[templateId];
        },
        rename: async function(templateId, name, makeDefault) {
            var all = PartnersState.cachedTemplates;
            if (makeDefault) {
                Object.values(all).forEach(function(t) { t.isDefault = false; });
            }
            all[templateId].name = name;
            all[templateId].isDefault = makeDefault;
            await CloudStorage.saveTemplate(all[templateId]);
        }
    },

    dialog: {
        prompt: function(message, defaultValue) {
            return PartnersUtils.showPrompt(message, defaultValue || '', 'Шаблон');
        },
        confirm: function(message) {
            return PartnersUtils.showConfirm(message, 'Шаблон');
        }
    },

    loading: {
        show: function() { PartnersUtils.showLoading(true); },
        hide: function() { PartnersUtils.showLoading(false); }
    },

    showError: function(msg) { PartnersUtils.showError(msg); },

    onReset: function() {
        PartnersForms.removeDynamicFields();
        PartnersState.currentTemplateId = '';
    },

    onShowEditor: function(self, existingTemplate) {
        document.getElementById('formTemplateSelector').classList.add('hidden');
        document.getElementById('formTitle').textContent = existingTemplate ? 'Редактировать шаблон' : 'Добавить шаблон';
        document.getElementById('formSaveBtnText').textContent = 'Сохранить шаблон';
        document.getElementById('formBody').classList.add('hidden');

        var formCounters = document.getElementById('formCounters');
        formCounters.classList.remove('hidden');
        formCounters.classList.add('disabled');
        document.getElementById('formDep').value = '0';
        document.getElementById('formWith').value = '0';
        document.getElementById('formComp').value = '0';

        document.querySelector('.form-partner-info').classList.remove('hidden');

        var subagentInput = document.getElementById('formSubagent');
        var subagentIdInput = document.getElementById('formSubagentId');
        var methodWrap = document.getElementById('formMethodWrap');
        var methodLabel = document.getElementById('formMethodLabel');
        var methodValueInput = document.getElementById('formMethodValue');
        var statusBadge = document.getElementById('formStatusBadge');
        var formAvatar = document.querySelector('.form-avatar');

        subagentInput.value = 'Субагент';
        subagentIdInput.value = 'ID Субагента';
        if (methodLabel) methodLabel.textContent = 'Метод';
        if (methodValueInput) methodValueInput.value = '';
        var methodTrigger = document.getElementById('formMethodTrigger');
        if (methodTrigger) methodTrigger.classList.add('placeholder');
        var methodMenu = document.getElementById('formMethodMenu');
        if (methodMenu) methodMenu.innerHTML = '';

        subagentInput.classList.add('disabled');
        subagentIdInput.classList.add('disabled');
        if (methodWrap) methodWrap.classList.add('disabled');
        if (statusBadge) statusBadge.classList.add('disabled');

        subagentInput.readOnly = true;
        subagentIdInput.readOnly = true;

        var methodWrapper = document.querySelector('.form-method-wrapper');
        if (methodWrapper) methodWrapper.classList.add('disabled', 'pointer-events-none');
        if (formAvatar) formAvatar.classList.add('disabled', 'pointer-events-none');

        document.getElementById('templateFieldsSection').classList.remove('hidden');
        document.getElementById('templateFieldsContainer').classList.remove('hidden');
        document.getElementById('templateFieldsList').innerHTML = '';

        if (existingTemplate && existingTemplate.fields) {
            PartnersState.templateFields = existingTemplate.fields.map(function(f) { return {id: f.id, label: f.label, type: f.type}; });
            existingTemplate.fields.forEach(function(field) {
                PartnersTemplates._addFieldWithListeners(field, self);
            });
        } else {
            PartnersState.templateFields = [];
        }
    },

    onSaveCleanup: function() {
        var formAvatar = document.querySelector('.form-avatar');
        if (formAvatar) {
            formAvatar.classList.remove('disabled', 'pointer-events-none');
            formAvatar.classList.add('pointer-events-auto');
        }

        ['formSubagent', 'formSubagentId'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.classList.remove('disabled'); el.readOnly = false; }
        });

        var methodWrap = document.getElementById('formMethodWrap');
        if (methodWrap) { methodWrap.classList.remove('disabled'); }

        var statusBadge = document.getElementById('formStatusBadge');
        if (statusBadge) statusBadge.classList.remove('disabled');

        var formCounters = document.getElementById('formCounters');
        formCounters.classList.remove('hidden', 'disabled');
        document.querySelector('.form-partner-info').classList.remove('hidden');
    },

    onApplyTemplate: function(templateId) {
        var template = PartnersState.cachedTemplates[templateId];
        if (!template || !template.fields) return;

        PartnersForms.removeDynamicFields();

        var allowedTypes = ['text', 'email', 'tel', 'date', 'textarea'];
        template.fields.forEach(function(field) {
            var safeLabel = PartnersUtils.escapeHtml(field.label);
            var safeId = PartnersUtils.escapeHtml(field.id);
            var safeType = allowedTypes.indexOf(field.type) !== -1 ? field.type : 'text';
            var fieldHtml = '<div class="form-group-inline" data-template-field="true">' +
                '<label>' + safeLabel + ':</label>' +
                (safeType === 'textarea'
                    ? '<textarea id="' + safeId + '" placeholder="' + safeLabel + '" data-field-label="' + safeLabel + '"></textarea>'
                    : '<input type="' + safeType + '" id="' + safeId + '" placeholder="' + safeLabel + '" data-field-label="' + safeLabel + '">'
                ) + '</div>';
            document.getElementById('formBody').insertAdjacentHTML('beforeend', fieldHtml);
        });
    },

    addFieldToDOM: function(field, self) {
        PartnersTemplates._addFieldWithListeners(field, self);
    }
});

// Приватный хелпер: создаёт HTML поля и навешивает слушатели
PartnersTemplates._addFieldWithListeners = function(field, self) {
    var safeLabel = PartnersUtils.escapeHtml(field.label || '');
    var safeId = PartnersUtils.escapeHtml(field.id);
    var allowedTypes = ['text', 'email', 'tel', 'date', 'textarea'];
    var safeType = allowedTypes.indexOf(field.type) !== -1 ? field.type : 'text';
    var fieldHtml = '<div class="template-field-row" data-field-id="' + safeId + '">' +
        '<div class="form-field"><label>Название поля</label>' +
        '<input type="text" class="template-field-input" placeholder="Например: Telegram" value="' + safeLabel + '" data-field-id="' + safeId + '"></div>' +
        '<div class="form-field"><label>Тип</label>' +
        '<select class="template-field-type" data-field-id="' + safeId + '">' +
        '<option value="text"' + (safeType === 'text' ? ' selected' : '') + '>Текст</option>' +
        '<option value="email"' + (safeType === 'email' ? ' selected' : '') + '>Email</option>' +
        '<option value="tel"' + (safeType === 'tel' ? ' selected' : '') + '>Телефон</option>' +
        '<option value="date"' + (safeType === 'date' ? ' selected' : '') + '>Дата</option>' +
        '<option value="textarea"' + (safeType === 'textarea' ? ' selected' : '') + '>Многострочный</option>' +
        '</select></div>' +
        '<button class="template-field-delete" data-action="partners-removeTemplateField" data-field-id="' + safeId + '" title="Удалить">' +
        '<img src="../shared/icons/cross.svg" width="14" height="14" alt="Удалить"></button></div>';

    document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);

    var fieldRow = document.querySelector('[data-field-id="' + field.id + '"]');
    if (fieldRow) {
        var inputField = fieldRow.querySelector('.template-field-input');
        var selectField = fieldRow.querySelector('.template-field-type');
        if (inputField) {
            inputField.addEventListener('change', function(e) { self.updateTemplateFieldLabel(field.id, e.target.value); });
            if (!field.label) inputField.focus();
        }
        if (selectField) {
            selectField.addEventListener('change', function(e) { self.updateTemplateFieldType(field.id, e.target.value); });
        }
    }
};

// Обратная совместимость: Partners использовал этот метод напрямую
PartnersTemplates.resetToDefaultFields = function() {
    PartnersForms.removeDynamicFields();
    PartnersState.currentTemplateId = '';
};

PartnersTemplates.createTemplateFieldHtml = function(fieldId, label, type) {
    return '<div class="template-field-row" data-field-id="' + fieldId + '">' +
        '<div class="form-field"><label>Название поля</label>' +
        '<input type="text" class="template-field-input" placeholder="Например: Telegram" value="' + PartnersUtils.escapeHtml(label || '') + '" data-field-id="' + fieldId + '"></div>' +
        '<div class="form-field"><label>Тип</label>' +
        '<select class="template-field-type" data-field-id="' + fieldId + '">' +
        '<option value="text"' + (type === 'text' ? ' selected' : '') + '>Текст</option>' +
        '<option value="email"' + (type === 'email' ? ' selected' : '') + '>Email</option>' +
        '<option value="tel"' + (type === 'tel' ? ' selected' : '') + '>Телефон</option>' +
        '<option value="date"' + (type === 'date' ? ' selected' : '') + '>Дата</option>' +
        '<option value="textarea"' + (type === 'textarea' ? ' selected' : '') + '>Многострочный</option>' +
        '</select></div>' +
        '<button class="template-field-delete" data-action="partners-removeTemplateField" data-field-id="' + fieldId + '" title="Удалить">' +
        '<img src="../shared/icons/cross.svg" width="14" height="14" alt="Удалить"></button></div>';
};
