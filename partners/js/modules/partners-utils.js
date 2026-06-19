// Partners Utils - utility functions
const PartnersUtils = {
    escapeHtml(text) { return Utils.escapeHtml(text); },

    isValidImageUrl(url) {
        if (!url) return false;
        if (url.startsWith('data:image/')) return true;
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    },

    showLoading(show) {
        PartnersState.isLoading = show;
        const loadingState = document.getElementById('loadingState');
        const table = document.querySelector('.partners-table');
        const emptyState = document.getElementById('emptyState');

        if (show) {
            if (loadingState) loadingState.classList.remove('hidden');
            if (table) table.classList.add('hidden');
            if (emptyState) emptyState.classList.add('hidden');
        } else {
            if (loadingState) loadingState.classList.add('hidden');
            // Table visibility will be set by render()
        }
    },

    showError(message) {
        Toast.error(message);
    },

    /**
     * Показать диалог подтверждения (shared ConfirmModal — Phase 27 HTML-02)
     * @param {string} message - Текст сообщения
     * @param {string} title - Заголовок диалога (не используется ConfirmModal, сохранён для совместимости call-sites)
     * @returns {Promise<boolean>} true если подтверждено
     */
    showConfirm(message, title = 'Подтверждение') {
        return ConfirmModal.show(message, { confirmText: 'Подтвердить', cancelText: 'Отмена' });
    },

    /**
     * Показать диалог ввода (shared PromptModal — Phase 27 HTML-02)
     * @param {string} message - Текст сообщения
     * @param {string} defaultValue - Значение по умолчанию
     * @param {string} title - Заголовок диалога (не используется PromptModal, сохранён для совместимости call-sites)
     * @returns {Promise<string|null>} введённое значение или null
     */
    showPrompt(message, defaultValue = '', title = 'Ввод') {
        return PromptModal.show(message, { defaultValue, confirmText: 'OK', cancelText: 'Отмена' });
    },

    incrementCounter(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            const currentValue = parseInt(input.value) || 0;
            input.value = currentValue + 1;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    decrementCounter(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            const currentValue = parseInt(input.value) || 0;
            const min = parseInt(input.min);
            const newValue = currentValue - 1;
            input.value = (!isNaN(min) && newValue < min) ? min : newValue;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    updateFileLabel(label, fileName) {
        if (!label) return;
        label.classList.add('has-file');
        const mainText = label.querySelector('.main-text');
        const subText = label.querySelector('.sub-text');
        if (mainText) mainText.textContent = fileName;
        if (subText) subText.textContent = 'Файл выбран';
    },

    resetFileLabel(label, mainText, subText) {
        if (!label) return;
        label.classList.remove('has-file');
        const mainEl = label.querySelector('.main-text');
        const subEl = label.querySelector('.sub-text');
        if (mainEl) mainEl.textContent = mainText;
        if (subEl) subEl.textContent = subText;
    },

    getStatusColor(status) {
        const colors = {
            'Открыт': 'no-dot status-active',
            'Закрыт': 'no-dot status-inactive'
        };
        return colors[status] || 'no-dot status-active';
    }
};
