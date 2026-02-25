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

    const ANTIFRAUD_RESULTS = [
        { value: 'passed', label: 'Пройдено' },
        { value: 'failed', label: 'Не пройдено' }
    ];

    const STEPS = [
        {
            number: 1,
            name: 'Регистрация лида',
            shortName: 'Лид',
            executor: 'sales',
            reviewer: null,
            fields: [
                { id: 'lead_source', type: 'select', label: 'Источник', required: true, options: LEAD_SOURCES },
                { id: 'contact_name', type: 'text', label: 'Имя контакта', required: true, placeholder: 'Иван Иванов' },
                { id: 'tg_username', type: 'text', label: 'Telegram', placeholder: '@username', oneOf: 'contact_required' },
                { id: 'phone', type: 'text', label: 'Телефон', placeholder: '+7 (___) ___-__-__', oneOf: 'contact_required' },
                { id: 'email', type: 'email', label: 'Email', placeholder: 'email@example.com' },
                { id: 'geo_country', type: 'select', label: 'Страна', required: true, options: GEO_COUNTRIES }
            ]
        },
        {
            number: 2,
            name: 'Данные партнёра',
            shortName: 'Данные',
            executor: 'sales',
            reviewer: 'assistant',
            fields: [
                { id: 'method_type', type: 'select', label: 'Тип метода', required: true, options: METHOD_TYPES },
                { id: 'method_name', type: 'select', label: 'Метод', required: true, options: METHOD_NAMES },
                { id: 'deal_conditions', type: 'textarea', label: 'Условия сделки', required: true, placeholder: 'Опишите условия...' },
                { id: 'prepayment_amount', type: 'text', label: 'Сумма предоплаты', placeholder: '0' },
                { id: 'country', type: 'text', label: 'Страна проживания', required: true },
                { id: 'city', type: 'text', label: 'Город' },
                { id: 'birth_date', type: 'date', label: 'Дата рождения' },
                { id: 'document_number', type: 'text', label: 'Номер документа', required: true },
                { id: 'wallets', type: 'list', label: 'Кошельки', placeholder: 'Добавить кошелёк' },
                { id: 'document_photo', type: 'file', label: 'Фото документа', required: true, accept: 'image/*' },
                { id: 'selfie_photo', type: 'file', label: 'Селфи с документом', accept: 'image/*' }
            ]
        },
        {
            number: 3,
            name: 'Создание аккаунта',
            shortName: 'Аккаунт',
            executor: 'assistant',
            reviewer: null,
            fields: [
                { id: 'account_login', type: 'text', label: 'Логин аккаунта', required: true, placeholder: 'Логин ЛК партнёра' },
                { id: 'account_password', type: 'text', label: 'Пароль аккаунта', required: true, placeholder: 'Пароль ЛК партнёра' }
            ]
        },
        {
            number: 4,
            name: 'Заполнение профиля',
            shortName: 'Профиль',
            executor: 'sales',
            reviewer: 'assistant',
            fields: [
                {
                    id: 'profile_checklist', type: 'checklist', label: 'Профиль заполнен', required: true,
                    items: [
                        { label: 'ФИО заполнено' },
                        { label: 'Контактные данные указаны' },
                        { label: 'Банковские реквизиты добавлены' },
                        { label: 'Документы загружены' },
                        { label: 'Фото профиля установлено' }
                    ]
                }
            ]
        },
        {
            number: 5,
            name: 'Антифрод проверка',
            shortName: 'Антифрод',
            executor: 'assistant',
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
            executor: 'sales',
            reviewer: 'assistant',
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
            executor: 'assistant',
            reviewer: null,
            fields: [
                { id: 'messenger_login', type: 'text', label: 'Логин мессенджера', required: true },
                { id: 'messenger_password', type: 'text', label: 'Пароль мессенджера', required: true },
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
            name: 'Финализация',
            shortName: 'Карточка',
            executor: 'assistant',
            reviewer: null,
            fields: [
                { id: 'subagent', type: 'text', label: 'Субагент', required: true, autofill: { step: 1, field: 'contact_name' } },
                { id: 'subagent_id', type: 'text', label: 'ID субагента', required: true },
                { id: 'method', type: 'text', label: 'Метод', required: true, autofill: { step: 2, field: 'method_name' } }
            ]
        }
    ];

    function getStep(number) {
        return STEPS.find(s => s.number === number);
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

    function getOptionLabel(options, value) {
        const opt = options.find(o => o.value === value);
        return opt ? opt.label : value;
    }

    return {
        STEPS,
        STATUSES,
        LEAD_SOURCES,
        GEO_COUNTRIES,
        METHOD_TYPES,
        METHOD_NAMES,
        ANTIFRAUD_RESULTS,
        REASSIGN_REASONS,
        HISTORY_ACTIONS,
        getStep,
        isExecutor,
        isReviewer,
        hasReviewer,
        getStepExecutor,
        getStepReviewer,
        getStatusLabel,
        getStatusClass,
        getHistoryActionLabel,
        getOptionLabel
    };
})();
