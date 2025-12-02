// Единый модуль управления версией приложения
// Загружает версию из changelog.json и обновляет все элементы с class="app-version"

const AppVersion = {
    version: null,

    async init() {
        await this.loadVersion();
        this.updateAllElements();
    },

    async loadVersion() {
        // Определяем путь к changelog.json на основе текущего URL
        const path = this.getChangelogPath();

        try {
            const response = await fetch(path);
            if (response.ok) {
                const data = await response.json();
                if (data.version) {
                    this.version = data.version;
                    return;
                }
            }
        } catch (e) {
            console.warn('⚠️ Не удалось загрузить версию из changelog.json');
        }
    },

    getChangelogPath() {
        const pathname = window.location.pathname;

        // Находим базовый путь до SimpleAIAdminka
        const match = pathname.match(/(.*SimpleAIAdminka)/);
        if (match) {
            return match[1] + '/documentation/data/changelog.json';
        }

        // Fallback: определяем глубину вложенности
        const folders = ['partners', 'methods', 'team-info', 'traffic-calculation', 'documentation', 'feedback', 'login', 'excel-reports', 'sync'];
        for (const folder of folders) {
            if (pathname.includes('/' + folder + '/')) {
                return '../documentation/data/changelog.json';
            }
        }

        return 'documentation/data/changelog.json';
    },

    updateAllElements() {
        if (!this.version) return;

        // Обновляем все элементы с классом app-version
        document.querySelectorAll('.app-version').forEach(el => {
            const format = el.dataset.format || 'version'; // version, full, short
            el.textContent = this.formatVersion(format);
        });

        // Также обновляем элемент с id="versionText" для обратной совместимости
        const versionText = document.getElementById('versionText');
        if (versionText) {
            versionText.textContent = 'Version ' + this.version;
        }
    },

    formatVersion(format) {
        switch (format) {
            case 'full':
                return 'Version ' + this.version;
            case 'short':
                return 'v' + this.version;
            case 'russian':
                return 'Версия: ' + this.version;
            default:
                return this.version;
        }
    },

    getVersion() {
        return this.version;
    }
};

// Автоинициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    AppVersion.init();
});
