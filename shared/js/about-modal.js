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
    init() {
        // Close button handler
        const closeBtn = document.querySelector('#aboutModal .modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Close by clicking overlay
        const modal = document.getElementById('aboutModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }

        // Close by Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('aboutModal');
                if (modal && modal.classList.contains('active')) {
                    this.close();
                }
            }
        });

        // Version info click handler
        const versionInfo = document.querySelector('.version-info');
        if (versionInfo) {
            versionInfo.addEventListener('click', () => this.show());
        }
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
