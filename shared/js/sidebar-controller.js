/**
 * AIAdminka Sidebar Controller
 * Управление состоянием sidebar
 * @version 1.0
 */

const SidebarController = {
    sidebar: null,
    activeModule: null,

    /**
     * Инициализация контроллера
     * @param {Object} options
     * @param {string} options.activeModule - текущий модуль для подсветки
     */
    init(options = {}) {
        this.sidebar = document.getElementById('sidebar');
        if (!this.sidebar) {
            console.warn('[SidebarController] Sidebar element not found');
            return;
        }

        this.activeModule = options.activeModule || null;

        // Восстанавливаем состояние collapsed из localStorage
        this.restoreState();

        // Устанавливаем активный пункт меню
        if (this.activeModule) {
            this.setActiveItem(this.activeModule);
        }

        // Применяем RoleGuard если доступен
        this.applyRoleGuard();
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
