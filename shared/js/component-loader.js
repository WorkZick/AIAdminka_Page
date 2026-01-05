/**
 * AIAdminka Component Loader
 * Загружает HTML компоненты и инициализирует их
 * @version 1.0
 */

const ComponentLoader = {
    basePath: '../shared',
    loadedComponents: new Map(),

    /**
     * Инициализация загрузчика
     * @param {string} basePath - базовый путь до shared/
     */
    init(basePath = '../shared') {
        this.basePath = basePath;
    },

    /**
     * Загрузка компонента
     * @param {string} name - имя компонента (sidebar, about-modal)
     * @param {string} targetSelector - селектор куда вставить
     * @param {Object} options - дополнительные опции
     * @returns {Promise<boolean>}
     */
    async load(name, targetSelector, options = {}) {
        const target = document.querySelector(targetSelector);
        if (!target) {
            console.error(`[ComponentLoader] Target element "${targetSelector}" not found`);
            return false;
        }

        try {
            const response = await fetch(`${this.basePath}/components/${name}.html`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            let html = await response.text();

            // Применяем опции (замена плейсхолдеров)
            html = this.processTemplate(html, options);

            // Вставляем HTML
            if (options.replace) {
                target.outerHTML = html;
            } else {
                target.innerHTML = html;
            }

            // Инициализируем компонент
            await this.initComponent(name, options);

            this.loadedComponents.set(name, true);
            return true;
        } catch (error) {
            console.error(`[ComponentLoader] Error loading component "${name}":`, error);
            return false;
        }
    },

    /**
     * Обработка шаблона с переменными
     * Заменяет {{variable}} на значения из options
     * @param {string} html
     * @param {Object} options
     * @returns {string}
     */
    processTemplate(html, options) {
        return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return options[key] !== undefined ? options[key] : match;
        });
    },

    /**
     * Инициализация компонента после загрузки
     * @param {string} name
     * @param {Object} options
     */
    async initComponent(name, options) {
        switch (name) {
            case 'sidebar':
                if (typeof SidebarController !== 'undefined') {
                    SidebarController.init(options);
                }
                break;
            case 'about-modal':
                // About modal готов к использованию
                break;
        }
    },

    /**
     * Загрузка нескольких компонентов
     * @param {Array} components - массив {name, target, options}
     * @returns {Promise<boolean[]>}
     */
    async loadAll(components) {
        const promises = components.map(c =>
            this.load(c.name, c.target, c.options || {})
        );
        return Promise.all(promises);
    },

    /**
     * Проверка загружен ли компонент
     * @param {string} name
     * @returns {boolean}
     */
    isLoaded(name) {
        return this.loadedComponents.has(name);
    }
};

// Экспорт для использования
if (typeof window !== 'undefined') {
    window.ComponentLoader = ComponentLoader;
}
