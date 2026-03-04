import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../team-info/js/modules/team-forms.js'),
    'utf-8'
);

// ─────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────
function buildBaseDom() {
    document.body.innerHTML = `
        <div id="hintPanel" class="visible-flex"></div>
        <div id="employeeCard" class="visible-flex">
            <span id="cardFullName"></span>
            <span id="cardPosition"></span>
            <span id="cardStatusText" class="status-badge"></span>
            <img id="cardAvatar" class="hidden" src="">
            <div id="cardAvatarPlaceholder"></div>
            <div id="cardStatusDropdown" class="hidden"></div>
            <div id="cardBody"></div>
        </div>
        <div id="employeeForm" class="hidden">
            <span id="formTitle"></span>
            <span id="formSaveBtnText"></span>
            <button id="formSaveBtn">Save</button>
            <button id="formDeleteBtn" class="hidden"></button>
            <div id="formStatusText" class="status-badge green">Работает</div>
            <div id="formStatusDropdown" class="hidden"></div>
            <img id="formAvatar" class="hidden" src="" alt="">
            <div class="form-avatar-placeholder hidden"></div>
            <div class="form-body"></div>
            <input id="formFullName" value="">
            <select id="formPosition"><option value="">Выберите роль</option><option value="sales">Sales</option><option value="manager">Manager</option><option value="support">Support</option></select>
            <input id="formReddyId" value="">
            <input id="formCorpTelegram" value="">
            <input id="formPersonalTelegram" value="">
            <input id="formBirthday" value="">
            <input id="formCorpEmail" value="">
            <input id="formPersonalEmail" value="">
            <input id="formCorpPhone" value="">
            <input id="formPersonalPhone" value="">
            <input id="formOffice" value="">
            <input id="formStartDate" value="">
            <input id="formCompany" value="">
            <input id="formCrmLogin" value="">
            <textarea id="formComment"></textarea>
        </div>
    `;
}

// ─────────────────────────────────────────────
// Mocks factory
// ─────────────────────────────────────────────
function makeMocks() {
    const TeamState = {
        currentEmployeeId: null,
        currentAvatar: null,
        currentFormStatus: 'Работает',
        formChanged: false,
        originalFormData: null,
        navigationStack: [],
        data: [],
        eventHandlers: {},
        availableGuests: [],
        pendingInvites: []
    };

    const TeamRenderer = {
        render: vi.fn(),
        updateStats: vi.fn(),
        generateCardInfo: vi.fn().mockReturnValue('<div>card info</div>')
    };

    const TeamNavigation = {
        pushNavigation: vi.fn(),
        popNavigation: vi.fn(),
        openCard: vi.fn(),
        closeCard: vi.fn()
    };

    const storage = {
        saveEmployee: vi.fn().mockResolvedValue({ success: true, id: 'emp-001' }),
        deleteEmployee: vi.fn().mockResolvedValue({ success: true })
    };

    const TeamUtils = {
        getStatusClass: vi.fn().mockReturnValue('green'),
        isValidImageUrl: vi.fn().mockReturnValue(true),
        escapeHtml: vi.fn(s => String(s || ''))
    };

    const TeamAvatars = {};
    const TeamTemplates = {};

    const Toast = {
        show: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn()
    };

    const ConfirmModal = {
        show: vi.fn().mockResolvedValue(true)
    };

    const PromptModal = {
        show: vi.fn().mockResolvedValue(null)
    };

    const CloudStorage = {
        callApi: vi.fn().mockResolvedValue({ success: true })
    };

    const RolesConfig = {
        ALL_ROLES: ['admin', 'sales', 'manager', 'support'],
        ASSIGNABLE_ROLES: ['sales', 'manager', 'support'],
        getName: vi.fn(role => role)
    };

    return {
        TeamState, TeamRenderer, TeamNavigation, storage,
        TeamUtils, TeamAvatars, TeamTemplates,
        Toast, ConfirmModal, PromptModal, CloudStorage, RolesConfig
    };
}

