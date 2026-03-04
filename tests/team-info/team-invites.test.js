import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../team-info/js/modules/team-invites.js'),
    'utf-8'
);

// ─────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────
function buildBaseDom() {
    document.body.innerHTML = `
        <div class="sub-tabs">
            <button class="sub-tab active" data-value="employees">Сотрудники</button>
            <button class="sub-tab" data-value="invites">Приглашения</button>
        </div>
        <div class="content-area">
            <div class="sub-tab-content active" id="subtab-employees"></div>
            <div class="sub-tab-content" id="subtab-invites"></div>
        </div>
        <div id="guestsList"></div>
        <div id="guestsCount">0</div>
        <div id="pendingInvites" class="hidden">
            <span id="pendingCount">0</span>
            <div id="pendingInvitesList"></div>
        </div>
        <div id="inviteFromGuests" class="hidden"></div>
        <div id="inviteManual" class="hidden">
            <select id="inviteManualRole"></select>
        </div>
        <div class="invite-mode-toggle">
            <button class="invite-mode" data-type="guests">Гости</button>
            <button class="invite-mode" data-type="manual">Ручной</button>
        </div>
        <div class="invite-manual-toggle">
            <button class="tab" data-type="reddyId">Reddy ID</button>
            <button class="tab" data-type="email">Email</button>
        </div>
        <div id="inviteByReddyId">
            <input id="inviteReddyId" value="">
        </div>
        <div id="inviteByEmail">
            <input id="inviteEmail" value="">
        </div>
        <div id="adminTeamSelect"></div>
    `;
}

// ─────────────────────────────────────────────
// Mocks factory
// ─────────────────────────────────────────────
function makeMocks() {
    const TeamState = {
        currentInviteType: 'guests',
        availableGuests: [],
        availableTeams: [],
        pendingInvites: [],
        assignableRoles: { sales: 'Продажи', manager: 'Менеджер' }
    };

    const TeamRenderer = {
        render: vi.fn(),
        updateStats: vi.fn()
    };

    const TeamStorage = {
        loadTeam: vi.fn().mockResolvedValue([])
    };

    const TeamUtils = {
        escapeHtml: vi.fn(s => String(s == null ? '' : s))
    };

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
        callApi: vi.fn().mockResolvedValue({})
    };

    const RolesConfig = {
        ALL_ROLES: ['admin', 'sales', 'manager'],
        ASSIGNABLE_ROLES: ['sales', 'manager'],
        getName: vi.fn(role => role)
    };

    const RoleGuard = {
        getCurrentRole: vi.fn().mockReturnValue('admin'),
        getTeamId: vi.fn().mockReturnValue('team-001')
    };

    return {
        TeamState, TeamRenderer, TeamStorage,
        TeamUtils, Toast, ConfirmModal, PromptModal,
        CloudStorage, RolesConfig, RoleGuard
    };
}

function loadTeamInvites(overrides = {}) {
    const mocks = { ...makeMocks(), ...overrides };
    const {
        TeamState, TeamRenderer, TeamStorage,
        TeamUtils, Toast, ConfirmModal, PromptModal,
        CloudStorage, RolesConfig, RoleGuard
    } = mocks;

    // Polyfill CSS.escape for jsdom
    const CSSPolyfill = {
        escape: (str) => String(str).replace(/([^\w-])/g, '\\$1')
    };

    const fn = new Function(
        'TeamState', 'TeamRenderer', 'TeamStorage',
        'TeamUtils', 'Toast', 'ConfirmModal', 'PromptModal',
        'CloudStorage', 'RolesConfig', 'RoleGuard',
        'document', 'console', 'localStorage', 'CSS',
        `${code}\nreturn TeamInvites;`
    );

    const TeamInvites = fn(
        TeamState, TeamRenderer, TeamStorage,
        TeamUtils, Toast, ConfirmModal, PromptModal,
        CloudStorage, RolesConfig, RoleGuard,
        document, console, localStorage, CSSPolyfill
    );

    return { TeamInvites, mocks };
}

