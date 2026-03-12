/**
 * Environment Configuration - Single Source of Truth
 * Централизованная конфигурация окружений (prod/test)
 */

const EnvConfig = {
    // OAuth конфигурация (Single Source of Truth)
    OAUTH: {
        CLIENT_ID: '552590459404-muqkuq0qa461763qfdt3ec62mfua49c6.apps.googleusercontent.com',
        SCOPES: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',

        getRedirectUri() {
            const host = window.location.hostname;
            if (host === '127.0.0.1' || host === 'localhost') {
                return 'http://127.0.0.1:5500/SimpleAIAdminka/login/callback.html';
            }
            return 'https://workzick.github.io/AIAdminka_Page/login/callback.html';
        },

        generateState() {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        }
    },

    // Доступные окружения
    ENVIRONMENTS: {
        prod: {
            name: 'Production',
            url: 'https://script.google.com/macros/s/AKfycbzyBCK_pgYgYo2Caz0xutGNLfapnxhpOKplgBPOfjrEr73XDRMgY5FgmIQivHC9rvfy/exec'
        },
        test: {
            name: 'Test',
            url: 'https://script.google.com/macros/s/AKfycbxodDVUhGmzK9sOsHcOJF-Qi2d4RdmAXlH3W2PQR8RXzpuKFsFp-Hddlnhs-VyhNYcjmw/exec'
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
     * В production ВСЕГДА используется prod (игнорируем localStorage)
     */
    getCurrentEnv() {
        if (this.isLocalhost()) {
            return localStorage.getItem(this.STORAGE_KEY) || 'test';
        }
        // В production всегда prod — защита от подмены через localStorage
        return this.DEFAULT_ENV;
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
        if (!this.isLocalhost()) {
            console.error('EnvConfig: Environment switching disabled in production');
            return false;
        }
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
