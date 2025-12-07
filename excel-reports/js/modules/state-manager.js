// StateManager - Централизованное управление состоянием

class StateManager {
    constructor() {
        this.state = {
            currentStep: 'template',
            selectedTemplate: null,
            steps: {
                'template': { completed: false }
                // Динамические шаги добавляются при выборе шаблона
            }
        };
        this.listeners = new Map();
    }

    // Получить значение по пути с dot notation
    // Примеры: 'currentStep', 'steps.step1.completed', 'selectedTemplate.name'
    get(path) {
        if (!path) return this.state;

        const keys = path.split('.');
        let result = this.state;

        for (const key of keys) {
            if (result === null || result === undefined) {
                return undefined;
            }
            result = result[key];
        }

        return result;
    }

    // Установить значение по пути с dot notation
    // Примеры: set('currentStep', 'step1'), set('steps.step1.completed', true)
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();

        let target = this.state;
        for (const key of keys) {
            if (!(key in target)) {
                target[key] = {};
            }
            target = target[key];
        }

        target[lastKey] = value;

        // Уведомляем подписчиков
        this.notify(path, value);
    }

    // Подписаться на изменение состояния
    // Пример: subscribe('currentStep', (newStep) => { console.log(newStep); })
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, []);
        }
        this.listeners.get(path).push(callback);

        // Возвращаем функцию отписки
        return () => {
            const callbacks = this.listeners.get(path);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    // Уведомить подписчиков об изменении
    notify(path, value) {
        // Уведомляем точных подписчиков на этот путь
        const callbacks = this.listeners.get(path);
        if (callbacks) {
            callbacks.forEach(callback => callback(value));
        }

        // Уведомляем подписчиков на '*' (все изменения)
        const allCallbacks = this.listeners.get('*');
        if (allCallbacks) {
            allCallbacks.forEach(callback => callback({ path, value }));
        }
    }

    // Сброс состояния в начальное
    reset() {
        this.state = {
            currentStep: 'template',
            selectedTemplate: null,
            steps: {
                'template': { completed: false }
            }
        };

        this.notify('reset', null);
        this.notify('*', { path: 'reset', value: null });
    }

    // Инициализация шагов на основе выбранного шаблона
    initializeSteps(template) {
        const steps = {
            'template': { completed: true, data: template }
        };

        // Добавляем файловые шаги из конфигурации шаблона
        if (template && template.filesConfig) {
            Object.keys(template.filesConfig).forEach(stepId => {
                steps[stepId] = {
                    completed: false,
                    files: [],
                    data: []
                };
            });
        }

        // Добавляем финальный шаг обработки
        steps['process'] = {
            completed: false,
            result: null
        };

        this.set('steps', steps);
        this.set('selectedTemplate', template);
        this.notify('stepsInitialized', template);
    }

    // Проверка завершённости шага
    isStepCompleted(stepId) {
        const step = this.get(`steps.${stepId}`);
        if (!step) return false;

        return step.completed === true;
    }

    // Отметить шаг как завершённый
    markStepCompleted(stepId, data = null) {
        this.set(`steps.${stepId}.completed`, true);
        if (data !== null) {
            this.set(`steps.${stepId}.data`, data);
        }
    }

    // Проверка, все ли файловые шаги завершены
    areAllFileStepsCompleted() {
        const template = this.get('selectedTemplate');
        if (!template || !template.filesConfig) return false;

        const fileSteps = Object.keys(template.filesConfig);
        return fileSteps.every(stepId => this.isStepCompleted(stepId));
    }

    // Получить данные шага
    getStepData(stepId) {
        return this.get(`steps.${stepId}.data`);
    }

    // Установить данные шага
    setStepData(stepId, data) {
        this.set(`steps.${stepId}.data`, data);
    }

    // Получить файлы шага
    getStepFiles(stepId) {
        return this.get(`steps.${stepId}.files`) || [];
    }

    // Установить файлы шага
    setStepFiles(stepId, files) {
        this.set(`steps.${stepId}.files`, files);
    }

    // Вывод состояния в консоль для отладки
    debug() {
        console.log('=== STATE DEBUG ===');
        console.log('Current Step:', this.get('currentStep'));
        console.log('Selected Template:', this.get('selectedTemplate')?.name || 'None');
        console.log('Steps:', this.get('steps'));
        console.log('===================');
    }
}

// Экспорт для использования в других модулях
window.StateManager = StateManager;