// ─────────────────────────────────────────────
// loadGuestUsers
// ─────────────────────────────────────────────
describe('TeamInvites.loadGuestUsers()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return early if guestsList container does not exist', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        document.getElementById('guestsList').remove();
        await TeamInvites.loadGuestUsers();
        expect(mocks.CloudStorage.callApi).not.toHaveBeenCalled();
    });

    it('should show loading state in container', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        let htmlDuringCall = '';
        mocks.CloudStorage.callApi = vi.fn(async () => {
            htmlDuringCall = document.getElementById('guestsList').innerHTML;
            return { guests: [] };
        });
        await TeamInvites.loadGuestUsers();
        expect(htmlDuringCall).toContain('spinner');
    });

    it('should call CloudStorage.callApi with "getGuestUsers"', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ guests: [] });
        await TeamInvites.loadGuestUsers();
        expect(mocks.CloudStorage.callApi).toHaveBeenCalledWith('getGuestUsers');
    });

    it('should display error text when API returns error', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ error: 'Forbidden' });
        await TeamInvites.loadGuestUsers();
        expect(document.getElementById('guestsList').innerHTML).toContain('Forbidden');
    });

    it('should display error text when API throws exception', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockRejectedValue(new Error('Network error'));
        await TeamInvites.loadGuestUsers();
        expect(document.getElementById('guestsList').innerHTML).toContain('Ошибка');
    });

    it('should populate TeamState.availableGuests from result.guests', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        const guests = [
            { email: 'a@test.com', name: 'Alice' },
            { email: 'b@test.com', name: 'Bob' }
        ];
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ guests });
        await TeamInvites.loadGuestUsers();
        expect(mocks.TeamState.availableGuests).toHaveLength(2);
    });

    it('should set availableGuests to empty array when result.guests is undefined', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        await TeamInvites.loadGuestUsers();
        expect(mocks.TeamState.availableGuests).toEqual([]);
    });

    it('should call getAdminData when admin has no teamId', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.RoleGuard.getCurrentRole = vi.fn().mockReturnValue('admin');
        mocks.RoleGuard.getTeamId = vi.fn().mockReturnValue(null);
        mocks.CloudStorage.callApi = vi.fn()
            .mockResolvedValueOnce({ guests: [] })
            .mockResolvedValueOnce({ teams: [{ id: 't1', isActive: true, name: 'Team 1' }] });
        await TeamInvites.loadGuestUsers();
        expect(mocks.CloudStorage.callApi).toHaveBeenCalledWith('getAdminData');
    });

    it('should NOT call getAdminData when admin has teamId', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.RoleGuard.getCurrentRole = vi.fn().mockReturnValue('admin');
        mocks.RoleGuard.getTeamId = vi.fn().mockReturnValue('team-001');
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ guests: [] });
        await TeamInvites.loadGuestUsers();
        expect(mocks.CloudStorage.callApi).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────────────────────────────
