/**
 * Security Utilities - AIAdminka
 * Общие функции безопасности для всего проекта
 */

const SecurityUtils = {
    /**
     * Экранирование HTML для предотвращения XSS
     * @param {string} text - Текст для экранирования
     * @returns {string} - Безопасный HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Валидация URL изображения Google
     * @param {string} url - URL для проверки
     * @returns {boolean} - true если URL безопасен
     */
    isValidGoogleImageUrl(url) {
        if (!url || typeof url !== 'string') return false;

        // Разрешённые домены для изображений Google
        const allowedDomains = [
            'https://lh3.googleusercontent.com/',
            'https://lh4.googleusercontent.com/',
            'https://lh5.googleusercontent.com/',
            'https://lh6.googleusercontent.com/',
            'https://drive.google.com/thumbnail'
        ];

        return allowedDomains.some(domain => url.startsWith(domain));
    },

    /**
     * Безопасное создание img элемента с валидацией
     * @param {string} url - URL изображения
     * @param {string} alt - Alt текст
     * @param {Function} onError - Callback при ошибке загрузки
     * @returns {HTMLImageElement|null} - img элемент или null если URL невалиден
     */
    createSafeImage(url, alt = '', onError = null) {
        if (!this.isValidGoogleImageUrl(url)) {
            return null;
        }

        const img = document.createElement('img');
        img.src = url;
        img.alt = alt;
        if (onError) {
            img.onerror = onError;
        }
        return img;
    },

    /**
     * Генерация криптографически безопасного state параметра
     * @param {number} length - Длина в байтах (по умолчанию 32)
     * @returns {string} - Hex строка
     */
    generateState(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Проверка state параметра для CSRF защиты
     * @param {string} returnedState - State из callback URL
     * @returns {boolean} - true если state валиден
     */
    validateState(returnedState) {
        const savedState = sessionStorage.getItem('oauth_state');
        if (!savedState || savedState !== returnedState) {
            sessionStorage.removeItem('oauth_state');
            return false;
        }
        sessionStorage.removeItem('oauth_state');
        return true;
    },

    /**
     * Сохранение state перед OAuth
     * @param {string} state - State для сохранения
     */
    saveState(state) {
        sessionStorage.setItem('oauth_state', state);
    },

    /**
     * Очистка URL от токена (для безопасности)
     */
    clearUrlHash() {
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    },

    /**
     * Безопасный парсинг JSON
     * @param {string} jsonString - JSON строка
     * @param {*} defaultValue - Значение по умолчанию при ошибке
     * @returns {*} - Распарсенный объект или defaultValue
     */
    safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            return defaultValue;
        }
    },

    /**
     * Проверка, что данные не содержат потенциально опасного содержимого
     * @param {string} data - Данные для проверки
     * @returns {boolean} - true если данные безопасны
     */
    isSafeInput(data) {
        if (!data || typeof data !== 'string') return true;

        // Паттерны потенциально опасного содержимого
        const dangerousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /data:text\/html/gi
        ];

        return !dangerousPatterns.some(pattern => pattern.test(data));
    },

    /**
     * Санитизация входных данных
     * @param {string} input - Входные данные
     * @returns {string} - Очищенные данные
     */
    sanitizeInput(input) {
        if (!input || typeof input !== 'string') return input;

        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
    }
};

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityUtils;
}
