/**
 * AIAdminka About Modal Controller
 * Управление модальным окном "О разработке"
 * @version 1.0
 */

const AboutModal = {
    /**
     * Показать модальное окно
     */
    show() {
        const modal = document.getElementById('aboutModal');
        if (modal) {
            modal.classList.add('active');
        }
    },

    /**
     * Закрыть модальное окно
     */
    close() {
        const modal = document.getElementById('aboutModal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    /**
     * Инициализация обработчиков событий
     * Вызывается автоматически при загрузке компонента
     */
    _handlers: null,

    init() {
        // Prevent duplicate listeners on repeated init()
        if (this._handlers) this.destroy();
        this._handlers = {};

        // Close button handler
        const closeBtn = document.querySelector('#aboutModal .modal-close');
        if (closeBtn) {
            this._handlers.closeBtn = () => this.close();
            closeBtn.addEventListener('click', this._handlers.closeBtn);
        }

        // Close by clicking overlay
        const modal = document.getElementById('aboutModal');
        if (modal) {
            this._handlers.overlay = (e) => {
                if (e.target === modal) this.close();
            };
            modal.addEventListener('click', this._handlers.overlay);
        }

        // Close by Escape key
        this._handlers.keydown = (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('aboutModal');
                if (modal && modal.classList.contains('active')) {
                    this.close();
                }
            }
        };
        document.addEventListener('keydown', this._handlers.keydown);

        // Version info click handler
        const versionInfo = document.querySelector('.version-info');
        if (versionInfo) {
            this._handlers.versionInfo = () => this.show();
            versionInfo.addEventListener('click', this._handlers.versionInfo);
        }
    },

    destroy() {
        if (!this._handlers) return;

        const closeBtn = document.querySelector('#aboutModal .modal-close');
        if (closeBtn && this._handlers.closeBtn) {
            closeBtn.removeEventListener('click', this._handlers.closeBtn);
        }

        const modal = document.getElementById('aboutModal');
        if (modal && this._handlers.overlay) {
            modal.removeEventListener('click', this._handlers.overlay);
        }

        if (this._handlers.keydown) {
            document.removeEventListener('keydown', this._handlers.keydown);
        }

        const versionInfo = document.querySelector('.version-info');
        if (versionInfo && this._handlers.versionInfo) {
            versionInfo.removeEventListener('click', this._handlers.versionInfo);
        }

        this._handlers = null;
    }
};

// Глобальные функции для обратной совместимости
function showAboutModal() {
    AboutModal.show();
}

function closeAboutModal() {
    AboutModal.close();
}

function initAboutModal() {
    AboutModal.init();
}

// Экспорт для использования
if (typeof window !== 'undefined') {
    window.AboutModal = AboutModal;
    window.showAboutModal = showAboutModal;
    window.closeAboutModal = closeAboutModal;
    window.initAboutModal = initAboutModal;
}