function loadTeamForms(overrides = {}) {
    const mocks = { ...makeMocks(), ...overrides };
    const {
        TeamState, TeamRenderer, TeamNavigation, storage,
        TeamUtils, TeamAvatars, TeamTemplates,
        Toast, ConfirmModal, PromptModal, CloudStorage, RolesConfig
    } = mocks;

    const fn = new Function(
        'TeamState', 'TeamRenderer', 'TeamNavigation', 'storage',
        'TeamUtils', 'TeamAvatars', 'TeamTemplates',
        'Toast', 'ConfirmModal', 'PromptModal', 'CloudStorage', 'RolesConfig',
        'document', 'console', 'localStorage',
        `${code}\nreturn TeamForms;`
    );

    const TeamForms = fn(
        TeamState, TeamRenderer, TeamNavigation, storage,
        TeamUtils, TeamAvatars, TeamTemplates,
        Toast, ConfirmModal, PromptModal, CloudStorage, RolesConfig,
        document, console, localStorage
    );

    return { TeamForms, mocks };
}

// ─────────────────────────────────────────────
// showAddModal
// ─────────────────────────────────────────────
describe('TeamForms.showAddModal()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should hide hintPanel', () => {
        const { TeamForms } = loadTeamForms();
        TeamForms.showAddModal();
        const hint = document.getElementById('hintPanel');
        expect(hint.classList.contains('hidden')).toBe(true);
        expect(hint.classList.contains('visible-flex')).toBe(false);
    });

    it('should hide employeeCard', () => {
        const { TeamForms } = loadTeamForms();
        // first card has visible-flex in DOM
        document.getElementById('employeeCard').classList.add('visible-flex');
        TeamForms.showAddModal();
        const card = document.getElementById('employeeCard');
        expect(card.classList.contains('hidden')).toBe(true);
    });

    it('should show employeeForm', () => {
        const { TeamForms } = loadTeamForms();
        TeamForms.showAddModal();
        const form = document.getElementById('employeeForm');
        expect(form.classList.contains('visible')).toBe(true);
        expect(form.classList.contains('hidden')).toBe(false);
    });

    it('should set formTitle to "Новый сотрудник"', () => {
        const { TeamForms } = loadTeamForms();
        TeamForms.showAddModal();
        expect(document.getElementById('formTitle').textContent).toBe('Новый сотрудник');
    });

    it('should set formSaveBtnText to "Добавить сотрудника"', () => {
        const { TeamForms } = loadTeamForms();
        TeamForms.showAddModal();
        expect(document.getElementById('formSaveBtnText').textContent).toBe('Добавить сотрудника');
    });

    it('should hide formDeleteBtn', () => {
        const { TeamForms } = loadTeamForms();
        document.getElementById('formDeleteBtn').classList.remove('hidden');
        TeamForms.showAddModal();
        expect(document.getElementById('formDeleteBtn').classList.contains('hidden')).toBe(true);
    });

    it('should reset currentEmployeeId to null in TeamState', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 42;
        TeamForms.showAddModal();
        expect(mocks.TeamState.currentEmployeeId).toBeNull();
    });

    it('should reset currentAvatar to null in TeamState', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentAvatar = 'http://example.com/avatar.png';
        TeamForms.showAddModal();
        expect(mocks.TeamState.currentAvatar).toBeNull();
    });

    it('should call TeamNavigation.pushNavigation with ("form", null)', () => {
        const { TeamForms, mocks } = loadTeamForms();
        TeamForms.showAddModal();
        expect(mocks.TeamNavigation.pushNavigation).toHaveBeenCalledWith('form', null);
    });
});

