import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../team-info/js/modules/team-templates.js'),
    'utf-8'
);

// ─────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────

/**
 * Build a fresh TeamTemplates instance with all dependencies mocked.
 *
 * @param {object} overrides - Optional overrides for mocked dependencies.
 * @returns {{ module, mocks }} - The loaded module and its mock bag.
 */
function buildTeamTemplates(overrides = {}) {
    // ── TeamState mock ──────────────────────────────────────────────────────
    const TeamState = {
        currentTemplateId: undefined,
        isTemplateMode: false,
        editingTemplateId: null,
        templateFields: [],
        ...overrides.teamState
    };

    // ── Toast mock ──────────────────────────────────────────────────────────
    const Toast = {
        warning: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        ...overrides.toast
    };

    // ── PromptModal mock ────────────────────────────────────────────────────
    const PromptModal = {
        show: vi.fn().mockResolvedValue(null),
        ...overrides.promptModal
    };

    // ── ConfirmModal mock ───────────────────────────────────────────────────
    const ConfirmModal = {
        show: vi.fn().mockResolvedValue(false),
        ...overrides.confirmModal
    };

    // ── localStorage mock ───────────────────────────────────────────────────
    const store = {};
    const localStorage = {
        getItem: vi.fn((key) => store[key] ?? null),
        setItem: vi.fn((key, value) => { store[key] = value; }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
        _store: store,
        ...overrides.localStorage
    };

    // ── Minimal DOM helpers ─────────────────────────────────────────────────
    // We use global document (jsdom) but we supply localStorage separately
    // because jsdom's localStorage is cleared per-test via the mock.

    // ── TeamStorage stub (not used by tested methods, but prevents ReferenceError)
    const TeamStorage = { save: vi.fn(), load: vi.fn() };

    // ── TeamForms stub ──────────────────────────────────────────────────────
    const TeamForms = { closeForm: vi.fn() };

    const fn = new Function(
        'TeamState', 'TeamStorage', 'Toast', 'PromptModal', 'ConfirmModal',
        'TeamForms', 'localStorage', 'document',
        `${code}\nreturn TeamTemplates;`
    );

    const module = fn(
        TeamState, TeamStorage, Toast, PromptModal, ConfirmModal,
        TeamForms, localStorage, document
    );

    return { module, TeamState, Toast, PromptModal, ConfirmModal, TeamForms, localStorage };
}

// ─────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────

function setupMinimalTemplateDOM() {
    document.body.innerHTML = `
        <select id="templateSelect"></select>
        <div id="formTemplateSelector"></div>
        <span id="formSaveBtnText"></span>
        <input id="formFullName" />
        <input id="formPosition" />
        <span id="formStatusBadge"></span>
        <div class="form-avatar"></div>
        <div class="form-body"></div>
        <div id="templateFieldsContainer" class="hidden"></div>
        <div id="templateFieldsList"></div>
    `;
}

// ─────────────────────────────────────────────
// loadTemplates / localStorage
// ─────────────────────────────────────────────

describe('TeamTemplates — loadTemplates (via updateTemplateList)', () => {
    beforeEach(() => {
        setupMinimalTemplateDOM();
    });

    it('should render base "Шаблон" option when localStorage is empty', () => {
        const { module } = buildTeamTemplates();

        module.updateTemplateList();

        const opts = document.getElementById('templateSelect').querySelectorAll('option');
        const values = Array.from(opts).map(o => o.value);
        expect(values).toContain('');
        expect(values).toContain('add_template');
    });

    it('should render template options from localStorage', () => {
        const templates = {
            t1: { id: 't1', name: 'Основной', isDefault: false, fields: [] }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.updateTemplateList();

        const opts = document.getElementById('templateSelect').querySelectorAll('option');
        const values = Array.from(opts).map(o => o.value);
        expect(values).toContain('t1');
    });

    it('should auto-select and apply the default template', () => {
        const templates = {
            t2: { id: 't2', name: 'Дефолтный', isDefault: true, fields: [] }
        };
        const { module, localStorage, TeamState } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.updateTemplateList();

        expect(document.getElementById('templateSelect').value).toBe('t2');
        expect(TeamState.currentTemplateId).toBe('t2');
    });

    it('should show edit/rename/delete options when templates exist', () => {
        const templates = {
            t3: { id: 't3', name: 'Тест', isDefault: false, fields: [] }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.updateTemplateList();

        const values = Array.from(
            document.getElementById('templateSelect').querySelectorAll('option')
        ).map(o => o.value);

        expect(values).toContain('edit_template');
        expect(values).toContain('rename_template');
        expect(values).toContain('delete_template');
    });

    it('should NOT show edit/rename/delete options when no templates exist', () => {
        const { module } = buildTeamTemplates();

        module.updateTemplateList();

        const values = Array.from(
            document.getElementById('templateSelect').querySelectorAll('option')
        ).map(o => o.value);

        expect(values).not.toContain('edit_template');
        expect(values).not.toContain('delete_template');
    });
});

// ─────────────────────────────────────────────
// saveTemplate
// ─────────────────────────────────────────────

describe('TeamTemplates — saveTemplate', () => {
    beforeEach(() => {
        setupMinimalTemplateDOM();
    });

    it('should show warning when all fields are empty labels', async () => {
        const { module, TeamState, Toast } = buildTeamTemplates();
        TeamState.templateFields = [{ id: 'f1', label: '', type: 'text' }];

        await module.saveTemplate();

        expect(Toast.warning).toHaveBeenCalledWith('Все поля должны иметь название');
    });

    it('should show warning when templateFields array is empty', async () => {
        const { module, TeamState, Toast } = buildTeamTemplates();
        TeamState.templateFields = [];

        await module.saveTemplate();

        expect(Toast.warning).toHaveBeenCalledWith('Добавьте хотя бы одно поле для шаблона');
    });

    it('should persist a new template to localStorage when name provided', async () => {
        const { module, TeamState, Toast, PromptModal, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue('Мой шаблон') }
        });
        TeamState.templateFields = [{ id: 'f1', label: 'Телефон', type: 'tel' }];
        TeamState.editingTemplateId = null;

        await module.saveTemplate();

        expect(Toast.success).toHaveBeenCalledWith('Шаблон сохранен!');
        const saved = JSON.parse(localStorage._store['teamInfoTemplates']);
        const names = Object.values(saved).map(t => t.name);
        expect(names).toContain('Мой шаблон');
    });

    it('should NOT persist when user cancels name prompt', async () => {
        const { module, TeamState, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue(null) }
        });
        TeamState.templateFields = [{ id: 'f1', label: 'Email', type: 'email' }];
        TeamState.editingTemplateId = null;

        await module.saveTemplate();

        expect(localStorage._store['teamInfoTemplates']).toBeUndefined();
    });

    it('should update existing template when editingTemplateId is set', async () => {
        const templates = {
            existing1: { id: 'existing1', name: 'Старое название', fields: [] }
        };
        const { module, TeamState, Toast, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue('Новое название') }
        });
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);
        TeamState.templateFields = [{ id: 'f1', label: 'Отдел', type: 'text' }];
        TeamState.editingTemplateId = 'existing1';

        await module.saveTemplate();

        expect(Toast.success).toHaveBeenCalledWith('Шаблон сохранен!');
        const saved = JSON.parse(localStorage._store['teamInfoTemplates']);
        expect(saved['existing1'].name).toBe('Новое название');
        expect(saved['existing1'].fields[0].label).toBe('Отдел');
    });

    it('should save correct field types (email, tel, date, textarea)', async () => {
        const { module, TeamState, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue('Шаблон с типами') }
        });
        TeamState.templateFields = [
            { id: 'f1', label: 'Email', type: 'email' },
            { id: 'f2', label: 'Телефон', type: 'tel' },
            { id: 'f3', label: 'Дата', type: 'date' },
            { id: 'f4', label: 'Описание', type: 'textarea' }
        ];
        TeamState.editingTemplateId = null;

        await module.saveTemplate();

        const saved = JSON.parse(localStorage._store['teamInfoTemplates']);
        const template = Object.values(saved)[0];
        const types = template.fields.map(f => f.type);
        expect(types).toEqual(['email', 'tel', 'date', 'textarea']);
    });
});

