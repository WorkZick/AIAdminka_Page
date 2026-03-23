// Модуль для работы с данными партнёров (адаптер над CloudStorage)
const storage = {
    ANALYTICS_KEY: 'traffic-analytics-temp',
    METHODS_KEY: 'traffic-custom-methods',
    cachedPartners: [],
    _adaptedCache: null,
    _saveTimer: null,

    mapStatus(status) {
        if (status === 'Закрыт') return 'закрыт';
        return 'новый';
    },

    async loadPartners() {
        try {
            if (typeof CloudStorage !== 'undefined') {
                this.cachedPartners = await CloudStorage.getPartners();
                this._adaptedCache = null;
            }
        } catch (e) {
            ErrorHandler.handle(e, {
                module: 'traffic-calculation-storage',
                action: 'loadPartnersFromCloud'
            });
            this.cachedPartners = [];
        }
    },

    getPartners() {
        if (this._adaptedCache) return this._adaptedCache;

        const partners = this.cachedPartners;
        const analyticsData = this.getAnalyticsData();

        this._adaptedCache = partners.map(p => {
            const analytics = analyticsData[p.id] || {};
            return {
                id: p.id,
                method: p.method || '',
                subagent: p.subagent || '',
                subagentId: p.subagentId || '',
                status: this.mapStatus(p.status),
                dateAdded: p.createdAt || new Date().toISOString(),
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

        return this._adaptedCache;
    },

    getAnalyticsData() {
        try {
            const data = localStorage.getItem(this.ANALYTICS_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    },

    // Сохранение аналитических данных (не сбрасывает кеш —
    // вызывающий код модифицирует объекты в _adaptedCache напрямую)
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

    // Debounced save — для частых обновлений (increment/decrement)
    savePartnersDebounced(partners) {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this.savePartners(partners), 300);
    },

    // === CRUD операции для партнёров ===

    addPartner(partner) {
        partner.id = partner.id || Utils.generateId();
        partner.createdAt = partner.createdAt || new Date().toISOString();
        partner.status = partner.status || 'Новый';
        this.cachedPartners.push(partner);
        this._adaptedCache = null;
        this._persistPartners();
        return partner;
    },

    deletePartner(id) {
        this.cachedPartners = this.cachedPartners.filter(p => p.id !== id);
        this._adaptedCache = null;
        const analyticsData = this.getAnalyticsData();
        delete analyticsData[id];
        localStorage.setItem(this.ANALYTICS_KEY, JSON.stringify(analyticsData));
        this._persistPartners();
    },

    updatePartner(id, updates) {
        const ALLOWED_FIELDS = ['method', 'subagent', 'subagentId', 'status', 'createdAt'];
        const partner = this.cachedPartners.find(p => p.id === id);
        if (partner) {
            for (const key of ALLOWED_FIELDS) {
                if (key in updates) {
                    partner[key] = updates[key];
                }
            }
            this._adaptedCache = null;
            this._persistPartners();
        }
    },

    replacePartners(partners) {
        this.cachedPartners = partners;
        this._adaptedCache = null;
        this._persistPartners();
    },

    _persistPartners() {
        if (typeof CloudStorage !== 'undefined' && CloudStorage.saveData) {
            CloudStorage.saveData('partners', this.cachedPartners).catch(e => {
                ErrorHandler.handle(e, {
                    module: 'traffic-calculation-storage',
                    action: 'persistPartners'
                });
            });
        }
    },

    // === Управление методами ===

    getMethods() {
        const partnerMethods = [...new Set(this.cachedPartners.map(p => p.method).filter(Boolean))];
        const customMethods = this._getCustomMethods();
        return [...new Set([...partnerMethods, ...customMethods])].sort();
    },

    _getCustomMethods() {
        try {
            return JSON.parse(localStorage.getItem(this.METHODS_KEY) || '[]');
        } catch (e) {
            return [];
        }
    },

    addMethod(name) {
        if (this.getMethods().includes(name)) return false;
        const custom = this._getCustomMethods();
        custom.push(name);
        localStorage.setItem(this.METHODS_KEY, JSON.stringify(custom));
        return true;
    },

    deleteMethod(name) {
        const custom = this._getCustomMethods();
        const filtered = custom.filter(m => m !== name);
        localStorage.setItem(this.METHODS_KEY, JSON.stringify(filtered));
        return filtered.length < custom.length;
    },

    // === Утилиты ===

    clearAnalyticsData() {
        localStorage.removeItem(this.ANALYTICS_KEY);
        this._adaptedCache = null;
    },

    updatePartnerStatuses() {
        return this.getPartners();
    }
};
