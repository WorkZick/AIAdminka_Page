/**
 * Team Utils Module
 * Утилиты для работы с данными
 */

const TeamUtils = {
    /**
     * Экранирование HTML для предотвращения XSS
     * @param {string} text - Текст для экранирования
     * @returns {string} Безопасная строка
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return String(text ?? '');
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    /**
     * Проверка валидности URL изображения
     * @param {string} url - URL изображения
     * @returns {boolean} true если URL безопасный
     */
    isValidImageUrl(url) {
        if (!url) return false;
        // Разрешены только data URLs и http/https URLs
        return url.startsWith('data:image/') ||
               url.startsWith('http://') ||
               url.startsWith('https://');
    },

    /**
     * Форматирование даты в русский формат
     * @param {string} isoString - Дата в ISO формате
     * @returns {string} Дата в формате дд.мм.гггг
     */
    formatDate(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    /**
     * Получение CSS класса для статуса сотрудника
     * @param {string} status - Статус сотрудника
     * @returns {string} CSS класс
     */
    getStatusClass(status) {
        const statusMap = {
            'Работает': 'green',
            'В отпуске': 'yellow',
            'Командировка': 'blue',
            'Уволен': 'red',
            'Болеет': 'purple'
        };
        return statusMap[status] || 'green';
    },

    /**
     * Форматирование ФИО для таблицы (Фамилия Имя на первой строке, Отчество на второй)
     * @param {string} fullName - Полное имя
     * @returns {string} Отформатированное имя с <br> тегом
     */
    formatFullNameForTable(fullName) {
        if (!fullName) return '';

        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 0) return '';
        if (parts.length === 1) return this.escapeHtml(parts[0]);
        if (parts.length === 2) return this.escapeHtml(parts.join(' '));

        // Фамилия Имя на первой строке, Отчество на второй
        const lastName = parts[0];
        const firstName = parts[1];
        const patronymic = parts.slice(2).join(' ');

        return `${this.escapeHtml(lastName)} ${this.escapeHtml(firstName)}<br>${this.escapeHtml(patronymic)}`;
    }
};