// ─────────────────────────────────────────────
// deleteTemplate (via showDeleteTemplateDialog)
// ─────────────────────────────────────────────

describe('TeamTemplates — deleteTemplate', () => {
    beforeEach(() => {
        setupMinimalTemplateDOM();
    });

    it('should warn when no templates exist', async () => {
        const { module, Toast } = buildTeamTemplates();

        await module.showDeleteTemplateDialog();

        expect(Toast.warning).toHaveBeenCalledWith('Нет шаблонов для удаления');
    });

    it('should delete selected template from localStorage', async () => {
        const templates = {
            t1: { id: 't1', name: 'Alpha', fields: [] },
            t2: { id: 't2', name: 'Beta', fields: [] }
        };
        const { module, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue('1') },
            confirmModal: { show: vi.fn().mockResolvedValue(true) }
        });
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        await module.showDeleteTemplateDialog();

        const saved = JSON.parse(localStorage._store['teamInfoTemplates']);
        expect(Object.keys(saved)).not.toContain('t1');
        expect(Object.keys(saved)).toContain('t2');
    });

    it('should show success toast after deletion', async () => {
        const templates = { t1: { id: 't1', name: 'ToDelete', fields: [] } };
        const { module, Toast, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue('1') },
            confirmModal: { show: vi.fn().mockResolvedValue(true) }
        });
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        await module.showDeleteTemplateDialog();

        expect(Toast.success).toHaveBeenCalledWith('Шаблон удален!');
    });

    it('should warn on invalid number input', async () => {
        const templates = { t1: { id: 't1', name: 'X', fields: [] } };
        const { module, Toast, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue('999') }
        });
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        await module.showDeleteTemplateDialog();

        expect(Toast.warning).toHaveBeenCalledWith('Неверный номер шаблона');
    });

    it('should warn on non-numeric input', async () => {
        const templates = { t1: { id: 't1', name: 'X', fields: [] } };
        const { module, Toast, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue('abc') }
        });
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        await module.showDeleteTemplateDialog();

        expect(Toast.warning).toHaveBeenCalledWith('Неверный номер шаблона');
    });

    it('should clear currentTemplateId when deleting current template', async () => {
        const templates = { t1: { id: 't1', name: 'Current', fields: [] } };
        const { module, TeamState, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue('1') },
            confirmModal: { show: vi.fn().mockResolvedValue(true) },
            teamState: { currentTemplateId: 't1', templateFields: [] }
        });
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        await module.showDeleteTemplateDialog();

        expect(TeamState.currentTemplateId).toBeFalsy();
    });

    it('should NOT delete if user cancels confirm dialog', async () => {
        const templates = { t1: { id: 't1', name: 'Keep', fields: [] } };
        const { module, localStorage } = buildTeamTemplates({
            promptModal: { show: vi.fn().mockResolvedValue('1') },
            confirmModal: { show: vi.fn().mockResolvedValue(false) }
        });
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        await module.showDeleteTemplateDialog();

        const saved = JSON.parse(localStorage._store['teamInfoTemplates']);
        expect(Object.keys(saved)).toContain('t1');
    });
});

