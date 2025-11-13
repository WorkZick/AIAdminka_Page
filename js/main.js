// Конфигурация сетки
const GRID_SIZE = { x: 100, y: 120 };
const GRID_PADDING = { x: 20, y: 20 };

// Конфигурация иконок по умолчанию (выровнены по сетке)
const DEFAULT_ICONS = [
    { id: 'excel', label: 'Excel отчеты', icon: 'file-spreadsheet', url: 'excel-reports/index.html', x: 20, y: 20, locked: false },
    { id: 'team', label: 'Team Info', icon: 'users', url: 'team-info/index.html', x: 20, y: 140, locked: false },
    { id: 'traffic', label: 'Расчет трафика', icon: 'trending-up', url: 'traffic-calculation/index.html', x: 20, y: 260, locked: false },
    { id: 'docs', label: 'Документация', icon: 'book-open', url: 'documentation/index.html', x: 20, y: 380, locked: false },
    { id: 'partners', label: 'Партнеры', icon: 'handshake', url: 'partners/index.html', x: 20, y: 500, locked: false },
    { id: 'about', label: 'О разработке', icon: 'info', url: null, x: 500, y: 300, special: 'about', locked: false }
];

/**
 * Класс для управления рабочим столом Windows XP
 * Обеспечивает drag-and-drop, контекстное меню, блокировку иконок
 */
class Desktop {
    constructor() {
        this.icons = this.loadIcons();
        this.draggedIcon = null;
        this.offsetX = 0;
        this.offsetY = 0;
        this.currentContextIcon = null;
        this.init();
    }

    /**
     * Инициализация рабочего стола
     * Отрисовка иконок, установка слушателей событий, запуск часов
     */
    init() {
        this.renderIcons();
        this.setupEventListeners();
        updateClock();
        setInterval(updateClock, 60000);
    }

