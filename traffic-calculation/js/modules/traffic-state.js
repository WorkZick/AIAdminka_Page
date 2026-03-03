// Модуль состояния трафика
const TrafficState = {
    currentTab: 'analytics',
    selectedPartners: [],
    editingPartnerId: null,
    currentReportData: null,
    currentStep: 1,
    completedSteps: [],
    dataLoaded: false, // Флаг: данные загружены из облака
    filesUploaded: {
        deposits: false,
        quality: false,
        percent: false
    },
    ourPartnerIds: [],
    currentSelectedPartnerId: null,
    currentSelectedPartnerId6: null,
    allPartnersListForStep5: [],
    allPartnersListForStep6: [],
    trafficSettings: null,
    trafficResults: null,

    // Параметры для оценки трафика
    trafficParams: [
        { key: 'backCount', name: 'Back', type: 'number' },
        { key: 'autoDisableCount', name: 'Автоотключение', type: 'number' },
        { key: 'depositAppealsCount', name: 'Обращений по пополнениям', type: 'number' },
        { key: 'delayedAppealsCount', name: 'Обращения 15+ мин', type: 'number' },
        { key: 'depositSuccessPercent', name: '% успешных пополнений', type: 'percent' },
        { key: 'withdrawalSuccessPercent', name: '% успешных выводов', type: 'percent' },
        { key: 'depositWorkTimePercent', name: '% Времени работы на пополнения', type: 'percent' },
        { key: 'withdrawalWorkTimePercent', name: '% Времени работы на вывод', type: 'percent' },
        { key: 'chatIgnoring', name: 'Игнорирование чатов', type: 'number' },
        { key: 'webmanagementIgnore', name: 'Игнор Webmanagement', type: 'number' },
        { key: 'depositQueues', name: 'Очереди на пополнение', type: 'number' },
        { key: 'withdrawalQueues', name: 'Очереди на вывод', type: 'number' },
        { key: 'creditsOutsideLimits', name: 'Зачисление вне лимитов', type: 'number' },
        { key: 'wrongAmountApproval', name: 'Одобрение неверной суммы', type: 'number' },
        { key: 'otherViolations', name: 'Другие нарушения', type: 'multiplier' }
    ],

    availableMethods: []
};
