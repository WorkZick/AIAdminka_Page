/**
 * Общие утилиты для всех модулей AIAdminka
 */
const Utils = {
    /**
     * Экранирование HTML для предотвращения XSS
     * @param {string} text - Текст для экранирования
     * @returns {string} Экранированный текст
     */
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Проверка валидности Google avatar URL
     * @param {string} url - URL для проверки
     * @returns {boolean} true если URL — валидный Google avatar
     */
    isGoogleAvatar(url) {
        if (!url) return false;
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' &&
                   parsed.hostname.endsWith('.googleusercontent.com');
        } catch { return false; }
    },

    /**
     * Форматирование даты в читаемый формат
     * @param {string|Date} dateInput - Дата в формате ISO или объект Date
     * @param {string} locale - Локаль (по умолчанию 'ru-RU')
     * @returns {string} Отформатированная дата
     */
    formatDate(dateInput, locale = 'ru-RU') {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

        if (isNaN(date.getTime())) {
            return 'Неверная дата';
        }

        return date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Копирование текста в буфер обмена
     * @param {string} text - Текст для копирования
     * @returns {Promise<boolean>} true если успешно
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback для старых браузеров
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                return success;
            }
        } catch (e) {
            console.error('Ошибка копирования:', e);
            return false;
        }
    },

    /**
     * Загрузка JSON файла
     * @param {string} url - Путь к JSON файлу
     * @returns {Promise<Object>} Данные из JSON
     */
    async loadJSON(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            console.error(`Ошибка загрузки JSON из ${url}:`, e);
            return null;
        }
    },

    /**
     * Генерация уникального ID
     * @returns {string} Уникальный ID на базе timestamp
     */
    generateId() {
        const array = new Uint8Array(12);
        crypto.getRandomValues(array);
        return Array.from(array, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    },

    /**
     * Валидация email
     * @param {string} email - Email для проверки
     * @returns {boolean} true если email валиден
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Дебаунс функции
     * @param {Function} func - Функция для дебаунса
     * @param {number} wait - Задержка в миллисекундах
     * @returns {Function} Функция с дебаунсом
     */
    debounce(func, wait) {
        let timeout;
        function debounced(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        }
        debounced.cancel = () => clearTimeout(timeout);
        return debounced;
    },

    /**
     * Получение инициалов из имени
     * @param {string} name - Полное имя
     * @returns {string} Инициалы (1-2 символа)
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ').filter(p => p.length > 0);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        if (parts.length === 1 && parts[0].length > 0) return parts[0].substring(0, 2).toUpperCase();
        return '?';
    },

    /**
     * Форматирование даты и времени (dd.mm.yyyy hh:mm)
     * @param {Date} date - Объект Date
     * @returns {string} Отформатированная строка
     */
    formatDateTime(date) {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return d + '.' + m + '.' + y + ' ' + h + ':' + min;
    },

    /**
     * Форматирование размера в байтах
     * @param {number} bytes - Размер в байтах
     * @returns {string} Читаемый размер
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Б';
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    },

    initLucideIcons() {
        if (typeof LocalIcons !== 'undefined') {
            LocalIcons.createIcons();
        } else if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
};