// ─────────────────────────────────────────────
// showEditForm
// ─────────────────────────────────────────────
describe('TeamForms.showEditForm()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return early if employee not found', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.data = [];
        TeamForms.showEditForm(999);
        expect(mocks.TeamNavigation.pushNavigation).not.toHaveBeenCalled();
    });

    it('should show form when employee exists', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.data = [{ id: 1, fullName: 'Иван Иванов', position: 'sales', status: 'Работает', avatar: null }];
        TeamForms.showEditForm(1);
        const form = document.getElementById('employeeForm');
        expect(form.classList.contains('visible')).toBe(true);
    });

    it('should set formTitle to "Редактирование"', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.data = [{ id: 1, fullName: 'Тест', position: 'sales', status: 'Работает', avatar: null }];
        TeamForms.showEditForm(1);
        expect(document.getElementById('formTitle').textContent).toBe('Редактирование');
    });

    it('should set formSaveBtnText to "Сохранить"', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.data = [{ id: 1, fullName: 'Тест', position: 'sales', status: 'Работает', avatar: null }];
        TeamForms.showEditForm(1);
        expect(document.getElementById('formSaveBtnText').textContent).toBe('Сохранить');
    });

    it('should show formDeleteBtn', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.data = [{ id: 1, fullName: 'Тест', position: 'sales', status: 'Работает', avatar: null }];
        TeamForms.showEditForm(1);
        expect(document.getElementById('formDeleteBtn').classList.contains('hidden')).toBe(false);
    });

    it('should set TeamState.currentEmployeeId', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.data = [{ id: 5, fullName: 'Петр', position: 'manager', status: 'Работает', avatar: null }];
        TeamForms.showEditForm(5);
        expect(mocks.TeamState.currentEmployeeId).toBe(5);
    });

    it('should fill formFullName with employee fullName', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.data = [{ id: 1, fullName: 'Анна Смирнова', position: 'sales', status: 'Работает', avatar: null }];
        TeamForms.showEditForm(1);
        expect(document.getElementById('formFullName').value).toBe('Анна Смирнова');
    });

    it('should set TeamState.currentAvatar from employee.avatar', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.data = [{ id: 1, fullName: 'Test', position: 'sales', status: 'Работает', avatar: 'http://img.test/a.jpg' }];
        TeamForms.showEditForm(1);
        expect(mocks.TeamState.currentAvatar).toBe('http://img.test/a.jpg');
    });

    it('should call TeamNavigation.pushNavigation with ("form", id)', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.data = [{ id: 7, fullName: 'X', position: 'sales', status: 'Работает', avatar: null }];
        TeamForms.showEditForm(7);
        expect(mocks.TeamNavigation.pushNavigation).toHaveBeenCalledWith('form', 7);
    });
});

// ─────────────────────────────────────────────
// saveFromForm — validation
// ─────────────────────────────────────────────
describe('TeamForms.saveFromForm() — validation', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should call Toast.warning when fullName is empty', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        document.getElementById('formFullName').value = '';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.Toast.warning).toHaveBeenCalledWith('Введите ФИО');
    });

    it('should call Toast.warning when fullName is only whitespace', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        document.getElementById('formFullName').value = '   ';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.Toast.warning).toHaveBeenCalledWith('Введите ФИО');
    });

    it('should call Toast.warning when position is empty', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        document.getElementById('formFullName').value = 'Иван Иванов';
        document.getElementById('formPosition').value = '';
        await TeamForms.saveFromForm();
        expect(mocks.Toast.warning).toHaveBeenCalledWith('Выберите роль');
    });

    it('should not call storage.saveEmployee when validation fails', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        document.getElementById('formFullName').value = '';
        await TeamForms.saveFromForm();
        expect(mocks.storage.saveEmployee).not.toHaveBeenCalled();
    });

    it('should call storage.saveEmployee when form is valid (add mode)', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = null;
        document.getElementById('formFullName').value = 'Новый Сотрудник';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.storage.saveEmployee).toHaveBeenCalled();
    });

    it('should disable formSaveBtn during save and re-enable after', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = null;
        document.getElementById('formFullName').value = 'Тест';
        document.getElementById('formPosition').value = 'sales';

        let disabledDuring = false;
        mocks.storage.saveEmployee = vi.fn(async () => {
            disabledDuring = document.getElementById('formSaveBtn').disabled;
            return { success: true, id: 'emp-001' };
        });

        await TeamForms.saveFromForm();
        expect(disabledDuring).toBe(true);
        expect(document.getElementById('formSaveBtn').disabled).toBe(false);
    });
});

