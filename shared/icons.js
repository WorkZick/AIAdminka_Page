/**
 * Локальная система иконок (замена Lucide)
 * Все иконки хранятся в shared/icons/*.svg
 */
const LocalIcons = {
    // Кэш загруженных иконок
    cache: {},

    // Базовый путь к иконкам (определяется автоматически)
    basePath: '',

    /**
     * Инициализация системы иконок
     */
    init() {
        // Определяем базовый путь относительно текущей страницы
        const scripts = document.getElementsByTagName('script');
        for (let script of scripts) {
            if (script.src && script.src.includes('icons.js')) {
                this.basePath = script.src.replace('icons.js', 'icons/');
                break;
            }
        }

        // Fallback если не нашли
        if (!this.basePath) {
            // Определяем глубину вложенности по URL
            const path = window.location.pathname;
            // Проверяем, находимся ли мы в подпапке
            if (path.includes('/traffic-calculation/') ||
                path.includes('/documentation/') ||
                path.includes('/excel-reports/') ||
                path.includes('/partners/') ||
                path.includes('/sync/') ||
                path.includes('/team-info/')) {
                this.basePath = '../shared/icons/';
            } else {
                this.basePath = 'shared/icons/';
            }
        }

        // Добавляем CSS стили для иконок
        this.injectStyles();
    },

    /**
     * Добавить CSS стили для иконок
     */
    injectStyles() {
        if (document.getElementById('local-icons-styles')) return;

        const style = document.createElement('style');
        style.id = 'local-icons-styles';
        style.textContent = `
            .local-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                vertical-align: middle;
            }
            .local-icon svg {
                width: 1em;
                height: 1em;
                stroke: currentColor;
                fill: none;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
            }
            h1 .local-icon svg,
            h2 .local-icon svg {
                width: 1.2em;
                height: 1.2em;
            }
            button .local-icon svg,
            .btn .local-icon svg {
                width: 16px;
                height: 16px;
                margin-right: 4px;
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * Получить SVG иконку
     * @param {string} name - Имя иконки (без .svg)
     * @returns {Promise<string>} SVG контент
     */
    async get(name) {
        if (this.cache[name]) {
            return this.cache[name];
        }

        try {
            const response = await fetch(this.basePath + name + '.svg');
            if (!response.ok) {
                console.warn(`Иконка "${name}" не найдена`);
                return this.getFallback();
            }
            const svg = await response.text();
            this.cache[name] = svg;
            return svg;
        } catch (e) {
            console.warn(`Ошибка загрузки иконки "${name}":`, e);
            return this.getFallback();
        }
    },

    /**
     * Fallback иконка (пустой квадрат)
     */
    getFallback() {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
    },

    /**
     * Заменить все <i data-lucide="..."> на SVG
     * Совместимость с Lucide API
     */
    async createIcons() {
        const elements = document.querySelectorAll('i[data-lucide]');

        for (const el of elements) {
            const iconName = el.getAttribute('data-lucide');
            const svg = await this.get(iconName);

            // Создаем span с SVG
            const span = document.createElement('span');
            span.className = 'local-icon';
            span.innerHTML = svg;

            // Копируем стили если есть
            if (el.style.cssText) {
                const svgEl = span.querySelector('svg');
                if (svgEl) {
                    // Парсим inline стили
                    const style = el.style;
                    if (style.width) svgEl.style.width = style.width;
                    if (style.height) svgEl.style.height = style.height;
                    if (style.color) svgEl.style.color = style.color;
                    if (style.verticalAlign) svgEl.style.verticalAlign = style.verticalAlign;
                    if (style.opacity) svgEl.style.opacity = style.opacity;
                }
            }

            // Копируем классы
            if (el.className) {
                span.className += ' ' + el.className;
            }

            // Заменяем элемент
            el.replaceWith(span);
        }
    },

    /**
     * Создать HTML для иконки (синхронно из кэша или placeholder)
     * @param {string} name - Имя иконки
     * @param {object} options - Опции {width, height, class}
     * @returns {string} HTML строка
     */
    html(name, options = {}) {
        const width = options.width || 24;
        const height = options.height || 24;
        const className = options.class || '';

        // Если иконка в кэше - используем её
        if (this.cache[name]) {
            let svg = this.cache[name];
            // Модифицируем размеры
            svg = svg.replace(/width="24"/, `width="${width}"`);
            svg = svg.replace(/height="24"/, `height="${height}"`);
            return `<span class="local-icon ${className}">${svg}</span>`;
        }

        // Иначе возвращаем placeholder с data-атрибутом для отложенной загрузки
        return `<i data-lucide="${name}" style="width:${width}px;height:${height}px;" class="${className}"></i>`;
    }
};

// Инициализация при загрузке
LocalIcons.init();

// Глобальный объект для совместимости с Lucide API
window.lucide = {
    createIcons: () => LocalIcons.createIcons()
};

// Автозагрузка иконок при готовности DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => LocalIcons.createIcons());
} else {
    LocalIcons.createIcons();
}

console.log('✅ LocalIcons loaded');
