// Модуль для работы с данными партнёров (read-only из CloudStorage)
const storage = {
    ANALYTICS_KEY: 'traffic-analytics-temp', // Временные данные аналитики
    cachedPartners: [], // Кэш партнёров из облака

    // Маппинг статусов из формата "Партнеры" в формат "Расчет трафика"
    mapStatus(status) {
        if (status === 'Закрыт') return 'закрыт';
        return 'новый'; // 'Открыт' и другие -> 'новый'
    },

    // Загрузить партнёров из облака (вызывать при инициализации)
    async loadPartners() {
        try {
            if (typeof CloudStorage !== 'undefined') {
                this.cachedPartners = await CloudStorage.getPartners();
            }
        } catch (e) {
            console.error('Ошибка загрузки партнёров:', e);
            this.cachedPartners = [];
        }
    },

    // Получить всех партнеров (адаптированных под формат расчета трафика)
    getPartners() {
        const partners = this.cachedPartners;
        const analyticsData = this.getAnalyticsData();

        // Адаптируем формат данных и объединяем с временными данными аналитики
        return partners.map(p => {
            const analytics = analyticsData[p.id] || {};
            return {
                id: p.id,
                method: p.method || '',
                subagent: p.subagent || '',
                subagentId: p.subagentId || '',
                status: this.mapStatus(p.status),
                dateAdded: p.createdAt || new Date().toISOString(),
                // Данные из аналитики
                backCount: analytics.backCount || 0,
                cringeCount: analytics.cringeCount || 0,
                autoDisableCount: analytics.autoDisableCount || 0,
                depositTransactionsCount: analytics.depositTransactionsCount || 0,
                withdrawalTransactionsCount: analytics.withdrawalTransactionsCount || 0,
                depositAppealsCount: analytics.depositAppealsCount || 0,
                delayedAppealsCount: analytics.delayedAppealsCount || 0,
                depositSuccessPercent: analytics.depositSuccessPercent || 0,
                withdrawalSuccessPercent: analytics.withdrawalSuccessPercent || 0,
                depositWorkTimePercent: analytics.depositWorkTimePercent || 0,
                withdrawalWorkTimePercent: analytics.withdrawalWorkTimePercent || 0,
                chatIgnoring: analytics.chatIgnoring || 0,
                webmanagementIgnore: analytics.webmanagementIgnore || 0,
                depositQueues: analytics.depositQueues || 0,
                withdrawalQueues: analytics.withdrawalQueues || 0,
                creditsOutsideLimits: analytics.creditsOutsideLimits || 0,
                wrongAmountApproval: analytics.wrongAmountApproval || 0,
                otherViolations: analytics.otherViolations || 0,
                otherViolationsDescription: analytics.otherViolationsDescription || ''
            };
        });
    },

    // Получить временные данные аналитики
    getAnalyticsData() {
        try {
            const data = localStorage.getItem(this.ANALYTICS_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    },

    // Сохранить данные партнёров (сохраняет только данные аналитики во временное хранилище)
    savePartners(partners) {
        const analyticsData = {};
        partners.forEach(p => {
            analyticsData[p.id] = {
                backCount: p.backCount || 0,
                cringeCount: p.cringeCount || 0,
                autoDisableCount: p.autoDisableCount || 0,
                depositTransactionsCount: p.depositTransactionsCount || 0,
                withdrawalTransactionsCount: p.withdrawalTransactionsCount || 0,
                depositAppealsCount: p.depositAppealsCount || 0,
                delayedAppealsCount: p.delayedAppealsCount || 0,
                depositSuccessPercent: p.depositSuccessPercent || 0,
                withdrawalSuccessPercent: p.withdrawalSuccessPercent || 0,
                depositWorkTimePercent: p.depositWorkTimePercent || 0,
                withdrawalWorkTimePercent: p.withdrawalWorkTimePercent || 0,
                chatIgnoring: p.chatIgnoring || 0,
                webmanagementIgnore: p.webmanagementIgnore || 0,
                depositQueues: p.depositQueues || 0,
                withdrawalQueues: p.withdrawalQueues || 0,
                creditsOutsideLimits: p.creditsOutsideLimits || 0,
                wrongAmountApproval: p.wrongAmountApproval || 0,
                otherViolations: p.otherViolations || 0,
                otherViolationsDescription: p.otherViolationsDescription || ''
            };
        });
        localStorage.setItem(this.ANALYTICS_KEY, JSON.stringify(analyticsData));
        return true;
    },

    // Очистить временные данные аналитики
    clearAnalyticsData() {
        localStorage.removeItem(this.ANALYTICS_KEY);
    },

    // Получить методы (уникальные из партнеров)
    getMethods() {
        const methods = [...new Set(this.cachedPartners.map(p => p.method).filter(Boolean))];
        return methods.length > 0 ? methods : [];
    },

    // Обновить статусы партнеров (read-only - ничего не делает)
    updatePartnerStatuses() {
        return this.getPartners();
    }
};