// ─────────────────────────────────────────────
// saveFromForm — add employee success/failure
// ─────────────────────────────────────────────
describe('TeamForms.saveFromForm() — add employee', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should add employee to TeamState.data on success', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = null;
        mocks.storage.saveEmployee = vi.fn().mockResolvedValue({ success: true, id: 'new-001' });
        document.getElementById('formFullName').value = 'Новый Сотрудник';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.TeamState.data).toHaveLength(1);
        expect(mocks.TeamState.data[0].fullName).toBe('Новый Сотрудник');
    });

    it('should call Toast.success on successful add', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = null;
        document.getElementById('formFullName').value = 'Новый';
        document.getElementById('formPosition').value = 'manager';
        await TeamForms.saveFromForm();
        expect(mocks.Toast.success).toHaveBeenCalledWith('Сотрудник добавлен!');
    });

    it('should call Toast.error when storage returns error', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = null;
        mocks.storage.saveEmployee = vi.fn().mockResolvedValue({ error: 'DB error' });
        document.getElementById('formFullName').value = 'Тест';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.Toast.error).toHaveBeenCalled();
    });

    it('should call Toast.error when storage throws exception', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = null;
        mocks.storage.saveEmployee = vi.fn().mockRejectedValue(new Error('Network failure'));
        document.getElementById('formFullName').value = 'Тест';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.Toast.error).toHaveBeenCalled();
    });

    it('should use result.id from server as employee id', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = null;
        mocks.storage.saveEmployee = vi.fn().mockResolvedValue({ success: true, id: 'server-id-42' });
        document.getElementById('formFullName').value = 'Серверный ID';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.TeamState.data[0].id).toBe('server-id-42');
    });

    it('should generate local id if server returns no id', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = null;
        mocks.storage.saveEmployee = vi.fn().mockResolvedValue({ success: true });
        document.getElementById('formFullName').value = 'Локальный ID';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.TeamState.data[0].id).toMatch(/^emp-/);
    });
});

// ─────────────────────────────────────────────
// saveFromForm — update employee success/failure
// ─────────────────────────────────────────────
describe('TeamForms.saveFromForm() — update employee', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should call Toast.success on successful update', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 10;
        mocks.TeamState.data = [{ id: 10, fullName: 'Старое Имя', position: 'sales', email: null, corpEmail: null }];
        mocks.storage.saveEmployee = vi.fn().mockResolvedValue({ success: true });
        document.getElementById('formFullName').value = 'Новое Имя';
        document.getElementById('formPosition').value = 'manager';
        await TeamForms.saveFromForm();
        expect(mocks.Toast.success).toHaveBeenCalledWith('Сотрудник обновлен!');
    });

    it('should call Toast.error when update storage returns error', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 10;
        mocks.TeamState.data = [{ id: 10, fullName: 'Тест', position: 'sales', email: null, corpEmail: null }];
        mocks.storage.saveEmployee = vi.fn().mockResolvedValue({ error: 'Update failed' });
        document.getElementById('formFullName').value = 'Тест';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.Toast.error).toHaveBeenCalled();
    });

    it('should call CloudStorage.callApi for role sync when role changed', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 10;
        mocks.TeamState.data = [{
            id: 10, fullName: 'Тест', position: 'sales',
            email: 'emp@test.com', corpEmail: 'emp@test.com'
        }];
        mocks.storage.saveEmployee = vi.fn().mockResolvedValue({ success: true });
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ success: true });
        document.getElementById('formFullName').value = 'Тест';
        document.getElementById('formPosition').value = 'manager';
        await TeamForms.saveFromForm();
        expect(mocks.CloudStorage.callApi).toHaveBeenCalledWith(
            'updateUser',
            expect.objectContaining({ role: 'manager' })
        );
    });

    it('should NOT call CloudStorage.callApi when role is unchanged', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 10;
        mocks.TeamState.data = [{
            id: 10, fullName: 'Тест', position: 'sales',
            email: 'emp@test.com', corpEmail: null
        }];
        mocks.storage.saveEmployee = vi.fn().mockResolvedValue({ success: true });
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ success: true });
        document.getElementById('formFullName').value = 'Тест';
        document.getElementById('formPosition').value = 'sales';
        await TeamForms.saveFromForm();
        expect(mocks.CloudStorage.callApi).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────