// inviteGuest
// ─────────────────────────────────────────────
describe('TeamInvites.inviteGuest()', () => {
    beforeEach(() => {
        buildBaseDom();
        // Add role-select for guest
        const guestsList = document.getElementById('guestsList');
        guestsList.innerHTML = `
            <select class="role-select" data-email="guest@test.com">
                <option value="sales" selected>Продажи</option>
            </select>
        `;
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show error when teamId is not available', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.RoleGuard.getTeamId = vi.fn().mockReturnValue(null);
        await TeamInvites.inviteGuest('guest@test.com');
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.any(String), 'error');
        expect(mocks.CloudStorage.callApi).not.toHaveBeenCalled();
    });

    it('should call CloudStorage.callApi with sendInvite and correct params', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.RoleGuard.getTeamId = vi.fn().mockReturnValue('team-001');
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        await TeamInvites.inviteGuest('guest@test.com');
        expect(mocks.CloudStorage.callApi).toHaveBeenCalledWith('sendInvite', {
            userEmail: 'guest@test.com',
            teamId: 'team-001',
            assignedRole: 'sales'
        });
    });

    it('should show success toast on successful invite', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        await TeamInvites.inviteGuest('guest@test.com');
        expect(mocks.Toast.show).toHaveBeenCalledWith('Приглашение отправлено!', 'success');
    });

    it('should remove invited guest from TeamState.availableGuests', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.availableGuests = [
            { email: 'guest@test.com', name: 'Guest' },
            { email: 'other@test.com', name: 'Other' }
        ];
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        await TeamInvites.inviteGuest('guest@test.com');
        expect(mocks.TeamState.availableGuests).toHaveLength(1);
        expect(mocks.TeamState.availableGuests[0].email).toBe('other@test.com');
    });

    it('should show error toast when API returns error', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ error: 'Already invited' });
        await TeamInvites.inviteGuest('guest@test.com');
        expect(mocks.Toast.show).toHaveBeenCalledWith('Already invited', 'error');
    });

    it('should show error toast when API throws exception', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockRejectedValue(new Error('Network fail'));
        await TeamInvites.inviteGuest('guest@test.com');
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    it('should NOT remove guest from list when API returns error', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.availableGuests = [{ email: 'guest@test.com', name: 'Guest' }];
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ error: 'Failed' });
        await TeamInvites.inviteGuest('guest@test.com');
        expect(mocks.TeamState.availableGuests).toHaveLength(1);
    });

    it('should use adminTeamSelect value when RoleGuard has no teamId', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.RoleGuard.getTeamId = vi.fn().mockReturnValue(null);
        // Remove the placeholder div and add a proper <select>
        const oldEl = document.getElementById('adminTeamSelect');
        if (oldEl) oldEl.remove();
        document.body.insertAdjacentHTML('beforeend', `<select id="adminTeamSelect"><option value="team-from-select" selected>Team</option></select>`);
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        await TeamInvites.inviteGuest('guest@test.com');
        expect(mocks.CloudStorage.callApi).toHaveBeenCalledWith('sendInvite', expect.objectContaining({
            teamId: 'team-from-select'
        }));
    });
});

// ─────────────────────────────────────────────
// sendInviteByEmail
// ─────────────────────────────────────────────
describe('TeamInvites.sendInviteByEmail()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show error when teamId is not available', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.RoleGuard.getTeamId = vi.fn().mockReturnValue(null);
        await TeamInvites.sendInviteByEmail('user@test.com');
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.any(String), 'error');
        expect(mocks.CloudStorage.callApi).not.toHaveBeenCalled();
    });

    it('should call CloudStorage.callApi sendInvite with email and teamId', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.RoleGuard.getTeamId = vi.fn().mockReturnValue('team-abc');
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        await TeamInvites.sendInviteByEmail('user@test.com');
        expect(mocks.CloudStorage.callApi).toHaveBeenCalledWith('sendInvite', {
            userEmail: 'user@test.com',
            teamId: 'team-abc',
            assignedRole: expect.any(String)
        });
    });

    it('should show success toast on successful send', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        await TeamInvites.sendInviteByEmail('user@test.com');
        expect(mocks.Toast.show).toHaveBeenCalledWith('Приглашение отправлено!', 'success');
    });

    it('should clear inviteEmail input after success', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({});
        document.getElementById('inviteEmail').value = 'user@test.com';
        await TeamInvites.sendInviteByEmail('user@test.com');
        expect(document.getElementById('inviteEmail').value).toBe('');
    });

    it('should show error toast when API returns error', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ error: 'User not found' });
        await TeamInvites.sendInviteByEmail('user@test.com');
        expect(mocks.Toast.show).toHaveBeenCalledWith('User not found', 'error');
    });

    it('should show error toast when API throws exception', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockRejectedValue(new Error('Timeout'));
        await TeamInvites.sendInviteByEmail('user@test.com');
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.any(String), 'error');
    });
});