// ─────────────────────────────────────────────
// applyTemplate — XSS safety (DOM API, not innerHTML)
// ─────────────────────────────────────────────

describe('TeamTemplates — applyTemplate (XSS safety)', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="form-body">
                <div class="form-group-inline"><label>Имя</label><input id="formFullName" /></div>
            </div>
        `;
    });

    it('should do nothing when templateId is empty string', () => {
        const { module } = buildTeamTemplates();
        // Should not throw
        expect(() => module.applyTemplate('')).not.toThrow();
        expect(() => module.applyTemplate(null)).not.toThrow();
    });

    it('should create input element with textContent label (not innerHTML)', () => {
        const xssLabel = '<img src=x onerror=alert(1)>';
        const templates = {
            xss1: {
                id: 'xss1',
                name: 'XSS Test',
                fields: [{ id: 'templateField_xss', label: xssLabel, type: 'text' }]
            }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.applyTemplate('xss1');

        // The label element should contain the raw string as text, not parsed HTML
        const labels = document.querySelectorAll('.form-body label');
        expect(labels.length).toBeGreaterThan(0);
        const labelEl = labels[labels.length - 1];
        expect(labelEl.textContent).toContain('<img');
        // The img tag must NOT be an actual element inside the label
        expect(labelEl.querySelector('img')).toBeNull();
    });

    it('should create textarea element for type "textarea"', () => {
        const templates = {
            tmpl1: {
                id: 'tmpl1',
                name: 'T',
                fields: [{ id: 'templateField_1', label: 'Описание', type: 'textarea' }]
            }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.applyTemplate('tmpl1');

        const textarea = document.querySelector('#templateField_1');
        expect(textarea).not.toBeNull();
        expect(textarea.tagName.toLowerCase()).toBe('textarea');
    });

    it('should create input[type=email] for email fields', () => {
        const templates = {
            tmpl2: {
                id: 'tmpl2',
                name: 'T',
                fields: [{ id: 'templateField_email1', label: 'Email', type: 'email' }]
            }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.applyTemplate('tmpl2');

        const input = document.querySelector('#templateField_email1');
        expect(input).not.toBeNull();
        expect(input.type).toBe('email');
    });

    it('should hide existing form-group-inline elements after applying template', () => {
        const templates = {
            tmpl3: {
                id: 'tmpl3',
                name: 'T',
                fields: [{ id: 'templateField_3', label: 'Отдел', type: 'text' }]
            }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.applyTemplate('tmpl3');

        const origGroup = document.querySelector('.form-body .form-group-inline input#formFullName');
        expect(origGroup).not.toBeNull();
        const origGroupParent = origGroup.closest('.form-group-inline');
        expect(origGroupParent.classList.contains('hidden')).toBe(true);
    });

    it('should remove previous templateField_ groups before adding new ones', () => {
        const templates = {
            tmpl4: {
                id: 'tmpl4',
                name: 'T',
                fields: [{ id: 'templateField_old', label: 'Старое', type: 'text' }]
            },
            tmpl5: {
                id: 'tmpl5',
                name: 'T2',
                fields: [{ id: 'templateField_new', label: 'Новое', type: 'text' }]
            }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.applyTemplate('tmpl4');
        module.applyTemplate('tmpl5');

        // Old field must no longer exist
        expect(document.querySelector('#templateField_old')).toBeNull();
        // New field must exist
        expect(document.querySelector('#templateField_new')).not.toBeNull();
    });

    it('should set placeholder using element property (not HTML attribute manipulation)', () => {
        const xssPlaceholder = '"><script>alert(1)<\/script>';
        const templates = {
            xss2: {
                id: 'xss2',
                name: 'XSS Placeholder',
                fields: [{ id: 'templateField_p1', label: xssPlaceholder, type: 'text' }]
            }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.applyTemplate('xss2');

        const input = document.querySelector('#templateField_p1');
        expect(input).not.toBeNull();
        // Placeholder must be the literal string, not parsed
        expect(input.placeholder).toBe(xssPlaceholder);
        // No script tags should be injected into document
        expect(document.querySelectorAll('script').length).toBe(0);
    });
});

// ─────────────────────────────────────────────
// _addTemplateFieldToDOM — XSS safety
// ─────────────────────────────────────────────

describe('TeamTemplates — _addTemplateFieldToDOM (XSS safety)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="templateFieldsList"></div>`;
    });

    it('should append a wrapper with correct data-field-id attribute', () => {
        const { module } = buildTeamTemplates();

        module._addTemplateFieldToDOM({ id: 'myField', label: 'Тест', type: 'text' });

        const wrapper = document.querySelector('[data-field-id="myField"]');
        expect(wrapper).not.toBeNull();
        expect(wrapper.className).toBe('template-field-item');
    });

    it('should NOT inject HTML when label contains XSS payload', () => {
        const { module } = buildTeamTemplates();
        const xssValue = '<script>window.__xss=true<\/script>';

        module._addTemplateFieldToDOM({ id: 'xssField', label: xssValue, type: 'text' });

        const input = document.querySelector('[data-field-id="xssField"] input');
        expect(input).not.toBeNull();
        // value must be literal string
        expect(input.value).toBe(xssValue);
        // No script tags should appear
        expect(document.querySelectorAll('script').length).toBe(0);
    });

    it('should pre-select the correct type in the select element', () => {
        const { module } = buildTeamTemplates();

        module._addTemplateFieldToDOM({ id: 'f1', label: 'Дата', type: 'date' });

        const select = document.querySelector('[data-field-id="f1"] select');
        expect(select).not.toBeNull();
        expect(select.value).toBe('date');
    });

    it('should render all five type options', () => {
        const { module } = buildTeamTemplates();

        module._addTemplateFieldToDOM({ id: 'f2', label: 'X', type: 'text' });

        const options = document.querySelectorAll('[data-field-id="f2"] select option');
        const values = Array.from(options).map(o => o.value);
        expect(values).toEqual(['text', 'email', 'tel', 'date', 'textarea']);
    });

    it('should include a remove button with correct data attributes', () => {
        const { module } = buildTeamTemplates();

        module._addTemplateFieldToDOM({ id: 'f3', label: 'Test', type: 'text' });

        const btn = document.querySelector('[data-field-id="f3"] button');
        expect(btn).not.toBeNull();
        expect(btn.dataset.action).toBe('team-removeTemplateField');
        expect(btn.dataset.fieldId).toBe('f3');
    });

    it('should handle empty label without throwing', () => {
        const { module } = buildTeamTemplates();

        expect(() => {
            module._addTemplateFieldToDOM({ id: 'f4', label: '', type: 'text' });
        }).not.toThrow();

        const input = document.querySelector('[data-field-id="f4"] input');
        expect(input.value).toBe('');
    });
});

