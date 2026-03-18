// Единый модуль управления версией приложения
// Загружает версию из changelog.json и обновляет все элементы с class="app-version"

const AppVersion = {
    version: null,
    // Fallback версия на случай если changelog.json недоступен
    FALLBACK_VERSION: '2.24.3',

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
            // Failed to load version from changelog.json, will use fallback
        }

        // Используем fallback версию если загрузка не удалась
        if (!this.version) {
            this.version = this.FALLBACK_VERSION;
            console.info('ℹ️ Используется fallback версия:', this.version);
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
        const folders = ['partners', 'partner-onboarding', 'team-info', 'traffic-calculation', 'documentation', 'login', 'excel-reports', 'sync', 'admin'];
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

        // Отправляем событие что версия обновлена
        document.dispatchEvent(new CustomEvent('app-version-loaded', {
            detail: { version: this.version }
        }));
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
