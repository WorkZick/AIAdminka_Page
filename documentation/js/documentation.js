// Модуль инициализации страницы документации
const Documentation = {
    // Icons lists
    iconsNav: [
        'admin', 'arrow', 'cross', 'documents', 'excel_reports',
        'main_page', 'partners', 'sync', 'team_info', 'team_management',
        'traffic-calculation'
    ],

    iconsUI: [
        'alert-triangle', 'arrow-left', 'arrow-right', 'bar-chart', 'book-open',
        'calculator', 'check', 'check-square', 'chevron-down', 'cloud',
        'cloud-sync', 'download', 'edit', 'file-plus', 'file-spreadsheet',
        'file-text', 'filter', 'folder-open', 'git-branch', 'grid-3x3',
        'handshake', 'hash', 'help-circle', 'info', 'layout-grid',
        'list', 'lock', 'menu', 'minus', 'mouse-pointer',
        'play', 'plus', 'rotate-ccw', 'settings', 'trash-2',
        'trending-up', 'type', 'unlock', 'upload', 'users',
        'volume-2', 'x'
    ],

    escapeHandler: null,

    async init() {
        // Проверка авторизации и инициализация ролей
        if (typeof AuthGuard !== 'undefined') {
            await AuthGuard.checkWithRole();
        }

        // Initialize ComponentLoader with path to shared folder
        ComponentLoader.init('../shared');

        // Load sidebar and about modal in parallel
        await ComponentLoader.loadAll([
            {
                name: 'sidebar',
                target: '#sidebar-container',
                options: {
                    basePath: '..',
                    activeModule: 'documentation'
                }
            },
            {
                name: 'about-modal',
                target: '#about-modal-container',
                options: {
                    basePath: '..'
                }
            }
        ]);

        // Current date
        const currentDateEl = document.getElementById('currentDate');
        if (currentDateEl) {
            currentDateEl.textContent = new Date().toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Smooth scrolling
        this.setupSmoothScrolling();

        // Highlight active TOC link on scroll
        this.setupTOCObserver();

        // Load icons for design system
        this.loadIcons();

        // Setup Escape handler for icons modal
        this.setupEscapeHandler();
    },

    setupEscapeHandler() {
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideIconsModal();
            }
        };
    },

    setupSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    },

    setupTOCObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const id = entry.target.getAttribute('id');
                const tocLink = document.querySelector(`.toc-link[href="#${id}"]`);

                if (entry.isIntersecting) {
                    document.querySelectorAll('.toc-link').forEach(link => {
                        link.classList.remove('active');
                    });
                    if (tocLink) tocLink.classList.add('active');
                }
            });
        }, { root: null, rootMargin: '-20% 0px -70% 0px', threshold: 0 });

        document.querySelectorAll('.doc-section[id]').forEach(section => {
            observer.observe(section);
        });
    },

    loadIcons() {
        const gridNav = document.getElementById('iconsGridNav');
        const gridUI = document.getElementById('iconsGridUI');

        if (gridNav) {
            gridNav.innerHTML = this.iconsNav.map(name => {
                // Sanitize имя иконки (только буквы, цифры, дефис, подчеркивание)
                const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
                return `
                    <div class="icon-item" data-action="copy-icon-name" data-icon-name="${safeName}" data-icon-path="shared/icons/" title="Нажми чтобы скопировать">
                        <img src="../shared/icons/${safeName}.svg" alt="${safeName}" loading="lazy">
                        <span>${Utils.escapeHtml(name)}</span>
                    </div>
                `;
            }).join('');
        }

        if (gridUI) {
            gridUI.innerHTML = this.iconsUI.map(name => {
                // Sanitize имя иконки
                const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
                return `
                    <div class="icon-item" data-action="copy-icon-name" data-icon-name="${safeName}" data-icon-path="shared/icons/" title="Нажми чтобы скопировать">
                        <img src="../shared/icons/${safeName}.svg" alt="${safeName}" loading="lazy">
                        <span>${Utils.escapeHtml(name)}</span>
                    </div>
                `;
            }).join('');
        }
    },

    showIconsModal() {
        const modal = document.getElementById('iconsModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Добавить обработчик Escape только когда окно открыто
            if (this.escapeHandler) {
                document.addEventListener('keydown', this.escapeHandler);
            }
        }
    },

    hideIconsModal() {
        const modal = document.getElementById('iconsModal');
        if (modal && modal.classList.contains('active')) {
            modal.classList.remove('active');
            document.body.style.overflow = '';

            // Удалить обработчик Escape при закрытии
            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
            }
        }
    },

    copyIconName(name, path = '', targetElement = null) {
        const fullPath = path + name + '.svg';

        // Проверка поддержки clipboard API
        if (!navigator.clipboard) {
            // Fallback для старых браузеров
            this.fallbackCopyToClipboard(fullPath, targetElement);
            return;
        }

        navigator.clipboard.writeText(fullPath).then(() => {
            // Show feedback
            this.showCopyFeedback(targetElement, 'Скопировано!');
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            // Попытка fallback при ошибке
            this.fallbackCopyToClipboard(fullPath, targetElement);
        });
    },

    fallbackCopyToClipboard(text, targetElement) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (successful) {
                this.showCopyFeedback(targetElement, 'Скопировано!');
            } else {
                this.showCopyFeedback(targetElement, 'Ошибка!', true);
                if (window.Toast) {
                    Toast.error('Не удалось скопировать. Попробуйте вручную.');
                }
            }
        } catch (err) {
            console.error('Fallback копирование не удалось:', err);
            this.showCopyFeedback(targetElement, 'Ошибка!', true);
            if (window.Toast) {
                Toast.error('Копирование не поддерживается вашим браузером');
            }
        }
    },

    showCopyFeedback(targetElement, message, isError = false) {
        const item = targetElement;
        if (item) {
            const span = item.querySelector('span');
            if (span) {
                const originalText = span.textContent;
                span.textContent = message;
                if (isError) {
                    span.style.color = '#ff6b6b';
                }
                setTimeout(() => {
                    span.textContent = originalText;
                    if (isError) {
                        span.style.color = '';
                    }
                }, 1500);
            }
        }
    }
};

// Экспорт для глобального доступа (до DOMContentLoaded)
window.Documentation = Documentation;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    await Documentation.init();
});
