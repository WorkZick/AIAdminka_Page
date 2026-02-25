/**
 * OnboardingState — Pub/Sub состояние модуля
 * Централизованное управление состоянием + подписки на изменения
 */

const OnboardingState = {
    _state: {
        /** Все заявки */
        requests: [],
        /** Отфильтрованные заявки */
        filteredRequests: [],
        /** Текущая открытая заявка */
        currentRequest: null,
        /** Текущий шаг (номер) */
        currentStep: 1,
        /** Режим: 'list' | 'new' | 'detail' */
        view: 'list',
        /** Фильтры */
        filters: {
            ownership: 'my',
            status: 'all',
            search: ''
        },
        /** Роль текущего пользователя */
        userRole: null,
        /** Email текущего пользователя */
        userEmail: null,
        /** Текущий шаг в detail view */
        detailStep: null,
        /** Загрузка данных */
        loading: false
    },

    _subscribers: {},

    /** Получить значение */
    get(key) {
        const keys = key.split('.');
        let value = this._state;
        for (const k of keys) {
            if (value == null) return undefined;
            value = value[k];
        }
        return value;
    },

    /** Установить значение + уведомить подписчиков */
    set(key, value) {
        const keys = key.split('.');
        let obj = this._state;
        for (let i = 0; i < keys.length - 1; i++) {
            if (obj[keys[i]] == null) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        const lastKey = keys[keys.length - 1];
        const oldValue = obj[lastKey];
        if (oldValue === value) return;
        obj[lastKey] = value;
        this._notify(key, value, oldValue);
    },

    /** Подписка на изменение ключа */
    subscribe(key, callback) {
        if (!this._subscribers[key]) {
            this._subscribers[key] = [];
        }
        this._subscribers[key].push(callback);
        return () => {
            this._subscribers[key] = this._subscribers[key].filter(cb => cb !== callback);
        };
    },

    /** Уведомить подписчиков */
    _notify(key, value, oldValue) {
        // Exact match
        if (this._subscribers[key]) {
            this._subscribers[key].forEach(cb => cb(value, oldValue));
        }
        // Parent key subscribers (e.g. 'filters' for 'filters.status')
        const parts = key.split('.');
        if (parts.length > 1) {
            const parentKey = parts[0];
            if (this._subscribers[parentKey]) {
                this._subscribers[parentKey].forEach(cb => cb(this._state[parentKey]));
            }
        }
    },

    /** Сброс состояния */
    reset() {
        this._state.currentRequest = null;
        this._state.currentStep = 1;
        this._state.detailStep = null;
        this._state.view = 'list';
    }
};
