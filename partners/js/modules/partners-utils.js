// Partners Utils - utility functions
const PartnersUtils = {
    escapeHtml(text) { return Utils.escapeHtml(text); },

    isValidImageUrl(url) {
        if (!url) return false;
        return url.startsWith('data:image/') ||
               url.startsWith('http://') ||
               url.startsWith('https://');
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
     * Показать диалог подтверждения (замена confirm)
     * @param {string} message - Текст сообщения
     * @param {string} title - Заголовок диалога
     * @returns {Promise<boolean>} true если подтверждено
     */
    showConfirm(message, title = 'Подтверждение') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmDialog');
            const titleEl = document.getElementById('confirmDialogTitle');
            const messageEl = document.getElementById('confirmDialogMessage');
            const okBtn = document.getElementById('confirmDialogOk');
            const cancelBtn = document.getElementById('confirmDialogCancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            modal.classList.add('active');

            const cleanup = () => {
                modal.classList.remove('active');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('click', handleBackdrop);
            };

            const handleOk = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const handleBackdrop = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };

            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
            modal.addEventListener('click', handleBackdrop);
        });
    },

    /**
     * Показать диалог ввода (замена prompt)
     * @param {string} message - Текст сообщения
     * @param {string} defaultValue - Значение по умолчанию
     * @param {string} title - Заголовок диалога
     * @returns {Promise<string|null>} введённое значение или null
     */
    showPrompt(message, defaultValue = '', title = 'Ввод') {
        return new Promise((resolve) => {
            const modal = document.getElementById('promptDialog');
            const titleEl = document.getElementById('promptDialogTitle');
            const messageEl = document.getElementById('promptDialogMessage');
            const inputEl = document.getElementById('promptDialogInput');
            const okBtn = document.getElementById('promptDialogOk');
            const cancelBtn = document.getElementById('promptDialogCancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            inputEl.value = defaultValue;
            modal.classList.add('active');

            // Фокус на input
            setTimeout(() => inputEl.focus(), 100);

            const cleanup = () => {
                modal.classList.remove('active');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                inputEl.removeEventListener('keydown', handleKeydown);
                modal.removeEventListener('click', handleBackdrop);
            };

            const handleOk = () => {
                const value = inputEl.value.trim();
                cleanup();
                resolve(value || null);
            };

            const handleCancel = () => {
                cleanup();
                resolve(null);
            };

            const handleKeydown = (e) => {
                if (e.key === 'Enter') {
                    handleOk();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };

            const handleBackdrop = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };

            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
            inputEl.addEventListener('keydown', handleKeydown);
            modal.addEventListener('click', handleBackdrop);
        });
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
            'Открыт': 'green',
            'Закрыт': 'red'
        };
        return colors[status] || 'green';
    }
};