// ─────────────────────────────────────────────
// addTemplateField / removeTemplateField / updateTemplateField
// ─────────────────────────────────────────────

describe('TeamTemplates — addTemplateField', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="templateFieldsList"></div>`;
    });

    it('should push a new field object into TeamState.templateFields', () => {
        const { module, TeamState } = buildTeamTemplates();

        module.addTemplateField();

        expect(TeamState.templateFields).toHaveLength(1);
        expect(TeamState.templateFields[0].type).toBe('text');
        expect(TeamState.templateFields[0].label).toBe('');
    });

    it('should add a corresponding DOM element', () => {
        const { module } = buildTeamTemplates();

        module.addTemplateField();

        expect(document.querySelectorAll('.template-field-item')).toHaveLength(1);
    });

    it('should generate IDs starting with "templateField_"', () => {
        const { module, TeamState } = buildTeamTemplates();

        module.addTemplateField();

        const ids = TeamState.templateFields.map(f => f.id);
        expect(ids[0]).toMatch(/^templateField_/);
    });
});

describe('TeamTemplates — removeTemplateField', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="templateFieldsList"></div>`;
    });

    it('should remove the field from TeamState.templateFields', () => {
        const { module, TeamState } = buildTeamTemplates();
        module.addTemplateField();
        const fieldId = TeamState.templateFields[0].id;

        module.removeTemplateField(fieldId);

        expect(TeamState.templateFields).toHaveLength(0);
    });

    it('should remove the corresponding DOM element', () => {
        const { module, TeamState } = buildTeamTemplates();
        module.addTemplateField();
        const fieldId = TeamState.templateFields[0].id;

        module.removeTemplateField(fieldId);

        expect(document.querySelector(`[data-field-id="${fieldId}"]`)).toBeNull();
    });

    it('should not throw when removing non-existent fieldId', () => {
        const { module } = buildTeamTemplates();

        expect(() => module.removeTemplateField('nonexistent')).not.toThrow();
    });
});

