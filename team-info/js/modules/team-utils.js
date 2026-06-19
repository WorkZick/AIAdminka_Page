/**
 * Team Utils Module
 * Утилиты для работы с данными
 */

const TeamUtils = {
    escapeHtml(text) { return Utils.escapeHtml(text); },

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
     * Получение CSS класса для статуса сотрудника
     * @param {string} status - Статус сотрудника
     * @returns {string} CSS класс
     */
    getStatusClass(status) {
        const statusMap = {
            'Работает': 'status-active no-dot',
            'В отпуске': 'status-pending no-dot',
            'Командировка': 'status-in_progress no-dot',
            'Уволен': 'status-inactive no-dot',
            'Болеет': 'status-sick no-dot'
        };
        return statusMap[status] || 'status-active no-dot';
    },

    getStatusColor(status) {
        const map = { 'Работает': 'var(--status-green)', 'В отпуске': 'var(--status-yellow)', 'Болеет': 'var(--status-purple)', 'Командировка': 'var(--status-blue)', 'Уволен': 'var(--status-red)' };
        return map[status] || 'var(--status-green)';
    },

    setStatusText(el, status) {
        if (!el) return;
        // Phase 27 MIG-02: surgical XSS fix (Pitfall #6 — XSS-proof, Phase 25-07 precedent)
        // textContent + appendChild; идентичный визуал legacy innerHTML
        el.textContent = status + ' ';
        const dot = document.createElement('span');
        dot.className = 'status-dot';
        dot.style.background = this.getStatusColor(status);
        el.appendChild(dot);
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
