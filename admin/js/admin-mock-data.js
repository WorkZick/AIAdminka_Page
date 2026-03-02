/**
 * MOCK DATA для локальной разработки
 *
 * Используется только при USE_MOCK_API = true
 * Для использования: подключите этот скрипт в admin/index.html ПЕРЕД admin.js
 *
 * <script src="js/admin-mock-data.js"></script>
 * <script src="js/admin.js"></script>
 */

window.ADMIN_MOCK_DATA = {
    teams: [
        {
            id: 'team-001',
            name: 'Команда Alpha',
            leaderEmail: 'leader1@example.com',
            leaderName: 'Иван Петров',
            leaderReddyId: '111111',
            description: 'Основная команда по работе с партнёрами',
            membersCount: 5,
            isActive: true,
            createdAt: '2025-11-01T10:00:00Z'
        },
        {
            id: 'team-002',
            name: 'Команда Beta',
            leaderEmail: 'leader2@example.com',
            leaderName: 'Мария Сидорова',
            leaderReddyId: '222222',
            description: 'Команда продаж',
            membersCount: 3,
            isActive: true,
            createdAt: '2025-12-15T14:30:00Z'
        },
        {
            id: 'team-003',
            name: 'Архив команда',
            leaderEmail: 'leader3@example.com',
            leaderName: 'Сергей Козлов',
            leaderReddyId: '333333',
            description: 'Неактивная команда',
            membersCount: 0,
            isActive: false,
            createdAt: '2025-06-20T09:00:00Z'
        }
    ],
    users: [
        {
            email: 'admin@example.com',
            name: 'Администратор Системы',
            reddyId: '000001',
            picture: '',
            phone: '+7 999 000-00-01',
            telegram: 'admin_sys',
            position: 'Системный администратор',
            role: 'admin',
            teamId: '',
            status: 'active',
            createdAt: '2025-01-01T00:00:00Z'
        },
        {
            email: 'leader1@example.com',
            name: 'Иван Петров',
            reddyId: '111111',
            picture: '',
            phone: '+7 999 111-11-11',
            telegram: 'ivan_p',
            position: 'Руководитель',
            role: 'leader',
            teamId: 'team-001',
            status: 'active',
            createdAt: '2025-11-01T10:00:00Z'
        },
        {
            email: 'leader2@example.com',
            name: 'Мария Сидорова',
            reddyId: '222222',
            picture: '',
            phone: '+7 999 222-22-22',
            telegram: 'maria_s',
            position: 'Руководитель отдела',
            role: 'leader',
            teamId: 'team-002',
            status: 'active',
            createdAt: '2025-12-15T14:30:00Z'
        },
        {
            email: 'assistant1@example.com',
            name: 'Анна Волкова',
            reddyId: '111222',
            picture: '',
            phone: '+7 999 111-22-33',
            telegram: 'anna_v',
            position: 'Помощник',
            role: 'assistant',
            teamId: 'team-001',
            status: 'active',
            createdAt: '2025-11-10T12:00:00Z'
        },
        {
            email: 'sales1@example.com',
            name: 'Алексей Новиков',
            reddyId: '111333',
            picture: '',
            phone: '+7 999 111-33-44',
            telegram: 'alex_n',
            position: 'Менеджер',
            role: 'sales',
            teamId: 'team-001',
            status: 'active',
            createdAt: '2025-11-15T09:00:00Z'
        },
        {
            email: 'sales2@example.com',
            name: 'Елена Белова',
            reddyId: '111444',
            picture: '',
            phone: '',
            telegram: 'elena_b',
            position: 'Менеджер по продажам',
            role: 'sales',
            teamId: 'team-001',
            status: 'active',
            createdAt: '2025-11-20T11:00:00Z'
        },
        {
            email: 'blocked@example.com',
            name: 'Заблокированный Пользователь',
            reddyId: '999999',
            picture: '',
            phone: '',
            telegram: '',
            position: '',
            role: 'sales',
            teamId: 'team-001',
            status: 'blocked',
            createdAt: '2025-10-01T08:00:00Z'
        },
        {
            email: 'waiting@example.com',
            name: 'Ожидающий Приглашения',
            reddyId: '888888',
            picture: '',
            phone: '+7 999 888-88-88',
            telegram: 'waiting_user',
            position: '',
            role: 'sales',
            teamId: '',
            status: 'approved_no_team',
            createdAt: '2025-12-28T16:00:00Z'
        }
    ],
    requests: [
        {
            id: 'req-001',
            email: 'newuser1@example.com',
            name: 'Дмитрий Кузнецов',
            reddyId: '777001',
            picture: '',
            status: 'pending',
            requestedAt: '2026-01-02T14:30:00Z'
        },
        {
            id: 'req-002',
            email: 'newuser2@example.com',
            name: 'Ольга Морозова',
            reddyId: '777002',
            picture: '',
            status: 'pending',
            requestedAt: '2026-01-03T09:15:00Z'
        },
        {
            id: 'req-003',
            email: 'newuser3@example.com',
            name: 'Павел Соколов',
            reddyId: '777003',
            picture: '',
            status: 'pending',
            requestedAt: '2026-01-03T11:45:00Z'
        }
    ],
    permissions: {
        assistant: {
            partners: { view: true, edit: true, delete: false },
            'team-info': { view: true, edit: false, delete: false },
            traffic: { view: true, edit: true, delete: false },
            reports: { view: true, edit: false, delete: false },
            settings: { view: true, edit: true, delete: false },
            documentation: { view: true, edit: false, delete: false },
            'team-management': { view: false, edit: false, delete: false }
        },
        sales: {
            partners: { view: true, edit: true, delete: false },
            'team-info': { view: true, edit: false, delete: false },
            traffic: { view: true, edit: false, delete: false },
            reports: { view: true, edit: false, delete: false },
            settings: { view: true, edit: false, delete: false },
            documentation: { view: true, edit: false, delete: false },
            'team-management': { view: false, edit: false, delete: false }
        },
        partners_mgr: {
            partners: { view: true, edit: true, delete: true },
            'team-info': { view: true, edit: false, delete: false },
            traffic: { view: true, edit: false, delete: false },
            reports: { view: true, edit: true, delete: false },
            settings: { view: true, edit: false, delete: false },
            documentation: { view: true, edit: false, delete: false },
            'team-management': { view: false, edit: false, delete: false }
        },
        payments: {
            partners: { view: true, edit: false, delete: false },
            'team-info': { view: true, edit: false, delete: false },
            traffic: { view: true, edit: true, delete: false },
            reports: { view: true, edit: true, delete: false },
            settings: { view: true, edit: false, delete: false },
            documentation: { view: true, edit: false, delete: false },
            'team-management': { view: false, edit: false, delete: false }
        },
        antifraud: {
            partners: { view: true, edit: true, delete: false },
            'team-info': { view: true, edit: false, delete: false },
            traffic: { view: true, edit: false, delete: false },
            reports: { view: true, edit: false, delete: false },
            settings: { view: true, edit: false, delete: false },
            documentation: { view: true, edit: false, delete: false },
            'team-management': { view: false, edit: false, delete: false }
        },
        tech: {
            partners: { view: true, edit: false, delete: false },
            'team-info': { view: true, edit: false, delete: false },
            traffic: { view: true, edit: false, delete: false },
            reports: { view: true, edit: false, delete: false },
            settings: { view: true, edit: true, delete: false },
            documentation: { view: true, edit: true, delete: false },
            'team-management': { view: false, edit: false, delete: false }
        }
    },
    auditLog: [
        {
            id: 'log-001',
            timestamp: '2026-01-03T12:00:00Z',
            actorEmail: 'admin@example.com',
            actorRole: 'admin',
            action: 'user_approved',
            targetEmail: 'waiting@example.com',
            targetTeamId: '',
            oldValue: '',
            newValue: 'approved_no_team',
            details: 'Пользователь одобрен'
        },
        {
            id: 'log-002',
            timestamp: '2026-01-02T15:30:00Z',
            actorEmail: 'admin@example.com',
            actorRole: 'admin',
            action: 'role_changed',
            targetEmail: 'assistant1@example.com',
            targetTeamId: 'team-001',
            oldValue: 'sales',
            newValue: 'assistant',
            details: 'Повышение до помощника'
        },
        {
            id: 'log-003',
            timestamp: '2026-01-02T10:00:00Z',
            actorEmail: 'admin@example.com',
            actorRole: 'admin',
            action: 'user_blocked',
            targetEmail: 'blocked@example.com',
            targetTeamId: 'team-001',
            oldValue: 'active',
            newValue: 'blocked',
            details: 'Заблокирован за нарушения'
        },
        {
            id: 'log-004',
            timestamp: '2025-12-28T14:00:00Z',
            actorEmail: 'admin@example.com',
            actorRole: 'admin',
            action: 'team_created',
            targetEmail: 'leader2@example.com',
            targetTeamId: 'team-002',
            oldValue: '',
            newValue: 'Команда Beta',
            details: 'Создана новая команда'
        },
        {
            id: 'log-005',
            timestamp: '2025-12-20T09:00:00Z',
            actorEmail: 'admin@example.com',
            actorRole: 'admin',
            action: 'permissions_changed',
            targetEmail: '',
            targetTeamId: '',
            oldValue: '',
            newValue: 'sales',
            details: 'Изменены права роли sales'
        }
    ]
};
