// Единый модуль управления версией приложения
// Загружает версию из changelog.json и обновляет все элементы с class="app-version"

const AppVersion = {
    version: null,

    async init() {
        await this.loadVersion();
        this.updateAllElements();
    },

    async loadVersion() {
        // Определяем путь к changelog.json в зависимости от расположения страницы
        const paths = [
            'documentation/data/changelog.json',      // для главной
            '../documentation/data/changelog.json',   // для подпапок (team-info, partners и т.д.)
            '../../documentation/data/changelog.json' // для вложенных подпапок
        ];

        for (const path of paths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    const data = await response.json();
                    if (data.version) {
                        this.version = data.version;
                        console.log(`✅ Версия загружена: ${this.version}`);
                        return;
                    }
                }
            } catch (e) {
                // Пробуем следующий путь
            }
        }

        console.warn('⚠️ Не удалось загрузить версию из changelog.json');
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