// ─────────────────────────────────────────────
// cancelInvite
// ─────────────────────────────────────────────
describe('TeamInvites.cancelInvite()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('should remove invite with given id from TeamState.pendingInvites', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [
            { id: 1, type: 'reddyId', value: '12345678901', status: 'pending' },
            { id: 2, type: 'email', value: 'a@b.com', status: 'pending' }
        ];
        TeamInvites.cancelInvite(1);
        expect(mocks.TeamState.pendingInvites).toHaveLength(1);
        expect(mocks.TeamState.pendingInvites[0].id).toBe(2);
    });

    it('should show info toast after cancellation', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [{ id: 5, type: 'reddyId', value: '11111111111', status: 'pending' }];
        TeamInvites.cancelInvite(5);
        expect(mocks.Toast.show).toHaveBeenCalledWith('Приглашение отменено', 'info');
    });

    it('should do nothing when invite id does not exist', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [{ id: 1, type: 'reddyId', value: '12345678901', status: 'pending' }];
        TeamInvites.cancelInvite(999);
        expect(mocks.TeamState.pendingInvites).toHaveLength(1);
    });

    it('should persist updated pendingInvites to localStorage', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [
            { id: 10, type: 'reddyId', value: '12345678901', status: 'pending' }
        ];
        TeamInvites.cancelInvite(10);
        const stored = JSON.parse(localStorage.getItem('team-pending-invites'));
        expect(stored).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────
// renderPendingInvites
// ─────────────────────────────────────────────
describe('TeamInvites.renderPendingInvites()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should hide pendingInvites container when list is empty', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [];
        TeamInvites.renderPendingInvites();
        expect(document.getElementById('pendingInvites').classList.contains('hidden')).toBe(true);
    });

    it('should show pendingInvites container when list has items', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [
            { id: 1, type: 'reddyId', value: '12345678901', status: 'pending' }
        ];
        TeamInvites.renderPendingInvites();
        expect(document.getElementById('pendingInvites').classList.contains('hidden')).toBe(false);
    });

    it('should update pendingCount text', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [
            { id: 1, type: 'reddyId', value: '12345678901', status: 'pending' },
            { id: 2, type: 'email', value: 'a@b.com', status: 'pending' }
        ];
        TeamInvites.renderPendingInvites();
        expect(document.getElementById('pendingCount').textContent).toBe('2');
    });

    it('should render a list item per invite', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [
            { id: 1, type: 'reddyId', value: '12345678901', status: 'pending' },
            { id: 2, type: 'email', value: 'test@test.com', status: 'pending' }
        ];
        TeamInvites.renderPendingInvites();
        const items = document.querySelectorAll('.pending-invite-item');
        expect(items).toHaveLength(2);
    });

    it('should render "Reddy ID" label for reddyId type', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [
            { id: 1, type: 'reddyId', value: '12345678901', status: 'pending' }
        ];
        TeamInvites.renderPendingInvites();
        expect(document.getElementById('pendingInvitesList').innerHTML).toContain('Reddy ID');
    });

    it('should render "Email" label for email type', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [
            { id: 1, type: 'email', value: 'user@test.com', status: 'pending' }
        ];
        TeamInvites.renderPendingInvites();
        expect(document.getElementById('pendingInvitesList').innerHTML).toContain('Email');
    });

    it('should return early if container elements are missing', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        document.getElementById('pendingInvites').remove();
        mocks.TeamState.pendingInvites = [{ id: 1, type: 'reddyId', value: '12345678901' }];
        expect(() => TeamInvites.renderPendingInvites()).not.toThrow();
    });
});

// ─────────────────────────────────────────────
// loadPendingInvites
// ─────────────────────────────────────────────
describe('TeamInvites.loadPendingInvites()', () => {
    beforeEach(() => {
        buildBaseDom();
        localStorage.clear();
    });
    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('should load invites from localStorage', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        const invites = [{ id: 1, type: 'reddyId', value: '12345678901', status: 'pending' }];
        localStorage.setItem('team-pending-invites', JSON.stringify(invites));
        TeamInvites.loadPendingInvites();
        expect(mocks.TeamState.pendingInvites).toHaveLength(1);
    });

    it('should set pendingInvites to [] when localStorage is empty', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        TeamInvites.loadPendingInvites();
        expect(mocks.TeamState.pendingInvites).toEqual([]);
    });

    it('should set pendingInvites to [] when localStorage contains invalid JSON', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        localStorage.setItem('team-pending-invites', 'not-json{{{');
        TeamInvites.loadPendingInvites();
        expect(mocks.TeamState.pendingInvites).toEqual([]);
    });
});

