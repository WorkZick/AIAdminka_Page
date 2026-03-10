/**
 * AIAdminka Component Loader
 * Загружает HTML компоненты и инициализирует их
 * @version 1.0
 */

const ComponentLoader = {
    basePath: '../shared',
    loadedComponents: new Map(),
    // Whitelist of allowed components for script execution
    allowedComponents: new Set(['sidebar', 'about-modal']),

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
            let html;
            const cacheKey = `component-cache-${name}`;

            // Пробуем sessionStorage кеш (очищается при закрытии вкладки)
            const cachedHtml = sessionStorage.getItem(cacheKey);
            if (cachedHtml) {
                html = cachedHtml;
            } else {
                const response = await fetch(`${this.basePath}/components/${name}.html`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                html = await response.text();

                // Кешируем в sessionStorage
                try {
                    sessionStorage.setItem(cacheKey, html);
                } catch (e) {
                    // sessionStorage переполнен — продолжаем без кеша
                }
            }

            // Применяем опции (замена плейсхолдеров)
            html = this.processTemplate(html, options);

            // Вставляем HTML
            if (options.replace) {
                target.outerHTML = html;
            } else {
                target.innerHTML = html;
            }

            // Выполняем скрипты только для разрешённых компонентов
            this.executeScripts(target, name);

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
     * Выполнение скриптов внутри загруженного HTML
     * innerHTML не выполняет скрипты автоматически
     * SECURITY: Only executes scripts for whitelisted components
     * @param {HTMLElement} container
     * @param {string} componentName - name of the component being loaded
     */
    executeScripts(container, componentName) {
        // Security check: only allow script execution for whitelisted components
        if (!this.allowedComponents.has(componentName)) return;

        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            // Block external scripts for additional security
            if (oldScript.src) return;

            const newScript = document.createElement('script');
            // Копируем атрибуты (except src which is already blocked)
            Array.from(oldScript.attributes).forEach(attr => {
                if (attr.name !== 'src') {
                    newScript.setAttribute(attr.name, attr.value);
                }
            });
            // Копируем содержимое
            newScript.textContent = oldScript.textContent;
            // Заменяем старый скрипт новым (это выполнит его)
            oldScript.parentNode.replaceChild(newScript, oldScript);
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
                // Обновляем версию в sidebar после загрузки
                if (typeof AppVersion !== 'undefined') {
                    if (AppVersion.version) {
                        AppVersion.updateAllElements();
                    } else {
                        // Версия ещё не загружена - ждём событие
                        document.addEventListener('app-version-loaded', () => {
                            AppVersion.updateAllElements();
                        }, { once: true });
                    }
                }
                break;
            case 'about-modal':
                // Инициализируем обработчики событий
                if (typeof AboutModal !== 'undefined') {
                    AboutModal.init();
                }
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
