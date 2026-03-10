/**
 * Environment Configuration - Single Source of Truth
 * Централизованная конфигурация окружений (prod/test)
 */

const EnvConfig = {
    // Production окружение
    ENVIRONMENTS: {
        prod: {
            name: 'Production',
            url: 'https://script.google.com/macros/s/AKfycbzyBCK_pgYgYo2Caz0xutGNLfapnxhpOKplgBPOfjrEr73XDRMgY5FgmIQivHC9rvfy/exec'
        }
    },

    // Окружение по умолчанию
    DEFAULT_ENV: 'prod',

    /**
     * Получить текущее окружение (всегда prod)
     */
    getCurrentEnv() {
        return this.DEFAULT_ENV;
    },

    /**
     * Получить URL текущего окружения
     */
    getScriptUrl() {
        return this.ENVIRONMENTS[this.DEFAULT_ENV].url;
    },

    /**
     * Получить информацию о текущем окружении
     */
    getInfo() {
        return {
            current: 'prod',
            name: 'Production',
            url: this.getScriptUrl()
        };
    },

    /**
     * Установить окружение (отключено в production)
     */
    setEnvironment() {
        console.error('EnvConfig: Environment switching disabled in production');
        return false;
    },

    /**
     * Проверить, является ли текущее окружение тестовым
     */
    isTestEnv() {
        return false;
    },

    /**
     * Проверить, является ли текущее окружение production
     */
    isProduction() {
        return true;
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
