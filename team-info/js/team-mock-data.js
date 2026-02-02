/**
 * MOCK DATA для локальной разработки (модуль team-info)
 *
 * Используется только при USE_MOCK_API = true
 * Для использования: подключите этот скрипт в team-info/index.html ПЕРЕД team-api.js
 *
 * <script src="js/team-mock-data.js"></script>
 * <script src="js/team-api.js"></script>
 */

window.TEAM_MOCK_DATA = {
    team: {
        id: 'team-001',
        name: 'Команда Alpha',
        description: 'Основная команда по работе с партнёрами',
        leaderEmail: 'leader@example.com',
        assistantCanInvite: false,
        assistantCanChangeRoles: false
    },
    members: [
        {
            email: 'leader@example.com',
            name: 'Иван Петров',
            reddyId: '123456',
            picture: '',
            phone: '+7 999 111-22-33',
            telegram: 'ivan_petrov',
            position: 'Руководитель отдела',
            role: 'leader',
            status: 'active'
        },
        {
            email: 'assistant@example.com',
            name: 'Мария Сидорова',
            reddyId: '234567',
            picture: '',
            phone: '+7 999 222-33-44',
            telegram: 'maria_s',
            position: 'Помощник руководителя',
            role: 'assistant',
            status: 'active'
        },
        {
            email: 'sales1@example.com',
            name: 'Алексей Козлов',
            reddyId: '345678',
            picture: '',
            phone: '+7 999 333-44-55',
            telegram: 'alexey_k',
            position: 'Менеджер',
            role: 'sales',
            status: 'active'
        },
        {
            email: 'sales2@example.com',
            name: 'Елена Новикова',
            reddyId: '456789',
            picture: '',
            phone: '',
            telegram: 'elena_n',
            position: 'Менеджер по продажам',
            role: 'sales',
            status: 'active'
        }
    ],
    waitingUsers: [
        {
            email: 'newuser1@example.com',
            name: 'Анна Ждущая',
            reddyId: '111222',
            picture: ''
        },
        {
            email: 'newuser2@example.com',
            name: 'Пётр Ожидающий',
            reddyId: '222333',
            picture: ''
        }
    ]
};