describe('TeamTemplates — updateTemplateFieldLabel', () => {
    it('should update the label of the matching field', () => {
        const { module, TeamState } = buildTeamTemplates();
        TeamState.templateFields = [{ id: 'f1', label: 'Старое', type: 'text' }];

        module.updateTemplateFieldLabel('f1', 'Новое');

        expect(TeamState.templateFields[0].label).toBe('Новое');
    });

    it('should not modify other fields', () => {
        const { module, TeamState } = buildTeamTemplates();
        TeamState.templateFields = [
            { id: 'f1', label: 'A', type: 'text' },
            { id: 'f2', label: 'B', type: 'email' }
        ];

        module.updateTemplateFieldLabel('f1', 'Updated');

        expect(TeamState.templateFields[1].label).toBe('B');
    });

    it('should do nothing when fieldId does not match', () => {
        const { module, TeamState } = buildTeamTemplates();
        TeamState.templateFields = [{ id: 'f1', label: 'Original', type: 'text' }];

        module.updateTemplateFieldLabel('nonexistent', 'X');

        expect(TeamState.templateFields[0].label).toBe('Original');
    });
});

describe('TeamTemplates — updateTemplateFieldType', () => {
    it('should update the type of the matching field', () => {
        const { module, TeamState } = buildTeamTemplates();
        TeamState.templateFields = [{ id: 'f1', label: 'Test', type: 'text' }];

        module.updateTemplateFieldType('f1', 'email');

        expect(TeamState.templateFields[0].type).toBe('email');
    });

    it('should not affect other fields', () => {
        const { module, TeamState } = buildTeamTemplates();
        TeamState.templateFields = [
            { id: 'f1', label: 'A', type: 'text' },
            { id: 'f2', label: 'B', type: 'text' }
        ];

        module.updateTemplateFieldType('f2', 'date');

        expect(TeamState.templateFields[0].type).toBe('text');
        expect(TeamState.templateFields[1].type).toBe('date');
    });
});

