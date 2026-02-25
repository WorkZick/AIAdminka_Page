/**
 * OnboardingConfig — Конфигурация шагов заведения партнёра
 * Определяет шаги, роли executor/reviewer, поля форм, фазы, статусы
 * В будущем: загрузка с бэкенда через PropertiesService
 */

const OnboardingConfig = {
    TEMPLATE_ID: 'TTPL_PARTNER_ONBOARDING',

    /** Статусы заявки */
    STATUSES: {
        executor: { label: 'У исполнителя', cssClass: 'status-badge--executor' },
        reviewer: { label: 'На проверке', cssClass: 'status-badge--reviewer' },
        revision: { label: 'На доработке', cssClass: 'status-badge--revision' },
        declined: { label: 'Отклонено', cssClass: 'status-badge--declined' },
        completed: { label: 'Завершено', cssClass: 'status-badge--completed' },
        cancelled: { label: 'Отменено', cssClass: 'status-badge--cancelled' }
    },

    /** Источники лидов */
    LEAD_SOURCES: [
        { id: 'telegram', label: 'Telegram' },
        { id: 'banner', label: 'Баннер' },
        { id: 'referral', label: 'Реферал' },
        { id: 'cold_call', label: 'Холодный звонок' },
        { id: 'conference', label: 'Конференция' },
        { id: 'website', label: 'Сайт' },
        { id: 'other', label: 'Другое' }
    ],

    /** Получить label источника лида */
    getLeadSourceLabel(id) {
        return this.LEAD_SOURCES.find(s => s.id === id)?.label || id;
    },

    /** Причины передачи */
    REASSIGN_REASONS: {
        vacation: 'Отпуск',
        sick: 'Болезнь',
        fired: 'Увольнение',
        rebalance: 'Перераспределение нагрузки'
    },

    /** Labels действий в истории (generic, переиспользуемые) */
    HISTORY_ACTIONS: {
        approve: { label: 'Одобрено', icon: '&#10003;', iconClass: 'approved' },
        complete: { label: 'Завершено', icon: '&#10003;', iconClass: 'approved' },
        reject: { label: 'Возвращено', icon: '&#10007;', iconClass: 'rejected' },
        reassign: { label: 'Передано', icon: '&#8634;', iconClass: 'reassigned' },
        withdraw: { label: 'Отозвано', icon: '&#8630;', iconClass: 'reassigned' },
        reactivate: { label: 'Восстановлено', icon: '&#8635;', iconClass: 'approved' },
        rollback: { label: 'Откат', icon: '&#8634;', iconClass: 'rejected' },
        cancel: { label: 'Отменено', icon: '&#10007;', iconClass: 'rejected' }
    },

    /** Получить данные действия истории (generic или phase-specific) */
    getHistoryAction(action) {
        // Generic actions
        if (this.HISTORY_ACTIONS[action]) return this.HISTORY_ACTIONS[action];

        // Phase-specific: format "phase:{step}:{phase_id}"
        if (action.startsWith('phase:')) {
            const parts = action.split(':');
            const stepNum = parseInt(parts[1], 10);
            const phaseId = parts[2];
            const stage = this.getStage(stepNum);
            const phase = stage?.phases?.find(p => p.id === phaseId);
            if (phase) {
                return { label: phase.label, icon: '&#9881;', iconClass: 'reassigned' };
            }
        }

        return null;
    },

    /** Статусы лида (Шаг 1) */
    LEAD_STATUSES: [
        { value: 'new', label: 'Новый' },
        { value: 'in_conversation', label: 'В переписке' },
        { value: 'ignored', label: 'Игнор' },
        { value: 'refused', label: 'Отказ' }
    ],

    /** Страны ГЕО (Шаг 1) */
    GEO_COUNTRIES: [
        { value: 'mongolia', label: 'Монголия' },
        { value: 'iran', label: 'Иран' },
        { value: 'afghanistan', label: 'Афганистан' }
    ],

    /** Типы методов */
    METHOD_TYPES: [
        { value: 'bank_transfer', label: 'BankTransfer' },
        { value: 'team_cash', label: 'TeamCash' },
        { value: 'affiliate', label: 'Affiliate' }
    ],

    /** Названия методов: country → method_type → [names] */
    METHOD_NAMES: {
        mongolia: {
            bank_transfer: [
                { value: 'khaanbank', label: 'KhaanBank' },
                { value: 'golomtbank', label: 'GolomtBank' },
                { value: 'mbank', label: 'MBank' }
            ]
        },
        afghanistan: {
            bank_transfer: [
                { value: 'hesabpay', label: 'HesabPay' },
                { value: 'atomapay', label: 'AtomaPay' },
                { value: 'mhawala', label: 'mHawala' }
            ]
        }
    },

    /** Условия сделки: country → method_type → [{label, value}] */
    DEAL_CONDITIONS: {
        afghanistan: {
            bank_transfer: [
                { id: 'deal_1', label: 'Пополнения', value: '7%' },
                { id: 'deal_2', label: 'Выводы', value: '3%' },
                { id: 'deal_3', label: 'Компенсация', value: '6%' }
            ]
        }
    },

    /** Сумма предоплаты: country → method_type → amount (строка) */
    PREPAYMENT_AMOUNTS: {
        _default: '100$'
    },

    /** Получить названия методов по ГЕО + тип */
    getMethodNames(country, methodType) {
        return this.METHOD_NAMES[country]?.[methodType] || [];
    },

    /** Получить условия сделки по ГЕО + тип метода */
    getDealConditions(country, methodType) {
        return this.DEAL_CONDITIONS[country]?.[methodType] || [];
    },

    /** Получить сумму предоплаты по ГЕО + тип метода */
    getPrepaymentAmount(country, methodType) {
        return this.PREPAYMENT_AMOUNTS[country]?.[methodType]
            || this.PREPAYMENT_AMOUNTS._default
            || '';
    },

    /** Шаги процесса заведения партнёра */
    stages: [
        {
            number: 1,
            name: 'Входящий лид',
            shortName: 'Лид',
            description: 'Регистрация входящего лида',
            executorRole: 'sales',
            reviewerRole: 'assistant',
            noApproval: true,
            estimatedDays: 1,
            fields: [
                {
                    id: 'lead_source',
                    type: 'select',
                    label: 'Источник лида',
                    required: true,
                    options: [
                        { value: 'telegram', label: 'Telegram' },
                        { value: 'banner', label: 'Баннер' },
                        { value: 'referral', label: 'Реферал' },
                        { value: 'cold_call', label: 'Холодный звонок' },
                        { value: 'conference', label: 'Конференция' },
                        { value: 'website', label: 'Сайт' },
                        { value: 'other', label: 'Другое' }
                    ]
                },
                {
                    id: 'lead_status',
                    type: 'select',
                    label: 'Статус',
                    required: true,
                    options: [
                        { value: 'new', label: 'Новый' },
                        { value: 'in_conversation', label: 'В переписке' },
                        { value: 'ignored', label: 'Игнор' },
                        { value: 'refused', label: 'Отказ' }
                    ]
                },
                {
                    id: 'lead_date',
                    type: 'date',
                    label: 'Дата обращения',
                    required: true
                },
                {
                    id: 'geo_country',
                    type: 'select',
                    label: 'Страна поиска партнера',
                    required: true,
                    options: [
                        { value: 'mongolia', label: 'Монголия' },
                        { value: 'iran', label: 'Иран' },
                        { value: 'afghanistan', label: 'Афганистан' }
                    ]
                },
                {
                    id: 'contact_name',
                    type: 'text',
                    label: 'ФИО',
                    placeholder: 'Имя контактного лица'
                },
                {
                    id: 'tg_username',
                    type: 'text',
                    label: 'Юзернейм ТГ',
                    placeholder: '@username',
                    helpText: 'Обязательно, если не заполнен телефон',
                    oneOf: 'contact_required'
                },
                {
                    id: 'phone',
                    type: 'text',
                    label: 'Номер телефона',
                    placeholder: '+7 999 123 45 67',
                    helpText: 'Обязательно, если не заполнен юзернейм ТГ',
                    oneOf: 'contact_required'
                },
                {
                    id: 'email',
                    type: 'email',
                    label: 'Почта',
                    placeholder: 'email@example.com'
                },
                {
                    id: 'reject_reason',
                    type: 'textarea',
                    label: 'Причина отказа',
                    placeholder: 'Укажите причину отказа...',
                    showWhen: { field: 'lead_status', value: 'refused' },
                    requiredWhen: { field: 'lead_status', value: 'refused' }
                }
            ]
        },
        {
            number: 2,
            name: 'Полная информация',
            shortName: 'Инфо',
            description: 'Полная информация о лиде (документы, фото, кошельки)',
            executorRole: 'sales',
            reviewerRole: 'assistant',
            estimatedDays: 2,
            fields: [
                {
                    id: 'method_type',
                    type: 'select',
                    label: 'Тип метода',
                    required: true,
                    options: [
                        { value: 'bank_transfer', label: 'BankTransfer' },
                        { value: 'team_cash', label: 'TeamCash' },
                        { value: 'affiliate', label: 'Affiliate' }
                    ]
                },
                {
                    id: 'method_name',
                    type: 'select',
                    label: 'Название метода',
                    required: true,
                    dynamic: true,
                    options: []
                },
                {
                    id: 'deal_1',
                    type: 'text',
                    label: 'Условие 1',
                    dynamicDeal: true,
                    editableBy: ['reviewer']
                },
                {
                    id: 'deal_2',
                    type: 'text',
                    label: 'Условие 2',
                    dynamicDeal: true,
                    editableBy: ['reviewer']
                },
                {
                    id: 'deal_3',
                    type: 'text',
                    label: 'Условие 3',
                    dynamicDeal: true,
                    editableBy: ['reviewer']
                },
                {
                    id: 'prepayment_amount',
                    type: 'text',
                    label: 'Сумма предоплаты',
                    dynamicDeal: true,
                    editableBy: ['reviewer']
                },
                {
                    id: 'prepayment_method',
                    type: 'select',
                    label: 'Способ предоплаты',
                    required: true,
                    options: [
                        { value: 'tether_trc20', label: 'Tether on Tron TRC20' }
                    ]
                },
                {
                    id: 'country',
                    type: 'text',
                    label: 'Страна из документа',
                    required: true
                },
                {
                    id: 'city',
                    type: 'text',
                    label: 'Город',
                    required: true
                },
                {
                    id: 'birth_date',
                    type: 'date',
                    label: 'Дата рождения',
                    required: true
                },
                {
                    id: 'phone',
                    type: 'text',
                    label: 'Номер телефона',
                    required: true
                },
                {
                    id: 'email',
                    type: 'email',
                    label: 'Электронная почта',
                    required: true
                },
                {
                    id: 'document_number',
                    type: 'text',
                    label: 'Номер документа',
                    required: true
                },
                {
                    id: 'wallets',
                    type: 'list',
                    label: 'Номера кошельков',
                    required: true,
                    placeholder: 'Номер кошелька',
                    helpText: 'Добавьте один или несколько кошельков'
                },
                {
                    id: 'document_photo',
                    type: 'file',
                    label: 'Фото документа',
                    required: true,
                    accept: 'image/*',
                    helpText: 'Загрузите фото документа'
                },
                {
                    id: 'selfie_photo',
                    type: 'file',
                    label: 'Фото селфи с документом',
                    required: true,
                    accept: 'image/*',
                    helpText: 'Загрузите селфи с документом'
                }
            ]
        },
        {
            number: 3,
            name: 'Аккаунт и ЛК',
            shortName: 'Аккаунт',
            description: 'Создание аккаунта и заполнение ЛК партнёром',
            executorRole: 'sales',
            reviewerRole: 'assistant',
            estimatedDays: 3,
            phases: [
                { id: 'waiting', label: 'Ожидание создания аккаунта', owner: 'reviewer' },
                { id: 'created', label: 'Аккаунт создан', owner: 'executor' },
                { id: 'filled', label: 'Профиль заполнен', owner: 'reviewer' }
            ],
            fields: [
                {
                    id: 'account_creator',
                    type: 'select',
                    label: 'Кто создаёт аккаунт',
                    required: true,
                    options: [
                        { value: 'reviewer', label: 'Reviewer (ассистент)' },
                        { value: 'partner', label: 'Партнёр (самостоятельно)' }
                    ]
                },
                {
                    id: 'phase',
                    type: 'internal',
                    label: 'Фаза шага'
                },
                {
                    id: 'account_login',
                    type: 'text',
                    label: 'Логин',
                    placeholder: 'Логин аккаунта',
                    editableBy: ['reviewer'],
                    showWhen: { field: 'phase', value: ['waiting', 'created', 'filled'] }
                },
                {
                    id: 'account_password',
                    type: 'text',
                    label: 'Пароль',
                    placeholder: 'Пароль аккаунта',
                    editableBy: ['reviewer'],
                    showWhen: { field: 'phase', value: ['waiting', 'created', 'filled'] }
                },
                {
                    id: 'profile_checklist',
                    type: 'checklist',
                    label: 'Чеклист заполнения ЛК',
                    showWhen: { field: 'phase', value: ['created', 'filled'] },
                    items: [
                        { label: 'ФИО' },
                        { label: 'Контактные данные' },
                        { label: 'Банковские реквизиты' },
                        { label: 'Документы' },
                        { label: 'Фото профиля' }
                    ]
                }
            ]
        },
        {
            number: 4,
            name: 'Антифрод проверка',
            shortName: 'Антифрод',
            description: 'Проверка через антифрод-отдел',
            executorRole: 'sales',
            reviewerRole: 'assistant',
            autoSubmit: true,
            estimatedDays: 3,
            phases: [
                { id: 'check', label: 'Ожидание проверки', owner: 'reviewer', onReject: 'declined' },
                { id: 'approved', label: 'Ожидание пополнения', owner: 'executor' },
                { id: 'deposit_ok', label: 'Проверка пополнения', owner: 'reviewer' }
            ],
            fields: []
        },
        {
            number: 5,
            name: 'Корп. мессенджер',
            shortName: 'Мессенджер',
            description: 'Создание аккаунта в корпоративном мессенджере',
            executorRole: 'sales',
            reviewerRole: 'assistant',
            estimatedDays: 1,
            phases: [
                { id: 'waiting', label: 'Ожидание создания мессенджера', owner: 'reviewer' },
                { id: 'created', label: 'Мессенджер создан', owner: 'executor' },
                { id: 'logged', label: 'Подтверждение входа', owner: 'reviewer' }
            ],
            fields: [
                {
                    id: 'phase',
                    type: 'internal',
                    label: 'Фаза шага'
                },
                {
                    id: 'messenger_login',
                    type: 'text',
                    label: 'Логин',
                    placeholder: 'Логин аккаунта',
                    editableBy: ['reviewer'],
                    showWhen: { field: 'phase', value: ['waiting', 'created', 'logged'] }
                },
                {
                    id: 'messenger_password',
                    type: 'text',
                    label: 'Пароль',
                    placeholder: 'Пароль аккаунта',
                    editableBy: ['reviewer'],
                    showWhen: { field: 'phase', value: ['waiting', 'created', 'logged'] }
                }
            ]
        },
        {
            number: 6,
            name: 'Финализация карточки',
            shortName: 'Карточка',
            description: 'Заполнение финальных данных для создания карточки партнёра',
            executorRole: 'assistant',
            reviewerRole: null,
            noApproval: true,
            estimatedDays: 1,
            fields: [
                { id: 'subagent', type: 'text', label: 'Имя субагента', required: true },
                { id: 'subagentId', type: 'text', label: 'Номер субагента', required: true },
                { id: 'method', type: 'text', label: 'Метод', required: true }
            ]
        },
        {
            number: 7,
            name: 'Завершение',
            shortName: 'Готово',
            description: 'Заведение партнёра завершено',
            executorRole: 'system',
            reviewerRole: null,
            auto: true,
            estimatedDays: 0,
            fields: []
        }
    ],

    /** Получить шаг по номеру */
    getStage(number) {
        return this.stages.find(s => s.number === number) || null;
    },

    /** Общее количество шагов */
    get totalStages() {
        return this.stages.length;
    },

    /** Получить label статуса */
    getStatusLabel(status) {
        return this.STATUSES[status]?.label || status;
    },

    /** Получить CSS класс статуса */
    getStatusClass(status) {
        return this.STATUSES[status]?.cssClass || '';
    },

    /** Получить label причины передачи */
    getReasonLabel(reason) {
        return this.REASSIGN_REASONS[reason] || reason;
    },

    /** Получить фазу шага по ID */
    getPhase(stageNumber, phaseId) {
        const stage = this.getStage(stageNumber);
        return stage?.phases?.find(p => p.id === phaseId) || null;
    },

    /** Получить label фазы */
    getPhaseLabel(stageNumber, phaseId) {
        const phase = this.getPhase(stageNumber, phaseId);
        return phase?.label || '';
    },

    /** Проверить, является ли пользователь executor на данном шаге */
    isExecutor(stageNumber, userRole) {
        const stage = this.getStage(stageNumber);
        if (!stage) return false;
        if (stage.auto) return false;
        if (userRole === 'admin' || userRole === 'leader') return true;
        return stage.executorRole === userRole;
    },

    /** Проверить, является ли пользователь reviewer на данном шаге */
    isReviewer(stageNumber, userRole) {
        const stage = this.getStage(stageNumber);
        if (!stage || !stage.reviewerRole) return false;
        if (stage.auto) return false;
        if (userRole === 'admin' || userRole === 'leader') return true;
        return stage.reviewerRole === userRole;
    },

    /** Название роли (через RolesConfig если доступен) */
    getRoleName(role) {
        if (role === 'system') return 'Система';
        if (typeof RolesConfig !== 'undefined') {
            return RolesConfig.getName(role);
        }
        return role;
    },

    /** Проверить совпадение showWhen (поддержка массива значений) */
    matchesShowWhen(showWhen, formData) {
        if (!showWhen) return true;
        const condValue = formData?.[showWhen.field];
        if (Array.isArray(showWhen.value)) return showWhen.value.includes(condValue);
        return condValue === showWhen.value;
    },

    /** Получить поля формы, отфильтрованные по видимости */
    getVisibleFields(stageNumber, formData) {
        const stage = this.getStage(stageNumber);
        if (!stage || !stage.fields) return [];

        return stage.fields.filter(field => {
            if (field.type === 'internal') return false;
            return this.matchesShowWhen(field.showWhen, formData);
        });
    }
};
