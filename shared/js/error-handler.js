/**
 * ErrorHandler - Единый модуль обработки ошибок для всего приложения
 *
 * Возможности:
 * - Централизованная обработка и логирование ошибок
 * - Категоризация ошибок (сеть, авторизация, валидация и т.д.)
 * - Автоматические Toast уведомления для пользователя
 * - Интеграция с мониторингом (опционально)
 * - Поддержка context для детального логирования
 */

const ErrorHandler = (() => {
  // Типы ошибок
  const ErrorType = {
    NETWORK: 'network',           // Проблемы с сетью
    AUTH: 'auth',                 // Ошибки авторизации
    VALIDATION: 'validation',     // Ошибки валидации
    PERMISSION: 'permission',     // Недостаточно прав
    NOT_FOUND: 'not_found',       // Ресурс не найден
    SERVER: 'server',             // Серверная ошибка
    QUOTA: 'quota',               // Превышена квота (localStorage и т.д.)
    UNKNOWN: 'unknown'            // Неизвестная ошибка
  };

  // Уровни серьезности
  const ErrorSeverity = {
    LOW: 'low',         // Незначительные ошибки (можно продолжать работу)
    MEDIUM: 'medium',   // Средние ошибки (частичная потеря функционала)
    HIGH: 'high',       // Серьёзные ошибки (требуют внимания)
    CRITICAL: 'critical' // Критические ошибки (приложение может не работать)
  };

  // Конфигурация
  const config = {
    logToConsole: true,           // Логировать в консоль
    showToast: true,              // Показывать Toast уведомления
    sendToMonitoring: false,      // Отправлять в систему мониторинга
    maxStoredErrors: 50           // Максимум ошибок в истории
  };

  // История ошибок (для отладки/аналитики)
  let errorHistory = [];

  /**
   * Определить тип ошибки по её содержимому
   */
  function detectErrorType(error) {
    const message = error.message?.toLowerCase() || '';

    // Сетевые ошибки
    if (message.includes('fetch') ||
        message.includes('network') ||
        message.includes('connection') ||
        error.name === 'NetworkError') {
      return ErrorType.NETWORK;
    }

    // Ошибки авторизации
    if (message.includes('unauthorized') ||
        message.includes('auth') ||
        message.includes('token') ||
        message.includes('login') ||
        error.status === 401) {
      return ErrorType.AUTH;
    }

    // Ошибки прав доступа
    if (message.includes('permission') ||
        message.includes('forbidden') ||
        message.includes('access denied') ||
        error.status === 403) {
      return ErrorType.PERMISSION;
    }

    // Ошибки валидации
    if (message.includes('validat') ||
        message.includes('invalid') ||
        message.includes('required') ||
        error.status === 400) {
      return ErrorType.VALIDATION;
    }

    // Ресурс не найден
    if (message.includes('not found') || error.status === 404) {
      return ErrorType.NOT_FOUND;
    }

    // Превышена квота
    if (message.includes('quota') ||
        error.name === 'QuotaExceededError') {
      return ErrorType.QUOTA;
    }

    // Серверные ошибки
    if (error.status >= 500 || message.includes('server error')) {
      return ErrorType.SERVER;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Определить уровень серьезности
   */
  function detectSeverity(type, error) {
    switch (type) {
      case ErrorType.CRITICAL:
      case ErrorType.AUTH:
        return ErrorSeverity.CRITICAL;

      case ErrorType.NETWORK:
      case ErrorType.SERVER:
      case ErrorType.PERMISSION:
        return ErrorSeverity.HIGH;

      case ErrorType.VALIDATION:
      case ErrorType.NOT_FOUND:
        return ErrorSeverity.MEDIUM;

      case ErrorType.QUOTA:
      default:
        return ErrorSeverity.LOW;
    }
  }

  /**
   * Получить понятное пользователю сообщение
   */
  function getUserMessage(type, error, context) {
    const defaultMessages = {
      [ErrorType.NETWORK]: 'Проблема с подключением к интернету',
      [ErrorType.AUTH]: 'Ошибка авторизации. Войдите заново',
      [ErrorType.VALIDATION]: 'Проверьте правильность введённых данных',
      [ErrorType.PERMISSION]: 'Недостаточно прав для выполнения операции',
      [ErrorType.NOT_FOUND]: 'Запрашиваемый ресурс не найден',
      [ErrorType.SERVER]: 'Ошибка сервера. Попробуйте позже',
      [ErrorType.QUOTA]: 'Превышен лимит хранилища. Очистите данные',
      [ErrorType.UNKNOWN]: 'Произошла неизвестная ошибка'
    };

    // Если есть кастомное сообщение в context
    if (context?.userMessage) {
      return context.userMessage;
    }

    // Если ошибка имеет понятное сообщение
    if (error.userMessage) {
      return error.userMessage;
    }

    // Использовать дефолтное сообщение
    return defaultMessages[type] || defaultMessages[ErrorType.UNKNOWN];
  }

  /**
   * Основной метод обработки ошибки
   * @param {Error|string} error - Объект ошибки или строка
   * @param {Object} context - Контекст ошибки (модуль, действие, данные)
   * @param {Object} options - Опции обработки
   * @returns {Object} Обработанная информация об ошибке
   */
  function handle(error, context = {}, options = {}) {
    // Silent redirect — страница уже перенаправляется, не логируем
    if (error && error._silentRedirect) return;

    // Нормализация ошибки
    const normalizedError = error instanceof Error ? error : new Error(String(error));

    // Определение типа и серьезности
    const type = context.type || detectErrorType(normalizedError);
    const severity = context.severity || detectSeverity(type, normalizedError);

    // Создание объекта ошибки
    const errorInfo = {
      timestamp: new Date().toISOString(),
      type,
      severity,
      message: normalizedError.message,
      stack: normalizedError.stack,
      context: {
        module: context.module || 'unknown',
        action: context.action || 'unknown',
        user: context.user || null,
        ...context
      },
      originalError: normalizedError
    };

    // Логирование в консоль
    if (config.logToConsole && !options.silent) {
      const prefix = `[${severity.toUpperCase()}] [${type}] [${errorInfo.context.module}]`;
      console.error(prefix, errorInfo.message, {
        context: errorInfo.context,
        stack: errorInfo.stack
      });
    }

    // Сохранение в историю
    errorHistory.push(errorInfo);
    if (errorHistory.length > config.maxStoredErrors) {
      errorHistory.shift(); // Удалить самую старую
    }

    // Показать Toast уведомление
    if (config.showToast && !options.silent && typeof Toast !== 'undefined') {
      const userMessage = getUserMessage(type, normalizedError, context);

      // Выбор типа Toast в зависимости от серьезности
      if (severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH) {
        Toast.error(userMessage);
      } else if (severity === ErrorSeverity.MEDIUM) {
        Toast.warning(userMessage);
      } else {
        Toast.info(userMessage);
      }
    }

    // Отправка в мониторинг (если настроено)
    if (config.sendToMonitoring && !options.silent) {
      sendToMonitoring(errorInfo);
    }

    return errorInfo;
  }

  /**
   * Обработка промисов с автоматической обработкой ошибок
   * @param {Promise} promise - Promise для обработки
   * @param {Object} context - Контекст ошибки
   * @returns {Promise} Обёрнутый promise
   */
  async function handleAsync(promise, context = {}) {
    try {
      return await promise;
    } catch (error) {
      handle(error, context);
      throw error; // Re-throw для возможности дополнительной обработки
    }
  }

  /**
   * Обёртка для функций с автоматической обработкой ошибок
   * @param {Function} fn - Функция для обёртывания
   * @param {Object} context - Контекст ошибки
   * @returns {Function} Обёрнутая функция
   */
  function wrap(fn, context = {}) {
    return async function(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        handle(error, context);
        throw error;
      }
    };
  }

  /**
   * Отправка ошибки в систему мониторинга
   * (Заглушка для будущей интеграции)
   */
  function sendToMonitoring(errorInfo) {
    // TODO: Интеграция с системой мониторинга (Sentry, LogRocket и т.д.)
    // Например: Sentry.captureException(errorInfo);
  }

  /**
   * Получить историю ошибок
   */
  function getHistory(filter = {}) {
    let filtered = [...errorHistory];

    if (filter.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }

    if (filter.severity) {
      filtered = filtered.filter(e => e.severity === filter.severity);
    }

    if (filter.module) {
      filtered = filtered.filter(e => e.context.module === filter.module);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      filtered = filtered.filter(e => new Date(e.timestamp) >= since);
    }

    return filtered;
  }

  /**
   * Очистить историю ошибок
   */
  function clearHistory() {
    errorHistory = [];
  }

  /**
   * Настроить ErrorHandler
   */
  function configure(newConfig) {
    Object.assign(config, newConfig);
  }

  /**
   * Создать специфичный обработчик для модуля
   */
  function createModuleHandler(moduleName) {
    return {
      handle: (error, context = {}, options = {}) =>
        handle(error, { ...context, module: moduleName }, options),

      handleAsync: (promise, context = {}) =>
        handleAsync(promise, { ...context, module: moduleName }),

      wrap: (fn, context = {}) =>
        wrap(fn, { ...context, module: moduleName })
    };
  }

  // Public API
  return {
    handle,
    handleAsync,
    wrap,
    getHistory,
    clearHistory,
    configure,
    createModuleHandler,
    ErrorType,
    ErrorSeverity
  };
})();

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
}
