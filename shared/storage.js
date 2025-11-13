// Единый модуль для работы с localStorage
const StorageManager = {
    /**
     * Проверяет доступность localStorage
     * @returns {boolean} true если localStorage доступен
     */
    _isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.error('localStorage недоступен:', e);
            alert('Локальное хранилище недоступно. Функциональность может быть ограничена.');
            return false;
        }
    },

    /**
     * Получить данные по ключу
     * @param {string} key - Ключ хранилища
     * @returns {*} Данные или null
     */
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error(`Storage get error for key "${key}":`, e);
            return null;
        }
    },

    /**
     * Сохранить данные по ключу
     * @param {string} key - Ключ хранилища
     * @param {*} data - Данные для сохранения
     * @returns {boolean} true если успешно
     */
    set(key, data) {
        if (!this._isAvailable()) return false;

        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error(`Storage set error for key "${key}":`, e);
            if (e.name === 'QuotaExceededError') {
                alert('Хранилище переполнено. Экспортируйте данные и очистите кэш.');
            }
            return false;
        }
    },

    /**
     * Удалить данные по ключу
     * @param {string} key - Ключ хранилища
     * @returns {boolean} true если успешно
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error(`Storage remove error for key "${key}":`, e);
            return false;
        }
    },

    /**
     * Получить массив по ключу (или пустой массив)
     * @param {string} key - Ключ хранилища
     * @returns {Array} Массив данных
     */
    getArray(key) {
        const data = this.get(key);
        return Array.isArray(data) ? data : [];
    },

    /**
     * Добавить элемент в массив
     * @param {string} key - Ключ хранилища
     * @param {Object} item - Элемент для добавления
     * @returns {Object|null} Добавленный элемент с ID или null
     */
    addItem(key, item) {
        const items = this.getArray(key);
        item.id = item.id || Date.now().toString();
        items.push(item);
        return this.set(key, items) ? item : null;
    },

    /**
     * Обновить элемент в массиве
     * @param {string} key - Ключ хранилища
     * @param {string} id - ID элемента
     * @param {Object} updatedData - Новые данные
     * @returns {boolean} true если успешно
     */
    updateItem(key, id, updatedData) {
        const items = this.getArray(key);
        const index = items.findIndex(i => i.id === id);
        if (index !== -1) {
            items[index] = { ...items[index], ...updatedData };
            return this.set(key, items);
        }
        return false;
    },

    /**
     * Удалить элемент из массива
     * @param {string} key - Ключ хранилища
     * @param {string} id - ID элемента
     * @returns {boolean} true если успешно
     */
    deleteItem(key, id) {
        const items = this.getArray(key);
        const filtered = items.filter(i => i.id !== id);
        return this.set(key, filtered);
    }
};

console.log('✅ StorageManager загружен');