    /**
     * Загрузка иконок из localStorage
     * @returns {Array} Массив объектов иконок
     */
    loadIcons() {
        const saved = localStorage.getItem('desktop-icons');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Error loading icons:', e);
            }
        }
        return [...DEFAULT_ICONS];
    }

    /**
     * Сохранение позиций иконок в localStorage
     */
    saveIcons() {
        localStorage.setItem('desktop-icons', JSON.stringify(this.icons));
    }

    renderIcons() {
        const container = document.getElementById('desktopIcons');
        container.innerHTML = '';

        this.icons.forEach(iconData => {
            const icon = document.createElement('div');
            icon.className = 'desktop-icon';
            if (iconData.locked) {
                icon.classList.add('locked');
            }
            icon.dataset.id = iconData.id;
            icon.dataset.url = iconData.url || '';
            icon.dataset.decorative = iconData.decorative || false;
            icon.dataset.special = iconData.special || '';
            icon.style.left = iconData.x + 'px';
            icon.style.top = iconData.y + 'px';

            const iconImage = document.createElement('div');
            iconImage.className = 'icon-image';
            iconImage.innerHTML = `<i data-lucide="${iconData.icon}"></i>`;

            const iconLabel = document.createElement('div');
            iconLabel.className = 'icon-label';
            iconLabel.textContent = iconData.label;

            icon.appendChild(iconImage);
            icon.appendChild(iconLabel);

            container.appendChild(icon);
        });

        // Инициализируем Lucide иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    setupEventListeners() {
        const container = document.getElementById('desktopIcons');
        const desktop = document.getElementById('desktop');
        let isDragging = false;
        let hasMoved = false;
        let clickStartTime = 0;
        let startX = 0;
        let startY = 0;
        const DRAG_THRESHOLD = 5; // Минимальное расстояние для начала drag (в пикселях)

        // Перетаскивание
        container.addEventListener('mousedown', (e) => {
            // Если правая кнопка мыши - не начинаем перетаскивание
            if (e.button === 2) return;

            const icon = e.target.closest('.desktop-icon');
            if (!icon) return;

            const iconId = icon.dataset.id;
            const iconData = this.icons.find(i => i.id === iconId);

            // Сохраняем иконку и начальные координаты для всех иконок (включая заблокированные)
            this.draggedIcon = icon;
            hasMoved = false;
            clickStartTime = Date.now();
            startX = e.clientX;
            startY = e.clientY;

            // Для заблокированных НЕ разрешаем drag, но разрешаем клик
            if (iconData && iconData.locked) {
                isDragging = false;
            } else {
                isDragging = true;
                const rect = icon.getBoundingClientRect();
                this.offsetX = e.clientX - rect.left;
                this.offsetY = e.clientY - rect.top;
            }

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.draggedIcon || !isDragging) return;

            // Проверяем, превышен ли порог перемещения
            const distance = Math.sqrt(
                Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2)
            );

            // Отмечаем что было перемещение (только если превышен порог)
            if (!hasMoved && distance > DRAG_THRESHOLD) {
                this.draggedIcon.classList.add('dragging');
                desktop.classList.add('dragging-active'); // Показываем сетку
                hasMoved = true;
            }

            // Перемещаем иконку только если превышен порог
            if (hasMoved) {
                const desktopRect = desktop.getBoundingClientRect();

                let x = e.clientX - desktopRect.left - this.offsetX;
                let y = e.clientY - desktopRect.top - this.offsetY;

                x = Math.max(0, Math.min(x, desktopRect.width - 100));
                y = Math.max(0, Math.min(y, desktopRect.height - 120));

                this.draggedIcon.style.left = x + 'px';
                this.draggedIcon.style.top = y + 'px';
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.draggedIcon) {
                // Убираем классы перетаскивания
                this.draggedIcon.classList.remove('dragging');
                desktop.classList.remove('dragging-active'); // Скрываем сетку

                // Только если было перемещение - сохраняем позицию
                if (hasMoved) {
                    const iconId = this.draggedIcon.dataset.id;
                    const icon = this.icons.find(i => i.id === iconId);
                    if (icon) {
                        icon.x = parseInt(this.draggedIcon.style.left);
                        icon.y = parseInt(this.draggedIcon.style.top);
                        this.saveIcons();
                    }
                } else {
                    // Если НЕ было перемещения - это клик, открываем модуль (в т.ч. для заблокированных)
                    const iconId = this.draggedIcon.dataset.id;
                    const iconData = this.icons.find(i => i.id === iconId);

                    if (iconData && iconData.special === 'about') {
                        showAboutModal();
                    } else {
                        const url = this.draggedIcon.dataset.url;
                        const isDecorative = this.draggedIcon.dataset.decorative === 'true';

                        if (url && !isDecorative) {
                            openModule(url);
                        }
                    }
                }

                this.draggedIcon = null;
                isDragging = false;
                hasMoved = false;
            }
        });

        // Контекстное меню
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const icon = e.target.closest('.desktop-icon');
            if (!icon) return;

            this.currentContextIcon = icon.dataset.id;
            const iconData = this.icons.find(i => i.id === this.currentContextIcon);

            // Обновляем текст блокировки
            const lockIcon = document.getElementById('contextLockIcon');
            const lockText = document.getElementById('contextLockText');
            const deleteItem = document.getElementById('contextDeleteItem');

            if (iconData.locked) {
                lockIcon.innerHTML = '<i data-lucide="lock"></i>';
                lockText.textContent = 'Разблокировать';
                deleteItem.classList.add('disabled');
            } else {
                lockIcon.innerHTML = '<i data-lucide="unlock"></i>';
                lockText.textContent = 'Заблокировать';
                deleteItem.classList.remove('disabled');
            }

            // Инициализируем Lucide иконки
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            showContextMenu(e.clientX, e.clientY);
        });

        // Закрытие контекстного меню при клике вне его
        document.addEventListener('click', () => {
            hideContextMenu();
        });

        // Закрытие при клике правой кнопкой вне иконки
        document.getElementById('desktop').addEventListener('contextmenu', (e) => {
            const icon = e.target.closest('.desktop-icon');
            if (!icon) {
                e.preventDefault();
                hideContextMenu();
            }
        });
    }

    /**
     * Переключение блокировки иконки
     * @param {string} iconId - ID иконки
     */
    toggleLock(iconId) {
        const icon = this.icons.find(i => i.id === iconId);
        if (icon) {
            icon.locked = !icon.locked;
            this.saveIcons();
            this.renderIcons();
        }
    }

    /**
     * Блокировка всех иконок (запрет перемещения)
     */
    lockAll() {
        this.icons.forEach(icon => icon.locked = true);
        this.saveIcons();
        this.renderIcons();
    }

    /**
     * Разблокировка всех иконок
     */
    unlockAll() {
        this.icons.forEach(icon => icon.locked = false);
        this.saveIcons();
        this.renderIcons();
    }

    /**
     * Удаление иконки с рабочего стола
     * @param {string} iconId - ID иконки
     */
    deleteIcon(iconId) {
        const icon = this.icons.find(i => i.id === iconId);
        if (icon && icon.locked) {
            return; // Не удаляем заблокированные
        }

        if (confirm('Удалить эту иконку с рабочего стола?')) {
            this.icons = this.icons.filter(i => i.id !== iconId);
            this.saveIcons();
            this.renderIcons();
        }
    }

    /**
     * Выравнивание всех иконок по сетке
     */
    alignToGrid() {
        this.icons.forEach(icon => {
            // Вычисляем ближайшую позицию на сетке
            const gridX = Math.round((icon.x - GRID_PADDING.x) / GRID_SIZE.x) * GRID_SIZE.x + GRID_PADDING.x;
            const gridY = Math.round((icon.y - GRID_PADDING.y) / GRID_SIZE.y) * GRID_SIZE.y + GRID_PADDING.y;

            icon.x = Math.max(GRID_PADDING.x, gridX);
            icon.y = Math.max(GRID_PADDING.y, gridY);
        });

        this.saveIcons();
        this.renderIcons();
    }

    /**
     * Сброс позиций всех иконок к значениям по умолчанию
     */
    reset() {
        if (confirm('Вернуть все иконки в исходное положение?')) {
            this.icons = [...DEFAULT_ICONS];
            this.saveIcons();
            this.renderIcons();
        }
    }
}

