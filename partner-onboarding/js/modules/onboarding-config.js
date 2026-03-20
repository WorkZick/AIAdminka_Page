/* onboarding-config.js — Конфигурация шагов, полей, статусов */

const OnboardingConfig = (() => {
    'use strict';

    const STATUSES = {
        new: { label: 'Новая', cssClass: 'status--new' },
        in_progress: { label: 'В работе', cssClass: 'status--in-progress' },
        on_review: { label: 'На проверке', cssClass: 'status--on-review' },
        approved: { label: 'Проверка пройдена', cssClass: 'status--approved' },
        revision_needed: { label: 'Требуется доработка', cssClass: 'status--revision-needed' },
        completed: { label: 'Завершена', cssClass: 'status--completed' },
        cancelled: { label: 'Отменена', cssClass: 'status--cancelled' }
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
        reactivate: { label: 'Восстановлено' },
        import: { label: 'Импорт' },
        assign: { label: 'Взято в работу' }
    };

    const ACCOUNT_CREATORS = [
        { value: 'executor', label: 'Менеджер (я сам)' },
        { value: 'reviewer', label: 'Проверяющий' }
    ];

    const ANTIFRAUD_RESULTS = [
        { value: 'passed', label: 'Пройдено' },
        { value: 'failed', label: 'Не пройдено' }
    ];

    const CASCADE_FIELDS = [
        {
            trigger: 'condition_country',
            clears: ['method_type', 'method_name', 'deal_1', 'deal_2', 'deal_3', 'prepayment_method', 'prepayment_amount']
        },
        {
            trigger: 'method_type',
            clears: ['method_name', 'deal_1', 'deal_2', 'deal_3', 'prepayment_method', 'prepayment_amount']
        },
        {
            trigger: 'method_name',
            clears: [],
            autofill: true
        }
    ];

    const STEPS = [
        {
            number: 1,
            name: 'Входящий лид',
            shortName: 'Лид',
            executor: 'executor',
            reviewer: null,
            isLeadStep: true,
            hasGeoCountry: true,
            fields: [
                { id: 'lead_source', type: 'select', label: 'Источник лида', required: true, options: LEAD_SOURCES, readonlyForImport: true },
                { id: 'lead_status', type: 'select', label: 'Статус', required: true, options: LEAD_STATUSES, asSubmitButton: true },
                { id: 'lead_date', type: 'date', label: 'Дата обращения', required: true, readonlyForImport: true },
                { id: 'geo_country', type: 'select', label: 'Страна поиска партнера', required: true, options: GEO_COUNTRIES, readonlyForImport: true },
                { id: 'contact_name', type: 'text', label: 'ФИО', placeholder: 'Имя контактного лица' },
                { id: 'tg_username', type: 'text', label: 'Юзернейм ТГ', placeholder: '@username', oneOf: 'contact_required' },
                { id: 'phone', type: 'text', label: 'Номер телефона', placeholder: '+7 999 123 45 67', oneOf: 'contact_required' },
                { id: 'email', type: 'email', label: 'Почта', placeholder: 'email@example.com' },
                { id: 'contact_channels', type: 'list', label: 'Где написали лиду', placeholder: 'Добавить канал...', suggestions: ['WhatsApp', 'Telegram', 'e-mail'] },
                { id: 'reject_reason', type: 'textarea', label: 'Причина отказа', placeholder: 'Укажите причину отказа...', visibleWhen: { field: 'lead_status', value: 'refused' } }
            ]
        },
        {
            number: 2,
            name: 'Полная информация',
            shortName: 'Инфо',
            executor: 'executor',
            reviewer: 'reviewer',
            hasConditionsCascade: true,
            fields: [
                { id: 'condition_country', type: 'select', label: 'Страна', required: true },
                { id: 'method_type', type: 'select', label: 'Тип метода', required: true },
                { id: 'method_name', type: 'select', label: 'Название метода', required: true },
                { id: 'deal_1', type: 'text', label: 'Пополнения' },
                { id: 'deal_2', type: 'text', label: 'Выводы' },
                { id: 'deal_3', type: 'text', label: 'Компенсация' },
                { id: 'prepayment_method', type: 'select', label: 'Способ предоплаты', required: true, options: PREPAYMENT_METHODS },
                { id: 'prepayment_amount', type: 'text', label: 'Сумма предоплаты' },
                { id: 'country', type: 'text', label: 'Страна из документа', required: true },
                { id: 'city', type: 'text', label: 'Город', required: true },
                { id: 'birth_date', type: 'date', label: 'Дата рождения', required: true, noNowButton: true },
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
            reviewer: 'reviewer',
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
                    id: 'profile_checklist', type: 'checklist', label: 'Обязательные поля', required: true,
                    items: [
                        { label: 'ФИО' },
                        { label: 'Дата рождения' },
                        { label: 'Номер телефона' },
                        { label: 'E-mail' },
                        { label: 'Город' },
                        { label: 'Тип документа' },
                        { label: 'Серия и Номер документа' }
                    ]
                },
                {
                    id: 'profile_checklist_optional', type: 'checklist', label: 'Необязательные поля',
                    items: [
                        { label: 'Когда выдан' },
                        { label: 'Кем выдан' },
                        { label: 'Адрес регистрации' }
                    ]
                },
                { id: 'profile_screenshots', type: 'file', label: 'Скриншоты заполненного профиля', accept: 'image/*', multiple: true }
            ]
        },
        {
            number: 5,
            name: 'Антифрод проверка',
            shortName: 'Антифрод',
            executor: 'reviewer',
            reviewer: null,
            isAntifraud: true,
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
                { id: 'deposit_amount', type: 'text', label: 'Сумма пополнения', readonly: true, autofill: { step: 2, field: 'prepayment_amount' } },
                {
                    id: 'deposit_checklist', type: 'checklist', label: 'Подтверждение', required: true,
                    items: [
                        { label: 'Партнёр пополнил счёт' }
                    ]
                }
            ]
        },
        {
            number: 7,
            name: 'Корп. мессенджер',
            shortName: 'Мессенджер',
            executor: 'executor',
            reviewer: 'reviewer',
            dynamicExecutor: {
                field: 'messenger_creator',
                executorValue: 'executor',
                reviewerValue: 'reviewer',
                defaultValue: 'reviewer',
                autoHandoff: true
            },
            fields: [
                { id: 'messenger_login', type: 'text', label: 'Логин', required: true, placeholder: 'Логин аккаунта', showWhen: { phase: 'fill' } },
                { id: 'messenger_password', type: 'text', label: 'Пароль', required: true, placeholder: 'Пароль аккаунта', showWhen: { phase: 'fill' } },
                {
                    id: 'messenger_checklist', type: 'checklist', label: 'Подтверждение',
                    showWhen: { phase: 'confirm' },
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
            executorFinal: true,
            executorName: 'Партнёр заведён',
            executorShortName: 'Заведён',
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

    function getVisibleSteps(role) {
        if (role === 'executor') return STEPS.filter(s => !s.executorFinal);
        return STEPS;
    }

    function getVisibleStepCount(role) {
        return getVisibleSteps(role).length;
    }

    function isStepVisibleForRole(stepNumber, role) {
        const step = getStep(stepNumber);
        if (!step) return false;
        if (role === 'executor' && step.executorFinal) return false;
        return true;
    }

    function getStepDisplayName(stepNumber, role) {
        const step = getStep(stepNumber);
        if (!step) return 'Шаг ' + stepNumber;
        if (step.executorFinal && role === 'executor') return step.executorName || step.name;
        return step.name;
    }

    function getStepDisplayShortName(stepNumber, role) {
        const step = getStep(stepNumber);
        if (!step) return '';
        if (step.executorFinal && role === 'executor') return step.executorShortName || step.shortName;
        return step.shortName;
    }

    function isExecutorFinalStep(stepNumber) {
        const step = getStep(stepNumber);
        return step && !!step.executorFinal;
    }

    function isExecutorCompleted(request) {
        if (!request) return false;
        if (request.status === 'cancelled') return false;
        const finalStep = STEPS.find(s => s.executorFinal);
        if (!finalStep) return request.status === 'completed';
        return request.currentStep >= finalStep.number || request.status === 'completed';
    }

    function isWorkStatus(status) {
        return status === 'new' || status === 'in_progress' || status === 'approved' || status === 'revision_needed';
    }

    function getStepByProperty(prop) {
        return STEPS.find(s => s[prop]);
    }

    function getViewDecision(step, request, roles) {
        if (!step || !request) return { view: 'review' };

        const { myRole, sysRole, isAdmin } = roles;
        const status = request.status;
        const isWork = isWorkStatus(status);
        const isExecForStep = OnboardingRoles.isExecutorForStep(sysRole, step.number);
        const isRevForStep = OnboardingRoles.isReviewerForStep(sysRole, step.number);
        const globalRole = OnboardingRoles.getGlobalModuleRole(sysRole);
        const effectiveExecutor = getStepEffectiveExecutor(step.number, request.stageData);

        // 1. Executor completed — show final step form (disabled fields)
        if (globalRole === 'executor' && isExecutorCompleted(request)) {
            const finalStep = STEPS.find(s => s.executorFinal);
            return { view: 'form', stepOverride: finalStep ? finalStep.number : request.currentStep };
        }

        // 2. AutoHandoff step (work status) — always form for both roles
        if (isWork && step.dynamicExecutor && step.dynamicExecutor.autoHandoff) {
            return { view: 'form' };
        }

        // 3. on_review + dynamicExecutor: executor sees review (withdraw), reviewer/admin fills form
        if (status === 'on_review' && step.dynamicExecutor) {
            if (isExecForStep) return { view: 'review' };
            if (effectiveExecutor === myRole || isAdmin) return { view: 'form' };
        }

        // 4. Work status + executor → form
        if (isWork && isExecForStep) return { view: 'form' };

        // 5. on_review + reviewer-executor step (no reviewer, e.g. antifraud) → form
        if (status === 'on_review' && isExecForStep && !step.reviewer) return { view: 'form' };

        // 6. on_review + reviewer/admin → review
        if (status === 'on_review' && (isRevForStep || isAdmin)) return { view: 'review' };

        // 7. Admin fallback: on_review + no reviewer → form
        if (isAdmin && status === 'on_review' && !step.reviewer) return { view: 'form' };

        // 8. Admin fallback: work status → form
        if (isAdmin && isWork) return { view: 'form' };

        // 9. Default: review (readonly)
        return { view: 'review' };
    }

    function getSubmitConfig(step, request, roles) {
        if (!step || !request) return { label: 'Далее', action: 'onb-submit', visible: true, statusDropdown: false };

        const stepNumber = step.number;
        const currentStep = request.currentStep;

        // Past step — hidden
        if (stepNumber < currentStep) {
            return { label: '', action: 'onb-submit', visible: false, statusDropdown: false };
        }

        // Future step — "К текущему шагу"
        if (stepNumber > currentStep) {
            return { label: 'К текущему шагу', action: 'onb-goToCurrentStep', visible: true, statusDropdown: false };
        }

        // asSubmitButton field (e.g. lead_status on step 1) → statusDropdown mode
        const submitField = step.fields.find(f => f.asSubmitButton);
        if (submitField) {
            return { label: '', action: 'onb-submit', visible: false, statusDropdown: true, submitField };
        }

        // executorFinal: only visible for reviewer/admin (executor sees disabled fields, not submit)
        if (step.executorFinal) {
            const isReviewerOrAdmin = OnboardingRoles.isReviewerForStep(roles.sysRole, stepNumber) || roles.isAdmin;
            return { label: 'Завершить', action: 'onb-submit', visible: isReviewerOrAdmin, statusDropdown: false };
        }
        // Last step
        if (stepNumber === STEPS[STEPS.length - 1].number) {
            return { label: 'Завершить', action: 'onb-submit', visible: true, statusDropdown: false };
        }

        // Dynamic executor logic
        if (step.dynamicExecutor) {
            const data = request.stageData[stepNumber] || {};
            const creator = data[step.dynamicExecutor.field] || step.dynamicExecutor.defaultValue;

            if (data._handoff_complete) {
                if (!OnboardingRoles.isExecutorForStep(roles.sysRole, stepNumber) && !roles.isAdmin) {
                    return { label: '', action: 'onb-submit', visible: false, statusDropdown: false };
                }
                return { label: step.reviewer ? 'На проверку' : 'Далее', action: 'onb-submit', visible: true, statusDropdown: false };
            }

            if (creator === step.dynamicExecutor.reviewerValue) {
                if (!OnboardingRoles.isReviewerForStep(roles.sysRole, stepNumber) && !roles.isAdmin) {
                    if (step.dynamicExecutor.autoHandoff) {
                        return { label: '', action: 'onb-submit', visible: false, statusDropdown: false };
                    }
                    return { label: 'Запросить создание', action: 'onb-submit', visible: true, statusDropdown: false };
                }
                return { label: 'Создание завершено', action: 'onb-submit', visible: true, statusDropdown: false };
            }
        }

        // Default: reviewer step → "На проверку", else "Далее"
        const label = step.reviewer ? 'На проверку' : 'Далее';
        return { label, action: 'onb-submit', visible: true, statusDropdown: false };
    }

    return {
        STEPS,
        CASCADE_FIELDS,
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
        getOptionLabel,
        getVisibleSteps,
        getVisibleStepCount,
        isStepVisibleForRole,
        getStepDisplayName,
        getStepDisplayShortName,
        isExecutorFinalStep,
        isExecutorCompleted,
        isWorkStatus,
        getStepByProperty,
        getViewDecision,
        getSubmitConfig
    };
})();
