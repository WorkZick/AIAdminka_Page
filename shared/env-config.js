/**
 * Environment Configuration - Single Source of Truth
 * Централизованная конфигурация окружений (prod/test)
 */

const EnvConfig = {
    // Доступные окружения
    ENVIRONMENTS: {
        prod: {
            name: 'Production',
            url: 'https://script.google.com/macros/s/AKfycbyeWmZs028zVkzKTrqNTbzTasKK0Z63eCfV1I4RUV6BJWMH8r62kScLh7U5B45bHRRILA/exec'
        },
        test: {
            name: 'Test',
            url: 'https://script.google.com/macros/s/AKfycbySiZ7HbLe4H8jSuFEcmdrIDtq9x9GA2THZdg7RXMrruDKv_qjZzMK_vRaDYygU4mQbZA/exec'
        }
    },

    // Ключ в localStorage
    STORAGE_KEY: 'cloud-storage-env',

    // Окружение по умолчанию
    DEFAULT_ENV: 'prod',

    /**
     * Проверка localhost (для автоматического выбора test)
     */
    isLocalhost() {
        const host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
    },

    /**
     * Получить текущее окружение
     * На localhost автоматически используется test
     */
    getCurrentEnv() {
        // На localhost всегда test (для разработки)
        if (this.isLocalhost()) {
            return 'test';
        }
        return localStorage.getItem(this.STORAGE_KEY) || this.DEFAULT_ENV;
    },

    /**
     * Получить URL текущего окружения
     */
    getScriptUrl() {
        const env = this.getCurrentEnv();
        return this.ENVIRONMENTS[env]?.url || this.ENVIRONMENTS[this.DEFAULT_ENV].url;
    },

    /**
     * Получить информацию о текущем окружении
     */
    getInfo() {
        const env = this.getCurrentEnv();
        return {
            current: env,
            name: this.ENVIRONMENTS[env]?.name || 'Unknown',
            url: this.getScriptUrl()
        };
    },

    /**
     * Установить окружение
     */
    setEnvironment(env) {
        if (!this.ENVIRONMENTS[env]) {
            console.error('EnvConfig: Invalid environment:', env);
            return false;
        }
        localStorage.setItem(this.STORAGE_KEY, env);
        return true;
    },

    /**
     * Проверить, является ли текущее окружение тестовым
     */
    isTestEnv() {
        return this.getCurrentEnv() === 'test';
    },

    /**
     * Проверить, является ли текущее окружение production
     */
    isProduction() {
        return this.getCurrentEnv() === 'prod' && !this.isLocalhost();
    }
};

// В production подавляем console.log и console.warn (оставляем console.error)
if (EnvConfig.isProduction()) {
    console.log = function() {};
    console.warn = function() {};
}

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnvConfig;
}