// deleteFromForm
// ─────────────────────────────────────────────
describe('TeamForms.deleteFromForm()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return early if currentEmployeeId is null', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = null;
        await TeamForms.deleteFromForm();
        expect(mocks.ConfirmModal.show).not.toHaveBeenCalled();
    });

    it('should show ConfirmModal with employee name', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 1;
        mocks.TeamState.data = [{ id: 1, fullName: 'Иван Иванов' }];
        mocks.ConfirmModal.show = vi.fn().mockResolvedValue(false);
        await TeamForms.deleteFromForm();
        expect(mocks.ConfirmModal.show).toHaveBeenCalledWith(
            'Удалить "Иван Иванов"?',
            expect.objectContaining({ danger: true })
        );
    });

    it('should call storage.deleteEmployee when confirmed', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 1;
        mocks.TeamState.data = [{ id: 1, fullName: 'Иван' }];
        mocks.ConfirmModal.show = vi.fn().mockResolvedValue(true);
        mocks.storage.deleteEmployee = vi.fn().mockResolvedValue({ success: true });
        await TeamForms.deleteFromForm();
        expect(mocks.storage.deleteEmployee).toHaveBeenCalledWith(1);
    });

    it('should NOT call storage.deleteEmployee when cancelled', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 1;
        mocks.TeamState.data = [{ id: 1, fullName: 'Иван' }];
        mocks.ConfirmModal.show = vi.fn().mockResolvedValue(false);
        await TeamForms.deleteFromForm();
        expect(mocks.storage.deleteEmployee).not.toHaveBeenCalled();
    });

    it('should remove employee from TeamState.data on success', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 2;
        mocks.TeamState.data = [
            { id: 1, fullName: 'Петр' },
            { id: 2, fullName: 'Иван' }
        ];
        mocks.ConfirmModal.show = vi.fn().mockResolvedValue(true);
        mocks.storage.deleteEmployee = vi.fn().mockResolvedValue({ success: true });
        await TeamForms.deleteFromForm();
        expect(mocks.TeamState.data).toHaveLength(1);
        expect(mocks.TeamState.data[0].id).toBe(1);
    });

    it('should call Toast.success on successful delete', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 1;
        mocks.TeamState.data = [{ id: 1, fullName: 'Иван' }];
        mocks.ConfirmModal.show = vi.fn().mockResolvedValue(true);
        mocks.storage.deleteEmployee = vi.fn().mockResolvedValue({ success: true });
        await TeamForms.deleteFromForm();
        expect(mocks.Toast.success).toHaveBeenCalledWith('Сотрудник удален!');
    });

    it('should call Toast.error when storage returns error', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 1;
        mocks.TeamState.data = [{ id: 1, fullName: 'Иван' }];
        mocks.ConfirmModal.show = vi.fn().mockResolvedValue(true);
        mocks.storage.deleteEmployee = vi.fn().mockResolvedValue({ error: 'Cannot delete' });
        await TeamForms.deleteFromForm();
        expect(mocks.Toast.error).toHaveBeenCalled();
    });

    it('should NOT remove employee from data when storage returns error', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentEmployeeId = 1;
        mocks.TeamState.data = [{ id: 1, fullName: 'Иван' }];
        mocks.ConfirmModal.show = vi.fn().mockResolvedValue(true);
        mocks.storage.deleteEmployee = vi.fn().mockResolvedValue({ error: 'Cannot delete' });
        await TeamForms.deleteFromForm();
        expect(mocks.TeamState.data).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────
// changeFormStatus
// ─────────────────────────────────────────────
describe('TeamForms.changeFormStatus()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should update TeamState.currentFormStatus', () => {
        const { TeamForms, mocks } = loadTeamForms();
        // set up originalFormData to allow onFormChange comparison
        mocks.TeamState.originalFormData = {};
        TeamForms.changeFormStatus('Отпуск');
        expect(mocks.TeamState.currentFormStatus).toBe('Отпуск');
    });

    it('should update formStatusText content', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.originalFormData = {};
        TeamForms.changeFormStatus('Уволен');
        expect(document.getElementById('formStatusText').textContent).toBe('Уволен');
    });

    it('should hide formStatusDropdown', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.originalFormData = {};
        document.getElementById('formStatusDropdown').classList.add('visible');
        document.getElementById('formStatusDropdown').classList.remove('hidden');
        TeamForms.changeFormStatus('Работает');
        const dropdown = document.getElementById('formStatusDropdown');
        expect(dropdown.classList.contains('hidden')).toBe(true);
        expect(dropdown.classList.contains('visible')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// toggleStatusDropdown
// ─────────────────────────────────────────────
describe('TeamForms.toggleStatusDropdown()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show dropdown when currently hidden', () => {
        const { TeamForms } = loadTeamForms();
        const dropdown = document.getElementById('cardStatusDropdown');
        dropdown.classList.add('hidden');
        dropdown.classList.remove('visible');
        TeamForms.toggleStatusDropdown();
        expect(dropdown.classList.contains('visible')).toBe(true);
    });

    it('should hide dropdown when currently visible', () => {
        const { TeamForms } = loadTeamForms();
        const dropdown = document.getElementById('cardStatusDropdown');
        dropdown.classList.add('visible');
        dropdown.classList.remove('hidden');
        TeamForms.toggleStatusDropdown();
        expect(dropdown.classList.contains('hidden')).toBe(true);
        expect(dropdown.classList.contains('visible')).toBe(false);
    });
});