// ─────────────────────────────────────────────
// savePendingInvites
// ─────────────────────────────────────────────
describe('TeamInvites.savePendingInvites()', () => {
    beforeEach(() => {
        buildBaseDom();
        localStorage.clear();
    });
    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('should save pendingInvites to localStorage', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [
            { id: 1, type: 'reddyId', value: '12345678901', status: 'pending' }
        ];
        TeamInvites.savePendingInvites();
        const stored = JSON.parse(localStorage.getItem('team-pending-invites'));
        expect(stored).toHaveLength(1);
        expect(stored[0].value).toBe('12345678901');
    });

    it('should save empty array when pendingInvites is empty', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.pendingInvites = [];
        TeamInvites.savePendingInvites();
        const stored = JSON.parse(localStorage.getItem('team-pending-invites'));
        expect(stored).toEqual([]);
    });
});

// ─────────────────────────────────────────────
// sendInvite — validation
// ─────────────────────────────────────────────
describe('TeamInvites.sendInvite() — validation', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show info toast when type is "guests"', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.currentInviteType = 'guests';
        await TeamInvites.sendInvite();
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.any(String), 'info');
    });

    it('should show error when reddyId is empty', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.currentInviteType = 'reddyId';
        document.getElementById('inviteReddyId').value = '';
        await TeamInvites.sendInvite();
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    it('should show error when reddyId format is invalid (not 11 digits)', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.currentInviteType = 'reddyId';
        document.getElementById('inviteReddyId').value = '12345';
        await TeamInvites.sendInvite();
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.stringContaining('11'), 'error');
    });

    it('should show error when email is empty', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.currentInviteType = 'email';
        document.getElementById('inviteEmail').value = '';
        await TeamInvites.sendInvite();
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    it('should show error when email format is invalid', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.currentInviteType = 'email';
        document.getElementById('inviteEmail').value = 'not-an-email';
        await TeamInvites.sendInvite();
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    it('should accept valid 11-digit reddyId', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.currentInviteType = 'reddyId';
        mocks.TeamState.pendingInvites = [];
        document.getElementById('inviteReddyId').value = '12345678901';
        await TeamInvites.sendInvite();
        // Should not show error toast — should proceed to save
        const errorCalls = mocks.Toast.show.mock.calls.filter(c => c[1] === 'error');
        expect(errorCalls).toHaveLength(0);
    });

    it('should show warning when duplicate reddyId invite exists', async () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.TeamState.currentInviteType = 'reddyId';
        mocks.TeamState.pendingInvites = [
            { id: 1, type: 'reddyId', value: '12345678901', status: 'pending' }
        ];
        document.getElementById('inviteReddyId').value = '12345678901';
        await TeamInvites.sendInvite();
        expect(mocks.Toast.show).toHaveBeenCalledWith(expect.any(String), 'warning');
    });
});

// ─────────────────────────────────────────────
// switchSubtab
// ─────────────────────────────────────────────
describe('TeamInvites.switchSubtab()', () => {
    beforeEach(() => {
        buildBaseDom();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should activate the target sub-tab button', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ guests: [] });
        TeamInvites.switchSubtab('invites');
        const inviteBtn = document.querySelector('.sub-tab[data-value="invites"]');
        expect(inviteBtn.classList.contains('active')).toBe(true);
    });

    it('should deactivate other sub-tab buttons', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ guests: [] });
        TeamInvites.switchSubtab('invites');
        const empBtn = document.querySelector('.sub-tab[data-value="employees"]');
        expect(empBtn.classList.contains('active')).toBe(false);
    });

    it('should show the target sub-tab content', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ guests: [] });
        TeamInvites.switchSubtab('invites');
        const target = document.getElementById('subtab-invites');
        expect(target.classList.contains('active')).toBe(true);
    });

    it('should call loadGuestUsers when switching to "invites"', () => {
        const { TeamInvites, mocks } = loadTeamInvites();
        mocks.CloudStorage.callApi = vi.fn().mockResolvedValue({ guests: [] });
        const spy = vi.spyOn(TeamInvites, 'loadGuestUsers');
        TeamInvites.switchSubtab('invites');
        expect(spy).toHaveBeenCalled();
    });

    it('should NOT call loadGuestUsers when switching to "employees"', () => {
        const { TeamInvites } = loadTeamInvites();
        const spy = vi.spyOn(TeamInvites, 'loadGuestUsers');
        TeamInvites.switchSubtab('employees');
        expect(spy).not.toHaveBeenCalled();
    });
});