// Функции контекстного меню
function showContextMenu(x, y) {
    const menu = document.getElementById('contextMenu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('show');
}

function hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('show');
}

function contextMenuAction(action) {
    const iconId = desktop.currentContextIcon;
    if (!iconId) return;

    const iconData = desktop.icons.find(i => i.id === iconId);

    switch(action) {
        case 'open':
            if (iconData.special === 'about') {
                showAboutModal();
            } else if (iconData.url && !iconData.decorative) {
                openModule(iconData.url);
            }
            break;
        case 'lock':
            desktop.toggleLock(iconId);
            break;
        case 'delete':
            if (!iconData.locked) {
                desktop.deleteIcon(iconId);
            }
            break;
    }

    hideContextMenu();
}

// Часы в системном трее
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}`;
}

// Переключение меню Пуск
function toggleStartMenu() {
    const menu = document.getElementById('startMenu');
    menu.classList.toggle('show');
}

// Закрытие меню при клике вне его
document.addEventListener('click', function(event) {
    const menu = document.getElementById('startMenu');
    const startButton = document.querySelector('.start-button');

    if (!menu.contains(event.target) && !startButton.contains(event.target)) {
        menu.classList.remove('show');
    }
});

// Открытие модуля
function openModule(url) {
    if (url) {
        window.location.href = url;
    }
}

// Сброс рабочего стола
function resetDesktop() {
    desktop.reset();
    toggleStartMenu();
}

// Предотвращаем выделение текста при перетаскивании
document.addEventListener('selectstart', (e) => {
    if (desktop.draggedIcon) {
        e.preventDefault();
    }
});

// Показать модальное окно "О разработке"
function showAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Скрыть модальное окно "О разработке"
function closeAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Инициализация рабочего стола
const desktop = new Desktop();

console.log('✅ SimpleAIAdminka главная страница загружена');