// ─────────────────────────────────────────────
// toggleFormStatusDropdown
// ─────────────────────────────────────────────
describe('TeamForms.toggleFormStatusDropdown()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show formStatusDropdown when hidden', () => {
        const { TeamForms } = loadTeamForms();
        const dropdown = document.getElementById('formStatusDropdown');
        dropdown.classList.add('hidden');
        dropdown.classList.remove('visible');
        TeamForms.toggleFormStatusDropdown();
        expect(dropdown.classList.contains('visible')).toBe(true);
    });

    it('should hide formStatusDropdown when visible', () => {
        const { TeamForms } = loadTeamForms();
        const dropdown = document.getElementById('formStatusDropdown');
        dropdown.classList.add('visible');
        dropdown.classList.remove('hidden');
        TeamForms.toggleFormStatusDropdown();
        expect(dropdown.classList.contains('hidden')).toBe(true);
    });
});

// ─────────────────────────────────────────────
// cleanup
// ─────────────────────────────────────────────
describe('TeamForms.cleanup()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should clear TeamState.eventHandlers', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.eventHandlers = { someHandler: vi.fn() };
        TeamForms.cleanup();
        expect(Object.keys(mocks.TeamState.eventHandlers)).toHaveLength(0);
    });

    it('should remove textarea event listener if handler was stored', () => {
        const { TeamForms, mocks } = loadTeamForms();
        const textarea = document.getElementById('formComment');
        const handler = vi.fn();
        mocks.TeamState.eventHandlers = { textareaAutoResize: handler };
        textarea.addEventListener('input', handler);

        const removeListenerSpy = vi.spyOn(textarea, 'removeEventListener');
        TeamForms.cleanup();
        expect(removeListenerSpy).toHaveBeenCalledWith('input', handler);
    });

    it('should not throw if formComment does not exist', () => {
        const { TeamForms, mocks } = loadTeamForms();
        document.getElementById('formComment').remove();
        mocks.TeamState.eventHandlers = {};
        expect(() => TeamForms.cleanup()).not.toThrow();
    });

    it('should not throw if eventHandlers is empty', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.eventHandlers = {};
        expect(() => TeamForms.cleanup()).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// syncToProfile
// ─────────────────────────────────────────────
describe('TeamForms.syncToProfile()', () => {
    beforeEach(() => {
        buildBaseDom();
        localStorage.clear();
    });
    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('should write profile to localStorage when email matches', () => {
        const { TeamForms } = loadTeamForms();
        localStorage.setItem('cloud-auth', JSON.stringify({ email: 'user@company.com' }));
        const employee = {
            email: 'user@company.com',
            fullName: 'Тест Тестович',
            position: 'manager',
            corpEmail: 'user@company.com'
        };
        TeamForms.syncToProfile(employee);
        const stored = JSON.parse(localStorage.getItem('user-profile-local'));
        expect(stored).not.toBeNull();
        expect(stored.name).toBe('Тест Тестович');
        expect(stored.position).toBe('manager');
    });

    it('should NOT write to localStorage when email does not match', () => {
        const { TeamForms } = loadTeamForms();
        localStorage.setItem('cloud-auth', JSON.stringify({ email: 'other@company.com' }));
        const employee = { email: 'user@company.com', fullName: 'Тест' };
        TeamForms.syncToProfile(employee);
        expect(localStorage.getItem('user-profile-local')).toBeNull();
    });

    it('should NOT write to localStorage when cloud-auth is missing', () => {
        const { TeamForms } = loadTeamForms();
        const employee = { email: 'user@company.com', fullName: 'Тест' };
        TeamForms.syncToProfile(employee);
        expect(localStorage.getItem('user-profile-local')).toBeNull();
    });

    it('should NOT throw when cloud-auth contains invalid JSON', () => {
        const { TeamForms } = loadTeamForms();
        localStorage.setItem('cloud-auth', 'not-valid-json{{{');
        const employee = { email: 'user@company.com' };
        expect(() => TeamForms.syncToProfile(employee)).not.toThrow();
    });

    it('should include all expected fields in profile', () => {
        const { TeamForms } = loadTeamForms();
        localStorage.setItem('cloud-auth', JSON.stringify({ email: 'u@t.com' }));
        const employee = {
            email: 'u@t.com',
            fullName: 'Полное Имя',
            position: 'sales',
            crmLogin: 'crm123',
            corpTelegram: '@corp',
            personalTelegram: '@pers',
            corpEmail: 'u@t.com',
            personalEmail: 'p@t.com',
            corpPhone: '+71234567890',
            personalPhone: '+79876543210',
            birthday: '1990-01-01',
            startDate: '2020-06-15',
            office: 'Moscow',
            company: 'Test Co',
            comment: 'Some comment'
        };
        TeamForms.syncToProfile(employee);
        const stored = JSON.parse(localStorage.getItem('user-profile-local'));
        expect(stored.crmLogin).toBe('crm123');
        expect(stored.corpTelegram).toBe('@corp');
        expect(stored.birthday).toBe('1990-01-01');
        expect(stored.office).toBe('Moscow');
    });
});

// ─────────────────────────────────────────────
// onFormChange
// ─────────────────────────────────────────────
describe('TeamForms.onFormChange()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should set formChanged = true when data differs from original', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.originalFormData = { fullName: 'Старое Имя', position: 'sales', status: 'Работает', reddyId: '', corpTelegram: '', personalTelegram: '', birthday: '', corpEmail: '', personalEmail: '', corpPhone: '', personalPhone: '', office: '', startDate: '', company: '', crmLogin: '', comment: '' };
        document.getElementById('formFullName').value = 'Новое Имя';
        TeamForms.onFormChange();
        expect(mocks.TeamState.formChanged).toBe(true);
    });

    it('should set formChanged = false when data matches original', () => {
        const { TeamForms, mocks } = loadTeamForms();
        const data = { fullName: 'Тест', position: 'sales', status: 'Работает', reddyId: '', corpTelegram: '', personalTelegram: '', birthday: '', corpEmail: '', personalEmail: '', corpPhone: '', personalPhone: '', office: '', startDate: '', company: '', crmLogin: '', comment: '' };
        mocks.TeamState.originalFormData = data;
        mocks.TeamState.currentFormStatus = 'Работает';
        document.getElementById('formFullName').value = 'Тест';
        document.getElementById('formPosition').value = 'sales';
        TeamForms.onFormChange();
        expect(mocks.TeamState.formChanged).toBe(false);
    });
});

