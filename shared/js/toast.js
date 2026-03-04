/**
 * AIAdminka Toast Notification System
 * Глобальная система уведомлений для всех модулей
 */

const Toast = {
    container: null,

    // SVG иконки для разных типов
    icons: {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>`
    },

    /**
     * Инициализация контейнера
     */
    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },

    /**
     * Показать уведомление
     * @param {string} message - Текст сообщения
     * @param {string} type - Тип: success, error, warning, info
     * @param {number} duration - Длительность показа в мс (0 = не закрывать автоматически)
     */
    show(message, type = 'info', duration = 4000) {
        this.init();

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;

        toast.innerHTML = `
            <div class="toast-icon">${this.icons[type] || this.icons.info}</div>
            <div class="toast-message"></div>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        // XSS protection: set message via textContent
        toast.querySelector('.toast-message').textContent = message;

        // Добавляем обработчик закрытия
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.close(toast));

        this.container.appendChild(toast);

        // Анимация появления
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Автозакрытие
        if (duration > 0) {
            setTimeout(() => this.close(toast), duration);
        }

        return toast;
    },

    /**
     * Закрыть уведомление
     * @param {HTMLElement} toast - Элемент уведомления
     */
    close(toast) {
        if (!toast || toast.classList.contains('hide')) return;

        toast.classList.remove('show');
        toast.classList.add('hide');

        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    },

    /**
     * Быстрые методы для разных типов
     */
    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    },

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    },

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    },

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }
};

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Toast;
}
