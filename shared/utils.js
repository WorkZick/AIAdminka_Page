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
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        return Date.now().toString();
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
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Инициализация иконок (совместимость с Lucide API)
     */
    initLucideIcons() {
        if (typeof LocalIcons !== 'undefined') {
            LocalIcons.createIcons();
        } else if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
};

console.log('✅ Utils loaded');