// ─────────────────────────────────────────────
// _syncSystemRole
// ─────────────────────────────────────────────
describe('TeamForms._syncSystemRole()', () => {
    it('should skip call when roles are the same', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        await TeamForms._syncSystemRole({ email: 'u@t.com' }, 'sales', 'sales');
        expect(mocks.CloudStorage.callApi).not.toHaveBeenCalled();
    });

    it('should skip call when newRole is falsy', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        await TeamForms._syncSystemRole({ email: 'u@t.com' }, 'sales', null);
        expect(mocks.CloudStorage.callApi).not.toHaveBeenCalled();
    });

    it('should skip call when email is missing', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        await TeamForms._syncSystemRole({ email: null, corpEmail: null }, 'sales', 'manager');
        expect(mocks.CloudStorage.callApi).not.toHaveBeenCalled();
    });

    it('should call CloudStorage.callApi with correct params when role changed', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        await TeamForms._syncSystemRole({ email: 'emp@test.com' }, 'sales', 'manager');
        expect(mocks.CloudStorage.callApi).toHaveBeenCalledWith('updateUser', {
            targetEmail: 'emp@test.com',
            role: 'manager'
        });
    });

    it('should use corpEmail when email is not set', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        await TeamForms._syncSystemRole({ email: null, corpEmail: 'corp@test.com' }, 'sales', 'admin');
        expect(mocks.CloudStorage.callApi).toHaveBeenCalledWith('updateUser', {
            targetEmail: 'corp@test.com',
            role: 'admin'
        });
    });

    it('should call Toast.warning when API returns error', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ error: 'Forbidden' });
        await TeamForms._syncSystemRole({ email: 'u@t.com' }, 'sales', 'manager');
        expect(mocks.Toast.warning).toHaveBeenCalled();
    });

    it('should call Toast.warning when API throws exception', async () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.CloudStorage.callApi = vi.fn().mockRejectedValue(new Error('Network error'));
        await TeamForms._syncSystemRole({ email: 'u@t.com' }, 'sales', 'manager');
        expect(mocks.Toast.warning).toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────
// getFormData
// ─────────────────────────────────────────────
describe('TeamForms.getFormData()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return object with all form fields', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentFormStatus = 'Работает';
        document.getElementById('formFullName').value = 'Иван';
        document.getElementById('formPosition').value = 'sales';
        const data = TeamForms.getFormData();
        expect(data).toHaveProperty('fullName', 'Иван');
        expect(data).toHaveProperty('position', 'sales');
        expect(data).toHaveProperty('status', 'Работает');
    });

    it('should use currentFormStatus from TeamState', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentFormStatus = 'Отпуск';
        const data = TeamForms.getFormData();
        expect(data.status).toBe('Отпуск');
    });

    it('should default status to "Работает" when currentFormStatus is falsy', () => {
        const { TeamForms, mocks } = loadTeamForms();
        mocks.TeamState.currentFormStatus = null;
        const data = TeamForms.getFormData();
        expect(data.status).toBe('Работает');
    });
});
