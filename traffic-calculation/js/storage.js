// Модуль для работы с localStorage (использует StorageManager)
const storage = {
    PARTNERS_KEY: 'traffic-partners',
    METHODS_KEY: 'traffic-methods',

    // Получить всех партнеров
    getPartners() {
        return StorageManager.getArray(this.PARTNERS_KEY);
    },

    // Сохранить партнеров
    savePartners(partners) {
        return StorageManager.set(this.PARTNERS_KEY, partners);
    },

    // Добавить партнера
    addPartner(partner) {
        const newPartner = {
            method: partner.method,
            subagent: partner.subagent,
            subagentId: partner.subagentId,
            status: 'новый',
            dateAdded: new Date().toISOString(),
            ...partner
        };
        return StorageManager.addItem(this.PARTNERS_KEY, newPartner);
    },

    // Обновить партнера
    updatePartner(id, updatedData) {
        return StorageManager.updateItem(this.PARTNERS_KEY, id, updatedData) ?
            this.getPartners().find(p => p.id === id) : null;
    },

    // Удалить партнера
    deletePartner(id) {
        return StorageManager.deleteItem(this.PARTNERS_KEY, id);
    },

    // Получить методы
    getMethods() {
        const methods = StorageManager.get(this.METHODS_KEY);
        return methods || ['Метод 1', 'Метод 2', 'Метод 3'];
    },

    // Сохранить методы
    saveMethods(methods) {
        return StorageManager.set(this.METHODS_KEY, methods);
    },

    // Добавить метод
    addMethod(methodName) {
        const methods = this.getMethods();
        if (!methods.includes(methodName)) {
            methods.push(methodName);
            this.saveMethods(methods);
            return true;
        }
        return false;
    },

    // Удалить метод
    deleteMethod(methodName) {
        const methods = this.getMethods();
        const filtered = methods.filter(m => m !== methodName);
        this.saveMethods(filtered);
        return filtered.length < methods.length;
    },

    // Обновить статусы партнеров (проверка на 30 дней)
    updatePartnerStatuses() {
        const partners = this.getPartners();
        const now = new Date();
        let updated = false;

        partners.forEach(partner => {
            if (partner.status === 'новый' && partner.dateAdded) {
                const addedDate = new Date(partner.dateAdded);
                const daysDiff = Math.floor((now - addedDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff >= 30) {
                    partner.status = 'старый';
                    updated = true;
                }
            }
        });

        if (updated) {
            this.savePartners(partners);
        }

        return partners;
    }
};