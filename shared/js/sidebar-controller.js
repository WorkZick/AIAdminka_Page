/**
 * AIAdminka Sidebar Controller
 * Управление состоянием sidebar
 * @version 1.1 - Добавлена динамическая генерация модулей
 */

const SidebarController = {
    sidebar: null,
    activeModule: null,
    basePath: '',

    // Конфигурация всех модулей системы
    MODULES_CONFIG: [
        { id: 'home', name: 'Главная', icon: 'main_page', href: '/index.html', alwaysVisible: true },
        { id: 'reports', name: 'Отчеты', icon: 'excel_reports', href: '/excel-reports/index.html' },
        { id: 'team-info', name: 'Сотрудники', icon: 'team_info', href: '/team-info/index.html' },
        { id: 'traffic', name: 'Расчет трафика', icon: 'traffic-calculation', href: '/traffic-calculation/index.html' },
        { id: 'partners', name: 'Партнеры', icon: 'partners', href: '/partners/index.html' },
        { id: 'documentation', name: 'Документация', icon: 'documents', href: '/documentation/index.html' },
        { id: 'settings', name: 'Настройки', icon: 'sync', href: '/sync/index.html' },
        // Разделитель перед админкой
        { id: 'separator', type: 'separator' },
        { id: 'admin-panel', name: 'Администрирование', icon: 'admin', href: '/admin/index.html', hasBadge: true }
    ],

    /**
     * Инициализация контроллера
     * @param {Object} options
     * @param {string} options.activeModule - текущий модуль для подсветки
     * @param {string} options.basePath - базовый путь для ссылок
     * @param {boolean} options.dynamicModules - использовать динамическую генерацию модулей
     */
    init(options = {}) {
        this.sidebar = document.getElementById('sidebar');
        if (!this.sidebar) return;

        this.activeModule = options.activeModule || null;
        this.basePath = options.basePath || '';

        // Восстанавливаем состояние collapsed из localStorage
        this.restoreState();

        // Подключаем toggle button
        this.initToggleButton();

        // Динамическая генерация модулей или применение RoleGuard
        if (options.dynamicModules) {
            this.renderDynamicModules();
        } else {
            // Применяем RoleGuard если доступен
            this.applyRoleGuard();
        }

        // Устанавливаем активный пункт меню
        if (this.activeModule) {
            this.setActiveItem(this.activeModule);
        }
    },

    /**
     * Инициализация кнопки toggle
     */
    initToggleButton() {
        const toggleBtn = this.sidebar?.querySelector('#sidebarToggleBtn');
        if (!toggleBtn) return;

        // Убираем предыдущий обработчик (защита от повторного init)
        if (this._toggleHandler) {
            toggleBtn.removeEventListener('click', this._toggleHandler);
        }
        this._toggleHandler = () => this.toggle();
        toggleBtn.addEventListener('click', this._toggleHandler);
    },

    /**
     * Toggle sidebar (свернуть/развернуть)
     */
    toggle() {
        if (!this.sidebar) return;

        this.sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed',
            this.sidebar.classList.contains('collapsed'));
    },

    /**
     * Восстановление состояния из localStorage
     */
    restoreState() {
        if (!this.sidebar) return;

        // Отключаем анимацию на время восстановления
        this.sidebar.classList.add('no-transition');

        if (localStorage.getItem('sidebar-collapsed') === 'true') {
            this.sidebar.classList.add('collapsed');
        }

        // Включаем анимацию обратно после рендера
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.sidebar.classList.remove('no-transition');
            });
        });
    },

    /**
     * Установка активного пункта меню
     * @param {string} moduleId
     */
    setActiveItem(moduleId) {
        if (!this.sidebar) return;

        // Убираем active со всех
        this.sidebar.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });

        // Находим и активируем нужный
        const activeItem = this.sidebar.querySelector(
            `[data-module="${moduleId}"]`
        );
        if (activeItem) {
            activeItem.classList.add('active');
        }
    },

    /**
     * Обновление badge с количеством запросов
     * @param {number} count
     */
    updateRequestsBadge(count) {
        const badge = this.sidebar?.querySelector('.requests-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    },

    /**
     * Применение RoleGuard для скрытия недоступных пунктов
     * Примечание: RoleGuard.applyUI() сам скроет элементы после инициализации,
     * поэтому здесь мы только проверяем если RoleGuard уже готов
     */
    applyRoleGuard() {
        // Не применяем если RoleGuard не определён или не инициализирован
        if (typeof RoleGuard === 'undefined') return;
        if (!RoleGuard.initialized) return;

        this.sidebar?.querySelectorAll('[data-module]').forEach(item => {
            const module = item.dataset.module;
            if (!RoleGuard.canAccess(module)) {
                item.style.display = 'none';
            }
        });
    },

    /**
     * Динамическая генерация модулей на основе прав пользователя
     * Используется когда RoleGuard инициализирован
     */
    renderDynamicModules() {
        if (!this.sidebar) return;

        const menuContainer = this.sidebar.querySelector('.sidebar-menu');
        if (!menuContainer) return;

        // Очищаем текущие модули
        menuContainer.innerHTML = '';

        // Получаем права пользователя
        const hasRoleGuard = typeof RoleGuard !== 'undefined' && RoleGuard.initialized;

        // Генерируем элементы меню
        this.MODULES_CONFIG.forEach(module => {
            // Разделитель
            if (module.type === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'menu-separator';
                menuContainer.appendChild(separator);
                return;
            }

            // Проверка доступа
            const canAccess = module.alwaysVisible ||
                !hasRoleGuard ||
                RoleGuard.canAccess(module.id);

            if (!canAccess) return;

            // Создаём элемент меню
            const menuItem = document.createElement('a');
            menuItem.href = this.basePath + module.href;
            menuItem.className = 'menu-item';
            menuItem.dataset.module = module.id;

            menuItem.innerHTML = `
                <span>${this.escapeHtml(module.name)}</span>
                <img src="${this.basePath}/shared/icons/${module.icon}.svg" width="18" height="18" alt="">
                ${module.hasBadge ? '<span class="requests-badge" id="adminRequestsBadge"></span>' : ''}
            `;

            menuContainer.appendChild(menuItem);
        });

        // Устанавливаем активный пункт если задан
        if (this.activeModule) {
            this.setActiveItem(this.activeModule);
        }
    },

    /**
     * Экранирование HTML для безопасности
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Развернуть sidebar
     */
    expand() {
        if (!this.sidebar) return;
        this.sidebar.classList.remove('collapsed');
        localStorage.setItem('sidebar-collapsed', 'false');
    },

    /**
     * Свернуть sidebar
     */
    collapse() {
        if (!this.sidebar) return;
        this.sidebar.classList.add('collapsed');
        localStorage.setItem('sidebar-collapsed', 'true');
    },

    /**
     * Проверка свёрнут ли sidebar
     * @returns {boolean}
     */
    isCollapsed() {
        return this.sidebar?.classList.contains('collapsed') || false;
    }
};

/**
 * Глобальная функция для onclick в HTML
 */
function toggleSidebar() {
    SidebarController.toggle();
}

// Экспорт для использования
if (typeof window !== 'undefined') {
    window.SidebarController = SidebarController;
    window.toggleSidebar = toggleSidebar;
}
