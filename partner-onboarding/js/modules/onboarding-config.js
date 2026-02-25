/* onboarding-config.js — Конфигурация шагов, полей, статусов */

const OnboardingConfig = (() => {
    'use strict';

    const STATUSES = {
        in_progress: { label: 'В работе', cssClass: 'status--in-progress' },
        on_review: { label: 'На проверке', cssClass: 'status--on-review' },
        completed: { label: 'Завершено', cssClass: 'status--completed' },
        cancelled: { label: 'Отменено', cssClass: 'status--cancelled' }
    };

    const LEAD_SOURCES = [
        { value: 'telegram', label: 'Telegram' },
        { value: 'banner', label: 'Баннер' },
        { value: 'referral', label: 'Реферал' },
        { value: 'cold_call', label: 'Холодный звонок' },
        { value: 'conference', label: 'Конференция' },
        { value: 'website', label: 'Сайт' },
        { value: 'other', label: 'Другое' }
    ];

    const LEAD_STATUSES = [
        { value: 'new', label: 'Новый' },
        { value: 'in_conversation', label: 'В переписке' },
        { value: 'ignored', label: 'Игнор' },
        { value: 'refused', label: 'Отказ' }
    ];

    const GEO_COUNTRIES = [
        { value: 'kz', label: 'Казахстан' },
        { value: 'uz', label: 'Узбекистан' },
        { value: 'kg', label: 'Кыргызстан' }
    ];

    const METHOD_TYPES = [
        { value: 'bank_transfer', label: 'Банковский перевод' },
        { value: 'crypto', label: 'Криптовалюта' },
        { value: 'e_wallet', label: 'Электронный кошелёк' }
    ];

    const METHOD_NAMES = [
        { value: 'kaspi', label: 'Kaspi' },
        { value: 'halyk', label: 'Halyk Bank' },
        { value: 'jusan', label: 'Jusan' },
        { value: 'uzcard', label: 'UzCard' },
        { value: 'humo', label: 'Humo' },
        { value: 'usdt_trc20', label: 'USDT TRC-20' },
        { value: 'usdt_erc20', label: 'USDT ERC-20' },
        { value: 'btc', label: 'Bitcoin' },
        { value: 'other', label: 'Другое' }
    ];

    const PREPAYMENT_METHODS = [
        { value: 'tether_trc20', label: 'Tether on Tron TRC20' }
    ];

    const REASSIGN_REASONS = [
        { value: 'vacation', label: 'Отпуск' },
        { value: 'sick', label: 'Больничный' },
        { value: 'fired', label: 'Увольнение' },
        { value: 'rebalance', label: 'Перераспределение' }
    ];

    const HISTORY_ACTIONS = {
        create: { label: 'Создано' },
        submit: { label: 'Отправлено' },
        approve: { label: 'Одобрено' },
        reject: { label: 'Возвращено' },
        reassign: { label: 'Передано' },
        rollback: { label: 'Откат' },
        withdraw: { label: 'Отозвано' },
        complete: { label: 'Завершено' },
        cancel: { label: 'Отменено' },
        reactivate: { label: 'Восстановлено' }
    };

    const ACCOUNT_CREATORS = [
        { value: 'executor', label: 'Менеджер (я сам)' },
        { value: 'reviewer', label: 'Проверяющий' }
    ];

    const ANTIFRAUD_RESULTS = [
        { value: 'passed', label: 'Пройдено' },
        { value: 'failed', label: 'Не пройдено' }
    ];

    const STEPS = [
        {
            number: 1,
            name: 'Входящий лид',
            shortName: 'Лид',
            executor: 'executor',
            reviewer: null,
            fields: [
                { id: 'lead_source', type: 'select', label: 'Источник лида', required: true, options: LEAD_SOURCES },
                { id: 'lead_status', type: 'select', label: 'Статус', required: true, options: LEAD_STATUSES },
                { id: 'lead_date', type: 'date', label: 'Дата обращения', required: true },
                { id: 'geo_country', type: 'select', label: 'Страна поиска партнера', required: true, options: GEO_COUNTRIES },
                { id: 'contact_name', type: 'text', label: 'ФИО', placeholder: 'Имя контактного лица' },
                { id: 'tg_username', type: 'text', label: 'Юзернейм ТГ', placeholder: '@username', oneOf: 'contact_required' },
                { id: 'phone', type: 'text', label: 'Номер телефона', placeholder: '+7 999 123 45 67', oneOf: 'contact_required' },
                { id: 'email', type: 'email', label: 'Почта', placeholder: 'email@example.com' },
                { id: 'reject_reason', type: 'textarea', label: 'Причина отказа', placeholder: 'Укажите причину отказа...' }
            ]
        },
        {
            number: 2,
            name: 'Полная информация',
            shortName: 'Инфо',
            executor: 'executor',
            reviewer: 'reviewer',
            fields: [
                { id: 'method_type', type: 'select', label: 'Тип метода', required: true, options: METHOD_TYPES },
                { id: 'method_name', type: 'select', label: 'Название метода', required: true, options: METHOD_NAMES },
                { id: 'deal_1', type: 'text', label: 'Пополнения' },
                { id: 'deal_2', type: 'text', label: 'Выводы' },
                { id: 'deal_3', type: 'text', label: 'Компенсация' },
                { id: 'prepayment_amount', type: 'text', label: 'Сумма предоплаты' },
                { id: 'prepayment_method', type: 'select', label: 'Способ предоплаты', required: true, options: PREPAYMENT_METHODS },
                { id: 'country', type: 'text', label: 'Страна из документа', required: true },
                { id: 'city', type: 'text', label: 'Город', required: true },
                { id: 'birth_date', type: 'date', label: 'Дата рождения', required: true },
                { id: 'phone', type: 'text', label: 'Номер телефона', required: true },
                { id: 'email', type: 'email', label: 'Электронная почта', required: true },
                { id: 'document_number', type: 'text', label: 'Номер документа', required: true },
                { id: 'wallets', type: 'list', label: 'Номера кошельков', required: true, placeholder: 'Номер кошелька' },
                { id: 'document_photo', type: 'file', label: 'Фото документа', required: true, accept: 'image/*' },
                { id: 'selfie_photo', type: 'file', label: 'Фото селфи с документом', required: true, accept: 'image/*' }
            ]
        },
        {
            number: 3,
            name: 'Создание аккаунта',
            shortName: 'Аккаунт',
            executor: 'executor',
            reviewer: null,
            dynamicExecutor: {
                field: 'account_creator',
                executorValue: 'executor',
                reviewerValue: 'reviewer'
            },
            fields: [
                { id: 'account_creator', type: 'select', label: 'Кто создаёт аккаунт', required: true, options: ACCOUNT_CREATORS },
                { id: 'account_login', type: 'text', label: 'Логин', required: true, placeholder: 'Логин аккаунта', showWhen: { phase: 'fill' } },
                { id: 'account_password', type: 'text', label: 'Пароль', required: true, placeholder: 'Пароль аккаунта', showWhen: { phase: 'fill', onlyCreator: 'reviewer' } }
            ]
        },
        {
            number: 4,
            name: 'Заполнение профиля',
            shortName: 'Профиль',
            executor: 'executor',
            reviewer: 'reviewer',
            fields: [
                {
                    id: 'profile_checklist', type: 'checklist', label: 'Чеклист заполнения ЛК', required: true,
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
            number: 5,
            name: 'Антифрод проверка',
            shortName: 'Антифрод',
            executor: 'reviewer',
            reviewer: null,
            fields: [
                { id: 'antifraud_result', type: 'select', label: 'Результат проверки', required: true, options: ANTIFRAUD_RESULTS },
                { id: 'antifraud_comment', type: 'textarea', label: 'Комментарий', placeholder: 'Детали проверки...' }
            ]
        },
        {
            number: 6,
            name: 'Пополнение счёта',
            shortName: 'Депозит',
            executor: 'executor',
            reviewer: 'reviewer',
            fields: [
                {
                    id: 'deposit_checklist', type: 'checklist', label: 'Подтверждение', required: true,
                    items: [
                        { label: 'Партнёр пополнил счёт' }
                    ]
                },
                { id: 'deposit_amount', type: 'text', label: 'Сумма пополнения', placeholder: '0' },
                { id: 'deposit_comment', type: 'textarea', label: 'Комментарий', placeholder: 'Детали...' }
            ]
        },
        {
            number: 7,
            name: 'Корп. мессенджер',
            shortName: 'Мессенджер',
            executor: 'reviewer',
            reviewer: null,
            fields: [
                { id: 'messenger_login', type: 'text', label: 'Логин', required: true, placeholder: 'Логин аккаунта' },
                { id: 'messenger_password', type: 'text', label: 'Пароль', required: true, placeholder: 'Пароль аккаунта' },
                {
                    id: 'messenger_checklist', type: 'checklist', label: 'Подтверждение',
                    items: [
                        { label: 'Партнёр вошёл в мессенджер' }
                    ]
                }
            ]
        },
        {
            number: 8,
            name: 'Финализация карточки',
            shortName: 'Карточка',
            executor: 'reviewer',
            reviewer: null,
            fields: [
                { id: 'subagent', type: 'text', label: 'Имя субагента', required: true, autofill: { step: 1, field: 'contact_name' } },
                { id: 'subagent_id', type: 'text', label: 'Номер субагента', required: true },
                { id: 'method', type: 'text', label: 'Метод', required: true, autofill: { step: 2, field: 'method_name' } }
            ]
        }
    ];

    function getStep(number) {
        return STEPS.find(s => s.number === number);
    }

    function getStepLabel(number) {
        const step = getStep(number);
        return step ? step.name : 'Шаг ' + number;
    }

    function isExecutor(stepNumber, role) {
        const step = getStep(stepNumber);
        return step && step.executor === role;
    }

    function isReviewer(stepNumber, role) {
        const step = getStep(stepNumber);
        return step && step.reviewer === role;
    }

    function hasReviewer(stepNumber) {
        const step = getStep(stepNumber);
        return step && step.reviewer !== null;
    }

    function getStepExecutor(stepNumber) {
        const step = getStep(stepNumber);
        return step ? step.executor : null;
    }

    function getStepReviewer(stepNumber) {
        const step = getStep(stepNumber);
        return step ? step.reviewer : null;
    }

    function getStatusLabel(status) {
        return STATUSES[status] ? STATUSES[status].label : status;
    }

    function getStatusClass(status) {
        return STATUSES[status] ? STATUSES[status].cssClass : '';
    }

    function getHistoryActionLabel(action) {
        return HISTORY_ACTIONS[action] ? HISTORY_ACTIONS[action].label : action;
    }

    function getStepEffectiveExecutor(stepNumber, stageData) {
        const step = getStep(stepNumber);
        if (!step || !step.dynamicExecutor) return step ? step.executor : null;
        const data = (stageData && stageData[stepNumber]) || {};
        if (data._handoff_complete) return step.executor;
        const choice = data[step.dynamicExecutor.field];
        if (choice === step.dynamicExecutor.reviewerValue) return 'reviewer';
        return step.executor;
    }

    function getOptionLabel(options, value) {
        const opt = options.find(o => o.value === value);
        return opt ? opt.label : value;
    }

    return {
        STEPS,
        STATUSES,
        LEAD_SOURCES,
        LEAD_STATUSES,
        GEO_COUNTRIES,
        METHOD_TYPES,
        METHOD_NAMES,
        PREPAYMENT_METHODS,
        ACCOUNT_CREATORS,
        ANTIFRAUD_RESULTS,
        REASSIGN_REASONS,
        HISTORY_ACTIONS,
        getStep,
        getStepLabel,
        isExecutor,
        isReviewer,
        hasReviewer,
        getStepExecutor,
        getStepReviewer,
        getStepEffectiveExecutor,
        getStatusLabel,
        getStatusClass,
        getHistoryActionLabel,
        getOptionLabel
    };
})();