// ─────────────────────────────────────────────
// renderTemplateSelect (updateTemplateList option count)
// ─────────────────────────────────────────────

describe('TeamTemplates — renderTemplateSelect', () => {
    beforeEach(() => {
        setupMinimalTemplateDOM();
    });

    it('should mark default template with "(основной)" in option text', () => {
        const templates = {
            t1: { id: 't1', name: 'Мой шаблон', isDefault: true, fields: [] }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.updateTemplateList();

        const opt = document.querySelector('#templateSelect option[value="t1"]');
        expect(opt).not.toBeNull();
        expect(opt.textContent).toContain('(основной)');
    });

    it('should NOT add base "Шаблон" option when default template exists', () => {
        const templates = {
            t1: { id: 't1', name: 'Дефолт', isDefault: true, fields: [] }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.updateTemplateList();

        const opts = document.querySelectorAll('#templateSelect option[value=""]');
        expect(opts.length).toBe(0);
    });

    it('should handle multiple templates without default', () => {
        const templates = {
            t1: { id: 't1', name: 'First', isDefault: false, fields: [] },
            t2: { id: 't2', name: 'Second', isDefault: false, fields: [] }
        };
        const { module, localStorage } = buildTeamTemplates();
        localStorage._store['teamInfoTemplates'] = JSON.stringify(templates);

        module.updateTemplateList();

        const values = Array.from(
            document.querySelectorAll('#templateSelect option')
        ).map(o => o.value);
        expect(values).toContain('t1');
        expect(values).toContain('t2');
        expect(values).toContain('');
    });
});
